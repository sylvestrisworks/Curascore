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
    timeRecommendation,
    topBenefits,
  }
}
