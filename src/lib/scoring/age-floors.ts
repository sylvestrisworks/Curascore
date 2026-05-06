/**
 * Age-floor computation from R4 content scores.
 *
 * Three R4 dimensions set a numeric floor: R4.1 (violence), R4.2 (sexual content),
 * and R4.5 (fear/horror). R4.3 (language) and R4.4 (substance) inform parent
 * narratives but do not produce an age floor — they are contextual rather than
 * developmentally threshold-linked.
 *
 * Score-1 asymmetry across dimensions:
 *   violence → 7  (PEGI 7 explicitly permits cartoon/fantasy violence)
 *   fear     → 7  (PEGI 7 explicitly permits mild horror and frightening content)
 *   sexual   → 9  (mild suggestive content requires relational scaffolding ~9)
 *
 * Fear caps at 13, not 17: intense horror without graphic sexual or violence
 * content places a game at the ESRB T / PEGI 16 boundary, not the adult boundary.
 * Context modifiers (trivialized, defenceless_target, mixed_sexual_violent) apply
 * only to the violence and sexual dimensions — fear tone is assessed directly in R4.5.
 *
 * Scientific basis: Coyne et al. (2019) J Adolesc Health 64(4),
 * Huesmann (2007) PMC2704015, AAP (2026) Pediatrics 157(2),
 * McConahay & McConahay (1977) J Social Issues 33(2).
 * See docs/RUBRIC.md §Age-Floor Policy for full methodology.
 */

// Base floors indexed by score (0–3).
// To update thresholds: change here, run tests, bump CURRENT_METHODOLOGY_VERSION.
export const AGE_FLOOR_CONFIG = {
  violence: [0, 7,  13, 17] as const,  // R4.1
  sexual:   [0, 9,  13, 17] as const,  // R4.2
  fear:     [0, 7,  10, 13] as const,  // R4.5 — added v1.1
  MODIFIER_BUMP: 2,
  MODIFIER_CAP:  17,
} as const

export type AgeFloorModifiers = {
  /** Violence or sexual content played for laughs, titillation, or with no consequences shown. */
  trivialized?: boolean | null
  /** Violence directed at non-combatants, surrendered, or helpless characters. Violence dimension only. */
  defencelessTarget?: boolean | null
  /** Sexual and violent content combined in the same scene/context. Applies to both dimensions; requires both R4.1 > 0 and R4.2 > 0. */
  mixedSexualViolent?: boolean | null
}

export type AgeFloorResult = {
  recommendedMinAge: number
  ageFloorReason: string
}

export function computeAgeFloor(
  violenceLevel: number | null | undefined,
  sexualContent: number | null | undefined,
  fearHorror: number | null | undefined = 0,
  modifiers: AgeFloorModifiers = {},
): AgeFloorResult {
  const v = Math.min(3, Math.max(0, Math.round(violenceLevel ?? 0)))
  const s = Math.min(3, Math.max(0, Math.round(sexualContent ?? 0)))
  const f = Math.min(3, Math.max(0, Math.round(fearHorror   ?? 0)))

  const baseVFloor = AGE_FLOOR_CONFIG.violence[v]
  const baseSFloor = AGE_FLOOR_CONFIG.sexual[s]
  const baseFFloor = AGE_FLOOR_CONFIG.fear[f]

  const reasons: string[] = []
  if (v > 0) reasons.push(`R4.1=${v}`)
  if (s > 0) reasons.push(`R4.2=${s}`)
  if (f > 0) reasons.push(`R4.5=${f}`)

  let vBump = 0
  let sBump = 0

  if (modifiers.trivialized) {
    if (v > 0) vBump += AGE_FLOOR_CONFIG.MODIFIER_BUMP
    if (s > 0) sBump += AGE_FLOOR_CONFIG.MODIFIER_BUMP
    reasons.push('trivialized')
  }

  if (modifiers.defencelessTarget && v > 0) {
    vBump += AGE_FLOOR_CONFIG.MODIFIER_BUMP
    reasons.push('defenceless_target')
  }

  // mixedSexualViolent only applies when both dimensions have content
  if (modifiers.mixedSexualViolent && v > 0 && s > 0) {
    vBump += AGE_FLOOR_CONFIG.MODIFIER_BUMP
    sBump += AGE_FLOOR_CONFIG.MODIFIER_BUMP
    reasons.push('mixed_sexual_violent')
  }

  const vFloor = Math.min(AGE_FLOOR_CONFIG.MODIFIER_CAP, baseVFloor + vBump)
  const sFloor = Math.min(AGE_FLOOR_CONFIG.MODIFIER_CAP, baseSFloor + sBump)
  // Fear has no context modifiers — severity is assessed directly in R4.5
  const fFloor = baseFFloor

  const recommendedMinAge = Math.max(vFloor, sFloor, fFloor)
  const ageFloorReason = reasons.length > 0 ? reasons.join(' + ') : 'no content flags'

  return { recommendedMinAge, ageFloorReason }
}
