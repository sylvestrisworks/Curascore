import { describe, expect, test } from 'vitest'
import { computeAgeFloor, AGE_FLOOR_CONFIG } from '../age-floors'

// ─── Base floors — no modifiers ───────────────────────────────────────────────

describe('base floors — violence (R4.1)', () => {
  test('score 0 → age 0', () => {
    expect(computeAgeFloor(0, 0).recommendedMinAge).toBe(0)
  })
  test('score 1 → age 7  (PEGI 7 cartoon violence carve-out)', () => {
    expect(computeAgeFloor(1, 0).recommendedMinAge).toBe(7)
  })
  test('score 2 → age 13', () => {
    expect(computeAgeFloor(2, 0).recommendedMinAge).toBe(13)
  })
  test('score 3 → age 17', () => {
    expect(computeAgeFloor(3, 0).recommendedMinAge).toBe(17)
  })
})

describe('base floors — sexual content (R4.2)', () => {
  test('score 0 → age 0', () => {
    expect(computeAgeFloor(0, 0).recommendedMinAge).toBe(0)
  })
  test('score 1 → age 9  (interpretive scaffolding not present at 7)', () => {
    expect(computeAgeFloor(0, 1).recommendedMinAge).toBe(9)
  })
  test('score 2 → age 13', () => {
    expect(computeAgeFloor(0, 2).recommendedMinAge).toBe(13)
  })
  test('score 3 → age 17', () => {
    expect(computeAgeFloor(0, 3).recommendedMinAge).toBe(17)
  })
})

describe('score 1 asymmetry', () => {
  test('violence 1 < sexual 1  (7 vs 9)', () => {
    expect(computeAgeFloor(1, 0).recommendedMinAge).toBe(7)
    expect(computeAgeFloor(0, 1).recommendedMinAge).toBe(9)
  })
  test('at score 2+ both dimensions are equal', () => {
    expect(computeAgeFloor(2, 0).recommendedMinAge).toBe(computeAgeFloor(0, 2).recommendedMinAge)
    expect(computeAgeFloor(3, 0).recommendedMinAge).toBe(computeAgeFloor(0, 3).recommendedMinAge)
  })
})

// ─── max() across dimensions ──────────────────────────────────────────────────

describe('max() across dimensions', () => {
  test('violence 2, sexual 2 → 13  (tie)', () => {
    expect(computeAgeFloor(2, 2).recommendedMinAge).toBe(13)
  })
  test('violence 1, sexual 3 → 17  (sexual wins)', () => {
    expect(computeAgeFloor(1, 3).recommendedMinAge).toBe(17)
  })
  test('violence 3, sexual 1 → 17  (violence wins)', () => {
    expect(computeAgeFloor(3, 1).recommendedMinAge).toBe(17)
  })
  test('violence 2, sexual 3 → 17', () => {
    expect(computeAgeFloor(2, 3).recommendedMinAge).toBe(17)
  })
})

// ─── Modifiers — trivialized ──────────────────────────────────────────────────

describe('modifier: trivialized', () => {
  test('violence 1 + trivialized → 7 + 2 = 9', () => {
    expect(computeAgeFloor(1, 0, { trivialized: true }).recommendedMinAge).toBe(9)
  })
  test('sexual 1 + trivialized → 9 + 2 = 11', () => {
    expect(computeAgeFloor(0, 1, { trivialized: true }).recommendedMinAge).toBe(11)
  })
  test('violence 2 + trivialized → 13 + 2 = 15', () => {
    expect(computeAgeFloor(2, 0, { trivialized: true }).recommendedMinAge).toBe(15)
  })
  test('violence 3 + trivialized → capped at 17', () => {
    expect(computeAgeFloor(3, 0, { trivialized: true }).recommendedMinAge).toBe(17)
  })
  test('trivialized with score 0 has no effect', () => {
    expect(computeAgeFloor(0, 0, { trivialized: true }).recommendedMinAge).toBe(0)
  })
  test('trivialized bumps both dimensions when both > 0', () => {
    // v=1 → 7+2=9, s=1 → 9+2=11 → max=11
    expect(computeAgeFloor(1, 1, { trivialized: true }).recommendedMinAge).toBe(11)
  })
})

// ─── Modifiers — defencelessTarget ───────────────────────────────────────────

describe('modifier: defencelessTarget', () => {
  test('violence 1 + defencelessTarget → 7 + 2 = 9', () => {
    expect(computeAgeFloor(1, 0, { defencelessTarget: true }).recommendedMinAge).toBe(9)
  })
  test('violence 2 + defencelessTarget → 13 + 2 = 15', () => {
    expect(computeAgeFloor(2, 0, { defencelessTarget: true }).recommendedMinAge).toBe(15)
  })
  test('defencelessTarget does NOT affect sexual content dimension', () => {
    // v=0, s=2 + defencelessTarget → sexual floor unchanged (13), violence floor still 0
    expect(computeAgeFloor(0, 2, { defencelessTarget: true }).recommendedMinAge).toBe(13)
  })
  test('defencelessTarget with violence 0 has no effect', () => {
    expect(computeAgeFloor(0, 0, { defencelessTarget: true }).recommendedMinAge).toBe(0)
  })
})

// ─── Modifiers — mixedSexualViolent ──────────────────────────────────────────

describe('modifier: mixedSexualViolent', () => {
  test('v=1, s=1 + mixed → v=7+2=9, s=9+2=11 → max=11', () => {
    expect(computeAgeFloor(1, 1, { mixedSexualViolent: true }).recommendedMinAge).toBe(11)
  })
  test('v=2, s=2 + mixed → v=13+2=15, s=13+2=15 → 15', () => {
    expect(computeAgeFloor(2, 2, { mixedSexualViolent: true }).recommendedMinAge).toBe(15)
  })
  test('mixedSexualViolent does not apply when violence = 0', () => {
    expect(computeAgeFloor(0, 2, { mixedSexualViolent: true }).recommendedMinAge).toBe(13)
  })
  test('mixedSexualViolent does not apply when sexual = 0', () => {
    expect(computeAgeFloor(2, 0, { mixedSexualViolent: true }).recommendedMinAge).toBe(13)
  })
})

