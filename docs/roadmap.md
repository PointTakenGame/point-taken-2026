---
slot: roadmap.md
game: brain
purpose: Build order, level scope, and deferral boundary for the Brain game, carried into the repo from sources that are never pushed.
written: 2026-08-28 by biz
status: draft, unreviewed by Steve
sources:
  - point-taken-brain/docs/reference/materials/roadmap-consolidation/2026-08-16_dev-roadmap.md
  - point-taken-brain/docs/reference/materials/spec/2026-08-22_gym-levels-1-4-implementation-guide.md
  - point-taken-brain/docs/reference/materials/spec/2026-08-22_skill-ladder-levels-1-4.md
  - point-taken-brain/docs/reference/materials/roadmap-consolidation/2026-08-04_level-build-table.md
  - point-taken-brain/docs/reference/materials/roadmap-consolidation/2026-08-16_engineers-pass.md
  - point-taken-brain/docs/reference/materials/roadmap-consolidation/2026-08-15_builder-brief.md
  - point-taken-brain/docs/reference/materials/architecture/2026-08-19_platform-rebuild-decision.md
---

# Brain roadmap

This is the Brain game only: the web game of logic and argument mapping, tiles on a board, threads
under a topic. Heart (Humility Showdown) is a separate game with its own print product and its own
roadmap. Nothing here applies to it.

**Marker key.** `[ruled]`: Steve or a registry decision established it. `[unratified]`: it lives in
the code and nobody ruled it, cited to file and line. `[vibecoded]`: invented here, labelled every
time. `GAP:` the value was refused rather than invented, and the exact question follows.

**No calendar dates appear here, by rule.** Sequence and dependency are stated; ship dates,
durations, headcount, and budget are not. The sources listed above sit outside this repo and are
never pushed, so their substance is carried in here; do not follow a path expecting to find a file.

---

## 1. The shape of the thing being built

Two halves of one product, and they are not two views of the same code path:

- **Live play**, a real human opponent, no boss, no script, no coach nudges.
- **The Gym**, a scripted practice ladder against a cooked opponent, with a coach at the side.

The Gym was formerly called the Dojo `[ruled]` (renamed, `BRAIN-T260816-18`). Practice versus live
play is the real pair; Gym and Dojo were never two modes.

**The Gym, levels 1 to 4, is on the critical path** `[ruled]` (Steve, 2026-08-28). This repo's own
`README.md` and `CLAUDE.md` say otherwise and are stale; see section 8.

**Three findings set the build order** `[ruled]` (dev-roadmap, approved in principle by Steve
2026-08-16; all ten of its open questions answered by 2026-08-19, none blocking any phase):

1. **The append-only event log is the spine.** Badge, boss, and points criteria are pure predicate
   functions over the event sequence, idempotent and re-runnable over finished games, so they stay
   tunable after the fact. The log is a versioned public contract, written down before code.
2. **Progression has no server home.** Cards owned, badges earned, points, highest level: all client
   state with nowhere durable to write. The single largest rewrite risk.
