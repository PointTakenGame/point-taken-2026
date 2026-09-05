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

**Timers.** There are no turn timers in this edition [ruled Steve 2026-09-03]; the earlier 30-second speaker and 45-second summarize entry here was recorded in error and belongs to the Heart edition, not Brain. The print game's one-minute chat timer, flipped by hand when writing is not enough, is a Heart-edition mechanic [unratified: GAME_MECHANICS.md].

**What a turn is.** Write one reason, up to 100 characters, and hang it off a tile already on the board. A reason hung straight off the topic starts a new thread.

Refusals the player sees today [unratified: lib/board/rules.ts, `canPlaceTile`]:

- Empty text: "A reason needs some words in it."
- A seventh thread: "A game holds at most 6 threads. Add this to one of them instead."
- A resolved thread: "That thread is already resolved."
- Board closed: "This game is over." or "This game has not started yet."
- Editing someone else's tile: "Only the person who wrote it can change it."
- A reply before its game's root stage is filled: "One more reason still has to hang off the topic before anything hangs off another reason." (or the plural count, if more than one root is still missing) [unratified: lib/board/rules.ts:237-244].

**Root stage.** No reply may hang off another tile until every root slot for that game is filled: 4 in live play and in Gym levels 2 and up, 1 in Gym level 1 [unratified: lib/board/rules.ts:67-93, lib/gym/levels/onboarding.ts:61]. A fresh root hung straight off the topic is always allowed; anything hung off another tile waits for the stage to close.

Thread ceiling is 6 [ruled Steve 2026-08-23, lib/board/rules.ts:74]. There is no minimum: every live thread must resolve, however many there are [ruled Steve 2026-09-01, BRAIN-T260901-06, lib/board/rules.ts:103-105]. The earlier entry here citing a live-play floor of at least 4 threads is superseded by that ruling, reconfirmed 2026-09-03: "it is all threads, not four threads." The ceiling opens above 6 at level 5.

## 5. Ending a thread

A thread ends when **both** players put down the **same** token on the same tile. Not when one concedes, and not on a timer. If they put down different tokens, nothing is settled and the thread stays open, which is the correct outcome: the two of you do not yet agree about what you disagree about [unratified: app/how-to-play/page.tsx].

Two tokens are placeable [ruled Steve 2026-08-23, lib/board/rules.ts:45]:

- 👍 The point was taken. The tile actually moved the other player.
- 👀 Now both of you can see why you disagree. Placed on the tile that captures the source of the disagreement.

The shipped on-screen labels are "Agree to agree" for 👍 and "Agree to disagree" for 👀 [unratified: components/board/token-glyph.tsx:29-40, inherited verbatim from the retired Nuxt client]. The labels are always on, printed as a caption under each token rather than shown only on hover [unratified: components/board/resolution-picker.tsx]. While a thread waits on the second token, the live board's badge reads "Your move" for the player who still has to place one and "Waiting on them" for the player who already has [unratified: components/board/live-board.tsx:2620].

Three further tokens have art and labels in the repo and cannot be placed by anything: 🔍 disagree on a fact, ⚖️ disagree on priorities, 🍷 disagree on personal taste [unratified: lib/board/rules.ts:53]. They are deferred behind progression. Treat the game as a two-token game.

`GAP: BRAIN-T260425-33, still open: does level 1 ship with only 👍 and 👀, making it a two-emoji game above level 1 as well, or does the vocabulary widen and when?`

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

Throwing a card is two clicks, always in this order: arm the card, then click the reason it answers. There is no drag [unratified: components/board/rule-card-tray.tsx:11].

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

1. **Every thread resolved**, with no minimum count (`threadsWinReached`) [ruled Steve 2026-09-01, BRAIN-T260901-06].
2. **A rewritten topic both sides could sign** (`topicAgreementEndsGame`). In live play this always ends the game; in the Gym it ends the game only inside a level or boss game.

The board stays readable afterwards, with every thread and the token it landed on.

