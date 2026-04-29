/**
 * Seed manual entries for legacy classic games not indexed by RAWG/IGDB.
 * These are culturally important reference points in the LumiKin rubric.
 *
 * Each game has two entries — classic (Windows 95–7, offline, no ads) and
 * modern (Windows 10/11 Store app, ad-supported free tier + Premium Pass).
 * The split reflects how we treat other franchise iterations separately.
 *
 * Run with:
 *   node --env-file=.env.local node_modules/tsx/dist/cli.cjs scripts/seed-legacy-classics.ts
 */

import { eq } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { games, reviews, gameScores } from '../src/lib/db/schema'
import { calculateGameScores } from '../src/lib/scoring/engine'
import type { ReviewInput } from '../src/lib/scoring/types'

type GameSeed = {
  slug:                  string
  title:                 string
  developer?:            string
  publisher?:            string
  genres?:               string[]
  platforms?:            string[]
  esrbRating?:           string | null
  pegiRating?:           number | null
  basePrice?:            number | null
  hasMicrotransactions?: boolean
  hasLootBoxes?:         boolean
  hasSubscription?:      boolean
  hasBattlePass?:        boolean
  requiresInternet?:     string
  hasStrangerChat?:      boolean
  chatModeration?:       string
  metacriticScore?:      number | null
  backgroundImage?:      string | null
  description?:          string | null
}

type ReviewSeed = ReviewInput & {
  estimatedMonthlyCostLow?:   number | null
  estimatedMonthlyCostHigh?:  number | null
  minSessionMinutes?:         number | null
  hasNaturalStoppingPoints?:  boolean
  penalizesBreaks?:           boolean
  stoppingPointsDescription?: string
  benefitsNarrative?:         string
  risksNarrative?:            string
  parentTip?:                 string
}