3. **Four mechanics are one interaction.** Tile relocation, the Help Me Understand handback, all three
   Steel Man rungs, and revise-topic-together are propose-and-approve. Build one component and one
   action pair, once `[ruled]` (`BRAIN-T260816-12`: approval belongs to the tile's author).

**The platform is the rebuild stack** `[ruled]` (`BRAIN-T260819-11`): Supabase (Postgres, anonymous
auth, Supavisor pooling from day one), Vercel, Resend, Anthropic, Sentry. Off AWS entirely. Postgres
because replay is `SELECT * WHERE game_id = ? ORDER BY seq`. The Python sidecar is killed and three
sequential AI calls collapse to one streamed structured-output call. No event-sourcing framework.
Never build WebRTC. Raw audio is never stored by default; transcripts are events.

**Harvest, not rewrite** `[ruled]` (`BIZ-T260824-17`): settled logic in the retired stack is ported,
not reimplemented, and every "already exists" in an older source means "exists in the stack we are
turning off" `[ruled]` (`BIZ-T260824-13`).

**The Gym runs client-authoritative** `[ruled]` (platform decision §2b). The client is authoritative
for experience; the server is authoritative for record. The event log batches and uploads, the server
replays it and awards from its own evaluation, and one shared criteria package is used by both sides
with explicit version-skew handling.

---

## 2. Build order

Phases are ordered by code dependency, not product preference `[ruled]`. Parallel execution may start
anywhere a phase's stated dependencies are met.

### Phase 0. Clear the tree

Land or discard the in-flight work, resolve the onboarding-step collision (`BRAIN-T260816-05`), and
fix the PDF history-strip over-deletion (`BRAIN-T260815-35`). All three items were written against the
retired Nuxt client.

GAP: are phase 0's three items closed by the platform rebuild, or does each still owe a fix in this
repo? Nobody has re-derived them since the stack changed.

### Phase 1. The record layer

Nothing else can be built on top until this is settled, because everything else reads from it.

- **1.1 Event log v2, append-only.** Entries carry `seq`, `ts`, `type`, `actorRole`, `actorUserId`,
  `source` (`human` or `coach`), and optional `tileId`, `threadRootId`, `ruleCard`, `payload`
  `[ruled]`; a dedicated table keyed by `game_id` and `seq` with `schema_version`, a JSONB payload,
  server-stamped time, and projections rebuildable from the log `[ruled]`. It exists here:
  `supabase/migrations/0001_event_log.sql`, `0002_event_type_catalogue.sql`, row shape `GameEventRow`
  at `lib/events/types.ts:327-338`, catalogue of 28 types at `:248-277` `[unratified]`.
- **1.1a The four award events are missing and are a migration.** `card_granted`,
  `certificate_granted`, `badge_granted`, `points_adjusted` `[ruled]` (`BIZ-T260824-08`). The
  catalogue is a closed set of single-token `snake_case` types enforced by the database, which is why
  `card.granted` was never expressible. `points_adjusted` was ruled required rather than optional
  because level 3 docked and then refunded and the scoring model is replay-derived. The docking is
  gone: the L3.9 dare that did it was removed 2026-08-31, and nothing in levels 1 to 4 moves points
  backwards any more. Whether the type still earns a slot in the closed 28-type catalogue with no
  caller is open (`BRAIN-T260831-42`); the catalogue being closed and database-enforced is the reason
  it is cheaper to keep than to re-add. Awarding a card and awarding a
  certificate are **two events, not one** `[ruled]` (`BIZ-T260819-16`).
- **1.2 Tile fields.** `revised` is live at `lib/board/project.ts:33`, set at `:562` `[unratified]`.
  GAP: does a tile still need a `ruleCard` field of its own in the new schema, or does the thrown card
  live only in the event payload? The retired backend carried both and its handler was never wired.
- **1.3 Mode, level, and boss on the game record** `[ruled]` (`BRAIN-T260816-09`), plus the route
  split so practice and live play are two pages, not one page with a flag. `levelId` and `bossId`
  already project at `lib/board/project.ts:308-309, 365-366, 430-431`, and the coach projects at
  `:194` and `:512` `[unratified]`.
  The mode enum is `GameMode = "gym" | "live"` (`lib/db/types.ts:16`) `[unratified]`. The source
  specifies `'dojo' | 'gym'`, which names the retired word and omits the live mode; build to the code.
- **1.4 The account progression record.** Cards owned, badges earned with occurrence counts, points,
  highest level reached, in-flight practice game id, coach pick. **Absent from this repo entirely.**
  Harvest it from the retired backend's progression module rather than reimplementing; the old
  counter field that named snitch catches is renamed in the port `[ruled]`.

### Phase 2. The award engine

Depends on 1.1 and 1.4.

- **2.1 Predicate evaluator** over the event sequence. Criteria are pure, idempotent, and re-runnable.
- **2.2 The four ledgers become views, not stores.** They read server truth.
- **2.3 Points scope is a level config field**, with `"none"` as a legal value `[ruled]`.
- **Badges are re-earnable** `[ruled]` (dev-roadmap Q5), so the ledger keys an occurrence, not a
  badge: badge id plus source game id plus source event `seq`. First-write-wins key construction is
  wrong and must not be carried over in the port.
- **Level gating is a soft suggestion, never a gate** `[ruled]` (Q4). The award engine must stay off
  the critical read path of game creation: a progression outage must never stop a game from starting.

### Phase 3. The throw and the proposal primitive

Depends on 1.1, 1.2, and phase 2.

- **3.1 Hand UI and aiming**, and wire the throw end to end.
- **3.2 Throw resolution.**
- **3.3 The propose-and-approve primitive, built once**, serving all four mechanics from finding 3.
  Approval belongs to the author of the tile being changed `[ruled]`.

In this repo `card_thrown`, `card_throw_declined`, `proposal_made`, `proposal_accepted`, and
`proposal_rejected` are live event types `[unratified]` (`lib/events/types.ts:248-277`), but rungs are
not built: `app/game/[gameId]/actions.ts:197` reads that every throw so far is a card throw.

GAP: one socket or action pair for the whole proposal primitive, or one per mechanic? Named as an open
engineering call for brain to make.

### Phase 4. The Gym shell

Depends on 1.3 and phase 3. **This phase carries the schedule risk: the scripted opponent is the
largest unbuilt system in the product.**

- **4.1 Scripted opponent service.** Read and copy freely from the existing AI code; never write to
  its files `[ruled]` (Steve, 2026-08-16).
- **4.2 Coach persona as a parameter**, not a fork of the code path.
- **4.3 Coach write access to a compose box** `[ruled]` (`BRAIN-T260816-11`), serving both the dare and
  the pre-typed draft. Every such write requires `source: 'coach'` on the event.
- **4.4 Level progress persistence and resume.** Re-opening a finished game is deferred `[ruled]`
  (`BRAIN-T260816-14`).

In this repo `app/gym/page.tsx` is a level-select page with levels 1 to 4 hardcoded, and every Start
button is `disabled` at line 111 `[unratified]`. Nothing writes a scripted-opponent move.

### Phase 5. Card mechanics

Parallel once phase 3 lands. Eight tracks; the natural fan-out is A, B, C, and E first, because the
rest wait on them.

A: 🙅 "You" is Taboo, waits on phase 3. B: 🎯 Stick to the Thread's Root rungs 1 and 2, phase 3.
C: tile relocation, the grab-handle-and-magnet gesture, waits on 3.3. D: 🎯 rung 3, waits on C.
E: 💬 Help Me Understand rungs 0, 1, 2, waits on 3.3. F: 🎭 Steel Man rungs 1, 2, 3, rung 2 reusing
E's component, waits on E. G: 📏 No Exaggeration rungs 1, 2, 3, rung 3 badge-only, waits on 4.3.
H: ↕️ importance ranking, waits on C.

📖 Define That is not a card. It is rung 2 of 💬 Help Me Understand `[ruled]` (`BRAIN-T260816-13`).
The handback points at what is wrong rather than asking an open question `[ruled]`
(`BRAIN-T260816-10`).

Tracks F and H build mechanics whose **levels** are deferred past the first release (section 5). Build
the mechanic only if its track is scheduled; do not infer a level from a track.

### Phase 6. Surfaces

- **6.1 Account display: badges and cards only.** Certificates on the profile are deferred `[ruled]`
  (`BRAIN-T260816-15`).
- **6.2 Rule-card onboarding pop-up, one per rung.**
- **6.3 The signing ritual in every level.**
- **6.4 Compact display**, near-half only. It is a per-account visual preference, never synced, never
  logged `[ruled]` (Q10).
- **6.5 Partner-just-moved notification: in-app, opt-out, no email** `[ruled]`; email costs real money
  per message. Play is fully asynchronous with no turn to batch on `[ruled]` (Q9, verified against the
  code), and any pointer for this must use board-absolute coordinates, not viewport-relative ones.

### Phase 7. Level assembly

Content, not engineering. If a level needs a new system at this point, the phase above it was
under-built `[ruled]`.

---

## 3. The Gym: levels 1 to 4

**One cooked game per level, and it is that level's boss game** `[ruled]`. A boss commits exactly the
violations its level teaches and nothing else. The boss's name reads as the card `[ruled]`
(`BIZ-T260819-06`).

**The rule above all others** `[ruled]` (`BIZ-T260823-77`): a tile must make the thread root more or
less likely to strengthen or weaken support for the topic. This lets the coach reject a tile without
adjudicating the world, and it is why whataboutism needs no detector: such a tile fails by
construction.

**You cannot fail a Gym level** `[ruled]` (`BIZ-T260823-67`). There is no `failure`, `lives`,
`attempts`, or `maxMoves` field, and adding one is a design error, not a missing feature.

The level-by-level table (card taught, topic, boss, thread count, points scope, and fast-forward per
level) is normative in `rules.md`, in its Gym section, and is not repeated here. Every value in it is
`[ruled]` (gym implementation guide §1.1, `status: active`).

**Award beats, by beat id** `[ruled]`. Beat ids are stable identifiers and are the award `trigger`
keys, so renaming one is a data change:

- L1: L1.1 (three awards), L1.10, L1.12, L1.17.
- L2: L2.3, then L2.5, L2.7, L2.9 on the throw.
- L3: L3.4 throw, L3.6 throw, L3.8 repair (zero points), L3.10 throw. (The two L3.9 award beats,
  send and repair, are deleted along with the dare, 2026-08-31. The label L3.9 is left empty rather
  than reused, so L3.10 onward does not silently shift.)
- L4: L4.4 throw, L4.6 throw, L4.7 throw.

`THROW_POINTS = 10` `[ruled]` (`BIZ-T260823-65`). Every points figure in the first release is
`THROW_POINTS`, its negative, or zero. The values are provisional by construction: Steve's instruction
was to pick numbers now because they are cheap to change later.

**Why each level depends on the one before.** The dependency is not engineering, it is the skill:

- **Level 1 is the loop.** Bob is the one opponent doing nothing wrong; the level tests whether the
  player can play at all. It carries two skills, the stronger carried by a single beat of silence.
- **Level 2 adds relevance**, and introduces tile relocation, the gesture every later
  propose-and-approve mechanic reuses.
- **Level 3 is the only level that asks the player to fix themselves**: their own overstatement is
  caught and repaired. (It was caught, docked, and repaired until the L3.9 dare was removed on
  2026-08-31. The self-catch survives the deletion; only the points movement is gone.) Catching yourself presupposes seeing the move at all, so it needs 2.
- **Level 4 substitutes rather than adds.** The skill replaces an earlier reflex instead of stacking
  on it, so it cannot be reordered ahead of level 3.

The skill wording is `[unratified]` in the sense that matters here: its source doc is `status: draft,
needs Steve's ear on the wording`. Treat the phrasing as provisional and do not put it on a surface a
player reads without checking.

**Two engineering findings embedded in the beat sheets** `[ruled]`, both of which bite this repo:

1. **Level 1's win is unreachable against shipped code.** The minimum thread count is four:
   `lib/board/rules.ts:66`, `export const MIN_THREADS_TO_END = 4;`, used by `threadsWinReached()` at
   `:106-109` `[unratified]`. Level 1 has two threads. The ruled fix makes the minimum a per-game
   number set at creation, with level 1 setting its own to 2 (`BRAIN-T260823-39`, `BIZ-T260824-11`).
   It surfaces in the ways-to-win card and the live board, so the per-game value must reach those.
2. **The rung-0 question test does not exist in the tile validator.** The approved implementation is a
   trailing question mark plus a list of interrogative openers, with no model call; a refusal names the
   rule and hands the text back (`BRAIN-T260823-43`, `BIZ-T260824-14`). Build it in the tile validator
   so the Gym gets it for free.

Level 3's silent self-catch also uses a word list and no model call `[ruled]` (`BIZ-T260823-74`). That
list was written from scratch in `lib/board/language.ts` (`BRAIN-T260823-42`) and holds 50 phrases
`[unratified]`. Level 3's dare is removed from the game `[ruled Steve 2026-08-31]`, superseding `BIZ-T260824-09`,
which had only narrowed its guard rail. What a player who wrote nothing inflatable sees instead is
undesigned (`BRAIN-T260831-41`).

**Three voices, and only one is a model** `[ruled]`. The **boss** speaks across the board from fixed
script text. The **coach** 🧘 sits at the side and never plays a tile; its fourth job, added
2026-08-24 (`BIZ-T260824-24`), is to read the player's draft before it posts and name the card an
opponent could throw at it, without rewriting the tile, Gym only, and only for cards the player has
already earned. The **moderator** is a neutral system channel with no avatar, earns nothing, is not a
model, and is where rules are enforced at write time. The coach is picked per account and changeable
at any time `[ruled]` (Q8, `BIZ-T260823-68`), so two players in one game cannot have different
temperaments and there is no per-game snapshot of the pick.

**Four nugget types, not interchangeable** `[ruled]`: `card` (throwable and earnable), `badge`
(earnable only), `rung` (throwable through its parent card), `rule` (board law, enforced by the
moderator at write time, neither throwable nor earnable). **Two id conventions, on purpose** `[ruled]`
(`BIZ-T260823-66`, amended by `BIZ-T260824-07`): an id already written into a shipped event payload
keeps `snake_case`, everything else including badges is `kebab-case`. The exception is the reason,
not the category.

**First release totals** `[ruled]`: 15 badges of 26, 4 rule cards of 11, 4 bosses of 9, 4
certificates. Fast-forward exists on levels 3 and 4 only; build the full level first and then scale
back, so the short path is a strict subset of the long one.

**The profile is personal and non-comparative** `[overturned Steve 2026-08-31]` (was
`BIZ-T260822-05`): this said no leaderboard, no opponent comparison, no win/loss record. Steve
overturned it and a leaderboard is in. What it ranks and what one player can see of another is
undesigned (`BRAIN-T260831-24`, `BRAIN-T260831-37`). Six stats, one of which is Cards Landed. It renders only
once the progression port lands, so it is downstream of 1.4, not parallel to it.

**Why four levels and not nine** `[ruled]`: evidence, not scope trimming. Nobody pays to build level
5 until somebody has played to level 4. This is a build order, not a ladder order, and level 4 is not
being renamed the last level.

---

## 4. What this repo does not contain

Verified against the clone. Do not assume any of this exists because a source says it does.

- **No progression layer at all.** No award engine, no scoring table, no projection of cards, badges,
  or points, no ledgers. It lives only in the retired backend, which is not in this repo. This is
  phase 1.4 plus phase 2 and it is the largest hole.
- **No scripted opponent.** Nothing generates a boss move. `app/gym/page.tsx` renders a level list
  whose Start buttons are all disabled at line 111 `[unratified]`.
- **No level unlock logic.** All four render open, and the page's comment says the unlock rules are
  unconfirmed `[unratified]`.
- **No `THROW_POINTS`, no `fastForward`, no per-level rules object.** The board wants a per-level rules
  object, not a scatter of per-level flags `[ruled]`.
- **No rungs.** `app/game/[gameId]/actions.ts:197` `[unratified]`.
- **No turn timers anywhere.** Every timer in the code is a UI-presentation delay, not a clock a
  player races: a 60ms feed debounce, toast auto-dismiss and its 180ms exit
  (`components/ui/alert-store.ts:32,82`), an 1800ms success-close on the feedback popover
  (`components/feedback/feedback-popover.tsx:36,62`), an 800ms onboarding-video loop delay
  (`components/onboarding-video.tsx:19,29-33`), and a 2000ms settle in `lib/feedback/submit.ts:47-51`
  `[unratified]`. `app/how-to-play/page.tsx:110` says the win condition is reached
  when someone concedes and not when a timer runs out `[unratified]`. Steve has ruled turn timers of
  30 seconds for the speaker and 45 seconds to summarize `[ruled]`, and there is no Gym timer by
  ruling.
  GAP: which surface do the 30-second and 45-second timers govern? They are not in the code, not in
  the Gym, and no source assigns them to a screen.
- **No levels 5 to 9.** Designed on paper and provisional; see section 5.
- **No third human.** The referee is the AI `[ruled]`; do not build a moderator seat.
- **No tokens** in Brain for now `[ruled]`. Generosity tokens are deferred.
- **The feedback form destination is unconfigured** by default, and CI runs build, typecheck, lint,
  and test against placeholder environment values with no deploy step `[unratified]`.

Already built, so do not file as missing: the event log and its type catalogue, the board projection,
the four card ids, the three signing-line ids, the topic list, the rule-card display popup, the
Steel Man reading, Steel Man tile, and definition action paths, and the client realtime transport.
That last one is live: `components/board/use-game-feed.ts:44-56` opens a Supabase Realtime channel
on `postgres_changes` INSERT against `game_events`, filtered to the game, and is consumed by
`components/board/live-board.tsx:58,1677` and `components/board/game-setup.tsx:18,122`. Writes still
go through server actions, and the subscription triggers a refetch rather than carrying state
`[unratified]`. `tech-spec.md` section 3 is the normative account.

---

## 5. Explicitly deferred

Deferred by scheduling, not closed by ruling. The difference matters if something gets promoted.

- **Levels 6 to 9 in full** [ruled Steve 2026-08-31]. 6, evaluating evidence: ✅ Fact Check, 🎓 Who Would Know?, and the
  anecdotal-data card, renamed Show Me the Rest (`BIZ-T260824-21`). 7, one idea at a time:
  ✂️ Divide and Conquer plus three badges. 8, unearth hidden assumptions: 🧊 What Else Has To Be True?
  in the co-premise triangle notation, the first level that descends into a sub-thread and has to come
  back up. 9, causality is complicated: 🔗 Causality is Complicated, the one card the evaluator cannot
  check on its own.
- **🎭 Steel Man, Not Straw Man**, deferred to level 5 entirely `[ruled]`, even though three of its
  action paths are already wired in this repo.
- **↕️ Importance ranking**, deferred behind the single-tile relocation version `[ruled]`, and
  deferred past level 4 with the exact level left open `[ruled Steve 2026-08-31]`. The old "level 5"
  here was shorthand for "not in the first four," never a considered placement. The **third thread
  per side** travels with it wherever it lands `[ruled]`; two per side through level 4.
- **The revise-topic-together win condition** `[ruled]`. It scores as a team award and should be the
  largest award on its level, being a win condition rather than a move.
  GAP: the exact point value of the revise-topic win, and the tile affordance, which has never been
  written down anywhere.
- **Communal points**, arriving at level 5 `[ruled]` (`BIZ-T260819-17`). Personal through level 4.
- **Generosity tokens**, **certificates on the profile** (`BRAIN-T260816-15`), and **re-opening a
  finished game** (`BRAIN-T260816-14`), all `[ruled]`.
- **Typed tiles** (definitions, claims, facts, values). Wishlist, with an unestimated blast radius
  reaching stored games, the action payloads, and the evaluator's input contract.
- **Streaks**, which the account page displays but the data model does not support.

---

## 6. Provisional, so do not build a dependency on it

- **Every points value.** Provisional by construction and by instruction; keep the whole table in one
  module so it is a one-file change.
- **Levels 6 to 9 as designed** [ruled Steve 2026-08-31]. One row per card, not broken into rungs, and their open questions
  stay open.
- **The skill wording for levels 1 to 4**, whose source is a draft awaiting Steve.
- **The emoji vocabulary above level 1.** Level 1 ships with 👍 and 👀 only; the wider vocabulary is
  an open question.
- **The live-play thread bounds**: four minimum, six ceiling, every thread must resolve `[ruled]`.
  Brain is asked to confirm the ceiling against the code; the ceiling opens at level 5.
- **The event log's physical home**, an open engineering call: inline on the game record or its own
  table. This repo answers it with its own table `[unratified]`, which does not make the call ruled.
- **Boss roster coverage.** Skin tones are deliberately uncorrelated with name origin `[ruled]`. No
  Indigenous, Native American, or First Nations character exists in the roster: recorded as a gap, not
  resolved. Parked names for 5 to 9 [ruled Steve 2026-08-31]: Kranky Karl, Twisty Thibault, Cagey Chandni, Hasty Hakeem, Bao.

---

## 7. Contradictions, resolved

The one that keeps getting re-opened: a registry row places 📏 No Exaggeration at level 4
(`BRAIN-T260815-09`). **That row is wrong and the gym implementation guide wins, being newer and
active: No Exaggeration is level 3 with Braggy Brenda, and level 4 is 💬 Help Me Understand with
Sloppy Salma** `[ruled]`. Do not re-litigate it.

The level 3 boss is **Braggy Brenda**, replacing Braggy Bogdan `[ruled]` (`BIZ-T260823-70`). Any
source naming Bogdan at level 3 predates the ruling.

---

## 8. Known stale references

**This repo's own `README.md` and `CLAUDE.md` are stale about the Gym.** Both say the scripted practice
opponent was taken off the critical path by a 2026-08-17 scope ruling, and `app/gym/page.tsx` repeats
it in a comment. That is no longer true. The dev roadmap's last six open questions were answered by
Steve on 2026-08-19, after that ruling, and Steve put the Gym levels 1 to 4 back on the critical path
on 2026-08-28. Read those three comments as history, not as scope.

Two other stale claims circulate in the older sources. **Boss assignments:** Kranky Karl at level 2,
Sloppy Salma at level 3, and Twisty Thibault at level 4 are all pre-ruling; the live assignment is the
table in section 3, and Karl's old row encodes the opposite rule, so it needs rewriting rather than
renaming if he is ever used. **Card count:** the first release ships 4 rule cards of 11, not 5; the
older figure counted 📖 Define That as a card before it was demoted to a rung.
