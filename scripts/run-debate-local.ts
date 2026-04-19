/**
 * Runs the debate pipeline locally for testing / manual triggering.
 * Shares all logic with the cron route but runs as a script.
 *
 * Run with:
 *   node --env-file=.env.local node_modules/tsx/dist/cli.cjs scripts/run-debate-local.ts
 */

import { db } from '@/lib/db'
import { games, gameScores } from '@/lib/db/schema'
import { eq, gte, lte, isNull, isNotNull, and } from 'drizzle-orm'

// ─── Config ───────────────────────────────────────────────────────────────────

const MAX_DEBATES_PER_RUN = 4
const DELAY_MS            = 5000
const GEMINI_MODEL        = 'gemini-2.5-flash'
const GEMINI_URL          = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
const CRITIC_WEIGHT       = 0.60
const MAX_AUTO_SWING      = 20
const DEBATE_MIN_SCORE    = 35
const DEBATE_MAX_SCORE    = 60

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── Rubric fields ─────────────────────────────────────────────────────────────

const B1_FIELDS = ['problemSolving','spatialAwareness','strategicThinking','criticalThinking','memoryAttention','creativity','readingLanguage','mathSystems','learningTransfer','adaptiveChallenge']
const B2_FIELDS = ['teamwork','communication','empathy','emotionalRegulation','ethicalReasoning','positiveSocial']
const B3_FIELDS = ['handEyeCoord','fineMotor','reactionTime','physicalActivity']
const R1_FIELDS = ['variableRewards','streakMechanics','lossAversion','fomoEvents','stoppingBarriers','notifications','nearMiss','infinitePlay','escalatingCommitment','variableRewardFreq']
const R2_FIELDS = ['spendingCeiling','payToWin','currencyObfuscation','spendingPrompts','childTargeting','adPressure','subscriptionPressure','socialSpending']
const R3_FIELDS = ['socialObligation','competitiveToxicity','strangerRisk','socialComparison','identitySelfWorth','privacyRisk']

type DebateScores = {
  b1: Record<string, number>; b2: Record<string, number>; b3: Record<string, number>
  r1: Record<string, number>; r2: Record<string, number>; r3: Record<string, number>
}

type GameRow = typeof games.$inferSelect

function scoreGroupDebate(fields: string[], max: number) {
  return {
    type: 'object' as const, required: fields,
    properties: Object.fromEntries(fields.map(f => [f, { type: 'integer' as const, minimum: 0, maximum: max }])),
  }
}

const DEBATE_TOOL = {
  name: 'submit_scores',
  description: 'Submit your scores and reasoning for this debate round.',
  input_schema: {
    type: 'object',
    required: ['b1','b2','b3','r1','r2','r3','reasoning'],
    properties: {
      b1: scoreGroupDebate(B1_FIELDS, 5),
      b2: scoreGroupDebate(B2_FIELDS, 5),
      b3: scoreGroupDebate(B3_FIELDS, 5),
      r1: scoreGroupDebate(R1_FIELDS, 3),
      r2: scoreGroupDebate(R2_FIELDS, 3),
      r3: scoreGroupDebate(R3_FIELDS, 3),
      reasoning: { type: 'string' as const },
    },
  },
}

function rubricsBlock(): string {
  return `## RUBRIC (0–5 per benefit field, 0–3 per risk field)
B1 Cognitive (0–5 each): ${B1_FIELDS.join(', ')}
B2 Social (0–5 each): ${B2_FIELDS.join(', ')}
B3 Motor (0–5 each): ${B3_FIELDS.join(', ')}
R1 Dopamine (0–3 each): ${R1_FIELDS.join(', ')}
R2 Monetization (0–3 each): ${R2_FIELDS.join(', ')}
R3 Social risk (0–3 each): ${R3_FIELDS.join(', ')}

CALIBRATION:
Zelda BotW:  B1=42, B2=18, B3=10 | R1=2,  R2=0,  R3=2  → curascore 82
Minecraft:   B1=38, B2=16, B3=6  | R1=4,  R2=2,  R3=4  → curascore 75
Fortnite:    B1=19, B2=10, B3=13 | R1=18, R2=13, R3=11 → curascore 42
Brawl Stars: B1=14, B2=9,  B3=11 | R1=23, R2=18, R3=12 → curascore 30`
}

function gameBlock(g: GameRow): string {
  return `Title: ${g.title}
Genres: ${(g.genres as string[])?.join(', ') || 'Unknown'}
Platforms: ${(g.platforms as string[])?.join(', ') || 'Unknown'}
Description: ${g.description ?? 'Not available'}
Metacritic: ${g.metacriticScore ?? 'N/A'}
Microtransactions: ${g.hasMicrotransactions ? 'Yes' : 'No'}  Loot boxes: ${g.hasLootBoxes ? 'Yes' : 'No'}  Battle pass: ${g.hasBattlePass ? 'Yes' : 'No'}
Stranger chat: ${g.hasStrangerChat ? 'Yes' : 'No'}`
}

