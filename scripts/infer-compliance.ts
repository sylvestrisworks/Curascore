/**
 * Infer regulatory compliance status from existing review data.
 *
 * Rules are conservative: a game is only marked non_compliant when the review
 * data clearly evidences a violation. Everything else is not_assessed.
 * All inferred records carry a "Estimated from review data" note so the UI
 * can distinguish them from expert-verified assessments.
 *
 * Regulations covered:
 *   DSA  — EU Digital Services Act (dark patterns, algorithmic targeting of minors)
 *   GDPR-K — GDPR applied to children's data (data collection, consent, profiling)
 *   ODDS — UK Children's Code / Online Design Standards (age-inappropriate design)
 *
 * Run with:
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/infer-compliance.ts
 */

import { eq, and } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { games, reviews, gameScores, complianceStatus, darkPatterns } from '../src/lib/db/schema'

// ─── Rule definitions ─────────────────────────────────────────────────────────

type Status = 'compliant' | 'non_compliant' | 'not_assessed'

type InferredBadge = {
  regulation: string
  status: Status
  notes: string
}

type ReviewRow = typeof reviews.$inferSelect
type GameRow   = typeof games.$inferSelect

/**
 * DSA — Digital Services Act
 */
function inferDSA(review: ReviewRow, dpSeverities: string[], esrb: string | null): InferredBadge {
  const highDPs = dpSeverities.filter(s => s === 'high').length
  const childTarget = review.childTargeting ?? 0
  const currencyObfusc = review.currencyObfuscation ?? 0
  const spendingPrompts = review.spendingPrompts ?? 0

  const violations: string[] = []

  if (childTarget >= 2) violations.push('deliberate child targeting in monetisation (childTargeting≥2)')
  if (currencyObfusc >= 2) violations.push('virtual currency obfuscation (currencyObfuscation≥2)')
  if (highDPs >= 2) violations.push(`${highDPs} high-severity dark patterns detected`)
  if (spendingPrompts >= 2 && esrb && ['E', 'E10+'].includes(esrb))
    violations.push('spending prompts in a children-rated game (spendingPrompts≥2)')

  if (violations.length > 0) {
    return {
      regulation: 'DSA',
      status: 'non_compliant',
      notes: `Estimated from review data. Likely violations: ${violations.join('; ')}.`,
    }
  }

  const monetClean = childTarget === 0 && currencyObfusc === 0 && (review.payToWin ?? 0) === 0
  const dpClean = highDPs === 0 && dpSeverities.filter(s => s === 'medium').length <= 1

  if (monetClean && dpClean) {
    return {
      regulation: 'DSA',
      status: 'compliant',
      notes: 'Estimated from review data. No dark pattern or child-targeting concerns found.',
    }
  }

  return {
    regulation: 'DSA',
    status: 'not_assessed',
    notes: 'Estimated from review data. Some monetisation signals present; manual review required.',
  }
}

/**
 * GDPR-K — GDPR applied to children's data
 */
function inferGDPRK(review: ReviewRow, esrb: string | null): InferredBadge {
  const privacyRisk = review.privacyRisk ?? 0
  const strangerRisk = review.strangerRisk ?? 0
  const childTarget = review.childTargeting ?? 0
  const isChildRated = esrb != null && ['E', 'E10+'].includes(esrb)

  const violations: string[] = []

  if (privacyRisk >= 2 && (isChildRated || childTarget >= 1))
    violations.push('elevated privacy risk in a children-rated or child-targeted game (privacyRisk≥2)')
  if (strangerRisk >= 2)
    violations.push('unmoderated stranger contact likely involving data exposure (strangerRisk≥2)')
  if (childTarget >= 2)
    violations.push('profiling/targeting of children for marketing purposes (childTargeting≥2)')

  if (violations.length > 0) {
    return {
      regulation: 'GDPR-K',
      status: 'non_compliant',
      notes: `Estimated from review data. Likely violations: ${violations.join('; ')}.`,
    }
  }

  if (privacyRisk === 0 && strangerRisk === 0 && childTarget === 0) {
    return {
      regulation: 'GDPR-K',
      status: 'compliant',
      notes: 'Estimated from review data. No privacy or child-targeting concerns found.',
    }
  }

  return {
    regulation: 'GDPR-K',
    status: 'not_assessed',
    notes: 'Estimated from review data. Low-level privacy signals; manual review required.',
  }
}

