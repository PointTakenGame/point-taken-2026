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
verbatim):
- "starting-tiles": heading "Each player writes two starting reason tiles supporting
  their opinion." (`:96`); video only, no subtitle.
- "add-a-tile": heading "Hover to add a tile." (`:107`); subtitle "Write only one
  short idea per tile." (`:108`).
- "resolve-a-thread": heading "Hover to resolve a thread by placing a token on the
  tile." (`:113`); subtitle "What does each token mean?" (`:114`); shows the token
  legend.
- "watch-the-explainer": heading "Learn more by watching this video." (`:120`);
  subtitle "You can also watch this video on YouTube" (`:121`). The overlay runs five
  steps and carries video; sources describing a four-step, no-video overlay are wrong.
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

`lib/board/setup.ts:93-198` (`TOPIC_LIBRARY`, 17 seed topics), all `[unratified]`:

> "Should a hot dog be called a sandwich (or taco)?" (`setup.ts:96`)
> "Should astrology be taken seriously as a way to understand ourselves or others?" (`:102`)
> "Should student loan debt for community college degrees be forgiven?" (`:108`)
> "Should people be required to have health insurance?" (`:114`)
> "Should the death penalty be allowed for premeditated mass murder?" (`:120`)
> "Should the government grant special protections to union workers, like preventing
> workers who strike from being fired?" (`:126`)
> "Should people without a criminal record be allowed to own military-grade automatic
> weapons?" (`:132`)
> "Should sugary soda be taxed for its health effects, like cigarettes?" (`:138`)
> "Should AI-generated content (e.g., news, art, music) be clearly labeled to
> consumers?" (`:144`)
> "Should cryptocurrency be legal?" (`:150`)
> "Should self-driving cars be allowed on public streets?" (`:156`)
> "Should the SAT be eliminated due to concerns about fairness and bias against some
> groups of college applicants?" (`:162`)
> "Should a researcher who argues that women have a genetic disadvantage in math be
> allowed to present their research on a college campus?" (`:168`)
> "Should athletes be allowed to join high school sports teams based on their gender
> identity instead of their sex at birth?" (`:174`)
> "Should individuals facing persecution or human rights abuses in foreign countries be
> allowed temporary asylum in the USA?" (`:180`)
> "Should someone who entered the USA without documentation 20 years ago be deported
> now, even if it breaks up a family?" (`:186`)
> "Should the USA abolish the Electoral College and elect a president by popular
> vote?" (`:192`)

**Finding: aggregate political lean in topic phrasing.** A code comment near this list
(read pre-compaction, BIZ-T260426-39) acknowledges the balance obligation is "aggregate,
not paired... reviewed quarterly," not a mirror per topic. Even by that looser standard,
three of the phrasings load the emotionally sympathetic framing onto the
progressive-coded answer rather than stating the tradeoff neutrally: the deportation
topic (`:186`) appends "even if it breaks up a family"; the asylum topic (`:180`) frames
the situation as "persecution or human rights abuses"; the SAT topic (`:162`) frames
elimination as addressing "fairness and bias." By contrast, the two topics most legible
as testing a conservative-coded or contested position (`:132`, gun ownership; `:168`,
the researcher's genetic-disadvantage claim; `:174`, trans athletes) are phrased in
comparatively clinical, non-loaded language. This is a real asymmetry in emotional
loading, not merely topic selection, and should be looked at against the quarterly
review the code comment references.

Custom-topic entry: `TOPIC_MAX_CHARS = 300` (`lib/board/setup.ts:198`), enforced with
refusal "A topic has to fit in ${TOPIC_MAX_CHARS} characters." (`setup.ts:277`),
`[unratified]`.

## 3. Turn loop: placing reasons, tokens, proposals

All strings below are `[unratified]`; file is `lib/board/rules.ts` unless noted.

**Constants governing what a player can type:**
- `TILE_MAX_CHARS = 100` (reason on a tile)
- `READING_MAX_CHARS = 200`, marked PROVISIONAL in a code comment
- `DEFINITION_TERM_MAX_CHARS = 60`
- `DECLINE_REASON_MAX_CHARS = 200`
- `MAX_PLAYERS = 2` (read pre-compaction, `lib/board/setup.ts`)
- `MAX_THREADS = 4` [ruled Steve 2026-09-05, BRAIN-T260905-33]: level 1 of the Gym runs two threads,
  one per side, on the tile board's two bottom diagonals; level 2 and up in the Gym, and live play,
  run four threads total, two per side, which is the tile board's full capacity. Compact mode raises
  it to 6 when it ships, not before.
- No `MIN_THREADS_TO_END` any more. The constant is gone from the code; a game ends once every live
  thread resolves, whatever their number, with no minimum thread count and no thread floor at any
  level [ruled Steve 2026-09-01, BRAIN-T260901-06; reconfirmed final, Steve 2026-09-07]. An
  intervening Nathan ruling that reinstated a floor of 4 in live play on 2026-08-29 is overtaken by
  Steve's later rulings.

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

**Composer** (`components/board/live-board.tsx`, now 4028 lines, re-verified this
pass), player sees this while typing a reason:
- Placeholder "A reason for your side." (`:2020`, re-confirmed)
- Live character count while typing a reason, "{n} / {TILE_MAX_CHARS}" (`:2119`),
  turning red at the limit.
- "In your own words, what are they saying?" (reading handback, `:2214`); "The
  strongest version of what they think." (steelman reading, `:2278`); "A reason for
  their side that you think they missed, hung under this one." (steelman tile,
  `:2335`, including the trailing ", hung under this one." clause); "The word" (`:2428`) and "What it should mean for the rest of this game."
  (`:2436`) (definition proposal); "why it does not fit (optional)" (decline reason,
  `:875`).
- "reason (optional)" (proposal rejection): not re-verified, `[unratified]`,
  exact line GAP. This may be the same field as `topic-cell.tsx`'s "Optional. What
  would you not sign?" documented under Topic revision below, or a distinct one used
  for card-decline/other proposal kinds; unconfirmed.
- Game status labels "Not started" / "In progress" / "Finished" (`:119-121`,
  re-confirmed).
- End-of-game/board-capacity nudges. The strings "One more argument to have.",
  "Settle the last one and the game is over.", "Settle them all and the game is
  over.", and "No threads yet." exist nowhere in the codebase; sources quoting them
  are wrong. What ships, from the live `ceilingNote` computation
  (`:3037-3044`): "One more new thread and the board is full." when exactly one thread
  slot is left, and "There are ${MAX_THREADS} threads here, which is the most a board
  holds. A new reason has to hang off one that is already here." once the board is
  full.

**Topic revision** (`components/board/topic-cell.tsx`, full, 510 lines), the
octagonal topic tile at board center:
- Shown topic, or "No topic was set." if none (`:360`).
- Hover/click affordance `aria-label`/`title` "Propose a revised topic" (`:385-386`).
- While editing: textarea placeholder "A statement both sides could sign." (`:325`,
  falls back to the current topic text as the placeholder once one exists) with
  "Cancel" / "Propose" buttons (`:330-345` area). This is a distinct string from the
  Ways to Win card's revise-hint text "Write the version you would both sign." (see
  below); the two describe the same feature from two different UI surfaces and are not
  a duplication error.
