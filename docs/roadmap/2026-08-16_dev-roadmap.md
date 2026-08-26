# Dev roadmap: levels 1-4, dependency-ordered

Status: v1, approved in principle by Steve 2026-08-16. **Pen with Brain.**
**All ten questions are answered** (Q1, Q2, Q3, Q5 by biz on 2026-08-18 from Steve's 2026-08-17
session; Q4, Q6, Q7, Q8, Q9, Q10 plus the open half of Q3 by Steve directly on 2026-08-19). No
question blocks any phase. Phase ordering is unchanged from v1. Parallel Sonnet execution may
start anywhere.
Inputs: `2026-08-04_level-build-table.md`, `2026-08-16_engineers-pass.md`, Steve's eight answers
of 2026-08-16 (decisions `BRAIN-T260816-09` through `-16`), and a direct read of the current
frontend/backend source.

---

## The three findings that set the order

**1. The event log is the spine, and it does not exist.** Today a game records
`gameLog: GameAction[]` where a `GameAction` is exactly `{type, actorRole}`. No timestamp, no
`tileId`, no user identity, no payload. Nearly every badge, rung, and boss win condition in levels
1-4 is a predicate over a *sequence* of events: "catch all four, and finish the game with both
habits retired", "resolve within N tile moves", "first correct throw", "you inflated your own
claim and brought it back". None of those can be computed from the current log. If badges get
built against ad-hoc per-mechanic state instead, every one of them is rewritten when the log
lands. The log goes first.

**2. Progression has no server home.** `useCardLedger`, `usePointsLedger`, `useBadges`, and
`useSignedAgreement` all exist on `overnight/2026-08-15`, and all four hold state in the client
with nowhere durable to write it. Cards owned and badges earned belong to the **account**, not the
game: that is the whole premise of the Dojo account display and of levels gating on prior levels.
Nobody has specced that record. It is the single largest rewrite risk in the plan.

**3. Four different mechanics are the same interaction.** Tile relocation (author or thrower
initiates, author approves), Help Me Understand's handback, all three Steel Man rungs, and
revise-topic-together are each "one player proposes a change concerning the other player's tile;
the author accepts or rejects; the contrast is shown side by side; rejection teaches and does not
score." Build that proposal-and-approval primitive once in phase 3 and the four mechanics become
thin. Build them separately and there are four inconsistent accept/reject UIs.

Secondary but real: the `PLACE_RULE_CARD` action type is already declared with no socket handler,
and `Tile.ruleCard` / `Tile.revised` are commented out in the schema. The throw was anticipated and
never wired.

---

## Phase 0 — Clear the tree (nothing parallel can start until this is done)

| # | Item | Why it is first |
|---|---|---|
| 0.1 | Land or discard the seven uncommitted frontend files (`Tile.vue`, `CollapsedThread.vue`, `OnboardingVideo.vue`, `ResolveAgreementModal.vue`, `WaysToWinCard.vue`, `useAnchoredPopover.ts`, `game/[gameCode].vue`) | `Tile.vue` is touched by three later work items. Parallel agents cannot share a dirty file. |
| 0.2 | Resolve the sixth-onboarding-step vs YouTube-embed collision (`BRAIN-T260816-05`) | `OnboardingVideo.vue` gates the live embed on `currentIndex === 4`; overnight commit `ecc1673` inserted a step. Merging the branch breaks prod onboarding. |
| 0.3 | Fix the PDF history-strip over-deletion (`BRAIN-T260815-35`) | Off the code critical path, runs in parallel, but blocks sending the roadmap to the team. |

## Phase 1 — The record layer