function scoresBlock(s: DebateScores): string {
  const fmt = (label: string, fields: string[], scores: Record<string, number>) =>
    `${label}: ${fields.map(f => `${f}=${scores[f] ?? '?'}`).join(', ')}`
  return [
    fmt('B1', B1_FIELDS, s.b1), fmt('B2', B2_FIELDS, s.b2), fmt('B3', B3_FIELDS, s.b3),
    fmt('R1', R1_FIELDS, s.r1), fmt('R2', R2_FIELDS, s.r2), fmt('R3', R3_FIELDS, s.r3),
  ].join('\n')
}

function advocatePrompt(gameInfo: string, round: number, criticScores?: DebateScores, criticReasoning?: string): string {
  const role = `You are the ADVOCATE in a LumiKin scoring debate. Argue for the HIGHEST DEFENSIBLE scores.
- Push benefit scores UP whenever evidence supports it
- Push risk scores DOWN when risks are manageable
- Base arguments on child development research
- CRITICAL: Single-player games with no co-op get teamwork=0, communication=0, positiveSocial≤1
- CRITICAL: If a game has an optional online/multiplayer mode (e.g. Red Dead Online bundled with RDR2, Minecraft Realms), score it on its PRIMARY/CORE experience — the single-player or default offline mode. Do NOT inflate R1/R2/R3 risks for a separate online component that parents can simply not use. The critic will try to use the online component to drive risk scores up; push back firmly.`
  if (round === 1) {
    return `${role}\n\n${rubricsBlock()}\n\n## GAME\n${gameInfo}\n\nProduce your OPENING position. Call submit_scores with your scores and reasoning.`
  }
  return `${role}\n\n${rubricsBlock()}\n\n## GAME\n${gameInfo}\n\n## CRITIC'S POSITION\nScores:\n${scoresBlock(criticScores!)}\nCritic's reasoning: "${criticReasoning}"\n\nPush back. Call submit_scores with your revised scores and rebuttal.`
}

function criticPrompt(gameInfo: string, round: number, advocateScores?: DebateScores, advocateReasoning?: string): string {
  const role = `You are the CRITIC in a LumiKin scoring debate. Argue for the LOWEST DEFENSIBLE scores.
- Push benefit scores DOWN unless evidence is strong
- Push risk scores UP whenever a design pattern is present
- Single-player games with no multiplayer: teamwork=0, communication=0, positiveSocial≤1
- High metacritic does NOT mean high developmental scores
- IMPORTANT: If a game has an optional/bundled online mode (e.g. Red Dead Online, Minecraft Realms), you may note it exists — but score R1/R2/R3 risks for the PRIMARY experience, not the optional online add-on. Do not use a bundled online component to max out social/monetization risk scores on an otherwise offline premium game.`
  if (round === 1) {
    return `${role}\n\n${rubricsBlock()}\n\n## GAME\n${gameInfo}\n\nProduce your OPENING position. Call submit_scores with your scores and reasoning.`
  }
  return `${role}\n\n${rubricsBlock()}\n\n## GAME\n${gameInfo}\n\n## ADVOCATE'S POSITION\nScores:\n${scoresBlock(advocateScores!)}\nAdvocate's reasoning: "${advocateReasoning}"\n\nChallenge the weakest claims. Call submit_scores with your revised scores and rebuttal.`
}