// ─── Modifier stacking — additive within a dimension ─────────────────────────

describe('modifier stacking', () => {
  test('trivialized + defencelessTarget on violence → +4', () => {
    // v=1 base=7, +2+2=+4 → 11
    expect(computeAgeFloor(1, 0, { trivialized: true, defencelessTarget: true }).recommendedMinAge).toBe(11)
  })
  test('trivialized + mixedSexualViolent on violence → +4', () => {
    // v=1, s=1: v_bump=2+2=4 → 7+4=11; s_bump=2+2=4 → 9+4=13 → max=13
    expect(computeAgeFloor(1, 1, { trivialized: true, mixedSexualViolent: true }).recommendedMinAge).toBe(13)
  })
  test('all three modifiers with v=2, s=2', () => {
    // v_bump = 2(trivialized) + 2(defenceless) + 2(mixed) = 6 → 13+6=19 → capped 17
    // s_bump = 2(trivialized) + 2(mixed) = 4 → 13+4=17 → 17
    // max(17, 17) = 17
    expect(computeAgeFloor(2, 2, { trivialized: true, defencelessTarget: true, mixedSexualViolent: true }).recommendedMinAge).toBe(17)
  })
  test('all three modifiers with v=1, s=1 → capped correctly', () => {
    // v_bump = 2+2+2 = 6 → 7+6=13 → not capped
    // s_bump = 2+2 = 4 → 9+4=13
    // max(13, 13) = 13
    expect(computeAgeFloor(1, 1, { trivialized: true, defencelessTarget: true, mixedSexualViolent: true }).recommendedMinAge).toBe(13)
  })
})

// ─── Cap at 17 ────────────────────────────────────────────────────────────────

describe('modifier cap at 17', () => {
  test('v=3 + all modifiers still returns 17', () => {
    expect(computeAgeFloor(3, 3, { trivialized: true, defencelessTarget: true, mixedSexualViolent: true }).recommendedMinAge).toBe(17)
  })
  test('cap value matches AGE_FLOOR_CONFIG.MODIFIER_CAP', () => {
    expect(AGE_FLOOR_CONFIG.MODIFIER_CAP).toBe(17)
  })
})

// ─── Null / undefined inputs ──────────────────────────────────────────────────

describe('null and undefined inputs', () => {
  test('null scores treated as 0', () => {
    expect(computeAgeFloor(null, null).recommendedMinAge).toBe(0)
  })
  test('undefined scores treated as 0', () => {
    expect(computeAgeFloor(undefined, undefined).recommendedMinAge).toBe(0)
  })
  test('null modifiers treated as false', () => {
    expect(computeAgeFloor(2, 0, { trivialized: null }).recommendedMinAge).toBe(13)
  })
  test('omitted modifiers object defaults to no bumps', () => {
    expect(computeAgeFloor(2, 2).recommendedMinAge).toBe(13)
  })
})

// ─── ageFloorReason ───────────────────────────────────────────────────────────

describe('ageFloorReason string', () => {
  test('no content → "no content flags"', () => {
    expect(computeAgeFloor(0, 0).ageFloorReason).toBe('no content flags')
  })
  test('R4.1 only', () => {
    expect(computeAgeFloor(2, 0).ageFloorReason).toBe('R4.1=2')
  })
  test('R4.2 only', () => {
    expect(computeAgeFloor(0, 1).ageFloorReason).toBe('R4.2=1')
  })
  test('both dimensions', () => {
    expect(computeAgeFloor(1, 2).ageFloorReason).toBe('R4.1=1 + R4.2=2')
  })
  test('with modifiers', () => {
    const { ageFloorReason } = computeAgeFloor(2, 0, { trivialized: true, defencelessTarget: true })
    expect(ageFloorReason).toBe('R4.1=2 + trivialized + defenceless_target')
  })
  test('mixedSexualViolent appears in reason', () => {
    const { ageFloorReason } = computeAgeFloor(1, 1, { mixedSexualViolent: true })
    expect(ageFloorReason).toContain('mixed_sexual_violent')
  })
})

// ─── Config symmetry invariants ───────────────────────────────────────────────

describe('config invariants', () => {
  test('violence and sexual floors are equal at scores 0, 2, 3', () => {
    expect(AGE_FLOOR_CONFIG.violence[0]).toBe(AGE_FLOOR_CONFIG.sexual[0])
    expect(AGE_FLOOR_CONFIG.violence[2]).toBe(AGE_FLOOR_CONFIG.sexual[2])
    expect(AGE_FLOOR_CONFIG.violence[3]).toBe(AGE_FLOOR_CONFIG.sexual[3])
  })
  test('violence score 1 (7) is lower than sexual score 1 (9)', () => {
    expect(AGE_FLOOR_CONFIG.violence[1]).toBeLessThan(AGE_FLOOR_CONFIG.sexual[1])
  })
  test('floors are monotonically non-decreasing', () => {
    for (let i = 1; i < 4; i++) {
      expect(AGE_FLOOR_CONFIG.violence[i]).toBeGreaterThanOrEqual(AGE_FLOOR_CONFIG.violence[i - 1])
      expect(AGE_FLOOR_CONFIG.sexual[i]).toBeGreaterThanOrEqual(AGE_FLOOR_CONFIG.sexual[i - 1])
    }
  })
})