The Certificate of Agreeable Disagreement is built for the Gym: `components/gym/certificate.tsx` renders one at the end of a level, reading the game's own award events for the topic, the token counts, the points, and the boss reformed [unratified: components/gym/certificate.tsx]. It renders on screen only; exporting one as an image so it can be photographed did not ship [BRAIN-T260904-11]. Whether live play outside the Gym ever produces one is undecided.

The progression layer under the certificate is built, not designed-unbuilt. `THROW_POINTS = 10` [ruled BIZ-T260823-65] is live and moves real points in Gym levels 3 and 4 [unratified: lib/gym/levels/claim-size.ts, lib/gym/levels/ground-rules.ts]. The award events are `level_cleared`, `badge_granted`, `points_changed`, and `certificate_granted` [unratified: supabase/migrations/0014_awards.sql, lib/events/types.ts:342-345,392-395], not the earlier-named `card_granted` and `points_adjusted`. Badge display names remain placeholders pending the badge taxonomy (still open; see CLAUDE.md). Profile stats are covered in section 13 item 14, which reflects what the profile shows today rather than the retired backend's list.

## 10. The Gym, levels 1 to 4

The Gym is single-player practice against a scripted opponent whose lines are fixed text, not a model. One cooked game per level; the cooked game is the boss game.

**You cannot fail a Gym level** [ruled BIZ-T260823-67, guide §2.10]. There is no failure state anywhere in levels 1 to 4: no move budget, no timer, no wrong-answer counter, no retry loop, no way to be sent back to the start.

`GAP: BRAIN-T260815-21, still open: what does failing a level cost the player? The Gym guide answers this by ruling that failing is impossible in levels 1 to 4, which is a design decision, not an answer for level 5 and up.`

| Level | Teaches | Boss | Topic | Threads | Points scope | Fast-forward |
|---|---|---|---|---|---|---|
| 1 Onboarding | 🙅 "You" is Taboo | 🧑🏻‍💼 Bashful Bob | Should a hot dog be called a sandwich? | 2 | `none` | disabled |
| 2 Ground rules | 🎯 Stick to the Thread's Root | 🧑🏿‍🔧 Rambling Rosa | Should we stop changing the clocks twice a year? | 4 | `personal` | disabled |
| 3 Claim size | 📏 No Exaggeration | 🧑🏼‍🔬 Braggy Bogdan | Should tipping be replaced by higher base wages? | 4 | `personal` | enabled, grants card, no certificate |
| 4 Clarity | 💬 Help Me Understand | 🧑🏾‍🍳 Sloppy Salma | Should AI-generated content be clearly labeled? | 4 | `personal` | enabled |

