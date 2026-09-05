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
- No turn timers. This edition does not have them [ruled Steve 2026-09-03, BRAIN-T260903-01]; the
  earlier entry here citing a 30-second speaker timer and a 45-second summarize timer named a Heart
  edition mechanic by mistake and is superseded.

---

## 1. Landing, onboarding, how-to-play

**The "How to play" PAGE is retired; there is no `app/how-to-play/` route any more.**
Steve retired it 2026-09-03: a player stuck mid-argument will not leave the game to go
read a page, so the same content now lives in a "?" overlay a player never has to
navigate away for. This whole subsection is rewritten to match.

**Onboarding overlay** (`components/onboarding/onboarding-overlay.tsx`, full, 435
lines), `[unratified]` unless noted. Five steps, from its step list (headings quoted
verbatim, line numbers current as of this pass):
- "starting-tiles": heading "Each player writes two starting reason tiles supporting
  their opinion." (`:96`); video only, no subtitle.
- "add-a-tile": heading "Hover to add a tile." (`:107`); subtitle "Write only one
  short idea per tile." (`:108`).
- "resolve-a-thread": heading "Hover to resolve a thread by placing a token on the
  tile." (`:113`); subtitle "What does each token mean?" (`:114`); shows the token
  legend.
- "watch-the-explainer": heading "Learn more by watching this video." (`:120`);
  subtitle "You can also watch this video on YouTube" (`:121`). This step did not
  exist in the prior pass of this document, which described a four-step, no-video
  overlay; it is new.
- "two-ways-to-win": heading "Two ways to win." (`:127`).

**Found discrepancy, not resolved here:** the launcher that opens this overlay
(`components/onboarding/onboarding-launcher.tsx`) still defaults its own button text
to "Watch the 4-step tutorial" (`:23`), and the footer copy at
`components/home/home-links.tsx` still says the linked overlay "walks the four steps
right here," while the overlay itself now has five steps. Both call sites are
`[unratified]` and neither has been corrected to match the other.

**One overlay, opened from five places**, all via `OnboardingLauncher`
(`components/onboarding/onboarding-launcher.tsx`, full, 46 lines), whose own header
comment states its reason for existing: "There used to be a How to play page, and
four screens linked to it. Steve retired it on 2026-09-03... this launcher took the
page's place at all four of those doors, and each one styles it to look like the link
it replaced." The label differs by call site: the live board's "?" button in the
corner (`live-board.tsx:3063-3068`) carries `aria-label="How to play"` over a bare "?"
glyph; the account-shell footer (`account-shell.tsx:152-154`) labels it "Help"; the
home-page footer (`home-links.tsx`) and the `app/error.tsx` / `app/not-found.tsx`
escape links (see section 8) all label it "How to play". Same overlay, two distinct
visible labels ("How to play" and "Help") across five call sites.

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
- `MAX_THREADS = 4` [ruled Steve 2026-09-05, BRAIN-T260905-33]; compact mode raises it to 6 when it ships
- No `MIN_THREADS_TO_END` any more. The constant is gone from the code; a game ends once every live
  thread resolves, whatever their number [ruled Steve 2026-09-01, BRAIN-T260901-06]. This entry
  used to quote the constant's own now-removed GAP comment about a carried-forward floor of 4; that
  floor no longer exists.

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

**The reply word is "Hmm", not "But".** `tileLead()` (`side-label.ts:37-44`) prints the
word a tile opens with, based on what it answers: "Yes, because" / "No, because" for an
opening reason (`side-label.ts:41`), "Because" for a reason under your own side's tile
(agreeing and adding), and "Hmm" for a rebuttal of the other side's tile. The file's own
comment calls "Hmm" deliberate: "not 'wrong', not 'actually', just somebody stopping to
think." "But" survives in the code only inside `DUPLICATE_LEAD_STEMS` (`:66`), a regex
that strips a leading "But," if a player types it themselves into the body text; it is
never printed by the app itself. Treat "Hmm" replacing "But" as `[ruled]`: it is one of
the named rulings behind this reconciliation pass. This is the live-board's dynamic
reply-stem system and is distinct from the Gym's per-level scripted dialogue in section
5, where boss lines hardcode "But" as literal text rather than calling `tileLead()`.

**Composer** (`components/board/live-board.tsx`, now 3372 lines; the file has grown
substantially since the prior pass, so line citations below reflect only what was
re-verified this pass, and any citation not re-confirmed here should be treated as
approximate), player sees this while typing a reason:
- Placeholder "A reason for your side." (`:2013`, re-confirmed)
- Live character count while typing a reason, "{n} / {TILE_MAX_CHARS}" (`:2106`),
  turning red at the limit; new to this document.
