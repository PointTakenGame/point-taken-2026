---
slot: soul.md
game: brain
purpose: Why the Point Taken Brain game exists and what it is for, so a coding agent making a judgment call chooses the way Steve would.
written: 2026-08-28 by biz
status: draft, unreviewed by Steve
sources:
  - point-taken-biz/docs/brand/PT-soul.md
  - point-taken-biz/docs/brand/goals/PointTakenGoalsAndNarrative.txt
  - point-taken-biz/docs/brand/goals/2026-08-22_retention-loss-condition-synthesis.md
  - point-taken-biz/docs/brand/marketing/MARKETING_PRIORITIES.md
  - point-taken-biz/docs/reference/2026-08-22_skill-ladder-levels-1-4.md
  - point-taken-biz/docs/reference/2026-08-22_gym-levels-1-4-implementation-guide.md
  - point-taken-brain/docs/reference/materials/mechanics/GAME_MECHANICS.md
  - point-taken-brain/web/point-taken-2026 (lib/board/rules.ts, lib/board/setup.ts, lib/coach/, app/gym/page.tsx)
---

# Brain: the soul document

Point Taken ships two separate games. This one is **Brain**: a two-player web game
about logic and argument mapping, a Next.js app over an append-only event log. The
other game is Heart, a different game with its own rules; nothing in it applies here.
Steve Franconeri is founder, vision-holder, and game designer. Where this document
and a code comment disagree about intent, this document is the intent and the comment
is the current state.

**On the markers in this file.** A `[ruled]` here with no id, person, or date after it
is a standing position from Steve's brand narrative, not a numbered decision. It is
binding, and it is also the kind of claim to raise with Steve directly rather than to
look up. `rules.md` carries the marker legend and every player-observable constant.

## 1. The problem Brain exists to attack

People are not mainly divided by policy. They are divided by contempt, and by
caricatures they never checked. All figures here are [ruled], from Steve's brand
narrative:

- Feeling-thermometer affection toward opposing partisans fell from a neutral 48
  degrees in the 1970s to a cold 20 today, while warmth toward one's own side stayed
  at 70 to 75. Outparty hate now exceeds inparty love.
- The misperception gap is enormous in both directions. Republicans estimate 32
  percent of Democrats are LGBT; reality is 6 percent. Democrats estimate 38 percent
  of Republicans earn over $250k; reality is 2 percent.
- Argument mapping produces critical-thinking gains on the order of a college education.
  Controlled testing of Point Taken found a very large gain in understanding one's own
  reasoning (d=1.4), a modest gain in understanding the partner's position (d=0.2),
  warmth toward the opponent (d=0.5), willingness to befriend (0.4), humility (0.4).

Two everyday facts under those numbers matter more for design calls. **Debate is junk
food**: it caters to the urge to signal to your side and demonize the other, and media
teaches it as a combat sport. Dialogue is broccoli, costing stamina and regulation, and
nobody does it by accident. **Verbal argument is a cognitive hot mess**: working memory
holds roughly three items and the clock is running. Writing forces slow thinking and
builds an external memory surface, a visible tree of claims you can point at instead of
re-remembering. Brain is that second lesson made mechanical. Its job is not to make
people want dialogue, it is to hand people who already want it a structure that
executes it.

## 2. The one-sentence goal

Not to determine who is right. **To uncover how two reasonable people could reach such
different conclusions.** [ruled]

The end state Steve wants is not agreement. It is the discovery that a disagreement
rests on different priorities, different facts, or different taste, stated cleanly
enough that both people recognize it. A session ending in a sharp, well-articulated,
unresolved disagreement is a **win**, and any mechanic, copy line, or reward implying
otherwise is wrong. [ruled]

## 3. Who plays, and why they showed up

- **The severed-relationship player.** Almost everyone has a beloved relative or old
  friend they can no longer talk to; the brand narrative calls him "Uncle Dan". They
  arrive wanting the relationship back, not a logic exercise. Onboarding copy that
  reads as a puzzle app loses them.
- **Two willing people who already disagree.** Canonical mode is exactly two players
  (`lib/board/setup.ts:182`).
- **Classrooms, workplaces, community groups**, where a facilitator brings the game to
  people who did not individually ask for it. Testing has happened in bars,
  nonprofits, private-equity firms, high schools, and with Army officers. [ruled]