This table is the normative home for the four levels, including the points scope and fast-forward columns; `roadmap.md` references it rather than restating it. Every value in it is [ruled BIZ-T260822-07 guide §1, §1.1, §3 to §6, `status: active`]; the level 3 boss is Braggy Bogdan, confirmed live in code (`bossId: "braggy-bogdan"`, `bossName: "Braggy Bogdan"`) [unratified: lib/gym/levels/claim-size.ts:51-52]. This reverses the 2026-08-23 rename to Braggy Brenda (`BIZ-T260823-70`): the level 3 script Nathan wrote and the build shipped from both name the boss Bogdan, confirmed done at `BRAIN-T260903-36` and in commits `cf262a9` and `050bad6`. Any source still naming Brenda at level 3 predates this. The four card ids are also live in this repo at `lib/coach/cards.ts:41, 49, 57, 64` [unratified], and each level script carries its own boss slug [unratified: lib/gym/levels/*.ts].

**A boss commits exactly the violations its level teaches, and nothing else** [ruled guide §2.1]. Tiles are suggested rather than free: two suggestions plus write your own, and at level 3 the baited root suggestions are mandatory, because the level needs the player to overstate something before it can ask them to fix it [ruled guide §2.8]. Level 3's suggestion pairs ship in code: each thread root is offered both a baited wording and a safe one saying the same thing [unratified: lib/gym/root-suggestions.ts].

What each level asks of the player, in one sentence with no game vocabulary [unratified: 2026-08-22_skill-ladder-levels-1-4.md, status draft, needs Steve's ear on the wording]:

- **1.** I can disagree with what you said without saying anything about you. And: agreement is something you ask for, not something you announce.
- **2.** That is true, and it is not an answer to what I asked. Here is the question it does answer.
- **3.** That is bigger than what you can back up. Say the version you would actually defend.
- **4.** Here is what I heard you say. Is that what you meant?

Level 3 is the only level that asks the player to fix themselves rather than catch the boss. Level 4's skill is a substitution, not an addition: you never show someone their writing was unclear by saying "that was unclear."

Level-specific mechanics [ruled guide §3 to §6]:

- **Level 1**: about 9 tiles, 8 to 10 minutes, no points at all. Bob commits exactly one violation, then apologises for assuming. Root stage is 1, not 4, so the level opens on a single thread [unratified: lib/gym/levels/onboarding.ts:61]. The beat order: the player places the game's one root, Bob replies under it, the player replies to Bob, Bob then opens a second thread with his own reason (allowed once the one root slot is filled), the player answers it, Bob places 👍 on the first thread unprompted and the player matches it to close that thread, Bob commits his one violation in the second thread, the player throws 🙅 "You" is Taboo at it, Bob revises, and the player closes the second thread with 👀 to win [unratified: lib/gym/levels/onboarding.ts, full beat list].
- **Level 2**: about 16 tiles, 15 minutes. Threads are health, energy, evenings, coordination. Introduces removing, withdrawing or adding, and relocating a tile by grab handle.
- **Level 3**: about 18 tiles, 15 to 18 minutes. The self-check runs on the word list in section 7 with no model call [ruled BIZ-T260823-74]. This is the only place in the first release where points move backwards: 10 docked as "oversized claim" and
  10 refunded as "brought back to size", net zero, once per Gym run [ruled BIZ-T260824-09].
- **Level 4**: about 19 tiles, 15 to 18 minutes. The moderator refuses a tile written as a question and hands the text back for editing, with no model call, on a trailing question mark plus interrogative openers [ruled BIZ-T260824-14]. A definition asked for here is pinned at the board edge and binds both players. **Acceptance is the score; nothing ever judges the quality of the player's reading.**

**How a level is passed:** by reaching the end of its beat script. Completion grants the level's rule card and its certificate; using fast-forward (available at levels 3 and 4 only) grants the card but not the certificate [unratified: guide §1.1 `fastForward.grantsCard: true, grantsCertificate: false`].

`GAP: can a completed level be replayed, and if so does it award anything the second time? "No failure state" removes the need for a retry loop but does not rule on replay.`

Finishing a level does not unlock the next one, because there is no lock: all four scripted levels are open regardless of cleared state [ruled Steve 2026-09-03, components/account/progression/ladder-strip.tsx:22-23].

True today in the code: all four Gym levels are fully scripted and playable end to end against their boss [unratified: lib/gym/levels/onboarding.ts and its three siblings; played and cleared in full by `docs/handoffs/2026-09-04_overnight-result.md`, tid BRAIN-T260904-20]. `app/gym/page.tsx` is no longer a level-select page; it redirects to `/#ladder`, since the profile's ladder strip (`components/account/progression/ladder-strip.tsx`) is the level select now [ruled Steve 2026-09-04, cited in app/gym/page.tsx's own doc comment].

Opening a level is two cards, not one screen: a boss-intro card, then a rule-card-intro card that also carries the signing lines and the start button [ruled BRAIN-T260904-21, components/gym/level-intro.tsx]. A rule card the player has not yet earned shows as a question mark rather than its name or icon [unratified: components/gym/level-intro.tsx]. The button reads "Start the game" and, in one act, signs the agreement if it is not already signed and starts the game [unratified: components/gym/level-intro.tsx, `go()`].

First-release totals as designed: 4 of 11 rule cards, 4 of 8 bosses, 15 of 26 badges, 4 certificates [unratified: guide §7]. Deferred to level 5 and later: importance ranking, the revise-topic win condition inside the Gym, the Steel Man card, communal points, and generosity tokens [unratified: guide §7].

## 11. Political neutrality

Non-negotiable, and it applies to the rules as much as to the game content. Every politically-perceptible example needs an equally vivid opposite-side counterpart, or an explicit acknowledgment that it is unbalanced. The paired examples in section 7 exist for this reason.

The 17-topic library is balanced in aggregate, not pair by pair: the standing obligation is that the shelf as a whole stays roughly even, reviewed quarterly [ruled BIZ-T260426-39, lib/board/setup.ts:55]. It carries topics that cut both ways, including student loan forgiveness, the death penalty, union protections, civilian access to military-grade weapons, a soda tax, eliminating the SAT, trans athletes in high school sports, asylum, deportation, and the Electoral College.

Acknowledgment of imbalance, stated rather than hidden: the boss roster is US-centric for the first release and has no Indigenous, Native American, or First Nations character. That is a deferral, not an oversight [ruled guide §2.1].

## 12. What is decided, what is built, what is neither

True today in the code, and player-visible: seats and sides, the three-line signing ritual, the topic library, the 100-character tile, the root stage, the 6-thread ceiling, the two resolution tokens, both-must-match resolution, the click-then-click card throw, the six proposal asks, the four rule cards, the coach as an opt-in post-placement offer, both endgames, all four scripted Gym bosses and levels, the level's award events and points, and the Gym's on-screen certificate.

Decided and unbuilt: the graded steps inside cards, streaks, badge display names (the taxonomy itself is still open), a certificate a player can export or that live play produces, and the coach's pre-post draft review. Turn timers are removed from this list: they are out of scope for this edition by ruling [ruled Steve 2026-09-03, BRAIN-T260903-01] and belong to the Heart edition, not Brain.

Neither decided nor built, and therefore listed as a GAP above: turn order, the clarification move, level replay, the two opening tiles, and the emoji vocabulary above level 1. Level unlocks are no longer on this list: there is no lock, ruled Steve 2026-09-03 (see section 10).

## 13. Contradictions a builder will hit

1. Resolved: level 1's win used to be unreachable because `MIN_THREADS_TO_END` was 4 in code against a 2-thread Gym level. That constant is gone; `threadsWinReached()` now needs only that every live thread resolve, whatever their number [ruled Steve 2026-09-01, BRAIN-T260901-06]. Kept here as a tombstone since this section's numbering is a builder-facing index and earlier entries may cite it by number.
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
12. Resolved: the join code is 5 characters (`JOIN_CODE_LENGTH = 5`, `lib/games/joinCode.ts:17`), and `app/not-found.tsx` now tells the player it is five as well [unratified: app/not-found.tsx:42]. Kept here as a tombstone since this section's numbering is a builder-facing index.
13. Resolved: `app/gym/page.tsx` no longer ships any topic string; it is a redirect to `/#ladder` (see section 10). Each level's topic now lives in its own script and matches section 10's table exactly: "Should we stop changing the clocks twice a year?" (`lib/gym/levels/ground-rules.ts`), "Should tipping be replaced by higher base wages?" (`lib/gym/levels/claim-size.ts`), "Should AI-generated content be clearly labeled?" (`lib/gym/levels/clarity.ts`) [unratified].
14. Section 9's profile-stats list and `roadmap.md` section 3 describe a stat block that no longer exists as such. The profile hero shows three figures: Games played, Cooperation score, and Points [unratified: components/account/hero.tsx:195,201,208]. A player's match history shows a per-game outcome label instead of aggregate stats: "Threads resolved", "Topic revised", "Unfinished", "Ran out of time" [unratified: components/account/match-list.tsx:32-35]. No "Cards landed" or "Games ended" stat appears anywhere in the current profile. Whether a fuller stats page still exists elsewhere was not checked.
