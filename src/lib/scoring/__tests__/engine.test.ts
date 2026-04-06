// Scoring engine tests.
//
// Named fixture inputs are engineered to represent each real-world game and
// produce the expected time tier given the formula in CLAUDE.md.
//
// NOTE on Zelda TotK: the formula (RIS 0–0.15 → 120 min) means a purely
// low-risk game would score 120 min. The fixture below deliberately includes
// Zelda's mild engagement loops (exploration, upgrade pacing) giving RIS ~0.18,
// which puts it correctly in the 90 min tier.

import { describe, expect, test } from 'vitest'
import { calculateGameScores } from '../engine'
import { calculateBDS } from '../benefits'
import { calculateRIS } from '../risks'
import { deriveTimeRecommendation } from '../time'
import type { ReviewInput } from '../types'

// ─── Named game fixtures ──────────────────────────────────────────────────────
//
// All sub-scores: benefits are 0–5, risks are 0–3.
// Calculated values noted inline for verification.

const zeldaTotkReview: ReviewInput = {
  // B1 = 36/50 = 0.720, B2 = 14/30 = 0.467, B3 = 9/20 = 0.450
  // BDS = 0.720×0.50 + 0.467×0.30 + 0.450×0.20 = 0.360 + 0.140 + 0.090 = 0.590
  problemSolving: 5, spatialAwareness: 4, strategicThinking: 4, criticalThinking: 4,
  memoryAttention: 3, creativity: 5, readingLanguage: 2, mathSystems: 2,
  learningTransfer: 3, adaptiveChallenge: 4,
  teamwork: 1, communication: 2, empathy: 3, emotionalRegulation: 3,
  ethicalReasoning: 3, positiveSocial: 2,
  handEyeCoord: 3, fineMotor: 3, reactionTime: 3, physicalActivity: 0,

  // R1 = 11/30 = 0.367, R2 = 0/24 = 0.000, R3 = 1/18 = 0.056
  // RIS = 0.367×0.45 + 0.000×0.30 + 0.056×0.25 = 0.165 + 0.000 + 0.014 = 0.179
  variableRewards: 2, streakMechanics: 1, lossAversion: 1, fomoEvents: 0,
  stoppingBarriers: 2, notifications: 0, nearMiss: 0, infinitePlay: 2,
  escalatingCommitment: 1, variableRewardFreq: 2,
  spendingCeiling: 0, payToWin: 0, currencyObfuscation: 0, spendingPrompts: 0,
  childTargeting: 0, adPressure: 0, subscriptionPressure: 0, socialSpending: 0,
  socialObligation: 0, competitiveToxicity: 0, strangerRisk: 0, socialComparison: 0,
  identitySelfWorth: 1, privacyRisk: 0,
  violenceLevel: 1, sexualContent: 0, language: 0, substanceRef: 0, fearHorror: 1,
  // Expected: RIS ≈ 0.179 → tier 1 (90 min), BDS 0.59 < 0.60 (no extension) → 90 min, green
}

const genshinImpactReview: ReviewInput = {
  // B1 = 22/50 = 0.440, B2 = 10/30 = 0.333, B3 = 9/20 = 0.450
  // BDS = 0.440×0.50 + 0.333×0.30 + 0.450×0.20 = 0.220 + 0.100 + 0.090 = 0.410
  problemSolving: 3, spatialAwareness: 3, strategicThinking: 2, criticalThinking: 2,
  memoryAttention: 3, creativity: 2, readingLanguage: 3, mathSystems: 2,
  learningTransfer: 1, adaptiveChallenge: 1,
  teamwork: 2, communication: 2, empathy: 2, emotionalRegulation: 1,
  ethicalReasoning: 1, positiveSocial: 2,
  handEyeCoord: 4, fineMotor: 2, reactionTime: 3, physicalActivity: 0,

  // R1 = 23/30 = 0.767, R2 = 15/24 = 0.625, R3 = 10/18 = 0.556
  // RIS = 0.767×0.45 + 0.625×0.30 + 0.556×0.25 = 0.345 + 0.188 + 0.139 = 0.672
  variableRewards: 3, streakMechanics: 2, lossAversion: 2, fomoEvents: 3,
  stoppingBarriers: 2, notifications: 2, nearMiss: 3, infinitePlay: 2,
  escalatingCommitment: 2, variableRewardFreq: 2,
  spendingCeiling: 3, payToWin: 1, currencyObfuscation: 3, spendingPrompts: 3,
  childTargeting: 2, adPressure: 0, subscriptionPressure: 1, socialSpending: 2,
  socialObligation: 2, competitiveToxicity: 1, strangerRisk: 1, socialComparison: 3,
  identitySelfWorth: 2, privacyRisk: 1,
  violenceLevel: 1, sexualContent: 1, language: 0, substanceRef: 0, fearHorror: 0,
  // Expected: RIS ≈ 0.672 → tier 3 (30 min), BDS 0.41 < 0.60 (no extension) → 30 min, amber
}

