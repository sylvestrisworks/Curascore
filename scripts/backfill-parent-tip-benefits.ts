/**
 * Backfill parentTipBenefits for existing reviews that have parentTip but no parentTipBenefits.
 *
 * Uses Gemini Flash to generate a 1-2 sentence benefit-focused encouragement tip
 * based on the game's existing benefitsNarrative and topBenefits.
 *
 * Usage:
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/backfill-parent-tip-benefits.ts
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/backfill-parent-tip-benefits.ts --save
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/backfill-parent-tip-benefits.ts --save --limit 20
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env') })

import { GoogleGenAI } from '@google/genai'
import { db } from '../src/lib/db'
import { games, reviews, gameScores } from '../src/lib/db/schema'
import { eq, isNull, isNotNull, sql } from 'drizzle-orm'

const args  = process.argv.slice(2)
const SAVE  = args.includes('--save')
const LIMIT = parseInt(args[args.indexOf('--limit') + 1] ?? '999999', 10)

const googleAI = new GoogleGenAI({
  vertexai: true,
  project:  process.env.GOOGLE_PROJECT_ID!,
  location: process.env.GOOGLE_LOCATION ?? 'us-central1',
})

async function generateBenefitsTip(gameTitle: string, benefitsNarrative: string | null, topBenefits: Array<{ skill: string; score: number }> | null): Promise<string> {
  const skillsList = topBenefits?.slice(0, 3).map(b => b.skill).join(', ') ?? 'various skills'
  const narrative  = benefitsNarrative ?? `This game develops ${skillsList}.`

  const prompt = `You are writing a brief parent tip for the Good Game Parent platform.

Game: "${gameTitle}"
What it develops: ${narrative}
Top skills: ${skillsList}

Write 1–2 sentences of benefit-focused encouragement for a parent. The tip should:
- Be warm and positive
- Mention specific skills the game develops
- Help the parent feel good about letting their child play
- NOT repeat risk warnings (that's covered elsewhere)
- Start with something like "Encourage...", "Use this...", "Point out...", "Ask your child...", etc.

Return ONLY the tip text, no quotes, no preamble.`

  const res = await googleAI.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { temperature: 0.7, maxOutputTokens: 150 },
  })

  const text = res.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
  if (!text) throw new Error('Empty response from Gemini')
  return text
}

async function main() {
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║  Backfill parentTipBenefits                      ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log(`  Save: ${SAVE ? 'YES' : 'no (dry run)'}  |  Limit: ${LIMIT}`)
  if (!SAVE) console.log('  Tip: add --save to write results to the DB\n')

  if (!process.env.GOOGLE_PROJECT_ID) {
    console.error('ERROR: GOOGLE_PROJECT_ID not set')
    process.exit(1)
  }

  // Find approved reviews that have parentTip but no parentTipBenefits
  const rows = await db
    .select({
      reviewId:          reviews.id,
      gameTitle:         games.title,
      parentTip:         reviews.parentTip,
      benefitsNarrative: reviews.benefitsNarrative,
      topBenefits:       gameScores.topBenefits,
    })
    .from(reviews)
    .innerJoin(games, eq(games.id, reviews.gameId))
    .leftJoin(gameScores, eq(gameScores.reviewId, reviews.id))
    .where(
      sql`${reviews.parentTip} IS NOT NULL AND ${reviews.parentTipBenefits} IS NULL`
    )
    .limit(LIMIT)

  console.log(`\nFound ${rows.length} review(s) to backfill\n`)

  let done = 0, failed = 0
  for (const row of rows) {
    process.stdout.write(`  [${done + 1}/${rows.length}] ${row.gameTitle} … `)
    try {
      const tip = await generateBenefitsTip(
        row.gameTitle,
        row.benefitsNarrative,
        row.topBenefits as Array<{ skill: string; score: number }> | null,
      )
      console.log(`OK`)
      console.log(`    "${tip.slice(0, 100)}${tip.length > 100 ? '…' : ''}"`)

      if (SAVE) {
        await db.update(reviews)
          .set({ parentTipBenefits: tip })
          .where(eq(reviews.id, row.reviewId))
      }
      done++
    } catch (err) {
      console.log(`FAILED`)
      console.error(`    ${err}`)
      failed++
    }

    // Brief pause to avoid rate limits
    await new Promise(r => setTimeout(r, 500))
  }

  console.log(`\n  Done: ${done} backfilled, ${failed} failed`)
  if (!SAVE && done > 0) console.log('  Run with --save to persist results.')
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
