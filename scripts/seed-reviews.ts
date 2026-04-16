/**
 * Seed expert reviews for the 20 highest-priority games.
 *
 * For worked examples from RUBRIC.md (Zelda TotK, Genshin Impact, Minecraft vanilla),
 * scores are taken directly from the rubric.  All others are scored following the
 * same rubric methodology.
 *
 * Run with:
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/seed-reviews.ts
 */

import { eq } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { games, reviews, gameScores } from '../src/lib/db/schema'
import { calculateGameScores } from '../src/lib/scoring/engine'
import type { ReviewInput } from '../src/lib/scoring/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type GameSeed = {
  // DB metadata (only needed for games not already in the DB)
  slug:         string
  title:        string
  developer?:   string
  publisher?:   string
  genres?:      string[]
  platforms?:   string[]
  esrbRating?:  string | null
  pegiRating?:  number | null
  basePrice?:   number | null
  hasMicrotransactions?: boolean
  hasLootBoxes?: boolean
  hasSubscription?: boolean
  hasBattlePass?: boolean
  requiresInternet?: string
  hasStrangerChat?: boolean
  chatModeration?: string
  metacriticScore?: number | null
  backgroundImage?: string | null
  description?: string | null
}

type ReviewSeed = ReviewInput & {
  // Practical info
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
  // 1. MINECRAFT (vanilla — Java/Bedrock without marketplace)
  //    Source: RUBRIC.md worked example, Example 3
  //    B1=38  B2=16  B3=6  |  R1=4  R2=2  R3=4
  //    BDS=0.60  RIS=0.14  →  120 min
  // ═══════════════════════════════════════════════════════════════════════════
  {
    game: {
      slug: 'minecraft',
      title: 'Minecraft',
      developer: 'Mojang Studios',
      publisher: 'Microsoft',
      genres: ['Sandbox', 'Survival', 'Creative'],
      platforms: ['PC', 'Switch', 'PlayStation', 'Xbox', 'iOS', 'Android'],
      esrbRating: 'E10+',
      pegiRating: 7,
      basePrice: 29.99,
      hasMicrotransactions: false,
      hasLootBoxes: false,
      hasSubscription: false,
      hasBattlePass: false,
      requiresInternet: 'sometimes',
      hasStrangerChat: true,
      chatModeration: 'parental-controls',
      metacriticScore: 93,
      description: 'A sandbox game about placing blocks and going on adventures. Explore randomly generated worlds and build anything from simple homes to grand castles.',
    },
    review: {
      esrbRating: 'E10+',
      // B1 Cognitive (sum=38)
      problemSolving: 4, spatialAwareness: 5, strategicThinking: 3, criticalThinking: 3,
      memoryAttention: 3, creativity: 5, readingLanguage: 2, mathSystems: 4,
      learningTransfer: 4, adaptiveChallenge: 5,
      // B2 Social-emotional (sum=16)
      teamwork: 3, communication: 3, empathy: 1, emotionalRegulation: 3,
      ethicalReasoning: 2, positiveSocial: 4,
      // B3 Motor (sum=6)
      handEyeCoord: 2, fineMotor: 2, reactionTime: 2, physicalActivity: 0,
      // R1 Dopamine (sum=4)
      variableRewards: 0, streakMechanics: 0, lossAversion: 0, fomoEvents: 0,
      stoppingBarriers: 1, notifications: 0, nearMiss: 0, infinitePlay: 2,
      escalatingCommitment: 1, variableRewardFreq: 0,
      // R2 Monetisation (sum=2)
      spendingCeiling: 1, payToWin: 0, currencyObfuscation: 0, spendingPrompts: 0,
      childTargeting: 0, adPressure: 0, subscriptionPressure: 1, socialSpending: 0,
      // R3 Social (sum=4)
      socialObligation: 0, competitiveToxicity: 1, strangerRisk: 2, socialComparison: 0,
      identitySelfWorth: 0, privacyRisk: 1,
      // R4 Content
      violenceLevel: 1, sexualContent: 0, language: 0, substanceRef: 0, fearHorror: 1,
      // Practical
      estimatedMonthlyCostLow: 0, estimatedMonthlyCostHigh: 3,
      minSessionMinutes: 15, hasNaturalStoppingPoints: true, penalizesBreaks: false,
      stoppingPointsDescription: 'Save and quit any time. World saves instantly. No penalty for short or long gaps.',
      benefitsNarrative: 'Minecraft is one of the most educationally rich games available. Creative mode develops spatial reasoning and architectural thinking. Survival mode teaches resource management, planning, and iterative problem-solving. Children frequently report that Minecraft taught them to think in 3D space, and research confirms links to improved spatial reasoning scores.',
      risksNarrative: 'The base game has minimal manipulation design — no streaks, no FOMO, no variable reward loops. The main risk is open-ended infinite play with no built-in stopping cues. On multiplayer servers, stranger chat is possible and moderation varies by server. Parental controls can restrict online play.',
      parentTip: 'Use the Education Edition for structured learning, or keep it in single-player or friend-only mode. Set household screen time rules rather than relying on the game to stop — Minecraft won\'t stop for you.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. FORTNITE
  //    B1=19  B2=10  B3=13  |  R1=18  R2=13  R3=11
  //    BDS=0.42  RIS=0.585  →  30 min
  // ═══════════════════════════════════════════════════════════════════════════
  {
    game: {
      slug: 'fortnite',
      title: 'Fortnite',
      developer: 'Epic Games',
      publisher: 'Epic Games',
      genres: ['Battle Royale', 'Shooter', 'Action'],
      platforms: ['PC', 'PlayStation', 'Xbox', 'Switch', 'iOS', 'Android'],
      esrbRating: 'T',
      pegiRating: 12,
      basePrice: 0,
      hasMicrotransactions: true,
      hasLootBoxes: false,
      hasSubscription: false,
      hasBattlePass: true,
      requiresInternet: 'always',
      hasStrangerChat: true,
      chatModeration: 'basic',
      metacriticScore: 81,
      description: 'A free-to-play battle royale where 100 players fight to be the last standing, combining shooting with unique building mechanics.',
    },
    review: {
      esrbRating: 'T',
      // B1 Cognitive (sum=19)
      problemSolving: 2, spatialAwareness: 4, strategicThinking: 3, criticalThinking: 1,
      memoryAttention: 2, creativity: 2, readingLanguage: 1, mathSystems: 1,
      learningTransfer: 1, adaptiveChallenge: 2,
      // B2 Social-emotional (sum=10)
      teamwork: 3, communication: 3, empathy: 0, emotionalRegulation: 2,
      ethicalReasoning: 0, positiveSocial: 2,
      // B3 Motor (sum=13)
      handEyeCoord: 5, fineMotor: 3, reactionTime: 5, physicalActivity: 0,
      // R1 Dopamine (sum=18)
      variableRewards: 2, streakMechanics: 2, lossAversion: 1, fomoEvents: 3,
      stoppingBarriers: 1, notifications: 2, nearMiss: 1, infinitePlay: 2,
      escalatingCommitment: 2, variableRewardFreq: 2,
      // R2 Monetisation (sum=13)
      spendingCeiling: 2, payToWin: 0, currencyObfuscation: 2, spendingPrompts: 2,
      childTargeting: 3, adPressure: 0, subscriptionPressure: 1, socialSpending: 3,
      // R3 Social (sum=11)
      socialObligation: 1, competitiveToxicity: 2, strangerRisk: 2, socialComparison: 3,
      identitySelfWorth: 2, privacyRisk: 1,
      // R4 Content
      violenceLevel: 2, sexualContent: 0, language: 1, substanceRef: 0, fearHorror: 0,
      // Practical
      estimatedMonthlyCostLow: 0, estimatedMonthlyCostHigh: 25,
      minSessionMinutes: 20, hasNaturalStoppingPoints: true, penalizesBreaks: false,
      stoppingPointsDescription: 'Each match has a natural end (win or be eliminated, ~20 min). Battle pass progress does not decay. However, limited-time events and seasonal challenges create urgency to play regularly.',
      benefitsNarrative: 'Fortnite is genuinely demanding at a motor skill level — competitive players develop fast reaction times, strong hand-eye coordination, and sophisticated spatial awareness. Squad play requires real-time communication and teamwork. The building mechanic adds a strategic dimension most shooters lack.',
      risksNarrative: 'Epic Games has designed Fortnite with exceptional skill at capturing and maintaining attention. Time-limited cosmetics, seasonal battle passes, and V-Bucks currency obfuscation are sophisticated engagement tools. Skins create visible social status among children — "what skin are you wearing?" is a real social dynamic. The cosmetic-only model means spending doesn\'t buy power, but peer pressure to have the latest skins is real and documented.',
      parentTip: 'Have a clear conversation about V-Bucks before your child asks to buy them. The "cosmetics only" model is relatively fair, but costs add up — set a monthly budget if you allow purchases. Co-op squad play with friends they know in person reduces the stranger-interaction risk.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. ROBLOX
  //    B1=22  B2=11  B3=5  |  R1=16  R2=18  R3=13
  //    BDS=0.38  RIS=0.646  →  30 min
  // ═══════════════════════════════════════════════════════════════════════════
  {
    game: {
      slug: 'roblox',
      title: 'Roblox',
      developer: 'Roblox Corporation',
      publisher: 'Roblox Corporation',
      genres: ['Platform', 'User-Generated', 'Social'],
      platforms: ['PC', 'iOS', 'Android', 'Xbox'],
      esrbRating: 'E10+',
      pegiRating: 7,
      basePrice: 0,
      hasMicrotransactions: true,
      hasLootBoxes: true,
      hasSubscription: true,
      hasBattlePass: false,
      requiresInternet: 'always',
      hasStrangerChat: true,
      chatModeration: 'basic',
      metacriticScore: null,
      description: 'An online platform where users create and play games made by other users. Features millions of user-created experiences ranging from obstacle courses to role-playing games.',
    },
    review: {
      esrbRating: 'E10+',
      // B1 Cognitive (sum=22)
      problemSolving: 2, spatialAwareness: 3, strategicThinking: 2, criticalThinking: 1,
      memoryAttention: 2, creativity: 4, readingLanguage: 2, mathSystems: 2,
      learningTransfer: 3, adaptiveChallenge: 1,
      // B2 Social-emotional (sum=11)
      teamwork: 3, communication: 3, empathy: 1, emotionalRegulation: 1,
      ethicalReasoning: 1, positiveSocial: 2,
      // B3 Motor (sum=5)
      handEyeCoord: 2, fineMotor: 1, reactionTime: 2, physicalActivity: 0,
      // R1 Dopamine (sum=16)
      variableRewards: 2, streakMechanics: 1, lossAversion: 1, fomoEvents: 2,
      stoppingBarriers: 1, notifications: 2, nearMiss: 1, infinitePlay: 3,
      escalatingCommitment: 1, variableRewardFreq: 2,
      // R2 Monetisation (sum=18)
      spendingCeiling: 3, payToWin: 2, currencyObfuscation: 2, spendingPrompts: 3,
      childTargeting: 3, adPressure: 1, subscriptionPressure: 2, socialSpending: 2,
      // R3 Social (sum=13)
      socialObligation: 1, competitiveToxicity: 2, strangerRisk: 3, socialComparison: 2,
      identitySelfWorth: 2, privacyRisk: 3,
      // R4 Content
      violenceLevel: 1, sexualContent: 0, language: 1, substanceRef: 0, fearHorror: 1,
      // Practical
      estimatedMonthlyCostLow: 0, estimatedMonthlyCostHigh: 40,
      minSessionMinutes: 10, hasNaturalStoppingPoints: true, penalizesBreaks: false,
      stoppingPointsDescription: 'Individual game experiences have endings. However, Roblox as a platform has no endpoint — there are always new games, events, and social spaces to visit.',
      benefitsNarrative: 'Roblox\'s creative potential is real. Children who engage with Roblox Studio learn basic programming logic (Lua scripting), 3D design, and game design thinking. Social play can develop communication and teamwork. For children who create rather than just consume, Roblox can be a genuine gateway to computational thinking.',
      risksNarrative: 'Roblox has some of the highest monetization risk of any platform aimed at children. Robux currency obscures real costs; individual game developers can implement pay-to-win mechanics; and the platform has a documented history of predatory monetization in certain popular games. Stranger interaction risk is significant — children regularly interact with unknown adults, and safety incidents have been reported. Roblox has improved moderation but it remains imperfect at scale.',
      parentTip: 'Enable the parental controls (account restrictions, spending limits, contact settings). Ask your child to show you which games they\'re playing — quality and safety vary enormously. Consider whitelisting specific trusted games rather than allowing full platform access.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. THE LEGEND OF ZELDA: TEARS OF THE KINGDOM
  //    Source: RUBRIC.md worked example, Example 1
  //    B1=34  B2=9  B3=10  |  R1=3  R2=0  R3=0
  //    BDS=0.53  RIS=0.045  →  120 min
  // ═══════════════════════════════════════════════════════════════════════════
  {
    game: {
      slug: 'the-legend-of-zelda-tears-of-the-kingdom',
      title: 'The Legend of Zelda: Tears of the Kingdom',
      developer: 'Nintendo',
      publisher: 'Nintendo',
      genres: ['Action-Adventure', 'Open World', 'Puzzle'],
      platforms: ['Switch'],
      esrbRating: 'E10+',
      pegiRating: 12,
      basePrice: 69.99,
      hasMicrotransactions: false,
      hasLootBoxes: false,
      hasSubscription: false,
      hasBattlePass: false,
      requiresInternet: 'never',
      hasStrangerChat: false,
      chatModeration: 'none',
      metacriticScore: 96,
      description: 'An open-air adventure set in the skies above Hyrule. Use the Ultrahand ability to build machines and solve physics-based puzzles across a vast world.',
    },
    review: {
      esrbRating: 'E10+',
      // B1 Cognitive (sum=34, from rubric)
      problemSolving: 5, spatialAwareness: 5, strategicThinking: 3, criticalThinking: 3,
      memoryAttention: 3, creativity: 5, readingLanguage: 2, mathSystems: 2,
      learningTransfer: 2, adaptiveChallenge: 4,
      // B2 Social-emotional (sum=9, from rubric)
      teamwork: 0, communication: 0, empathy: 3, emotionalRegulation: 4,
      ethicalReasoning: 2, positiveSocial: 0,
      // B3 Motor (sum=10, from rubric)
      handEyeCoord: 4, fineMotor: 3, reactionTime: 3, physicalActivity: 0,
      // R1 Dopamine (sum=3, from rubric)
      variableRewards: 0, streakMechanics: 0, lossAversion: 0, fomoEvents: 0,
      stoppingBarriers: 1, notifications: 0, nearMiss: 0, infinitePlay: 1,
      escalatingCommitment: 1, variableRewardFreq: 0,
      // R2 Monetisation (sum=0, from rubric)
      spendingCeiling: 0, payToWin: 0, currencyObfuscation: 0, spendingPrompts: 0,
      childTargeting: 0, adPressure: 0, subscriptionPressure: 0, socialSpending: 0,
      // R3 Social (sum=0, from rubric)
      socialObligation: 0, competitiveToxicity: 0, strangerRisk: 0, socialComparison: 0,
      identitySelfWorth: 0, privacyRisk: 0,
      // R4 Content
      violenceLevel: 2, sexualContent: 0, language: 0, substanceRef: 0, fearHorror: 1,
      // Practical
      estimatedMonthlyCostLow: 0, estimatedMonthlyCostHigh: 0,
      minSessionMinutes: 20, hasNaturalStoppingPoints: true, penalizesBreaks: false,
      stoppingPointsDescription: 'Save and quit between shrines, stables, or towns. The open world has hundreds of natural pause points. No penalty for absence — the world waits exactly where you left it.',
      benefitsNarrative: 'Tears of the Kingdom is among the most cognitively rich games ever made for children. The Ultrahand building system is radically open-ended — the same puzzle can be solved dozens of ways, rewarding creative and divergent thinking. Spatial reasoning is exercised constantly: navigating the sky islands, planning construction, reading the environment for solutions. The open world teaches self-direction and persistence without punishing failure.',
      risksNarrative: 'This is one of the cleanest games we have reviewed. Nintendo has not added any monetization mechanics, notifications, or engagement hooks. The only risk is the infinite nature of the open world — sessions can run long if boundaries aren\'t set. The game doesn\'t want to stop.',
      parentTip: 'A rare game where the main job is just agreeing on reasonable session length — the game itself is working with you, not against you. Discuss what Link is building and why; the creative problem-solving is worth talking through together.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. GENSHIN IMPACT
  //    Source: RUBRIC.md worked example, Example 2
  //    B1=21  B2=11  B3=10  |  R1=24  R2=15  R3=8
  //    BDS=0.42  RIS=0.659  →  30 min
  // ═══════════════════════════════════════════════════════════════════════════
  {
    game: {
      slug: 'genshin-impact',
      title: 'Genshin Impact',
      developer: 'HoYoverse',
      publisher: 'HoYoverse',
      genres: ['Action RPG', 'Open World', 'Gacha'],
      platforms: ['PC', 'PlayStation', 'iOS', 'Android'],
      esrbRating: 'T',
      pegiRating: 12,
      basePrice: 0,
      hasMicrotransactions: true,
      hasLootBoxes: true,
      hasSubscription: true,
      hasBattlePass: true,
      requiresInternet: 'always',
      hasStrangerChat: true,
      chatModeration: 'basic',
      metacriticScore: 84,
      description: 'An open-world action RPG featuring a cast of elemental characters collected through a gacha system, set in the continent of Teyvat.',
    },
    review: {
      esrbRating: 'T',
      // B1 Cognitive (sum=21, from rubric)
      problemSolving: 3, spatialAwareness: 4, strategicThinking: 3, criticalThinking: 2,
      memoryAttention: 2, creativity: 1, readingLanguage: 2, mathSystems: 2,
      learningTransfer: 1, adaptiveChallenge: 1,
      // B2 Social-emotional (sum=11, from rubric)
      teamwork: 3, communication: 2, empathy: 2, emotionalRegulation: 1,
      ethicalReasoning: 1, positiveSocial: 2,
      // B3 Motor (sum=10, from rubric)
      handEyeCoord: 4, fineMotor: 3, reactionTime: 3, physicalActivity: 0,
      // R1 Dopamine (sum=24, from rubric)
      variableRewards: 3, streakMechanics: 2, lossAversion: 2, fomoEvents: 3,
      stoppingBarriers: 2, notifications: 2, nearMiss: 2, infinitePlay: 2,
      escalatingCommitment: 3, variableRewardFreq: 3,
      // R2 Monetisation (sum=15, from rubric)
      spendingCeiling: 3, payToWin: 2, currencyObfuscation: 3, spendingPrompts: 2,
      childTargeting: 1, adPressure: 0, subscriptionPressure: 2, socialSpending: 2,
      // R3 Social (sum=8, from rubric)
      socialObligation: 1, competitiveToxicity: 1, strangerRisk: 1, socialComparison: 2,
      identitySelfWorth: 2, privacyRisk: 1,
      // R4 Content
      violenceLevel: 2, sexualContent: 1, language: 0, substanceRef: 0, fearHorror: 0,
      // Practical
      estimatedMonthlyCostLow: 0, estimatedMonthlyCostHigh: 100,
      minSessionMinutes: 15, hasNaturalStoppingPoints: true, penalizesBreaks: false,
      stoppingPointsDescription: 'The resin system gates daily progression — most players exhaust daily content in 15–30 min. This feels like a stopping point but is designed to keep players coming back daily rather than stopping permanently.',
      benefitsNarrative: 'The world of Teyvat is genuinely beautiful and the elemental combat system has real strategic depth. Team composition and elemental reaction planning reward systems thinking. The open-world exploration and puzzle content offer genuine cognitive engagement. For older teens, the lore and character writing provide narrative depth.',
      risksNarrative: 'Genshin Impact is a showcase of sophisticated engagement design. The gacha character banner system is a variable-ratio reward schedule calibrated to near-miss psychology — the "pity system" is designed to keep players pulling rather than stopping. Time-limited banner characters create genuine FOMO. The Welkin Moon subscription and Battle Pass create ongoing spending pressure. Currency flows through Primogems → Intertwined Fates → Wishes, with each layer obscuring real-money cost.',
      parentTip: 'If your child wants to play Genshin, consider making it a "free-to-play only" household rule from the start. The game is fully completable without spending, but the gacha system is designed to erode that resolve. Have an honest conversation about what gacha is and why it\'s designed the way it is — this is a valuable real-world lesson about persuasive design.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. GRAND THEFT AUTO V / GTA ONLINE
  //    B1=22  B2=9  B3=10  |  R1=21  R2=13  R3=13
  //    BDS=0.41  RIS=0.658  →  30 min (M-rated — content risk is primary concern)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    game: {
      slug: 'grand-theft-auto-v',  // Already in DB as id=1
      title: 'Grand Theft Auto V',
      developer: 'Rockstar North',
      publisher: 'Rockstar Games',
      genres: ['Action', 'Open World', 'Crime'],
      platforms: ['PC', 'PlayStation', 'Xbox'],
      esrbRating: 'M',
      pegiRating: 18,
      basePrice: 29.99,
      hasMicrotransactions: true,
      hasLootBoxes: false,
      hasSubscription: false,
      hasBattlePass: false,
      requiresInternet: 'sometimes',
      hasStrangerChat: true,
      chatModeration: 'none',
      metacriticScore: 97,
      description: 'An open-world action game following three criminals in Los Santos. GTA Online adds persistent multiplayer with ongoing updates.',
    },
    review: {
      esrbRating: 'M',
      // B1 Cognitive (sum=22)
      problemSolving: 2, spatialAwareness: 4, strategicThinking: 3, criticalThinking: 2,
      memoryAttention: 2, creativity: 2, readingLanguage: 2, mathSystems: 2,
      learningTransfer: 1, adaptiveChallenge: 2,
      // B2 Social-emotional (sum=9)
      teamwork: 3, communication: 3, empathy: 0, emotionalRegulation: 1,
      ethicalReasoning: 1, positiveSocial: 1,
      // B3 Motor (sum=10)
      handEyeCoord: 4, fineMotor: 2, reactionTime: 4, physicalActivity: 0,
      // R1 Dopamine (sum=21) — GTA Online primarily
      variableRewards: 2, streakMechanics: 2, lossAversion: 2, fomoEvents: 2,
      stoppingBarriers: 2, notifications: 2, nearMiss: 1, infinitePlay: 3,
      escalatingCommitment: 3, variableRewardFreq: 2,
      // R2 Monetisation (sum=13)
      spendingCeiling: 3, payToWin: 3, currencyObfuscation: 2, spendingPrompts: 2,
      childTargeting: 0, adPressure: 0, subscriptionPressure: 1, socialSpending: 2,
      // R3 Social (sum=13)
      socialObligation: 2, competitiveToxicity: 3, strangerRisk: 3, socialComparison: 2,
      identitySelfWorth: 2, privacyRisk: 1,
      // R4 Content (M-rated)
      violenceLevel: 3, sexualContent: 2, language: 3, substanceRef: 2, fearHorror: 0,
      // Practical
      estimatedMonthlyCostLow: 0, estimatedMonthlyCostHigh: 50,
      minSessionMinutes: 30, hasNaturalStoppingPoints: true, penalizesBreaks: true,
      stoppingPointsDescription: 'Story mode has natural mission endpoints. GTA Online heists require sustained sessions with a group — abandoning mid-heist penalises all players. Active events and Shark Card promotions encourage regular engagement.',
      benefitsNarrative: 'GTA V\'s single-player story mode has genuine narrative craft, cinematic ambition, and surprisingly sophisticated satire of American consumer culture. The open world rewards exploration. Co-op heist missions in GTA Online require genuine coordination and planning.',
      risksNarrative: 'GTA V is rated M for mature for reason: graphic violence, sexual content, and pervasive profanity are core to the experience, not incidental. GTA Online adds Shark Cards (premium in-game currency) that provide meaningful pay-to-win advantages in the late game. Competitive play is frequently toxic with no real moderation. Unmoderated stranger voice chat.',
      parentTip: 'This is rated M for 17+ and that rating is accurate. The content is not appropriate for children or young teenagers. If an older teenager plays it, ensure it\'s single-player first — GTA Online\'s monetization and community toxicity are significantly more problematic.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. MINECRAFT: BEDROCK EDITION WITH MARKETPLACE
  //    Same benefits as vanilla; significantly higher monetisation risk
  //    B1=38  B2=16  B3=6  |  R1=12  R2=15  R3=7
  //    BDS=0.60  RIS=0.465  →  60 min base + benefit extension → 90 min
  // ═══════════════════════════════════════════════════════════════════════════
  {
    game: {
      slug: 'minecraft-marketplace',
      title: 'Minecraft: Bedrock Edition (with Marketplace)',
      developer: 'Mojang Studios',
      publisher: 'Microsoft',
      genres: ['Sandbox', 'Survival', 'Creative'],
      platforms: ['PC', 'Switch', 'PlayStation', 'Xbox', 'iOS', 'Android'],
      esrbRating: 'E10+',
      pegiRating: 7,
      basePrice: 29.99,
      hasMicrotransactions: true,
      hasLootBoxes: false,
      hasSubscription: true,
      hasBattlePass: false,
      requiresInternet: 'sometimes',
      hasStrangerChat: true,
      chatModeration: 'parental-controls',
      metacriticScore: 93,
      description: 'Minecraft Bedrock Edition with access to the in-game Marketplace — a store selling skins, worlds, and texture packs using Minecoins virtual currency.',
    },
    review: {
      esrbRating: 'E10+',
      // B1 Cognitive (sum=38) — same as vanilla
      problemSolving: 4, spatialAwareness: 5, strategicThinking: 3, criticalThinking: 3,
      memoryAttention: 3, creativity: 5, readingLanguage: 2, mathSystems: 4,
      learningTransfer: 4, adaptiveChallenge: 5,
      // B2 Social-emotional (sum=16) — same as vanilla
      teamwork: 3, communication: 3, empathy: 1, emotionalRegulation: 3,
      ethicalReasoning: 2, positiveSocial: 4,
      // B3 Motor (sum=6) — same as vanilla
      handEyeCoord: 2, fineMotor: 2, reactionTime: 2, physicalActivity: 0,
      // R1 Dopamine (sum=12) — marketplace adds FOMO seasonal content
      variableRewards: 2, streakMechanics: 1, lossAversion: 0, fomoEvents: 2,
      stoppingBarriers: 1, notifications: 1, nearMiss: 0, infinitePlay: 2,
      escalatingCommitment: 2, variableRewardFreq: 1,
      // R2 Monetisation (sum=15) — Minecoins + Marketplace + Realms
      spendingCeiling: 3, payToWin: 1, currencyObfuscation: 2, spendingPrompts: 2,
      childTargeting: 3, adPressure: 0, subscriptionPressure: 2, socialSpending: 2,
      // R3 Social (sum=7)
      socialObligation: 0, competitiveToxicity: 1, strangerRisk: 2, socialComparison: 2,
      identitySelfWorth: 1, privacyRisk: 1,
      // R4 Content
      violenceLevel: 1, sexualContent: 0, language: 0, substanceRef: 0, fearHorror: 1,
      // Practical
      estimatedMonthlyCostLow: 0, estimatedMonthlyCostHigh: 15,
      minSessionMinutes: 15, hasNaturalStoppingPoints: true, penalizesBreaks: false,
      stoppingPointsDescription: 'Same excellent natural stopping points as vanilla Minecraft. The Marketplace adds seasonal content that may encourage checking in more frequently.',
      benefitsNarrative: 'The underlying game is identical to vanilla Minecraft, which remains one of the most educationally rich games available. All the creative, spatial, and problem-solving benefits apply equally here.',
      risksNarrative: 'The Marketplace transforms Minecraft into a platform with meaningful monetization risk. Minecoins (purchased with real money) obscure costs. The Marketplace is explicitly child-targeted — cute characters, seasonal bundles, prominent in-game advertising. Microsoft has been criticised for the aggressive placement of marketplace content within what many parents consider a "complete" game. Seasonal cosmetics create mild FOMO. Realms subscription adds ongoing cost.',
      parentTip: 'You can disable Marketplace access in Microsoft Family Safety settings while keeping all gameplay intact. The game is complete without spending a penny after the initial purchase. Consider setting this boundary early rather than fighting about it later.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. SPLIT FICTION
  //    Cooperative narrative platformer requiring two players
  //    B1=23  B2=22  B3=8  |  R1=2  R2=0  R3=3
  //    BDS=0.53  RIS=0.072  →  120 min
  // ═══════════════════════════════════════════════════════════════════════════
  {
    game: {
      slug: 'split-fiction',
      title: 'Split Fiction',
      developer: 'Hazelight Studios',
      publisher: 'Electronic Arts',
      genres: ['Platformer', 'Co-op', 'Action-Adventure'],
      platforms: ['PC', 'PlayStation', 'Xbox'],
      esrbRating: 'T',
      pegiRating: 12,
      basePrice: 49.99,
      hasMicrotransactions: false,
      hasLootBoxes: false,
      hasSubscription: false,
      hasBattlePass: false,
      requiresInternet: 'sometimes',
      hasStrangerChat: false,
      chatModeration: 'none',
      metacriticScore: 88,
      description: 'A two-player only adventure through sci-fi and fantasy worlds, from the creators of It Takes Two. Requires cooperation throughout — one player can use the "Friend\'s Pass" for free.',
    },
    review: {
      esrbRating: 'T',
      // B1 Cognitive (sum=23)
      problemSolving: 4, spatialAwareness: 3, strategicThinking: 2, criticalThinking: 2,
      memoryAttention: 2, creativity: 2, readingLanguage: 2, mathSystems: 1,
      learningTransfer: 2, adaptiveChallenge: 3,
      // B2 Social-emotional (sum=22) — cooperative design is exceptional
      teamwork: 5, communication: 5, empathy: 3, emotionalRegulation: 3,
      ethicalReasoning: 2, positiveSocial: 4,
      // B3 Motor (sum=8)
      handEyeCoord: 3, fineMotor: 2, reactionTime: 3, physicalActivity: 0,
      // R1 Dopamine (sum=2) — exceptionally clean design
      variableRewards: 0, streakMechanics: 0, lossAversion: 0, fomoEvents: 0,
      stoppingBarriers: 1, notifications: 0, nearMiss: 0, infinitePlay: 0,
      escalatingCommitment: 1, variableRewardFreq: 0,
      // R2 Monetisation (sum=0)
      spendingCeiling: 0, payToWin: 0, currencyObfuscation: 0, spendingPrompts: 0,
      childTargeting: 0, adPressure: 0, subscriptionPressure: 0, socialSpending: 0,
      // R3 Social (sum=3) — requires another player (mild obligation)
      socialObligation: 2, competitiveToxicity: 0, strangerRisk: 0, socialComparison: 0,
      identitySelfWorth: 0, privacyRisk: 1,
      // R4 Content
      violenceLevel: 1, sexualContent: 1, language: 1, substanceRef: 0, fearHorror: 0,
      // Practical
      estimatedMonthlyCostLow: 0, estimatedMonthlyCostHigh: 0,
      minSessionMinutes: 30, hasNaturalStoppingPoints: true, penalizesBreaks: false,
      stoppingPointsDescription: 'Chapter structure provides clear session boundaries. Progress saves automatically. No daily events or FOMO mechanics — play at any pace.',
      benefitsNarrative: 'Split Fiction may offer the highest cooperative social development value of any mainstream game. It requires constant communication, genuine collaboration, and mutual problem-solving — neither player can succeed without the other. Hazelight\'s design philosophy puts emotional resonance before engagement manipulation. The "Friend\'s Pass" feature means only one copy is needed for two players, making it accessible.',
      risksNarrative: 'The game requires a second player, which creates mild scheduling obligation. Some content (mild cartoon violence, brief suggestive moments) earns the T rating but is appropriate for most pre-teens. Zero monetization. No manipulation mechanics.',
      parentTip: 'One of the best co-op experiences available for parent-child play. One purchased copy covers two players. Playing alongside your child offers natural conversation starters as the story unfolds.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. AMONG US
  //    Social deduction party game
  //    B1=21  B2=18  B3=4  |  R1=5  R2=8  R3=7
  //    BDS=0.43  RIS=0.272  →  90 min
  // ═══════════════════════════════════════════════════════════════════════════
  {
    game: {
      slug: 'among-us',
      title: 'Among Us',
      developer: 'Innersloth',
      publisher: 'Innersloth',
      genres: ['Party', 'Social Deduction', 'Multiplayer'],
      platforms: ['PC', 'Switch', 'iOS', 'Android'],
      esrbRating: 'E10+',
      pegiRating: 7,
      basePrice: 5,
      hasMicrotransactions: true,
      hasLootBoxes: false,
      hasSubscription: false,
      hasBattlePass: false,
      requiresInternet: 'always',
      hasStrangerChat: true,
      chatModeration: 'basic',
      metacriticScore: 85,
      description: 'A multiplayer social deduction game set in space. Players work as crew members while hidden impostors try to sabotage and eliminate them.',
    },
    review: {
      esrbRating: 'E10+',
      // B1 Cognitive (sum=21) — strong deduction and reasoning
      problemSolving: 3, spatialAwareness: 1, strategicThinking: 3, criticalThinking: 4,
      memoryAttention: 3, creativity: 1, readingLanguage: 2, mathSystems: 1,
      learningTransfer: 2, adaptiveChallenge: 1,
      // B2 Social-emotional (sum=18) — social deduction is inherently social
      teamwork: 4, communication: 4, empathy: 2, emotionalRegulation: 2,
      ethicalReasoning: 3, positiveSocial: 3,
      // B3 Motor (sum=4)
      handEyeCoord: 1, fineMotor: 1, reactionTime: 2, physicalActivity: 0,
      // R1 Dopamine (sum=5) — short matches, light hooks
      variableRewards: 1, streakMechanics: 0, lossAversion: 0, fomoEvents: 1,
      stoppingBarriers: 0, notifications: 1, nearMiss: 0, infinitePlay: 1,
      escalatingCommitment: 0, variableRewardFreq: 1,
      // R2 Monetisation (sum=8) — free version has ads; cosmetics exist
      spendingCeiling: 2, payToWin: 0, currencyObfuscation: 1, spendingPrompts: 1,
      childTargeting: 1, adPressure: 2, subscriptionPressure: 0, socialSpending: 1,
      // R3 Social (sum=7) — stranger risk on public servers
      socialObligation: 1, competitiveToxicity: 1, strangerRisk: 2, socialComparison: 1,
      identitySelfWorth: 1, privacyRisk: 1,
      // R4 Content
      violenceLevel: 1, sexualContent: 0, language: 0, substanceRef: 0, fearHorror: 0,
      // Practical
      estimatedMonthlyCostLow: 0, estimatedMonthlyCostHigh: 5,
      minSessionMinutes: 10, hasNaturalStoppingPoints: true, penalizesBreaks: false,
      stoppingPointsDescription: 'Each round lasts 5–15 minutes with a clear win/loss resolution. Natural stopping between rounds. No progress is lost from taking a break.',
      benefitsNarrative: 'Among Us is a surprisingly rich exercise in critical thinking, communication, and social reasoning. Spotting inconsistencies in others\' stories, building arguments from limited evidence, and detecting deception are genuine critical thinking skills. The game is structured — each round has a beginning, middle, and clear end.',
      risksNarrative: 'Public lobbies include strangers with chat enabled. The mobile/free versions include interstitial ads. Cosmetic monetization exists but is non-intrusive. The main risk is open public lobbies with unvetted players — private lobbies with known players are significantly safer.',
      parentTip: 'Private lobbies with family or friends you know in person are much safer and more enjoyable. The paid version ($5 one-time) removes ads entirely and is worth it for regular players.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. CANDY CRUSH SAGA
  //    Highest-risk mobile game in this set
  //    B1=10  B2=1  B3=3  |  R1=26  R2=19  R3=6
  //    BDS=0.14  RIS=0.711  →  15 min (tier drop applies but already at minimum)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    game: {
      slug: 'candy-crush-saga',
      title: 'Candy Crush Saga',
      developer: 'King',
      publisher: 'Activision Blizzard / King',
      genres: ['Puzzle', 'Match-3', 'Mobile'],
      platforms: ['iOS', 'Android', 'Facebook'],
      esrbRating: null,
      pegiRating: 3,
      basePrice: 0,
      hasMicrotransactions: true,
      hasLootBoxes: false,
      hasSubscription: false,
      hasBattlePass: false,
      requiresInternet: 'sometimes',
      hasStrangerChat: false,
      chatModeration: 'none',
      metacriticScore: 79,
      description: 'A free-to-play match-3 puzzle game with thousands of levels. Players swap candy to form matches, with lives that regenerate over time or can be purchased.',
    },
    review: {
      esrbRating: null,
      // B1 Cognitive (sum=10) — minimal cognitive value
      problemSolving: 2, spatialAwareness: 1, strategicThinking: 2, criticalThinking: 1,
      memoryAttention: 2, creativity: 0, readingLanguage: 0, mathSystems: 1,
      learningTransfer: 0, adaptiveChallenge: 1,
      // B2 Social-emotional (sum=1)
      teamwork: 0, communication: 0, empathy: 0, emotionalRegulation: 0,
      ethicalReasoning: 0, positiveSocial: 1,
      // B3 Motor (sum=3)
      handEyeCoord: 1, fineMotor: 1, reactionTime: 1, physicalActivity: 0,
      // R1 Dopamine (sum=26) — near-maximum manipulation
      variableRewards: 3, streakMechanics: 2, lossAversion: 2, fomoEvents: 2,
      stoppingBarriers: 3, notifications: 3, nearMiss: 3, infinitePlay: 3,
      escalatingCommitment: 2, variableRewardFreq: 3,
      // R2 Monetisation (sum=19)
      spendingCeiling: 3, payToWin: 3, currencyObfuscation: 2, spendingPrompts: 3,
      childTargeting: 2, adPressure: 3, subscriptionPressure: 1, socialSpending: 2,
      // R3 Social (sum=6)
      socialObligation: 1, competitiveToxicity: 0, strangerRisk: 0, socialComparison: 2,
      identitySelfWorth: 1, privacyRisk: 2,
      // R4 Content
      violenceLevel: 0, sexualContent: 0, language: 0, substanceRef: 0, fearHorror: 0,
      // Practical
      estimatedMonthlyCostLow: 0, estimatedMonthlyCostHigh: 30,
      minSessionMinutes: 5, hasNaturalStoppingPoints: false, penalizesBreaks: false,
      stoppingPointsDescription: 'The lives system creates artificial stopping points designed to convert frustration into purchases. There is no natural gameplay endpoint — the game continues indefinitely across thousands of levels.',
      benefitsNarrative: 'Candy Crush has minimal developmental value. There is light pattern recognition involved in match-3 gameplay, but the mechanics are simplified to maximise accessibility and engagement volume rather than skill development.',
      risksNarrative: 'Candy Crush Saga is a textbook example of engineered engagement: near-miss visual effects, level designs calibrated for near-completion, a lives system that creates artificial scarcity and spending pressure, aggressive push notifications, and a spend-to-progress model. King (the developer) has published academic research on their own engagement optimisation methods. This game is not designed to be fun — it is designed to be played.',
      parentTip: 'This game has no minimum age appropriateness concern from a content standpoint, but the engagement and spending mechanics are unsuitable for children. If your child wants a puzzle game, consider Threes!, Monument Valley, or The Room instead — games that are enjoyable without manipulation mechanics.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. MARIO KART 8 DELUXE
  //    B1=13  B2=10  B3=10  |  R1=1  R2=2  R3=4
  //    BDS=0.33  RIS=0.096  →  120 min
  // ═══════════════════════════════════════════════════════════════════════════
  {
    game: {
      slug: 'mario-kart-8-deluxe',
      title: 'Mario Kart 8 Deluxe',
      developer: 'Nintendo',
      publisher: 'Nintendo',
      genres: ['Racing', 'Party', 'Multiplayer'],
      platforms: ['Switch'],
      esrbRating: 'E',
      pegiRating: 3,
      basePrice: 59.99,
      hasMicrotransactions: false,
      hasLootBoxes: false,
      hasSubscription: false,
      hasBattlePass: false,
      requiresInternet: 'sometimes',
      hasStrangerChat: false,
      chatModeration: 'none',
      metacriticScore: 92,
      description: 'The definitive kart racing game featuring Nintendo\'s iconic characters across 48+ tracks. Includes all DLC from the Wii U original plus the Booster Course Pass.',
    },
    review: {
      esrbRating: 'E',
      // B1 Cognitive (sum=13)
      problemSolving: 1, spatialAwareness: 3, strategicThinking: 2, criticalThinking: 1,
      memoryAttention: 2, creativity: 0, readingLanguage: 0, mathSystems: 1,
      learningTransfer: 0, adaptiveChallenge: 3,
      // B2 Social-emotional (sum=10)
      teamwork: 2, communication: 1, empathy: 1, emotionalRegulation: 3,
      ethicalReasoning: 0, positiveSocial: 3,
      // B3 Motor (sum=10)
      handEyeCoord: 4, fineMotor: 2, reactionTime: 4, physicalActivity: 0,
      // R1 Dopamine (sum=1) — exceptionally clean
      variableRewards: 0, streakMechanics: 0, lossAversion: 0, fomoEvents: 0,
      stoppingBarriers: 0, notifications: 0, nearMiss: 0, infinitePlay: 1,
      escalatingCommitment: 0, variableRewardFreq: 0,
      // R2 Monetisation (sum=2)
      spendingCeiling: 1, payToWin: 0, currencyObfuscation: 0, spendingPrompts: 0,
      childTargeting: 0, adPressure: 0, subscriptionPressure: 1, socialSpending: 0,
      // R3 Social (sum=4)
      socialObligation: 0, competitiveToxicity: 1, strangerRisk: 1, socialComparison: 1,
      identitySelfWorth: 0, privacyRisk: 1,
      // R4 Content
      violenceLevel: 0, sexualContent: 0, language: 0, substanceRef: 0, fearHorror: 0,
      // Practical
      estimatedMonthlyCostLow: 0, estimatedMonthlyCostHigh: 0,
      minSessionMinutes: 5, hasNaturalStoppingPoints: true, penalizesBreaks: false,
      stoppingPointsDescription: 'Each race or cup completes cleanly. Grand Prix cups take 15–20 minutes. The game does not encourage continuing — it congratulates you and returns to the menu.',
      benefitsNarrative: 'Mario Kart 8 Deluxe is one of the best family gaming experiences available. It develops real hand-eye coordination and reaction time, and local multiplayer creates genuine shared fun. The difficulty scales through the CC classes, keeping players in flow. The emotional regulation demanded by losing with grace to blue shells is, perhaps, one of gaming\'s great character-building features.',
      risksNarrative: 'Nintendo\'s base game has virtually no manipulation mechanics. The Nintendo Switch Online subscription adds minor cost if online multiplayer is desired, but local play works perfectly without it. The Booster Course Pass DLC adds more tracks but is optional.',
      parentTip: 'Few games work better for family play across a wide age range. The assist mode and Smart Steering make it accessible for young children while remaining enjoyable for adults. Buy it, play it together.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. ANIMAL CROSSING: NEW HORIZONS
  //    B1=18  B2=15  B3=2  |  R1=14  R2=3  R3=6
  //    BDS=0.35  RIS=0.331  →  60 min
  // ═══════════════════════════════════════════════════════════════════════════
  {
    game: {
      slug: 'animal-crossing-new-horizons',
      title: 'Animal Crossing: New Horizons',
      developer: 'Nintendo',
      publisher: 'Nintendo',
      genres: ['Life Simulation', 'Social', 'Creative'],
      platforms: ['Switch'],
      esrbRating: 'E',
      pegiRating: 3,
      basePrice: 59.99,
      hasMicrotransactions: false,
      hasLootBoxes: false,
      hasSubscription: false,
      hasBattlePass: false,
      requiresInternet: 'sometimes',
      hasStrangerChat: true,
      chatModeration: 'parental-controls',
      metacriticScore: 90,
      description: 'Escape to a deserted island and build your perfect paradise in this life simulation game. Collect creatures, decorate your island, and visit friends.',
    },
    review: {
      esrbRating: 'E',
      // B1 Cognitive (sum=18)
      problemSolving: 1, spatialAwareness: 2, strategicThinking: 2, criticalThinking: 1,
      memoryAttention: 2, creativity: 4, readingLanguage: 2, mathSystems: 2,
      learningTransfer: 1, adaptiveChallenge: 1,
      // B2 Social-emotional (sum=15) — nurturing design
      teamwork: 2, communication: 2, empathy: 3, emotionalRegulation: 3,
      ethicalReasoning: 1, positiveSocial: 4,
      // B3 Motor (sum=2)
      handEyeCoord: 1, fineMotor: 1, reactionTime: 0, physicalActivity: 0,
      // R1 Dopamine (sum=14) — real-time clock creates daily obligation
      variableRewards: 2, streakMechanics: 2, lossAversion: 1, fomoEvents: 2,
      stoppingBarriers: 0, notifications: 2, nearMiss: 0, infinitePlay: 2,
      escalatingCommitment: 2, variableRewardFreq: 1,
      // R2 Monetisation (sum=3) — no IAP in base game
      spendingCeiling: 1, payToWin: 0, currencyObfuscation: 0, spendingPrompts: 0,
      childTargeting: 1, adPressure: 0, subscriptionPressure: 1, socialSpending: 0,
      // R3 Social (sum=6)
      socialObligation: 2, competitiveToxicity: 0, strangerRisk: 1, socialComparison: 1,
      identitySelfWorth: 1, privacyRisk: 1,
      // R4 Content
      violenceLevel: 0, sexualContent: 0, language: 0, substanceRef: 0, fearHorror: 0,
      // Practical
      estimatedMonthlyCostLow: 0, estimatedMonthlyCostHigh: 0,
      minSessionMinutes: 15, hasNaturalStoppingPoints: true, penalizesBreaks: false,
      stoppingPointsDescription: 'Daily tasks complete quickly (watering, digging, talking to villagers). The game runs on a real-time clock so morning and evening offer different content, creating mild daily check-in pressure.',
      benefitsNarrative: 'Animal Crossing develops creativity through island design and home decoration, builds nurturing empathy through relationships with NPC villagers, and introduces basic economic concepts through the Nook Inc. system. The stress-free environment and E-rated content make it genuinely appropriate for young children.',
      risksNarrative: 'The real-time clock design means the game is always "happening" — seasonal events, villager birthdays, and time-limited items create mild daily urgency. The longer-term risk is escalating commitment: players invest significant time in island development and feel reluctant to stop. Visiting strangers\' islands introduces some social risk, manageable with parental controls.',
      parentTip: 'A very good game for younger players and particularly popular for children going through stressful periods (research during COVID confirmed significant wellbeing benefits). The daily check-in rhythm can become habitual — monitor if sessions start feeling obligatory rather than enjoyable.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 13. POKÉMON SCARLET / VIOLET
  //    B1=23  B2=12  B3=5  |  R1=10  R2=8  R3=5
  //    BDS=0.40  RIS=0.319  →  60 min
  // ═══════════════════════════════════════════════════════════════════════════
  {
    game: {
      slug: 'pokemon-scarlet-violet',
      title: 'Pokémon Scarlet / Violet',
      developer: 'Game Freak',
      publisher: 'Nintendo / The Pokémon Company',
      genres: ['RPG', 'Open World', 'Creature Collector'],
      platforms: ['Switch'],
      esrbRating: 'E',
      pegiRating: 7,
      basePrice: 59.99,
      hasMicrotransactions: true,
      hasLootBoxes: false,
      hasSubscription: false,
      hasBattlePass: false,
      requiresInternet: 'sometimes',
      hasStrangerChat: false,
      chatModeration: 'none',
      metacriticScore: 72,
      description: 'An open-world Pokémon RPG set in the Paldea region. Battle, catch, and trade Pokémon freely across a seamless open world.',
    },
    review: {
      esrbRating: 'E',
      // B1 Cognitive (sum=23)
      problemSolving: 2, spatialAwareness: 3, strategicThinking: 4, criticalThinking: 2,
      memoryAttention: 3, creativity: 1, readingLanguage: 2, mathSystems: 2,
      learningTransfer: 2, adaptiveChallenge: 2,
      // B2 Social-emotional (sum=12)
      teamwork: 2, communication: 1, empathy: 3, emotionalRegulation: 2,
      ethicalReasoning: 2, positiveSocial: 2,
      // B3 Motor (sum=5)
      handEyeCoord: 2, fineMotor: 1, reactionTime: 2, physicalActivity: 0,
      // R1 Dopamine (sum=10)
      variableRewards: 2, streakMechanics: 0, lossAversion: 0, fomoEvents: 1,
      stoppingBarriers: 1, notifications: 0, nearMiss: 1, infinitePlay: 2,
      escalatingCommitment: 2, variableRewardFreq: 1,
      // R2 Monetisation (sum=8)
      spendingCeiling: 2, payToWin: 0, currencyObfuscation: 1, spendingPrompts: 1,
      childTargeting: 2, adPressure: 0, subscriptionPressure: 1, socialSpending: 1,
      // R3 Social (sum=5)
      socialObligation: 0, competitiveToxicity: 1, strangerRisk: 1, socialComparison: 1,
      identitySelfWorth: 1, privacyRisk: 1,
      // R4 Content
      violenceLevel: 1, sexualContent: 0, language: 0, substanceRef: 0, fearHorror: 0,
      // Practical
      estimatedMonthlyCostLow: 0, estimatedMonthlyCostHigh: 10,
      minSessionMinutes: 20, hasNaturalStoppingPoints: true, penalizesBreaks: false,
      stoppingPointsDescription: 'Pokémon Center auto-saves frequently. The open world has natural pacing breaks between gyms and story beats. No daily obligations.',
      benefitsNarrative: 'Pokémon games are a genuine entry point to strategic thinking — team building, type matchups, and competitive play have significant depth. The creature-collecting loop teaches categorisation and persistence. The open world in Scarlet/Violet adds spatial navigation. Reading comprehension is exercised through item descriptions, moves, and lore.',
      risksNarrative: 'The Pokémon Home compatibility DLC and event distributions create some spending pressure and FOMO for dedicated players. Competitive online play has exposed children to some unsportsmanlike behaviour. The games were released in notably poor technical condition — an unusual quality concern for Nintendo.',
      parentTip: 'Pokémon is an excellent series for children 7 and up. The DLC (Teal Mask, Indigo Disk) is optional but adds significant playtime. Online trading and battles are safe with parental controls. The competitive meta-game is optional — the story can be completed without engaging with it.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 14. CALL OF DUTY: MODERN WARFARE III (2023)
  //    B1=14  B2=8  B3=13  |  R1=19  R2=14  R3=12
  //    BDS=0.35  RIS=0.627  →  30 min (M-rated)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    game: {
      slug: 'call-of-duty-modern-warfare-iii',
      title: 'Call of Duty: Modern Warfare III',
      developer: 'Sledgehammer Games',
      publisher: 'Activision',
      genres: ['Shooter', 'FPS', 'Multiplayer'],
      platforms: ['PC', 'PlayStation', 'Xbox'],
      esrbRating: 'M',
      pegiRating: 18,
      basePrice: 69.99,
      hasMicrotransactions: true,
      hasLootBoxes: false,
      hasSubscription: false,
      hasBattlePass: true,
      requiresInternet: 'always',
      hasStrangerChat: true,
      chatModeration: 'basic',
      metacriticScore: 56,
      description: 'The latest entry in the Call of Duty franchise, featuring multiplayer, Zombies co-op mode, and a continuation of the Modern Warfare story campaign.',
    },
    review: {
      esrbRating: 'M',
      // B1 Cognitive (sum=14)
      problemSolving: 1, spatialAwareness: 4, strategicThinking: 2, criticalThinking: 1,
      memoryAttention: 2, creativity: 1, readingLanguage: 1, mathSystems: 0,
      learningTransfer: 0, adaptiveChallenge: 2,
      // B2 Social-emotional (sum=8)
      teamwork: 3, communication: 3, empathy: 0, emotionalRegulation: 1,
      ethicalReasoning: 0, positiveSocial: 1,
      // B3 Motor (sum=13)
      handEyeCoord: 5, fineMotor: 3, reactionTime: 5, physicalActivity: 0,
      // R1 Dopamine (sum=19)
      variableRewards: 2, streakMechanics: 2, lossAversion: 2, fomoEvents: 3,
      stoppingBarriers: 1, notifications: 2, nearMiss: 1, infinitePlay: 2,
      escalatingCommitment: 2, variableRewardFreq: 2,
      // R2 Monetisation (sum=14)
      spendingCeiling: 3, payToWin: 1, currencyObfuscation: 2, spendingPrompts: 3,
      childTargeting: 1, adPressure: 0, subscriptionPressure: 2, socialSpending: 2,
      // R3 Social (sum=12)
      socialObligation: 1, competitiveToxicity: 3, strangerRisk: 3, socialComparison: 2,
      identitySelfWorth: 2, privacyRisk: 1,
      // R4 Content (M-rated)
      violenceLevel: 3, sexualContent: 0, language: 2, substanceRef: 1, fearHorror: 1,
      // Practical
      estimatedMonthlyCostLow: 0, estimatedMonthlyCostHigh: 30,
      minSessionMinutes: 20, hasNaturalStoppingPoints: true, penalizesBreaks: false,
      stoppingPointsDescription: 'Individual matches complete in 10–20 minutes. Battle Pass challenges and seasonal events create ongoing goals that encourage extended engagement.',
      benefitsNarrative: 'Call of Duty genuinely develops elite hand-eye coordination and reaction time. Competitive multiplayer requires real spatial awareness, map knowledge, and in the team modes, genuine communication and coordination. These are real skills at a high ceiling.',
      risksNarrative: 'M-rated for graphic violence throughout. The competitive environment is among the most toxic in gaming — unmoderated voice chat regularly exposes players to extreme profanity, slurs, and harassment. The CoD Points currency system and frequent Battle Pass content with limited-time items create significant spending pressure. This game is not appropriate for children.',
      parentTip: 'Rated M for 17+ — this rating reflects the actual content. The multiplayer community is notoriously toxic. If an older teenager plays it, disable voice chat with strangers and discuss spending before any CoD Points are purchased.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 15. EA SPORTS FC 25 (formerly FIFA)
  //    Ultimate Team FUT packs are the central concern
  //    B1=16  B2=10  B3=10  |  R1=24  R2=18  R3=11
  //    BDS=0.36  RIS=0.738  →  15 min (not recommended for children)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    game: {
      slug: 'ea-sports-fc-25',
      title: 'EA Sports FC 25',
      developer: 'EA Vancouver',
      publisher: 'Electronic Arts',
      genres: ['Sports', 'Football', 'Simulation'],
      platforms: ['PC', 'PlayStation', 'Xbox', 'Switch'],
      esrbRating: 'E',
      pegiRating: 3,
      basePrice: 69.99,
      hasMicrotransactions: true,
      hasLootBoxes: true,
      hasSubscription: true,
      hasBattlePass: false,
      requiresInternet: 'sometimes',
      hasStrangerChat: false,
      chatModeration: 'none',
      metacriticScore: 73,
      description: 'EA\'s football simulation game (formerly FIFA) featuring Ultimate Team mode where players collect footballer cards to build squads.',
    },
    review: {
      esrbRating: 'E',
      // B1 Cognitive (sum=16)
      problemSolving: 1, spatialAwareness: 3, strategicThinking: 3, criticalThinking: 1,
      memoryAttention: 2, creativity: 1, readingLanguage: 0, mathSystems: 1,
      learningTransfer: 1, adaptiveChallenge: 3,
      // B2 Social-emotional (sum=10)
      teamwork: 3, communication: 2, empathy: 1, emotionalRegulation: 2,
      ethicalReasoning: 0, positiveSocial: 2,
      // B3 Motor (sum=10)
      handEyeCoord: 4, fineMotor: 2, reactionTime: 4, physicalActivity: 0,
      // R1 Dopamine (sum=24) — FUT pack mechanics
      variableRewards: 3, streakMechanics: 2, lossAversion: 2, fomoEvents: 3,
      stoppingBarriers: 1, notifications: 2, nearMiss: 3, infinitePlay: 2,
      escalatingCommitment: 3, variableRewardFreq: 3,
      // R2 Monetisation (sum=18) — FUT Points, FIFA/FC Coins
      spendingCeiling: 3, payToWin: 3, currencyObfuscation: 3, spendingPrompts: 3,
      childTargeting: 2, adPressure: 0, subscriptionPressure: 2, socialSpending: 2,
      // R3 Social (sum=11)
      socialObligation: 1, competitiveToxicity: 3, strangerRisk: 1, socialComparison: 3,
      identitySelfWorth: 2, privacyRisk: 1,
      // R4 Content
      violenceLevel: 0, sexualContent: 0, language: 1, substanceRef: 0, fearHorror: 0,
      // Practical
      estimatedMonthlyCostLow: 0, estimatedMonthlyCostHigh: 100,
      minSessionMinutes: 15, hasNaturalStoppingPoints: true, penalizesBreaks: false,
      stoppingPointsDescription: 'Individual matches take 15–25 minutes. However, Weekend League (90 matches in 72 hours) creates extreme time pressure. Daily and weekly objectives encourage frequent short sessions.',
      benefitsNarrative: 'The football simulation itself is enjoyable and the multiplayer modes develop real spatial awareness and reaction time. Squad-building in Ultimate Team does involve genuine strategic thinking about formations and player synergies.',
      risksNarrative: 'EA Sports FC 25\'s Ultimate Team mode is one of the most scrutinised loot box systems in gaming. FUT Packs are technically loot boxes — random card draws with real-money purchasable currency (FIFA/FC Points). Belgium and Netherlands have ruled certain FUT Pack mechanics illegal. The pay-to-win gradient is steep: competitive play is dominated by players who have spent heavily. Currency obfuscation (real money → FC Points → FUT Coins) is a triple layer. This game is rated E in the US but several European regulators have flagged the monetization as inappropriate for children.',
      parentTip: 'The base football game is fine; Ultimate Team is the problem. Consider restricting Ultimate Team access and playing only Exhibition, Career Mode, or Pro Clubs. If FUT is played, establish a hard zero-spending rule before the first session — the game is designed to erode parental "just this once" resistance.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 16. STARDEW VALLEY
  //    B1=27  B2=16  B3=5  |  R1=11  R2=0  R3=3
  //    BDS=0.48  RIS=0.207  →  90 min
  // ═══════════════════════════════════════════════════════════════════════════
  {
    game: {
      slug: 'stardew-valley',  // Already in DB
      title: 'Stardew Valley',
      developer: 'ConcernedApe',
      publisher: 'ConcernedApe',
      genres: ['Farming', 'RPG', 'Simulation'],
      platforms: ['PC', 'Switch', 'PlayStation', 'Xbox', 'iOS', 'Android'],
      esrbRating: 'E10+',
      pegiRating: 3,
      basePrice: 14.99,
      hasMicrotransactions: false,
      hasLootBoxes: false,
      hasSubscription: false,
      hasBattlePass: false,
      requiresInternet: 'sometimes',
      hasStrangerChat: false,
      chatModeration: 'none',
      metacriticScore: 89,
      description: 'You\'ve inherited your grandfather\'s old farm. With old tools and a little cash, you begin your new life in Stardew Valley.',
    },
    review: {
      esrbRating: 'E10+',
      // B1 Cognitive (sum=27)
      problemSolving: 2, spatialAwareness: 2, strategicThinking: 4, criticalThinking: 2,
      memoryAttention: 3, creativity: 3, readingLanguage: 3, mathSystems: 3,
      learningTransfer: 2, adaptiveChallenge: 3,
      // B2 Social-emotional (sum=16)
      teamwork: 3, communication: 2, empathy: 3, emotionalRegulation: 3,
      ethicalReasoning: 2, positiveSocial: 3,
      // B3 Motor (sum=5)
      handEyeCoord: 2, fineMotor: 1, reactionTime: 2, physicalActivity: 0,
      // R1 Dopamine (sum=11) — daily farm loop is genuinely engaging
      variableRewards: 2, streakMechanics: 2, lossAversion: 0, fomoEvents: 1,
      stoppingBarriers: 2, notifications: 0, nearMiss: 0, infinitePlay: 2,
      escalatingCommitment: 1, variableRewardFreq: 1,
      // R2 Monetisation (sum=0)
      spendingCeiling: 0, payToWin: 0, currencyObfuscation: 0, spendingPrompts: 0,
      childTargeting: 0, adPressure: 0, subscriptionPressure: 0, socialSpending: 0,
      // R3 Social (sum=3)
      socialObligation: 1, competitiveToxicity: 0, strangerRisk: 1, socialComparison: 0,
      identitySelfWorth: 1, privacyRisk: 0,
      // R4 Content (E10+ for mild violence, alcohol references)
      violenceLevel: 1, sexualContent: 1, language: 0, substanceRef: 1, fearHorror: 0,
      // Practical
      estimatedMonthlyCostLow: 0, estimatedMonthlyCostHigh: 0,
      minSessionMinutes: 20, hasNaturalStoppingPoints: true, penalizesBreaks: false,
      stoppingPointsDescription: 'In-game days (roughly 12–20 real-world minutes each) provide natural session breaks. Passing out ends the day automatically. No penalty for taking days off.',
      benefitsNarrative: 'Stardew Valley is one of the most wholesome and genuinely beneficial games available. Farm planning develops spatial thinking and resource management. The relationship system builds social literacy through text-based conversations. Reading the game\'s extensive dialogue, letters, and lore develops reading habits. The game was created by a single developer over 4 years — it contains genuine craft and care, not engineered engagement.',
      risksNarrative: 'The game\'s E10+ rating reflects mild content: the saloon sells alcohol, there is a brief combat mine section, and relationship mechanics include marriage. None of this is problematic for the intended age range. The game has "one more day" pull — the farm loop is genuinely compelling — but this is design quality rather than manipulation.',
      parentTip: 'A rare game where there is essentially nothing to worry about from a monetization or safety standpoint. The E10+ rating is conservative — the content is suitable for most 8-year-olds. The mild "one more day" effect is best managed by agreeing on session boundaries before playing rather than interrupting mid-day.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 17. PORTAL 2
  //    B1=33  B2=17  B3=7  |  R1=1  R2=0  R3=4
  //    BDS=0.57  RIS=0.071  →  120 min
  // ═══════════════════════════════════════════════════════════════════════════
  {
    game: {
      slug: 'portal-2',  // Already in DB
      title: 'Portal 2',
      developer: 'Valve',
      publisher: 'Valve',
      genres: ['Puzzle', 'Platformer', 'Co-op'],
      platforms: ['PC', 'PlayStation', 'Xbox'],
      esrbRating: 'E10+',
      pegiRating: 12,
      basePrice: 9.99,
      hasMicrotransactions: false,
      hasLootBoxes: false,
      hasSubscription: false,
      hasBattlePass: false,
      requiresInternet: 'sometimes',
      hasStrangerChat: false,
      chatModeration: 'none',
      metacriticScore: 95,
      description: 'A puzzle platformer using a portal gun to navigate test chambers. Features a full co-op campaign requiring communication and cooperation to solve puzzles.',
    },
    review: {
      esrbRating: 'E10+',
      // B1 Cognitive (sum=33) — among the highest cognitive scores
      problemSolving: 5, spatialAwareness: 5, strategicThinking: 3, criticalThinking: 4,
      memoryAttention: 3, creativity: 2, readingLanguage: 2, mathSystems: 2,
      learningTransfer: 3, adaptiveChallenge: 4,
      // B2 Social-emotional (sum=17) — co-op mode particularly rich
      teamwork: 4, communication: 4, empathy: 2, emotionalRegulation: 3,
      ethicalReasoning: 1, positiveSocial: 3,
      // B3 Motor (sum=7)
      handEyeCoord: 3, fineMotor: 2, reactionTime: 2, physicalActivity: 0,
      // R1 Dopamine (sum=1) — nearly zero manipulation
      variableRewards: 0, streakMechanics: 0, lossAversion: 0, fomoEvents: 0,
      stoppingBarriers: 0, notifications: 0, nearMiss: 0, infinitePlay: 0,
      escalatingCommitment: 1, variableRewardFreq: 0,
      // R2 Monetisation (sum=0)
      spendingCeiling: 0, payToWin: 0, currencyObfuscation: 0, spendingPrompts: 0,
      childTargeting: 0, adPressure: 0, subscriptionPressure: 0, socialSpending: 0,
      // R3 Social (sum=4) — co-op requires a second person; light Steam exposure
      socialObligation: 2, competitiveToxicity: 0, strangerRisk: 1, socialComparison: 0,
      identitySelfWorth: 0, privacyRisk: 1,
      // R4 Content
      violenceLevel: 1, sexualContent: 0, language: 1, substanceRef: 0, fearHorror: 0,
      // Practical
      estimatedMonthlyCostLow: 0, estimatedMonthlyCostHigh: 0,
      minSessionMinutes: 20, hasNaturalStoppingPoints: true, penalizesBreaks: false,
      stoppingPointsDescription: 'Puzzle chambers are self-contained with auto-save between each one. Complete one chamber and stop — no progress is lost. No time pressure, no daily content.',
      benefitsNarrative: 'Portal 2 is frequently cited by educators as one of the best examples of a game that develops genuine spatial reasoning, physics intuition, and divergent problem-solving. The co-op campaign specifically requires explaining your thinking to another person — one of the most effective ways to consolidate learning. The puzzle difficulty is nearly perfectly calibrated: challenging enough to require genuine thinking, not so hard as to cause frustration.',
      risksNarrative: 'Portal 2 is as close to risk-free as a major commercial game can be. There are no monetization mechanics, no online strangers, no notifications. The mild E10+ content (cartoon violence, GLaDOS\'s dark humour) is entirely appropriate for the intended age range. The only caveat: requires Steam on PC, which exposes children to Valve\'s marketplace ecosystem.',
      parentTip: 'One of the best investments in gaming for a 10–14 year old. The co-op campaign played with a parent is exceptional — the communication and collaboration required will surprise you. Portal 2 regularly goes on sale on Steam for under $2.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 18. ROCKET LEAGUE
  //    B1=20  B2=12  B3=13  |  R1=14  R2=9  R3=10
  //    BDS=0.45  RIS=0.461  →  60 min
  // ═══════════════════════════════════════════════════════════════════════════
  {
    game: {
      slug: 'rocket-league',
      title: 'Rocket League',
      developer: 'Psyonix',
      publisher: 'Epic Games',
      genres: ['Sports', 'Vehicular', 'Competitive'],
      platforms: ['PC', 'Switch', 'PlayStation', 'Xbox'],
      esrbRating: 'E',
      pegiRating: 3,
      basePrice: 0,
      hasMicrotransactions: true,
      hasLootBoxes: false,
      hasSubscription: false,
      hasBattlePass: true,
      requiresInternet: 'always',
      hasStrangerChat: true,
      chatModeration: 'basic',
      metacriticScore: 86,
      description: 'Rocket-powered cars play soccer in this vehicular sports game. Combines high-speed driving with aerial acrobatics for a uniquely skill-expressive competitive experience.',
    },
    review: {
      esrbRating: 'E',
      // B1 Cognitive (sum=20)
      problemSolving: 2, spatialAwareness: 5, strategicThinking: 3, criticalThinking: 1,
      memoryAttention: 2, creativity: 1, readingLanguage: 0, mathSystems: 1,
      learningTransfer: 1, adaptiveChallenge: 4,
      // B2 Social-emotional (sum=12)
      teamwork: 4, communication: 3, empathy: 1, emotionalRegulation: 2,
      ethicalReasoning: 0, positiveSocial: 2,
      // B3 Motor (sum=13) — exceptionally high motor demands
      handEyeCoord: 5, fineMotor: 3, reactionTime: 5, physicalActivity: 0,
      // R1 Dopamine (sum=14)
      variableRewards: 2, streakMechanics: 2, lossAversion: 2, fomoEvents: 2,
      stoppingBarriers: 1, notifications: 1, nearMiss: 0, infinitePlay: 1,
      escalatingCommitment: 2, variableRewardFreq: 1,
      // R2 Monetisation (sum=9)
      spendingCeiling: 2, payToWin: 0, currencyObfuscation: 2, spendingPrompts: 2,
      childTargeting: 1, adPressure: 0, subscriptionPressure: 1, socialSpending: 1,
      // R3 Social (sum=10)
      socialObligation: 1, competitiveToxicity: 3, strangerRisk: 1, socialComparison: 2,
      identitySelfWorth: 2, privacyRisk: 1,
      // R4 Content
      violenceLevel: 0, sexualContent: 0, language: 1, substanceRef: 0, fearHorror: 0,
      // Practical
      estimatedMonthlyCostLow: 0, estimatedMonthlyCostHigh: 15,
      minSessionMinutes: 10, hasNaturalStoppingPoints: true, penalizesBreaks: false,
      stoppingPointsDescription: 'Matches are exactly 5 minutes. Each match has a clear endpoint. Ranked season and Rocket Pass challenges encourage ongoing engagement but don\'t penalise breaks.',
      benefitsNarrative: 'Rocket League has one of the highest skill ceilings in gaming. Aerial ball control, boost management, rotation, and 3D spatial awareness are genuinely demanding skills with years of mastery ahead. The team coordination in 3v3 requires real-time communication and trust. The short match format makes it excellent for controlled sessions.',
      risksNarrative: 'Rocket League went free-to-play in 2020 under Epic, which introduced a Credits system and item shops replacing the previous one-time-purchase model. The competitive environment, while not as toxic as some shooters, has significant unsportsmanlike behaviour with limited consequence. Quick chat is limited but players use it to taunt. Rocket Pass creates seasonal FOMO. The Credits currency obfuscates item pricing.',
      parentTip: 'The 5-minute match format makes this one of the more session-controllable competitive games — easy to agree on "3 matches then stop." Cosmetics are the only spend (no gameplay advantage). Mute all in the first month while your child learns the game.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 19. CLASH ROYALE
  //    B1=16  B2=2  B3=6  |  R1=22  R2=18  R3=10
  //    BDS=0.24  RIS=0.694  →  30 min
  // ═══════════════════════════════════════════════════════════════════════════
  {
    game: {
      slug: 'clash-royale',  // Already in DB
      title: 'Clash Royale',
      developer: 'Supercell',
      publisher: 'Supercell',
      genres: ['Strategy', 'Card', 'Mobile'],
      platforms: ['iOS', 'Android'],
      esrbRating: 'E10+',
      pegiRating: 7,
      basePrice: 0,
      hasMicrotransactions: true,
      hasLootBoxes: true,
      hasSubscription: true,
      hasBattlePass: true,
      requiresInternet: 'always',
      hasStrangerChat: false,
      chatModeration: 'none',
      metacriticScore: 74,
      description: 'A real-time multiplayer card battle game where players deploy troops to destroy the opponent\'s towers while defending their own.',
    },
    review: {
      esrbRating: 'E10+',
      // B1 Cognitive (sum=16)
      problemSolving: 2, spatialAwareness: 2, strategicThinking: 4, criticalThinking: 2,
      memoryAttention: 2, creativity: 1, readingLanguage: 0, mathSystems: 2,
      learningTransfer: 0, adaptiveChallenge: 1,
      // B2 Social-emotional (sum=2) — essentially solo despite multiplayer format
      teamwork: 0, communication: 0, empathy: 0, emotionalRegulation: 1,
      ethicalReasoning: 0, positiveSocial: 1,
      // B3 Motor (sum=6)
      handEyeCoord: 2, fineMotor: 1, reactionTime: 3, physicalActivity: 0,
      // R1 Dopamine (sum=22) — sophisticated engagement hooks
      variableRewards: 3, streakMechanics: 2, lossAversion: 3, fomoEvents: 2,
      stoppingBarriers: 1, notifications: 2, nearMiss: 1, infinitePlay: 2,
      escalatingCommitment: 3, variableRewardFreq: 3,
      // R2 Monetisation (sum=18) — pay-to-win is real
      spendingCeiling: 3, payToWin: 3, currencyObfuscation: 3, spendingPrompts: 3,
      childTargeting: 2, adPressure: 1, subscriptionPressure: 2, socialSpending: 1,
      // R3 Social (sum=10)
      socialObligation: 1, competitiveToxicity: 2, strangerRisk: 0, socialComparison: 3,
      identitySelfWorth: 2, privacyRisk: 2,
      // R4 Content
      violenceLevel: 1, sexualContent: 0, language: 0, substanceRef: 0, fearHorror: 0,
      // Practical
      estimatedMonthlyCostLow: 0, estimatedMonthlyCostHigh: 50,
      minSessionMinutes: 5, hasNaturalStoppingPoints: true, penalizesBreaks: false,
      stoppingPointsDescription: 'Battles are 3 minutes. Chest timers (2–8+ hour unlocks) create a daily check-in rhythm designed to pull players back throughout the day rather than allowing single extended sessions.',
      benefitsNarrative: 'Clash Royale has genuine strategic depth — deck building, card synergies, and real-time resource management are real cognitive demands. The 3-minute match format is short and well-defined.',
      risksNarrative: 'Clash Royale is a flagship example of mobile pay-to-win design. Card levels directly determine power — higher-level cards beat lower-level cards regardless of skill. The chest system is a variable-ratio reward schedule with deliberate timed delays designed to create multiple daily engagement events. Gem currency chains through gold, chests, and cards making cost calculation extremely difficult. Supercell has been subject to regulatory scrutiny over chest mechanics in multiple countries.',
      parentTip: 'The core gameplay loop is genuinely fun for short sessions, but the monetization is designed to exploit children. Set up the account with no payment method attached and explain clearly that upgrades happen through play, not purchase. Consider Clash Mini or Clash of Clans as alternatives with slightly less aggressive monetization.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 20. SUBWAY SURFERS
  //    B1=4  B2=1  B3=6  |  R1=19  R2=15  R3=4
  //    BDS=0.11  RIS=0.528  →  30 min base, drops to 15 min (BDS<0.20 AND RIS>0.30)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    game: {
      slug: 'subway-surfers',
      title: 'Subway Surfers',
      developer: 'Kiloo / SYBO Games',
      publisher: 'Kiloo',
      genres: ['Runner', 'Arcade', 'Mobile'],
      platforms: ['iOS', 'Android'],
      esrbRating: null,
      pegiRating: 3,
      basePrice: 0,
      hasMicrotransactions: true,
      hasLootBoxes: false,
      hasSubscription: false,
      hasBattlePass: false,
      requiresInternet: 'sometimes',
      hasStrangerChat: false,
      chatModeration: 'none',
      metacriticScore: null,
      description: 'A free-to-play endless runner game in which the player\'s character flees from a pursuing inspector and his dog across train tracks.',
    },
    review: {
      esrbRating: null,
      // B1 Cognitive (sum=4) — minimal
      problemSolving: 0, spatialAwareness: 2, strategicThinking: 0, criticalThinking: 0,
      memoryAttention: 1, creativity: 0, readingLanguage: 0, mathSystems: 0,
      learningTransfer: 0, adaptiveChallenge: 1,
      // B2 Social-emotional (sum=1)
      teamwork: 0, communication: 0, empathy: 0, emotionalRegulation: 0,
      ethicalReasoning: 0, positiveSocial: 1,
      // B3 Motor (sum=6)
      handEyeCoord: 2, fineMotor: 1, reactionTime: 3, physicalActivity: 0,
      // R1 Dopamine (sum=19)
      variableRewards: 2, streakMechanics: 2, lossAversion: 1, fomoEvents: 2,
      stoppingBarriers: 2, notifications: 2, nearMiss: 2, infinitePlay: 3,
      escalatingCommitment: 1, variableRewardFreq: 2,
      // R2 Monetisation (sum=15)
      spendingCeiling: 3, payToWin: 2, currencyObfuscation: 2, spendingPrompts: 2,
      childTargeting: 2, adPressure: 3, subscriptionPressure: 0, socialSpending: 1,
      // R3 Social (sum=4)
      socialObligation: 0, competitiveToxicity: 0, strangerRisk: 0, socialComparison: 2,
      identitySelfWorth: 0, privacyRisk: 2,
      // R4 Content
      violenceLevel: 0, sexualContent: 0, language: 0, substanceRef: 0, fearHorror: 0,
      // Practical
      estimatedMonthlyCostLow: 0, estimatedMonthlyCostHigh: 15,
      minSessionMinutes: 2, hasNaturalStoppingPoints: false, penalizesBreaks: false,
      stoppingPointsDescription: 'There is no endpoint. The runner continues until the player dies, then immediately offers a restart. No natural session boundary. Each run ends in failure by design.',
      benefitsNarrative: 'Subway Surfers develops basic reaction time and lane-switching reflexes. The colourful art style and accessible difficulty make it genuinely enjoyable in short bursts. That\'s the extent of the developmental value.',
      risksNarrative: 'Subway Surfers is an efficient engagement machine with minimal redeeming gameplay depth. The endless runner format has no natural stopping point — each death invites a retry. Aggressive advertising (interstitials, reward ads) is the main revenue mechanism. Virtual currency (Coins, Keys) and hoverboards create spending pressure. Leaderboards create social comparison pressure. This game is designed to be an attention sink.',
      parentTip: 'This is a game that earns its place as a waiting-room or travel game — short bursts are genuinely fine. The problem is when it becomes a default boredom-filler accessed dozens of times a day. Set it to be a specific-context game rather than a general-availability one.',
    },
  },

]

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function upsertGameRecord(g: GameSeed): Promise<number> {
  const [existing] = await db
    .select({ id: games.id })
    .from(games)
    .where(eq(games.slug, g.slug))
    .limit(1)

  if (existing) {
    // Update metadata fields we care about; preserve what RAWG set
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

  // Insert a new game record
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
    // B1
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
    // B2
    teamwork:             r.teamwork             ?? null,
    communication:        r.communication        ?? null,
    empathy:              r.empathy              ?? null,
    emotionalRegulation:  r.emotionalRegulation  ?? null,
    ethicalReasoning:     r.ethicalReasoning     ?? null,
    positiveSocial:       r.positiveSocial       ?? null,
    // B3
    handEyeCoord:         r.handEyeCoord         ?? null,
    fineMotor:            r.fineMotor            ?? null,
    reactionTime:         r.reactionTime         ?? null,
    physicalActivity:     r.physicalActivity     ?? null,
    // R1
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
    // R2
    spendingCeiling:      r.spendingCeiling      ?? null,
    payToWin:             r.payToWin             ?? null,
    currencyObfuscation:  r.currencyObfuscation  ?? null,
    spendingPrompts:      r.spendingPrompts      ?? null,
    childTargeting:       r.childTargeting       ?? null,
    adPressure:           r.adPressure           ?? null,
    subscriptionPressure: r.subscriptionPressure ?? null,
    socialSpending:       r.socialSpending       ?? null,
    // R3
    socialObligation:     r.socialObligation     ?? null,
    competitiveToxicity:  r.competitiveToxicity  ?? null,
    strangerRisk:         r.strangerRisk         ?? null,
    socialComparison:     r.socialComparison     ?? null,
    identitySelfWorth:    r.identitySelfWorth    ?? null,
    privacyRisk:          r.privacyRisk          ?? null,
    // R4
    violenceLevel:        r.violenceLevel        ?? null,
    sexualContent:        r.sexualContent        ?? null,
    language:             r.language             ?? null,
    substanceRef:         r.substanceRef         ?? null,
    fearHorror:           r.fearHorror           ?? null,
    // Practical
    estimatedMonthlyCostLow:   r.estimatedMonthlyCostLow  ?? null,
    estimatedMonthlyCostHigh:  r.estimatedMonthlyCostHigh ?? null,
    minSessionMinutes:         r.minSessionMinutes        ?? null,
    hasNaturalStoppingPoints:  r.hasNaturalStoppingPoints ?? null,
    penalizesBreaks:           r.penalizesBreaks          ?? null,
    stoppingPointsDescription: r.stoppingPointsDescription ?? null,
    // Narratives
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

async function upsertGameScores(gameId: number, reviewId: number, r: ReviewInput & { esrbRating?: string | null }) {
  const computed = calculateGameScores(r)

  const scoreData = {
    gameId,
    reviewId,
    cognitiveScore:       computed.cognitiveScore,
    socialEmotionalScore: computed.socialEmotionalScore,
    motorScore:           computed.motorScore,
    bds:                  computed.bds,
    dopamineRisk:         computed.dopamineRisk,
    monetizationRisk:     computed.monetizationRisk,
    socialRisk:           computed.socialRisk,
    contentRisk:          computed.contentRisk,
    ris:                  computed.ris,
    timeRecommendationMinutes:  computed.timeRecommendation.minutes,
    timeRecommendationLabel:    computed.timeRecommendation.label,
    timeRecommendationReasoning: computed.timeRecommendation.reasoning,
    timeRecommendationColor:    computed.timeRecommendation.color,
    topBenefits:          computed.topBenefits,
    calculatedAt:         new Date(),
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
  console.log('LumiKin seed-reviews — inserting expert reviews for 20 games\n')

  const results: Array<{ title: string; bds: number; ris: number; minutes: number; color: string }> = []

  for (const seed of SEEDS) {
    process.stdout.write(`  ${seed.game.title.padEnd(50)} `)

    const gameId   = await upsertGameRecord(seed.game)
    const reviewId = await upsertReview(gameId, seed.review)
    const computed = await upsertGameScores(gameId, reviewId, seed.review)

    const bds  = Math.round(computed.bds * 100)
    const ris  = Math.round(computed.ris * 100)
    const mins = computed.timeRecommendation.minutes
    const col  = computed.timeRecommendation.color

    results.push({ title: seed.game.title, bds, ris, minutes: mins, color: col })
    console.log(`BDS ${String(bds).padStart(3)}  RIS ${String(ris).padStart(3)}  ${String(mins).padStart(3)} min  [${col}]`)
  }

  console.log('\n─────────────────────────────────────────────────────────────────────')
  console.log(`✓ Seeded ${SEEDS.length} games\n`)

  // Summary table sorted by RIS ascending (safest first)
  results.sort((a, b) => a.ris - b.ris)
  console.log('  Ranking by Safety (RIS ↑)')
  console.log('  ' + '─'.repeat(62))
  for (const r of results) {
    const bar = '█'.repeat(Math.round(r.ris / 5))
    console.log(`  ${r.title.padEnd(42)} BDS ${String(r.bds).padStart(3)}  RIS ${String(r.ris).padStart(3)}  ${r.minutes}min`)
  }
}

main().catch(err => {
  console.error('\n✗ Seed failed:', err)
  process.exit(1)
})