const minecraftNoMarketplaceReview: ReviewInput = {
  // B1 = 35/50 = 0.700, B2 = 17/30 = 0.567, B3 = 8/20 = 0.400
  // BDS = 0.700×0.50 + 0.567×0.30 + 0.400×0.20 = 0.350 + 0.170 + 0.080 = 0.600
  problemSolving: 4, spatialAwareness: 5, strategicThinking: 3, criticalThinking: 3,
  memoryAttention: 2, creativity: 5, readingLanguage: 1, mathSystems: 3,
  learningTransfer: 4, adaptiveChallenge: 5,
  teamwork: 4, communication: 3, empathy: 2, emotionalRegulation: 3,
  ethicalReasoning: 2, positiveSocial: 3,
  handEyeCoord: 3, fineMotor: 3, reactionTime: 2, physicalActivity: 0,

  // R1 = 7/30 = 0.233, R2 = 0/24 = 0.000, R3 = 2/18 = 0.111
  // RIS = 0.233×0.45 + 0.000×0.30 + 0.111×0.25 = 0.105 + 0.000 + 0.028 = 0.133
  variableRewards: 1, streakMechanics: 0, lossAversion: 1, fomoEvents: 0,
  stoppingBarriers: 0, notifications: 0, nearMiss: 0, infinitePlay: 2,
  escalatingCommitment: 1, variableRewardFreq: 2,
  spendingCeiling: 0, payToWin: 0, currencyObfuscation: 0, spendingPrompts: 0,
  childTargeting: 0, adPressure: 0, subscriptionPressure: 0, socialSpending: 0,
  socialObligation: 0, competitiveToxicity: 1, strangerRisk: 1, socialComparison: 0,
  identitySelfWorth: 0, privacyRisk: 0,
  violenceLevel: 1, sexualContent: 0, language: 0, substanceRef: 0, fearHorror: 0,
  // Expected: RIS ≈ 0.133 → tier 0 (120 min base), BDS 0.60 ≥ 0.60 extends
  // (but base is already tier 0 — clamped) → 120 min, green
}

const gtaOnlineReview: ReviewInput = {
  // B1 = 19/50 = 0.380, B2 = 8/30 = 0.267, B3 = 10/20 = 0.500
  // BDS = 0.380×0.50 + 0.267×0.30 + 0.500×0.20 = 0.190 + 0.080 + 0.100 = 0.370
  problemSolving: 2, spatialAwareness: 3, strategicThinking: 2, criticalThinking: 2,
  memoryAttention: 1, creativity: 2, readingLanguage: 0, mathSystems: 2,
  learningTransfer: 2, adaptiveChallenge: 3,
  teamwork: 3, communication: 2, empathy: 0, emotionalRegulation: 0,
  ethicalReasoning: 0, positiveSocial: 3,
  handEyeCoord: 4, fineMotor: 2, reactionTime: 4, physicalActivity: 0,

  // R1 = 25/30 = 0.833, R2 = 14/24 = 0.583, R3 = 13/18 = 0.722
  // RIS = 0.833×0.45 + 0.583×0.30 + 0.722×0.25 = 0.375 + 0.175 + 0.181 = 0.731
  variableRewards: 3, streakMechanics: 2, lossAversion: 3, fomoEvents: 3,
  stoppingBarriers: 2, notifications: 3, nearMiss: 2, infinitePlay: 3,
  escalatingCommitment: 2, variableRewardFreq: 2,
  spendingCeiling: 2, payToWin: 3, currencyObfuscation: 2, spendingPrompts: 3,
  childTargeting: 1, adPressure: 0, subscriptionPressure: 1, socialSpending: 2,
  socialObligation: 2, competitiveToxicity: 3, strangerRisk: 2, socialComparison: 2,
  identitySelfWorth: 2, privacyRisk: 2,
  violenceLevel: 3, sexualContent: 1, language: 2, substanceRef: 2, fearHorror: 0,
  esrbRating: 'M',
  // Expected: RIS ≈ 0.731 → tier 4 (not recommended), BDS 0.37 — extension blocked
  // (RIS > 0.70) → not recommended, red
}

