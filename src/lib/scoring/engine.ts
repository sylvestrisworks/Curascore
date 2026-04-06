// Main scoring engine entry point.
// calculateGameScores(review) → GameScoresResult ready to persist to game_scores table.

import { calculateBDS, getTopBenefits } from './benefits'
import { calculateRIS } from './risks'
import { deriveTimeRecommendation } from './time'
import type { GameScoresResult, ReviewInput } from './types'

export function calculateGameScores(review: ReviewInput): GameScoresResult {
  const benefits = calculateBDS(review)
  const risks = calculateRIS(review)
  const timeRecommendation = deriveTimeRecommendation(
    risks.ris,
    benefits.bds,
    risks.contentRisk,
    review.esrbRating,
  )
  const topBenefits = getTopBenefits(review)

  // Curascore: harmonic mean of Benefit (BDS) and Safety (1 - RIS), scaled 0–100.
  // Penalises games that are high-risk OR low-benefit — both must be good to score well.
  const safety = 1 - risks.ris
  const denom = benefits.bds + safety
  const curascore = denom > 0
    ? Math.round((2 * benefits.bds * safety) / denom * 100)
    : 0

  return {
    cognitiveScore:      benefits.cognitive,
    socialEmotionalScore: benefits.socialEmotional,
    motorScore:          benefits.motor,
    bds:                 benefits.bds,
    dopamineRisk:        risks.dopamine,
    monetizationRisk:    risks.monetization,
    socialRisk:          risks.social,
    contentRisk:         risks.contentRisk,
    ris:                 risks.ris,
    curascore,
    timeRecommendation,
    topBenefits,
  }
}