- Confirm popover: heading "Propose this topic?", subtitle "If they accept it, the
  game ends there and you both win." (`:459-460`), buttons "PROPOSE IT" / "BACK".
- Incoming proposal: eyebrow "They want the topic to say", the old topic shown as
  "instead of “...”", buttons "Reject" / "Accept" (`:265-296`).
- Own pending proposal: eyebrow "You proposed", status line "Sent. Waiting for them to
  answer." (`:301-311`).
- Reject-with-reason popover: heading "Not this wording?", subtitle "Tell them what is
  wrong with it, so their next try is closer.", field placeholder "Optional. What
  would you not sign?" (`:478-486`).
- After a rejection: eyebrow "They turned down your wording" / "You turned down their
  wording" depending on who proposed, reason text "They did not say why." / "You did
  not give a reason." when none was given, and a "Try another wording" button for the
  rejected proposer (`:420-449`).

**First-use tray hint** (`live-board.tsx:3887`), shown only until a player has thrown any rule card at all in that game, then
it steps aside for other hints: "Click a card, then click the reason it applies to."
While a throw is armed or in flight, this same hint slot instead reads "Now click the
reason you want to play it on." or "Playing that card...".

**Thread token badge** (`ThreadTokenBadge`, `live-board.tsx:2684-2790`): visible label reads "Your
move" when it is this player's turn and no token is down yet, "Click to agree" when
the other side already placed a token here and this player can close the thread by
matching it, and "Waiting on them" otherwise. The badge also carries longer
`title`/screen-reader sentences: "Thread
resolved: ${tokenLabel}"; "They suggested: ${tokenLabel}. Click it to agree and close
the thread."; "They suggested: ${tokenLabel}. Click the reason to say whether you
agree."; "You suggested: ${tokenLabel}. Waiting for them."

**Resolution picker.** There is no `components/board/resolution-picker.tsx` and no
"Close this thread" heading; sources quoting either are wrong. Commit `b6ab609`
(2026-09-07, "close a thread from its root tile instead of a picker below it")
deleted the picker component and moved token placement onto `ThreadTokenChoices`
(`live-board.tsx`), a pair of buttons that appear
on hover flanking a thread's root tile:
- Before this player has placed a token: a left button for the agree-to-agree token
  and a right button for the agree-to-disagree token, each showing `tokenLabel()`
  text next to its glyph.
- After this player has placed a token: a single button reading "Take it back" (with
  an X glyph). There is no "take back your token" string in the code.

**Leave button** (`LeaveButton`, `live-board.tsx:2475-2510`), top left of the board.
Visible label is "← Leave" (not "Leave this game", which is only the `title` tooltip
attribute, "Leave this game and go back to the home screen"). Clicking it arms a
confirm state, where the button's own text changes to "Yes, end it for both of us".
New to this document: while armed, a body paragraph also appears: "A live board needs
both sides, so this ends the game for the other player too. The map stays in both
histories, marked unfinished."

**Ways to Win card** (`components/board/ways-to-win-card.tsx`, full, 365 lines),
the persistent side-rail card summarizing both win conditions:
- Heading "Ways to win".
- Item 1: "Resolve all threads" when more than one thread remains to close, "Resolve
  the one thread" when exactly one remains, or "Resolve all ${target} threads" as the
  general form.
- Before any thread exists: "None yet. The first reason you place starts one."
- Progress line "{resolvedCount} of {target} resolved".
- Per-corner `aria-label`s on the mini thread-status diagram: "Thread resolved", "Your
  token is down on this thread, waiting for theirs", "Their token is down on this
  thread, waiting for yours", "Thread not yet resolved", and "No thread started yet on
  this ${Plus/Minus} corner".
- Center topic button `aria-label`: "Revise the topic" once revision is available,
  otherwise "Topic". A "TOPIC" stamp is visible on the card with a pencil ("✎") that
  appears on hover.
- Item 2, shown only once topic revision is available (`showRevise`): "Revise the
  topic".
- Two props fed from `live-board.tsx` (`:3710-3737`) only while revision is
  available: `reviseHint` "Write the version you would both sign." and `footer`
  "Either ending is a win, and it is the same win for both of you." (Distinct from
  `topic-cell.tsx`'s composer placeholder "A statement both sides could sign." — see
  Topic revision above.)

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

**Rule verdict refusal strings** (`lib/board/rules.ts`, 631 lines; every string below is
present verbatim), all `[unratified]`.
Each string is surfaced to the player twice from one source: as the reason a button
is disabled client-side, and as the server action's refusal if the button is
bypassed, since both paths call the same `canX()` function and render the same
`Verdict`. Grouped by the function that returns them:

- `canPlaceTile` (tile placement): "A reason needs some words in it." (`:230`); "A
  reason is at most ${TILE_MAX_CHARS} characters." (`:232`); "A game holds at most
  ${MAX_THREADS} threads. Add this to one of them instead." (`:239-241`); "That reason
  is not on this board." (`:262`); "That reason was taken off the board." (`:263`);
  "That thread is already resolved." (`:265`).
- `canEditTile`: "That reason is not on this board." (`:280`); "That reason was taken
  off the board." (`:281`); "Only the person who wrote it can change it." (`:283`); "A
  reason needs some words in it." (`:286`); "A reason is at most ${TILE_MAX_CHARS}
  characters." (`:288`).
- `canRemoveTile`: "That reason is not on this board." (`:301`); "That reason is
  already off the board." (`:302`); "Only the person who wrote it can remove it."
  (`:304`).
- `canPlaceResolutionToken`: "That is not a resolution token." (`:315`); "That thread
  is not on this board." (`:318`); "That thread is already resolved." (`:319`); "That
  thread has nothing left in it." (`:320`).
- proposal-answer function (`canAnswerProposal`): "That proposal is not on this
  board." (`:334`); "That proposal was already answered." (`:335`); "You cannot answer
  your own proposal." (`:336`).
- `canProposeTopicRevision`: "A revised topic needs some words in it." (`:345`); "A
  revised topic is at most 300 characters." (`:346`); "That is the topic you already
  have." (`:348`).
- `canProposeRelocation`: "That reason is not on this board." and "That reason was
  taken off the board." (`:362-363`, the same strings `canPlaceTile` uses); "A reason cannot hang from itself." (`:364`); "That
  destination is not on the board." (`:368`); "That would put a reason underneath its
  own reply." (`:370`); "A reason with no parent starts its own thread." (`:373`).
- `canProposeReadingHandback`: "That reason is not on this board." and "That reason
  was taken off the board." (`:434-435`, same strings again); "Read one of their
  reasons back, not one of your own." (`:437`), the refusal
  when a player tries to hand their own reason back to themselves instead of the
  other side's.
- `readingText(text, noun)` (`:404-410`), a shared helper behind reading-handback and
  definition proposals: "${noun} needs some words in it." and "${noun} is at most
  ${READING_MAX_CHARS} characters.", with `noun` supplied per call site (e.g. "A
  reading", "A definition").
- `canProposeDefinition`: "Name the word you want pinned down." (`:492`); "A term is
  at most ${DEFINITION_TERM_MAX_CHARS} characters." (`:494`); then falls through to
  `readingText(text, "A definition")` for the definition body itself.