const splitFictionReview: ReviewInput = {
  // B1 = 33/50 = 0.660, B2 = 19/30 = 0.633, B3 = 9/20 = 0.450
  // BDS = 0.660×0.50 + 0.633×0.30 + 0.450×0.20 = 0.330 + 0.190 + 0.090 = 0.610
  problemSolving: 5, spatialAwareness: 3, strategicThinking: 3, criticalThinking: 4,
  memoryAttention: 3, creativity: 4, readingLanguage: 3, mathSystems: 2,
  learningTransfer: 3, adaptiveChallenge: 3,
  teamwork: 5, communication: 5, empathy: 3, emotionalRegulation: 2,
  ethicalReasoning: 2, positiveSocial: 2,
  handEyeCoord: 3, fineMotor: 2, reactionTime: 3, physicalActivity: 1,

  // R1 = 3/30 = 0.100, R2 = 0/24 = 0.000, R3 = 0/18 = 0.000
  // RIS = 0.100×0.45 + 0.000×0.30 + 0.000×0.25 = 0.045
  variableRewards: 0, streakMechanics: 1, lossAversion: 0, fomoEvents: 0,
  stoppingBarriers: 0, notifications: 0, nearMiss: 0, infinitePlay: 1,
  escalatingCommitment: 0, variableRewardFreq: 1,
  spendingCeiling: 0, payToWin: 0, currencyObfuscation: 0, spendingPrompts: 0,
  childTargeting: 0, adPressure: 0, subscriptionPressure: 0, socialSpending: 0,
  socialObligation: 0, competitiveToxicity: 0, strangerRisk: 0, socialComparison: 0,
  identitySelfWorth: 0, privacyRisk: 0,
  violenceLevel: 1, sexualContent: 0, language: 0, substanceRef: 0, fearHorror: 0,
  // Expected: RIS ≈ 0.045 → tier 0 (120 min), BDS 0.61 ≥ 0.60 extends
  // (already at max, clamped) → 120 min, green
}

// ─── calculateBDS ─────────────────────────────────────────────────────────────

