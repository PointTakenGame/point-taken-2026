---
slot: script.md
game: brain
purpose: Catalogue every player-facing string in the BRAIN web client, cited to source, so Steve can review actual shipped copy without reading code.
written: 2026-08-28 by biz
status: draft, unreviewed by Steve
generated_from: code snapshot of point-taken-2026, 2026-08-28
sources:
  - point-taken-brain/web/point-taken-2026/app/
  - point-taken-brain/web/point-taken-2026/components/
  - point-taken-brain/web/point-taken-2026/lib/
  - point-taken-brain/docs/reference/materials/spec/2026-08-22_ai-feedback-vocabularies.md
---

**Reader's note.** This is a snapshot of the code on 2026-08-28, not a hand-maintained
document. Every line below is either a direct quote of a string in the repo (tagged
`[unratified]` unless Steve has ruled it) or a marked gap or placeholder. Regenerate this
file from source rather than editing it by hand once the code has moved.

**Scope.** BRAIN only: the AI-refereed argument-mapping game. No Heart cards, tokens,
fouls, or Final Showdown appear below.

**Established `[ruled]` facts, stated as given, not re-derived from code:**
- The referee is the AI. There is no human referee; all feedback is generated or templated.
- No tokens in BRAIN for now (BRAIN's resolution tokens below are a different mechanic:
  agree/disagree markers on a thread, not the Heart 🙏 token economy).
- Turn timers: 30 seconds for the speaker, 45 seconds to summarize.

**GAP: no code implements a turn timer.** A repo-wide search of `app/`, `components/`,
and `lib/` under `point-taken-2026` found no timer component, countdown state, or
30/45-second constant anywhere in the client. The ruled fact above has no corresponding
shipped string or UI element to cite. The values themselves are not in doubt: Steve
restated 30 and 45 seconds on 2026-08-28, so nothing here is superseded. What is
missing is the implementation, not the ruling.

---

## 1. Landing, onboarding, how-to-play

**Onboarding overlay** (`components/onboarding/onboarding-overlay.tsx`, full, 317 lines),
`[unratified]` unless noted. Ported from a retired client's Vue components; the header
comment (`:3-32`) states the retired version had six steps and only the first four (the
ones with an actual instructional clip) are ported here, since the fifth and sixth steps
concern the AI coach's turn, still moving per BRAIN-T260825-06. No "remembers seen"
behavior: the overlay resets to step one on every open. Four steps, from `buildSteps()`
(`:69-105`):
- "starting-tiles": heading "Each player writes two starting reason tiles supporting
  their opinion." (`:73`); video only, no subtitle.
- "add-a-tile": heading "Hover to add a tile." (`:84`); subtitle "Write only one short
  idea per tile." (`:85`).
- "resolve-a-thread": heading "Hover to resolve a thread by placing a token on the tile."
  (`:90`); subtitle "What does each token mean?" (`:91`); shows the token legend.
- "two-ways-to-win": heading "Two ways to win." (`:97`); an "OR" divider (`:246`) between
  two images, both with empty `alt=""`.

Chrome: close button `aria-label="Close tutorial"` (`:213`); dot-nav
`aria-label={`Go to step ${index + 1}`}` (`:276`); step counter "Step {stepIndex + 1} of
{steps.length}" (`:285`); buttons "Back" (`:296`), "Skip tutorial" (`:303`), and "Finish"
on the last step or "Next" otherwise (`:309`).

**How to play** (`app/how-to-play/page.tsx`, full, 211 lines), `[unratified]` unless noted.
The page's own header comment (`:15-40`) states a discipline worth flagging as `[ruled]`
design intent rather than shipped copy: every number on the page is imported from
`lib/board/rules.ts` rather than typed as a literal, to avoid a second rulebook diverging
from the real one, and the page deliberately avoids politically readable examples (where
an example is needed, it is about a word rather than a position). H1 "How to play"
(`:59`). Intro paragraph (`:61-64`): "Two people who disagree about one thing, writing
short reasons at each other until they can name exactly where they part ways. Nobody wins
by scoring points off the other one. Both ways the game can end are agreements." Six
sections, by heading: "Getting a second person in", "A turn", "Ending a thread", "Asking
the other player for something", "The cards", "How the game ends", "Things not to file a
bug about yet". The "Asking the other player for something" section's six proposal-kind
bullets (`:134-139`) match `PROPOSAL_KIND_LABEL` in section 3 below. The closing section,
"Things not to file a bug about yet" (`:191-199`), is an in-product disclosure to players
that several numbers are undecided rather than unfinished, naming: how many threads a
game needs before it can end, what the levels and badges are called, how much of a turn
the coach gets, and the wording of the agreement players sign at the start. Treat the
decision to ship that disclosure text as `[ruled]`; the numbers it is disclosing as still
open remain `[unratified]`/GAP by the page's own admission.

