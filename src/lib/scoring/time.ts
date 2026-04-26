// Time recommendation derivation.
//
// Base tier from RIS:
//   0.00–0.15  →  120 min  (green)
//   0.16–0.30  →   90 min  (green)
//   0.31–0.50  →   60 min  (amber)
//   0.51–0.70  →   30 min  (amber)
//   0.71+      →   15 min  / not recommended  (red)
//
// Adjustments applied in order:
//   1. BDS ≥ 0.60 extends one tier (more time) — unless RIS > 0.70
//   2. BDS < 0.20 AND RIS > 0.30 drops one tier (less time)
//   3. Age adjustment (optional childAge param, applied at render time, not stored):
//      - childAge < 6:  halve minutes, cap at 30
//      - childAge 13–17 AND contentRisk < 0.60:  extend one tier
//
// R4 (contentRisk) does NOT affect the base tier — it is used in reasoning text
// and to gate the 13–17 age extension.

import type { TimeRecommendation } from './types'

type Tier = {
  minutes: number
  baseLabel: string
  color: 'green' | 'amber' | 'red'
}

// Ordered best → worst (index 0 = most time, index 4 = least)
const TIERS: Tier[] = [
  { minutes: 120, baseLabel: 'Up to 120 min/day',   color: 'green' },
  { minutes:  90, baseLabel: 'Up to 90 min/day',    color: 'green' },
  { minutes:  60, baseLabel: 'Up to 60 min/day',    color: 'amber' },
  { minutes:  30, baseLabel: 'Up to 30 min/day',    color: 'amber' },
  { minutes:  15, baseLabel: 'Not recommended',      color: 'red'   },
]

function baseTierIndex(ris: number): number {
  if (ris <= 0.15) return 0
  if (ris <= 0.30) return 1
  if (ris <= 0.50) return 2
  if (ris <= 0.70) return 3
  return 4
}

function buildLabel(tier: Tier, ageRating?: string | null): string {
  if (tier.minutes === 15) {
    if (ageRating === 'M' || ageRating === 'AO') return 'Not recommended under 17'
    return 'Not recommended for children'
  }
  return tier.baseLabel
}

function under6Label(minutes: number): string {
  if (minutes <= 15) return 'Up to 15 min/day'
  return 'Up to 30 min/day'
}

function buildReasoning(
  ris: number,
  bds: number,
  contentRisk: number,
  finalIndex: number,
  baseIndex: number,
): string {
  const parts: string[] = []

  // Explain any tier adjustment
  if (finalIndex < baseIndex) {
    parts.push(
      `Strong developmental benefits (BDS ${pct(bds)}) earn extra session time.`,
    )
  } else if (finalIndex > baseIndex) {
    parts.push(
      `Very low developmental benefits (BDS ${pct(bds)}) combined with moderate risk reduces recommended time.`,
    )
  }

  // Describe the underlying risk level
  if (ris <= 0.15) {
    parts.push('Risk score is very low — minimal mechanics that encourage over-play.')
  } else if (ris <= 0.30) {
    parts.push('Risk score is low — some mild engagement mechanics present.')
  } else if (ris <= 0.50) {
    parts.push('Risk score is moderate — notable engagement mechanics to watch for.')
  } else if (ris <= 0.70) {
    parts.push('Risk score is high — significant compulsion or monetisation mechanics.')
  } else {
    parts.push('Risk score is very high — strong compulsion and/or monetisation mechanics.')
  }

  // Flag elevated content risk (display note only)
  if (contentRisk >= 0.6) {
    parts.push('Content risk is elevated — check age-appropriateness before allowing play.')
  }

  return parts.join(' ')
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function deriveTimeRecommendation(
  ris: number,
  bds: number,
  contentRisk: number,
  ageRating?: string | null,
  childAge?: number | null,
): TimeRecommendation {
  const baseIndex = baseTierIndex(ris)
  let finalIndex = baseIndex

  // Rule 1: High benefit extends one tier (more time), blocked when RIS > 0.70
  if (bds >= 0.6 && ris <= 0.70) {
    finalIndex = Math.max(0, finalIndex - 1)
  }

  // Rule 2: Low benefit + moderate risk drops one tier (less time)
  if (bds < 0.2 && ris > 0.3) {
    finalIndex = Math.min(TIERS.length - 1, finalIndex + 1)
  }

  // Rule 3a: Age 13–17 — extend one tier if content-appropriate
  if (childAge != null && childAge >= 13 && childAge <= 17 && contentRisk < 0.6) {
    finalIndex = Math.max(0, finalIndex - 1)
  }

  const tier = TIERS[finalIndex]
  const reasoning = buildReasoning(ris, bds, contentRisk, finalIndex, baseIndex)

  // Rule 3b: Under 6 — halve minutes, cap at 30 (applied after tier is resolved)
  if (childAge != null && childAge < 6) {
    const halved  = Math.floor(tier.minutes / 2)
    const minutes = Math.min(halved, 30)
    return {
      minutes,
      label:     under6Label(minutes),
      reasoning: reasoning + ' Time halved and capped at 30 min for under-6.',
      color:     minutes <= 15 ? 'red' : 'amber',
    }
  }

  return {
    minutes: tier.minutes,
    label:   buildLabel(tier, ageRating),
    reasoning,
    color:   tier.color,
  }
}