describe('calculateBDS', () => {
  test('all-zero input returns 0', () => {
    expect(calculateBDS({}).bds).toBe(0)
  })

  test('all-max input (every benefit = 5) returns 1', () => {
    const allMax: ReviewInput = {
      problemSolving: 5, spatialAwareness: 5, strategicThinking: 5, criticalThinking: 5,
      memoryAttention: 5, creativity: 5, readingLanguage: 5, mathSystems: 5,
      learningTransfer: 5, adaptiveChallenge: 5,
      teamwork: 5, communication: 5, empathy: 5, emotionalRegulation: 5,
      ethicalReasoning: 5, positiveSocial: 5,
      handEyeCoord: 5, fineMotor: 5, reactionTime: 5, physicalActivity: 5,
    }
    expect(calculateBDS(allMax).bds).toBeCloseTo(1, 5)
    expect(calculateBDS(allMax).cognitive).toBeCloseTo(1, 5)
    expect(calculateBDS(allMax).socialEmotional).toBeCloseTo(1, 5)
    expect(calculateBDS(allMax).motor).toBeCloseTo(1, 5)
  })

  test('weights: B1 = 50%, B2 = 30%, B3 = 20%', () => {
    // Only B1 at max → BDS = 1.0 × 0.50 = 0.50
    const onlyB1: ReviewInput = {
      problemSolving: 5, spatialAwareness: 5, strategicThinking: 5, criticalThinking: 5,
      memoryAttention: 5, creativity: 5, readingLanguage: 5, mathSystems: 5,
      learningTransfer: 5, adaptiveChallenge: 5,
    }
    expect(calculateBDS(onlyB1).bds).toBeCloseTo(0.5, 5)

    // Only B2 at max → BDS = 1.0 × 0.30 = 0.30
    const onlyB2: ReviewInput = {
      teamwork: 5, communication: 5, empathy: 5, emotionalRegulation: 5,
      ethicalReasoning: 5, positiveSocial: 5,
    }
    expect(calculateBDS(onlyB2).bds).toBeCloseTo(0.3, 5)

    // Only B3 at max → BDS = 1.0 × 0.20 = 0.20
    const onlyB3: ReviewInput = {
      handEyeCoord: 5, fineMotor: 5, reactionTime: 5, physicalActivity: 5,
    }
    expect(calculateBDS(onlyB3).bds).toBeCloseTo(0.2, 5)
  })

  test('null scores are treated as 0', () => {
    expect(calculateBDS({ problemSolving: null }).bds).toBe(0)
  })

  test('Zelda TotK BDS ≈ 0.59', () => {
    const { bds, cognitive, socialEmotional, motor } = calculateBDS(zeldaTotkReview)
    expect(cognitive).toBeCloseTo(0.72, 2)
    expect(socialEmotional).toBeCloseTo(0.467, 2)
    expect(motor).toBeCloseTo(0.45, 2)
    expect(bds).toBeCloseTo(0.59, 2)
  })

  test('Minecraft BDS = exactly 0.60', () => {
    expect(calculateBDS(minecraftNoMarketplaceReview).bds).toBeCloseTo(0.6, 4)
  })

  test('Split Fiction BDS ≈ 0.61', () => {
    expect(calculateBDS(splitFictionReview).bds).toBeCloseTo(0.61, 2)
  })
})

// ─── calculateRIS ─────────────────────────────────────────────────────────────

describe('calculateRIS', () => {
  test('all-zero input returns 0', () => {
    expect(calculateRIS({}).ris).toBe(0)
  })

  test('all-max input (every risk = 3) returns 1', () => {
    const allMax: ReviewInput = {
      variableRewards: 3, streakMechanics: 3, lossAversion: 3, fomoEvents: 3,
      stoppingBarriers: 3, notifications: 3, nearMiss: 3, infinitePlay: 3,
      escalatingCommitment: 3, variableRewardFreq: 3,
      spendingCeiling: 3, payToWin: 3, currencyObfuscation: 3, spendingPrompts: 3,
      childTargeting: 3, adPressure: 3, subscriptionPressure: 3, socialSpending: 3,
      socialObligation: 3, competitiveToxicity: 3, strangerRisk: 3, socialComparison: 3,
      identitySelfWorth: 3, privacyRisk: 3,
      violenceLevel: 3, sexualContent: 3, language: 3, substanceRef: 3, fearHorror: 3,
    }
    expect(calculateRIS(allMax).ris).toBeCloseTo(1, 5)
  })

  test('weights: R1 = 45%, R2 = 30%, R3 = 25%', () => {
    // Only R1 at max → RIS = 1.0 × 0.45 = 0.45
    const onlyR1: ReviewInput = {
      variableRewards: 3, streakMechanics: 3, lossAversion: 3, fomoEvents: 3,
      stoppingBarriers: 3, notifications: 3, nearMiss: 3, infinitePlay: 3,
      escalatingCommitment: 3, variableRewardFreq: 3,
    }
    expect(calculateRIS(onlyR1).ris).toBeCloseTo(0.45, 5)

    // Only R2 at max → RIS = 1.0 × 0.30 = 0.30
    const onlyR2: ReviewInput = {
      spendingCeiling: 3, payToWin: 3, currencyObfuscation: 3, spendingPrompts: 3,
      childTargeting: 3, adPressure: 3, subscriptionPressure: 3, socialSpending: 3,
    }
    expect(calculateRIS(onlyR2).ris).toBeCloseTo(0.3, 5)

    // Only R3 at max → RIS = 1.0 × 0.25 = 0.25
    const onlyR3: ReviewInput = {
      socialObligation: 3, competitiveToxicity: 3, strangerRisk: 3,
      socialComparison: 3, identitySelfWorth: 3, privacyRisk: 3,
    }
    expect(calculateRIS(onlyR3).ris).toBeCloseTo(0.25, 5)
  })

  test('R4 does not affect RIS', () => {
    const withR4: ReviewInput = {
      violenceLevel: 3, sexualContent: 3, language: 3, substanceRef: 3, fearHorror: 3,
    }
    const withoutR4: ReviewInput = {}
    expect(calculateRIS(withR4).ris).toBe(calculateRIS(withoutR4).ris)
  })

  test('R4 is normalised and returned separately as contentRisk', () => {
    const r: ReviewInput = {
      violenceLevel: 3, sexualContent: 3, language: 3, substanceRef: 3, fearHorror: 3,
    }
    expect(calculateRIS(r).contentRisk).toBeCloseTo(1, 5)
    expect(calculateRIS(r).ris).toBe(0)
  })

  test('Zelda TotK RIS ≈ 0.179', () => {
    expect(calculateRIS(zeldaTotkReview).ris).toBeCloseTo(0.179, 2)
  })

  test('Genshin Impact RIS ≈ 0.672', () => {
    expect(calculateRIS(genshinImpactReview).ris).toBeCloseTo(0.672, 2)
  })

  test('GTA Online RIS ≈ 0.731', () => {
    expect(calculateRIS(gtaOnlineReview).ris).toBeCloseTo(0.731, 2)
  })

  test('Split Fiction RIS ≈ 0.045', () => {
    expect(calculateRIS(splitFictionReview).ris).toBeCloseTo(0.045, 3)
  })
})