- card-throw function (`canThrowCard`): "That card is not in play in this game."
  (`:533`); "That reason is not on this board." (`:536`, same string as
  `canPlaceTile`); "That reason was taken off the board." (`:537`); "Cards go to the
  other side's reasons, not your own." (`:539`); "That thread is already resolved."
  (`:544`, same string as above); "You already played that card on this reason."
  (`:554`).
- card-decline function (`canDeclineThrow`): "That card play is not on this board."
  (`:576`); "You already answered that card by rewriting the reason." (`:578`); "You
  already turned that card down." (`:580`); "That reason is not on this board."
  (`:583`); "Only the person who wrote the reason can turn a card down." (`:585`); "A
  note is at most ${DECLINE_REASON_MAX_CHARS} characters." (`:589`).
- card-rewrite function (`canReviseTile`): "That reason is not on this board."
  (`:612`); "That reason was taken off the board." (`:613`); "Only the person who
  wrote the reason can rewrite it." (`:615`); "That card play is not on this board."
  (`:619`); "That card was played on another reason." (`:621`); "That card has
  already been answered." (`:622`); "A reason needs some words in it." (`:625`, same
  string as `canPlaceTile`); "A reason is at most ${TILE_MAX_CHARS} characters."
  (`:627`); "That is the same words you had before." (`:629`).

