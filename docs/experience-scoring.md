# Experience Scoring — How Roblox and Fortnite Creative Are Rated vs the Rubric

> **Date:** April 2025  
> **Scope:** Compares the scoring methodology for UGC platform experiences (Roblox + Fortnite Creative) against the base PlaySmart rubric (v0.1, `docs/RUBRIC.md`).

---

## Overview

LumiKin scores experiences on two separate tracks:

| Track | Applies to | Engine |
|---|---|---|
| **Standalone game scoring** | Regular games (Zelda, Minecraft, Genshin, etc.) | `src/lib/scoring/engine.ts` — formula-derived |
| **Experience scoring** | Roblox experiences + Fortnite Creative maps | `src/app/api/cron/review-experiences/route.ts` — AI-holistic |

These two tracks produce scores on the same output scale (curascore 0–100, time tiers 15/30/60/90/120 min) but derive them via fundamentally different methods. This document maps the differences, identifies where they diverge from the rubric, and flags the consequences for cross-platform consistency.

---

## Part 1 — The Rubric (Standalone Game Scoring)

### How it works

The rubric defines two composite scores:

**BDS (Benefit Density Score)**
```
BDS = (B1_norm × 0.50) + (B2_norm × 0.30) + (B3_norm × 0.20)
```
- B1: 10 cognitive dimensions, 0–5 each, max 50
- B2: 6 social-emotional dimensions, 0–5 each, max 30
- B3: 4 physical-motor dimensions, 0–5 each, max 20

**RIS (Risk Intensity Score)**
```
RIS = (R1_norm × 0.45) + (R2_norm × 0.30) + (R3_norm × 0.25)
```
- R1: 10 dopamine manipulation dimensions, 0–3 each, max 30
- R2: 8 monetization pressure dimensions, 0–3 each, max 24
- R3: 6 social/emotional risk dimensions, 0–3 each, max 18
- R4: 5 content risk dimensions — display only, excluded from RIS

**Time tier derivation (Step 3–4 of rubric)**

| RIS | Base tier |
|---|---|
| 0.00–0.15 | Up to 120 min |
| 0.16–0.30 | Up to 90 min |
| 0.31–0.50 | Up to 60 min |
| 0.51–0.70 | Up to 30 min |
| 0.71–1.00 | Up to 15 min / not recommended |

Modifiers:
- BDS ≥ 0.60 → extend one tier (unless RIS > 0.70)
- BDS < 0.20 AND RIS > 0.30 → drop one tier

**curascore** is the harmonic mean of BDS and Safety (1 – RIS), scaled 0–100. It is not in the rubric — it was added in the engine as a single-number summary.

### Engine conformance

The standalone engine (`engine.ts`, `benefits.ts`, `risks.ts`, `time.ts`) fully implements the rubric:

| Rubric requirement | Engine implementation | Status |
|---|---|---|
| B1: 10 items × 0–5, max 50 | `sumB1()` — 10 fields | ✓ |
| B2: 6 items × 0–5, max 30 | `sumB2()` — 6 fields | ✓ |
| B3: 4 items × 0–5, max 20 | `sumB3()` — 4 fields | ✓ |
| BDS weights 0.50 / 0.30 / 0.20 | `cognitive * 0.5 + socialEmotional * 0.3 + motor * 0.2` | ✓ |
| R1: 10 items × 0–3, max 30 | `sumR1()` — 10 fields | ✓ |
| R2: 8 items × 0–3, max 24 | `sumR2()` — 8 fields | ✓ |
| R3: 6 items × 0–3, max 18 | `sumR3()` — 6 fields | ✓ |
| R4 excluded from RIS | `contentRisk` returned separately, not in RIS formula | ✓ |
| RIS weights 0.45 / 0.30 / 0.25 | `dopamine * 0.45 + monetization * 0.3 + social * 0.25` | ✓ |
| 5 time tiers at 0.15/0.30/0.50/0.70 | `baseTierIndex()` | ✓ |
| BDS ≥ 0.60 extends tier (unless RIS > 0.70) | Rule 1 in `deriveTimeRecommendation()` | ✓ |
| BDS < 0.20 AND RIS > 0.30 drops tier | Rule 2 in `deriveTimeRecommendation()` | ✓ |

