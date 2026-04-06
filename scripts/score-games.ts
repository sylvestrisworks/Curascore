/**
 * Score all games without game_scores using Claude Sonnet 4.6 + prompt caching.
 *
 * The RUBRIC.md is sent as a cached system prompt — pays the cache-write cost
 * once (~$0.026) then $0.30/MTok for reads vs $3.00/MTok uncached.
 *
 * Skips games that already have a game_scores row (safe to re-run).
 *
 * Usage:
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/score-games.ts
 *
 * Estimated cost: ~$7 for ~480 games (Sonnet 4.6, prompt caching)
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import { join } from 'path'
import { config } from 'dotenv'
config({ path: join(process.cwd(), '.env') })

import { eq, isNull } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { games, reviews, gameScores } from '../src/lib/db/schema'
import { calculateGameScores } from '../src/lib/scoring/engine'

// ─── Config ───────────────────────────────────────────────────────────────────

const RUBRIC    = readFileSync(join(process.cwd(), 'docs/RUBRIC.md'), 'utf-8')
const MODEL     = 'claude-sonnet-4-6'
const MAX_TOKENS = 1400
const CONCURRENCY = 3

const PRICE = {
  inputPerMTok:       3.00,
  outputPerMTok:     15.00,
  cacheWritePerMTok:  3.75,
  cacheReadPerMTok:   0.30,
}

// ─── Types ────────────────────────────────────────────────────────────────────

type GameRow = {
  id: number; slug: string; title: string
  developer: string | null; publisher: string | null
  releaseDate: Date | null; genres: unknown; platforms: unknown
  esrbRating: string | null; metacriticScore: number | null
  description: string | null
  hasMicrotransactions: boolean | null; hasLootBoxes: boolean | null
  hasSubscription: boolean | null; hasBattlePass: boolean | null
  requiresInternet: string | null; hasStrangerChat: boolean | null
  chatModeration: string | null
}

type AiScores = {
  problemSolving: number; spatialAwareness: number; strategicThinking: number
  criticalThinking: number; memoryAttention: number; creativity: number
  readingLanguage: number; mathSystems: number; learningTransfer: number
  adaptiveChallenge: number
  teamwork: number; communication: number; empathy: number
  emotionalRegulation: number; ethicalReasoning: number; positiveSocial: number
  handEyeCoord: number; fineMotor: number; reactionTime: number; physicalActivity: number
  variableRewards: number; streakMechanics: number; lossAversion: number
  fomoEvents: number; stoppingBarriers: number; notifications: number
  nearMiss: number; infinitePlay: number; escalatingCommitment: number
  variableRewardFreq: number
  spendingCeiling: number; payToWin: number; currencyObfuscation: number
  spendingPrompts: number; childTargeting: number; adPressure: number
  subscriptionPressure: number; socialSpending: number
  socialObligation: number; competitiveToxicity: number; strangerRisk: number
  socialComparison: number; identitySelfWorth: number; privacyRisk: number
  violenceLevel: number; sexualContent: number; language: number
  substanceRef: number; fearHorror: number
  estimatedMonthlyCostLow: number; estimatedMonthlyCostHigh: number
  minSessionMinutes: number; hasNaturalStoppingPoints: boolean
  penalizesBreaks: boolean; stoppingPointsDescription: string
  hasMicrotransactions: boolean; hasLootBoxes: boolean
  hasSubscription: boolean; hasBattlePass: boolean
  requiresInternet: 'always' | 'sometimes' | 'never'
  hasStrangerChat: boolean; chatModeration: 'none' | 'basic' | 'strong' | 'parental-controls'
  benefitsNarrative: string; risksNarrative: string; parentTip: string
}

type CostAccum = {
  inputTokens: number; outputTokens: number
  cacheWriteTokens: number; cacheReadTokens: number
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(g: GameRow): string {
  const desc = g.description
    ? g.description.slice(0, 400).replace(/\n+/g, ' ').trim()
    : 'No description available.'
  const platforms = (g.platforms as string[] ?? []).slice(0, 6).join(', ') || 'Unknown'
  const genres    = (g.genres   as string[] ?? []).join(', ') || 'Unknown'
  const year      = g.releaseDate ? new Date(g.releaseDate).getFullYear() : 'Unknown'

  return `Score this game for the PlaySmart rating system.

GAME: ${g.title}
Developer: ${g.developer ?? 'Unknown'}
Platforms: ${platforms}
Genres: ${genres}
ESRB: ${g.esrbRating ?? 'Not rated'}
Metacritic: ${g.metacriticScore ?? 'N/A'}
Released: ${year}
Store flags — hasMicrotransactions:${g.hasMicrotransactions}, hasLootBoxes:${g.hasLootBoxes}
Description: ${desc}

Return ONLY a valid JSON object — no markdown, no explanation.
Fill every numeric field accurately using the rubric. Benefit scores 0-5, risk scores 0-3.
Narratives: 2-3 sentences. parentTip: 1-2 actionable sentences for parents.

Schema (replace 0/false/"" with real values):
{"problemSolving":0,"spatialAwareness":0,"strategicThinking":0,"criticalThinking":0,"memoryAttention":0,"creativity":0,"readingLanguage":0,"mathSystems":0,"learningTransfer":0,"adaptiveChallenge":0,"teamwork":0,"communication":0,"empathy":0,"emotionalRegulation":0,"ethicalReasoning":0,"positiveSocial":0,"handEyeCoord":0,"fineMotor":0,"reactionTime":0,"physicalActivity":0,"variableRewards":0,"streakMechanics":0,"lossAversion":0,"fomoEvents":0,"stoppingBarriers":0,"notifications":0,"nearMiss":0,"infinitePlay":0,"escalatingCommitment":0,"variableRewardFreq":0,"spendingCeiling":0,"payToWin":0,"currencyObfuscation":0,"spendingPrompts":0,"childTargeting":0,"adPressure":0,"subscriptionPressure":0,"socialSpending":0,"socialObligation":0,"competitiveToxicity":0,"strangerRisk":0,"socialComparison":0,"identitySelfWorth":0,"privacyRisk":0,"violenceLevel":0,"sexualContent":0,"language":0,"substanceRef":0,"fearHorror":0,"estimatedMonthlyCostLow":0,"estimatedMonthlyCostHigh":0,"minSessionMinutes":20,"hasNaturalStoppingPoints":true,"penalizesBreaks":false,"stoppingPointsDescription":"","hasMicrotransactions":false,"hasLootBoxes":false,"hasSubscription":false,"hasBattlePass":false,"requiresInternet":"sometimes","hasStrangerChat":false,"chatModeration":"none","benefitsNarrative":"","risksNarrative":"","parentTip":""}`
}

// ─── Validation ───────────────────────────────────────────────────────────────

function clampInt(v: unknown, max: number): number {
  const n = typeof v === 'number' ? Math.round(v) : parseInt(String(v), 10)
  return isNaN(n) ? 0 : Math.max(0, Math.min(max, n))
}

function validate(raw: Record<string, unknown>): AiScores {
  const b   = (k: string) => clampInt(raw[k], 5)
  const r   = (k: string) => clampInt(raw[k], 3)
  const bl  = (k: string, d = false): boolean => typeof raw[k] === 'boolean' ? raw[k] as boolean : d
  const s   = (k: string): string => typeof raw[k] === 'string' ? (raw[k] as string).trim() : ''
  const num = (k: string, d = 0): number => typeof raw[k] === 'number' ? raw[k] as number : d
  const ri  = (['always', 'sometimes', 'never'] as const).includes(raw.requiresInternet as never)
    ? raw.requiresInternet as 'always' | 'sometimes' | 'never' : 'sometimes'
  const cm  = (['none', 'basic', 'strong', 'parental-controls'] as const).includes(raw.chatModeration as never)
    ? raw.chatModeration as 'none' | 'basic' | 'strong' | 'parental-controls' : 'none'

  return {
    problemSolving: b('problemSolving'), spatialAwareness: b('spatialAwareness'),
    strategicThinking: b('strategicThinking'), criticalThinking: b('criticalThinking'),
    memoryAttention: b('memoryAttention'), creativity: b('creativity'),
    readingLanguage: b('readingLanguage'), mathSystems: b('mathSystems'),
    learningTransfer: b('learningTransfer'), adaptiveChallenge: b('adaptiveChallenge'),
    teamwork: b('teamwork'), communication: b('communication'), empathy: b('empathy'),
    emotionalRegulation: b('emotionalRegulation'), ethicalReasoning: b('ethicalReasoning'),
    positiveSocial: b('positiveSocial'),
    handEyeCoord: b('handEyeCoord'), fineMotor: b('fineMotor'),
    reactionTime: b('reactionTime'), physicalActivity: b('physicalActivity'),
    variableRewards: r('variableRewards'), streakMechanics: r('streakMechanics'),
    lossAversion: r('lossAversion'), fomoEvents: r('fomoEvents'),
    stoppingBarriers: r('stoppingBarriers'), notifications: r('notifications'),
    nearMiss: r('nearMiss'), infinitePlay: r('infinitePlay'),
    escalatingCommitment: r('escalatingCommitment'), variableRewardFreq: r('variableRewardFreq'),
    spendingCeiling: r('spendingCeiling'), payToWin: r('payToWin'),
    currencyObfuscation: r('currencyObfuscation'), spendingPrompts: r('spendingPrompts'),
    childTargeting: r('childTargeting'), adPressure: r('adPressure'),
    subscriptionPressure: r('subscriptionPressure'), socialSpending: r('socialSpending'),
    socialObligation: r('socialObligation'), competitiveToxicity: r('competitiveToxicity'),
    strangerRisk: r('strangerRisk'), socialComparison: r('socialComparison'),
    identitySelfWorth: r('identitySelfWorth'), privacyRisk: r('privacyRisk'),
    violenceLevel: r('violenceLevel'), sexualContent: r('sexualContent'),
    language: r('language'), substanceRef: r('substanceRef'), fearHorror: r('fearHorror'),
    estimatedMonthlyCostLow:  num('estimatedMonthlyCostLow'),
    estimatedMonthlyCostHigh: num('estimatedMonthlyCostHigh'),
    minSessionMinutes:        clampInt(raw.minSessionMinutes, 480) || 20,
    hasNaturalStoppingPoints: bl('hasNaturalStoppingPoints', true),
    penalizesBreaks:          bl('penalizesBreaks'),
    stoppingPointsDescription: s('stoppingPointsDescription'),
    hasMicrotransactions: bl('hasMicrotransactions'),
    hasLootBoxes:         bl('hasLootBoxes'),
    hasSubscription:      bl('hasSubscription'),
    hasBattlePass:        bl('hasBattlePass'),
    requiresInternet: ri, hasStrangerChat: bl('hasStrangerChat'), chatModeration: cm,
    benefitsNarrative: s('benefitsNarrative'),
    risksNarrative:    s('risksNarrative'),
    parentTip:         s('parentTip'),
  }
}

// ─── Claude call ─────────────────────────────────────────────────────────────

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function scoreWithClaude(g: GameRow, cost: CostAccum): Promise<AiScores> {
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [{ type: 'text', text: RUBRIC, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: buildPrompt(g) }],
  })

  const u = resp.usage as Record<string, number>
  cost.inputTokens       += u.input_tokens                    ?? 0
  cost.outputTokens      += u.output_tokens                   ?? 0
  cost.cacheWriteTokens  += u.cache_creation_input_tokens     ?? 0
  cost.cacheReadTokens   += u.cache_read_input_tokens         ?? 0

  const text = resp.content
    .filter(b => b.type === 'text')
    .map(b => (b as Anthropic.TextBlock).text)
    .join('')

  // Strip markdown fences if model wraps in ```json
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(cleaned)
  } catch {
    // Try extracting first {...} block
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) throw new Error(`No JSON found in response: ${cleaned.slice(0, 100)}`)
    raw = JSON.parse(match[0])
  }

  return validate(raw)
}

// ─── DB write ─────────────────────────────────────────────────────────────────

async function persist(g: GameRow, s: AiScores): Promise<void> {
  // Update game-level flags AI determined
  await db.update(games).set({
    hasMicrotransactions: s.hasMicrotransactions,
    hasLootBoxes:         s.hasLootBoxes,
    hasSubscription:      s.hasSubscription,
    hasBattlePass:        s.hasBattlePass,
    requiresInternet:     s.requiresInternet,
    hasStrangerChat:      s.hasStrangerChat,
    chatModeration:       s.chatModeration,
    updatedAt:            new Date(),
  }).where(eq(games.id, g.id))

  // Upsert review
  const reviewData = {
    gameId: g.id, reviewTier: 'automated' as const, status: 'approved' as const,
    problemSolving: s.problemSolving, spatialAwareness: s.spatialAwareness,
    strategicThinking: s.strategicThinking, criticalThinking: s.criticalThinking,
    memoryAttention: s.memoryAttention, creativity: s.creativity,
    readingLanguage: s.readingLanguage, mathSystems: s.mathSystems,
    learningTransfer: s.learningTransfer, adaptiveChallenge: s.adaptiveChallenge,
    teamwork: s.teamwork, communication: s.communication, empathy: s.empathy,
    emotionalRegulation: s.emotionalRegulation, ethicalReasoning: s.ethicalReasoning,
    positiveSocial: s.positiveSocial,
    handEyeCoord: s.handEyeCoord, fineMotor: s.fineMotor,
    reactionTime: s.reactionTime, physicalActivity: s.physicalActivity,
    variableRewards: s.variableRewards, streakMechanics: s.streakMechanics,
    lossAversion: s.lossAversion, fomoEvents: s.fomoEvents,
    stoppingBarriers: s.stoppingBarriers, notifications: s.notifications,
    nearMiss: s.nearMiss, infinitePlay: s.infinitePlay,
    escalatingCommitment: s.escalatingCommitment, variableRewardFreq: s.variableRewardFreq,
    spendingCeiling: s.spendingCeiling, payToWin: s.payToWin,
    currencyObfuscation: s.currencyObfuscation, spendingPrompts: s.spendingPrompts,
    childTargeting: s.childTargeting, adPressure: s.adPressure,
    subscriptionPressure: s.subscriptionPressure, socialSpending: s.socialSpending,
    socialObligation: s.socialObligation, competitiveToxicity: s.competitiveToxicity,
    strangerRisk: s.strangerRisk, socialComparison: s.socialComparison,
    identitySelfWorth: s.identitySelfWorth, privacyRisk: s.privacyRisk,
    violenceLevel: s.violenceLevel, sexualContent: s.sexualContent,
    language: s.language, substanceRef: s.substanceRef, fearHorror: s.fearHorror,
    estimatedMonthlyCostLow:   s.estimatedMonthlyCostLow,
    estimatedMonthlyCostHigh:  s.estimatedMonthlyCostHigh,
    minSessionMinutes:         s.minSessionMinutes,
    hasNaturalStoppingPoints:  s.hasNaturalStoppingPoints,
    penalizesBreaks:           s.penalizesBreaks,
    stoppingPointsDescription: s.stoppingPointsDescription,
    benefitsNarrative: s.benefitsNarrative,
    risksNarrative:    s.risksNarrative,
    parentTip:         s.parentTip,
    approvedAt: new Date(), updatedAt: new Date(),
  }

  const [existingReview] = await db
    .select({ id: reviews.id })
    .from(reviews).where(eq(reviews.gameId, g.id)).limit(1)

  let reviewId: number
  if (existingReview) {
    await db.update(reviews).set(reviewData).where(eq(reviews.id, existingReview.id))
    reviewId = existingReview.id
  } else {
    const [ins] = await db.insert(reviews).values(reviewData).returning({ id: reviews.id })
    reviewId = ins.id
  }

  // Calculate + upsert game_scores
  const computed  = calculateGameScores(s)
  const scoreData = {
    gameId: g.id, reviewId,
    cognitiveScore:       computed.cognitiveScore,
    socialEmotionalScore: computed.socialEmotionalScore,
    motorScore:           computed.motorScore,
    bds:                  computed.bds,
    dopamineRisk:         computed.dopamineRisk,
    monetizationRisk:     computed.monetizationRisk,
    socialRisk:           computed.socialRisk,
    contentRisk:          computed.contentRisk,
    ris:                  computed.ris,
    timeRecommendationMinutes:   computed.timeRecommendation.minutes,
    timeRecommendationLabel:     computed.timeRecommendation.label,
    timeRecommendationReasoning: computed.timeRecommendation.reasoning,
    timeRecommendationColor:     computed.timeRecommendation.color,
    topBenefits:  computed.topBenefits,
    calculatedAt: new Date(),
  }

  const [existingScore] = await db
    .select({ id: gameScores.id })
    .from(gameScores).where(eq(gameScores.gameId, g.id)).limit(1)

  if (existingScore) {
    await db.update(gameScores).set(scoreData).where(eq(gameScores.id, existingScore.id))
  } else {
    await db.insert(gameScores).values(scoreData)
  }
}

// ─── Worker pool ──────────────────────────────────────────────────────────────

async function pool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, i: number) => Promise<void>,
) {
  let idx = 0
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (idx < items.length) {
        const i = idx++
        await fn(items[i], i)
      }
    })
  )
}

// ─── Cost helper ──────────────────────────────────────────────────────────────

function calcCost(c: CostAccum): number {
  return (
    c.inputTokens      * PRICE.inputPerMTok      / 1e6 +
    c.outputTokens     * PRICE.outputPerMTok     / 1e6 +
    c.cacheWriteTokens * PRICE.cacheWritePerMTok / 1e6 +
    c.cacheReadTokens  * PRICE.cacheReadPerMTok  / 1e6
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('\nERROR: ANTHROPIC_API_KEY is not set in .env\n')
    process.exit(1)
  }

  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║   PlaySmart — AI Game Scorer  (Sonnet 4.6)       ║')
  console.log('║   Rubric cached as system prompt (saves ~60%)    ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  // Games without scores yet
  const unscored = await db
    .select({
      id: games.id, slug: games.slug, title: games.title,
      developer: games.developer, publisher: games.publisher,
      releaseDate: games.releaseDate, genres: games.genres, platforms: games.platforms,
      esrbRating: games.esrbRating, metacriticScore: games.metacriticScore,
      description: games.description,
      hasMicrotransactions: games.hasMicrotransactions,
      hasLootBoxes: games.hasLootBoxes, hasSubscription: games.hasSubscription,
      hasBattlePass: games.hasBattlePass, requiresInternet: games.requiresInternet,
      hasStrangerChat: games.hasStrangerChat, chatModeration: games.chatModeration,
    })
    .from(games)
    .leftJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(isNull(gameScores.id))

  const total = unscored.length
  if (total === 0) {
    console.log('  All games already scored. Nothing to do.\n')
    process.exit(0)
  }

  console.log(`  ${total} games to score  |  ${CONCURRENCY} concurrent  |  ~$${(total * 0.014).toFixed(0)} estimated\n`)

  const cost: CostAccum = { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 }
  let done = 0, errors = 0
  const startMs = Date.now()

  await pool(unscored, CONCURRENCY, async (game, i) => {
    const n     = String(i + 1).padStart(3)
    const label = game.title.length > 42 ? game.title.slice(0, 41) + '…' : game.title.padEnd(42)
    process.stdout.write(`  [${n}/${total}] ${label}  `)

    try {
      const scores = await scoreWithClaude(game, cost)
      await persist(game, scores)
      done++
      const secs = Math.round((Date.now() - startMs) / 1000)
      const m = Math.floor(secs / 60), s = secs % 60
      console.log(`✓  $${calcCost(cost).toFixed(2)}  ${m}m${s}s`)
    } catch (err) {
      errors++
      console.error(`✗  ${(err as Error).message.slice(0, 70)}`)
    }
  })

  const elapsed = Math.round((Date.now() - startMs) / 1000)
  const m = Math.floor(elapsed / 60), s = elapsed % 60
  const finalCost = calcCost(cost)

  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║                 Scoring complete                 ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log(`  Scored   : ${done}/${total}`)
  console.log(`  Errors   : ${errors}`)
  console.log(`  Duration : ${m}m ${s}s`)
  console.log(`  Cost     : $${finalCost.toFixed(4)}`)
  console.log(`  Tokens   : ${(cost.inputTokens / 1000).toFixed(0)}k in  ${(cost.outputTokens / 1000).toFixed(0)}k out  ${(cost.cacheReadTokens / 1000).toFixed(0)}k cache-read`)
  console.log()

  process.exit(errors > 0 ? 1 : 0)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