/**
 * ODDS — UK Children's Code / Online Design Standards
 */
function inferODDS(review: ReviewRow, esrb: string | null): InferredBadge {
  const infinite = review.infinitePlay ?? 0
  const stoppingBarriers = review.stoppingBarriers ?? 0
  const fomo = review.fomoEvents ?? 0
  const streaks = review.streakMechanics ?? 0
  const childTarget = review.childTargeting ?? 0
  const isChildOrTeen = esrb != null && ['E', 'E10+', 'T'].includes(esrb)

  const violations: string[] = []

  if ((infinite >= 2 || stoppingBarriers >= 2) && isChildOrTeen)
    violations.push('no meaningful stopping points in a children/teen-rated game')
  if (fomo >= 2 && isChildOrTeen)
    violations.push('FOMO mechanics pressuring extended sessions (fomoEvents≥2)')
  if (streaks >= 2 && isChildOrTeen)
    violations.push('streak mechanics discouraging breaks (streakMechanics≥2)')
  if (childTarget >= 2)
    violations.push('design deliberately targets children (childTargeting≥2)')

  if (violations.length > 0) {
    return {
      regulation: 'ODDS',
      status: 'non_compliant',
      notes: `Estimated from review data. Likely violations: ${violations.join('; ')}.`,
    }
  }

  const stoppingOk = review.hasNaturalStoppingPoints === true
  const lowDopamine = infinite <= 0 && stoppingBarriers <= 0 && fomo <= 1 && streaks <= 1

  if (stoppingOk && lowDopamine && childTarget === 0) {
    return {
      regulation: 'ODDS',
      status: 'compliant',
      notes: 'Estimated from review data. Game has natural stopping points and low session-extension risk.',
    }
  }

  return {
    regulation: 'ODDS',
    status: 'not_assessed',
    notes: 'Estimated from review data. Some session-extension signals; manual review required.',
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Inferring compliance status from review data…\n')

  const rows = await db
    .select({
      gameId:    games.id,
      slug:      games.slug,
      title:     games.title,
      esrb:      games.esrbRating,
      reviewId:  gameScores.reviewId,
    })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))

  console.log(`Found ${rows.length} reviewed games.\n`)

  let inserted = 0
  let updated  = 0
  let skipped  = 0

  for (const row of rows) {
    const [review] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, row.reviewId))
      .limit(1)

    if (!review) { skipped++; continue }

    const dps = await db
      .select({ severity: darkPatterns.severity })
      .from(darkPatterns)
      .where(eq(darkPatterns.reviewId, row.reviewId))

    const dpSeverities = dps.map(d => d.severity)

    const badges = [
      inferDSA(review, dpSeverities, row.esrb),
      inferGDPRK(review, row.esrb),
      inferODDS(review, row.esrb),
    ]

    for (const badge of badges) {
      // FIX: Använd Drizzle's and(eq(), eq()) istället för rå sql-template
      const existing = await db
        .select({ id: complianceStatus.id })
        .from(complianceStatus)
        .where(
          and(
            eq(complianceStatus.gameId, row.gameId),
            eq(complianceStatus.regulation, badge.regulation)
          )
        )
        .limit(1)

      if (existing.length > 0) {
        await db
          .update(complianceStatus)
          .set({
            status:     badge.status,
            notes:      badge.notes,
            assessedAt: new Date(),
          })
          .where(eq(complianceStatus.id, existing[0].id))
        updated++
      } else {
        await db
          .insert(complianceStatus)
          .values({
            gameId:     row.gameId,
            regulation: badge.regulation,
            status:     badge.status,
            notes:      badge.notes,
            assessedAt: new Date(),
          })
        inserted++
      }
    }

    const statuses = badges.map(b => `${b.regulation}:${b.status}`).join('  ')
    console.log(`  ${row.title.padEnd(40)} ${statuses}`)
  }

  console.log(`\nDone. inserted=${inserted}  updated=${updated}  skipped=${skipped}`)
}

main().catch((err) => { console.error(err); process.exit(1) })