// ─── deriveTimeRecommendation — base tiers ────────────────────────────────────

describe('deriveTimeRecommendation — base tiers', () => {
  const bdsNeutral = 0.4 // between 0.20 and 0.60: no adjustment

  test('RIS 0.00 → 120 min', () => {
    expect(deriveTimeRecommendation(0.0, bdsNeutral, 0).minutes).toBe(120)
  })

  test('RIS 0.15 → 120 min (upper boundary)', () => {
    expect(deriveTimeRecommendation(0.15, bdsNeutral, 0).minutes).toBe(120)
  })

  test('RIS 0.16 → 90 min (lower boundary of tier 2)', () => {
    expect(deriveTimeRecommendation(0.16, bdsNeutral, 0).minutes).toBe(90)
  })

  test('RIS 0.30 → 90 min (upper boundary of tier 2)', () => {
    expect(deriveTimeRecommendation(0.30, bdsNeutral, 0).minutes).toBe(90)
  })

  test('RIS 0.31 → 60 min', () => {
    expect(deriveTimeRecommendation(0.31, bdsNeutral, 0).minutes).toBe(60)
  })

  test('RIS 0.50 → 60 min (upper boundary)', () => {
    expect(deriveTimeRecommendation(0.50, bdsNeutral, 0).minutes).toBe(60)
  })

  test('RIS 0.51 → 30 min', () => {
    expect(deriveTimeRecommendation(0.51, bdsNeutral, 0).minutes).toBe(30)
  })

  test('RIS 0.70 → 30 min (upper boundary)', () => {
    expect(deriveTimeRecommendation(0.70, bdsNeutral, 0).minutes).toBe(30)
  })

  test('RIS 0.71 → 15 min / not recommended', () => {
    const result = deriveTimeRecommendation(0.71, bdsNeutral, 0)
    expect(result.minutes).toBe(15)
    expect(result.color).toBe('red')
    expect(result.label).toMatch(/not recommended/i)
  })

  test('RIS 1.00 → 15 min / not recommended', () => {
    expect(deriveTimeRecommendation(1.0, bdsNeutral, 0).minutes).toBe(15)
  })

  test('color is green for ≤ 90 min', () => {
    expect(deriveTimeRecommendation(0.0, bdsNeutral, 0).color).toBe('green')
    expect(deriveTimeRecommendation(0.30, bdsNeutral, 0).color).toBe('green')
  })

  test('color is amber for 30–60 min', () => {
    expect(deriveTimeRecommendation(0.31, bdsNeutral, 0).color).toBe('amber')
    expect(deriveTimeRecommendation(0.70, bdsNeutral, 0).color).toBe('amber')
  })

  test('color is red for not recommended', () => {
    expect(deriveTimeRecommendation(0.71, bdsNeutral, 0).color).toBe('red')
  })
})

