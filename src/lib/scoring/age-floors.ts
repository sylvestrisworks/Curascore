/**
 * Age-floor computation from R4 content scores.
 *
 * Thresholds are symmetric by severity, not content type — the asymmetry at
 * score 1 (violence→7, sexual→9) reflects a developmental difference in
 * interpretive capacity, not a moral judgment about which content is "worse".
 * Cartoon violence is explicitly permitted at PEGI 7; mild sexual content
 * (suggestive themes, innuendo) requires social/relational scaffolding not
 * reliably present until ~9.
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
  modifiers: AgeFloorModifiers = {},
): AgeFloorResult {
  const v = Math.min(3, Math.max(0, Math.round(violenceLevel ?? 0)))
  const s = Math.min(3, Math.max(0, Math.round(sexualContent ?? 0)))

  const baseVFloor = AGE_FLOOR_CONFIG.violence[v]
  const baseSFloor = AGE_FLOOR_CONFIG.sexual[s]

  const reasons: string[] = []
  if (v > 0) reasons.push(`R4.1=${v}`)
  if (s > 0) reasons.push(`R4.2=${s}`)

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

  const recommendedMinAge = Math.max(vFloor, sFloor)
  const ageFloorReason = reasons.length > 0 ? reasons.join(' + ') : 'no content flags'

  return { recommendedMinAge, ageFloorReason }
}