Several strings repeat verbatim across functions on purpose ("That reason is not on
this board.", "That thread is already resolved.", the length and empty-text refusals):
the same fact reads the same way everywhere a player hits it, rather than each
`canX()` inventing its own phrasing for an identical situation.

## 4. Referee feedback (the "coach")

Rendered in `components/board/coach-panel.tsx` (full read, 294 lines). It is its own
card in the right rail, under Ways to win: heading **"AI Coach"** (`:240`), a switch on
the same line, one line of subtitle under it.

The switch is a real checkbox styled as a switch. Its accessible name is the short form
`aria-label="Coach feedback"` (`:256`); the full sentence is the hover tooltip,
`title="Let the coach give me feedback and help me as I play"` (`:248`), which the file's
own comment says matches the Settings tab's spelled-out wording of the same toggle.

The subtitle line under the heading has two states (`:263-265`):

> "It gives you feedback as you play and can offer a note. It never blocks a move."
> "Off. Nothing you write is sent anywhere while this is off."

While a reading is in flight: "Reading that one now..." (`:270`). With coaching on and
nothing read yet: "Nothing to say so far. Silence is the usual answer." (`:273-274`).

Per-reading card (`:70-115`): the card's `icon` and `name` when a card is cited, falling
back to "The coach has a note" (`:73`) when no card applies; the card's `plain` text; the
quoted tile text; the model's own `feedback` field rendered verbatim; a suggestion
prefixed "One way to put it: " (`:82`), printed only when no dare is on offer; then the
fixed disclaimer, in full: "Only you can see this. Edit your tile above if you want to,
or leave it." (`:86-88`). When a dare is offered, the rewrite sits in its own gold-ruled
block headed "Dare you to say it this way:" (`:91`) with the dare text quoted beneath.
Buttons: "Take the dare" (`:103`, only with a dare) and a dismiss button reading "Keep
mine" when a dare is on offer and "Got it" otherwise (`:112`); both render "..." while
their action is pending. A code comment at the top of the file states "Nothing here can
stop a move (Steve, 2026-08-23)" (`:20`), `[ruled]`: coach feedback is strictly advisory
and never blocks play.

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

**`app/gym/page.tsx` is not a level-select page.** The route is a 12-line redirect,
`redirect("/#ladder")`. Its own header comment (`:3-11`) explains why: Steve ruled on
2026-09-04 that the four account tabs are the only out-of-game chrome, and that the
profile's ladder strip (`components/account/progression/ladder-strip.tsx`) IS the
level select, so a second page doing the same job was the confusing second nav he
asked to be rid of. The route survives only so old links still land somewhere. Gym
levels 1 to 4 remain on the critical path `[ruled]` (Steve, 2026-08-28; not disturbed
by the 2026-09-04 routing change).

A level runs as a scripted "director" (`components/gym/director.tsx`, full read, 1,104
lines) that plays a fixed sequence of "beats" defined per level in `lib/gym/levels/*.ts`
against `lib/gym/script.ts`'s `Level` type: pauses with coach commentary, a boss tile,
a boss token, a required player action, a card throw, an edit, or a win. Nothing here
is an LLM call; every boss line, coach nudge, and reaction is written text chosen by
which beat is current. Entering a level goes through `components/gym/level-intro.tsx`
first: a boss-intro card, then an agreement card naming the level, the boss, and the
topic and carrying the three `SIGNING_LINES` pledges in full, signed as one act before
"Start the game" ungreys `[ruled Steve 2026-09-05, BRAIN-T260905-39]`. This supersedes
the earlier rule-card-intro card that showed the level's rule card face down before
the player had ever seen the board move `[ruled BRAIN-T260904-21, superseded]`, and it
ends, on a win, at `components/gym/certificate.tsx`.

**Strings the director owns itself**, as opposed to the level scripts it plays. These
frame every level and are the only Gym copy not written per level:

- The coach pill, pinned top centre: "Coach · {step}" (`director.tsx:830`), where `step`
  is "Level {n} · {i} of {total}" (`:765`). Beside it, when a level scores: "{total} pts"
  (`:833`), with a change suffix " · {+n} {label}" when a beat just moved the score
  (`:836-838`).
- The coach's thought space, under the pill, while a pause is holding its bubble back:
  "reading the board..." (`:849`).
- A pause bubble renders, in order: the beat's `title` as the heading (`:929`), the level's
  rule card face when the beat names one, "{bossEmoji} {bossName}: “{bossSays}”" (`:938`),
  "⚖️ Moderator: {moderator}" (`:948`), "{bossEmoji} {bossName}: “{bossReplies}”" (`:953`),
  the beat's `body`, and the beat's `button` label (`:959`). The moderator line is drawn
  set apart from both players, on the reasoning that it is the board itself talking.
- A player/boss/win bubble renders the boss's line the same way (`:1059`) and then the
  beat's coach line, or its `nudge` instead once the player has moved off script. A win
  beat with no line of its own falls back to "Every thread is closing. One moment."
  (`:1037`).
- When a beat asks for an edit or a proposal, the samples are read out rather than drawn
  in a board slot, under the label "Something like:" for an edit and "Something like one
  of these:" for a proposal (`:1089-1090`), each sample quoted on its own line.
- Nothing tells the player where to click. A code comment (`:1063-1073`) records this as
  deliberate: samples are drawn inside the open slots on the board, so a sentence describing
  the gesture would be redundant.
- A refused boss move surfaces the server's own error text in the same bubble (`:1100`).
  Those strings live in `app/gym/actions.ts`: "Start playing first, so you have a name to
  train with." (`:79`), "That level has no script yet." (`:85`), "That game id is not a
  game id." (`:182`), "That game is not open to you." (`:184`), "This is not a scripted
  level." (`:188`), "No card is standing against that tile." (`:258`), "No proposal is
  waiting on that tile." (`:291`).
- The boss's own activity is not narrated by the coach. It is drawn at the boss's seat
  badge as "typing" while a tile beat runs and "thinking" for every other boss act
  (`:731-733`), on Steve's 2026-09-07 note that a person's activity belongs next to that
  person, quoted in the file.
- A boss tile is typed into the slot it will land in, character by character
  (`BOSS_TYPE_MIN_MS = 25`, `BOSS_TYPE_MAX_MS = 35`, `:101-102`), and the typed line stays
  in its cell until the real tile lands there rather than being cleared when the move goes
  out (`:426-440`). When the move lands, the slot flashes the same way a thrown card
  flashes (`:459-463`).
- A Gym draft is locked to the script's words: Place or Cancel are the only moves, on
  every level, until further notice (`:667-684`). The one exception is a beat that ships no
  sample, which would otherwise leave a composer whose Place button can never enable. A
  beat that asks the player to rewrite their own tile unlocks that one tile and no other
  (`:686-691`).

**Two strings live in `lib/gym/script.ts`**, both explanations of why the boss is not
answering a token the player put down ahead of the script (`offScriptTokenNudge`,
`:561-592`). They take priority over whatever else the bubble would have said:

> "Take back your {emoji} first, then put {emoji} down." (`script.ts:573`)
> "{bossName} answers tokens when this thread's talk is done. Keep going." (`script.ts:588`)

The four levels, current field values (`lib/gym/levels/onboarding.ts`,
`ground-rules.ts`, `claim-size.ts`, `clarity.ts`), all `[ruled]` against the 2026-08-22
skill-ladder and gym-levels design docs unless noted:

| # | id | title | topic | teaches (`cardId`) | boss | `rootTarget` |
|---|---|---|---|---|---|---|
| 1 | `onboarding` | Onboarding | "Should a hot dog be called a sandwich?" | `you_is_taboo` | Bashful Bob 🧑🏻‍💼 | 2 |
| 2 | `ground_rules` | Ground rules | "Should we stop changing the clocks twice a year?" | `stick_to_root` | Rambling Rosa 🧑🏽‍🔧 | 4 |
| 3 | `claim_size` | Claim size | "Should tipping be replaced by higher base wages?" | `no_exaggeration` | Braggy Bogdan 🧑🏼‍🔬 | 4 |
| 4 | `clarity` | Clarity | "Should AI-generated content be clearly labeled?" | `help_me_understand` | Sloppy Salma 🧑🏾‍🍳 | 4 |

`rootTarget` is the number of thread-roots required before any reply may hang off one
(`lib/board/rules.ts`'s root-stage gate); level 1 is 2 rather than the live-play 4,
since the level opens with one root from each side, Bob's first, and nothing may
reply to either root until both are down [ruled Steve 2026-09-05, BRAIN-T260905-32].

**Level 1's beats, in order** [ruled Steve 2026-09-05, BRAIN-T260905-32,
`lib/gym/levels/onboarding.ts`, 20 beats]. Nothing is explained ahead of time: each
token is explained when it is placed, the card when it is broken. Level 1 also runs
"cooked" [ruled Steve 2026-09-05, BRAIN-T260905-40 and BRAIN-T260905-43]: every player
tile below is the script's suggestion, placed as written with no editing, into the one
slot the beat points at, and the Ways to Win card and the rule-card tray both stay off
the board (`hiddenSurfaces: ["ways-to-win", "card-tray"]`, `:72`) until the beats below
reveal them. Level 1 scores no points; badges are the whole reward (`:248-250`).

1. Pause "The board" (`:79-81`), button "Got it":
   > "You're Minus: a hot dog is not a sandwich. Bob's Plus, he thinks it is.
   >
   > He goes first."
2. Bob places his own root first (`:95`):
   > "Yes, because a hot dog is a filling served inside bread, and that's what a
   > sandwich is."
3. Pause "Reason tiles" (`:101-103`), button "Got it":
   > "When the game starts, each player gives their best reason for their side. Bob says
   > yes to the topic question, so he put his best reason here.
   >
   > Your turn."
4. The player places their own root, coach (`:119-120`):
   > "Start your first thread by putting your best reason why a hot dog isn't a sandwich.
   >
   > I'll write one for you to get you started."

   Nudge "That one goes here, under the topic." (`:121`). Sole sample, placed as given
   (`:127`): "No, because nobody who orders a sandwich would ever be handed a hot dog."
5. The player answers Bob's root, coach (`:135-136`):
   > "Once both players have their main reasons on the board, then they reply to each
   > other's reasons.
   >
   > I'll help you reply to Bob's reason."

   Nudge "Here, under Bob's tile, the one at the top of his thread." (`:137`). Sample
   (`:143`): "But a bun is one hinged piece of bread, and a sandwich needs two."
6. Pause "Tiles answer tiles" (`:156-157`), button "Got it": "You answered Bob. We're
   making a threaded discussion."
7. Bob agrees outright rather than arguing back, `bossSays` (`:167`): "You're right, I
   hadn't thought of that."
8. Pause "Agree to agree" (`:173-175`), button "Got it". This is also the beat that
   reveals the Ways to Win card for the first time (`reveal: ["ways-to-win"]`, `:181`):
   > "Wow, congrats. You convinced Bashful Bob that he can agree to agree on this reason.
   > That's generous of him.
   >
   > Putting a 👍 on a root reason tile shows that while you may not agree on the topic in
   > general, you can agree that you've reached a consensus on this one thread."
9. The player mirrors Bob's token, coach (`:191-192`): "Click here to approve. That is
   Bob's 👍, and your click puts yours beside it and closes the thread." Nudge "Bob's 👍
   is on this thread, click it to approve his move." (`:193`). Badge
   `resolve-first-thread`. That thread closes at two tiles.
10. Bob's first reply on the player's own thread breaks 🙅 "You" is Taboo (`:205`): "But
    you only think that because you grew up eating them at ballparks. That's nostalgia,
    not a rule."
11. Pause "Moving around" (`:214-219`), held back 2,500 ms so the tile above can be read
    (`delayMs: 2500`, `:220`), button "Got it":
    > "Grab the dotted background of the board, anywhere, to move it.
    >
    > Or use these controls: the arrows move the board, the magnifiers zoom, and the last
    > button fits the whole board on screen.
    >
    > Try them now if you like."
12. Pause "Hold up" (`:226-227`), button "Next":
    > "Stop. Bob just made this about you, not about the hot dog.
    >
    > There's something you can do about it."
13. Pause "Your first rule card" (`:237-238`), which draws the card face and reveals the
    rule-card tray (`reveal: ["card-tray"]`, `:240`), button "Got it":
    > "This is a rule card: 'You' is taboo.
    >
    > Click the card, then click Bob's tile that broke it."
14. The player throws the card, coach "Click the card, then click the tile." (`:246`),
    nudge "Hang on. Read Bob's last tile again. Is it about the hot dog?" (`:247`). Badge
    `call-broken-rule`.
15. Bob revises the thrown tile (`:259`): "But the ballpark version of this argument is
    about memory, not about what the food is."
16. Pause "Rule cards keep your discussion calm and rational" (`:265-266`), button "Got
    it":
    > "After you flagged this rule card violation, Bob rewrote his tile to remove the
    > personal attack.
    >
    > I think you'll agree that this way of discussing a topic is far more productive."
17. The player answers the revision, coach "Answer Bob back, right under his tile."
    (`:273`), nudge "Under Bob's tile, right there." (`:274`). Sample (`:283`): "Still,
    nobody ordering a sandwich expects to be handed a hot dog either way."
18. Bob replies once more without conceding (`:298`): "Maybe, but a name can outlast its
    own history. I still think it's a sandwich."
19. The player proposes 👀, coach (`:304-305`):
    > "I think you two just see the world differently, and it's time to wrap this thread
    > up and agree to disagree.
    >
    > Click this root tile and choose the 👀 side-eye."

    Nudge "Propose 👀 on your own thread. Neither of you has to change your mind for it
    to close." (`:306-307`).
20. Pause "Ask for the confirm" (`:314-317`), `bossSays` "...sorry. I don't like to
    assume.", body "He won't place his until you ask. Agreement gets asked for, not
    assumed.", button "Ask Bob to confirm". Bob then places his 👀 and that thread, four
    tiles now, closes the level: both tokens have been seen in play. Badge
    `finish-one-game`.

**Level 2, Ground rules** (`lib/gym/levels/ground-rules.ts`, 21 beats, not cooked).
Rosa answers whatever she feels like answering, wherever she feels like putting it, and
the card is Stick to the Thread's Root. Both players get caught by it once. The level
intro's own three lines (`:71-73`) are:
> "You'll play a proper four-thread game against Rambling Rosa, which is what a normal
> match looks like."
> "Rosa answers whatever she feels like answering, wherever she feels like putting it,
> and this is the level where you stop letting her."
> "You'll earn the card that keeps every reason under the point it is actually arguing
> with, and you'll get caught by it once yourself."

The boss habit reads "check every tile against the root at the top of its thread, and
throw the card the moment one stops answering it" (`:69`).

Pauses, in order:
- "Four threads, and points" (`:87-89`), button "Got it": "Two reasons from each of you
  this time, four threads is the normal game.\n\nAnd there's a score now. You'll get
  points for catching Rosa with a card, and only for that. Nothing you write scores;
  catching does."
- "Hold up" (`:175-177`), button "Next": "Rosa just answered the tile you wrote over on
  her side. She put her answer in your crash thread.\n\nRead it against the tile at the
  top of that thread. It says nothing about crashes."
- "Your second rule card" (`:184-186`), draws the card, button "Got it": "This is a rule
  card: Stick to the Thread's Root. Every tile in a thread has to answer the tile at the
  top of it.\n\nClick the card, then click Rosa's tile."
- "Moving, not deleting" (`:215-217`), button "Next": "It was a fair answer to a question
  nobody in that thread had asked. Now it sits under the tile it was arguing with, and
  it's strong there.\n\nYou just made Rosa's point better. That's allowed."
- "Rosa says the same thing back" (`:241-245`), button "Move it", `bossSays` "Hold on. My
  reason there was about renegotiating schedules. That isn't what you've answered.",
  body "She's right, and it's the same rule.\n\nWhat you wrote is a good reason. It just
  belongs under your own energy thread, not under hers."
- "That's the card" (`:260-262`), button "Play it out": "You caught Rosa once and she
  caught you once, and neither tile went in the bin.\n\nA reason in the wrong thread is a
  reason in the wrong thread, whoever wrote it."

Rosa's tiles (`:99`, `:109`, `:169`) and her four closing lines (`:267`, `:290`,
`:296-297`, `:311`) read:
> "No, because long summer evenings are what make after-work life possible for most people."
> "No, because we'd have to renegotiate every schedule we share with countries that keep it."
> "But year-round summer hours would mean the sun coming up after nine all winter."
> "We're not going to agree about the evenings. I'd rather have them."
> "Point taken. The energy reason is gone."
> "One bad week a year. We're not going to agree about how much that weighs."
> "And schedules. Neither of us has put anything new in there."