// ─── deriveTimeRecommendation — BDS extension ─────────────────────────────────

describe('deriveTimeRecommendation — BDS extension', () => {
  test('BDS exactly 0.60 extends 90 min → 120 min', () => {
    // RIS 0.20 → base 90 min; BDS 0.60 ≥ 0.60 → extends to 120 min
    expect(deriveTimeRecommendation(0.20, 0.60, 0).minutes).toBe(120)
    expect(deriveTimeRecommendation(0.20, 0.60, 0).color).toBe('green')
  })

  test('BDS 0.60 extends 60 min → 90 min', () => {
    expect(deriveTimeRecommendation(0.40, 0.60, 0).minutes).toBe(90)
  })

  test('BDS 0.60 extends 30 min → 60 min', () => {
    expect(deriveTimeRecommendation(0.60, 0.60, 0).minutes).toBe(60)
  })

  test('BDS 0.60 cannot extend beyond 120 min (clamped)', () => {
    // RIS 0.10 → base 120 min; already at best tier, extension is a no-op
    expect(deriveTimeRecommendation(0.10, 0.60, 0).minutes).toBe(120)
  })

  test('BDS 0.59 does NOT trigger extension', () => {
    // RIS 0.20 → base 90 min; BDS 0.59 < 0.60 → stays at 90 min
    expect(deriveTimeRecommendation(0.20, 0.59, 0).minutes).toBe(90)
  })

  test('BDS 0.90 extends correctly', () => {
    expect(deriveTimeRecommendation(0.20, 0.90, 0).minutes).toBe(120)
  })
})

// ─── deriveTimeRecommendation — RIS override blocks extension ─────────────────

describe('deriveTimeRecommendation — RIS > 0.70 blocks BDS extension', () => {
  test('RIS exactly 0.71 with BDS 0.70 → still not recommended', () => {
    const result = deriveTimeRecommendation(0.71, 0.70, 0)
    expect(result.minutes).toBe(15)
    expect(result.color).toBe('red')
  })

  test('RIS 0.80 with BDS 0.90 → not recommended (extension blocked)', () => {
    expect(deriveTimeRecommendation(0.80, 0.90, 0).minutes).toBe(15)
  })

  test('RIS 0.70 with BDS 0.70 → extension applies (boundary: ≤ 0.70)', () => {
    // RIS 0.70 → base tier 3 (30 min); BDS 0.70 ≥ 0.60 and RIS = 0.70 ≤ 0.70 → extend → 60 min
    expect(deriveTimeRecommendation(0.70, 0.70, 0).minutes).toBe(60)
  })
})

// ─── deriveTimeRecommendation — BDS drop ──────────────────────────────────────

describe('deriveTimeRecommendation — BDS < 0.20 AND RIS > 0.30 drops one tier', () => {
  test('BDS 0.10, RIS 0.36 → 60 min base drops to 30 min', () => {
    // RIS 0.36 → tier 2 (60 min); drop → tier 3 (30 min)
    expect(deriveTimeRecommendation(0.36, 0.10, 0).minutes).toBe(30)
    expect(deriveTimeRecommendation(0.36, 0.10, 0).color).toBe('amber')
  })

  test('BDS 0.10, RIS 0.20 → drop does NOT apply (RIS not > 0.30)', () => {
    // RIS 0.20 → tier 1 (90 min); no drop
    expect(deriveTimeRecommendation(0.20, 0.10, 0).minutes).toBe(90)
  })

  test('BDS 0.20 → drop does NOT apply (boundary: must be strictly < 0.20)', () => {
    expect(deriveTimeRecommendation(0.36, 0.20, 0).minutes).toBe(60)
  })

  test('BDS 0.10, RIS 0.90 → already at not-recommended, drop clamped', () => {
    // RIS 0.90 → tier 4 (15 min/not recommended); drop clamped to tier 4
    expect(deriveTimeRecommendation(0.90, 0.10, 0).minutes).toBe(15)
  })
})

