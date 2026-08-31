---
slot: rules.md
game: brain
purpose: The player-visible rules of Point Taken Brain, separating what the code enforces today from what is designed and unbuilt, with every specific value marked ruled, unratified, vibecoded, or refused.
written: 2026-08-28 by biz
status: draft, unreviewed by Steve
sources:
  - point-taken-brain/docs/reference/materials/mechanics/GAME_MECHANICS.md
  - point-taken-brain/docs/reference/materials/spec/2026-08-22_gym-levels-1-4-implementation-guide.md
  - point-taken-brain/docs/reference/materials/spec/2026-08-22_skill-ladder-levels-1-4.md
  - point-taken-brain/docs/reference/materials/spec/2026-08-22_ai-feedback-vocabularies.md
  - point-taken-brain/web/point-taken-2026/lib/board/rules.ts
  - point-taken-brain/web/point-taken-2026/lib/board/setup.ts
  - point-taken-brain/web/point-taken-2026/lib/board/language.ts
  - point-taken-brain/web/point-taken-2026/lib/coach/cards.ts
  - point-taken-brain/web/point-taken-2026/lib/coach/checks.ts
  - point-taken-brain/web/point-taken-2026/lib/coach/evaluate.ts
  - point-taken-brain/web/point-taken-2026/lib/coach/run.ts
  - point-taken-brain/web/point-taken-2026/lib/events/types.ts
  - point-taken-brain/web/point-taken-2026/lib/gym/root-suggestions.ts
  - point-taken-brain/web/point-taken-2026/app/how-to-play/page.tsx
  - point-taken-brain/web/point-taken-2026/app/gym/page.tsx
  - point-taken-brain/web/point-taken-2026/components/board/token-glyph.tsx
---

# Point Taken Brain: the rules

This is the Brain edition only: the two-player web game of written argument on a board of tiles. Heart (Humility Showdown) is a separate game with its own cards, tokens, and endgame; nothing from it appears here.

## How to read the markers

Every specific value carries one inline:

- `[ruled]` Steve or a registry decision established it. Build it; changing it needs a new ruling. Where a specific decision id, person, or date exists it is given; a `[ruled]` with none behind it is a long-standing design position rather than a numbered decision, and is still binding.
- `[unratified]` It lives in the code or in a source doc and nobody ruled it. The file and line, or the doc, is cited. Changing it needs no permission but it also has no authority behind it.
- `[vibecoded]` Invented here because a rough sketch beats a blank. Do not treat as canon.
- `GAP:` Refused. The exact question a human has to answer is stated.

Two labels that matter more than the rest: **true today in the code** means a player running the repo right now sees it, and **designed, unbuilt** means it is decided on paper and no code does it.

## 1. Object of the game

Two people who disagree about one question write short reasons at each other on a shared board until they can name exactly where they part ways. The goal is not to prove who is right. It is to uncover how two reasonable people reached different conclusions [unratified: GAME_MECHANICS.md, distilled from Instructions.pdf v2025.08.18].

Both ways the game can end are agreements. Nobody wins by scoring off the other player.

**There is no token economy in Brain.** No token counts, no token supply per game, no "most tokens wins" [ruled Steve 2026-08-28]. The two resolution tokens described in section 5 are unlimited markers of a shared verdict, not currency.

**There is no human referee.** Whatever calls a foul, scores a turn, or gives feedback is either the AI coach (section 8) or the moderator, which is a system channel with no avatar that enforces board law at write time [ruled Steve 2026-08-28]. Players themselves throw cards at each other (section 7).

## 2. The board and the pieces

- One **topic tile** at the center, always phrased as a question starting with "Should" [unratified: GAME_MECHANICS.md]. Max 300 characters [unratified: lib/board/setup.ts:160].
- **Reason tiles** hang off the topic or off another tile. A tile is one short sentence, not a question. Max 100 characters, enforced on both client and server [unratified: lib/board/rules.ts:14, comment says it is the limit the printed game uses].
- A **thread** is a chain of tiles rooted in a tile hung directly off the topic.
- Two seats: **Plus** says yes to the topic, **Minus** says no. Exactly 2 players [unratified: lib/board/setup.ts:182]. Seats are fixed for the game.
- Digital tiles are unbounded in number; the print game ships about 6 tiles per side [unratified: GAME_MECHANICS.md].

