/**
 * Verifies that the scoring engine produces results consistent with RUBRIC.md
 * worked examples and validates all 20 seeded games.
 */
import { db } from '../src/lib/db'
import { games, reviews, gameScores } from '../src/lib/db/schema'
import { eq } from 'drizzle-orm'
import { calculateGameScores } from '../src/lib/scoring/engine'

// ─── Rubric worked-example assertions ────────────────────────────────────────

function assertClose(label: string, actual: number, expected: number, tol = 0.005) {
  const ok = Math.abs(actual - expected) <= tol
  const mark = ok ? '✓' : '✗'
  const msg = `${mark} ${label}: got ${actual.toFixed(4)}, expected ${expected.toFixed(4)}`
  if (!ok) console.error('  FAIL ' + msg)
  else console.log('       ' + msg)
  return ok
}

function verifyFormulas() {
  console.log('\n── Scoring formula verification (against RUBRIC.md worked examples) ──\n')
  let pass = 0, fail = 0

  // Example 1: Zelda TotK
  // B1=34/50=0.68, B2=9/30=0.30, B3=10/20=0.50
  // BDS = 0.68×0.50 + 0.30×0.30 + 0.50×0.20 = 0.34+0.09+0.10 = 0.53
  // R1=3/30=0.10, R2=0/24=0, R3=0/18=0
  // RIS = 0.10×0.45 + 0×0.30 + 0×0.25 = 0.045
  const zelda = calculateGameScores({
    problemSolving:5, spatialAwareness:5, strategicThinking:3, criticalThinking:3,
    memoryAttention:3, creativity:5, readingLanguage:2, mathSystems:2,
    learningTransfer:2, adaptiveChallenge:4,
    teamwork:0, communication:0, empathy:3, emotionalRegulation:4,
    ethicalReasoning:2, positiveSocial:0,
    handEyeCoord:4, fineMotor:3, reactionTime:3, physicalActivity:0,
    variableRewards:0, streakMechanics:0, lossAversion:0, fomoEvents:0,
    stoppingBarriers:1, notifications:0, nearMiss:0, infinitePlay:1,
    escalatingCommitment:1, variableRewardFreq:0,
    spendingCeiling:0, payToWin:0, currencyObfuscation:0, spendingPrompts:0,
    childTargeting:0, adPressure:0, subscriptionPressure:0, socialSpending:0,
    socialObligation:0, competitiveToxicity:0, strangerRisk:0, socialComparison:0,
    identitySelfWorth:0, privacyRisk:0,
  })
  console.log(' Zelda: Tears of the Kingdom')
  ;[
    assertClose('BDS', zelda.bds, 0.53),
    assertClose('RIS', zelda.ris, 0.045),
    assertClose('time minutes', zelda.timeRecommendation.minutes, 120),
  ].forEach(r => r ? pass++ : fail++)

  // Example 2: Genshin Impact
  // B1=21/50=0.42, B2=11/30=0.367, B3=10/20=0.50
  // BDS = 0.42×0.50 + 0.367×0.30 + 0.50×0.20 = 0.21+0.11+0.10 = 0.42
  // R1=24/30=0.80, R2=15/24=0.625, R3=8/18=0.444
  // RIS = 0.80×0.45 + 0.625×0.30 + 0.444×0.25 = 0.36+0.1875+0.111 = 0.6585
  const genshin = calculateGameScores({
    problemSolving:3, spatialAwareness:4, strategicThinking:3, criticalThinking:2,
    memoryAttention:2, creativity:1, readingLanguage:2, mathSystems:2,
    learningTransfer:1, adaptiveChallenge:1,
    teamwork:3, communication:2, empathy:2, emotionalRegulation:1,
    ethicalReasoning:1, positiveSocial:2,
    handEyeCoord:4, fineMotor:3, reactionTime:3, physicalActivity:0,
    variableRewards:3, streakMechanics:2, lossAversion:2, fomoEvents:3,
    stoppingBarriers:2, notifications:2, nearMiss:2, infinitePlay:2,
    escalatingCommitment:3, variableRewardFreq:3,
    spendingCeiling:3, payToWin:2, currencyObfuscation:3, spendingPrompts:2,
    childTargeting:1, adPressure:0, subscriptionPressure:2, socialSpending:2,
    socialObligation:1, competitiveToxicity:1, strangerRisk:1, socialComparison:2,
    identitySelfWorth:2, privacyRisk:1,
  })
  console.log('\n Genshin Impact')
  ;[
    assertClose('BDS', genshin.bds, 0.42),
    assertClose('RIS', genshin.ris, 0.659, 0.005),
    assertClose('time minutes', genshin.timeRecommendation.minutes, 30),
  ].forEach(r => r ? pass++ : fail++)

  // Example 3: Minecraft (vanilla)
  // B1=38/50=0.76, B2=16/30=0.533, B3=6/20=0.30
  // BDS = 0.76×0.50 + 0.533×0.30 + 0.30×0.20 = 0.38+0.16+0.06 = 0.60
  // R1=4/30=0.133, R2=2/24=0.083, R3=4/18=0.222
  // RIS = 0.133×0.45 + 0.083×0.30 + 0.222×0.25 = 0.06+0.025+0.056 = 0.141
  // BDS=0.60 → benefit extension → already at max tier → stays 120
  const minecraft = calculateGameScores({
    problemSolving:4, spatialAwareness:5, strategicThinking:3, criticalThinking:3,
    memoryAttention:3, creativity:5, readingLanguage:2, mathSystems:4,
    learningTransfer:4, adaptiveChallenge:5,
    teamwork:3, communication:3, empathy:1, emotionalRegulation:3,
    ethicalReasoning:2, positiveSocial:4,
    handEyeCoord:2, fineMotor:2, reactionTime:2, physicalActivity:0,
    variableRewards:0, streakMechanics:0, lossAversion:0, fomoEvents:0,
    stoppingBarriers:1, notifications:0, nearMiss:0, infinitePlay:2,
    escalatingCommitment:1, variableRewardFreq:0,
    spendingCeiling:1, payToWin:0, currencyObfuscation:0, spendingPrompts:0,
    childTargeting:0, adPressure:0, subscriptionPressure:1, socialSpending:0,
    socialObligation:0, competitiveToxicity:1, strangerRisk:2, socialComparison:0,
    identitySelfWorth:0, privacyRisk:1,
  })
  console.log('\n Minecraft (vanilla)')
  ;[
    assertClose('BDS', minecraft.bds, 0.60),
    assertClose('RIS', minecraft.ris, 0.141, 0.005),
    assertClose('time minutes', minecraft.timeRecommendation.minutes, 120),
  ].forEach(r => r ? pass++ : fail++)

  // Boundary: BDS≥0.60 extension — Minecraft Marketplace (RIS=0.465 < 0.70 → EXTENDS)
  const mcMarket = calculateGameScores({
    problemSolving:4, spatialAwareness:5, strategicThinking:3, criticalThinking:3,
    memoryAttention:3, creativity:5, readingLanguage:2, mathSystems:4,
    learningTransfer:4, adaptiveChallenge:5, // B1=38
    teamwork:3, communication:3, empathy:1, emotionalRegulation:3,
    ethicalReasoning:2, positiveSocial:4, // B2=16
    handEyeCoord:2, fineMotor:2, reactionTime:2, physicalActivity:0, // B3=6
    variableRewards:2, streakMechanics:1, lossAversion:0, fomoEvents:2,
    stoppingBarriers:1, notifications:1, nearMiss:0, infinitePlay:2,
    escalatingCommitment:2, variableRewardFreq:1, // R1=12
    spendingCeiling:3, payToWin:1, currencyObfuscation:2, spendingPrompts:2,
    childTargeting:3, adPressure:0, subscriptionPressure:2, socialSpending:2, // R2=15
    socialObligation:0, competitiveToxicity:1, strangerRisk:2, socialComparison:2,
    identitySelfWorth:1, privacyRisk:1, // R3=7
  })
  console.log('\n Minecraft + Marketplace (BDS≥0.60 extension: 60→90)')
  ;[
    assertClose('BDS', mcMarket.bds, 0.60),
    assertClose('RIS base tier', mcMarket.ris, 0.465, 0.005), // 0.31-0.50 → tier 60min → extended to 90
    assertClose('time minutes (extended)', mcMarket.timeRecommendation.minutes, 90),
  ].forEach(r => r ? pass++ : fail++)

  // Boundary: BDS<0.20 AND RIS>0.30 drops tier — Subway Surfers (30→15)
  const subway = calculateGameScores({
    problemSolving:0, spatialAwareness:2, strategicThinking:0, criticalThinking:0,
    memoryAttention:1, creativity:0, readingLanguage:0, mathSystems:0,
    learningTransfer:0, adaptiveChallenge:1, // B1=4
    teamwork:0, communication:0, empathy:0, emotionalRegulation:0,
    ethicalReasoning:0, positiveSocial:1, // B2=1
    handEyeCoord:2, fineMotor:1, reactionTime:3, physicalActivity:0, // B3=6
    variableRewards:2, streakMechanics:2, lossAversion:1, fomoEvents:2,
    stoppingBarriers:2, notifications:2, nearMiss:2, infinitePlay:3,
    escalatingCommitment:1, variableRewardFreq:2, // R1=19
    spendingCeiling:3, payToWin:2, currencyObfuscation:2, spendingPrompts:2,
    childTargeting:2, adPressure:3, subscriptionPressure:0, socialSpending:1, // R2=15
    socialObligation:0, competitiveToxicity:0, strangerRisk:0, socialComparison:2,
    identitySelfWorth:0, privacyRisk:2, // R3=4
  })
  console.log('\n Subway Surfers (BDS<0.20 AND RIS>0.30 drops: 30→15)')
  ;[
    assertClose('BDS', subway.bds, 0.11, 0.01),
    assertClose('RIS', subway.ris, 0.528, 0.005),
    assertClose('time minutes (dropped)', subway.timeRecommendation.minutes, 15),
  ].forEach(r => r ? pass++ : fail++)

  // R4 must NOT affect RIS
  const withContentRisk = calculateGameScores({ violenceLevel: 3, sexualContent: 3, language: 3, substanceRef: 3, fearHorror: 3 })
  const withoutContentRisk = calculateGameScores({})
  const r4IsolatedOk = withContentRisk.ris === withoutContentRisk.ris
  console.log(`\n R4 content isolation: ${r4IsolatedOk ? '✓' : '✗'} (R4 does not affect RIS)`)
  r4IsolatedOk ? pass++ : fail++

  console.log(`\n Passed: ${pass}  Failed: ${fail}\n`)
  return fail === 0
}