// ─── deriveTimeRecommendation — age rating label ──────────────────────────────

describe('deriveTimeRecommendation — age rating label', () => {
  test('ESRB M rating produces "not recommended under 17" label', () => {
    const result = deriveTimeRecommendation(0.80, 0.30, 0, 'M')
    expect(result.label.toLowerCase()).toContain('under 17')
  })

  test('ESRB AO rating produces "not recommended under 17" label', () => {
    const result = deriveTimeRecommendation(0.80, 0.30, 0, 'AO')
    expect(result.label.toLowerCase()).toContain('under 17')
  })

  test('No age rating produces generic label', () => {
    const result = deriveTimeRecommendation(0.80, 0.30, 0)
    expect(result.label.toLowerCase()).toContain('not recommended')
    expect(result.label.toLowerCase()).not.toContain('under 17')
  })
})

// ─── Named fixture integration tests ─────────────────────────────────────────

describe('calculateGameScores — named fixtures', () => {
  test('Zelda: Tears of the Kingdom → 90 min, green', () => {
    const result = calculateGameScores(zeldaTotkReview)
    expect(result.timeRecommendation.minutes).toBe(90)
    expect(result.timeRecommendation.color).toBe('green')
    expect(result.ris).toBeCloseTo(0.179, 2)
    expect(result.bds).toBeCloseTo(0.59, 2)
  })

  test('Genshin Impact → 30 min, amber', () => {
    const result = calculateGameScores(genshinImpactReview)
    expect(result.timeRecommendation.minutes).toBe(30)
    expect(result.timeRecommendation.color).toBe('amber')
    expect(result.ris).toBeCloseTo(0.672, 2)
    expect(result.bds).toBeCloseTo(0.41, 2)
  })

  test('Minecraft (no marketplace) → 120 min, green', () => {
    const result = calculateGameScores(minecraftNoMarketplaceReview)
    expect(result.timeRecommendation.minutes).toBe(120)
    expect(result.timeRecommendation.color).toBe('green')
    expect(result.ris).toBeCloseTo(0.133, 2)
    expect(result.bds).toBeCloseTo(0.60, 2)
  })

  test('GTA Online → not recommended, red', () => {
    const result = calculateGameScores(gtaOnlineReview)
    expect(result.timeRecommendation.minutes).toBe(15)
    expect(result.timeRecommendation.color).toBe('red')
    expect(result.timeRecommendation.label).toMatch(/not recommended/i)
    expect(result.ris).toBeCloseTo(0.731, 2)
    expect(result.bds).toBeCloseTo(0.37, 2)
  })

  test('Split Fiction → 120 min, green', () => {
    const result = calculateGameScores(splitFictionReview)
    expect(result.timeRecommendation.minutes).toBe(120)
    expect(result.timeRecommendation.color).toBe('green')
    expect(result.ris).toBeCloseTo(0.045, 3)
    expect(result.bds).toBeCloseTo(0.61, 2)
  })
})

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('edge cases', () => {
  test('all-zero review → 120 min, green', () => {
    const result = calculateGameScores({})
    expect(result.bds).toBe(0)
    expect(result.ris).toBe(0)
    expect(result.timeRecommendation.minutes).toBe(120)
    expect(result.timeRecommendation.color).toBe('green')
    // BDS 0 < 0.20 but RIS 0 ≤ 0.30 → drop rule NOT triggered
  })

  test('all-max review → not recommended, red', () => {
    const allMax: ReviewInput = {
      problemSolving: 5, spatialAwareness: 5, strategicThinking: 5, criticalThinking: 5,
      memoryAttention: 5, creativity: 5, readingLanguage: 5, mathSystems: 5,
      learningTransfer: 5, adaptiveChallenge: 5,
      teamwork: 5, communication: 5, empathy: 5, emotionalRegulation: 5,
      ethicalReasoning: 5, positiveSocial: 5,
      handEyeCoord: 5, fineMotor: 5, reactionTime: 5, physicalActivity: 5,
      variableRewards: 3, streakMechanics: 3, lossAversion: 3, fomoEvents: 3,
      stoppingBarriers: 3, notifications: 3, nearMiss: 3, infinitePlay: 3,
      escalatingCommitment: 3, variableRewardFreq: 3,
      spendingCeiling: 3, payToWin: 3, currencyObfuscation: 3, spendingPrompts: 3,
      childTargeting: 3, adPressure: 3, subscriptionPressure: 3, socialSpending: 3,
      socialObligation: 3, competitiveToxicity: 3, strangerRisk: 3, socialComparison: 3,
      identitySelfWorth: 3, privacyRisk: 3,
      violenceLevel: 3, sexualContent: 3, language: 3, substanceRef: 3, fearHorror: 3,
    }
    const result = calculateGameScores(allMax)
    expect(result.bds).toBeCloseTo(1, 4)
    expect(result.ris).toBeCloseTo(1, 4)
    // BDS ≥ 0.60 would extend, but RIS > 0.70 blocks it
    expect(result.timeRecommendation.minutes).toBe(15)
    expect(result.timeRecommendation.color).toBe('red')
  })

  test('BDS extension threshold: exactly 0.60 extends 90 min tier to 120 min', () => {
    // Construct inputs that give BDS exactly 0.60 and RIS in the 90 min tier
    // B1=35/50=0.700, B2=17/30=0.567, B3=8/20=0.400 → BDS=0.350+0.170+0.080=0.600
    // R1=12/30=0.400, R2=0, R3=0 → RIS=0.400×0.45=0.180
    const review: ReviewInput = {
      problemSolving: 4, spatialAwareness: 5, strategicThinking: 3, criticalThinking: 3,
      memoryAttention: 2, creativity: 5, readingLanguage: 1, mathSystems: 3,
      learningTransfer: 4, adaptiveChallenge: 5,
      teamwork: 4, communication: 3, empathy: 2, emotionalRegulation: 3,
      ethicalReasoning: 2, positiveSocial: 3,
      handEyeCoord: 3, fineMotor: 3, reactionTime: 2, physicalActivity: 0,
      variableRewards: 2, streakMechanics: 1, lossAversion: 2, fomoEvents: 1,
      stoppingBarriers: 2, notifications: 0, nearMiss: 0, infinitePlay: 2,
      escalatingCommitment: 1, variableRewardFreq: 1,
    }
    const result = calculateGameScores(review)
    expect(result.bds).toBeCloseTo(0.60, 3)
    expect(result.ris).toBeCloseTo(0.18, 2)
    expect(result.timeRecommendation.minutes).toBe(120) // extended from 90
    expect(result.timeRecommendation.color).toBe('green')
  })

  test('risk override: RIS exactly 0.71 blocks BDS ≥ 0.60 extension', () => {
    // BDS 0.60, RIS 0.731 (> 0.70) → extension is blocked → not recommended
    const result = calculateGameScores(gtaOnlineReview) // RIS ≈ 0.731, BDS < 0.60 anyway
    expect(result.ris).toBeGreaterThan(0.70)
    expect(result.timeRecommendation.minutes).toBe(15)

    // Explicit: high BDS, high RIS — extension must still be blocked
    const highBdsHighRis = deriveTimeRecommendation(0.731, 0.80, 0)
    expect(highBdsHighRis.minutes).toBe(15)
    expect(highBdsHighRis.color).toBe('red')
  })

  test('topBenefits returns up to 5 skills sorted by score descending', () => {
    const result = calculateGameScores(splitFictionReview)
    expect(result.topBenefits.length).toBeLessThanOrEqual(5)
    for (let i = 1; i < result.topBenefits.length; i++) {
      expect(result.topBenefits[i - 1].score).toBeGreaterThanOrEqual(
        result.topBenefits[i].score,
      )
    }
  })

  test('topBenefits excludes zero-score skills', () => {
    const result = calculateGameScores({
      problemSolving: 5,
      teamwork: 3,
      // all others unset
    })
    expect(result.topBenefits.every((b) => b.score > 0)).toBe(true)
  })
})