type GameReviewSeed = { game: GameSeed; review: ReviewSeed }

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEEDS: GameReviewSeed[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. SOLITAIRE (CLASSIC)
  //   Windows 3.1 → Windows 7 built-in version. Offline, no ads, no accounts.
  //   The version most parents remember. Pure card game.
  //
  //   B1=23  B2=3  B3=3  |  R1=10  R2=0  R3=0
  // ═══════════════════════════════════════════════════════════════════════════
  {
    game: {
      slug:                  'solitaire-classic',
      title:                 'Solitaire (Classic)',
      developer:             'Microsoft',
      publisher:             'Microsoft',
      genres:                ['Card', 'Puzzle', 'Casual'],
      platforms:             ['PC'],
      esrbRating:            'E',
      pegiRating:            3,
      basePrice:             0,
      hasMicrotransactions:  false,
      hasLootBoxes:          false,
      hasSubscription:       false,
      hasBattlePass:         false,
      requiresInternet:      'never',
      hasStrangerChat:       false,
      chatModeration:        'none',
      metacriticScore:       null,
      description:           'The original Klondike Solitaire bundled with Windows 3.1 through Windows 7. Fully offline, no accounts, no ads — just the card game. One of the most-played games in history.',
    },
    review: {
      esrbRating: 'E',
      // B1 Cognitive (sum=23)
      problemSolving: 4, spatialAwareness: 3, strategicThinking: 4, criticalThinking: 4,
      memoryAttention: 3, creativity: 0, readingLanguage: 0, mathSystems: 2,
      learningTransfer: 2, adaptiveChallenge: 1,
      // B2 Social-emotional (sum=3)
      teamwork: 0, communication: 0, empathy: 0, emotionalRegulation: 3,
      ethicalReasoning: 0, positiveSocial: 0,
      // B3 Motor (sum=3)
      handEyeCoord: 2, fineMotor: 1, reactionTime: 0, physicalActivity: 0,
      // R1 Dopamine (sum=10) — near-miss is real, but no external hooks
      variableRewards: 2, streakMechanics: 0, lossAversion: 1, fomoEvents: 0,
      stoppingBarriers: 1, notifications: 0, nearMiss: 3, infinitePlay: 2,
      escalatingCommitment: 0, variableRewardFreq: 1,
      // R2 Monetisation (sum=0) — completely free, no IAP, no subscription
      spendingCeiling: 0, payToWin: 0, currencyObfuscation: 0, spendingPrompts: 0,
      childTargeting: 0, adPressure: 0, subscriptionPressure: 0, socialSpending: 0,
      // R3 Social (sum=0) — fully offline
      socialObligation: 0, competitiveToxicity: 0, strangerRisk: 0, socialComparison: 0,
      identitySelfWorth: 0, privacyRisk: 0,
      // R4 Content — completely clean
      violenceLevel: 0, sexualContent: 0, language: 0, substanceRef: 0, fearHorror: 0,
      // Practical
      estimatedMonthlyCostLow: 0, estimatedMonthlyCostHigh: 0,
      minSessionMinutes: 5, hasNaturalStoppingPoints: true, penalizesBreaks: false,
      stoppingPointsDescription: 'Each game ends in a clear win or loss, typically in 5–15 minutes. Close the window any time — no progress is lost because there is no persistent progress.',
      benefitsNarrative: 'The original Solitaire is a deceptively rich cognitive exercise. Klondike requires planning several moves ahead, weighing probabilities with hidden cards, and making decisions under uncertainty. The patience demanded to work through a difficult hand — and to accept an unwinnable position gracefully — builds genuine attention regulation. It was originally bundled with Windows to teach users how to use a mouse; it ended up being one of the most-played games in computing history.',
      risksNarrative: 'Almost none. The near-miss effect is real — you frequently get to within one or two cards of winning, which drives replays — but this is a mild and natural game mechanic, not an engineered engagement loop. There are no ads, no accounts, no notifications, no monetization of any kind. The only concern is open-ended play with no built-in stopping cue.',
      parentTip: 'No concerns. Let them play. Set a household screen time boundary if needed — the game itself won\'t stop them — but this is one of the cleanest games you can find.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. MICROSOFT SOLITAIRE COLLECTION (MODERN)
  //   Windows 10/11 Store app + iOS/Android. Free with ads, Premium Pass $2.99/month.
  //   Adds Spider, FreeCell, Pyramid, TriPeaks, daily challenges, streaks.
  //
  //   B1=23  B2=3  B3=3  |  R1=13  R2=7  R3=1
  // ═══════════════════════════════════════════════════════════════════════════
  {
    game: {
      slug:                  'microsoft-solitaire-collection',
      title:                 'Microsoft Solitaire Collection',
      developer:             'Microsoft',
      publisher:             'Microsoft',
      genres:                ['Card', 'Puzzle', 'Casual'],
      platforms:             ['PC', 'iOS', 'Android'],
      esrbRating:            'E',
      pegiRating:            3,
      basePrice:             0,
      hasMicrotransactions:  false,
      hasLootBoxes:          false,
      hasSubscription:       true,
      hasBattlePass:         false,
      requiresInternet:      'sometimes',
      hasStrangerChat:       false,
      chatModeration:        'none',
      metacriticScore:       null,
      description:           'The modern successor to classic Solitaire, bundled with Windows 10/11. Includes Klondike, Spider, FreeCell, Pyramid, and TriPeaks. Free with ads; Premium Pass removes them.',
    },
    review: {
      esrbRating: 'E',
      // B1 Cognitive (sum=23) — same core game, same cognitive value
      problemSolving: 4, spatialAwareness: 3, strategicThinking: 4, criticalThinking: 4,
      memoryAttention: 3, creativity: 0, readingLanguage: 0, mathSystems: 2,
      learningTransfer: 2, adaptiveChallenge: 1,
      // B2 Social-emotional (sum=3)
      teamwork: 0, communication: 0, empathy: 0, emotionalRegulation: 3,
      ethicalReasoning: 0, positiveSocial: 0,
      // B3 Motor (sum=3)
      handEyeCoord: 2, fineMotor: 1, reactionTime: 0, physicalActivity: 0,
      // R1 Dopamine (sum=13) — added streaks, daily challenges, and FOMO vs classic
      variableRewards: 2, streakMechanics: 1, lossAversion: 1, fomoEvents: 1,
      stoppingBarriers: 2, notifications: 0, nearMiss: 3, infinitePlay: 2,
      escalatingCommitment: 0, variableRewardFreq: 1,
      // R2 Monetisation (sum=7) — full-screen interstitial ads between games on free tier
      spendingCeiling: 1, payToWin: 0, currencyObfuscation: 0, spendingPrompts: 2,
      childTargeting: 0, adPressure: 2, subscriptionPressure: 2, socialSpending: 0,
      // R3 Social (sum=1) — online account; minimal data exposure
      socialObligation: 0, competitiveToxicity: 0, strangerRisk: 0, socialComparison: 0,
      identitySelfWorth: 0, privacyRisk: 1,
      // R4 Content — completely clean
      violenceLevel: 0, sexualContent: 0, language: 0, substanceRef: 0, fearHorror: 0,
      // Practical
      estimatedMonthlyCostLow: 0, estimatedMonthlyCostHigh: 3,
      minSessionMinutes: 5, hasNaturalStoppingPoints: true, penalizesBreaks: false,
      stoppingPointsDescription: 'Each game ends clearly in 5–15 minutes. Daily challenges expire at midnight, which creates mild daily pull. No penalty for breaks.',
      benefitsNarrative: 'The same strong cognitive game as the original, now with five variants. FreeCell is the standout addition — almost every deal is solvable with correct play, making it a genuine logic puzzle rather than a luck-dependent card game. Spider and Pyramid add new strategic dimensions. Daily challenges provide a structured goal that can help children develop consistent habits.',
      risksNarrative: 'The free tier shows full-screen interstitial ads between games — a jarring interruption that feels particularly out of place in a Microsoft-branded product. Daily challenges and streak tracking add mild FOMO pressure absent from the classic version. The Premium Pass subscription ($2.99/month) removes all ads; Microsoft promotes it regularly on the free tier. The core game remains excellent; the business model is the only knock.',
      parentTip: 'The $2.99/month Premium Pass is worth it for regular players — one month\'s cost of a coffee removes all ads permanently. If you\'re not subscribing, at least use it offline where ads don\'t appear. FreeCell is the best mode for cognitive development: almost every deal is winnable with correct play.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. MINESWEEPER (CLASSIC)
  //   Windows 95 → Windows 7 built-in. Offline, no ads, three difficulty levels.
  //   Pure logical deduction — one of the cleanest games ever made.
  //
  //   B1=32  B2=2  B3=3  |  R1=9  R2=0  R3=0
  // ═══════════════════════════════════════════════════════════════════════════
  {
    game: {
      slug:                  'minesweeper-classic',
      title:                 'Minesweeper (Classic)',
      developer:             'Microsoft',
      publisher:             'Microsoft',
      genres:                ['Puzzle', 'Logic', 'Casual'],
      platforms:             ['PC'],
      esrbRating:            'E',
      pegiRating:            3,
      basePrice:             0,
      hasMicrotransactions:  false,
      hasLootBoxes:          false,
      hasSubscription:       false,
      hasBattlePass:         false,
      requiresInternet:      'never',
      hasStrangerChat:       false,
      chatModeration:        'none',
      metacriticScore:       null,
      description:           'The original Minesweeper bundled with Windows 95 through Windows 7. Offline, no accounts, three difficulty levels (Beginner/Intermediate/Expert) plus custom. A pure logic puzzle.',
    },
    review: {
      esrbRating: 'E',
      // B1 Cognitive (sum=32) — one of the highest pure-logic scores in our entire dataset
      problemSolving: 5, spatialAwareness: 5, strategicThinking: 4, criticalThinking: 5,
      memoryAttention: 3, creativity: 0, readingLanguage: 0, mathSystems: 3,
      learningTransfer: 4, adaptiveChallenge: 3,
      // B2 Social-emotional (sum=2)
      teamwork: 0, communication: 0, empathy: 0, emotionalRegulation: 2,
      ethicalReasoning: 0, positiveSocial: 0,
      // B3 Motor (sum=3)
      handEyeCoord: 1, fineMotor: 2, reactionTime: 0, physicalActivity: 0,
      // R1 Dopamine (sum=9) — near-miss, but no external hooks whatsoever
      variableRewards: 2, streakMechanics: 0, lossAversion: 2, fomoEvents: 0,
      stoppingBarriers: 0, notifications: 0, nearMiss: 3, infinitePlay: 1,
      escalatingCommitment: 0, variableRewardFreq: 1,
      // R2 Monetisation (sum=0)
      spendingCeiling: 0, payToWin: 0, currencyObfuscation: 0, spendingPrompts: 0,
      childTargeting: 0, adPressure: 0, subscriptionPressure: 0, socialSpending: 0,
      // R3 Social (sum=0) — fully offline
      socialObligation: 0, competitiveToxicity: 0, strangerRisk: 0, socialComparison: 0,
      identitySelfWorth: 0, privacyRisk: 0,
      // R4 Content — completely clean
      violenceLevel: 0, sexualContent: 0, language: 0, substanceRef: 0, fearHorror: 0,
      // Practical
      estimatedMonthlyCostLow: 0, estimatedMonthlyCostHigh: 0,
      minSessionMinutes: 1, hasNaturalStoppingPoints: true, penalizesBreaks: false,
      stoppingPointsDescription: 'Every game has a definite endpoint. Beginner boards take 1–3 minutes; Expert boards 5–20 minutes. Close the window any time.',
      benefitsNarrative: 'Classic Minesweeper is one of the purest logic trainers ever built into a mainstream product. Every move is an exercise in constraint satisfaction: using numerical clues to eliminate possibilities, identify forced safe cells, and when necessary make calculated probabilistic guesses. Expert-level play requires holding a complex deduction problem in working memory simultaneously across a large grid. The three built-in difficulty levels provide a genuine progression ladder from trivial to seriously challenging.',
      risksNarrative: 'Essentially none. The near-miss of hitting a mine one cell from winning is genuinely frustrating, but this is an honest outcome of the game mechanics — not an engineered hook. There are no ads, no accounts, no notifications, no spending, no social features. The only honest concern is that some Expert-level boards contain unavoidable guesses where no amount of logical deduction yields the correct answer — worth explaining to children so they don\'t blame themselves.',
      parentTip: 'Start on Beginner. Move to Intermediate when they\'re winning consistently. Expert is a serious challenge that most adults fail regularly — it\'s appropriate to frame it as a long-term skill goal rather than an immediate expectation. One of the most recommendable games in existence.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. MICROSOFT MINESWEEPER (MODERN)
  //   Windows 10/11 Store app + iOS/Android. Free with ads, online leaderboards,
  //   Adventure mode, daily challenges. Premium Pass shared with Solitaire.
  //
  //   B1=32  B2=2  B3=3  |  R1=12  R2=6  R3=1
  // ═══════════════════════════════════════════════════════════════════════════
  {
    game: {
      slug:                  'microsoft-minesweeper',
      title:                 'Microsoft Minesweeper',
      developer:             'Microsoft',
      publisher:             'Microsoft',
      genres:                ['Puzzle', 'Logic', 'Casual'],
      platforms:             ['PC', 'iOS', 'Android'],
      esrbRating:            'E',
      pegiRating:            3,
      basePrice:             0,
      hasMicrotransactions:  false,
      hasLootBoxes:          false,
      hasSubscription:       true,
      hasBattlePass:         false,
      requiresInternet:      'sometimes',
      hasStrangerChat:       false,
      chatModeration:        'none',
      metacriticScore:       null,
      description:           'The modern Windows 10/11 successor to classic Minesweeper. Adds Adventure mode, daily challenges, online leaderboards, and a free-with-ads model. Premium Pass removes ads.',
    },
    review: {
      esrbRating: 'E',
      // B1 Cognitive (sum=32) — same core game
      problemSolving: 5, spatialAwareness: 5, strategicThinking: 4, criticalThinking: 5,
      memoryAttention: 3, creativity: 0, readingLanguage: 0, mathSystems: 3,
      learningTransfer: 4, adaptiveChallenge: 3,
      // B2 Social-emotional (sum=2)
      teamwork: 0, communication: 0, empathy: 0, emotionalRegulation: 2,
      ethicalReasoning: 0, positiveSocial: 0,
      // B3 Motor (sum=3)
      handEyeCoord: 1, fineMotor: 2, reactionTime: 0, physicalActivity: 0,
      // R1 Dopamine (sum=12) — daily challenges + leaderboards add FOMO and comparison
      variableRewards: 2, streakMechanics: 0, lossAversion: 2, fomoEvents: 0,
      stoppingBarriers: 1, notifications: 0, nearMiss: 3, infinitePlay: 2,
      escalatingCommitment: 1, variableRewardFreq: 1,
      // R2 Monetisation (sum=6) — same ad model as Solitaire Collection
      spendingCeiling: 1, payToWin: 0, currencyObfuscation: 0, spendingPrompts: 2,
      childTargeting: 0, adPressure: 2, subscriptionPressure: 1, socialSpending: 0,
      // R3 Social (sum=1) — online leaderboards; low but non-zero privacy exposure
      socialObligation: 0, competitiveToxicity: 0, strangerRisk: 0, socialComparison: 0,
      identitySelfWorth: 0, privacyRisk: 1,
      // R4 Content — completely clean
      violenceLevel: 0, sexualContent: 0, language: 0, substanceRef: 0, fearHorror: 0,
      // Practical
      estimatedMonthlyCostLow: 0, estimatedMonthlyCostHigh: 3,
      minSessionMinutes: 1, hasNaturalStoppingPoints: true, penalizesBreaks: false,
      stoppingPointsDescription: 'Each board ends definitively. Daily challenges expire at midnight. Adventure mode has discrete levels with clear endpoints.',
      benefitsNarrative: 'The same world-class logic puzzle as the original, now with Adventure mode adding themed boards and progressive difficulty. Daily challenges provide a structured goal. Online leaderboards let competitive players benchmark their speed against others. The core cognitive value — constraint satisfaction, probabilistic reasoning, working memory load — is identical to the classic version.',
      risksNarrative: 'The free tier shows interstitial ads between games. The addition of online leaderboards introduces mild social comparison (time rankings) that the classic version lacked. Daily challenges expire at midnight, adding a small FOMO element. These are minor additions to an otherwise clean game — the gap between classic and modern Minesweeper is significantly smaller than for many other game franchises.',
      parentTip: 'If ads bother your child, the Premium Pass ($2.99/month, shared with Solitaire Collection) removes them. Otherwise the modern version is essentially the same excellent game as the classic. The Adventure mode is a good starting point for younger children who find the blank grid intimidating.',
    },
  },

]

// ─── Helpers (copied from seed-reviews.ts) ───────────────────────────────────

async function upsertGameRecord(g: GameSeed): Promise<number> {
  const [existing] = await db
    .select({ id: games.id })
    .from(games)
    .where(eq(games.slug, g.slug))
    .limit(1)

  if (existing) {
    await db.update(games).set({
      esrbRating:           g.esrbRating ?? undefined,
      hasMicrotransactions: g.hasMicrotransactions,
      hasLootBoxes:         g.hasLootBoxes,
      hasSubscription:      g.hasSubscription,
      hasBattlePass:        g.hasBattlePass,
      requiresInternet:     g.requiresInternet,
      hasStrangerChat:      g.hasStrangerChat,
      chatModeration:       g.chatModeration,
      updatedAt:            new Date(),
    }).where(eq(games.id, existing.id))
    return existing.id
  }

  const [inserted] = await db.insert(games).values({
    slug:                 g.slug,
    title:                g.title,
    description:          g.description ?? null,
    developer:            g.developer ?? null,
    publisher:            g.publisher ?? null,
    genres:               g.genres ?? [],
    platforms:            g.platforms ?? [],
    esrbRating:           g.esrbRating ?? null,
    pegiRating:           g.pegiRating ?? null,
    basePrice:            g.basePrice ?? null,
    hasMicrotransactions: g.hasMicrotransactions ?? false,
    hasLootBoxes:         g.hasLootBoxes ?? false,
    hasSubscription:      g.hasSubscription ?? false,
    hasBattlePass:        g.hasBattlePass ?? false,
    requiresInternet:     g.requiresInternet ?? null,
    hasStrangerChat:      g.hasStrangerChat ?? false,
    chatModeration:       g.chatModeration ?? null,
    metacriticScore:      g.metacriticScore ?? null,
    backgroundImage:      g.backgroundImage ?? null,
    createdAt:            new Date(),
    updatedAt:            new Date(),
  }).returning({ id: games.id })

  return inserted.id
}

async function upsertReview(gameId: number, r: ReviewSeed): Promise<number> {
  const reviewData = {
    gameId,
    reviewTier: 'expert' as const,
    status:     'approved',
    problemSolving:       r.problemSolving       ?? null,
    spatialAwareness:     r.spatialAwareness     ?? null,
    strategicThinking:    r.strategicThinking    ?? null,
    criticalThinking:     r.criticalThinking     ?? null,
    memoryAttention:      r.memoryAttention      ?? null,
    creativity:           r.creativity           ?? null,
    readingLanguage:      r.readingLanguage      ?? null,
    mathSystems:          r.mathSystems          ?? null,
    learningTransfer:     r.learningTransfer     ?? null,
    adaptiveChallenge:    r.adaptiveChallenge    ?? null,
    teamwork:             r.teamwork             ?? null,
    communication:        r.communication        ?? null,
    empathy:              r.empathy              ?? null,
    emotionalRegulation:  r.emotionalRegulation  ?? null,
    ethicalReasoning:     r.ethicalReasoning     ?? null,
    positiveSocial:       r.positiveSocial       ?? null,
    handEyeCoord:         r.handEyeCoord         ?? null,
    fineMotor:            r.fineMotor            ?? null,
    reactionTime:         r.reactionTime         ?? null,
    physicalActivity:     r.physicalActivity     ?? null,
    variableRewards:      r.variableRewards      ?? null,
    streakMechanics:      r.streakMechanics      ?? null,
    lossAversion:         r.lossAversion         ?? null,
    fomoEvents:           r.fomoEvents           ?? null,
    stoppingBarriers:     r.stoppingBarriers     ?? null,
    notifications:        r.notifications        ?? null,
    nearMiss:             r.nearMiss             ?? null,
    infinitePlay:         r.infinitePlay         ?? null,
    escalatingCommitment: r.escalatingCommitment ?? null,
    variableRewardFreq:   r.variableRewardFreq   ?? null,
    spendingCeiling:      r.spendingCeiling      ?? null,
    payToWin:             r.payToWin             ?? null,
    currencyObfuscation:  r.currencyObfuscation  ?? null,
    spendingPrompts:      r.spendingPrompts      ?? null,
    childTargeting:       r.childTargeting       ?? null,
    adPressure:           r.adPressure           ?? null,
    subscriptionPressure: r.subscriptionPressure ?? null,
    socialSpending:       r.socialSpending       ?? null,
    socialObligation:     r.socialObligation     ?? null,
    competitiveToxicity:  r.competitiveToxicity  ?? null,
    strangerRisk:         r.strangerRisk         ?? null,
    socialComparison:     r.socialComparison     ?? null,
    identitySelfWorth:    r.identitySelfWorth    ?? null,
    privacyRisk:          r.privacyRisk          ?? null,
    violenceLevel:        r.violenceLevel        ?? null,
    sexualContent:        r.sexualContent        ?? null,
    language:             r.language             ?? null,
    substanceRef:         r.substanceRef         ?? null,
    fearHorror:           r.fearHorror           ?? null,
    estimatedMonthlyCostLow:   r.estimatedMonthlyCostLow  ?? null,
    estimatedMonthlyCostHigh:  r.estimatedMonthlyCostHigh ?? null,
    minSessionMinutes:         r.minSessionMinutes        ?? null,
    hasNaturalStoppingPoints:  r.hasNaturalStoppingPoints ?? null,
    penalizesBreaks:           r.penalizesBreaks          ?? null,
    stoppingPointsDescription: r.stoppingPointsDescription ?? null,
    benefitsNarrative: r.benefitsNarrative ?? null,
    risksNarrative:    r.risksNarrative    ?? null,
    parentTip:         r.parentTip         ?? null,
    approvedAt:        new Date(),
    updatedAt:         new Date(),
  }

  const [existing] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(eq(reviews.gameId, gameId))
    .limit(1)

  if (existing) {
    await db.update(reviews).set(reviewData).where(eq(reviews.id, existing.id))
    return existing.id
  }

  const [inserted] = await db.insert(reviews).values(reviewData).returning({ id: reviews.id })
  return inserted.id
}

async function upsertGameScores(gameId: number, reviewId: number, r: ReviewInput) {
  const computed = calculateGameScores(r)

  const scoreData = {
    gameId,
    reviewId,
    cognitiveScore:              computed.cognitiveScore,
    socialEmotionalScore:        computed.socialEmotionalScore,
    motorScore:                  computed.motorScore,
    bds:                         computed.bds,
    dopamineRisk:                computed.dopamineRisk,
    monetizationRisk:            computed.monetizationRisk,
    socialRisk:                  computed.socialRisk,
    contentRisk:                 computed.contentRisk,
    ris:                         computed.ris,
    timeRecommendationMinutes:   computed.timeRecommendation.minutes,
    timeRecommendationLabel:     computed.timeRecommendation.label,
    timeRecommendationReasoning: computed.timeRecommendation.reasoning,
    timeRecommendationColor:     computed.timeRecommendation.color,
    topBenefits:                 computed.topBenefits,
    calculatedAt:                new Date(),
  }

  const [existing] = await db
    .select({ id: gameScores.id })
    .from(gameScores)
    .where(eq(gameScores.gameId, gameId))
    .limit(1)

  if (existing) {
    await db.update(gameScores).set(scoreData).where(eq(gameScores.id, existing.id))
  } else {
    await db.insert(gameScores).values(scoreData)
  }

  return computed
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('LumiKin seed-legacy-classics — 4 entries (classic + modern for each)\n')

  for (const seed of SEEDS) {
    process.stdout.write(`  ${seed.game.title.padEnd(50)} `)

    const gameId   = await upsertGameRecord(seed.game)
    const reviewId = await upsertReview(gameId, seed.review)
    const computed = await upsertGameScores(gameId, reviewId, seed.review)

    const bds  = Math.round(computed.bds * 100)
    const ris  = Math.round(computed.ris * 100)
    const mins = computed.timeRecommendation.minutes
    const col  = computed.timeRecommendation.color

    console.log(`BDS ${String(bds).padStart(3)}  RIS ${String(ris).padStart(3)}  ${String(mins).padStart(3)} min  [${col}]`)
  }

  console.log(`\n✓ Done`)
  process.exit(0)
}

main().catch(err => {
  console.error('\n✗ Seed failed:', err)
  process.exit(1)
})