- **A solo learner in the Gym**, practicing before ever facing a person.

The first public release aims at the **education sector** first [ruled Nathan 2026-08-29],
and is not built for it alone. Point Taken is for the general public on an opt-in model, so
no one audience gets a surface tailored to it at the expense of the others.

Nobody is conscripted. The game is strictly opt-in and never asks a vulnerable
person to defend their own existence to a hostile stranger. A player who
wants to demonize rather than reason is outside the frame, and the correct product
response is exit, not accommodation. [ruled]

## 4. What a good session feels like

Quiet. Two people typing, mostly not speaking. The board grows as a tree of short
claims rather than a scrolling transcript, so nothing said ten minutes ago has to be
held in anyone's head. The shape of it:

1. Both players sign, in good faith and not as a contract, three lines: Play fair
   (Mutual Respect), Stay on the thread (Honest Thinking), Pin it down (Shared
   Facts). See `rules.md` section 3 for the normative wording and its ruling id.
   An older four-item version is superseded: the fourth line was folded into Play
   fair and the `same_team` id is dead (`lib/board/setup.ts:26-30`).
2. They pick a topic phrased as a question starting with "Should", one they actually
   disagree about. [ruled]
3. Plus argues yes, Minus argues no. Each writes short reasons, one idea each, hanging
   every new one off an existing claim.
4. Where writing stalls, a bounded speaking window opens: **30 seconds for the speaker,
   45 seconds to summarize what was said back.** [ruled Steve 2026-08-28] Note for the implementing
   agent: no turn timer exists in the current code, nothing in `lib/` or `components/`
   models a clock. This is a ruling awaiting a build.
5. A thread closes when both players place the **same** resolution mark on the same
   claim: 👍 "point taken, you actually moved me", or 👀 "now I see why we disagree".
   Both must agree which. [ruled, Steve 2026-08-23, `lib/board/rules.ts:45`]
6. The session ends cooperatively, one of two ways: every thread resolved, or both
   players endorse a rewritten version of the topic. [ruled]

Felt qualities Steve reports from real sessions, which a build must not destroy:
conversations are shockingly calm, opponents stop reading as cartoon villains, players
quietly retreat from their own silliest arguments once they have to write them down,
and players discover they agree on most of the underlying logic. GAP: the two brand
sources give different figures for that agreement rate, 75 to 80 percent and 75 to 90
percent. Which may be quoted publicly?

The most transferable moment in the design is small and easy to build away: **you ask
for agreement, you do not announce it.** In the Gym's first level the scripted opponent
will not confirm a resolution until asked. That beat of silence carries more of the
lesson than any card. [ruled, per the levels 1 to 4 design]

## 5. The referee is the AI

There is no third human referee in Brain. The AI, called the coach in code
(`lib/coach/`), is the entire officiating layer, so its character is spelled out here
rather than left to the prompt file. **It referees form, never side.** It has no opinion
about the topic and never indicates one. A well-made reason for a position the model
finds unconvincing is a well-made reason, and it says nothing. Both sides of any
question are equally entitled to be argued well.

**Its vocabulary is exactly the card set the players already hold, and nothing else.** A
coach that invents its own categories teaches a second, invisible rulebook the player
has no card to answer with. The first-release four (`lib/coach/cards.ts`), and adding a
fifth means adding it to that file, never editing the prompt [ruled, Steve 2026-08-23:
build the infrastructure, the rules come later]:

| Card | What breaking it looks like |
|---|---|
| 🙅 "You" is Taboo | The reason describes the other player rather than the question. Second-person address about the argument is fine; characterizing the person is not. |
| 🎯 Stick to the Thread's Root | True, interesting, and about a different question than the claim the thread hangs off. |
| 📏 No Exaggeration | An absolute where the evidence supports a tendency, a worst case sold as the expected case, or a number with nothing behind it. |
| 💬 Help Me Understand | Too compressed to answer: a key term undefined, or the step from evidence to conclusion left for the reader to guess. |

**Silence is the normal answer.** Most reasons find nothing wrong. The coach does not
reach for something to say, and does not pad with praise. **A suggested rewrite fixes
how a thing was said, never what was said.** It argues the same side just as strongly;
if it cannot stay inside the tile limit without weakening the player's position, it
returns nothing rather than a softer argument the player never made. **The consequence
of any challenge is a revision, always.** Nobody ever loses a point. Given a choice
between "you lost something" and "here is the thing to fix", the second is correct.

