# PlaySmart — Scoring Consistency Brief

> **For Claude Code.** Read `docs/RUBRIC.md`, `docs/experience-scoring.md`, and
> `src/lib/scoring/engine.ts` before starting.
>
> **Goal:** Make standalone game scores (Zelda, Genshin, Minecraft) and UGC
> experience scores (Roblox, Fortnite Creative) directly comparable. Today they
> are produced by different methods, with different weights, different formulas,
> and different time-tier logic — yet the UI presents them identically.
>
> **What this brief does NOT change:**
> - The RIS formula: `RIS = (R1_norm × 0.45) + (R2_norm × 0.30) + (R3_norm × 0.25)`
> - The BDS formula: `BDS = (B1_norm × 0.50) + (B2_norm × 0.30) + (B3_norm × 0.20)`
> - The standalone time-tier thresholds (0.15 / 0.30 / 0.50 / 0.70)
> - The standalone curascore formula (harmonic mean of BDS and Safety)
> - Any existing standalone test fixture (Zelda 0.045, Genshin 0.66, Minecraft 0.14, etc.)
>
> **What this brief DOES change:**
> - How experiences derive `riskScore`, `curascore`, and `timeRecommendationMinutes`
> - Brings experience scoring onto the same arithmetic as standalone scoring
> - Adds an audit trail and a UI signal so cross-method comparisons stay honest
>
> Implement the fixes in the order listed. Each fix is independently shippable.
> Do not bundle them — small PRs, clear diffs.

---

## Fix 1 — Stamp `methodologyVersion` on experience scores

### Why first
Trivial, no behavior change, but unblocks every future recalibration. Without
this, after Fix 2/3 ship you cannot tell which experience scores were produced
under the old equal-weight scheme vs the new rubric-weighted scheme.

### What
In `src/app/api/cron/review-experiences/route.ts`, locate `saveScore()`. Add:

```typescript
import { CURRENT_METHODOLOGY_VERSION } from '@/lib/scoring/version'

// inside saveScore():
methodologyVersion: CURRENT_METHODOLOGY_VERSION,
```

If `CURRENT_METHODOLOGY_VERSION` is not yet exported from a shared location,
extract it from wherever `review-games` imports it and re-export from
`src/lib/scoring/version.ts`. Both crons must read from the same constant.

### Tests
- Unit: `saveScore()` writes the current version string to `experience_scores.methodologyVersion`
- Backfill migration (optional): set existing rows to `'v0.1-pre-consistency'`
  so they're distinguishable from post-fix rows. Don't leave them NULL.

### Acceptance
Every new row in `experience_scores` has a non-NULL `methodologyVersion`
matching the value written to `game_scores`.

---

## Fix 2 — Fortnite Creative `strangerRisk` prompt clarification

### Why now
Pure prompt edit. Zero code, zero schema, fixes a documented contradiction.

### What
In `src/app/api/cron/review-fortnite/route.ts` (or wherever the Fortnite
Creative prompt lives), find the section that says "proximity voice chat is on
by default and maps cannot disable it." Replace the `strangerRisk` calibration
guidance with:

```
strangerRisk calibration:
- 0: Solo-instance maps where no other live players are possible
     (single-player deathrun, aim trainer with no lobby, solo parkour)
- 1: Multiplayer-lobby maps with proximity voice but no chat focus
     (zone wars, box fights — voice exists but gameplay is fast/ambient)
- 2: Multiplayer maps with social/hangout structure
     (hub maps, roleplay maps, lobby-heavy experiences)
- 3: Maps designed around stranger interaction
     (open chat, friend-add prompts, "make new friends" framing)
```