---

## Part 2 — Experience Scoring (Roblox + Fortnite Creative)

### How it works

Experiences are scored by Claude via AWS Bedrock (`review-experiences/route.ts`). The model receives a platform-specific prompt and returns structured scores via a tool call (`submit_experience_evaluation`).

**Benefit dimensions (3 total, 0–3 each, max 9)**

| Dimension | What it captures |
|---|---|
| `creativityScore` | Building, designing, scripting, storytelling, open-ended expression |
| `socialScore` | Cooperative play, communication, positive community |
| `learningScore` | Transferable skills: problem solving, strategy, spatial reasoning, literacy |

**Risk dimensions (6 total, 0–3 each, max 18)**

| Dimension | What it captures |
|---|---|
| `dopamineTrapScore` | Variable rewards, streaks with penalties, near-miss, no stopping points |
| `toxicityScore` | Design that incentivises bullying, rank-shaming |
| `ugcContentRisk` | Structural exposure to inappropriate user-generated content |
| `strangerRisk` | Exposure to unknown adults via chat, DMs, friend-request prompts |
| `monetizationScore` | Robux/V-Buck pressure, pay-to-win, social spending comparison |
| `privacyRisk` | Prompts to share real name, age, location, or external links |

**Composite calculation in code**
```ts
riskScore   = (sum of 6 risk dims) / 18    // equal-weighted
benefitScore = (sum of 3 benefit dims) / 9  // equal-weighted
```

**curascore and time recommendation** are assigned holistically by the AI model, guided by calibration examples in the prompt — they are not computed from the formula.

### Fortnite Creative — extra notes

The 15 Fortnite Creative maps in production (as of April 2025) are **entirely hand-curated** in `fetch-fortnite-maps/route.ts`. Each map in `CURATED_MAPS` ships with all scores and narratives pre-authored by a human reviewer. The AI pipeline is only invoked for new maps not in this list. The hand-curated scores therefore reflect deliberate editorial judgment rather than systematic AI evaluation.

Key Fortnite-specific prompt calibration:
- Proximity voice chat is ON by default in Fortnite; maps cannot disable it → base `strangerRisk` starts at 1 for multiplayer maps (solo-only maps may get 0)
- Combat maps (box fights, zone wars, aim trainers) should score 40–55 unless they have strong cooperative/creative elements
- Aim training develops hand-eye coordination but that is scored as `learningScore: 1`, not 3

---

## Part 3 — Divergences from the Rubric

### 3.1 Dimension collapse (major)

The rubric defines 20 benefit sub-dimensions and 29 risk sub-dimensions. The experience scorer collapses these to 3 benefit and 6 risk dimensions.

| | Rubric | Experience scorer |
|---|---|---|
| Benefit dimensions | 20 (B1.1–B1.10, B2.1–B2.6, B3.1–B3.4) | 3 (creativity, social, learning) |
| Risk dimensions | 29 (R1.1–R1.10, R2.1–R2.8, R3.1–R3.6, R4) | 6 |
| Individual item max score | 5 (benefits), 3 (risks) | 3 (both) |

**Effect:** The rubric distinguishes between, for example, *problem solving* (B1.1), *spatial awareness* (B1.2), *strategic thinking* (B1.3), and *creativity* (B1.6). The experience scorer collapses all of these under `learningScore` or `creativityScore`. This is a deliberate trade-off for UGC — full rubric review of thousands of Roblox experiences would require too much per-experience context — but it means experience scores are structurally less granular.

### 3.2 Risk category weights differ (significant)

The rubric weights risk categories as: Dopamine 45%, Monetization 30%, Social 25%. The experience scorer uses **equal weighting** across all 6 risk dimensions.