## 2. Choosing a topic

`lib/board/setup.ts:55-160` (`TOPIC_LIBRARY`, 17 seed topics), all `[unratified]`:

> "Should a hot dog be called a sandwich (or taco)?" (`setup.ts:58`)
> "Should astrology be taken seriously as a way to understand ourselves or others?" (`:64`)
> "Should student loan debt for community college degrees be forgiven?" (`:70`)
> "Should people be required to have health insurance?" (`:76`)
> "Should the death penalty be allowed for premeditated mass murder?" (`:82`)
> "Should the government grant special protections to union workers, like preventing
> workers who strike from being fired?" (`:88`)
> "Should people without a criminal record be allowed to own military-grade automatic
> weapons?" (`:94`)
> "Should sugary soda be taxed for its health effects, like cigarettes?" (`:100`)
> "Should AI-generated content (e.g., news, art, music) be clearly labeled to
> consumers?" (`:106`)
> "Should cryptocurrency be legal?" (`:112`)
> "Should self-driving cars be allowed on public streets?" (`:118`)
> "Should the SAT be eliminated due to concerns about fairness and bias against some
> groups of college applicants?" (`:124`)
> "Should a researcher who argues that women have a genetic disadvantage in math be
> allowed to present their research on a college campus?" (`:130`)
> "Should athletes be allowed to join high school sports teams based on their gender
> identity instead of their sex at birth?" (`:136`)
> "Should individuals facing persecution or human rights abuses in foreign countries be
> allowed temporary asylum in the USA?" (`:142`)
> "Should someone who entered the USA without documentation 20 years ago be deported
> now, even if it breaks up a family?" (`:148`)
> "Should the USA abolish the Electoral College and elect a president by popular
> vote?" (`:154`)