### Tests
None — prompt edit only. Spot-check against the existing 15 hand-curated maps:
their `strangerRisk` values should already match this rubric. If any don't,
flag for review (don't auto-update curated rows).

### Acceptance
Prompt text matches the editorial behavior already in `CURATED_MAPS`. Future
AI-scored Fortnite Creative maps follow the same rule.

---

## Fix 3 — Rubric-weighted risk score for experiences

### Why
This is the structural fix. Today the experience scorer equal-weights 6 risk
dimensions, including `ugcContentRisk` and `privacyRisk` which don't exist in
the standalone rubric. After this fix, experience risk scores use the same
0.45 / 0.30 / 0.25 category weights as the rubric, and `ugcContentRisk` moves
to display-only (parallel with R4 in the rubric).

### Mapping
The 6 experience risk dimensions map to rubric categories as follows:

| Experience dimension | Rubric category | Within-category share |
|---|---|---|
| `dopamineTrapScore` | R1 (Dopamine, weight 0.45) | 1.00 |
| `monetizationScore` | R2 (Monetization, weight 0.30) | 1.00 |
| `toxicityScore` | R3 (Social, weight 0.25) | 0.40 |
| `strangerRisk` | R3 (Social, weight 0.25) | 0.40 |
| `privacyRisk` | R3 (Social, weight 0.25) | 0.20 |
| `ugcContentRisk` | R4 (Content) — display only | 1.00 |

The R3 within-category split (0.40 / 0.40 / 0.20) reflects that toxicity and
stranger exposure are the dominant social risks for UGC; privacy is real but
narrower.

### What
Create `src/lib/scoring/experience-risk.ts`:

```typescript
import type { ExperienceRiskInput, ExperienceRiskResult } from './types'

const v = (n: number | null | undefined): number => n ?? 0

export function calculateExperienceRisk(
  input: ExperienceRiskInput,
): ExperienceRiskResult {
  // Each dimension is 0–3, normalize to 0–1
  const dopamine = v(input.dopamineTrapScore) / 3
  const monetization = v(input.monetizationScore) / 3

  // R3 social: weighted blend of toxicity, stranger, privacy
  const toxicity = v(input.toxicityScore) / 3
  const stranger = v(input.strangerRisk) / 3
  const privacy = v(input.privacyRisk) / 3
  const social = toxicity * 0.4 + stranger * 0.4 + privacy * 0.2

  // R4 content: display only, not in RIS
  const contentRisk = v(input.ugcContentRisk) / 3

  // Same weights as rubric: R1×0.45 + R2×0.30 + R3×0.25
  const ris = dopamine * 0.45 + monetization * 0.3 + social * 0.25

  return { dopamine, monetization, social, contentRisk, ris }
}
```

Add to `src/lib/scoring/types.ts`:

```typescript
export type ExperienceRiskInput = {
  dopamineTrapScore?: number | null  // 0–3
  monetizationScore?: number | null  // 0–3
  toxicityScore?: number | null      // 0–3
  strangerRisk?: number | null       // 0–3
  privacyRisk?: number | null        // 0–3
  ugcContentRisk?: number | null     // 0–3
}

export type ExperienceRiskResult = {
  dopamine: number     // 0–1, comparable to RiskResult.dopamine
  monetization: number // 0–1, comparable to RiskResult.monetization
  social: number       // 0–1, comparable to RiskResult.social
  contentRisk: number  // 0–1, display only
  ris: number          // 0–1, comparable to RiskResult.ris
}
```

### Update `saveScore()` in `review-experiences/route.ts`
Replace the current `riskScore = sum/18` with:

```typescript
const risk = calculateExperienceRisk({
  dopamineTrapScore: scores.dopamineTrapScore,
  monetizationScore: scores.monetizationScore,
  toxicityScore: scores.toxicityScore,
  strangerRisk: scores.strangerRisk,
  privacyRisk: scores.privacyRisk,
  ugcContentRisk: scores.ugcContentRisk,
})
const riskScore = risk.ris
```

Persist the sub-components (`risk.dopamine`, `risk.monetization`, `risk.social`,
`risk.contentRisk`) to new columns on `experience_scores` so the UI can render
the same Risks-tab meters that standalone games show.

### Schema additions
```typescript
// experience_scores
dopamineRisk: real('dopamine_risk'),       // R1 normalized
monetizationRisk: real('monetization_risk'), // R2 normalized
socialRisk: real('social_risk'),            // R3 normalized
contentRisk: real('content_risk'),           // R4 normalized, display only
```

### Benefit score (parallel update)
Apply the same weighted treatment to benefits. Mapping:

| Experience dimension | Rubric category | Within-category share |
|---|---|---|
| `learningScore` | B1 (Cognitive, weight 0.50) | 1.00 |
| `socialScore` | B2 (Social-emotional, weight 0.30) | 1.00 |
| `creativityScore` | B1+B2 split — see note | split 0.5 / 0.5 |

Note: `creativityScore` in the experience scorer covers both expressive
creativity (B1.6 Creativity) and collaborative storytelling (B2 territory).
Split it 50/50 between B1 and B2:

```typescript
const cognitive = (v(learningScore) + v(creativityScore) * 0.5) / 3
const socialEmotional = (v(socialScore) + v(creativityScore) * 0.5) / 3
const motor = 0  // experience scorer does not assess motor — leave at 0

const bds = cognitive * 0.5 + socialEmotional * 0.3 + motor * 0.2
```

This means experience BDS will run somewhat lower than rubric BDS for the same
underlying game, because `motor` is structurally zero. That's honest — the
experience pipeline genuinely doesn't assess motor skills. Document this.

### Tests
- Unit tests for `calculateExperienceRisk()` with the Adopt Me and Raider's
  Edit Course fixtures from `experience-scoring.md`. Verify the new RIS values
  match the predicted standalone-rubric values from the worked comparison
  section (within ~0.05).
- Regression: existing standalone tests must still pass unchanged.

### Acceptance
For Adopt Me (dopamine 2, toxicity 0, ugc 0, stranger 2, monetization 2,
privacy 0):
- Old riskScore: 6/18 = 0.333
- New ris: (2/3)×0.45 + (2/3)×0.30 + ((0×0.4 + 2/3×0.4 + 0×0.2))×0.25
       = 0.300 + 0.200 + 0.0667 = **0.567**
- contentRisk: 0 (display only, was previously diluting the score)

The new value (0.567) is much closer to the predicted standalone-rubric range
of 0.55–0.65 from the worked comparison. This is the consistency win.

---

## Fix 4 — Unified time recommendation for both tracks

### Why
Today, `deriveTimeRecommendation()` is called only for standalone games.
Experiences get their time tier from a prompt heuristic that uses 3 of 6 risk
dimensions and a 6/9 benefit threshold instead of the rubric's 0.60.

After Fix 3, experience `ris` and `bds` are on the same scale and meaning as
standalone. So just call the same function.

### What
In `review-experiences/route.ts` `saveScore()`, replace the prompt-driven time
tier with:

```typescript
import { deriveTimeRecommendation } from '@/lib/scoring/time'

const timeRec = deriveTimeRecommendation(
  risk.ris,
  bds,
  risk.contentRisk,
  experience.ageRating ?? null,  // experiences may not have ESRB; pass null
)

const timeRecommendationMinutes = timeRec.minutes
const timeRecommendationLabel = timeRec.label
const timeRecommendationReasoning = timeRec.reasoning
const timeRecommendationColor = timeRec.color
```

### Update the experience prompt
Remove the time-tier heuristic from the prompt entirely. The AI now only
supplies dimensional scores (the 9 numbers); the engine picks the tier.

Specifically, delete the section that reads roughly:
```
Low risk (dopamine + stranger + monetization all ≤ 1) → 90–120 min
Moderate risk (some 2s) → 60 min
High risk (any 3, or multiple 2s) → 15–30 min
Extend one tier if sum of benefit scores ≥ 6
```

Replace with: "Do not output a time recommendation. The engine derives it
from your dimensional scores."

The AI also no longer outputs `curascore` directly — see Fix 5.

### Tests
- Snapshot test: feed the Adopt Me dimensional scores through the new pipeline,
  verify timeRecommendationMinutes matches what `deriveTimeRecommendation()`
  produces from the same RIS/BDS values.
- Existing standalone time-recommendation tests untouched.

### Acceptance
One time-tier function, called from both crons, with identical thresholds and
modifier rules.

---

## Fix 5 — Formula-derived curascore for experiences (with AI sanity check)

### Why
Today, experience curascore is whatever the AI says it is. The Raider's Edit
Course case proves the gap: predicted formula score ≈48, hand-curated score 76.
A 28-point discrepancy on a 100-point scale.

### What
In `saveScore()` after Fix 3:

```typescript
const safety = 1 - risk.ris
const denom = bds + safety
const curascore = denom > 0
  ? Math.round((2 * bds * safety) / denom * 100)
  : 0
```

This is the exact same formula as standalone games (`engine.ts` line ~25).

Keep the AI's holistic curascore in a parallel column for monitoring:

```typescript
// experience_scores schema addition
curascoreAiSuggested: integer('curascore_ai_suggested'),
```

When `Math.abs(curascore - curascoreAiSuggested) > 10`, log a warning. These
divergences likely indicate that one or more dimensional scores are off and
warrant editorial review. Don't block the save — log and continue.

### Hand-curated Fortnite maps
The 15 maps in `CURATED_MAPS` ship with hand-authored `curascore` values.
After this fix:
- Either recompute their curascore from their dimensional scores using the
  formula (recommended — keeps the system consistent)
- Or add a `curascoreOverride` column and let editorial keep specific values,
  flagged in the UI as hand-curated (see Fix 6)

I recommend recompute, then have an editor review the 15 maps and adjust
dimensional scores if the new curascore feels off — that's the right loop,
because it forces calibration of the inputs rather than the output.

### Tests
- Unit: same formula behavior as `engine.ts` curascore.
- Migration test: recompute all 15 hand-curated maps, diff against their
  current values, output a report. Don't auto-apply; require editorial review.

### Acceptance
`experience_scores.curascore` is deterministically derivable from
`bds`, `ris` via the harmonic-mean formula. The AI's holistic guess is logged
but not displayed.

---

## Fix 6 — UI scoring-method indicator

### Why
Even with Fixes 1–5, three scoring tracks exist:
1. Full rubric (49 dimensions) — standalone games
2. UGC adapted (9 dimensions, mapped to rubric weights) — Roblox + AI-scored Fortnite Creative
3. Hand-curated — `CURATED_MAPS` Fortnite Creative entries

These produce comparable but not identical scores. Parents need a one-glance
signal of which method produced the number they're looking at.

### What
Add a `scoringMethod` field to both `game_scores` and `experience_scores`:

```typescript
scoringMethod: varchar('scoring_method', { length: 20 }).notNull(),
// values: 'full_rubric', 'ugc_adapted', 'hand_curated'
```

In the GameCard header, near the curascore, render a small icon + tooltip:

- 📊 Full rubric — "Scored across 49 dimensions by the standard rubric."
- 🎨 UGC adapted — "User-generated experience scored on 9 dimensions adapted
  from the standard rubric. Risk and benefit weights match; granularity is coarser."
- ✏️ Hand-curated — "Scored by an editor rather than the automated pipeline."

Place it as a subtle subtitle next to the methodology version, not as a prominent
badge. Goal is honesty without alarm.

### Special case: Fortnite BR vs Fortnite Creative
On Fortnite Creative map detail pages, add a one-line callout near the top:

> *This is a fan-made map inside Fortnite. It's scored separately from
> Fortnite itself and the numbers are not directly comparable.*

### Acceptance
Every score row has a non-NULL `scoringMethod`. The UI surfaces it clearly
but not loudly.

---

## Fix 7 — Step 5 age adjustment

### Why
The rubric documents an age-based time adjustment that no engine implements.
Either build it or remove it from the rubric — current state misleads readers.

### What
Build it. Add an optional `childAge` parameter to `deriveTimeRecommendation()`:

```typescript
export function deriveTimeRecommendation(
  ris: number,
  bds: number,
  contentRisk: number,
  ageRating?: string | null,
  childAge?: number | null,  // NEW
): TimeRecommendation {
  // ... existing logic ...

  // Step 5: age adjustment (rubric)
  if (childAge != null) {
    if (childAge < 6) {
      // Halve, cap at 30 min
      const halved = Math.floor(tier.minutes / 2)
      const capped = Math.min(halved, 30)
      return {
        ...result,
        minutes: capped,
        reasoning: result.reasoning +
          ` Time halved and capped at 30 min for under-6.`,
      }
    }
    if (childAge >= 13 && childAge <= 17 && contentRisk < 0.6) {
      // Extend one tier if content-appropriate
      finalIndex = Math.max(0, finalIndex - 1)
      // recompute tier...
    }
  }
}
```

This is invoked at render time when a child profile is selected — not at score
calculation time. Both `game_scores` and `experience_scores` continue to store
the unadjusted recommendation; the per-child adjustment happens in the
component that renders the time pill.

### Schema
No schema changes — child profiles already exist (presumably). The adjustment
is computed on read.

### Tests
- Unit: childAge=4 with 60-min recommendation → 30 min
- Unit: childAge=4 with 30-min recommendation → 15 min (halved to 15, under cap)
- Unit: childAge=14, RIS 0.20, contentRisk 0.3 → tier extends from 90 to 120
- Unit: childAge=14, RIS 0.20, contentRisk 0.7 → tier does NOT extend (content-gated)
- Unit: childAge=null → behavior unchanged from today

### Acceptance
Rubric documentation matches engine behavior. The under-6 cap and 13–17
extension both work and are gated correctly.

---

## Fix 8 — Dimension-collapse note on experience score detail

### Why
After Fix 3, experience scores use rubric weights but only 9 dimensions vs 49.
This is a real loss of resolution. The Full Scores tab on a Roblox card cannot
show R1.1 through R1.10 because that data was never collected.

### What
On the experience Full Scores tab, replace the standalone "10 sub-items per
risk category" detail rows with a single explanatory line:

> *This experience is scored on 9 dimensions adapted from the 49-dimension
> standard rubric. Risk category weights match the rubric (Dopamine 45%,
> Monetization 30%, Social 25%); the per-category sub-items are aggregated
> into a single score.*

Keep the bar charts at the category level (R1, R2, R3 normalized 0–1) since
those numbers are now genuinely comparable across tracks.

### Acceptance
Parents see honest information about the granularity difference without
being told the scores are unreliable.

---

## Out of scope (mention but defer)

These are real issues but should be separate briefs:

- **Dark Pattern Pills (DP01–DP12) for experiences.** The Phase 3+ brief adds
  these for standalone games. To extend to experiences, the experience prompt
  needs to start emitting dark-pattern IDs. This is its own brief.
- **R5 / R6 for experiences.** Roblox is the canonical "infinite, mobile-optimized,
  no stopping points" platform. R5/R6 for experiences should probably be
  inherited from platform-level defaults rather than scored per-experience.
  Separate brief.
- **Backfilling old experience scores under new methodology.** All existing
  experience scores were computed under equal-weight risk. They should be
  recomputed under rubric weights as a one-time migration. Run after Fix 3
  ships and is verified, as a separate maintenance task.

---

## Implementation order summary

| # | Fix | Effort | Risk | Depends on |
|---|---|---|---|---|
| 1 | Stamp `methodologyVersion` | XS | None | — |
| 2 | Fortnite `strangerRisk` prompt | XS | None | — |
| 3 | Rubric-weighted experience risk score | M | Medium — changes scores | 1 |
| 4 | Unified time recommendation | S | Low — purely additive | 3 |
| 5 | Formula-derived curascore | S | Medium — changes displayed numbers | 3 |
| 6 | UI scoring-method indicator | S | None — additive | 1 |
| 7 | Step 5 age adjustment | M | Low — opt-in via param | — |
| 8 | Dimension-collapse note | XS | None | 3 |

Ship 1 and 2 immediately. Then 3 → 4 → 5 as a coordinated release with a
backfill of existing experience scores. 6 and 8 land alongside that release.
7 is independent and can ship anytime.

---

## What NOT to change

Same as the Phase 3+ brief, plus:

- The standalone `engine.ts`, `benefits.ts`, `risks.ts`, `time.ts` core logic
  (only `time.ts` gets a new optional parameter for Fix 7)
- The `RiskResult` and `BenefitResult` types
- Any standalone test fixture
- The Phase 3+ enhancements (dark pattern pills, radar chart, R5/R6,
  compliance badges, engagement loop diagram) — they ship independently
- The 49-dimension rubric structure