- Placeholder "A statement both sides could sign." (topic-revision proposal), "In your
  own words, what are they saying?" (reading handback), "The strongest version of what
  they think." (steelman reading), "A reason for their side that you think they
  missed." (steelman tile), "The word" and "What it should mean for the rest of this
  game." (definition proposal), "why it does not fit (optional)" (decline reason),
  "reason (optional)" (proposal rejection): not re-verified this pass; left as
  previously recorded, `[unratified]`, exact line numbers GAP.
- "take back your token" button, game status labels ("Not started" / "In progress" /
  "Finished"), end-of-game nudges near the thread cap ("One more argument to have.",
  "Settle the last one and the game is over.", "Settle them all and the game is
  over.", "One more new thread and the board is full.", "No threads yet."), and the
  "Leave this game" / "Yes, end it for both of us" confirm toggle: not re-verified
  this pass; left as previously recorded, `[unratified]`, exact line numbers GAP.

**First-use tray hint** (`live-board.tsx:3267`), shown only until a player has thrown
any rule card at all in that game, then it steps aside for other hints: "Click a card,
then click the reason it applies to." While a throw is armed or in flight, this same
hint slot instead reads "Now click the reason you want to play it on." or "Playing
that card...".

**Thread token badge** (`ThreadTokenBadge`, `live-board.tsx:2564-2624`), the pulsing
marker on a thread waiting for a resolution token: reads "Your move" when it is this
player's turn to place one, "Waiting on them" otherwise (`:2620`).

**"Close this thread" heading** (`live-board.tsx:3342`), shown above the resolution
picker when the selected tile started a thread. A code comment directly above it
(`:3336-3339`) explains this replaced an older heading, "Where do you two disagree?",
because a question read as a prompt with no action attached, where the tokens below it
are the actual action.

**Resolution picker** (`components/board/resolution-picker.tsx`, full, 76 lines): each
token button is labeled with its `tokenLabel` underneath, always visible, not only on
hover; when the other side has already placed a token on this thread, that button gets
a gold ring and a caption, "They put this down. Match it to close the thread."
(`:67`), since closing a thread means placing the SAME token the other side did.

**Same-side notice** (`components/board/same-side-notice.tsx`, full, ~90 lines), a
one-time-per-match modal shown the first time a player answers their own side's tile
rather than the other side's. Heading "That one is yours." Body, two paragraphs: "You
can extend your own reasoning, and sometimes a reason does need a second line to stand
up." followed by "Your main goal, though, is to give gentle rebuttals to the other
side. That is where the argument actually moves." Single button, "OK". The file's own
header comment states the retired client refused this move outright; Steve's
2026-09-02 call softens it to a one-time explanation instead, since "a refusal teaches
nothing."

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

**`app/gym/page.tsx` is no longer a level-select page; the entire architecture
described in this section's prior pass is gone.** The route is now a 12-line redirect,
`redirect("/#ladder")`. Its own header comment (`:3-11`) explains why: Steve ruled on
2026-09-04 that the four account tabs are the only out-of-game chrome, and that the
profile's ladder strip (`components/account/progression/ladder-strip.tsx`) IS the
level select, so a second page doing the same job was the confusing second nav he
asked to be rid of. The route survives only so old links still land somewhere. Gym
levels 1 to 4 remain on the critical path `[ruled]` (Steve, 2026-08-28; not disturbed
by the 2026-09-04 routing change).

A level now runs as a scripted "director" (`components/gym/director.tsx`, 827 lines)
that plays a fixed sequence of "beats" defined per level in `lib/gym/levels/*.ts`
against `lib/gym/script.ts`'s `Level` type: pauses with coach commentary, a boss tile,
a boss token, a required player action, a card throw, an edit, or a win. Nothing here
is an LLM call; every boss line, coach nudge, and reaction is written text chosen by
which beat is current. Entering a level goes through `components/gym/level-intro.tsx`
first (two cards: a boss-intro card, then a rule-card-intro card, per Figma nodes
`1058:211649` and `1077:220185`, `[ruled]` per that file's own header, BRAIN-T260904-21)
and ends, on a win, at `components/gym/certificate.tsx`.

The four levels, current field values (`lib/gym/levels/onboarding.ts`,
`ground-rules.ts`, `claim-size.ts`, `clarity.ts`), all `[ruled]` against the 2026-08-22
skill-ladder and gym-levels design docs unless noted:

| # | id | title | topic | teaches (`cardId`) | boss | `rootTarget` |
|---|---|---|---|---|---|---|
| 1 | `onboarding` | Onboarding | "Should a hot dog be called a sandwich?" | `you_is_taboo` | Bashful Bob 🧑🏻‍💼 | 2 |
| 2 | `ground_rules` | Ground rules | "Should we stop changing the clocks twice a year?" | `stick_to_root` | Rambling Rosa 🧑🏿‍🔧 | 4 |
| 3 | `claim_size` | Claim size | "Should tipping be replaced by higher base wages?" | `no_exaggeration` | Braggy Bogdan 🧑🏼‍🔬 | 4 |
| 4 | `clarity` | Clarity | "Should AI-generated content be clearly labeled?" | `help_me_understand` | Sloppy Salma 🧑🏾‍🍳 | 4 |

Two corrections against the prior pass of this document: the level 3 boss is **Braggy
Bogdan**, not "Braggy Brenda" (no boss of that name exists in the code); and the level
2 and 3 topic wordings above are exact, where the prior pass paraphrased them ("stop"
placement in level 2, "base wages" and "clearly labeled" in levels 3 and 4).
`rootTarget` is the number of thread-roots required before any reply may hang off one
(`lib/board/rules.ts`'s root-stage gate); level 1 is 2 rather than the live-play 4,
since the level opens with one root from each side, Bob's first, and nothing may
reply to either root until both are down [ruled Steve 2026-09-05, BRAIN-T260905-32].

**Level 1's beat order** [ruled Steve 2026-09-05, BRAIN-T260905-32, `lib/gym/levels/onboarding.ts`].
Nothing is explained ahead of time: each token is explained when it is placed, the
card when it is broken. In beat order, the coach and boss strings players actually
see:

1. A pause explains the board: "You're Minus: a hot dog is not a sandwich. Bob's
   Plus, he thinks it is. He goes first."
2. Bob places his own root first: "Yes, because a hot dog is a filling served inside
   bread, and that's what a sandwich is."
3. A pause explains what a reason tile is, then the player places their own root
   next to Bob's, coached: "Start your first thread: why a hot dog isn't a sandwich.
   I wrote you a sample, change any of it."
4. A pause marks it as a second thread, then the player answers Bob's root, coached:
   "Answer Bob's reason, at the top of his thread."
5. A pause explains that tiles answer tiles, then Bob agrees outright rather than
   arguing back: "You're right, I hadn't thought of that." A pause names the token
   he places, 👍, Agree to agree, and the player mirrors it, coached: "Put your 👍
   down and the thread closes." That thread closes at two tiles.
6. Bob's first reply on the player's own thread breaks 🙅 "You" is Taboo: "But you
   only think that because you grew up eating them at ballparks. That's nostalgia,
   not a rule." A pause names the card there and the player throws it, coached:
   "Throw it."
7. Bob revises the thrown tile: "But the ballpark version of this argument is about
   memory, not about what the food is." A pause explains what the card actually did,
   then the player answers the revision, coached: "Answer Bob back, right under his
   tile."
8. Bob replies once more without conceding: "Maybe, but a name can outlast its own
   history. I still think it's a sandwich." The player proposes 👀, Agree to
   disagree, coached: "You're not going to agree on this one. 👀 Agree to disagree:
   neither of you has to move, and it still closes the thread."
9. Bob asks for the confirm before mirroring it: "...sorry. I don't like to assume."
   Once the player asks, Bob places his 👀 and that thread, four tiles now, closes
   the level: both tokens have been seen in play.

Bob's boss-tile text uses "But" as its literal reply lead (`onboarding.ts`'s
hardcoded lines), which is separate from the live board's dynamic "Hmm" reply-stem
system described in section 3 below: the level files hardcode boss dialogue directly
rather than routing it through `tileLead()`.

**The moderator is a distinct third voice from the boss**, used in at least level 4
to refuse an illegal move mid-script: `clarity.ts:161-162`'s exact line is "That's a
question, Salma. Your side of the board is for statements. What's the claim behind
it?" (naming the boss by name, not a generic refusal). This is Gym-scripted flavor
text rendered by the director on a `pause` beat, not a change to the live game's
`canPlaceTile` refusal strings in section 3.

**"Show me" exists; an all-caps "SHOW ME" control does not.** Both `claim-size.ts`
and `clarity.ts` render a title-case "Show me" control at several points in their
scripts; no shipped string reads "SHOW ME".

**The certificate** (`components/gym/certificate.tsx`, full, 168 lines): H1
"Certificate of Agreeable Disagreement" (`:69`), eyebrow "Gym · Level {number}
cleared" (`:66`), the level's topic, then a four-stat row: "Point taken" (👍 count),
"Now I see why" (👀 count), "Points", and "Reformed" with the boss's emoji and name
(`:75-91`); the boss is reformed, never "beaten", matching the standing name for this
mechanic. Card-granted and badge sections follow when present; a closing line reads
either "Saved to your account{ on {date}}. Badge names are still placeholders." or,
for a level replayed after its awards were already recorded, "Shown from the level
script. This game ended before awards were recorded, so nothing here is saved to your
account." (`:134-146`). Nav: "Next: Level {n}" when another level remains, "Back to
the ladder" (to `/#ladder`), "Your games" (to `/account`).

**Finding: the gym's own topic list is a 4-topic subset, separately balanced.** These
four practice topics are distinct from the 17-topic `TOPIC_LIBRARY` in section 2 and
read as comparatively low-stakes and non-political by design (a food-naming question,
a clock-policy question, a tipping-and-wages question, an AI-labeling question); none
of the four touches the sharper political ground several `TOPIC_LIBRARY` entries do,
so the aggregate-imbalance finding in section 2 does not extend to this list.

GAP: level names above 4, and the badge taxonomy referenced by "Badge names are still
placeholders" above, are listed as still-moving in `CLAUDE.md`; not resolved here.

## 6. End of game

`components/win/win-overlay.tsx` (full, 247 lines), `[unratified]` unless noted: heading
"You both won." (`:155`), no longer "You've won!"; a code comment directly above it
(`:150-153`) states the reason for the change as `[ruled]` design intent, not just
current copy: both win conditions are cooperative, and a headline congratulating one
player is the one sentence on the screen that would contradict the game. Close button
`aria-label="Close and review the board"` (`:143`, unchanged). A `ReopenPill` button,
shown once the overlay has been dismissed once, now reads "🎉 You both won. Show
results" (`:81`), with no em dash; see the retired Finding below.

Body copy differs by win variant: for a threads-resolved win, "Every thread got a
token:" (`:161`) followed by one row per resolution-token type actually used, each
showing the token glyph, its `tokenLabel`, and a count phrased "{n} thread" / "{n}
threads" (`:166-183`); for a topic-agreed win, "You agreed on a wording you would both
sign:" (`:188`) followed by the agreed topic text in a `TopicTile`. A closing italic
line, present for both variants: "Stay as long as you like. The game is finished, and
the whole board is still here underneath, to read back as often as you want."
(`:202-205`). Its own code comment (`:194-201`) states this replaced an older sentence
promising a player could keep adding to the board or try for the other ending too,
which the comment calls two-thirds false: reaching either ending ends the game and
swaps the live board for a read-only recap, so there is no second ending left to try
for.

Buttons: "Leave feedback" (`:224`, only rendered when a feedback-share URL exists),
"Share to LinkedIn" (`:233`, via LinkedIn's public share-offsite URL, carrying only the
hardcoded `PUBLIC_GAME_URL = "https://play.pointtaken.social"`, not any per-game data),
and a separate gold "Play Again" pill (`:243`) linking to `/`. A code comment
(`:207-215`) explains the visual grouping: Share/Feedback are the quiet pair, Play
Again is the one gold pill, because going to LinkedIn is not what a player wants next.

**Retired finding: the em-dash house-style violation here is fixed, not open.** An
earlier pass of this document flagged the `ReopenPill` text as a literal em dash
written into static JSX, un-remediated because `flattenDashes()` only sanitizes AI
output, never static UI strings. The text has since changed to "🎉 You both won. Show
results," which contains no em dash. Recorded here only so a later reader does not
re-file the same finding against text that no longer exists.

## 7. Account, settings, sign-in

The account area is a four-tab hub, rebuilt 2026-09-02 from Rannie's Profile frame
(Figma `1066:216757`, spec BRAIN-T260902-21) and restyled again 2026-09-04 against
twenty further Figma-matched items (BRAIN-T260904-40), replacing the old single
414-line `app/account/page.tsx`. That file is now a 12-line wrapper: signed out it
shows H1 "Your account" and body "You are not signed in. Starting a game gives you a
name and an account, with no email and no password. You can attach an email later
to keep it." above the `StartPlaying` button; signed in it renders the same `Profile`
component that `/` renders (below), kept only because it is the href already used by
the tab bar, existing links, and the hub's own footer.

**`/` signed in, and `/account`** (`app/page.tsx`, `app/account/profile.tsx`): signed
in, `/` **is** the profile, no separate route; the account tabs are the only chrome
[ruled Steve 2026-09-03]. Signed out, `/` is the front door instead: wordmark, the
room-code entry field with "Join a game" beside it, "OR", "Create a room", then "Or
take the guest account on its own and look around first." above a "Set me up" button,
then the how-to-play links. Every action mints an account, so a signed-out visitor
ticks Terms of Use and Privacy Policy in a single checkbox inside room entry first,
enforced again server-side.

`Profile` (`app/account/profile.tsx`, full, 145 lines) renders, in order: `ProfileHero`
(identity plus two promo cards plus three stat tiles, below), `LadderStrip`,
`CertificateWall`, `BadgeStrip`, then, only when the player has at least one resolved
thread, a `Signature` panel headed "How your threads end" (`:83`) listing each
resolution token's `tokenLabel` and lifetime count, and finally `CalendarStrip`. The
level ladder, cooperation score, ladder rank, active-boss-challenge card, certificate
wall, and badge strip were all invented on Steve's 2026-09-03 instruction to design
the summary screen against fake data ("these are just tiles on a website with db
queries behind them ... We will be iterating on them anyway", BRAIN-T260903-10,
BRAIN-T260903-11); since migration `0014_awards.sql` every one of them reads this
player's real awards through `lib/progression/state.ts` except the ladder's shape
above level 4 and the badge display names, which still carry a `SampleTag`.

**`ProfileHero`** (`components/account/hero.tsx`, full, 221 lines). Identity block:
the player's `display_name` or "Your account"; subline "Player since {date}" or, for
an anonymous account, "Anonymous. Attach an email in Settings to keep it."; a level
pill "Level {n}: {title}" when a ladder rung is current. Two promo cards: "Active boss
challenge" (`` `Level ${n}, ${title}: you will earn a rule card and reform
${bossName}, who ${bossHabit ?? "argues badly on purpose"}.` `` with a "Gym play"
button, or, once all four levels are cleared, "Practise on your own against an
opponent who argues badly on purpose." with a link "or pick a level" to `/#ladder`)
and "Play with your peers" ("Invite somebody you actually disagree with. One of you
opens a room and reads out the code; the other types it in here.", a join-by-code
field and a resume-or-start control). Three stat tiles: "Games played" ("+{n} this
week" or "All time"), "Points" ("{n} level(s) cleared" or "None yet"), and **"Cooperation
score"**, figure = lifetime threads resolved, note "Threads agreed · leaderboard",
linking to `/leaderboard?by=cooperation`. That third tile and the leaderboard it links
to are a live, built system, not a doc gap: see the conflict flagged for Steve below.

**Four-tab shell** (`components/account/account-shell.tsx`, `TABS`, `:47-52`):
Profile (`/`), Cards & Badges (`/cards`), History (`/account/history`), Settings
(`/settings`). Footer carries the onboarding overlay's "Help" launcher (section 1).

**History tab** (`app/account/history/page.tsx`, full): split out of the old account
page on 2026-09-02 because History is one of Rannie's four tabs (Figma `1096:224142`).
Heading "Game history"; a mode filter ("All" plus each present mode's label from
`MODE_LABEL`, `{ gym: "Gym", live: "Live" }`) shown only when a player has both kinds;
empty states "Nothing here yet." (a mode filter active and empty) and "No games yet.
The first one starts the archive." (nothing at all). Search, date range, and sort
controls drawn in Rannie's frame are not built: the header comment explains the
underlying query caps at fifty games, and a search box over a list that cannot page
would promise more than it does.

**Cards & Badges tab** (`app/cards/page.tsx`, full): heading "Cards & badges"; signed
out, "You are not signed in. Starting a game gives you a name and an account, and the
Gym is where the cards come from." Three sections, per Rannie's 2026-09-02 split into
Rule Cards / Boss Collection / Badges Gallery frames: a rule-card wall with three
counts per card (thrown, coached, held), a section "Cards you turned down" whose empty
state reads "None yet. When someone throws a card at one of your reasons you can
rewrite the reason, or you can say the card does not fit. Saying it does not fit is a
move, and it gets counted here.", a boss collection, and a badge gallery. Everything
past the four ratified cards is invented sample data flagged with `SampleTag`, per the
same 2026-09-03 ruling as the profile's widgets (BRAIN-T260903-10, BRAIN-T260903-11);
cards 5 through 11 are explicitly out.

**Settings tab** (`app/settings/page.tsx`, `app/settings/settings-form.tsx`, both
full): heading "Settings". Rename field, "Saving..." while pending, button "Save
name", hint "This is what your opponent sees. You were given one; change it if you
want a different one." Coach toggle, title "The coach", hint "Off by default. When it
is on, the coach reads each reason as you place it and can offer a rule card or a
rewrite. Only you see what it says about your own reasons." "Keeping this account"
section: with an email attached, "This account has an email attached, so it survives
this browser. Adding a different address sends a new confirmation link."; without
one, "This account lives in this browser only. Attach an email and it survives a
cleared cache or a new machine. No password: signing back in is a mailed link." "This
browser" section, sign-out control: with email attached, "Signing out ends the session
here. Your account keeps everything, and a mailed link brings you back to it."; without
one, "This account has no email, so it exists only as a cookie in this browser. Signing
out ends it: the games on it stay in the database but nothing can reach them again.
Attach an email above first if you want it back." Sign-out button is a two-step arm:
"Sign out", then "Yes, end this account",
"Signing out..." while pending; failure shows "That did not go through. Try again in a
moment." or "That did not go through. Check your connection and try again." An F&Q
panel, heading "F&Q" with a note "{n} answers", six questions: "Is there a way to
win?", "What does throwing a rule card do?", "Who can see what the coach says about
me?", "What is the Gym?", "I never made an account. Do I have one?", "What happens to
my games if I sign out?", each with a full-sentence answer confirming the cooperative
win conditions, the no-scoring rule-card model, coach privacy, the Gym's separateness,
cookie-based anonymous accounts, and sign-out consequences in the player's own words.

**Sign-in** (`app/signin/page.tsx`, `app/signin/signin-form.tsx`, full, 85 lines):
button "Mail me a link", pending "Sending..."; after sending, "If that address has an
account, a link is on its way. It is good for one hour and one use. Nothing arrives if
no account was ever attached to it."; failure falls back to "That did not go through.
Try again in a moment." or "That did not go through. Check your connection and try
again." Sign-in server logic runs behind `fetch("/api/auth/signin", ...)`; there is no
`app/signin/actions.ts` file (confirmed absent, not a missed read).

**Auth callback** (`app/auth/callback/route.ts`, full, 57 lines), the last step of a
mailed-link sign-in, not a formality after it: it exchanges the one-time code for the
session cookies. A code opened in a different browser than the one that asked for it
fails with "That link could not be used here. Sign-in links only work in the browser
that asked for one, so ask for a fresh link from this browser." A link with no code at
all fails with "That link carried no sign-in code. Ask for a fresh one." Success
redirects to `/account`.

**Leaderboard** (`app/leaderboard/page.tsx`, full), reachable only from the
cooperation-score tile above and from `/#ladder`, not a tab of its own. Heading
"Leaderboard", subhead "Both ways to win this game are cooperative, so none of these
columns measures beating anybody." Three sortable columns under "Rank by": "Wins",
"Threads agreed" (the hero's "Cooperation score" tile links here), and "Sustained
play"; empty state "Nobody has played a game yet. The first one starts the board."
Ties share a rank number; the top three get a larger figure, never a different colour
or a medal glyph, per the page's own comment: the rank number already carries the
ranking, and both win conditions are cooperative, so nothing should read as a podium.
The page's own header comment says nobody has designed this screen: it was built
2026-08-31 in the account hub's own type and colour because Rannie's file has no
ranked list anywhere in it, only a single line on the profile showing a player their
own position (BRAIN-T260831-78, BRAIN-T260831-80), and is expected to be redrawn.

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
`components/feedback/feedback-popover.tsx`, `lib/feedback/stage.ts`,
`lib/feedback/config.ts`, `lib/feedback/submit.ts`, and `app/join/actions.ts` /
`app/join/[code]/page.tsx` were identified as in-scope surfaces but not read (or not
re-verified) in this pass. Section 8 ("Errors and empty states") also predates this
pass and was not re-checked against current code. Neither of the two `GAP:` markers
above depends on any of this, and this document carries no `[vibecoded]` values; they
are named here so a future regeneration knows where coverage is thin rather than
assuming this document is exhaustive.
