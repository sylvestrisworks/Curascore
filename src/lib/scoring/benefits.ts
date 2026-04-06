// Benefit Development Score (BDS) calculation.
// BDS = (B1_norm × 0.50) + (B2_norm × 0.30) + (B3_norm × 0.20)

import type { BenefitResult, ReviewInput, TopBenefit } from './types'

// Null-safe score getter — missing sub-scores count as 0.
const v = (n: number | null | undefined): number => n ?? 0

// ─── Category sums ────────────────────────────────────────────────────────────

// B1: Cognitive — 10 items × max 5 = max 50
const B1_MAX = 50
function sumB1(r: ReviewInput): number {
  return (
    v(r.problemSolving) +
    v(r.spatialAwareness) +
    v(r.strategicThinking) +
    v(r.criticalThinking) +
    v(r.memoryAttention) +
    v(r.creativity) +
    v(r.readingLanguage) +
    v(r.mathSystems) +
    v(r.learningTransfer) +
    v(r.adaptiveChallenge)
  )
}

// B2: Social-emotional — 6 items × max 5 = max 30
const B2_MAX = 30
function sumB2(r: ReviewInput): number {
  return (
    v(r.teamwork) +
    v(r.communication) +
    v(r.empathy) +
    v(r.emotionalRegulation) +
    v(r.ethicalReasoning) +
    v(r.positiveSocial)
  )
}

// B3: Motor — 4 items × max 5 = max 20
const B3_MAX = 20
function sumB3(r: ReviewInput): number {
  return v(r.handEyeCoord) + v(r.fineMotor) + v(r.reactionTime) + v(r.physicalActivity)
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function calculateBDS(review: ReviewInput): BenefitResult {
  const cognitive = sumB1(review) / B1_MAX
  const socialEmotional = sumB2(review) / B2_MAX
  const motor = sumB3(review) / B3_MAX
  const bds = cognitive * 0.5 + socialEmotional * 0.3 + motor * 0.2
  return { cognitive, socialEmotional, motor, bds }
}

// Returns per-skill scores sorted by score descending, top 5 only.
// Used to populate the "what your child develops" section of the GameCard.
export function getTopBenefits(review: ReviewInput): TopBenefit[] {
  const skills: TopBenefit[] = [
    { skill: 'Problem Solving',       score: v(review.problemSolving),    maxScore: 5 },
    { skill: 'Spatial Awareness',     score: v(review.spatialAwareness),  maxScore: 5 },
    { skill: 'Strategic Thinking',    score: v(review.strategicThinking), maxScore: 5 },
    { skill: 'Critical Thinking',     score: v(review.criticalThinking),  maxScore: 5 },
    { skill: 'Memory & Attention',    score: v(review.memoryAttention),   maxScore: 5 },
    { skill: 'Creativity',            score: v(review.creativity),        maxScore: 5 },
    { skill: 'Reading & Language',    score: v(review.readingLanguage),   maxScore: 5 },
    { skill: 'Math & Systems',        score: v(review.mathSystems),       maxScore: 5 },
    { skill: 'Learning Transfer',     score: v(review.learningTransfer),  maxScore: 5 },
    { skill: 'Adaptive Challenge',    score: v(review.adaptiveChallenge), maxScore: 5 },
    { skill: 'Teamwork',              score: v(review.teamwork),          maxScore: 5 },
    { skill: 'Communication',         score: v(review.communication),     maxScore: 5 },
    { skill: 'Empathy',               score: v(review.empathy),           maxScore: 5 },
    { skill: 'Emotional Regulation',  score: v(review.emotionalRegulation), maxScore: 5 },
    { skill: 'Ethical Reasoning',     score: v(review.ethicalReasoning),  maxScore: 5 },
    { skill: 'Positive Social',       score: v(review.positiveSocial),    maxScore: 5 },
    { skill: 'Hand-Eye Coordination', score: v(review.handEyeCoord),      maxScore: 5 },
    { skill: 'Fine Motor',            score: v(review.fineMotor),         maxScore: 5 },
    { skill: 'Reaction Time',         score: v(review.reactionTime),      maxScore: 5 },
    { skill: 'Physical Activity',     score: v(review.physicalActivity),  maxScore: 5 },
  ]

  return skills
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}