**The one rule above all others:** a tile must make the root of its thread more or less likely to strengthen or weaken support for the topic [ruled BIZ-T260823-77]. Everything else is a special case of this. Whataboutism needs no detector because it fails this test by construction.

## 3. Setup and sequence of play

True today in the code:

1. One player starts a room and gets a 5-character join code [unratified: lib/games/joinCode.ts:17]. The other types it or opens the link. There is no host and no computer opponent.
2. Each player picks a side. The other side is then unavailable ("The other player is already on that side.").
   A player types a display name of 2 to 40 characters
   [unratified: lib/names/validate.ts:10-11]. Both bounds are player-visible:
   too short reads "A name needs at least two characters." and too long reads
   "A name can be at most 40 characters." (`:55`, `:60`).
3. Both players sign the agreement. **Three lines** [ruled BIZ-T260822-07 guide §2.6]: "Play fair" (family Mutual Respect), "Stay on the thread" (Honest Thinking), "Pin it down" (Shared Facts). It is a ritual, not a consent form: there is no partial signing ("Signing means standing behind every line.") [unratified: lib/board/setup.ts:31].
4. Either player sets the topic, from a 17-entry library or written fresh [unratified: lib/board/setup.ts:55]. Either player can start; nobody waits on a host.
5. Play begins. Tiles go down, threads grow, tokens close threads, cards get thrown.

Designed, unbuilt: each player writes 2 starting reason tiles before play, Plus using "Yes, because" and Minus using "No, because" [unratified: GAME_MECHANICS.md]. Nothing in the code requires this.

`GAP: does the web version require each player to write two opening reason tiles before the board opens, or is the first tile free?`

## 4. A turn, and its timing

**Turn order.** True today in the code: there is no turn order. No field, no check, no notion of whose turn it is anywhere in `lib/board/rules.ts`. Either player may place a tile at any time the board is open.

`GAP: is Brain strictly alternating, or free-running with both players able to write at once? The code assumes free-running and no source doc rules either way.`

**Timers.** 30 seconds for the speaker and 45 seconds to summarize [ruled Steve 2026-08-28]. Designed, unbuilt: no timer code exists anywhere in the rebuild. The print game instead has a 1-minute chat timer, flipped by hand when writing is not enough [unratified: GAME_MECHANICS.md].

The Gym has no timer at all, as part of having no failure state [ruled BIZ-T260823-67, guide §2.10].

Timers are advisory in live play and absent in the Gym [vibecoded: this reconciliation of the 30/45 ruling against the no-timer Gym ruling is an interpretation, not a decision].

`GAP: what happens when the 30-second or 45-second timer expires? Is the turn forfeited, is the tile discarded, or is the timer purely a nudge with no consequence?`

`GAP: what is the 45-second "summarize" turn as a board action? No move in the code corresponds to summarizing, unless it means the reading described in section 6.`

**What a turn is.** Write one reason, up to 100 characters, and hang it off a tile already on the board. A reason hung straight off the topic starts a new thread.

Refusals the player sees today [unratified: lib/board/rules.ts, `canPlaceTile`]:

- Empty text: "A reason needs some words in it."
- A seventh thread: "A game holds at most 6 threads. Add this to one of them instead."
- A resolved thread: "That thread is already resolved."
- Board closed: "This game is over." or "This game has not started yet."
- Editing someone else's tile: "Only the person who wrote it can change it."

Thread ceiling is 6 [ruled Steve 2026-08-23, lib/board/rules.ts:74]. Live play needs at least 4 threads and every thread must resolve [ruled 2026-08-24, guide §10.3]. That 4 is also a live code constant, `lib/board/rules.ts:66`, where it carries no ruling of its own and appears to be inherited from the retired 2024 server [unratified: lib/board/rules.ts:66]. Read the design ruling as authoritative and the constant as its implementation. The ceiling opens above 6 at level 5.