Coach lines and their nudges, in beat order (`:115-318`): "Rosa has put two reasons down
on her side. Your first: one reason to stop changing the clocks." / "Hang it off the
topic. This one starts a thread of your own."; "And your second. A different reason, its
own thread." / "Off the topic again: this is your second thread, not an answer to your
first."; "Now answer one of Rosa's. Her evenings reason is the one to take on." / "Under
Rosa's evenings root, on her side of the board."; "Click the card, then click Rosa's
tile." / "Hang on. Read the tile at the top of that thread again. Is Rosa's tile
answering it?"; "Nothing's wrong with what she wrote. It's in the wrong thread. Click it,
hit Move it, then click the empty spot under your own tile on Rosa's side, the one she
was actually answering." / "Click Rosa's tile, hit Move it, then click the empty spot
under your tile in her evenings thread. Don't answer it where it sits."; "Rosa's other
thread is still bare. Put a reason under it." / "Under Rosa's second root, the one about
renegotiating schedules."; "Move it yourself. Click your tile, hit Move it, then click
the empty spot under your energy thread." / "Your tile, Move it, then the empty spot
under your own energy root."; "Rosa's put 👀 on the evenings thread. If you see it the
same way, put yours down." / "Same token, same thread: 👀 on Rosa's evenings thread.";
"Your energy thread now has two reasons in it and no answer. Propose 👍." / "👍 on your
own energy thread."; "Your crash thread. Same again: 👀 if you read it the way she
does." / "👀 on your first thread."; "Last one. Put your 👀 down and the board is done."
/ "👀 on Rosa's schedules thread."

Its four sample-answer pairs (`:123-124`, `:139-140`, `:154-155`, `:233-234`):
> "Yes, because the spring change brings a real spike in car crashes and heart attacks right after." / "Yes, because the week after the change, everyone I know is useless."
> "Yes, because the energy savings it was invented for have basically disappeared." / "Yes, because we're keeping a wartime measure for reasons nobody can state."
> "But we could keep summer hours all year round and stop switching, and the evenings stay." / "But that's an argument for light in the evening, not for moving the clocks twice."
> "But the fuel saving this was invented for stopped being real decades ago." / "But the studies that found a saving were measuring 1970s houses and 1970s televisions."

**Level 3, Claim size** (`lib/gym/levels/claim-size.ts`, 35 beats). The card is No
Exaggeration, and the level's tagline is "Bogdan claims more than he can carry. Today you
learn to ask him for the size." (`:59`); the boss habit is "listen for words like every,
never, and only, then throw the card and ask for a size he will actually defend"
(`:66`). Intro lines (`:68-70`):
> "You'll take on Braggy Bogdan, who says everyone, always and never when he means quite a lot of people, sometimes."
> "You'll learn to read the size of a claim, which is the difference between a reason you can back and a reason you just like the sound of."
> "And you'll earn the card that makes him cut a claim down to what he can actually hold up."

Pauses, in order:
- "Bogdan, and the size of a claim" (`:80-82`), button "Let's go": "Bogdan is not lying to
  you. He just says everything one size too big, cheerfully, and he will not catch himself
  doing it. Today's card is about the size of a claim, which turns out to have nothing to
  do with whether it is true."
- "Size is not strength" (`:183-186`), button "Got it", `bossSays` "Every restaurant
  that's tried going no-tip has gone back to it.", body "Watch that one. He said every. If
  that were my tile I'd have written that several well-known ones went back within two
  years. The smaller version is harder to argue with. You can't knock it down by finding
  one exception. Keep that in your head."
- "No Exaggeration" (`:192-195`), draws the card, button "Show me": "The agreement: I'll
  make claims at a size I can actually defend. Throw this card at a claim bigger than the
  reason underneath it, and the author restates it at a size they will stand behind. Rung
  one has a tell. The word gives it away, and there is one sitting on the board right now."
- "A true point, inflated" (`:221-224`), button "Show me": "No tell word this time. The
  point underneath is real. The size is not."