Under the hood: one model call per reason, reporting structural relation, a nine-item
fallacy checklist ported from the Northwestern study pipeline (personal attack, not a
statement, overgeneralization, exaggeration, false causation, straw man, appeal to
authority, anecdotal data, whataboutism and red herring), whether the reason is on its
thread's root, and whether it needs clarification. Settings, all [unratified]: model
`claude-haiku-4-5-20251001`, 12s timeout, 900 max output tokens
(`lib/coach/evaluate.ts:62,68,72`).

## 6. The Gym

The Gym is single-player practice against a scripted opponent, levels 1 to 4, and it
**is on the critical path** [ruled, Steve, 2026-08-28]. Before touching
`app/gym/page.tsx` or the repo's working-agreement file: an earlier 2026-08-17 ruling
took the scripted opponent off the critical path and is quoted in several code
comments. The 2026-08-28 ruling supersedes it, so those comments are stale.

Each level teaches one card, and each level's skill must survive outside the game: it has
to be statable in one dinner-table sentence with no game vocabulary. If a sentence needs
the words "tile", "thread", or "card", you have described a mechanic, not a skill.
[ruled]

| Level | The skill, in plain words | Card |
|---|---|---|
| 1 Onboarding | "I can disagree with what you said without saying anything about you." Plus: "Agreement is something you ask for. You don't get to announce it." | 🙅 |
| 2 Ground rules | "That's true, and it isn't an answer to what I asked. Here's the question it does answer." | 🎯 |
| 3 Claim size | "That's bigger than what you can back up. Say the version you'd actually defend." | 📏 |
| 4 Clarity | "Here's what I heard you say. Is that what you meant?" | 💬 |

Three structural facts about the ladder that decide close calls:

- **Level 3 is the only level that asks the player to fix themselves.** The other three
  teach a call about someone else's writing; level 3 turns the same card inward. That,
  not the subtlety of exaggeration, is why level 3 is where the ladder gets hard.
- **Level 4 substitutes rather than adds.** It removes the move "that was unclear" and
  puts something in its place. You never show someone their writing was unclear by
  telling them it was unclear.
- **Acceptance is the score.** Nothing ever judges the quality of a player's restatement
  of the other person. The other party accepting it is the whole test.

**You cannot fail a Gym level.** [ruled, Steve 2026-08-23] No move budget, no timer, no
wrong-answer counter, no retry loop, no way to be sent back to the start. A player who
throws the wrong card, misses a bait, or sits still gets the coach again and the script
waits. A `failure`, `lives`, `attempts`, or `maxMoves` field in Gym config is a bug.
Practice that can be failed stops being practice.

The four Gym topics are deliberately weightless or purely definitional: a food category,
a clock convention, restaurant pay, content labeling. Neutrality there comes from
avoiding charged material rather than balancing it, so swapping in a charged topic
re-opens the obligation in section 9.

## 7. The values that decide close calls

When nothing above covers a decision, decide in this order.

1. **Cooperative by construction.** Every win condition is shared. No move may raise
   one player's standing at the other's expense. If a mechanic could be scored either
   way, score the pair.
2. **Challenges produce revisions, not penalties.** The most load-bearing rule here,
   and the easiest to erode by accident with a well-meant progress bar.
3. **Understanding beats persuasion, always.** Given one feature that makes a player
   better at winning and one that makes them better at stating the other side's view
   accurately, build the second.
4. **Writing over talking, and slowness is the feature.** Anything that speeds a player
   up, autocomplete, canned replies, a one-tap agree, is suspect. The friction is the
   work.
5. **No invisible second rulebook.** Every constraint the player is held to must be
   visible and, where applicable, throwable back.
6. **Never soften a player's position on their behalf.** Not in a rewrite, not in a
   summary, not in a nudge.
7. **The player is never trapped.** Leaving is always available and never punished. A
   cool-off is a real pause, not a penalty box.
8. **Care goes underneath, roughness is allowed on top.** The event log, board
   projection, and migrations are careful; most screens are deliberately plain. Bad
   copy is not evidence the architecture needs rescuing.