## 5. Ending a thread

A thread ends when **both** players put down the **same** token on the same tile. Not when one concedes, and not on a timer. If they put down different tokens, nothing is settled and the thread stays open, which is the correct outcome: the two of you do not yet agree about what you disagree about [unratified: app/how-to-play/page.tsx].

Two tokens are placeable [ruled Steve 2026-08-23, lib/board/rules.ts:45]:

- 👍 The point was taken. The tile actually moved the other player.
- 👀 Now both of you can see why you disagree. Placed on the tile that captures the source of the disagreement.

The shipped on-screen labels are "Agree to agree" for 👍 and "Agree to disagree" for 👀 [unratified: components/board/token-glyph.tsx:29-40, inherited verbatim from the retired Nuxt client].

Three further tokens have art and labels in the repo and cannot be placed by anything: 🔍 disagree on a fact, ⚖️ disagree on priorities, 🍷 disagree on personal taste [unratified: lib/board/rules.ts:53]. They are deferred behind progression, landing at level 5 [ruled Steve 2026-08-31]. Levels 1 to 4 are a two-token game.

Levels 1 to 4 ship with only 👍 and 👀; the vocabulary does not widen until level 5, which closes `GAP: BRAIN-T260425-33` [ruled Steve 2026-08-31].

## 6. Asking the other player for something

Some moves need both players. One sends the ask, the other accepts or declines, and nothing changes on the board until they answer [unratified: app/how-to-play/page.tsx, lib/board/rules.ts proposal helpers]. The asks:

- Move a reason to a place where it fits better (relocation).
- Pin down a word so the rest of the game uses it the same way (definition). The term is at most 60 characters [unratified: lib/board/rules.ts:28]. A pinned definition binds both players for the rest of the game.
- Say the other side back to them and ask whether you have it right (a reading, at most 200 characters, explicitly marked PROVISIONAL in code, nobody ruled it [unratified: lib/board/rules.ts:25]).
- Write a reason for their side that you think they missed (steel man).
- Hand a reading back, if their version of your side is wrong.
- Propose new wording for the topic itself.

`GAP: BRAIN-T260815-27, still open: how does a player ask for clarification? The definition ask and the reading ask both exist in the event log, and neither has been ruled to be the clarification move a player reaches for.`

## 7. The four rule cards

Every player holds the same four cards for the whole game. Throwing one says a reason broke that rule. **The consequence is always that the reason gets rewritten, never that anybody loses anything** [unratified: app/how-to-play/page.tsx]. Cards are named for the good move, never for the fallacy.

The first-release deck [unratified: lib/board/setup.ts:170, guarded against drift by `coachCardsMatchDeck()` in lib/coach/cards.ts]:

| Card | Id | What the player is told |
|---|---|---|
| 🙅 "You" is Taboo | `you_is_taboo` | This talks about the other player rather than the question. |
| 🎯 Stick to the Thread's Root | `stick_to_root` | This is a different argument from the one this thread is about. |
| 📏 No Exaggeration | `no_exaggeration` | This claims more than it can carry. |
| 💬 Help Me Understand | `help_me_understand` | The other side cannot answer this without guessing what you meant. |

Addressing the other player as "you" about their argument is fine. Characterising the person is not [unratified: lib/coach/cards.ts]. Two paired examples, one from each side of the same question, both fouls:

- "But you only think tipping should stay because you have never waited tables."
- "But you only want tipping abolished because you resent being asked to tip."

Paired examples of a claim bigger than it can carry, again one per side:

- "Every restaurant in the country would close if base wages went up."
- "Nobody who works for tips can ever plan a month ahead."