- "You inflate your own" (`:259-262`), button "Send it anyway": "Last rung, and it is the
  only one that is not about Bogdan. Catching an oversized claim is easy when someone else
  wrote it. Everything you have written is the right size, which is my problem: I cannot
  teach you this by waiting. So I have typed something into your box. It is your argument,
  two sizes too big. It is going to cost you points to send it. Send it anyway."
- "Pull it back" (`:296-298`), button "Fix it": "You had a real argument and you oversized
  it, and he went after the size instead of the argument. That is what it costs. Now
  restate it at something you would defend, and the points come straight back."

Bogdan's tiles and lines (`:91`, `:101`, `:142`, `:152`, `:177`, `:211`, `:215`, `:233`,
`:253`, `:285`, `:290`, `:328`, `:346`, `:377`, `:383-384`, `:420`) include: "No, because
the best servers out-earn any flat wage a restaurant would actually offer."; "No, because
the money comes out of the same pocket either way, menu prices just go up instead."; "But
a flat wage doesn't reward the difference between a server paying attention and one who
isn't."; "But plenty of jobs have variable pay and people manage it fine."; "But every
restaurant that's tried going no-tip has gone back to it."; "Which is harder to argue
with. Fine."; "But several well-known restaurants that went no-tip went back to tipping
within about two years."; "But tipping is the only reason service in this country is as
fast as it is."; "But tipping is one of the things that keeps servers turning tables
quickly."; "Completely disconnected? Come on."; "But a packed steakhouse pays nothing like
a dead diner, and 'completely' is doing your arguing."; "But nobody has ever made a
no-tipping restaurant work."; "But the no-tipping restaurants I know of have had a hard
time holding staff."; "Different tastes, then. I can live with that."; "Point taken. Once
I had to say it at a size I could defend, you were right."; "Agreed. Same pocket,
different certainty about who ends up paying."

Coach and nudge pairs (`:107-413`): "Bogdan wants to keep tipping. You want to replace it
with a wage. Your first reason, hung off the topic." / "Off the topic. This one starts a
thread of your own."; "And your second. A different reason, its own thread." / "Off the
topic again: your second thread, not an answer to your first."; "Bogdan answered your
first thread. Answer him, under his tile." / "Under Bogdan's tile in your first thread.";
"You just heard the word. Throw the card at the tile carrying it." / "Every. That is the
whole tell. Throw it at that tile."; "There is a real argument in that tile. Is it the
size he wrote it at? Throw the card." / "The only reason. Nothing is the only reason for
anything."; "Aimed at Bogdan's thread about the best servers. Take the tile I wrote and
send it." / "Under Bogdan's root about the best servers out-earning a flat wage."; "Your
tile, your edit. Same move you have thrown at Bogdan twice. Pull it back to something you
would defend." / "Open your own tile and rewrite it. Smaller, and harder to argue with.";
"Bogdan again, in his own thread. You know this shape by now." / "Nobody, ever. Same tell
as the first one."; "Bait, catch, throw, three times now, and once in the other direction
on your own tile. Answer him under the tile he just narrowed." / "Under Bogdan's narrowed
tile, in his same-pocket thread."; "Time to close threads. You two want different things
from a server's pay, and neither of you is wrong about what you want. Propose 👀 on your
first thread." / "👀 on your first thread, the one about strangers deciding the pay.";
"Bogdan has conceded your predictability thread. Put your 👍 down to match." / "👍 on your
second thread, the one about budgeting."; "His thread about the best servers. You value
the floor, he values the ceiling. Match his 👀." / "👀 on Bogdan's thread about the best
servers."; "One left. Propose 👍 on his same-pocket thread and the board is done." / "👍
on Bogdan's last thread."

Its sample answers (`:115-116`, `:130-131`, `:165-166`, `:278`, `:315-316`, `:360-361`):
> "Yes, because tipping means every server's pay is decided by strangers who have never done the job." / "Yes, because a server's income shouldn't depend on how charming a stranger finds them."
> "Yes, because tip income swings with the weather and the shift, so nobody can budget on it." / "Yes, because tip income swings with the weather and the shift, which makes it hard to plan around."
> "But restaurants already sort out who is good at the job when they hand out shifts and raises." / "But a tip tracks how busy the section was as much as how well anyone worked it."
> "But tipping makes a server's pay completely disconnected from how hard they work." (the deliberately oversized tile the player is told to send)
> "But tip income tracks how busy the restaurant is more than it tracks the server's effort." / "But a server can do everything right on a slow Tuesday and take home nothing."
> "The ones that lasted paid above the old tipped average, which is a pay problem, not a tipping one." / "Holding staff has been hard across the whole industry lately, tipped restaurants included."

**Level 4, Clarity** (`lib/gym/levels/clarity.ts`, 39 beats). The card is Help Me
Understand; the tagline is "Salma argues fast and leaves you guessing. Today you learn to
ask, not to complain." (`:58`) and the boss habit "throw the card and hand back how you
read the tile, instead of telling her it was unclear" (`:65`). Intro lines (`:67-69`):
> "You'll face Sloppy Salma, who leaves you guessing what she meant and then argues as if you had agreed to it."
> "You'll learn why you cannot answer a reason you have not understood, and why asking is a move rather than a delay."
> "And you'll earn the card that makes her say plainly what a word is doing before the two of you argue about it."

Pauses, in order:
- "Salma, and the words in between" (`:79-81`), button "Let's go": "Salma is quick and
  careless rather than hostile, and she takes every correction well. Nothing on this board
  is going to be a lie. The trouble is going to be sentences you cannot quite pin down,
  which is a harder thing to notice than a false one."
- "You can't argue with a question" (`:172-178`), button "Got it". This is the beat that
  carries all three voices: `bossSays` "Hmm, how would anyone even verify a label like
  that?", `moderator` "That's a question, Salma. Your side of the board is for statements.
  What's the claim behind it?", `bossReplies` "Fine. That there's no way to check one.",
  then the body: "That is a rule of the board, not a card. It applies to both of you and
  the moderator enforces it every time, so try it yourself and you will hear the same
  sentence. A question does not hand the other player anything to answer: there is no
  claim in it to agree or disagree with, so there is nothing for a tile to be. Which
  leaves a real problem. What do you do when their tile genuinely does not land? That is
  the card you are about to get."
- "Help Me Understand" (`:193-196`), draws the card, button "Show me": "The agreement: if
  I can't tell what a tile means, I won't say that it was unclear. I'll write out how I
  read it and hand it back. Throw the card, then type their tile back to them in your own
  words. They see your reading next to what they actually wrote, and that gap is the whole
  message. It tells them what to fix, which that was vague never does."
- "Why that worked" (`:271-273`), button "Next": "You never told her the sentence was bad.
  You showed her where a careful reader landed, and she fixed it herself in about four
  seconds. Try that was unclear on a real person some time and see how long it takes."
- "Define that" (`:279-282`), draws the card, button "Show me": "Sometimes the sentence is
  built perfectly well and one word inside it was never pinned down. You do not hand back
  a reading for that. You stop at the word and ask what it has to mean."
- "It binds now" (`:331-333`), button "Next": "That definition is pinned to the edge of the
  board, and it stays there. Neither of you gets to quietly switch it later, which is what
  makes asking worth doing rather than just polite."