In the rubric, monetization pressure and dopamine manipulation dominate. In the experience scorer, `ugcContentRisk` and `privacyRisk` — which do not exist in the rubric at all — receive equal weight alongside dopamine and monetization.

This is contextually appropriate (UGC introduces content and privacy risks that standalone games don't face) but creates a structural mismatch if a parent compares, say, Roblox's overall curascore with a standalone game's.

### 3.3 curascore and time recommendation are AI-holistic, not formula-derived (major)

For standalone games:
- curascore = `round(2 * BDS * Safety / (BDS + Safety) * 100)` (harmonic mean)
- Time tier = formula from RIS with BDS modifier

For experiences:
- curascore = AI assigns a number guided by calibration examples
- Time tier = AI selects from {15, 30, 60, 90, 120} guided by prompt heuristics:
  - Low risk (dopamine + stranger + monetization all ≤ 1) → 90–120 min
  - Moderate risk (some 2s) → 60 min
  - High risk (any 3, or multiple 2s) → 15–30 min
  - Extend one tier if sum of benefit scores ≥ 6

The prompt heuristic is a reasonable approximation of the rubric formula but differs in detail:
- Only 3 of the 6 risk dimensions are used in the time heuristic (dopamine, stranger, monetization) — toxicity, ugcContentRisk, and privacy are excluded from the time calculation in the prompt
- The benefit extension trigger is `sum ≥ 6 / max 9 = 67%` vs rubric's `BDS ≥ 0.60`
- These are close but not identical

### 3.4 No age adjustment step (minor gap)

The rubric specifies a Step 5 age adjustment:
- Under 6: halve recommendation, cap at 30 min
- 13–17: extend one tier if content-appropriate

The experience scorer produces a single `timeRecommendationMinutes` value with no age input. The `recommendedMinAge` field exists but is only used to gate the label ("Not recommended under 10"), not to adjust the time recommendation per child.

The standalone engine also omits Step 5 — age adjustment is never applied in code for either track. This is a known gap in both pipelines.

### 3.5 methodologyVersion not stamped on experience_scores (minor)

`experience_scores` has a `methodologyVersion` column that mirrors `game_scores.methodologyVersion`. The standalone `review-games` cron stamps this with `CURRENT_METHODOLOGY_VERSION`. The experience scorer (`saveScore()`) never writes this field — it is always NULL for experiences.

### 3.6 Fortnite Creative baseline — Fortnite BR vs Creative maps

Fortnite Battle Royale itself (as a standalone game in the `games` table) would be scored via the full rubric engine with all 29 dimensions. Fortnite Creative maps are scored via the UGC pipeline with 6 risk / 3 benefit dimensions. A parent comparing "Fortnite" to "a Fortnite Creative map" is comparing scores derived by different methods, which may not be surfaced in the UI.

---

## Part 4 — What Works Well

The experience scoring model makes several good choices that fit the UGC context better than direct rubric application would:

**UGC-specific risk dimensions.** `ugcContentRisk` (structural exposure to inappropriate player-built content) and `privacyRisk` (prompts to share real-world info) do not exist in the rubric but are real risks in UGC platforms. Adding them is correct.

**Contextual prompt calibration.** The prompts include worked examples (Adopt Me, Brookhaven, Tower of Hell for Roblox; Zone Wars, Deathrun, XP Farm for Fortnite) that anchor the AI's scoring to reasonable reference points. The Fortnite prompt explicitly notes that aim training develops hand-eye coordination but should score `learningScore: 1`, preventing inflation.

**Fortnite voice chat baseline.** The Fortnite prompt correctly notes that proximity voice chat is on by default and maps cannot disable it, setting a structural floor for `strangerRisk` on multiplayer maps.

**Discovery pipeline.** The Roblox crawler expands from curated seeds via Roblox's recommendations API. This is not part of the rubric (which is about rating, not discovery) but ensures the catalog grows organically rather than requiring manual additions.

---

## Part 5 — Worked Comparisons

### Roblox: Adopt Me (from prompt calibration example)
```
creativityScore: 1, socialScore: 2, learningScore: 0 → benefitScore = 3/9 = 0.33
dopamine: 2, toxicity: 0, ugcContent: 0, stranger: 2, monetization: 2, privacy: 0 → riskScore = 6/18 = 0.33
curascore: ~42 (AI holistic)
```

If Adopt Me were scored via the standalone rubric (hypothetical):
- High B2 (social) but low B1 (cognitive) → BDS likely ~0.30–0.35
- High R1 (dopamine/variable rewards), High R3 (stranger), moderate R2 → RIS likely ~0.55–0.65
- Predicted standalone curascore: harmonic mean of 0.32 BDS and 0.42 Safety → ~0.36 × 100 ≈ 36

The experience score (42) is slightly more generous. The difference is reasonable — the UGC model lacks the granular R1 sub-dimensions (streaks, FOMO events, near-miss) that would probably push RIS higher.

### Fortnite Creative: Raider's Edit Course (hand-curated)
```
creativityScore: 0, socialScore: 0, learningScore: 3 → benefitScore = 3/9 = 0.33
dopamine: 1, toxicity: 0, ugcContent: 0, stranger: 0, monetization: 0, privacy: 0 → riskScore = 1/18 = 0.056
curascore: 76 (hand-curated)
```

Rubric-equivalent (approximate):
- B1: High for adaptive challenge, reaction time, fine motor focus → ~20/50 = 0.40
- B2: 0 (solo, no social) → 0.00
- B3: hand-eye coordination, fine motor, reaction time → ~12/20 = 0.60
- BDS = (0.40 × 0.50) + (0.00 × 0.30) + (0.60 × 0.20) = 0.20 + 0 + 0.12 = 0.32

- R1: Low (no variable rewards, mild one-more-try loop) → ~4/30 = 0.13
- R2: 0 (no purchases) → 0.00
- R3: 0 (solo) → 0.00
- RIS = (0.13 × 0.45) + 0 + 0 = 0.059

Predicted time: RIS 0.059 → 120 min base. BDS 0.32 < 0.60 → no extension.
Predicted curascore: harmonic mean of 0.32 and 0.94 = 2(0.32×0.94)/(0.32+0.94) = 0.60/1.26 ≈ 0.48 → ~48

The hand-curated curascore of 76 is notably more generous. This reflects a deliberate editorial choice to reward the "no risk at all" profile — but the curascore formula is not used for experiences, so the number is subjective.

---

## Part 6 — Recommendations

| Issue | Priority | Suggestion |
|---|---|---|
| `methodologyVersion` never written to `experience_scores` | Low | Add `methodologyVersion: CURRENT_METHODOLOGY_VERSION` to `saveScore()` |
| curascore on experiences is AI-holistic, not formula-derived | Medium | Consider post-processing: compute curascore from `riskScore` / `benefitScore` using the harmonic mean formula, and treat the AI's curascore as an input check only |
| Risk weights in experience scorer are equal vs rubric-weighted | Medium | Document this consciously; consider applying 0.45/0.30/0.25-equivalent weights to the 6 experience risk dimensions to stay closer to rubric intent |
| Age adjustment not implemented in either pipeline | Low | Both standalone and UGC time recommendations ignore the Step 5 age modifier — the parent-facing UI would need a child profile to apply this |
| Fortnite BR vs Creative maps scored via different methods | Medium | Consider a UI note on Creative map pages: "This is a fan-made map inside Fortnite. It has a different score than Fortnite itself." |
| Fortnite strangerRisk: some solo maps correctly score 0 even though prompt says baseline is 1 | Low | The prompt states "maps cannot disable" voice chat but then calibrates solo deathrun maps at stranger: 0. This is editorially reasonable but contradicts the prompt text. Clarify: solo-instance maps (no other players possible) = 0, multiplayer-lobby maps = at least 1 |
