---
slot: coach.md
game: brain
purpose: What the coach is, when it is allowed to speak, and how its reasoning is judged, so a prompt change can be argued about with numbers rather than taste.
status: draft, unreviewed by Steve
sources:
  - docs/rules.md
  - docs/roadmap.md
  - lib/coach/evaluate.ts, lib/coach/checks.ts, lib/coach/run.ts, lib/coach/fixtures.ts
  - UsableAICodePT-TileGame (the frozen study fork): backend/agent/SUCCESS_CRITERIA_AND_BENCHMARKS.md, FEEDBACK_DISPLAY_POLICY.md, AI_FEEDBACK_LOGGING_REQUIREMENTS.md
---

# The coach

**Marker key is in `docs/README.md`.**

## 1. What the coach is

A referee on form, never on side. It reads one reason, checks it against a fixed
checklist, and either names one rule card or says nothing. It has no opinion
about the topic and never indicates one `[unratified: lib/coach/evaluate.ts:95]`.

**Silence is the normal answer.** Most reasons find nothing, and the coach does
not reach `[unratified: lib/coach/evaluate.ts]`.

**It never gates play.** It runs after the reason is already in the log, never
before, so a failure of any kind, a missing key, a timeout, an unparseable
answer, leaves the game exactly as it was `[ruled: Steve, 2026-08-23]`. The
coach is an offer, not a gate.

## 2. Where it speaks

- **The Gym**, levels 1 to 4.
- **Solo play** (`docs/solo-play.md`), on the human's own reasons only.
- **Not in live play against another person** `[ruled]`.

## 3. What it reads and what it may say

One structured call per reason, four tasks: structure, the nine checks, on the
root, clarity `[unratified: lib/coach/evaluate.ts:95]`.

Nine checks are detected. Five may be shown to a player and four are recorded
without being surfaced, so nobody is taught nine rules at once
`[unratified: lib/coach/checks.ts:66]`. A reason that trips only a
research-only check is silence, not a hedged remark.

**At most one card** `[unratified: lib/coach/evaluate.ts:76]`. A reading never
stacks critiques.

A rewrite is offered only when it fits a tile, preserves the player's stance and
the model's own confidence is high or medium `[unratified:
lib/coach/evaluate.ts:286]`.

## 4. Refinements to the reasoning

These change how strictly the existing checks fire. None of them adds a concept,
a card or a screen. Every one makes the coach speak less, which is the direction
the bar in section 5 points.

1. **The trigger phrase must be real.** The reading already returns the words
   that triggered it. Verify that string appears in the reason, and drop the
   finding when it does not `[vibecoded]`. A model that is reaching cannot
   usually point at the words.
2. **Pin the sampling.** The call sets no temperature and so runs at the default
   `[unratified: lib/coach/evaluate.ts:312]`. Set it to 0, so the same reason
   scores the same way twice and a prompt change can be told apart from luck.
3. **Hedges are not scale words.** Overgeneralization accepts "most", "almost
   all" and "nearly everyone" as its scale condition
   `[unratified: lib/coach/checks.ts:207]`. Add a DO-NOT-FLAG line, in the style
   of the ones already there: hedged claims ("often", "tends to", "in many
   cases", "generally") do not satisfy it `[vibecoded]`.
4. **Short is not unclear.** A short but interpretable claim passes without
   clarification feedback even when it is not detailed. Carried from the study's
   display policy. Tiles are capped at 100 characters, so brevity is the format.
5. **Examples in the prompt are paired.** The FLAGGED and NOT FLAGGED examples
   inside the checks are what the model imitates, so they carry the same
   left/right pairing discipline the fixtures already use `[vibecoded]`.
6. **Feedback quotes the words.** The sentence shown to the player contains the
   trigger phrase `[vibecoded]`. Vague advice becomes structurally impossible and
   the rule is checkable rather than a matter of taste.

Every one of these is a prompt or threshold edit, so each bumps
`NU_PROMPT_VERSIONS` or `NU_THRESHOLD_VERSION` and is measured on the same case
set before and after `[unratified: lib/coach/checks.ts:28]`. A refinement that
did not move a number is a refinement nobody can defend.

## 5. The bar

Judged on labelled cases, deliberately lopsided
`[unratified: lib/coach/coach-eval.test.ts]`:

| Measure | Bar | Why |
|---|---|---|
| False alarms on clean reasons | 0 | A coach that speaks on a good reason teaches the player to stop reading the panel, which costs the whole feature |
| Right card when one is broken | at least 85% | The study's own floor, carried over |
| Wrong card when one is broken | tolerated, a couple at a time | A bad hint is cheaper than a false alarm |
| Rewrites that do not fit a tile | at most 2 in 8 | An unusable rewrite quietly drops the dare button |
| Left/right pairs | scored identically, every pair | The only way an asymmetry is visible at all |

The trade is precision against recall and cannot be won on both sides. This bar
chooses precision: a missed problem costs one teaching moment, a false alarm
costs the feature. **If playtesting says the coach never has anything to say,
the dials to loosen are refinement 3 and refinement 1, in that order**
`[vibecoded]`.

## 6. The case set

`lib/coach/fixtures.ts` holds 12 cases `[unratified]`. Two rules already govern
it and both stay: every case is labelled with the card that should be cited or
with silence, and every case that leans political is paired with an equally vivid
one leaning the other way on the same topic.

**Grow it from the study's labelled cases.** The frozen study fork carries 21
reasoning cases, 16 full-tile cases and 5 co-player cases, each with topic,
parent text, tile text and expected labels. Categories map as follows
`[vibecoded]`:

| Study category | Brain |
|---|---|
| overgeneralization | No Exaggeration |
| clarification-needed | Help Me Understand |
| structure IRRELEVANT | Stick to the Thread's Root |
| false causation | **no card**: Causality is Complicated is a level 8 card and is deferred. These cases are labelled silence, or parked |

**Spend new cases on near-misses.** Reasons that almost break a rule and should
not be flagged are what defend the bar in section 5. Clear violations are the
easy half.

## 7. What is recorded

Every reading is logged, **including the ones where the coach says nothing, and
why** `[vibecoded]`. Today only a delivered nudge leaves a trace, which means the
false-alarm rate in section 5 is measurable against fixtures and never against
real play.

Carried from the study's logging requirements: game, tile, player, topic, the
reason's text and its parent's, time, schema version, model name, prompt version.
Brain already pins a model, a prompt version and a schema version
`[unratified: lib/coach/evaluate.ts:62]`.

## 8. Running the harness

The bake-off is a test skipped unless an environment variable is set
`[unratified: lib/coach/coach-eval.test.ts]`, so in practice it does not run.
Make it a command anyone can run, and run it whenever the prompt, the thresholds
or the model pin change `[vibecoded]`.

## 9. The number to watch after launch

**How often the coach speaks per game in real play.** Near zero means the
refinements went too far, and no fixture score will tell you that.

## 10. Not specified here

- A score for a whole game, and a review of the round when it ends. Both are
  wanted and neither is designed. The study's rubric scores three dimensions out
  of ten, reasoning quality, engagement and constructive stance, and is the
  obvious starting point. GAP: whether Brain wants a score at all, and whether a
  number attached to how you argued helps or discourages.
- Asking the coach a question. The study has it; Brain does not.
- Anything about Heart's coach. Different game, different rules, different
  document.
