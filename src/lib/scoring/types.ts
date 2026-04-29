// Scoring engine types — mirrors the score fields from the reviews table.
// All score fields are optional/nullable to handle partial reviews.

export type ReviewInput = {
  // B1: Cognitive (0–5 each, 10 items, max 50)
  problemSolving?: number | null
  spatialAwareness?: number | null
  strategicThinking?: number | null
  criticalThinking?: number | null
  memoryAttention?: number | null
  creativity?: number | null
  readingLanguage?: number | null
  mathSystems?: number | null
  learningTransfer?: number | null
  adaptiveChallenge?: number | null

  // B2: Social-emotional (0–5 each, 6 items, max 30)
  teamwork?: number | null
  communication?: number | null
  empathy?: number | null
  emotionalRegulation?: number | null
  ethicalReasoning?: number | null
  positiveSocial?: number | null

  // B3: Motor (0–5 each, 4 items, max 20)
  handEyeCoord?: number | null
  fineMotor?: number | null
  reactionTime?: number | null
  physicalActivity?: number | null

  // R1: Dopamine manipulation (0–3 each, 10 items, max 30)
  variableRewards?: number | null
  streakMechanics?: number | null
  lossAversion?: number | null
  fomoEvents?: number | null
  stoppingBarriers?: number | null
  notifications?: number | null
  nearMiss?: number | null
  infinitePlay?: number | null
  escalatingCommitment?: number | null
  variableRewardFreq?: number | null

  // R2: Monetisation pressure (0–3 each, 8 items, max 24)
  spendingCeiling?: number | null
  payToWin?: number | null
  currencyObfuscation?: number | null
  spendingPrompts?: number | null
  childTargeting?: number | null
  adPressure?: number | null
  subscriptionPressure?: number | null
  socialSpending?: number | null

  // R3: Social risk (0–3 each, 6 items, max 18)
  socialObligation?: number | null
  competitiveToxicity?: number | null
  strangerRisk?: number | null
  socialComparison?: number | null
  identitySelfWorth?: number | null
  privacyRisk?: number | null

  // R4: Content risk (0–3 each, 5 items, max 15) — display only, not in RIS
  violenceLevel?: number | null
  sexualContent?: number | null
  language?: number | null
  substanceRef?: number | null
  fearHorror?: number | null

  // R4 context modifiers — raise the age floor above the base R4 score
  trivialized?: boolean | null        // violence/sex played for laughs or with no consequences
  defencelessTarget?: boolean | null  // violence against non-combatants/helpless characters (violence only)
  mixedSexualViolent?: boolean | null // sex and violence combined in same scene/context

  // Optional context used for labelling, not for score calculation
  esrbRating?: string | null
  pegiRating?: number | null
}

export type BenefitResult = {
  cognitive: number       // B1 normalised 0–1
  socialEmotional: number // B2 normalised 0–1
  motor: number           // B3 normalised 0–1
  bds: number             // weighted composite: B1×0.50 + B2×0.30 + B3×0.20
}

export type RiskResult = {
  dopamine: number     // R1 normalised 0–1
  monetization: number // R2 normalised 0–1
  social: number       // R3 normalised 0–1
  contentRisk: number  // R4 normalised 0–1 (display only — not in RIS)
  ris: number          // weighted composite: R1×0.45 + R2×0.30 + R3×0.25
}

export type TimeRecommendation = {
  minutes: number               // 15, 30, 60, 90, or 120
  label: string                 // e.g. "Up to 90 min/day"
  reasoning: string             // brief human-readable explanation
  color: 'green' | 'amber' | 'red'
}

export type TopBenefit = {
  skill: string
  score: number
  maxScore: number
}

export type ExperienceRiskInput = {
  dopamineTrapScore?: number | null  // 0–3
  monetizationScore?: number | null  // 0–3
  toxicityScore?: number | null      // 0–3
  strangerRisk?: number | null       // 0–3
  privacyRisk?: number | null        // 0–3
  ugcContentRisk?: number | null     // 0–3
}

export type ExperienceRiskResult = {
  dopamine: number      // 0–1, R1 normalized — comparable to RiskResult.dopamine
  monetization: number  // 0–1, R2 normalized — comparable to RiskResult.monetization
  social: number        // 0–1, R3 normalized — comparable to RiskResult.social
  contentRisk: number   // 0–1, R4 display only — not in ris
  ris: number           // 0–1, R1×0.45 + R2×0.30 + R3×0.25 — comparable to RiskResult.ris
}

export type ExperienceBenefitResult = {
  cognitive: number       // 0–1, (learning + creativity×0.5) / 3
  socialEmotional: number // 0–1, (social + creativity×0.5) / 3
  bds: number             // 0–1, cognitive×0.50 + socialEmotional×0.30 (motor=0)
}

export type GameScoresResult = {
  cognitiveScore: number
  socialEmotionalScore: number
  motorScore: number
  bds: number
  dopamineRisk: number
  monetizationRisk: number
  socialRisk: number
  contentRisk: number
  ris: number
  curascore: number   // harmonic mean of BDS and Safety (1-RIS), scaled 0-100
  timeRecommendation: TimeRecommendation
  topBenefits: TopBenefit[]
  recommendedMinAge: number
  ageFloorReason: string
}