async function callGeminiDebate(prompt: string, attempt = 0): Promise<{ scores: DebateScores; reasoning: string }> {
  const url = `${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        tools: [{
          functionDeclarations: [{
            name: DEBATE_TOOL.name,
            description: DEBATE_TOOL.description,
            parameters: DEBATE_TOOL.input_schema,
          }],
        }],
        tool_config: { function_calling_config: { mode: 'ANY', allowed_function_names: ['submit_scores'] } },
        generationConfig: { temperature: 0.4 },
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      if ((res.status === 429 || res.status === 503) && attempt < 3) {
        const wait = Math.pow(2, attempt) * 5000
        console.log(`  Rate limited, retrying in ${wait/1000}s...`)
        await sleep(wait)
        return callGeminiDebate(prompt, attempt + 1)
      }
      throw new Error(`Gemini ${res.status}: ${errText}`)
    }

    const data = await res.json()
    const part = data.candidates?.[0]?.content?.parts?.find(
      (p: { functionCall?: unknown }) => p.functionCall
    )
    if (!part?.functionCall?.args) {
      if (attempt < 3) { await sleep(Math.pow(2, attempt) * 5000); return callGeminiDebate(prompt, attempt + 1) }
      throw new Error('Gemini did not return a function call')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = part.functionCall.args as any
    return { scores: { b1: a.b1, b2: a.b2, b3: a.b3, r1: a.r1, r2: a.r2, r3: a.r3 }, reasoning: a.reasoning }
  } catch (err: unknown) {
    const isTransient = String(err).includes('fetch failed') || String(err).includes('ECONNRESET')
    if (isTransient && attempt < 3) { await sleep(Math.pow(2, attempt) * 5000); return callGeminiDebate(prompt, attempt + 1) }
    throw err
  }
}

function weightedDebateScores(advocate: DebateScores, critic: DebateScores): DebateScores {
  const w = (fa: Record<string, number>, fb: Record<string, number>) =>
    Object.fromEntries(Object.keys(fa).map(k => [k, Math.round(fa[k] * (1 - CRITIC_WEIGHT) + fb[k] * CRITIC_WEIGHT)]))
  return { b1: w(advocate.b1, critic.b1), b2: w(advocate.b2, critic.b2), b3: w(advocate.b3, critic.b3), r1: w(advocate.r1, critic.r1), r2: w(advocate.r2, critic.r2), r3: w(advocate.r3, critic.r3) }
}

function computeDebateCurascore(s: DebateScores) {
  const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0)
  const bds = sum(s.b1) / 50 * 0.50 + sum(s.b2) / 30 * 0.30 + sum(s.b3) / 20 * 0.20
  const ris = sum(s.r1) / 30 * 0.45 + sum(s.r2) / 24 * 0.30 + sum(s.r3) / 18 * 0.25
  const safety = 1 - ris
  const curascore = (bds + safety) > 0 ? Math.round((2 * bds * safety) / (bds + safety) * 100) : 0
  return { bds, ris, curascore }
}

async function runDebate(game: GameRow, currentCurascore: number) {
  const gInfo = gameBlock(game)
  console.log(`  Round 1 — advocate...`)
  const r1adv  = await callGeminiDebate(advocatePrompt(gInfo, 1))
  await sleep(DELAY_MS)
  console.log(`  Round 1 — critic...`)
  const r1crit = await callGeminiDebate(criticPrompt(gInfo, 1))
  await sleep(DELAY_MS)
  console.log(`  Round 2 — advocate rebuttal...`)
  const r2adv  = await callGeminiDebate(advocatePrompt(gInfo, 2, r1crit.scores, r1crit.reasoning))
  await sleep(DELAY_MS)
  console.log(`  Round 2 — critic rebuttal...`)
  const r2crit = await callGeminiDebate(criticPrompt(gInfo, 2, r1adv.scores, r1adv.reasoning))

  const finalScores = weightedDebateScores(r2adv.scores, r2crit.scores)
  const { bds, ris, curascore } = computeDebateCurascore(finalScores)
  const swing = curascore - currentCurascore

  console.log(`  Final: curascore ${currentCurascore} → ${curascore}  (swing ${swing > 0 ? '+' : ''}${swing})`)
  console.log(`  BDS: ${bds.toFixed(3)}  RIS: ${ris.toFixed(3)}`)

  const transcript = [
    `=== Round 1 ===`,
    `ADVOCATE:\n${scoresBlock(r1adv.scores)}\nReasoning: ${r1adv.reasoning}`,
    `CRITIC:\n${scoresBlock(r1crit.scores)}\nReasoning: ${r1crit.reasoning}`,
    `=== Round 2 ===`,
    `ADVOCATE:\n${scoresBlock(r2adv.scores)}\nReasoning: ${r2adv.reasoning}`,
    `CRITIC:\n${scoresBlock(r2crit.scores)}\nReasoning: ${r2crit.reasoning}`,
    `=== Final (40% advocate / 60% critic) ===`,
    `${scoresBlock(finalScores)}`,
    `Curascore: ${curascore}  BDS: ${bds.toFixed(3)}  RIS: ${ris.toFixed(3)}`,
  ].join('\n\n')

  if (Math.abs(swing) > MAX_AUTO_SWING) {
    console.log(`  Swing too large (>${MAX_AUTO_SWING}) — skipping save`)
    return { saved: false, curascore }
  }

  await db.update(gameScores).set({ bds, ris, curascore, debateTranscript: transcript, debateRounds: 2 }).where(eq(gameScores.gameId, game.id))
  console.log(`  ✓ Saved`)
  return { saved: true, curascore }
}

async function main() {
  if (!process.env.GEMINI_API_KEY) { console.error('GEMINI_API_KEY not set'); process.exit(1) }

  const candidates = await db
    .select({ game: games, curascore: gameScores.curascore })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(and(
      isNotNull(gameScores.curascore),
      gte(gameScores.curascore, DEBATE_MIN_SCORE),
      lte(gameScores.curascore, DEBATE_MAX_SCORE),
      isNull(gameScores.debateRounds),
    ))
    .limit(MAX_DEBATES_PER_RUN)

  if (candidates.length === 0) {
    console.log('No debate candidates found (curascore 35–60, no debate yet)')
    process.exit(0)
  }

  console.log(`Found ${candidates.length} debate candidates:\n`)
  for (const { game, curascore } of candidates) {
    console.log(`  ${game.title} (curascore ${curascore})`)
  }
  console.log()

  for (const { game, curascore } of candidates) {
    console.log(`\nDebating: ${game.title} (current curascore: ${curascore})`)
    try {
      await sleep(DELAY_MS)
      await runDebate(game, curascore!)
    } catch (err) {
      console.error(`  ✗ Failed:`, err)
    }
  }

  console.log('\nDone.')
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
