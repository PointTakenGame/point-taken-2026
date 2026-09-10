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
  - point-taken-brain/web/point-taken-2026/lib/gym/awards.ts
  - point-taken-brain/web/point-taken-2026/app/gym/page.tsx
  - point-taken-brain/web/point-taken-2026/components/board/token-glyph.tsx
  - point-taken-brain/web/point-taken-2026/components/board/live-board.tsx
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

- One **topic tile** at the center, always phrased as a question starting with "Should" [unratified: GAME_MECHANICS.md]. Max 300 characters [unratified: lib/board/setup.ts:198].
- **Reason tiles** hang off the topic or off another tile. A tile is one short sentence, not a question. Max 100 characters, enforced on both client and server [unratified: lib/board/rules.ts:14, comment says it is the limit the printed game uses].
- A **thread** is a chain of tiles rooted in a tile hung directly off the topic.
- Two seats: **Plus** says yes to the topic, **Minus** says no. Exactly 2 players [unratified: lib/board/setup.ts:220]. Seats are fixed for the game.
- Digital tiles are unbounded in number; the print game ships about 6 tiles per side [unratified: GAME_MECHANICS.md].

**The one rule above all others:** a tile must make the root of its thread more or less likely to strengthen or weaken support for the topic [ruled BIZ-T260823-77]. Everything else is a special case of this. Whataboutism needs no detector because it fails this test by construction.

## 3. Setup and sequence of play

True today in the code:

1. A player reaches a room from their own profile, never from the signed-out front door. The
   front door offers exactly four things: the wordmark, the Terms of Use and Privacy Policy
   tick, "Set me up" for a guest account, and Login for an account that already exists
   [ruled Steve 2026-09-08, app/page.tsx]. "Start a new game" and the room-code field live on
   the profile's Live play card [unratified: components/account/hero.tsx, components/rooms/room-entry.tsx],
   because offering them to a visitor with no account was confusing.
2. One player starts a room and gets a 5-character join code [unratified: lib/games/joinCode.ts:18]. The other types it or opens the link. There is no host and no computer opponent.
3. Each player picks a side. The other side is then unavailable ("The other player is already on that side.").
   Nobody types their own display name. Every account is given a generated one, two words by
   default and three when the two-word draw is already taken, and the only way to change it is
   to draw another [ruled Steve 2026-09-05, app/settings/actions.ts:31 `rerollName`]. There is
   no length rule to break and no name error to see. The cycle button sits beside the name on
   the profile, warns once that the current name is not coming back, and then rerolls as often
   as the player likes [ruled Steve 2026-09-07, components/account/name-reroll.tsx].
4. Both players sign the agreement. **Three lines** [ruled BIZ-T260822-04]: Mutual Respect, Honest
   Thinking, Shared Evidence (renamed from Shared Facts by Steve on 2026-09-05; the id stays
   `shared_facts`). The old placeholder slogans ("Play fair," "Stay on the thread," "Pin it down") are
   gone; each line's title is its own family name, paired with the pledge in Steve's own words
   [ruled Steve 2026-09-05, second wording of the day, `lib/board/setup.ts:49-73`]:
   - Mutual Respect: "I'm here to collaborate with my fellow player, not to troll them. I'll be
     kind, generous, and humble. They *might* even change my mind a bit (hey, no promises)."
     (three short paragraphs, "might" italic)
   - Honest Thinking: "Staying in a bubble feels safe, but it makes thinking weak. Strong thinking
     needs a (kind) opponent to hone reasoning. I'll collaborate with mine, and hold each other
     accountable." (three short paragraphs)
   - Shared Evidence: "I'll track down facts collaboratively, and without bias for \"my side.\""

   Pledges are rendered through `PledgeText` (`components/lobby/player-agreement.tsx`): newlines
   are paragraph breaks and single asterisks mark italics. The rule-card popup's family header uses
   the same new name (`components/board/rule-card-popup.tsx`).

   It is a ritual, not a consent form: there is no partial signing, and Rannie's frame draws a fourth
   line ("I'll control my emotions") folded into Mutual Respect rather than shipped on its own
   [unratified: lib/board/setup.ts:36-47].