**No Exaggeration has a word list.** One list serves both the card and the Gym's self-check, so the two can never disagree in front of a player [ruled BRAIN-T260823-42, lib/board/language.ts]. Three groups: quantifiers (all, always, every, everyone, never, nobody, none, without exception, and others), extent (100%, absolutely, completely, entirely, literally, totally, zero, and others), certainty (clearly, guaranteed, inevitable, obviously, proves, undeniable, and others). 50 phrases in total [unratified: lib/board/language.ts, counted from `ABSOLUTE_PHRASES`: 18 quantifier, 14 extent, 18 certainty]. "Only" is deliberately excluded because it is almost always innocent. Catastrophe verbs (destroy, ruin, devastate) are deliberately excluded because that half of the card is about what a sentence predicts, not which words it uses, so the coach handles it. **A hit is a place to look, never a verdict.** Nothing blocks a tile because of one.

The list is politically inert by construction: quantifiers and certainty markers are reachable by any side of any question. A word that only one side's arguments tend to use does not belong in it.

Designed, unbuilt: the graded steps inside a card (🎯 has three, 📏 has three, 💬 has two plus a step 0 that is board law) and the other seven cards of the eventual eleven [unratified: guide §2.4, §7].

## 8. The AI referee

The coach is the referee, and it is an Anthropic model call. Model `claude-haiku-4-5-20251001`, prompt version `brain-2026-08-24.5`, schema `coach-v1` [unratified: lib/coach/evaluate.ts:62-64]. 12-second timeout, 900 max output tokens [unratified: lib/coach/evaluate.ts:68,72].

Rules of engagement, all true today in the code:

- **It runs after the tile is already in the log, never before.** The coach is an offer, not a gate [ruled Steve 2026-08-23, lib/coach/run.ts:19].
- Off unless the player turned it on in Settings. A game with it off is a complete game.
- Only the player who wrote the tile sees it. The opponent never does.
- **At most one card is ever named**, and the model never names it: the model reports findings and code picks the card [unratified: lib/coach/checks.ts, `cardFor`].
- **Silence is the normal answer.** The system prompt says most reasons find nothing and instructs the model not to reach.
- Feedback is one or two sentences, addressed as "you", naming what the words do and never what the player believes.
- "You are a referee on form, never on side. Treat both sides of any question as equally entitled to be argued well" [unratified: lib/coach/evaluate.ts system prompt].
- House style bans em and en dashes and the code strips them.
- If the model offers a rewrite, the rewrite must argue the same side just as strongly and fit within 100 characters, or it is dropped.

What it judges: four tasks per reason [unratified: lib/coach/checks.ts, lib/coach/evaluate.ts]. Structure (does this support, rebut, or fail to bear on its root), reasoning (nine checks), root (is this about a different question), clarity (can the other side answer this at all).

The nine checks and where each one lands:

| Check | Card surfaced |
|---|---|
| `personal_attack` | 🙅 "You" is Taboo |
| `straw_man` | 🎯 Stick to the Thread's Root |
| `whataboutism_red_herring` | 🎯 Stick to the Thread's Root |
| `overgeneralization` | 📏 No Exaggeration |
| `exaggeration` | 📏 No Exaggeration |
| `false_causation` | logged, never shown: no card in the deck fits |
| `not_a_statement` | logged, never shown |
| `appeal_to_authority` | logged, never shown |
| `anecdotal_data` | logged, never shown |

Precedence when two findings could each name a card, since only one is ever cited: the person first, then what the reason is about, then how strongly it is put, then whether it can be answered at all [unratified: lib/coach/checks.ts `CARD_PRECEDENCE`].

Measured before the model was pinned: Haiku 4.5 named the right card on 6 of 8 broken reasons and stayed silent on all 4 clean ones, median 2928 ms. Sonnet 5 got 8 of 8 at 6372 ms. Haiku was chosen [ruled BIZ-T260823-78].

Designed, unbuilt: the coach reading your draft before you post it and naming the card an opponent could throw, without ever rewriting your tile, Gym only, and only for cards you have already earned [ruled BIZ-T260824-24, guide §2.2]. The default for draft review mirrors the coach's own on/off setting [vibecoded].

## 9. How the game ends

Two ways, and both are agreements [unratified: lib/board/rules.ts, app/how-to-play/page.tsx]:

1. **Every thread resolved**, once there are at least 4 of them (`threadsWinReached`).
2. **A rewritten topic both sides could sign** (`topicAgreementEndsGame`). In live play this always ends the game; in the Gym it ends the game only inside a level or boss game.

The board stays readable afterwards, with every thread and the token it landed on.

`GAP: BRAIN-T260823-10, still open: MIN_THREADS_TO_END is 4, carried forward from the deployed 2024 server and never ratified. Is 4 the right minimum for live play, and does it become a per-game value so a two-thread Gym level can be won?`

Designed, unbuilt: the Certificate of Agreeable Disagreement, filled in with the topic, the counts of each token, the common ground found, and what each player now appreciates about the other's view, meant to be photographed [unratified: GAME_MECHANICS.md]. Nothing in the rebuild produces one.

Also designed, unbuilt: the entire progression layer. Points, badges, certificates, streaks, and profile stats exist only in the retired backend. `THROW_POINTS = 10` [ruled BIZ-T260823-65] and the four award events `card_granted`, `certificate_granted`, `badge_granted`, `points_adjusted` [ruled BIZ-T260824-08] are named and appear nowhere in the rebuild's code. Profile stats, when they exist, are personal and non-comparative only: games played, topics debated, threads resolved, cards landed (never "snitch catches"), tiles placed, current and longest streak [unratified: guide §8].

## 10. The Gym, levels 1 to 4

The Gym is single-player practice against a scripted opponent whose lines are fixed text, not a model. One cooked game per level; the cooked game is the boss game.

**You cannot fail a Gym level** [ruled BIZ-T260823-67, guide §2.10]. There is no failure state anywhere in levels 1 to 4: no move budget, no timer, no wrong-answer counter, no retry loop, no way to be sent back to the start.

`GAP: BRAIN-T260815-21, still open: what does failing a level cost the player? The Gym guide answers this by ruling that failing is impossible in levels 1 to 4, which is a design decision, not an answer for level 5 and up.`

| Level | Teaches | Boss | Topic | Threads | Points scope | Fast-forward |
|---|---|---|---|---|---|---|
| 1 Onboarding | 🙅 "You" is Taboo | 🧑🏻‍💼 Bashful Bob | Should a hot dog be called a sandwich? | 2 | `none` | disabled |
| 2 Ground rules | 🎯 Stick to the Thread's Root | 🧑🏿‍🔧 Rambling Rosa | Should we stop changing the clocks twice a year? | 4 | `personal` | disabled |
| 3 Claim size | 📏 No Exaggeration | 🧑🏼‍🔬 Braggy Brenda | Should tipping be replaced by higher base wages? | 4 | `personal` | enabled, grants card, no certificate |
| 4 Clarity | 💬 Help Me Understand | 🧑🏾‍🍳 Sloppy Salma | Should AI-generated content be clearly labeled? | 4 | `personal` | enabled |

This table is the normative home for the four levels, including the points scope and fast-forward columns; `roadmap.md` references it rather than restating it. Every value in it is [ruled BIZ-T260822-07 guide §1, §1.1, §3 to §6, `status: active`; the level 3 boss is Braggy Brenda per BIZ-T260823-70, replacing an earlier Braggy Bogdan]. The four card ids are also live in this repo at `lib/coach/cards.ts:41, 49, 57, 64` [unratified], and the level select page hardcodes the same four boss slugs [unratified].

**A boss commits exactly the violations its level teaches, and nothing else** [ruled guide §2.1]. Tiles are suggested rather than free: two suggestions plus write your own, and at level 3 the baited root suggestions are mandatory, because the level needs the player to overstate something before it can ask them to fix it [ruled guide §2.8]. Level 3's suggestion pairs ship in code: each thread root is offered both a baited wording and a safe one saying the same thing [unratified: lib/gym/root-suggestions.ts].

