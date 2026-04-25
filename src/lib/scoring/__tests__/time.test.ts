import { describe, expect, test } from 'vitest'
import { deriveTimeRecommendation } from '../time'

// Helper: call with no childAge to verify existing behaviour is unchanged.
function base(ris: number, bds = 0.4, contentRisk = 0.2) {
  return deriveTimeRecommendation(ris, bds, contentRisk, null)
}

describe('deriveTimeRecommendation — base tiers (no age)', () => {
  test('RIS 0.10 → 120 min green', () => {
    const r = base(0.10)
    expect(r.minutes).toBe(120)
    expect(r.color).toBe('green')
  })

  test('RIS 0.25 → 90 min green', () => {
    const r = base(0.25)
    expect(r.minutes).toBe(90)
    expect(r.color).toBe('green')
  })

  test('RIS 0.40 → 60 min amber', () => {
    const r = base(0.40)
    expect(r.minutes).toBe(60)
    expect(r.color).toBe('amber')
  })

  test('RIS 0.60 → 30 min amber', () => {
    const r = base(0.60)
    expect(r.minutes).toBe(30)
    expect(r.color).toBe('amber')
  })

  test('RIS 0.80 → 15 min red', () => {
    const r = base(0.80)
    expect(r.minutes).toBe(15)
    expect(r.color).toBe('red')
  })
})

describe('deriveTimeRecommendation — BDS adjustments', () => {
  test('high BDS extends one tier', () => {
    // RIS 0.40 → index 2 (60 min), BDS 0.65 → index 1 (90 min)
    const r = deriveTimeRecommendation(0.40, 0.65, 0.2, null)
    expect(r.minutes).toBe(90)
  })

  test('high BDS blocked when RIS > 0.70', () => {
    const r = deriveTimeRecommendation(0.75, 0.65, 0.2, null)
    expect(r.minutes).toBe(15)
  })

  test('low BDS + moderate risk drops one tier', () => {
    // RIS 0.40 → index 2 (60 min), BDS 0.15 + RIS > 0.30 → index 3 (30 min)
    const r = deriveTimeRecommendation(0.40, 0.15, 0.2, null)
    expect(r.minutes).toBe(30)
  })
})

describe('deriveTimeRecommendation — age adjustment: under 6', () => {
  test('60-min recommendation → 30 min for age 4', () => {
    // RIS 0.40 → 60 min base
    const r = deriveTimeRecommendation(0.40, 0.4, 0.2, null, 4)
    expect(r.minutes).toBe(30)
    expect(r.color).toBe('amber')
    expect(r.reasoning).toContain('under-6')
  })

  test('30-min recommendation → 15 min for age 5', () => {
    // RIS 0.60 → 30 min base
    const r = deriveTimeRecommendation(0.60, 0.4, 0.2, null, 5)
    expect(r.minutes).toBe(15)
    expect(r.color).toBe('red')
  })

  test('90-min recommendation → 30 min for age 3 (halved=45, capped at 30)', () => {
    // RIS 0.25 → 90 min base; halved=45, capped=30
    const r = deriveTimeRecommendation(0.25, 0.4, 0.2, null, 3)
    expect(r.minutes).toBe(30)
  })

  test('120-min recommendation → 30 min for age 2 (halved=60, capped at 30)', () => {
    // RIS 0.10 → 120 min base; halved=60, capped=30
    const r = deriveTimeRecommendation(0.10, 0.4, 0.2, null, 2)
    expect(r.minutes).toBe(30)
  })
})

describe('deriveTimeRecommendation — age adjustment: 13–17', () => {
  test('age 14, RIS 0.20, low content → extends from 90 to 120', () => {
    // RIS 0.20 → 90 min; contentRisk 0.3 < 0.6 → extends to 120
    const r = deriveTimeRecommendation(0.20, 0.4, 0.3, null, 14)
    expect(r.minutes).toBe(120)
    expect(r.color).toBe('green')
  })

  test('age 16, RIS 0.40, low content → extends from 60 to 90', () => {
    const r = deriveTimeRecommendation(0.40, 0.4, 0.3, null, 16)
    expect(r.minutes).toBe(90)
  })

  test('age 14, RIS 0.20, high content → does NOT extend (content-gated)', () => {
    // contentRisk 0.7 >= 0.6 → no extension
    const r = deriveTimeRecommendation(0.20, 0.4, 0.7, null, 14)
    expect(r.minutes).toBe(90)
  })

  test('age 12 → does NOT get teen extension', () => {
    const r = deriveTimeRecommendation(0.20, 0.4, 0.3, null, 12)
    expect(r.minutes).toBe(90)
  })

  test('age 18 → does NOT get teen extension', () => {
    const r = deriveTimeRecommendation(0.20, 0.4, 0.3, null, 18)
    expect(r.minutes).toBe(90)
  })
})

describe('deriveTimeRecommendation — childAge null', () => {
  test('null childAge → identical result to omitted param', () => {
    const withNull    = deriveTimeRecommendation(0.40, 0.4, 0.2, null, null)
    const withOmitted = deriveTimeRecommendation(0.40, 0.4, 0.2, null)
    expect(withNull).toEqual(withOmitted)
  })
})