5. Either player sets the topic, from a 17-entry library or written fresh [unratified: lib/board/setup.ts:93]. Either player can start; nobody waits on a host.
6. Play begins. Tiles go down, threads grow, tokens close threads, cards get thrown.

**The web version requires the opening tiles too** [ruled Nathan 2026-08-29]: the first tile is not free, and the rebutting part of the game does not begin until the opening tiles are down. Plus writes with "Yes, because" and Minus with "No, because" [unratified: GAME_MECHANICS.md].

True today in the code, by a narrower route than the ruling describes. It shipped as the root stage in section 4 rather than as a gate on the board opening, and the count is per game rather than always four: no reply may hang off another tile until every root slot for that game is filled, which is 4 in live play and in Gym levels 2 and up, and 2 in Gym level 1 [ruled Steve 2026-09-05, BRAIN-T260905-32, lib/board/rules.ts:87-96, lib/gym/levels/onboarding.ts:55]. Nathan's ruling said all four, two from each player; level 1's two-root shape is the one narrowing of it, and it was ruled later.

## 4. A turn, and its timing

**Turn order.** Brain is **free-running** [ruled Nathan 2026-08-29]. Both players may write at once, neither waits on the other, and there is no alternation and no notion of whose turn it is. The board shows an indication while a player is part-way through writing a tile, so two people typing at the same time is visible rather than a surprise.

True today in the code: there is no turn order. No field, no check, no notion of whose turn it is anywhere in `lib/board/rules.ts`. Either player may place a tile at any time the board is open, which is the ruling. Designed, unbuilt: nothing broadcasts or renders a "writing now" state between two live players. The thinking and typing indication that exists is the scripted Gym opponent's, driven from the level script rather than from the other seat.

**Timers.** There are no turn timers in this edition [ruled Steve 2026-09-03]; the earlier 30-second speaker and 45-second summarize entry here was recorded in error and belongs to the Heart edition, not Brain. The print game's one-minute chat timer, flipped by hand when writing is not enough, is a Heart-edition mechanic [unratified: GAME_MECHANICS.md].

**What a turn is.** Write one reason, up to 100 characters, and hang it off a tile already on the board. A reason hung straight off the topic starts a new thread.

Refusals the player sees today [unratified: lib/board/rules.ts, `canPlaceTile`]:

- Empty text: "A reason needs some words in it."
- A fifth thread: "A game holds at most 4 threads. Add this to one of them instead."
- A resolved thread: "That thread is already resolved."
- Board closed: "This game is over." or "This game has not started yet."
- Over 100 characters: "A reason is at most 100 characters."
- Editing someone else's tile: "Only the person who wrote it can change it." Removing someone else's: "Only the person who wrote it can remove it."
- A reply before its game's root stage is filled: "One more reason still has to hang off the topic before anything hangs off another reason." (or the plural count, if more than one root is still missing) [unratified: lib/board/rules.ts:256-257].
- A tile written as a question: "That is a question, and the board is for statements. What is the claim behind it?" This is board law rather than a card, it applies to both players, and the moderator enforces it on every tile in every mode, not only in Gym level 4 [unratified: lib/board/rules.ts:205-213].

**Root stage.** No reply may hang off another tile until every root slot for that game is filled: 4 in live play and in Gym levels 2 and up, 2 in Gym level 1, one root from each side [ruled Steve 2026-09-05, BRAIN-T260905-32, lib/board/rules.ts:87-96, lib/gym/levels/onboarding.ts:55]. A fresh root hung straight off the topic is always allowed; anything hung off another tile waits for the stage to close.

Level 1 of the Gym runs two threads, one per side, using only the two bottom diagonals of the centre tile. Level 2 and up in the Gym, and live play, run four threads total, two per side, using all four diagonals of the centre tile [ruled Steve 2026-09-05, BRAIN-T260905-33, lib/board/rules.ts:69]. Six threads belongs only to compact mode, when it ships, not before. There is no minimum thread count and no thread floor at any level: every live thread must resolve, however many there are [ruled Steve 2026-09-01, BRAIN-T260901-06, lib/board/rules.ts:135; reconfirmed final, Steve 2026-09-07]. Earlier entries here citing a live-play floor of at least four threads, or any minimum at all, are superseded.

## 5. Ending a thread