- "Same card, different failure" (`:388-390`), button "Play it out": "That one was not
  ambiguous, it was just broken. Same card, same move, hand back a reading. You did not
  need me to tell you which rung it was, and you will not in a real game either."

Salma's tiles and lines (`:90`, `:100`, `:141`, `:151`, `:187`, `:221`, `:255-256`,
`:265`, `:291`, `:324-325`, `:342`, `:373`, `:382`, `:411`, `:453`) include: "No, because
nearly every tool has AI in it somewhere now, so the label stops separating anything.";
"No, because a label gets read as a warning, and the work gets judged before anyone looks
at it."; "But people already judge trust by the source, and a label doesn't change who's
publishing it."; "But the ones who disclose are also the ones whose work is easiest to
check."; "But there's no way to check whether a label is honest, so it's just a promise.";
"But nobody wants their work labeled by a machine."; "Oh. That's not it at all, and that's
on me. Reading mine back, it says both, doesn't it."; "But creators don't want a badge
stamped on work they made themselves."; "But a label is worthless unless what's underneath
it is actually authentic."; "Fair. A person made the substantive choices, whatever tools
they used to carry them out. That's what I meant."; "But labels that people ignore them
anyway doesn't help who it's for."; "Yes, that's exactly what I meant, and you wrote it
better than I did."; "But a label only helps if the person it was meant to protect
actually reads it."; "All right. Knowing who made a thing does change how I read it.";
"We just want different things from a badge. That's not a fact question."

Coach and nudge pairs (`:106-460`): "Salma is against labeling. You are for it. Your first
reason, off the topic." / "Off the topic. This one starts a thread of your own."; "And
your second. A different reason, its own thread." / "Off the topic again: your second
thread, not an answer to your first."; "Salma answered your first thread. Answer her,
under her tile." / "Under Salma's tile in your first thread."; "Salma's warning-label
thread has nothing from you in it yet. Answer her root." / "Under Salma's root about a
label reading as a warning."; "Read that one twice. Does it mean a machine decides what
gets flagged, or that the badge says a machine made it? Throw the card at it." / "It reads
two ways, and she cannot see it. Throw the card."; "Now the other half. Type her tile back
to her the way you read it, and hand it over. Do not tell her it was unclear, just show
her where you landed." / "Open her tile and hand back a reading in your own words."; "That
sentence is fine. One word in it is carrying the whole tile and neither of you has said
what it means. Throw the card." / "Authentic. Everything in that tile depends on it. Throw
the card."; "Now pin the word down. Name it, write what you think it has to mean here, and
let her answer." / "Pin down a word: authentic, and what it would have to mean for this
game."; "Salma's turn in her own thread." / "Did that one land for you? Be honest."; "Same
move. Hand her back what you think she was reaching for." / "A reading, in your words,
handed back."; "Answer the tile she just fixed, in her own thread." / "Under Salma's
rewritten tile about labels people scroll past."; "Salma has conceded your first thread.
Put your 👍 down to match." / "👍 on your first thread, the one about trust."; "Your second
thread now runs on the word you two pinned down, and you still weigh the cost of
disclosing differently. Propose 👀 there." / "👀 on your second thread, the one about
honest disclosers."; "Her thread about labels nobody reads. You two ended up agreeing.
Propose 👍." / "👍 on Salma's thread about labels people scroll past."; "Last one. Match
her 👀 and the board is done." / "👀 on Salma's warning-label thread."

Its sample answers (`:114-115`, `:129-130`, `:164-165`, `:209-210`, `:246-247`,
`:316-317`, `:364-365`, `:403-404`):
> "Yes, because people decide how much to trust something partly by knowing who made it." / "Yes, because a reader who knows how something was made can weigh it for themselves."
> "Yes, because without labels the only people who pay a price are the ones who disclose honestly." / "Yes, because honesty shouldn't be the thing that costs you readers."
> "Plenty of what people read has no publisher attached, which is where a label tells you something." / "Knowing who published a thing and knowing how it was made are two different questions."
> "Nutrition labels read as warnings at first too, and now people just read them." / "If a label reads as a warning, fix how it is written, rather than leave it off."
> "I read that as: creators don't want some automated system deciding what gets flagged." / "I read that as: creators don't want a stamp on work they made themselves."
> "authentic: a person made the substantive choices, whatever tools they used to carry them out" / "authentic: nobody used a generating tool at any point"
> "I read that as: a label that people scroll past doesn't help the person it was meant to protect." / "I think you mean the label only helps if someone actually reads it."
> "Then the argument worth having is about where the label sits, not about whether it exists." / "Some people will scroll past it, and the ones who stop get something they had no other way to know."

Bob's boss-tile text uses "But" as its literal reply lead (`onboarding.ts`'s
hardcoded lines), which is separate from the live board's dynamic "Hmm" reply-stem
system described in section 3 below: the level files hardcode boss dialogue directly
rather than routing it through `tileLead()`.

**The moderator is a distinct third voice from the boss**, used in level 4 to refuse an
illegal move mid-script: `clarity.ts:174-175`'s exact line is "That's a question, Salma.
Your side of the board is for statements. What's the claim behind it?" (naming the boss
by name, not a generic refusal). The director draws it prefixed "⚖️ Moderator: " and
set apart from both players' lines (`director.tsx:944-949`). This is Gym-scripted flavor
text rendered on a `pause` beat, not a change to the live game's `canPlaceTile` refusal
strings in section 3. It is the only `moderator` line in any level script.

**"Show me" exists; an all-caps "SHOW ME" control does not.** Both `claim-size.ts`
and `clarity.ts` render a title-case "Show me" control at several points in their
scripts; no shipped string reads "SHOW ME".

**The certificate** (`components/gym/certificate.tsx`, full, 168 lines): eyebrow
"Gym · Level {level.number} cleared" (`:65-67`), H1 "Certificate of Agreeable
Disagreement" (`:68-70`), the level's topic (`:71`), then a four-stat row whose labels
are the token names, not summary phrases: "Agree to agree" over "👍 {count}"
(`:75-76`), "Agree to disagree" over "👀 {count}" (`:79-80`), "Points" over the
score (`:83-84`), and "Reformed" over the boss's emoji and name (`:87-90`); the boss is
reformed, never "beaten", matching the standing name for this mechanic. A "Card granted"
block follows when the level grants one, showing the card's name and its plain-language
line (`:100-106`), then a "Badges" list when there are badges (`:113`). A closing line
reads either "Saved to your account{ on {date}}. Badge names are still placeholders."
(`:137-138`) or, for a level replayed after its awards were already recorded, "Shown
from the level script. This game ended before awards were recorded, so nothing here is
saved to your account." (`:142-144`). Nav: "Next: Level {next.number}" when another
level remains (`:150-152`), "Back to the ladder" to `/#ladder` (`:154-156`), "Your
games" to `/account` (`:157-162`).

**Finding: the gym's own topic list is a 4-topic subset, separately balanced.** These
four practice topics are distinct from the 17-topic `TOPIC_LIBRARY` in section 2 and
read as comparatively low-stakes and non-political by design (a food-naming question,
a clock-policy question, a tipping-and-wages question, an AI-labeling question); none
of the four touches the sharper political ground several `TOPIC_LIBRARY` entries do,
so the aggregate-imbalance finding in section 2 does not extend to this list.

