# Lumikin Rescoring Pipeline — Build Spec

## Context

You're working on **Lumikin**, a game evaluation system that scores games using a rubric of dimensions (40+ for standalone games, 9 collapsed for UGC experiences). The database currently holds ~5,000 scored games and is growing toward 10,000 before beta. Stack is Next.js + Postgres.

Lumikin produces a **lumiscore** for each game. When a game's lumiscore differs from its Metacritic score by more than a configured threshold, the game is flagged for **debate** — a multi-agent process where models argue toward a resolved score. Debate is a disagreement-resolution mechanism, not the default scoring path.

The rubric evolves over time. When it does, games need to be rescored. Three problems we're solving:

1. **Score drift / evidence contamination** — new rescores shouldn't be anchored on prior runs' judgments or evidence.
2. **Coverage regression** — sometimes an older run caught a "gold nugget" (a real observation under the new rubric) that a new run misses, often because the new run used a different model or got unlucky on a stochastic generation.
3. **Debate continuity** — when a previously-debated game is rescored, prior debate transcripts contain rich evidence (multiple agents argued claims about the game) but also entangled judgment (which arguments won). We want the evidence without the judgment.

The solution is a **two-pass pipeline with provenance tagging and a conditional debate trigger**:

- **Pass 1 (cold-start):** New rubric runs with zero exposure to prior data. Produces the canonical score.
- **Pass 2 (addendum):** Sees prior-run evidence (including extracted claims from prior debate transcripts) and asks: "did the cold-start miss anything material under the new rubric?" Produces an addendum record, never overwrites the canonical score. Material findings get flagged for human review.
- **Conditional debate:** After cold-start (and after any addendum-triggered rescore), the lumiscore is compared to Metacritic. If the delta exceeds the threshold, a debate run is triggered. Debate replaces canonical for that `(game, rubric_version)` pair on resolution.
- **Provenance tagging:** Every score, every piece of evidence, every debate turn gets tagged with rubric version, model, run date, prompt revision, and source.

---

## Build phases

Do these in order. Don't skip ahead.

### Phase 0 — Audit existing schema

**Before writing any new code**, inspect the current database and report back:

1. How are scores stored today? (likely JSON blob per game, but verify)
2. What metadata is already attached to scores? (rubric version? model? timestamp?)
3. How many distinct rubric versions exist in the data, if discoverable?
4. Where does the scoring run actually execute — is it a Next.js API route, a separate worker, a script?
5. **How are debate runs currently stored?** Are transcripts persisted? Is there a `debates` table or similar? What's the current trigger threshold value?
6. How is Metacritic score stored on the game record, and how fresh is it?

Output a short written audit (markdown) before proceeding. **Stop and wait for confirmation** before Phase 1 if anything significant is unclear, if the schema differs meaningfully from "JSON blob per game," or if debate storage is fundamentally different from the per-game-run model assumed below.

### Phase 1 — Provenance schema

Design and migrate to a schema where every score, evidence item, and debate turn carries:

- `rubric_version` (string, semver-ish, e.g. `ugc-2.1.0`)
- `model` (string, e.g. `claude-opus-4-7`) — for debate runs, this is the judge model
- `prompt_revision` (string or hash — whatever identifies the exact prompt used)
- `run_id` (uuid — groups all dimension scores from a single scoring run)
- `run_date` (timestamptz)
- `source` (enum: `current_run`, `prior_run`, `addendum`, `human_override`)

Constraints:

- A game can have multiple runs over time. Don't overwrite — append.
- Add an `is_canonical` boolean on runs. Exactly one run per `(game, rubric_version)` is canonical. The canonical flag is what reports/UI read from by default.
- Backfill existing data: every existing score becomes a run with `source='prior_run'` and `is_canonical=true` for its rubric version. If rubric version is unknown for old data, use `unknown-legacy` and document this.
- Existing debate runs (if any) get backfilled as `pass_type='debate'` with their transcript preserved in `debate_transcript`.

Suggested table shape (adapt to existing schema):

```sql
scoring_runs
  id (uuid)
  game_id
  rubric_version
  model                 -- judge model for debate runs
  prompt_revision
  run_date
  source                -- enum
  is_canonical          -- bool
  pass_type             -- enum: 'cold_start', 'addendum', 'debate', 'legacy', 'human'
  parent_run_id         -- nullable; for addendum: the cold_start it audits.
                        -- for debate: the run that triggered it (cold_start or post-rescore).
  trigger_reason        -- nullable string; for debate: e.g. 'metacritic_delta:18'
  debate_transcript     -- nullable jsonb; full turn-by-turn transcript for debate runs
  agent_roster          -- nullable jsonb; for debate: [{role, model, prompt_revision}, ...]
  metadata (jsonb)

scoring_dimensions
  id
  run_id (fk)
  dimension_key
  score
  confidence            -- nullable, 0-1 if model emits it
  evidence (jsonb)      -- list of {quote, source_ref, observation}
```