A thread ends when **both** players put down the **same** token on the same tile. Not when one concedes, and not on a timer. If they put down different tokens, nothing is settled and the thread stays open, which is the correct outcome: the two of you do not yet agree about what you disagree about [unratified: lib/board/rules.ts, `agreedToken`].

**How a token is placed.** Hovering a thread's root tile flanks it with the two ways to close that thread: Agree to agree on the left, Agree to disagree on the right, in the same two places every time whether or not both are on offer. One click places the token. Once your own token is down the pair is replaced by the single move left, "Take it back". There is no picker and no dialog [ruled Steve 2026-09-07, components/board/live-board.tsx, `ThreadTokenChoices`]. The buttons are in the page either way and appear to the keyboard on focus, and they offer only what the rules already allow, so a refusal is a race between two clients rather than a rule the player broke, and it says so in a banner they can dismiss.

Two tokens are placeable [ruled Steve 2026-08-23, lib/board/rules.ts:45]:

- 👍 The point was taken. The tile actually moved the other player.
- 👀 Now both of you can see why you disagree. Placed on the tile that captures the source of the disagreement.

The shipped on-screen labels are "Agree to agree" for 👍 and "Agree to disagree" for 👀 [unratified: components/board/token-glyph.tsx:33,38, inherited verbatim from the retired Nuxt client]. Each label is printed beside its token on the button that places it, never hidden behind a second hover. While a thread waits on the second token, the badge on the board reads "Click to agree" for a player who can close the thread by matching what the other side already put down, "Your move" for a player who still has to answer, and "Waiting on them" for the player who has already moved [unratified: components/board/live-board.tsx:2785].

Three further tokens have art and labels in the repo and cannot be placed by anything: 🔍 disagree on a fact, ⚖️ disagree on priorities, 🍷 disagree on personal taste [unratified: lib/board/rules.ts:53]. They are deferred behind progression. Treat the game as a two-token game.

**Two tokens through level 5, and the vocabulary widens at level 6** [ruled Steve 2026-09-05, BRAIN-T260905-30, closing BRAIN-T260425-33]. 👍 and 👀 are the whole vocabulary everywhere the first release reaches; the three-way split of 👀 into fact, priorities, and taste waits for level 6 and above. Nathan ruled the same two-token game on 2026-08-29 but attached the widening to no level; Steve's later ruling names one.

## 6. Asking the other player for something

Some moves need both players. One sends the ask, the other accepts or declines, and nothing changes on the board until they answer [unratified: lib/board/rules.ts proposal helpers]. The asks:

- Move a reason to a place where it fits better (relocation).
- Pin down a word so the rest of the game uses it the same way (definition). The term is at most 60 characters [unratified: lib/board/rules.ts:28]. A pinned definition binds both players for the rest of the game.
- Say the other side back to them and ask whether you have it right (a reading, at most 200 characters, explicitly marked PROVISIONAL in code, nobody ruled it [unratified: lib/board/rules.ts:25]).
- Write a reason for their side that you think they missed (steel man).
- Hand a reading back, if their version of your side is wrong.
- Propose new wording for the topic itself.

Nathan ruled clarification as a one-sided mark on 2026-08-29: a player flags a tile as wanting clarification and keeps writing, nothing on the board waits for an answer, and the tile's author is notified without being blocked before their next move. Steve disputes the mark itself, in GitHub issue #3 (`PointTakenGame/point-taken-2026#3`): the card exists to hand back a reading, two readings that both fit or one honestly wrong, not to transmit a bare "this was unclear," and a passive mark throws away the interaction that rung 2 of Steel Man is meant to reuse. Do not build the one-sided-mark wording. Both sides agree, and it is safe to build now, that the ask does not block the board: the asking player keeps writing other tiles while it is outstanding.

`GAP: BRAIN-T260815-27, still open pending issue #3: does a clarification ask carry the asker's own reading of the tile, or is it a bare one-sided mark? Also open: where that reading displays, whether the original author can accept it, and whether acceptance is the scoring event.`

## 7. The four rule cards