GAP: level names above 4, and the badge taxonomy referenced by "Badge names are still
placeholders" above, are listed as still-moving in `CLAUDE.md`; not resolved here.

## 6. End of game

`components/win/win-overlay.tsx` (full, 275 lines), `[unratified]` unless noted: heading
"You both won." (`:170`); a code comment directly above it (`:165-169`) states this as
`[ruled]` design intent, not just current copy: both win conditions are cooperative, and a headline congratulating one
player is the one sentence on the screen that would contradict the game. Close button
`aria-label="Close and review the board"` (`:158`, unchanged). A `ReopenPill` button,
shown once the overlay has been dismissed once, now reads "🎉 You both won. Show
results" (`:81`), with no em dash; see the retired Finding below.

Body copy differs by win variant: for a threads-resolved win, "Every thread got a
token:" (`:176`) followed by one row per resolution-token type actually used, each
showing the token glyph, its `tokenLabel`, and a count phrased "{n} thread" / "{n}
threads" (`:191-193`, name first and tally second); for a topic-agreed win, "You agreed
on a wording you would both sign:" (`:203`) followed by the agreed topic text in a
`TopicTile`. A closing italic line, present for both variants: "Stay as long as you
like. The game is finished, and the whole board is still here underneath, to read back
as often as you want." (`:218-219`). Its own code comment (`:209-216`) states this
replaced an older sentence promising a player could keep adding to the board or try for
the other ending too, which the comment calls two-thirds false: reaching either ending
ends the game and swaps the live board for a read-only recap, so there is no second
ending left to try for.

Buttons: "Leave feedback" (`:239`, only rendered when a feedback-share URL exists),
"Share to LinkedIn" (`:248`, via LinkedIn's public share-offsite URL, carrying only the
hardcoded `PUBLIC_GAME_URL = "https://play.pointtaken.social"` at `:59`, not any
per-game data), and a separate gold pill below the card. A code comment (`:222-230`)
explains the visual grouping: Share/Feedback are the quiet pair, the gold pill is the
one way on, because going to LinkedIn is not what a player wants next.

**The gold pill's label and destination are now props, not fixed copy.** `exitLabel`
defaults to "Play Again" and `exitHref` to `/` (`:88-89`), and the pill renders as a
`Link` to `exitHref` (`:259`) or, when `exitHref` is `null`, as a button that dismisses
the overlay in place (`:270`). `app/game/[gameId]/page.tsx` passes the default pair for
a regular game (`:132`), and for a cleared Gym level passes
`exitLabel="Go to game wrapup" exitHref={null}` (`:89`), so a Gym win gets the same
celebration overlay and its pill drops the player onto the certificate underneath
rather than sending them to the front door. "Go to game wrapup" is `[unratified]`.

**No em-dash house-style violation here.** The `ReopenPill` text reads "🎉 You both won.
Show results," which contains no em dash. `flattenDashes()` sanitizes AI output only,
never static UI strings, so a literal em dash written into static JSX would go
un-remediated; this string does not carry one.

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
[ruled Steve 2026-09-03]. **Signed out, `/` changed again 2026-09-08 (commit
`cb7ec32`):** the room-code entry field, "Join a game", and
"Create a room" are gone from this screen entirely (Steve: they were "confusing
before a visitor has an account"); they now live only on the profile's Live play card
(`ProfileHero`, "Play with your peers", below). What is left on the signed-out front
door is just the wordmark, a single Terms of Use / Privacy Policy tick
(`AgreementTick`), a "Set me up" button (`StartPlaying` with `label="Set me up"`),
and a new "Login" link to `/signin`, then the how-to-play links. Every action still
mints an account, so a signed-out visitor ticks the agreement first, enforced again
server-side.

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
to are a live, built system, not a doc gap. The leaderboard section below describes a
cooperative-only ranking, which matches Steve's ruling that only cooperative rankings
are allowed, so there is no conflict here to flag.

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

**`app/error.tsx`** (full, 82 lines), the render-error boundary inside the layout. Its
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

**`app/not-found.tsx`** (full, 80 lines), the 404, described in its own header
comment (`:4-22`) as "a routine destination here rather than an edge case": a
mistyped room code, a game that has ended, or a game the visitor was never a member
of (BRAIN-T260822-14) all land here, and the page deliberately gives the same answer
for all three so nobody can probe which game ids are real. `metadata.title`, "Not
here - Point Taken" (`:25`, note this string's own hyphen, not an em dash). H1 "That
page is not here" (`:32`); body "Nothing is broken. This address does not open
anything for you right now." (`:34`). "The usual reasons" list (`:39-54`): "A room
code went in the wrong place. The five characters someone reads aloud go to
`/join/` and the code, like `/join/ABC23`. The `/game/` address takes the long id
the site hands you once you are in." (`:42-46`); "The game finished and the room
closed." (`:48`); "The link is to a game you were not in. A finished game is
private to the two people who played it, so it opens for them and for nobody
else." (`:50-51`); "The address is a character off." (`:53`). The file says "five
characters" at `:42`, matching `JOIN_CODE_LENGTH = 5` in `lib/games/joinCode.ts`. "Where to go instead" list
(`:57-77`): "Start a room" (`:62`), "Your games" (`:68`, described as listing
"every game you have played, finished ones included"), "How to play" (`:73`,
described as "walks the four steps without leaving the page you are on").

**`app/account/start-playing.tsx`** (full, 61 lines, parameterized, `[unratified]`). `export function StartPlaying({ label = "Start
playing", withTick = true })` (`:16-25`) is invoked in two places with different
props: on the account page's empty state (section 7 above) as the default, plain
"Start playing" with its own `<AgreementTick />` rendered inline (`:49`); and, as of
commit `cb7ec32`, on the signed-out front page (`app/page.tsx`) as `label="Set me
up"` with `withTick={false}`, since the front page renders its own single
`AgreementTick` above it and a second tick box would be two controls for one
answer (the component's own header comment says as much, `:21-23`). Button text
toggles between the given `label` and, while the sign-in request is in flight,
"Getting you a name..." (`:56`); on failure, the raw error message is shown in red
text (`:58`), sourced either from the server's own JSON `error` field or a fallback
`` `sign-in failed (${res.status})` `` (`:38`) constructed client-side, so this is
the one string on this list that is not a fixed literal.

`WhyNotAll` / `WhyNot` components (`live-board.tsx`) render the rule-verdict refusal
strings from section 3 as inline explanations next to a disabled control, rather than
inventing separate UI copy: same string, two call sites.

---

## Coverage

To keep this snapshot honest about its own reach, these in-scope surfaces are unread
here: `components/board/game-setup.tsx`, `components/board/topic-tile.tsx`,
`components/board/rule-card-popup.tsx`, `components/feedback/feedback-popover.tsx`,
`lib/feedback/stage.ts`, `lib/feedback/config.ts`, `lib/feedback/submit.ts`, and
`app/join/actions.ts` / `app/join/[code]/page.tsx`. Section 8 ("Errors and empty
states") is unverified against current code. `components/info/paths-to-winning-card.tsx`
does not exist in this repo: no such path, no similarly named component.

This document carries one live `GAP:` marker, at "level names above 4, and the badge
taxonomy", and no `[vibecoded]` values. The unread files above are named so a future
regeneration knows where coverage is thin rather than assuming this document is
exhaustive.