9. **The event log is truth, every aggregate is a cache.** A correction is a new
   corrective event, never an edit to an old row. Architecture, and also a value: the
   record of what two people said to each other is not editable later.

## 8. What Brain is not trying to be

- **Not a debate scoreboard.** No winner, no ranked ladder of debaters, no currency and
  no token economy: do not introduce one. [ruled Steve 2026-08-28]
- **Not a persuasion trainer.** Getting better at Brain is not getting better at
  changing minds.
- **Not a fact-checking oracle.** The AI flags claims leaning on unstated evidence, it
  does not adjudicate truth. Checking facts is something the two players do together,
  and pausing the game to do it is a legitimate move. [ruled]
- **Not a moderation product.** Not a civility filter for comment sections, not a
  content classifier, not a tool deployed against people who did not opt in.
- **Not a chat app.** The board is a tree of claims. A decision that makes it read as a
  message thread is wrong.
- **Not a therapy tool.** It sits next to relational repair and is not it. No clinical
  claims, and none implied.
- **Not a bland-consensus machine.** Becoming more uncertain, and articulating a
  disagreement more precisely, are both successes.
- **Not partisan, and not quietly partisan either.** See section 9.
- **Not Heart.** Different game. Do not borrow its mechanics, vocabulary, or content.

## 9. Political neutrality, non-negotiable

The game is a referee. It does not care who wins and enforces only honest reasoning and
respect. That claim has to survive a hostile reader on either side, which means: **every
politically legible example anywhere in this product, in code comments, prompt text, UI
copy, or tests, needs an equally vivid counterpart from the other side, or an explicit
written acknowledgment that it is unbalanced.**

Not a suggestion, and it applies to inherited material. The fallacy checklist ported
into `lib/coach/checks.ts` leaned in several places, most sharply where both flagged
straw men were straw men of the same side. The remedy used there is the precedent: **add
a mirror beside the example, never delete the original.** Where an example can be about
a word rather than a position, make it about a word. The instructions pages do that on
purpose.

## 10. Numbers currently in force

**Every player-observable constant lives in `rules.md`, each with its own status
marker and code citation. This document does not restate them**, because two copies
of a number is how the two copies come to disagree. Go there for the thread ceiling
and the four-thread floor, the resolution tokens and the deferred 🔍 ⚖️ 🍷 split, the
topic-agreement endgame, tile and restatement and topic lengths, seats per game, room
code length, and the speaking window.

One number belongs here instead, because no player can observe it directly and no
code enforces it:

| Value | Status | Where |
|---|---|---|
| Session length target, 20 to 40 minutes | [vibecoded]; the printed paper instructions say 15 to 30 minutes and no web target was ever ruled | no file |

**There is no failure state in live play either** [ruled Nathan 2026-08-29]. No player
punishes another, and no session collectively loses. Two people who genuinely found no
common ground still finish the ordinary way: four threads closed with 👀 on each, saying
they can now see why they disagree. That is an outcome, not a loss. There is no named "no
resolution" ending and no visible turn budget. The only way a game stops without either win
condition is a player leaving or disconnecting, which closes it as `abandoned`
(`lib/games/abandon.ts`) and is scored against nobody.

**A player's history is not public** [ruled Nathan 2026-08-29]. Badges, points, and stats
are personal and non-comparative, and nothing a player earns is visible to another player.
Opening part of it up later stays possible, and nothing is designed on that assumption.

## 11. Material that cannot be carried into this repo

These live above the repo root, are never pushed, and no path here reaches them. Ask
Steve for them by name:

- `2026-08-22_gym-levels-1-4-implementation-guide.md`, the beat-by-beat script for
  levels 1 to 4 including boss lines, badges, and point values. Source of record for
  Gym content, roughly 1,500 lines; section 6 is lossy on purpose.
- `2026-08-22_skill-ladder-levels-1-4.md`, what each level teaches and in what order.
  Section 6's table is condensed from it.
- `2026-08-23_account-pages-entity-list.md`, the account screens and their entities.
- `Instructions.pdf` (v2025.08.18), the printed booklet, 38 MB of print-ready layout.
  Needed only for exact card wording or visual design.
- The Figma files for board and card art, held by Rannie (Xinran Li) and Audrey Chung.
  Binary, cannot be carried in text.