Every player holds the same four cards for the whole game. Throwing one says a reason broke that rule. **The consequence is always that the reason gets rewritten, never that anybody loses anything** [ruled; a long-standing design position, restated in this repository's own CLAUDE.md under "What the game is"]. Cards are named for the good move, never for the fallacy.

Throwing a card is two clicks, always in this order: arm the card, then click the reason it answers. There is no drag, and none is wanted [ruled Steve 2026-09-05, BRAIN-T260905-35]. While a card is armed, every reason that card cannot legally answer steps back, so a player can read which tiles are legal targets instead of learning it by clicking an illegal one and being told no [ruled Steve 2026-09-07, components/board/live-board.tsx, `canThrowCard`]. The same check decides the step-back and the click, so the two can never disagree.

The first-release deck [unratified: lib/board/setup.ts:208, guarded against drift by `coachCardsMatchDeck()` in lib/coach/cards.ts]:

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

Two ways, and both are agreements [unratified: lib/board/rules.ts:107,135]:

1. **Every thread resolved**, with no minimum count (`threadsWinReached`) [ruled Steve 2026-09-01, BRAIN-T260901-06].
2. **A rewritten topic both sides could sign** (`topicAgreementEndsGame`). In live play this always ends the game; in the Gym it ends the game only inside a level or boss game.

One further way a game stops, and it is not a third win condition: **a player leaves or disconnects** [ruled Nathan 2026-08-29]. The game closes, nobody loses, and nothing is scored. True today in the code: `endIfAbandoned` and `endInFlightGame` append `game_ended` with `win_condition: "abandoned"` (`lib/games/abandon.ts`), and that file is the only writer of that value.

The board stays readable afterwards, with every thread and the token it landed on.

The Certificate of Agreeable Disagreement is built for the Gym: `components/gym/certificate.tsx` renders one at the end of a level, reading the game's own award events for the topic, the token counts, the points, and the boss reformed [unratified: components/gym/certificate.tsx]. It renders on screen only; exporting one as an image so it can be photographed did not ship [BRAIN-T260904-11]. Whether live play outside the Gym ever produces one is undecided.

The progression layer under the certificate is built, not designed-unbuilt. `THROW_POINTS = 10` [ruled BIZ-T260823-65, lib/progression/sample.ts:51] is live and moves real points in Gym levels 2, 3 and 4 [unratified: lib/gym/levels/ground-rules.ts, lib/gym/levels/claim-size.ts, lib/gym/levels/clarity.ts]. Level 1 awards no points at all. The award events are `level_cleared`, `badge_granted`, `points_changed`, and `certificate_granted` [unratified: supabase/migrations/0014_awards.sql, lib/events/types.ts:342-345,392-395], not the earlier-named `card_granted` and `points_adjusted`. Badge display names remain placeholders pending the badge taxonomy (still open; see CLAUDE.md). Profile stats are covered in section 13 item 14, which reflects what the profile shows today rather than the retired backend's list.

## 10. The Gym, levels 1 to 4

The Gym is single-player practice against a scripted opponent whose lines are fixed text, not a model. One cooked game per level; the cooked game is the boss game.

**You cannot fail a Gym level** [ruled BIZ-T260823-67, guide §2.10]. There is no failure state anywhere in levels 1 to 4: no move budget, no timer, no wrong-answer counter, no retry loop, no way to be sent back to the start. That extends to level 5 and above [ruled Nathan 2026-08-29, closing BRAIN-T260815-21], so failing costs a player nothing at any level number, because there is no level of the Gym a player can lose.

| Level | Teaches | Boss | Topic | Threads | Points scope | Fast-forward |
|---|---|---|---|---|---|---|
| 1 Onboarding | 🙅 "You" is Taboo | 🧑🏻‍💼 Bashful Bob | Should a hot dog be called a sandwich? | 2 | `none` | disabled |
| 2 Ground rules | 🎯 Stick to the Thread's Root | 🧑🏽‍🔧 Rambling Rosa | Should we stop changing the clocks twice a year? | 4 | `personal` | disabled |
| 3 Claim size | 📏 No Exaggeration | 🧑🏼‍🔬 Braggy Bogdan | Should tipping be replaced by higher base wages? | 4 | `personal` | enabled, grants card, no certificate |
| 4 Clarity | 💬 Help Me Understand | 🧑🏾‍🍳 Sloppy Salma | Should AI-generated content be clearly labeled? | 4 | `personal` | enabled |

This table is the normative home for the four levels, including the points scope and fast-forward columns; `roadmap.md` references it rather than restating it. Every value in it is [ruled BIZ-T260822-07 guide §1, §1.1, §3 to §6, `status: active`]; the level 3 boss is Braggy Bogdan, confirmed live in code (`bossId: "braggy-bogdan"`, `bossName: "Braggy Bogdan"`) [unratified: lib/gym/levels/claim-size.ts:51-52]. This reverses the 2026-08-23 rename to Braggy Brenda (`BIZ-T260823-70`): the level 3 script Nathan wrote and the build shipped from both name the boss Bogdan, confirmed done at `BRAIN-T260903-36` and in commits `cf262a9` and `050bad6`. Any source still naming Brenda at level 3 predates this. The four card ids are also live in this repo at `lib/coach/cards.ts:61, 72, 83, 93` [unratified], and each level script carries its own boss slug [unratified: lib/gym/levels/*.ts].

The last two columns are the guide's vocabulary, not the code's: no `pointsScope` and no `fastForward` field exists anywhere in `lib/gym/`, and no level offers a way to skip to the end. Read those two columns as designed and unbuilt, and the rest of the row as true today.

**A boss commits exactly the violations its level teaches, and nothing else** [ruled guide §2.1]. Tiles are suggested rather than free: two suggestions plus write your own, and at level 3 the baited root suggestions are mandatory, because the level needs the player to overstate something before it can ask them to fix it [ruled guide §2.8]. Level 3's suggestion pairs ship in code: each thread root is offered both a baited wording and a safe one saying the same thing [unratified: lib/gym/root-suggestions.ts].

What each level asks of the player, in one sentence with no game vocabulary [unratified: 2026-08-22_skill-ladder-levels-1-4.md, status draft, needs Steve's ear on the wording]:

- **1.** I can disagree with what you said without saying anything about you. And: agreement is something you ask for, not something you announce.
- **2.** That is true, and it is not an answer to what I asked. Here is the question it does answer.
- **3.** That is bigger than what you can back up. Say the version you would actually defend.
- **4.** Here is what I heard you say. Is that what you meant?

Level 3 is the only level that asks the player to fix themselves rather than catch the boss. Level 4's skill is a substitution, not an addition: you never show someone their writing was unclear by saying "that was unclear."

Level-specific mechanics [ruled guide §3 to §6]:

- **Level 1**: about 9 tiles, 8 to 10 minutes, no points at all. Bob commits exactly one violation, then apologises for assuming. Root stage is 2, not 4, so the level opens on two roots, one from each side, Bob's first, and nothing may reply to either until both are down [ruled Steve 2026-09-05, BRAIN-T260905-32, lib/gym/levels/onboarding.ts:55]. Nothing is explained ahead of time: each token is explained when it is placed, the card when it is broken. The beat order: Bob places his own root, the player places their own, the player answers Bob's root, and Bob agrees outright rather than arguing back, placing 👍 unprompted; the player mirrors it and that thread, Agree to agree, closes at two tiles. A pause right after the player's first reply teaches the board's own navigation (drag to pan, arrows, zoom, fit-to-screen) `[unratified: lib/gym/levels/onboarding.ts, beat p3b-move-the-board]`: Steve asked for this hint after Bob's violation tile, where the "you" attack is the level's actual tension point, but it is placed one beat earlier instead, while the player's hands are still free to explore rather than fixed on the fight. The Ways to Win card is revealed by the Agree to agree pause instead, the one that follows Bob's unprompted 👍 and precedes the player's own; there is no separate "Ways to win" pause after the player's token, cut on 2026-09-07 at Steve's mark, and the reveal moved back one beat so the panel is already on screen when the player closes the thread and its resolved count ticks [ruled Steve 2026-09-07, superseding BRAIN-T260905-40 on this point, lib/gym/levels/onboarding.ts, beat p4-agree-to-agree]. Bob's first reply on the player's own thread breaks 🙅 "You" is Taboo, which is where the card is taught and thrown; Bob revises the tile, the player answers, Bob replies once more without conceding, and the player proposes 👀, which Bob mirrors only after being asked to confirm. That thread, Agree to disagree, closes at four tiles, and the level ends there with both tokens seen in play [ruled Steve 2026-09-05, BRAIN-T260905-32, lib/gym/levels/onboarding.ts, full beat list].

  Level 1 is also "cooked" and its board chrome starts hidden, both by the level script rather
  than by any general Gym rule [ruled Steve 2026-09-05, BRAIN-T260905-40 and BRAIN-T260905-43].
  `Level.cooked: true` (`lib/gym/script.ts`) restricts placement to whatever the current beat
  points at: the player's tile text is the script's suggestion and cannot be edited, only
  placed, the only slot offered is the one the beat names, nothing can be placed under the
  player's own tiles, and no empty slot is drawn while a card throw is expected. `hiddenSurfaces:
  ["ways-to-win", "card-tray"]` keeps both pieces of chrome off the board until the beats above
  reveal them, since a level 1 player has not earned either idea yet.

  `GAP: whether cooked placement and hidden chrome extend to levels 2 to 4, or are a level-1-only onboarding device, is not ruled anywhere. components/gym/cooked-placement.ts's own doc comment says every other level gets the unrestricted NONE value today, but that is the current build, not a decision that it stays that way.`

  `GAP: the level 1 script's own doc comment says the player's tile text "cannot be edited, only placed" (lib/gym/script.ts, Level.cooked). That is true only at the moment of placement: canEditTile in lib/board/rules.ts has no cooked or level awareness at all, so the same tile can be freely rewritten afterward through the on-tile pencil. Whether the suggested text should stay locked once placed, or whether letting a player edit it away is fine because level 1 never checks what the tile says, is not ruled either way.`
- **Level 2**: about 16 tiles, 15 minutes. Threads are health, energy, evenings, coordination. Introduces removing, withdrawing or adding, and relocating a tile by grab handle.
- **Level 3**: about 18 tiles, 15 to 18 minutes. The self-check runs on the word list in section 7 with no model call [ruled BIZ-T260823-74]. This is the only place in the first release where points move backwards: 10 docked as "oversized claim" and
  10 refunded as "brought back to size", net zero, once per Gym run [ruled BIZ-T260824-09].
- **Level 4**: about 19 tiles, 15 to 18 minutes. The moderator refuses a tile written as a question and hands the text back for editing, with no model call, on a trailing question mark plus interrogative openers [ruled BIZ-T260824-14]. The shipped test is narrower than that ruling and is not level 4's: `isQuestion` matches a trailing question mark and nothing else, and the level's own script says so in as many words, that the question rule "is a rule of the board, not a card. It applies to both of you and the moderator enforces it every time" [unratified: lib/board/rules.ts:205-213, lib/gym/levels/clarity.ts, beat `p1-a-question-is-not-a-move`]. The comment beside the test says letting a rhetorical question with no question mark through is the right side to fail on. A definition asked for here is pinned at the board edge and binds both players. **Acceptance is the score; nothing ever judges the quality of the player's reading.**

**How a level is passed:** by reaching the end of its beat script. Completion grants the level's rule card and its certificate. Fast-forward, which would grant the card but not the certificate at levels 3 and 4, is designed and unbuilt: nothing in the code offers it [unratified: guide §1.1 `fastForward.grantsCard: true, grantsCertificate: false`].

A completed level can be replayed, running the same script, and a replay awards nothing the second time [ruled Nathan 2026-08-29]. The replay half is true today in the code: clicking any level, cleared or not, starts a fresh game against the same script (see the no-lock ruling below). The "awards nothing twice" half is not: `grantLevelAwards` re-fires every beat's points, grants each badge again as a new occurrence, and re-appends `level_cleared` and `certificate_granted` on every clearing game, since its only guard is against a double award within the same game's own event log [unratified: lib/gym/awards.ts]. Designed, unbuilt: suppressing points, the level-cleared event, and the certificate on a repeat clear. See section 13, item 15.

Finishing a level does not unlock the next one, because there is no lock: all four scripted levels are open regardless of cleared state [ruled Steve 2026-09-03, components/account/progression/ladder-strip.tsx:21-23]. Nathan ruled the opposite on 2026-08-29, that each level is gated by the one before it; Steve's later ruling overtakes it.

True today in the code: all four Gym levels are fully scripted and playable end to end against their boss [unratified: lib/gym/levels/onboarding.ts and its three siblings; played and cleared in full by `point-taken-brain/docs/handoffs/2026-09-04_overnight-result.md`, tid BRAIN-T260904-20]. `app/gym/page.tsx` redirects to `/#ladder`; the profile's ladder strip (`components/account/progression/ladder-strip.tsx`) is the level select [ruled Steve 2026-09-04, cited in app/gym/page.tsx's own doc comment].

Opening a level is two cards, not one screen: a boss-intro card, then an agreement card naming the level, the boss, and the topic, and carrying the three `SIGNING_LINES` pledges in full [ruled Steve 2026-09-05, BRAIN-T260905-39, components/gym/level-intro.tsx]. The agreement card has two separately gated buttons: "I agree to all three" signs, and "Start the game" stays disabled until signed [unratified: components/gym/level-intro.tsx, `go()`]. No level shows a rule card before play; a card is met on the board the moment the level's script teaches it, the same as any other level. This supersedes the earlier rule-card-intro card, which showed the level's rule card face down before the player had ever seen the board move [ruled BRAIN-T260904-21, superseded]. The question-mark rule for an unearned card still applies wherever a card is listed elsewhere.

First-release totals as designed: 4 of 11 rule cards, 4 of 8 bosses, 15 of 26 badges, 4 certificates [unratified: guide §7]. Deferred to level 5 and later: importance ranking, the revise-topic win condition inside the Gym, the Steel Man card, communal points, and generosity tokens [unratified: guide §7].

## 11. Political neutrality

Non-negotiable, and it applies to the rules as much as to the game content. Every politically-perceptible example needs an equally vivid opposite-side counterpart, or an explicit acknowledgment that it is unbalanced. The paired examples in section 7 exist for this reason.

The 17-topic library is balanced in aggregate, not pair by pair: the standing obligation is that the shelf as a whole stays roughly even, reviewed quarterly [ruled BIZ-T260426-39, lib/board/setup.ts:93]. It carries topics that cut both ways, including student loan forgiveness, the death penalty, union protections, civilian access to military-grade weapons, a soda tax, eliminating the SAT, trans athletes in high school sports, asylum, deportation, and the Electoral College.

Acknowledgment of imbalance, stated rather than hidden: the boss roster is US-centric for the first release and has no Indigenous, Native American, or First Nations character. That is a deferral, not an oversight [ruled guide §2.1].

## 12. What is decided, what is built, what is neither

True today in the code, and player-visible: seats and sides, the three-line signing ritual, the topic library, the 100-character tile, the root stage, the four-thread ceiling, the two resolution tokens, both-must-match resolution, the click-then-click card throw, the six proposal asks, the four rule cards, the coach as an opt-in post-placement offer, both endgames, all four scripted Gym bosses and levels, the level's award events and points, and the Gym's on-screen certificate.

Decided and unbuilt: the graded steps inside cards, streaks, badge display names (the taxonomy itself is still open), a certificate a player can export or that live play produces, and the coach's pre-post draft review. Turn timers are removed from this list: they are out of scope for this edition by ruling [ruled Steve 2026-09-03, BRAIN-T260903-01] and belong to the Heart edition, not Brain.

Neither decided nor built, and therefore listed as a GAP above: the mid-tile indication for free-running turns, and the clarification move pending GitHub issue #3. Level unlocks are not on this list: there is no lock, ruled Steve 2026-09-03 (see section 10). Turn order, level replay, the two opening tiles, and the emoji vocabulary above level 1 are also off this list: each is ruled, above, though the replay ruling's "awards nothing twice" half is still designed, unbuilt (see section 13, item 15).

## 13. Contradictions a builder will hit

1. Not a contradiction. `threadsWinReached()` requires only that every live thread resolve, whatever their number, so level 1's two-thread win is reachable [ruled Steve 2026-09-01, BRAIN-T260901-06]. There is no `MIN_THREADS_TO_END` constant. This slot stays filled because this section's numbering is a builder-facing index and earlier entries cite it by number.
2. `GAME_MECHANICS.md` gives per-game token supplies (👍 x4, 👀 x4, 💵 x4). Brain has no token economy [ruled Steve 2026-08-28] and the code treats 👍 and 👀 as unlimited.
3. `GAME_MECHANICS.md` has four agreement items; the guide and the code ship three. The four-item version is superseded.
4. Not a contradiction. `lib/coach/run.ts` runs the coach only after the tile is in the log, and no copy anywhere describes the unbuilt pre-placement draft review. There is no how-to-play screen, which leaves the rules with no in-product home; see item 17. This slot stays filled because this section's numbering is a builder-facing index.
5. Not a contradiction. The Ways to Win card shows only the two placeable resolution tokens (`components/board/ways-to-win-card.tsx`). The other three exist as art and labels in `components/board/token-glyph.tsx` and nothing renders them. This slot stays filled because this section's numbering is a builder-facing index.
6. Not a contradiction. `MAX_THREADS` is 4, matching the four corners of `components/board/ways-to-win-card.tsx` [ruled Steve 2026-09-05, BRAIN-T260905-33]. This slot stays filled because this section's numbering is a builder-facing index.
7. The shipped label for 👍 is "Agree to agree", which is also the print game's name for the topic-revision endgame. Two different things share one phrase.
8. `docs/reference/materials/spec/2026-08-22_ai-feedback-vocabularies.md` describes the retired `agents.py` pipeline, including its nine checks under different wire spellings. The rebuild does not inherit it; `lib/coach/checks.ts` is the live version and it moves `whataboutism_red_herring` into the player-visible set and `false_causation` out of it.
9. The guide implied an `overgeneralization` word list already shipped. It never did; `lib/board/language.ts` was written from scratch [ruled BRAIN-T260823-42].
10. Registry row BRAIN-T260815-09 says No Exaggeration is level 4. It is level 3 and the row is wrong; the Gym guide is newer and wins.
11. `point-taken-brain/docs/reference/materials/roadmap-consolidation/2026-08-04_level-build-table.md` is superseded for levels 1 to 4, including its tile-count row and its mislabelling of Sloppy Salma as level 3 [ruled guide §9].
12. Not a contradiction. The join code is 5 characters (`JOIN_CODE_LENGTH = 5`, `lib/games/joinCode.ts:18`) and `app/not-found.tsx` tells the player five [unratified: app/not-found.tsx:42]. This slot stays filled because this section's numbering is a builder-facing index.
13. Not a contradiction. `app/gym/page.tsx` ships no topic string; it is a redirect to `/#ladder` (see section 10). Each level's topic lives in its own script and matches section 10's table exactly: "Should we stop changing the clocks twice a year?" (`lib/gym/levels/ground-rules.ts`), "Should tipping be replaced by higher base wages?" (`lib/gym/levels/claim-size.ts`), "Should AI-generated content be clearly labeled?" (`lib/gym/levels/clarity.ts`) [unratified].
14. Section 9's profile-stats list and `roadmap.md` section 3 describe a stat block the code does not build. The profile hero shows three figures: Games played, Cooperation score, and Points [unratified: components/account/hero.tsx:226,232,239]. A player's match history shows a per-game outcome label instead of aggregate stats: "Threads resolved", "Topic revised", "Unfinished", "Ran out of time" [unratified: components/account/match-list.tsx:32-35]. No "Cards landed" or "Games ended" stat appears anywhere in the current profile. Whether a fuller stats page still exists elsewhere was not checked.
15. Nathan's 2026-08-29 ruling that a Gym replay "awards nothing the second time" is not yet what the code does: `grantLevelAwards` (`lib/gym/awards.ts:50-121`) re-awards points, badges, `level_cleared`, and `certificate_granted` on every clearing game, guarding only against a double award inside one game's own log. Badges are the clearest case: each repeat clear appends the badge again with `occurrence` one higher, so the count climbs rather than being suppressed. See section 10.
16. `BIZ-T260824-14` rules that the moderator refuses a question "on a trailing question mark plus interrogative openers". `isQuestion` in `lib/board/rules.ts:205-213` tests the trailing punctuation and nothing else, and the comment beside it says the miss is deliberate. The ruling stands and the code is narrower than it. Someone has to say whether the openers get built or the ruling gets rewritten.
17. There is no in-product statement of the rules. The how-to-play page is gone and nothing replaced it, so a player's only account of how the game works is what the Gym teaches them one beat at a time and whatever the moderator refuses. Whether that is the intended end state, or a screen that has yet to be rebuilt, is not ruled.