What each level asks of the player, in one sentence with no game vocabulary [unratified: 2026-08-22_skill-ladder-levels-1-4.md, status draft, needs Steve's ear on the wording]:

- **1.** I can disagree with what you said without saying anything about you. And: agreement is something you ask for, not something you announce.
- **2.** That is true, and it is not an answer to what I asked. Here is the question it does answer.
- **3.** That is bigger than what you can back up. Say the version you would actually defend.
- **4.** Here is what I heard you say. Is that what you meant?

Level 3 is the only level that asks the player to fix themselves rather than catch the boss. Level 4's skill is a substitution, not an addition: you never show someone their writing was unclear by saying "that was unclear."

Level-specific mechanics [ruled guide §3 to §6]:

- **Level 1**: about 9 tiles, 8 to 10 minutes, no points at all. Bob commits exactly one violation, then apologises for assuming.
- **Level 2**: about 16 tiles, 15 minutes. Threads are health, energy, evenings, coordination. Introduces removing, withdrawing or adding, and relocating a tile by grab handle.
- **Level 3**: about 18 tiles, 15 to 18 minutes. The self-check runs on the word list in section 7 with no model call [ruled BIZ-T260823-74]. The L3.9 dare that used to sit here, docking 10 points as "oversized claim" and refunding 10 as "brought back to size" for a net zero, is removed from the game [ruled Steve 2026-08-31, superseding BIZ-T260824-09, which had only re-scoped it]. Nothing in the first release moves points backwards.
- **Level 4**: about 19 tiles, 15 to 18 minutes. The moderator refuses a tile written as a question and hands the text back for editing, with no model call, on a trailing question mark plus interrogative openers [ruled BIZ-T260824-14]. A definition asked for here is pinned at the board edge and binds both players. **Acceptance is the score; nothing ever judges the quality of the player's reading.**

**How a level is passed:** by reaching the end of its beat script. Completion grants the level's rule card and its certificate; using fast-forward (available at levels 3 and 4 only) grants the card but not the certificate [unratified: guide §1.1 `fastForward.grantsCard: true, grantsCertificate: false`].

`GAP: can a completed level be replayed, and if so does it award anything the second time? "No failure state" removes the need for a retry loop but does not rule on replay.`

`GAP: does finishing a level unlock the next one? Nothing confirms an unlock rule, so app/gym/page.tsx renders all four levels open at once.`

True today in the code: `app/gym/page.tsx` is the level-select screen and nothing more. Every "Start" button is inert on purpose. There is no scripted opponent, so none of section 10's mechanics run.

First-release totals as designed: 4 of 11 rule cards, 4 of 9 bosses, 15 of 26 badges, 4 certificates [unratified: guide §7]. Confirmed at level 5: the Steel Man card and communal points [ruled Steve 2026-08-31]. Deferred past level 4, exact level open: importance ranking, generosity tokens, and the revise-topic win condition inside the Gym [ruled Steve 2026-08-31]. The last of these had only ever carried "level 5" as shorthand for "not in the first four", never a considered placement.

## 11. Political neutrality

Non-negotiable, and it applies to the rules as much as to the game content. Every politically-perceptible example needs an equally vivid opposite-side counterpart, or an explicit acknowledgment that it is unbalanced. The paired examples in section 7 exist for this reason.

The 17-topic library is balanced in aggregate, not pair by pair: the standing obligation is that the shelf as a whole stays roughly even, reviewed quarterly [ruled BIZ-T260426-39, lib/board/setup.ts:55]. It carries topics that cut both ways, including student loan forgiveness, the death penalty, union protections, civilian access to military-grade weapons, a soda tax, eliminating the SAT, trans athletes in high school sports, asylum, deportation, and the Electoral College.

Acknowledgment of imbalance, stated rather than hidden: the boss roster is US-centric for the first release and has no Indigenous, Native American, or First Nations character. That is a deferral, not an oversight [ruled guide §2.1].

## 12. What is decided, what is built, what is neither

True today in the code, and player-visible: seats and sides, the three-line signing ritual, the topic library, the 100-character tile, the 6-thread ceiling, the two resolution tokens, both-must-match resolution, the six proposal asks, the four rule cards, the coach as an opt-in post-placement offer, and both endgames.

Decided and unbuilt: every timer, the scripted bosses and all Gym beats, the graded steps inside cards, points, badges, certificates, streaks, profile stats, and the coach's pre-post draft review.

Neither decided nor built, and therefore listed as a GAP above: turn order, timer consequences, the clarification move, the minimum thread count, level unlocks, level replay, the two opening tiles, and the emoji vocabulary above level 1.

## 13. Contradictions a builder will hit

1. `MIN_THREADS_TO_END` is 4 in code, and Gym level 1 has 2 threads, so as written level 1 cannot be won. The fix adopted on paper is a per-game minimum [ruled BIZ-T260824-11] and it is not in the code.
2. `GAME_MECHANICS.md` gives per-game token supplies (👍 x4, 👀 x4, 💵 x4). Brain has no token economy [ruled Steve 2026-08-28] and the code treats 👍 and 👀 as unlimited.
3. `GAME_MECHANICS.md` has four agreement items; the guide and the code ship three. The four-item version is superseded.
4. `app/how-to-play/page.tsx` tells the player the coach "can tell you a reason of yours looks like one of them before you place it". `lib/coach/run.ts` runs the coach only after the tile is in the log. The copy describes the unbuilt draft review.
5. `components/info/paths-to-winning-card.tsx` renders five resolution tokens; only two are placeable.
6. `components/board/ways-to-win-card.tsx` has four corners for four threads while `MAX_THREADS` is 6. Its own in-code comment flags this.
7. The shipped label for 👍 is "Agree to agree", which is also the print game's name for the topic-revision endgame. Two different things share one phrase.
8. `docs/reference/materials/spec/2026-08-22_ai-feedback-vocabularies.md` describes the retired `agents.py` pipeline, including its nine checks under different wire spellings. The rebuild does not inherit it; `lib/coach/checks.ts` is the live version and it moves `whataboutism_red_herring` into the player-visible set and `false_causation` out of it.
9. The guide implied an `overgeneralization` word list already shipped. It never did; `lib/board/language.ts` was written from scratch [ruled BRAIN-T260823-42].
10. Registry row BRAIN-T260815-09 says No Exaggeration is level 4. It is level 3 and the row is wrong; the Gym guide is newer and wins.
11. `2026-08-04_level-build-table.md` is superseded for levels 1 to 4, including its tile-count row and its mislabelling of Sloppy Salma as level 3 [ruled guide §9].
12. The join code is 5 characters (`JOIN_CODE_LENGTH = 5`, `lib/games/joinCode.ts:17`, from a 32-character ambiguity-free alphabet), but `app/not-found.tsx` tells the player it is six, twice, at `:7` and `:41`. Shipped copy contradicts shipped behaviour: a player who counts the characters someone read aloud to them is told the wrong number. The code is correct and the copy is the bug [unratified].
13. Three of the four level topics in section 10's table are not the topics the Gym asks. The table says "Should we stop changing the clocks twice a year?", "Should tipping be replaced by higher base wages?", and "Should AI-generated content be clearly labeled?"; `app/gym/page.tsx:53, 63, 73` ships "Should clock-change twice a year stop?", "Should tipping be replaced by higher wages?", and "Should AI-generated content be labeled?". Level 1's hot-dog topic matches exactly. The differences are small but not cosmetic: "higher wages" and "higher base wages" are different claims to argue about, and dropping "clearly" from the labelling topic removes the word the disagreement turns on. The table is [ruled BIZ-T260822-07] and the code is not, so the code is what needs changing, but `app/gym/page.tsx:14` claims its content is already ratified against the guide.
14. "Cards landed" is listed in section 9 as a profile stat, and `roadmap.md` section 3 counts six stats with Cards Landed among them. `app/account/page.tsx:364-392` renders five `Counter`s and a `StreakCounters`: Games played, Games ended, Topics debated, Threads resolved, Tiles placed, current and longest streak. No card statistic appears under any name, and "Games ended" appears in no design source. The progression layer these stats belong to is unbuilt, so this is a design list and a shipped list drifting apart rather than a bug [unratified].
