// Risk Intensity Score (RIS) calculation.
// RIS = (R1_norm × 0.45) + (R2_norm × 0.30) + (R3_norm × 0.25)
//
// R4 (content risk) is normalised and returned for display purposes only —
// it does NOT feed into RIS or the time recommendation tier.

import type { ReviewInput, RiskResult } from './types'

const v = (n: number | null | undefined): number => n ?? 0

// ─── Category sums ────────────────────────────────────────────────────────────

// R1: Dopamine manipulation — 10 items × max 3 = max 30
const R1_MAX = 30
function sumR1(r: ReviewInput): number {
  return (
    v(r.variableRewards) +
    v(r.streakMechanics) +
    v(r.lossAversion) +
    v(r.fomoEvents) +
    v(r.stoppingBarriers) +
    v(r.notifications) +
    v(r.nearMiss) +
    v(r.infinitePlay) +
    v(r.escalatingCommitment) +
    v(r.variableRewardFreq)
  )
}

// R2: Monetisation pressure — 8 items × max 3 = max 24
const R2_MAX = 24
function sumR2(r: ReviewInput): number {
  return (
    v(r.spendingCeiling) +
    v(r.payToWin) +
    v(r.currencyObfuscation) +
    v(r.spendingPrompts) +
    v(r.childTargeting) +
    v(r.adPressure) +
    v(r.subscriptionPressure) +
    v(r.socialSpending)
  )
}

// R3: Social risk — 6 items × max 3 = max 18
const R3_MAX = 18
function sumR3(r: ReviewInput): number {
  return (
    v(r.socialObligation) +
    v(r.competitiveToxicity) +
    v(r.strangerRisk) +
    v(r.socialComparison) +
    v(r.identitySelfWorth) +
    v(r.privacyRisk)
  )
}

// R4: Content risk — 5 items × max 3 = max 15 (display only)
const R4_MAX = 15
function sumR4(r: ReviewInput): number {
  return (
    v(r.violenceLevel) +
    v(r.sexualContent) +
    v(r.language) +
    v(r.substanceRef) +
    v(r.fearHorror)
  )
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function calculateRIS(review: ReviewInput): RiskResult {
  const dopamine = sumR1(review) / R1_MAX
  const monetization = sumR2(review) / R2_MAX
  const social = sumR3(review) / R3_MAX
  const contentRisk = sumR4(review) / R4_MAX
  const ris = dopamine * 0.45 + monetization * 0.3 + social * 0.25
  return { dopamine, monetization, social, contentRisk, ris }
}