// ─── Live DB verification ─────────────────────────────────────────────────────

async function verifyDb() {
  console.log('── Live DB scores vs re-calculated ──\n')

  const rows = await db
    .select({
      title: games.title,
      slug: games.slug,
      storedBds: gameScores.bds,
      storedRis: gameScores.ris,
      storedMinutes: gameScores.timeRecommendationMinutes,
      storedColor: gameScores.timeRecommendationColor,
      reviewId: gameScores.reviewId,
    })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .orderBy(gameScores.ris)

  let drift = 0
  for (const row of rows) {
    const [rev] = await db.select().from(reviews).where(eq(reviews.id, row.reviewId)).limit(1)
    if (!rev) { console.error(`  ✗ No review found for ${row.title}`); drift++; continue }

    const recalc = calculateGameScores({ ...rev, esrbRating: undefined })
    const bdsDiff = Math.abs((row.storedBds ?? 0) - recalc.bds)
    const risDiff = Math.abs((row.storedRis ?? 0) - recalc.ris)
    const minutesMatch = row.storedMinutes === recalc.timeRecommendation.minutes

    const ok = bdsDiff < 0.001 && risDiff < 0.001 && minutesMatch
    if (!ok) {
      drift++
      console.error(`  ✗ ${row.title}`)
      if (bdsDiff >= 0.001) console.error(`      BDS: stored=${row.storedBds?.toFixed(4)} recalc=${recalc.bds.toFixed(4)}`)
      if (risDiff >= 0.001) console.error(`      RIS: stored=${row.storedRis?.toFixed(4)} recalc=${recalc.ris.toFixed(4)}`)
      if (!minutesMatch) console.error(`      min: stored=${row.storedMinutes} recalc=${recalc.timeRecommendation.minutes}`)
    } else {
      const bds = Math.round((row.storedBds ?? 0) * 100)
      const ris = Math.round((row.storedRis ?? 0) * 100)
      const col = row.storedColor ?? '?'
      console.log(`  ✓ ${row.title.padEnd(48)} BDS ${String(bds).padStart(3)}  RIS ${String(ris).padStart(3)}  ${row.storedMinutes}min [${col}]`)
    }
  }

  if (drift === 0) {
    console.log(`\n  All ${rows.length} game scores match re-calculation ✓`)
  } else {
    console.error(`\n  ${drift} game(s) have score drift — re-run seed-reviews.ts`)
  }

  return drift === 0
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const formulasOk = verifyFormulas()
  const dbOk = await verifyDb()

  if (!formulasOk || !dbOk) {
    process.exit(1)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