Write the migration. Write a backfill script. Run the backfill against a copy of prod data first and report row counts before/after.

### Phase 2 — Cold-start pass

Build a Next.js API route (or worker entry point — match existing pattern from Phase 0) that:

- Takes `game_id` and target `rubric_version`
- Loads game source material (whatever the existing pipeline uses — don't reinvent)
- Calls the model with the new rubric prompt and **zero prior-run context**
- Writes a new `scoring_runs` row with `pass_type='cold_start'`, `source='current_run'`
- Writes `scoring_dimensions` rows for each dimension scored
- Marks this run as canonical for `(game_id, rubric_version)`, un-marking any previous canonical for that pair
- Computes the resulting lumiscore and checks the Metacritic delta — if over threshold, enqueues a debate run (Phase 4)

This is mostly a refactor of whatever scoring code already exists. The key behavioral change is: **no prior-run data is ever loaded into the prompt context**. Add a code-level assertion / lint rule that the cold-start prompt builder cannot import or query the `prior_run` data path.

### Phase 3 — Addendum pass

A separate API route / worker that:

- Takes a `cold_start` run id (the parent)
- Loads the most recent `prior_run` for the same game (or a specified prior run id)
- Extracts evidence items from the prior run — **evidence only, not scores or dimension assignments**
- **If the prior run was a debate run**, also extracts agent claims from the transcript (see "Debate evidence extraction" below)
- Calls the model with the addendum prompt (see below)
- Parses the structured output
- Writes a `scoring_runs` row with `pass_type='addendum'`, `source='addendum'`, `parent_run_id` set, `is_canonical=false`
- Writes `scoring_dimensions` rows only for `verified_material_miss` findings, with full evidence

**Critical constraint:** the addendum prompt must not show the model the prior run's scores, dimension labels, or debate resolutions. Only raw evidence/observations. This is what keeps the new rubric's judgment uncontaminated.

#### Debate evidence extraction

When the prior run is a debate, transcripts contain a tangle of evidence and judgment. To extract the evidence cleanly:

- Walk every turn in `debate_transcript`
- For each turn, extract claims of the form "the game does/has/exhibits X" — factual assertions about the game itself
- **Drop** anything of the form "therefore the score should be X," "I disagree with my opponent," judge resolutions, or argument-meta-commentary
- **Drop** explicit references to dimension names from the prior rubric
- Each extracted claim becomes a prior observation with `source_ref` pointing to the turn it came from

Implement this as a deterministic extraction (regex/structural parsing of turn objects) where possible, falling back to a small dedicated extraction prompt only if transcripts are unstructured. If you use a model for extraction, the extraction prompt itself must not see scores or dimension labels — it sees only the transcript text and outputs claim objects.

#### Addendum prompt

This prompt is the load-bearing piece of the pipeline. It needs to do three things well:
1. Resist defensively agreeing with everything the prior run said
2. Force independent verification against source material
3. Produce structured output that's easy to parse and route

Use this as the system/user prompt structure. Variables in `{{double_braces}}` get substituted at runtime.

```
SYSTEM:
You are auditing a game review for coverage gaps. You are NOT being asked to redo the review or to defer to prior reviewers. Your job is to determine, with skepticism, whether a previous reviewer's observations point to anything the current review missed.

Default stance: the current review is correct and complete. You should only flag a prior observation as a material miss if you can independently verify it from the source material AND it is clearly relevant to a dimension in the current rubric.

You will see:
1. The current rubric (authoritative).
2. The current review's findings (the cold-start pass — treat as the baseline).
3. Source material about the game.
4. A list of raw observations from a previous reviewer. Some may have come from a multi-agent debate transcript; if so, treat them as individual claims to audit, not as a reasoned consensus. You do NOT know what rubric was used or what was scored. Treat all observations as unverified claims, not as judgments.

For each prior observation, output one of four classifications. Be strict. Defensive agreement with the prior reviewer is a failure mode — if you find yourself flagging more than roughly a quarter of observations as material misses, you are likely being too generous.

USER:

# Current rubric (version {{rubric_version}})
{{rubric_definition}}

# Current review findings
{{cold_start_findings_json}}

# Source material
{{game_source_material}}

# Prior observations to audit
{{prior_evidence_list}}

# Output format
Respond with a JSON array. One object per prior observation, in the same order they were given. Schema:

[
  {
    "observation_id": "<id from input>",
    "observation_summary": "<one sentence restating what the prior reviewer claimed>",
    "classification": "not_verifiable" | "verified_but_immaterial" | "verified_already_covered" | "verified_material_miss",
    "verification_reasoning": "<2-3 sentences. For 'not_verifiable': why source material doesn't support it. For verified categories: which specific part of source material confirms it.>",
    "materiality_reasoning": "<for verified_* only: which current-rubric dimension this relates to, or 'none' if immaterial>",
    "coverage_reasoning": "<for verified_already_covered and verified_material_miss only: quote or reference the cold-start finding that does or doesn't already capture this>",
    "affected_dimension": "<for verified_material_miss only: the dimension_key from the current rubric>",
    "suggested_evidence": "<for verified_material_miss only: the exact evidence (quote or observation) that should be added>"
  },
  ...
]

Classification definitions:
- not_verifiable: the prior observation cannot be confirmed from the source material provided. The prior reviewer may have been wrong, or had access to material we don't.
- verified_but_immaterial: the observation is true but does not relate to any dimension in the current rubric.
- verified_already_covered: the observation is true and material, but the cold-start review already captures the same point (possibly in different words). Quote the cold-start finding that covers it.
- verified_material_miss: the observation is true, material under the current rubric, AND the cold-start review does not capture it. This is the only classification that triggers downstream action — apply it sparingly and only with explicit reasoning.

Do not output anything outside the JSON array. No preamble, no markdown fences, no commentary.
```

Implementation notes for the addendum pass:

- Validate the JSON output matches the schema. On parse failure, retry once with a "your previous response was not valid JSON, return only the array" follow-up. After two failures, log and skip.
- The `prior_evidence_list` should strip any score-like fields. Pass observations as `{id, text, source_ref}` only — no dimension labels, no numeric scores, no rubric version from the prior run, no debate resolutions.
- Track classification distribution per batch. If `verified_material_miss` rate is above ~25% across a batch of 50+ games, the prompt is being too generous and needs tightening before continuing.
- Track `not_verifiable` rate too. If it's very high (>50%), the source material loading may be inconsistent between cold-start and addendum passes — they need to see the same source material.

### Phase 4 — Conditional debate pass

Build the debate trigger and execution path:

#### Trigger logic

After any cold-start run (or any run that becomes canonical via Phase 5's rescore mechanism), compute:

```
delta = abs(lumiscore - metacritic_score)
if delta > threshold(rubric_version):
    enqueue_debate(game_id, triggering_run_id, reason=f"metacritic_delta:{delta}")
```

The threshold should be configurable per rubric version (different rubrics may calibrate to Metacritic differently). Store thresholds in a small config table, not hardcoded.

If the game has no Metacritic score, skip the trigger and log it. Don't fail the cold-start.

#### Debate execution

A debate run involves multiple agents (e.g. Advocate, Skeptic, Judge) arguing toward a resolution. Implementation specifics will depend on existing Lumikin debate infrastructure — match that pattern. The constraints that matter for this pipeline:

- **Every agent in the debate must be cold-start-clean.** No agent may receive prior-run scores, prior-run dimension labels, or prior debate resolutions in its prompt context. This is the single most important constraint and needs an explicit code-level check, not just convention. A unit test should assert that the prompts assembled for each agent role contain none of these.
- **Agents may receive cold-start findings as the disputed baseline.** The whole point of the debate is to argue around the cold-start lumiscore vs. Metacritic gap, so the cold-start *is* the input. That's fine.
- **Agents may not receive prior debate transcripts.** If you want prior debate evidence to inform a new debate, route it through the addendum pipeline first (extract claims, audit them, accept the verified ones) — don't feed raw prior debates into a fresh debate.
- **Log every agent.** `agent_roster` records the role, model, and prompt revision for each participant. This matters for reproducibility and for catching cases where a debate's outcome was driven by an agent configuration that's since changed.
- **Persist the full transcript.** Every turn, with timestamp and agent-role attribution. The transcript is itself evidence under provenance tagging.

#### Debate resolution

The judge's resolved scores get written as `scoring_dimensions` rows on the debate run. The debate run becomes canonical for `(game, rubric_version)`, replacing the cold-start as canonical. The cold-start run stays in the database (append-only) but `is_canonical=false`.

#### Re-running the Metacritic check

After a debate resolves, **do not** re-trigger another debate based on the new lumiscore. Debate is a one-shot resolution. Re-triggering would loop. Log if the resolved score still exceeds the threshold — that's a signal the rubric or threshold may need attention, but it's a human-review case, not an automation case.

### Phase 5 — Human review queue

- Build a simple Next.js admin page listing all addenda with `verified_material_miss` findings
- Each entry shows: game, cold-start score for affected dimension, addendum finding, evidence, addendum's verification + materiality + coverage reasoning, **and whether the cold-start triggered a debate** (so reviewers can see the full context)
- Reviewer can:
  - **Dismiss** — addendum was wrong, no action
  - **Accept as note** — record alongside canonical but don't change score
  - **Trigger rescore** — queues a new cold-start run that includes the addendum finding as a hint; this third run becomes canonical, and goes through the Metacritic-delta check again (which may trigger a fresh debate)
- Log every reviewer action with who/when/why (the "why" matters for calibrating the prompt later)

A second admin view: list debates that resolved with the new score *still* exceeding the Metacritic threshold. These are calibration cases — either the rubric genuinely disagrees with Metacritic for defensible reasons (fine, document it), or something's off (fix it).

Don't over-design these UIs. Tables with a few buttons per row are fine. Use whatever auth pattern the rest of Lumikin uses.

### Phase 6 — Metrics

Add a `/admin/rescoring-metrics` page showing:

- **Coverage-regression rate per rubric version:** % of games where addendum pass found ≥1 material miss
- **Score-change distribution per rubric version:** histogram of `(new canonical score − previous canonical score)` per dimension
- **Addendum noise rate:** % of addendum findings dismissed by human reviewers (calibration signal — if high, the addendum prompt needs work)
- **Addendum classification mix:** stacked bar of the four classifications per batch (drift detector for the prompt itself)
- **Debate trigger rate per rubric version:** % of cold-starts that exceed the Metacritic-delta threshold
- **Debate resolution shift:** average `(debate_score − cold_start_score)` — tells you whether debate systematically pulls toward or away from Metacritic
- **Unresolved-after-debate rate:** % of debates whose resolved score still exceeds the threshold
- **Token spend per batch:** running total, with per-game average, broken out by pass type (cold-start vs addendum vs debate)

These metrics are what lets you defend "the new rubric is more rigorous, not just different" when beta launches.

### Phase 7 — Sample-first rollout

Don't run this on all 5,000 games immediately. Build a CLI command:

```
npm run rescore -- --rubric-version=ugc-2.1.0 --sample=200 --strategy=stratified
```

Stratification: spread the sample across score quartiles, across UGC vs standalone, **and across previously-debated vs never-debated games**. Previously-debated games are the highest-information cases for testing this pipeline because they exercise the debate-evidence-extraction path.

Run it, look at the metrics from Phase 6, and only proceed to full-catalog rescore once:

- Addendum noise rate (dismissal rate) is acceptable — target <30% on first calibration pass
- `verified_material_miss` rate is in a sane range (roughly 5–25% of observations)
- `not_verifiable` rate isn't suspiciously high (suggests source material mismatch)
- Debate trigger rate is roughly stable vs. the prior rubric version — a sudden spike or drop suggests the new rubric has shifted its calibration relative to Metacritic in ways worth understanding before rolling out

If any of these are off, fix the prompt or pipeline before scaling up.

---

## Constraints and conventions

- **No prior-run data in cold-start prompts.** Enforce at the code level, not just by convention.
- **Addendum sees evidence, never scores.** Same — enforce in the prompt-builder code. Add a unit test that asserts the assembled addendum prompt does not contain dimension keys, numeric scores, or debate resolutions from the prior run.
- **Every debate agent is cold-start-clean.** Enforce at the code level. Unit test asserts agent prompts contain no prior-run scores, no prior dimension labels, no prior debate transcripts.
- **Debate doesn't recurse.** A debate's resolution does not re-trigger another debate, even if it still exceeds the Metacritic threshold. Log and surface to humans instead.
- **Append-only for runs.** Never delete or update a `scoring_runs` row except for the `is_canonical` flag.
- **Token budget awareness.** Log token usage per run. Surface total spend per rescore batch in the CLI output. Debate runs will dominate cost — make this visible.
- **Idempotency.** Re-running the cold-start for the same `(game, rubric_version)` should be safe — it creates a new run and re-points canonical, doesn't error. Same for addendum and debate.
- **Test with seed data first.** Before touching real data, build a fixture of ~10 games with known prior runs and run the full pipeline end-to-end. Include:
  - At least one game with a deliberate "gold nugget" in the prior run that the cold-start should plausibly miss (verify the addendum catches it)
  - At least one game with a prior debate transcript (verify claim extraction works and that the addendum can audit those claims)
  - At least one game where cold-start lumiscore exceeds the Metacritic threshold (verify debate triggers correctly)

---

## What to deliver

After Phase 0, **stop and report**. After each subsequent phase, report what was built, what tests were run, and any decisions you had to make. Don't bundle phases into a single mega-PR — each phase is reviewable on its own.