**Finding: aggregate political lean in topic phrasing.** A code comment near this list
(read pre-compaction, BIZ-T260426-39) acknowledges the balance obligation is "aggregate,
not paired... reviewed quarterly," not a mirror per topic. Even by that looser standard,
three of the phrasings load the emotionally sympathetic framing onto the
progressive-coded answer rather than stating the tradeoff neutrally: the deportation
topic (`:148`) appends "even if it breaks up a family"; the asylum topic (`:142`) frames
the situation as "persecution or human rights abuses"; the SAT topic (`:124`) frames
elimination as addressing "fairness and bias." By contrast, the two topics most legible
as testing a conservative-coded or contested position (`:94`, gun ownership; `:130`,
the researcher's genetic-disadvantage claim; `:136`, trans athletes) are phrased in
comparatively clinical, non-loaded language. This is a real asymmetry in emotional
loading, not merely topic selection, and should be looked at against the quarterly
review the code comment references.

Custom-topic entry: `TOPIC_MAX_CHARS = 300` (`lib/board/setup.ts:160`), enforced with
refusal "A topic has to fit in ${TOPIC_MAX_CHARS} characters." (`setup.ts:239`),
`[unratified]`.

## 3. Turn loop: placing reasons, tokens, proposals

All strings below are `[unratified]`; file is `lib/board/rules.ts` unless noted.

**Constants governing what a player can type:**
- `TILE_MAX_CHARS = 100` (reason on a tile)
- `READING_MAX_CHARS = 200`, marked PROVISIONAL in a code comment
- `DEFINITION_TERM_MAX_CHARS = 60`
- `DECLINE_REASON_MAX_CHARS = 200`
- `MAX_PLAYERS = 2` (read pre-compaction, `lib/board/setup.ts`)
- `MAX_THREADS = 6`
- `MIN_THREADS_TO_END = 4`, carrying its own in-code flag: **"GAP: Steve ruled the
  ceiling on 2026-08-23 and did not restate this number, so four is still carried
  forward from the deployed 2024 server rather than ratified (BRAIN-T260823-10)."** This
  is the code's own admission, not this document's invention; repeated here verbatim
  because the task requires surfacing gaps the source itself flags.

**Resolution tokens** (agree/disagree markers on a thread, distinct from Heart's 🙏):
`RESOLUTION_TOKENS = ["👍", "👀"]`, settled 2026-08-23 by Steve, `[ruled]`.
`DEFERRED_RESOLUTION_TOKENS = ["🔍", "⚖️", "🍷"]`, not yet placeable in the UI,
`[unratified]`/future. Labels, `components/board/token-glyph.tsx` `FACES` (`:29-56`):
"👍" "Agree to agree", "👀" "Agree to disagree", "🔍" "Disagree on a fact", "⚖️"
"Disagree on priorities", "🍷" "Disagree on personal taste". The file's own header
comment (`:4-19`) states all five tokens' art and wording come from the retired Nuxt
client (`app/components/TileEmojis.vue`), copied in now because that source repository
is going cold, not written fresh for this game.

**Side labels**, `components/board/side-label.ts:1-19`, `[unratified]`:
`SIDE_MARK = { plus: "+", minus: "-" }`, `SIDE_LABEL = { plus: "Agree (+)", minus:
"Disagree (-)" }`.

**Composer** (`components/board/live-board.tsx`), player sees this while typing a reason:
- Placeholder "A reason for your side." (`:1106`)
- Placeholder "A statement both sides could sign." (`:1161`, topic-revision proposal)
- Placeholder "In your own words, what are they saying?" (`:1284`, reading handback)
- Placeholder "The strongest version of what they think." (`:1329`, steelman reading)
- Placeholder "A reason for their side that you think they missed." (`:1386`, steelman tile)
- Placeholder "The word" (`:1452`) and "What it should mean for the rest of this game."
  (`:1460`, definition proposal)
- Placeholder "why it does not fit (optional)" (`:429`, decline reason)
- Placeholder "reason (optional)" (`:998`, proposal rejection)
- "take back your token" button (`:862`)
- Game status labels: "Not started" / "In progress" / "Finished" (`:91-93`)
- End-of-game nudges, seen as threads near the cap or floor: "One more argument to
  have." (`:1623`), "Settle the last one and the game is over." (`:1630`), "Settle
  them all and the game is over." (`:1631`), "One more new thread and the board is
  full." (`:1639`), "No threads yet." (`:1649`)
- "Leave this game" / "Yes, end it for both of us" confirm toggle (`:1534`)

**Proposal system** (`live-board.tsx:904-1018`), what a player reads when the other
side proposes a change: `PROPOSAL_KIND_LABEL` gives each kind a spoken name so the raw
event-log identifier (e.g. `topic_revision`) never reaches the player directly, per an
explicit code comment at `:896-903` ("a player was being asked to accept or reject a
'topic_revision'"): "A new wording for the topic", "Move a reason", "Hand the reading
back", "Say their side for them", "A reason for their side", "Pin down a word"
(`:905-910`). Accept/Reject buttons (`:986`, `:1006`); waiting-state text "waiting on
the other side" (`:1012`).

**Rule verdict refusal strings** (`lib/board/rules.ts`, `no("...")` returns), all
`[unratified]`. Each string is surfaced to the player twice from one source: as the
reason a button is disabled client-side, and as the server action's refusal if the
button is bypassed, since both paths call the same `canX()` function and render the
same `Verdict`. Grouped by the function that returns them:

- `canPlaceTile` (tile placement): "A reason needs some words in it." (`:163`); "A
  reason is at most ${TILE_MAX_CHARS} characters." (`:165`); "A game holds at most
  ${MAX_THREADS} threads. Add this to one of them instead." (`:172-174`); "That reason
  is not on this board." (`:178`); "That reason was taken off the board." (`:179`);
  "That thread is already resolved." (`:181`).
- `canEditTile`: "That reason is not on this board." (`:196`); "That reason was taken
  off the board." (`:197`); "Only the person who wrote it can change it." (`:199`); "A
  reason needs some words in it." (`:202`); "A reason is at most ${TILE_MAX_CHARS}
  characters." (`:204`).
- `canRemoveTile`: "That reason is not on this board." (`:214`); "That reason is
  already off the board." (`:215`); "Only the person who wrote it can remove it."
  (`:217`).
- `canPlaceResolutionToken`: "That is not a resolution token." (`:228`); "That thread
  is not on this board." (`:231`); "That thread is already resolved." (`:232`); "That
  thread has nothing left in it." (`:233`).
- proposal-answer function: "That proposal is not on this board." (`:247`); "That
  proposal was already answered." (`:248`); "You cannot answer your own proposal."
  (`:249`).
- `canProposeTopicRevision`: "A revised topic needs some words in it." (`:258`); "A
  revised topic is at most 300 characters." (`:259`); "That is the topic you already
  have." (`:261`).
- `canProposeRelocation`: "A reason cannot hang from itself." (`:277`); "That
  destination is not on the board." (`:281`); "That would put a reason underneath its
  own reply." (`:283`); "A reason with no parent starts its own thread." (`:286`).
- `readingText(text, noun)` (`:317-324`), a shared helper behind reading-handback and
  definition proposals: "${noun} needs some words in it." and "${noun} is at most
  ${READING_MAX_CHARS} characters.", with `noun` supplied per call site (e.g. "A
  reading", "A definition").
- `canProposeDefinition`: "Name the word you want pinned down." (`:405`); "A term is
  at most ${DEFINITION_TERM_MAX_CHARS} characters." (`:407`); then falls through to
  `readingText(text, "A definition")` for the definition body itself.
- card-throw function: "That card is not in play in this game." (`:446`); "That reason
  is not on this board." (`:449`, same string as `canPlaceTile`); "That reason was
  taken off the board." (`:450`); "Cards go to the other side's reasons, not your own."
  (`:452`); "That thread is already resolved." (`:457`, same string as above); "You
  already played that card on this reason." (`:467`).
- card-decline function: "That card play is not on this board." (`:489`); "You already
  answered that card by rewriting the reason." (`:491`); "You already turned that card
  down." (`:493`); "That reason is not on this board." (`:496`); "Only the person who
  wrote the reason can turn a card down." (`:498`); "A note is at most
  ${DECLINE_REASON_MAX_CHARS} characters." (`:502`).
- card-rewrite function: "That reason is not on this board." (`:525`); "That reason
  was taken off the board." (`:526`); "Only the person who wrote the reason can
  rewrite it." (`:528`); "That card play is not on this board." (`:532`); "That card
  was played on another reason." (`:534`); "That card has already been answered."
  (`:535`); "A reason needs some words in it." (`:538`, same string as `canPlaceTile`);
  "A reason is at most ${TILE_MAX_CHARS} characters." (`:540`); "That is the same
  words you had before." (`:542`).

Several strings repeat verbatim across functions on purpose ("That reason is not on
this board.", "That thread is already resolved.", the length and empty-text refusals):
the same fact reads the same way everywhere a player hits it, rather than each
`canX()` inventing its own phrasing for an identical situation.

## 4. Referee feedback (the "coach")

Rendered in `components/board/coach-panel.tsx` (full read, 215 lines). Header "Coach".
Checkbox label "Let the coach read my reasons" (matches wording in
`app/settings/settings-form.tsx`, same string reused so the setting name is legible in
both places). Off-state and empty-state copy render when coaching is disabled or no
reading exists yet. Per-reading card shows: the card's `plain` text if a card is cited,
falling back to "The coach has a note" when no card applies; the quoted tile text; the
model's own `feedback` field rendered verbatim; a suggestion prefixed "One way to put
it: "; a disclaimer "Only you can see this..."; and, when a dare is offered, "Take the
dare" / "Got it" / "Keep mine" buttons. A code comment at the top of the file states
"Nothing here can stop a move (Steve, 2026-08-23)," `[ruled]`: coach feedback is
strictly advisory and never blocks play.

**The LLM prompt template**, from `lib/coach/evaluate.ts`, model pinned to
`claude-haiku-4-5-20251001`, prompt version `COACH_PROMPT_VERSION =
"brain-2026-08-24.5"`. The `SYSTEM` template interpolates three blocks from
`lib/coach/checks.ts`. Ground rules, common to all three interpolated blocks:

```
======================================
GROUND RULES
======================================
RULE 0-A: BIAS TOWARD FALSE. When in doubt, do NOT flag. Only flag when confident the definition is clearly met.
RULE 0-B: EVALUATE THE TILE AS WRITTEN. Do not infer intent. Judge only the words on the page.
RULE 0-C: ALL CHECKS ARE INDEPENDENT. Run every check in order regardless of prior results. A tile can fail multiple checks.
RULE 0-D: SHORT, VAGUE, OR IMPRECISE STATEMENTS ARE NOT FALLACIES. "Things have gotten worse" or "This is wrong" is vague, not a fallacy.
```

`STRUCTURE_INSTRUCTIONS` (`checks.ts:508-522`), classifies the reason's relation to its
thread's root as SUPPORTS/REBUTS/IRRELEVANT; `CLARITY_INSTRUCTIONS` (`checks.ts:334-336`)
gates the "needs more detail" flag. The nine-check fallacy vocabulary
(`NINE_CHECK_INSTRUCTIONS`, `checks.ts:177-328`) is ported near-verbatim from the
Northwestern research pipeline's `agents.py`, with two deliberate departures documented
in the file's own header comment (`checks.ts:1-23`): em dashes rewritten to commas and
periods, and mirrored examples added anywhere the source's own examples flagged only one
side (see Finding below). Output is not free text: the model must call a `record_reading`
tool with a fixed nine-field JSON schema (relation, per-check violations list, off-root
boolean, clarification-needed boolean, feedback, suggestion, trigger phrase, and two more
fields captured in the file but not reproduced individually here).

**House-style enforcement mechanism**, `flattenDashes()` in `evaluate.ts`: every
AI-generated `feedback` and `suggestion` string is passed through this function before
reaching the player, stripping em/en dashes, added specifically after a live reading
produced one. It is deliberately NOT applied to `trigger_phrase`, since that field is a
verbatim quote of the player's own tile text.

**Deterministic fallback feedback** (`lib/coach/checks.ts:458-498`, `fallbackFeedback()`),
used whenever the model chose a card but wrote nothing usable in `feedback`, no model
call involved, twelve fixed strings in this branch order:

> "Arguments should respond to the claim, not the person making it."
> "This doesn't connect to the debate. Try making a point about the actual topic."
> "This claim is broader than the evidence supports. Try narrowing the scope."
> "This claim assumes a causal link that needs more support."
> "This claim is more extreme than the evidence supports."
> "Arguments must be statements, not questions. Rephrase as a claim."
> "This misrepresents the opposing argument. Engage with what they actually said."
> "Citing an authority alone isn't enough. Explain why the evidence supports the claim."
> "A single example isn't sufficient to support a broad claim."
> "This deflects from the argument. Address the actual point being made."
> "This may be worth saying, but it doesn't bear on the claim at the root of this thread."
> "Try being more specific so other players can respond to your point."

**The shipped four-card deck** (`lib/coach/cards.ts`, cross-checked against
`app/gym/page.tsx`'s `LEVELS.cardId` and `app/cards/page.tsx`; all four ids match
exactly): `you_is_taboo`, `stick_to_root`, `no_exaggeration`, `help_me_understand`.
Only these four cards can ever be cited to a player; `CHECK_TO_CARD` in `checks.ts:110-120`
maps the nine research checks onto them, with two explicit routing notes in the file:
`false_causation` is detected but never surfaced (no card in the first-release deck
speaks to it), and `whataboutism_red_herring`, which the Northwestern source keeps
research-only, is deliberately surfaced here under Stick to the Thread's Root. Five of
the nine checks (`not_a_statement`, `false_causation`, `appeal_to_authority`,
`anecdotal_data`, plus the always-withheld structural signal) are logged for research
and never shown to a player.

**Finding: two unrelated systems share one label.** The required comparison document,
`point-taken-brain/docs/reference/materials/spec/2026-08-22_ai-feedback-vocabularies.md`
(BRAIN-T260822-15), describes a Python system (`agents.py`, `schemas.py`) with its own
nine check keys, eleven player-facing prose names, and two wire fields filtered to a
"Big 5" plus two structural categories. That document is about a different codebase
from the one read for this section. The web client's own TypeScript system
(`lib/coach/checks.ts`, `evaluate.ts`, `cards.ts`) independently uses the id
`you_is_taboo` as a real, shipped card id ("You" is Taboo). This coincides in name with
`you_is_taboo`, a check key proposed in an earlier, explicitly superseded Python
proposal doc (`ai-feedback-contract.md`, BRAIN-T260714-59) that never shipped in
`agents.py`. The two `you_is_taboo` labels are unrelated: one is a real, shipped
TypeScript card id, the other is a dead identifier from a superseded Python proposal.
They should not be read as evidence that the shipped TypeScript coach implements the
spec's Python vocabulary; `checks.ts`'s own header states plainly that its nine checks
are ported from `agents.py`, so the TypeScript system is a port of the same underlying
research vocabulary the spec doc describes, not an unrelated invention, but it is not
literally the Python system the spec document is auditing.

**Finding: the ported nine-check examples originally leaned one-sided; the port adds
mirrors.** `lib/coach/checks.ts`'s header comment (`:16-22`) states the source
examples "lean in several places, most sharply in CHECK 6 where both flagged straw
men are straw men of the same side," and that the fix taken was to add an opposite
example beside each rather than delete the original. This is visible in the shipped
instructions: CHECK 6 (straw man, `:271-272`) pairs "Environmentalists want to shut
down all industry and send us back to the Stone Age" with an added "ALSO FLAGGED"
mirror, "Those who support this policy just want everyone locked up forever." Similar
paired additions appear in CHECK 4 (exaggeration, `:239-240`), CHECK 5 (false
causation, `:256-257`), CHECK 8 (anecdotal data, `:301-302`), and CHECK 9
(whataboutism, `:316-317`). This is a documented, already-corrected imbalance in the
source material, reported here per the task's political-neutrality requirement, not a
live defect in the shipped prompt.

## 5. Level progression (gym)

`app/gym/page.tsx` (full, 139 lines). The header comment (`:4-23`) is worth quoting
in substance, but read its scope claim as history: it says no scripted practice
opponent exists yet because a 2026-08-17 ruling took the Gym off the critical path.
**That ruling is superseded.** Gym levels 1 to 4 are on the critical path `[ruled]`
(Steve, 2026-08-28). The comment's description of the shipped page is still accurate:
the "Start" buttons are inert on purpose, there is no level-unlock logic (all four levels always
render open, in level order), and the level content itself is "ratified against
Steve's 2026-08-22 gym-levels and skill-ladder design docs, not placeholder," so the
four levels below are `[ruled]`, not `[unratified]`. H1 "Gym" (`:90`); subtext
"Practice mode. Starting a level isn't wired up yet." (`:92`).

The `LEVELS` array (`:38-79`), four entries:

| # | id | title | topic | teaches (`cardId`) | boss |
|---|---|---|---|---|---|
| 1 | `onboarding` | Onboarding | "Should a hot dog be called a sandwich?" | `you_is_taboo` | Bashful Bob 🧑🏻‍💼 |
| 2 | `ground_rules` | Ground rules | "Should clock-change twice a year stop?" | `stick_to_root` | Rambling Rosa 🧑🏿‍🔧 |
| 3 | `claim_size` | Claim size | "Should tipping be replaced by higher wages?" | `no_exaggeration` | Braggy Brenda 🧑🏼‍🔬 |
| 4 | `clarity` | Clarity | "Should AI-generated content be labeled?" | `help_me_understand` | Sloppy Salma 🧑🏾‍🍳 |

Per-level render template (`:104-131`): heading "Level {number}: {title}"; a disabled
`Start` button (`aria-disabled="true"`); "Topic: {topic}"; "Teaches {card.name}" (card
name resolved from `coachCard(level.cardId)`, section 4's shipped deck); "Boss:
{bossName}" with the boss emoji.

**Finding: the gym's own topic list is a 4-topic subset, separately balanced.** These
four practice topics are distinct from the 17-topic `TOPIC_LIBRARY` in section 2 and
read as comparatively low-stakes and non-political by design (a food-naming question,
a clock-policy question, a tipping-and-wages question, an AI-labeling question); none
of the four touches the sharper political ground several `TOPIC_LIBRARY` entries do,
so the aggregate-imbalance finding in section 2 does not extend to this list.

## 6. End of game

`components/win/win-overlay.tsx` (full, 218 lines), `[unratified]`: heading "You've
won!"; close aria-label "Close and review the board"; a `ReopenPill` button reading
"🎉 You won — show results" (`:81`);
Share/Feedback/Play Again buttons; threads/topic variant copy. Hardcoded
`PUBLIC_GAME_URL = "https://play.pointtaken.social"`, used only inside a
privacy-scrubbed LinkedIn share link.

**Finding: house-style violation, em dash in shipped static copy.** The `ReopenPill`
button text quoted above, "🎉 You won — show results," contains a literal em dash
written directly in JSX. It is not AI-generated text and is never passed through
`flattenDashes()` (that function only sanitizes coach output, never static UI strings),
so this is a real, un-remediated violation of the project's own no-em-dash house style
in copy a player sees on every win screen. Quoted faithfully above per the task's
instruction to reproduce a source em dash rather than silently correct it.

## 7. Account, settings, sign-in

`app/settings/page.tsx` and `app/settings/settings-form.tsx` (both full): Rename,
Coach Toggle ("Let the coach read my reasons", matching the coach panel's wording),
Claim Account, and Sign Out form islands. `app/settings/actions.ts` server-side
strings: signed-out error, rename success and duplicate-name error, coach-toggle
confirmation, claim-account validation, hot-seat and success messages, mirroring the
client-side copy 1:1 by construction (both paths return the same discriminated-union
`{ok, error}` shape).

`app/signin/page.tsx` and `app/signin/signin-form.tsx` (full, 85 lines): conditional
already-signed-in copy (claimed vs. unclaimed account variants), an explanation that
the magic link carries half a key, a "Never attached an email?" prompt, a `SENT`
confirmation state, and error fallbacks. Sign-in server logic lives behind
`fetch("/api/auth/signin", ...)`; there is no `app/signin/actions.ts` file (confirmed
absent, not a missed read).

`app/account/page.tsx` (full, 414 lines), `[unratified]` unless noted. Header
comment (`:25-34`) states this page is deliberately unstyled beyond plain type: a
level ladder, ranked division, and cooperation score are not decided yet
(BRAIN-T260817-02, BRAIN-T260816-08), so the page does not bake in numbers the game
does not have.

Full `OUTCOME` map (`:39-44`), what a game ended as, in a player's words:
`threads_resolved: "All threads resolved"`, `topic_agreed: "Agreed a new topic"`,
`abandoned: "Left unfinished"`, `timeout: "Ran out of time"`. Two adjacent constants:
`UNNAMED = "Not named yet"` (`:47`, a game whose topic has no text yet) and
`UNNAMED_PLAYER = "an unnamed player"` (`:50`, an opponent seat filled by someone with
no name on record).

Signed-out state (`:284-293`): H1 "Your account"; body "You are not signed in.
Starting a game gives you a name and an account, with no email and no password. You
can attach an email later to keep it."; then the `StartPlaying` button (below).

Signed-in header (`:339-355`): H1 is the player's display name or "Your account" as a
fallback; below it, either "Account kept since {date}." or, for an anonymous account,
"This account is anonymous. Attach an email to keep it."

Mode filter (`ModeFilter`, `:119-147`), shown only when a player has both game kinds:
nav `aria-label="Filter games"` (`:130`); options "All" plus each present mode's label
from `MODE_LABEL` (`:104`), `{ gym: "Gym", live: "Live" }`.

**Game-history list** (`History`, `:157-253`), newest first; the header comment
(`:149-156`) explains the topic leads each row because it is "the only part of a game
a player will recognise a week later." Empty states: "No games of that kind yet."
when a mode filter is active and empty (`:177`), otherwise "No games yet. The first
one starts the archive." (`:178`). Per-row: the topic text, or `UNNAMED` if none, or
dimmed styling if the game has no topic at all; a second line combining the mode
label, ", with {opponent}" when a seat is filled (`:219`), and one of the `OUTCOME`
map's strings (via `OUTCOME[game.win_condition] ?? "Ended"`) for an ended game,
", in progress" for an active game (`:223`), or ", waiting to start" for a lobby
(`:224`); an optional detail line joining a computed `duration()` string (e.g. "under
a minute", "{n} min", "{h} hr", "{h} hr {n} min", from `:58-68`) with "{n} rule
card{s} thrown" when at least one card was thrown (`:200`); and, when any thread in
that game resolved, a row of token glyphs with their counts, each with a `title`
attribute from `tokenLabel(token)`.

`Signature` component (`:255-274`): heading "How your threads end" (`:261`), rendered
only when the player has at least one resolved thread, listing each resolution
emoji's `tokenLabel` and lifetime count.

Stat counters (`:363-393`), via the `Counter` component: "Games played" (with a
"+{n} this week" note when nonzero); "Games ended" (a code comment at `:369-379`
explains this deliberately says "ended," not "finished," since `games_completed`
includes games somebody walked out of, and flags that the stricter "won cleanly"
number cannot be computed here because the underlying query is capped at fifty games,
tracked as BRAIN-T260824-29); "Topics debated"; "Threads resolved"; "Tiles placed"
(with a "{n} per game" note when the player has played at least one game).

## 8. Errors and empty states

All four `[unratified]` unless noted.

**`app/error.tsx`** (full, 83 lines), the render-error boundary inside the layout. Its
header comment (`:6-22`) states the design intent as `[ruled]`: without this file
Next's own default inside this layout is just the word "Point Taken" and nothing
else, which gives a reporter nothing actionable, so this page states plainly that the
board is not lost (the game log is append-only) and surfaces the error digest so a
report can be matched to a server log line. H1 "This screen did not draw" (`:40`);
body "Something went wrong on our end, not yours. Nothing either of you wrote is
lost: a game is stored as the run of moves that made it, and a page that failed to
draw has not touched that." (`:42-45`); button "Try again" (`:54`), with adjacent
text "Usually enough. If it comes back twice, it is real." (`:57`); when a digest
exists, "Reporting it? Quote this: {digest}, along with the build id in the corner
below. Together they say exactly which code failed and where to find the rest of
it." (`:63-66`); three escape links, "Start a room" (`:72`), "Your games" (`:75`),
"How to play" (`:78`).

**`app/global-error.tsx`** (full, 63 lines), the boundary below the boundary, for
when the root layout itself throws; its header comment (`:3-15`) states it is
deliberately dependency-free (no stylesheet, no `Link`, no shared components) since
the failure it is catching may be any of those things, and calls itself "the least
clever file in the repo on purpose." H1 "Point Taken did not load" (`:35`); body
"Something failed early enough that none of the page could draw. Nothing you have
played is lost." (`:37-38`); button "Try again" (`:41-43`); when a digest exists, "If
you report it, quote this: {digest}" (`:46-48`); a plain `<a>` (not a `Link`, per the
header comment's own reasoning) reading "Back to the front door" (`:58`).

**`app/not-found.tsx`** (full, 81 lines), the 404, described in its own header
comment (`:3-21`) as "a routine destination here rather than an edge case": a
mistyped room code, a game that has ended, or a game the visitor was never a member
of (BRAIN-T260822-14) all land here, and the page deliberately gives the same answer
for all three so nobody can probe which game ids are real. `metadata.title`, "Not
here - Point Taken" (`:24`, note this string's own hyphen, not an em dash). H1 "That
page is not here" (`:31`); body "Nothing is broken. This address does not open
anything for you right now." (`:33`). "The usual reasons" list (`:38-53`): a room
code typed into the wrong field, since the "six-character" code goes to `/join/` and
not `/game/` (**the shipped copy is wrong: `JOIN_CODE_LENGTH = 5`,
`lib/games/joinCode.ts:17`, and that file's own comment at `:8` says "Five
characters from 32". `app/not-found.tsx` says "six" twice, at `:7` and `:41`. See
`rules.md` section 13**); "The game finished and the room closed."; a link to a game the
visitor
was not in, since "a finished game is private to the two people who played it, so it
opens for them and for nobody else."; "The address is a character off." "Where to go
instead" list (`:56-78`): "Start a room" (`:61`), "Your games" (`:66`, described as
listing "every game you have played, finished ones included"), "How to play" (`:72`,
described as "the whole game in one page").

**`app/account/start-playing.tsx`** (full, 41 lines), the button an anonymous,
signed-out visitor sees on the account page's empty state (section 7 above). Button
text toggles between "Start playing" and, while the sign-in request is in flight,
"Getting you a name..." (`:36`); on failure, the raw error message is shown in red
text (`:38`), sourced either from the server's own JSON `error` field or a fallback
`` `sign-in failed (${res.status})` `` (`:19`) constructed client-side, so this is the
one string on this list that is not a fixed literal.

`WhyNotAll` / `WhyNot` components (`live-board.tsx`) render the rule-verdict refusal
strings from section 3 as inline explanations next to a disabled control, rather than
inventing separate UI copy: same string, two call sites.

---

## Sections not completed in this pass

To keep this snapshot honest about its own coverage: `components/board/game-setup.tsx`,
`components/board/ways-to-win-card.tsx`, `components/info/paths-to-winning-card.tsx`,
`components/board/topic-tile.tsx`, `components/board/rule-card-popup.tsx`,
`components/board/resolution-picker.tsx`, `components/feedback/feedback-popover.tsx`,
`lib/feedback/stage.ts`, `lib/feedback/config.ts`, `lib/feedback/submit.ts`, and
`app/join/actions.ts` / `app/join/[code]/page.tsx` were identified as in-scope surfaces
but not read (or not re-verified) in this pass. Neither of the two `GAP:` markers
above depends on them, and this document carries no `[vibecoded]` values; they are named here so a
future regeneration knows where coverage is thin rather than assuming this document is
exhaustive.