Everything downstream is a query over this. Touches `src/models/Game.ts`, `src/models/Tile.ts`,
`src/sockets/game.ts`: all shared files, so **every diff here goes to Steve before it ships**, and
nothing goes near `experimentCondition` (`Game.ts:54`, Corey's).

- **1.1 Event log v2.** Append-only. Each entry: `seq`, `ts`, `type`, `actorRole`, `actorUserId`,
  `source` (`human` | `coach`), `tileId?`, `threadRootId?`, `ruleCard?`, `payload?`. The `source`
  field is what lets a badge tell "the player inflated their own claim" from "the coach dared them
  into it", which no current field can express. Write it from every existing socket handler.
- **1.2 Activate `Tile.ruleCard` and `Tile.revised`.** Uncomment, migrate, backfill null.
- **1.3 `Game.mode: 'dojo' | 'gym'`, `Game.levelId`, `Game.bossId`.** Names now settled
  (`BRAIN-T260816-09`), so this ships un-placeholdered. Plus the Gym/Dojo route split.
- **1.4 Account progression record.** New durable item keyed by user: cards owned, badges earned,
  highest level reached, in-flight Dojo game id, coach temperament pick. This is finding 2 and it
  is a schema decision, not a coding task; it needs a shape agreed before anyone writes it.

## Phase 2 — The award engine

Depends on 1.1 and 1.4.

- **2.1 Predicate evaluator.** Badge and boss criteria as pure functions over the event log,
  evaluated server-side after each action, idempotent, and re-runnable over a finished game. That
  last property is what makes criteria tunable without invalidating anyone's earned badges.
- **2.2 Rewire the four ledgers** to read server truth. They become views, not stores.
- **2.3 Points scope as a level config field** (personal at level 2, team at level 3+). One system
  with a parameter, per the build table.

## Phase 3 — The throw, and the proposal primitive

Depends on 1.1, 1.2, 2. The build table: "It is a single `[NOW]` build and everything below
assumes it."

- **3.1 Hand UI + aiming.** Pick a card you own, aim at exactly one opponent tile, both players see
  which card landed where. Wire the orphaned `PLACE_RULE_CARD` action to a real socket handler.
- **3.2 Throw resolution.** Correct/incorrect, badge and points crediting through phase 2.
- **3.3 The proposal-and-approval primitive.** Finding 3. One component and one socket pair:
  propose a change to a tile, render the contrast side by side, author accepts or rejects,
  rejection teaches and does not score. Author approval is now settled policy
  (`BRAIN-T260816-12`).

## Phase 4 — The Gym shell

Depends on 1.3, 3. **This phase carries the schedule risk.** The socket layer assumes two human
clients; a scripted opponent is the largest unbuilt system in the plan, and its AI-behavior half
would naturally land in `agent/agents.py`, `agent/main.py`, and `agent/schemas.py`, all Corey's.

**Resolved by Steve 2026-08-16:** read and copy from Corey's code freely; never write to his
files. So the runner is built as a **new backend TypeScript service plus, where language work is
genuinely needed, a new Python module that lifts patterns out of `agents.py` rather than editing
it.** Nothing in this plan modifies `agents.py`, `main.py`, or `schemas.py`. The one residual cost
is route exposure: a new Python endpoint conventionally registers in `main.py`, which is his. The
workaround is to stand the coach module up as its own small FastAPI app on its own port, or to have
the TypeScript service import it as a subprocess/library. Either avoids his files entirely. This is
an engineering call, not a Steve call, and phase 4 will make it.

- **4.1 Scripted opponent service.** Steps a script, seeds a board, takes turns, branches on caught
  habits (this is what "bosses are people, and you reform them" requires).
- **4.2 Coach persona parameter.** Three temperaments as one parameter.
- **4.3 Coach write-access to a compose box.** Serves the dare (📏3) and the pre-typed draft
  reading (`BRAIN-T260816-11`). Build once. Requires `source: 'coach'` from 1.1 to stay honest.
- **4.4 Level progress persistence and resume.** Re-opening a finished game is deferred
  (`BRAIN-T260816-14`).

## Phase 5 — Card mechanics (parallel across agents once phase 3 lands)

| Track | Item | Extra dependency |
|---|---|---|
| A | 🙅 "You" is Taboo, throw-wired (`you_is_taboo` already live) | none beyond 3 |
| B | 🎯 rungs 1 and 2, throw-wired (`irrelevant_rebuttal` already live) | none beyond 3 |
| C | Tile relocation drag: grab handles and magnets, join a root or become one | 3.3 |
| D | 🎯3 "Right reason, wrong home" | C |
| E | 💬 Help Me Understand rungs 0/1/2, Define That folded in as a subset (`BRAIN-T260816-13`), handback points at what is wrong (`BRAIN-T260816-10`) | 3.3 |
| F | 🎭 Steel Man rungs 1/2/3; rung 2 shares E's component | E |
| G | 📏 No Exaggeration rungs 1/2/3; rung 3 is badge-only, no points, so nobody inflates to farm the repair | 4.3 for the dare |
| H | ↕️ importance ranking | C |

Tracks A, B, C, E are independent of one another and are the natural parallel fan-out. D, F, G, H
each wait on exactly one predecessor.

## Phase 6 — Surfaces

- **6.1 Dojo account display**: badges and cards owned only. Certificates deferred
  (`BRAIN-T260816-15`).
- **6.2 Rule-card onboarding pop-up**, one per rung.
- **6.3 Signing ritual** wired into every level (components already exist).
- **6.4 Compact display**, near-half only. Far-half relayout stays out of first release.
- **6.5 Partner-just-moved notification**: in-app, batched, opt-out, no email. Batching unit is
  still undecided.

## Phase 7 — Level assembly

Content, not engineering: each level is a script plus criteria rows over systems already built.
Level 1 Bashful Bob (win = finish the game, `BRAIN-T260816-16`), level 2 Kranky Karl, level 3
Sloppy Salma, level 4 Twisty Thibault. If a level needs a new system at this point, the phase
above it was under-built.

---

## Nothing is blocked (was: "Still blocked, and what each blocks")

Every row in the original table is now answered. Kept as a record of what each answer released.

| Question | Was blocking | Released by |
|---|---|---|
| Shape of the account progression record (1.4) | Phase 2 entirely | Q1, per-account and crosses modes |
| What "the stronger of two readings" means | 🎭2 only (track F) | Q6, no check; acceptance is the judgment |
| Points amount for revise-topic-together | Level 4 assembly | Q7, Brain sets the whole table now |
| Batching unit for the partner notification | 6.5 only | Q9, premise wrong; play is async, no batching |
| Whether the compact-display toggle persists across reloads | 6.4 only | Q10, per-account preference, purely visual |

The account-record shape is the one on the critical path. See the review section below, which
supersedes this table.

---

# Review cycle

This doc is the shared surface between the Brain session (engineering) and the pt-biz session
(product intent, and author of the plan this is derived from). We edit it serially, not
concurrently: whoever is not holding the pen does not write to the file.

**Holder: pt-biz.** Brain wrote v1 and hands over. pt-biz answers the questions below in place,
under each question, then flips the holder line back to Brain.

Convention: append answers inline. Do not delete a question; strike it by writing **ANSWERED
(biz, YYYY-MM-DD):** under it. Log each handover in the changelog at the bottom.

## Questions for pt-biz

These are product-intent questions, not engineering preferences. Each one changes the shape of
something in phases 1 through 3, which is why they are worth answering before code starts rather
than after.

**Q1. Is progression per-account, and does it cross modes?** Phase 1.4 has to write a record
somewhere. Does a card you earned in Dojo level 2 come with you into Gym? Does Gym award badges and
points at all, or is Gym unscored open play with the full card set available? The three plausible
answers give three different schemas and are not cheap to switch between later.

**ANSWERED (biz, 2026-08-18):** Progression is **per-account and crosses modes**. Points persist
to the account as a lifetime total and are the basis of a leaderboard. Cards are earned in
**practice only**; live play awards points and no cards (already recorded as `BRAIN-T260817-14`
and already built that way in `src/progression/awardEngine.ts`). Every player **starts at zero**.
Naming caveat: this question's wording predates the Dojo to Gym rename (`BRAIN-T260816-18`) and
reads as if Dojo and Gym were two different modes. They are one mode under two names. The real
pair is **practice (Gym)** versus **live play**; read the question that way.

**Q2. Does Gym have rule cards?** Related to Q1 but separable. Options: Gym gives everyone all
eleven cards regardless of progression, Gym gives you only what you own, or Gym has no cards and is
the plain tile game that ships today.

**ANSWERED (biz, 2026-08-18):** None of the three listed options, exactly. Steve's answer:
**cards are earned, with blank space shown before that** (an unowned card reads as an empty slot,
not as an absence), and **only practice earns cards**. For live play the card set is
**settable to the least common denominator across the two players, or otherwise configurable**,
so that one player can deliberately play down to teach the other. So live play needs a per-game
card-set setting with a least-common-denominator default, not a fixed rule.

**Q3. Do points persist to the account, or reset per game?** Level 2 is personal points and level 3
is "the points belong to the table now". Is a lifetime point total a thing a player has? And are
team points shared across a pairing that plays repeatedly, or scoped to a single game?

**ANSWERED (biz, 2026-08-18):** Points **persist to the account**. A lifetime point total is a
thing a player has, and it feeds a leaderboard. Players start at zero. The team-points-across-a
-repeated-pairing half of the question was not addressed and is **still open**; treat team points
as scoped to a single game until Steve says otherwise, since that is the cheaper direction to
widen later.

**Q4. Is level gating a hard lock or a soft suggestion?** Can a player jump to level 4 without
beating levels 1 through 3? This decides whether the award engine is on the critical read path of
game creation or only of the account display.

**ANSWERED (Steve via Brain, 2026-08-19):** **Soft suggestion.** All levels stay selectable; the
UI recommends the next one and shows what has been beaten. The award engine therefore stays off
the critical read path of game creation and feeds only the account display. Engineering
consequence: a progression outage must never block a game from starting, and the gate predicate
is not needed anywhere in the socket layer.

**Q5. Are badges re-earnable on replay?** Levels are replayable and bosses re-fightable. If a
badge can be earned twice, the ledger needs occurrence counts; if not, the award engine needs a
first-write-wins guarantee. Cheap now, migration later.

**ANSWERED (biz, 2026-08-18):** **Yes, badges are re-earnable on replay.** The ledger therefore
needs occurrence counts, not a first-write-wins guarantee. Note this cuts against the current
build: `src/models/Progression.ts` gets badge idempotency from key construction, with the causing
event embedded in the badge key. That may already give the right behaviour (a different replay is
a different causing event, so it writes a new item), but it was designed for first-write-wins and
should be re-read against "counts" before phase 2 is called done.

**Q6. What does "the stronger of two readings" mean, concretely?** This is the only remaining hard
block inside phase 5, and it stops 🎭2 alone. The fallback that unblocks it without a definition:
make 🎭2 a pure proposal with no correctness check, where the author's acceptance *is* the
judgment. Confirm that fallback is acceptable, or define the term.

**ANSWERED (Steve via Brain, 2026-08-19):** **Take the fallback. No correctness check.** The
restatement is a pure proposal and the author's acceptance *is* the judgment on whether it was
stronger. No AI adjudication, and no definition of "stronger" is needed anywhere in the build.
This makes the level 4 rung structurally identical to every other propose-and-approve mechanic,
which is the reading the roadmap's third structural finding already assumed. 🎭2 is unblocked and
its row in "Still blocked" can be struck.

**Q7. How many points does revise-topic-together award?** Settled that it scores as team points;
the amount was never set. Needs a number, or a rule for deriving one.

**ANSWERED (Steve via Brain, 2026-08-19):** Steve's answer was broader than the question: *"just
make up point values for everything now, it's easy changes later."* So Brain sets the whole point
table, not only this number, and it lands in the single named table in
`src/progression/scoring.ts` so every value is changeable in one place. This also closes
`BRAIN-T260818-03` (the live-game point values), which was waiting on the same decision. Catching
the snitch is set as the largest single award in the game, since it is the harder of the two win
conditions. The specific numbers are Brain's to choose and are provisional by construction.

**Q8. Is the coach's temperament pick per-account or per-game, and can it be changed?** Determines
whether it lives on the progression record from Q1 or on the game record.

**ANSWERED (Steve via Brain, 2026-08-19):** **Per-account, changeable at any time.** It lives on
the progression record from Q1, not on the Game record, and follows the player into every game.
Known consequence, accepted: two players in one game cannot have different coaching temperaments.

**Q9. What unit batches the partner-just-moved notification?** Time window, turn boundary, or
count. Leaf question, blocks only 6.5.

**ANSWERED (Steve via Brain, 2026-08-19):** The question's premise was wrong. Play is **fully
asynchronous**: there is no turn to batch on, so there is no batching unit. What is wanted is a
plain popup naming the action and where it happened, e.g. *"Player B just added a tile on the
upper-left thread."* That makes 6.5 a notification-rendering task, not a batching-policy task.
**Verified against the current codebase 2026-08-19 (subagent read, recorded in
`BRAIN-T260819-03`).** The async claim holds, and the notification is mostly already built:

- **No turn gate exists anywhere.** The `Game` interface (`src/models/Game.ts:97-131`) has no
  `turn` / `currentPlayer` / `activePlayer` field, and every socket handler in
  `src/sockets/game.ts` (`placeTile`, `confirmTile`, `removeTile`, `placeEmoji`, `editTile`,
  `reviseTile`) checks `actorRole` for ownership only, never for turn order. The one alternation
  rule that existed was demoted to a client-side nudge on 2026-07-13 (`BRAIN-T260713-08`), and
  `src/sockets/game.ts:273-278` says so in a comment. Frontend has no turn-based `:disabled`
  binding; the only nudge is a once-per-game confirm modal keyed in `sessionStorage`
  (`GameBoard.vue:66-90, 400-464`). Both players can act at any time.
- **Two notification surfaces already exist.** `useAlerts.ts` (a `success`/`error`/`info` queue
  rendered by `AlertStack.vue`), and `notifyPartnerTileActivity()`
  (`pages/game/[gameCode].vue:634-648`), a directional click-to-scroll toast that auto-dismisses
  after 6s. Today the tile events only toast when the tile is *off-screen*; only `placeEmoji`,
  `undoPlaceEmoji`, and `reviseTopicProposal` toast unconditionally.
- **Stable position exists.** Every tile has a `tileId` plus `parentId`/`parentEdge`, where
  `parentEdge` is 0-7 on a fixed compass (`useGameBoard.ts:7-16`), and `buildGameBoard`
  (`useGameBoard.ts:28-67`) BFSes from root tile `"0"` to a deterministic `{x, y}` identical on
  both clients. Threads root at tiles `"1"`-`"4"`, and `findThreadRoot()`
  (`src/sockets/game.ts:156-168`) walks any tile back to its thread. So "upper-left thread" is
  derivable. One catch: the existing `arrowTowardTile()` computes direction relative to the
  *viewport*, so 6.5 must use the absolute `{x, y}` from `useGameBoard` instead, or the same
  thread gets a different name depending on scroll position.

That reduces 6.5 to: fire the toast unconditionally rather than only when off-screen, and swap the
viewport-relative direction for the board-absolute one.

**Q10. Does the compact-display toggle persist across reloads and across games, and is it purely
visual?** If it changes what counts as off-screen for the partner notification, it stops being a
view preference and starts being state. Leaf question, blocks only 6.4.

**ANSWERED (Steve via Brain, 2026-08-19):** **Per-account preference, purely visual.** It persists
across reloads and across games, and it changes nothing about game state or about what either
player can do. It therefore stays a view preference: never synced to the other player, never
written to the event log. It does not interact with the partner notification, which per Q9 is a
popup rather than an off-screen calculation.

## Brain's own open engineering calls (not for biz)

Recorded here so the doc is one surface, not two. Brain decides these and will report, not ask:
how the coach's Python module is exposed without touching `main.py`; whether the event log lives
inline on the game item or in its own table; whether the proposal primitive is one socket pair or
one per mechanic.

## Changelog

- 2026-08-16, Brain: v1 written. Handed to pt-biz with ten questions.
- 2026-08-18, biz: Q1, Q2, Q3 and Q5 answered in place from Steve's 2026-08-17 session answers.
  Q4 and Q6 through Q10 left open. Pen returned to Brain. No change to the phase ordering: the
  three structural findings (event log is the spine, progression has no server home, four
  mechanics are one propose-and-approve interaction) all survive the answers, and Q1 landing on
  "per-account, crosses modes" is the reading phase 1.4 was already built against.
- 2026-08-19, Brain: Steve answered the remaining six (Q4, Q6, Q7, Q8, Q9, Q10) plus the open half
  of Q3, in session. All ten questions are now closed. Q9's premise was wrong and is corrected in
  place: play is asynchronous, so there is no batching unit. Q7 widened into a decision to set the
  whole point table now. Q6 resolves to the no-check fallback, which unblocks 🎭2. Phase ordering
  unchanged. "Phase 4 — The Dojo shell" renamed to Gym (BRAIN-T260816-18). Pen stays with Brain.
