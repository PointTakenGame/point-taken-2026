---
tid: BRAIN-T260822-05
type: spec
thread: new-stack-migration
status: active
owner: claude (brain), pending Steve review on the open questions in §7
governs: web/point-taken-2026/supabase/migrations/0002_event_type_catalogue.sql
created: 2026-08-22
must_read_full: true
---

# The event type catalogue

> This file is a registry-backed durable artifact. It exists only because a row
> in the project's todos.csv points at it (source_doc). If you are reading a copy
> with no such row, it is an orphan: file a needs-triage row or delete it.

## Purpose

`docs/reference/materials/spec/2026-08-19_event-log-contract.md` set the rules for the log and left
one hole, its own gap 1: *"the event type catalogue does not exist yet. `tile_confirmed`, `gym_move`
and friends are placeholders used in verification, not a designed vocabulary."* Everything the
platform will ever compute (board state, history, cards, badges, points, the leaderboard, Corey's
study exports) reads this vocabulary. It is append-only with no cleanup path, so a name written in
anger is permanent and a payload field that turns out to mean two things can never be tidied away.
That makes the catalogue the cheapest thing to get right now and the most expensive thing to fix
later.

This file names every event type the game writes, fixes each payload at `schema_version` 1, and
states what deliberately never becomes an event. `0002_event_type_catalogue.sql` is the enforcement:
it puts this list in a table, points a foreign key at it, and refuses an insert of anything not
listed. Where the two disagree, the SQL is what runs and one of them is a bug.

## Scope and non-goals

In scope:

- The type names and the naming rule that generates them.
- The envelope: which fields are columns on every row rather than payload keys, and why.
- Each type's version-1 payload fields, with types and requiredness.
- Per-type payload byte limits under the 16 KB hard cap decided in the contract's gap 6.
- The four categories of thing that are deliberately *not* events.
- The mapping from the old `GameActionType` vocabulary, so the port has no guesswork.

Out of scope:

- Field-level validation (that a tile's text is at most 100 characters, that `role` is one of two
  strings). SQL enforces byte size and type existence; the shared rules package enforces meaning,
  and it does not exist yet. See §7.
- RLS read policies. They wait on a games table, per the contract's §6.
- Projections, badge criteria, and the point table. They are readers of this vocabulary and change
  independently of it, which is the entire point of versioning per type.
- Account-level events (sign-up, coach preference changes, account deletion). `game_events.game_id`
  is `not null`; account history, if it ever needs a log, is a separate table. See §7.

## Design

### 1. Naming

`lower_snake_case`, `<noun>_<past participle>`, ASCII only, no prefixes or namespaces. An event
records something that already happened, so `tile_placed`, never `place_tile` and never
`tile_place`. The old codebase used `SCREAMING_SNAKE` verbs (`PLACE_TILE`); those do not carry over,
because the old strings named socket commands (requests) and these name facts.

Types are never renamed. Retiring one means no longer writing it, and setting `retired = true` in
the catalogue table so the next write is refused loudly instead of quietly reviving a dead
vocabulary.

### 2. The envelope

Migration 0002 adds two columns to `game_events`. Both were payload candidates and both are wrong
as payload keys.

| column | values | why a column |
|---|---|---|
| `actor_role` | `plus`, `minus`, `server` | Which side of the board acted. Every projection filters on it, and `actor_id` alone cannot answer it: there is no games table naming who plays which side, so deriving it means replaying `role_selected` first. It is non-null on every row, which is what columns are for. |
| `source` | `human`, `coach`, `system` | Who or what produced the act. This is the field that lets a badge distinguish *the player reached for the stronger reading* from *the coach walked them into it*, and it is the field the old `GameEvent.source` existed for. A badge criterion that has to unpack JSON to ask the question will eventually forget to ask it. |

The two are independent. A coach playing the minus side writes `actor_role = 'minus'`,
`source = 'coach'`, `actor_id = null`. Server-generated facts write `actor_role = 'server'`,
`source = 'system'`. There is no constraint tying `actor_id` to either: a system event caused by a
player's move is a real and common case.

The table is empty (0 rows, verified 2026-08-22), so adding two `not null` columns without defaults
costs nothing today and would cost a backfill decision in a week.

Both append functions change signature to take them. `append_game_event` gains `p_actor_role` and
`p_source` as required arguments before the defaulted ones; `append_game_events` reads
`actor_role` and `source` off each array element. The old signatures are dropped, not overloaded,
so nothing can call the version that omits them.

### 3. What is never an event

Four categories, each a rule rather than an omission.

**3.1 No award is ever an event.** Not a card unlocked, not a badge earned, not a point scored, not
a level reached, not a boss defeated. All of them are projections computed from the log by criteria
that are meant to be retuned. The contract's whole promise, *"retune criteria without invalidating
earned badges"*, is only true if the award is derived. The moment `badge_earned` is a row in an
append-only log, the criterion that produced it is frozen forever.

**3.2 No ephemeral UI state is ever an event.** Typing indicators, draft tiles placed but not
committed, presence flicker, the emoji-resolution panel opening and closing, hover, scroll. The old
socket layer broadcast nine such events (`typingTile`, `emojiResolutionOpened`,
`emojiResolutionTyping`, `emojiResolutionClosed`, and friends); they stay broadcasts and are never
appended. Retention makes this stricter, not looser: under the 2026-08-22 retain-everything ruling a
keystroke log would be permanent, and nothing downstream reads one. The research signal people worry
about losing here is preserved anyway, because AI feedback fires after commit and the player's
response to it is `tile_edited` or `tile_revised`, both of which are logged.

**3.3 No derivable value is duplicated into a payload.** `game_ended` does not carry tiles placed,
threads resolved, cards thrown, or duration; every one is a count over the log or a subtraction of
two `created_at` values, and a stored copy that disagrees with the log is a bug with no fix path.
The old `END_GAME` payload carried all of them. One exception is deliberate and named:
`gym_run_recorded.event_count` is the *validator's* count, not the log's, and a disagreement between
the two is precisely the signal it exists to raise.

**3.4 No per-account preference is a game event.** Compact display, coach temperament, and
notification opt-out are account settings. Where one affects the game as played, it is captured once
in `game_started` (the coach in play), not repeated per move.

### 4. Propose and approve is one primitive

The 2026-08-16 roadmap's third finding was that four mechanics are the same mechanic: revise the
topic together, relocate a tile, hand back a reading of the other player's tile, and the Steel Man
rungs. Rather than a dozen bespoke types, there are three, parameterised by `kind`:

`proposal_made` → then either `proposal_accepted` or `proposal_rejected`.

The rule for effects: **acceptance is recorded, and the board change is its own event naming the
proposal.** Accepting a topic revision appends `proposal_accepted` and then `topic_revised` with
`via_proposal_id` set. Accepting a relocation appends `proposal_accepted` and then `tile_relocated`.
A proposal with no board effect (a reading handback: the author agrees the reading is fair, and
nothing moves) is complete at `proposal_accepted`.

This costs one extra row per accepted proposal and buys two things. A projection rebuilding board
state reads only effect events and never has to interpret a proposal's `content` blob. And a badge
criterion reads only proposals and never has to reverse-engineer intent from a board change.

Adding a fifth mechanic to the primitive later is a new `kind` value, which is a compatible change
that bumps nothing.

### 5. The catalogue

Sizes are the per-type ceiling enforced by trigger. The absolute cap is 16 KB
(`octet_length(payload::text)`), a table check no per-type value may exceed.

All types are `schema_version` 1. `uuid`, `text`, `integer`, `boolean` and `object` mean the JSON
forms. "req" means the key must be present; a field documented as `X or null` is required to be
present and permitted to be null, which is different from optional.

#### Lifecycle

**`game_created`** — 1 KB. The room comes into being. Always `seq = 1`, enforced by trigger: every
game's first event states its mode, so no replay can be ambiguous about what kind of game it is
reading.
- `mode` text, req: `gym` or `live`
- `level_id` text or null, req: the gym level; null in live
- `boss_id` text or null, req: null unless this is a boss game
- `join_code` text or null, req: the short code a partner types; null for solo gym runs
- `client_build` text, optional

**`player_joined`** — 512 B.
- `display_name` text, req

**`role_selected`** — 256 B. Roles may be reselected freely before `game_started`; the last one wins.
- `role` text, req: `plus` or `minus`

**`agreement_signed`** — 512 B. One event per player.
- `items` array of text, req: the agreement items this player signed. The ritual is three lines,
  ids `mutual_respect`, `honest_thinking`, `shared_facts` (`lib/board/setup.ts:32-34`), settled by
  BRAIN-T260816-18. The printed game's fourth line, `same_team`, is not in the shipped set. Because
  the payload carries what was actually signed, changing the set changes data and not the version.

**`topic_set`** — 1 KB.
- `text` text, req: the topic statement as shown to players
- `origin` text, req: `library` or `custom`
- `topic_id` text or null, req: the library topic's id when `origin = library`

**`game_started`** — 2 KB. Play begins: both players present, topic set, agreement signed, card set
fixed. The roster is not in the payload, because `actor_role` on `role_selected` already carries it.
- `card_set` object, req: `{ policy: 'intersection' | 'raised', card_ids: [text], raised_by: uuid or null }`
- `coach` object or null, req: `{ coach_id: text, temperament: text }`, null when no coach is in play

**`player_left`** — 256 B. Appended only after the presence layer's debounce, so a flaky connection
does not fill the log (§7.4).
- `reason` text, req: `disconnect` or `quit`

**`game_ended`** — 256 B. No counters, no duration: §3.3.
- `win_condition` text, req: `threads_resolved`, `topic_agreed`, `abandoned`, or `timeout`

#### Tiles

**`tile_placed`** — 1 KB. A tile committed to the board, text included. Draft placement and typing
are not logged (§3.2).
- `tile_id` uuid, req
- `parent_tile_id` uuid or null, req: null when this tile starts a thread
- `thread_root_id` uuid, req: equals `tile_id` when this tile is the root
- `side` text, req: `plus` or `minus`. Distinct from `actor_role` on purpose: the 🎭3 rung lets you
  add a tile to the other player's side.
- `text` text, req: at most 100 characters (§7.1)
- `is_opening_reason` boolean, optional: true for the two starting reasons each player writes at setup
- `via_proposal_id` uuid, optional: present when an accepted proposal produced this tile

**`tile_edited`** — 1 KB. The author revises their own wording, unprompted. Previous text is already
in the log; it is not repeated.
- `tile_id` uuid, req
- `text` text, req

**`tile_revised`** — 1 KB. The answer to a thrown card. Separate from `tile_edited` because this one
scores and that one does not.
- `tile_id` uuid, req
- `text` text, req
- `in_response_to_seq` integer, req: the `seq` of the `card_thrown` this answers

**`tile_relocated`** — 512 B. The grab-handle and magnet gesture. Only the destination is recorded;
the origin is the previous state in the log.
- `tile_id` uuid, req
- `new_parent_tile_id` uuid or null, req
- `new_thread_root_id` uuid, req
- `new_side` text, req: `plus` or `minus`
- `via_proposal_id` uuid, optional

**`tile_removed`** — 256 B.
- `tile_id` uuid, req

#### Threads and resolution

**`resolution_emoji_placed`** — 256 B. Emoji land on thread roots only, per the level build table.
- `thread_root_id` uuid, req
- `emoji` text, req: the vocabulary is unsettled (§7.2). The payload holds a string either way, so
  settling it changes the allowed value set in the rules package and does not bump this version.

**`resolution_emoji_removed`** — 256 B.
- `thread_root_id` uuid, req

**`thread_resolved`** — 1 KB. Server-written after both players confirm. `source = system`.
- `thread_root_id` uuid, req
- `emoji` text, req
- `note` text or null, req: the statement the two agreed on in the handshake

#### Propose and approve

**`proposal_made`** — 4 KB.
- `proposal_id` uuid, req
- `kind` text, req: `topic_revision`, `tile_relocation`, `reading_handback`, `steelman_reading`,
  `steelman_tile`, or `definition`
- `target_tile_id` uuid or null, req
- `target_thread_root_id` uuid or null, req
- `content` object, req: shaped by `kind`, below
- `prompted_by_seq` integer, optional: the `card_thrown` that prompted this

`content` by kind:

| kind | content | mechanic |
|---|---|---|
| `topic_revision` | `{ text }` | catching the snitch |
| `tile_relocation` | `{ new_parent_tile_id, new_thread_root_id, new_side }` | 🎯3 (who may move it is open, §7.5) |
| `reading_handback` | `{ text }` | Help Me Understand: their tile in your words |
| `steelman_reading` | `{ text }` | 🎭2, no correctness check, acceptance is the judgment |
| `steelman_tile` | `{ text, parent_tile_id, side }` | 🎭3, a tile offered to their side |
| `definition` | `{ term, text }` | 💬2 Define That |

**`proposal_accepted`** — 256 B.
- `proposal_id` uuid, req

**`proposal_rejected`** — 512 B. A rejection teaches and does not score.
- `proposal_id` uuid, req
- `reason` text or null, req

**`topic_revised`** — 1 KB. The effect of an accepted `topic_revision`. When this ends the game,
`game_ended` with `topic_agreed` follows.
- `text` text, req
- `via_proposal_id` uuid, req

#### Cards

**`card_thrown`** — 512 B.
- `card_id` text, req: the roster id, e.g. `you_is_taboo`
- `rung_id` text or null, req: the rung being exercised, when the throw is a rung rather than a card.
  The id strings come from the rung and badge table, not from here (§7.6).
- `target_tile_id` uuid, req

Whether a throw was *correct* is not recorded. It is read at scoring time from what followed: a
`tile_revised` answering it, or a `card_throw_declined`. Storing a verdict would freeze a judgment
the rules package is supposed to be able to retune, which is §3.1 wearing a different hat.

**`card_throw_declined`** — 512 B.
- `in_response_to_seq` integer, req
- `reason` text or null, req

**`generosity_token_given`** — 256 B. The 💵 token from the printed game.
- `to_role` text, req: `plus` or `minus`
- `target_tile_id` uuid, optional

#### AI and coach

**`ai_feedback_returned`** — 16 KB. The largest realistic event, and the reason the cap is 16 KB.
`source = system`, `actor_role = server`.
- `tile_id` uuid, req
- `error_types` array of text, req: may be empty
- `feedback` text or null, req
- `suggestion` text or null, req
- `model_name` text, req
- `prompt_versions` object, req
- `evaluator_schema_version` text, req: the AI pipeline's own output-schema version, from
  `agent/AI_OUTPUT_SCHEMA.md`. Named differently from the row's `schema_version` on purpose; the two
  version different things and confusing them would be expensive.
- `pipeline_mode` text or null, optional
- `first_wave_categories` array of text, optional
- `suggestion_source` text, optional
- `suggestion_confidence` number, optional
- `suggestion_preserves_stance` boolean, optional
- `latency_ms` integer, optional

**`ai_feedback_shown`** — 256 B. Feedback generated and feedback displayed are different facts, and
the gap between them is what Corey's display policy turns on. Append-only forbids a mutable `shown`
flag anyway, so it is a second event.
- `in_response_to_seq` integer, req

**`coach_nudge_delivered`** — 2 KB. `source = coach`.
- `nudge_kind` text, req
- `text` text or null, req
- `target_tile_id` uuid, optional
- `card_id` text, optional

The coach's own board moves are not a distinct type. A coach placing a tile writes `tile_placed`
with `source = coach`, which is exactly what the source column is for.

#### Gym

**`gym_run_recorded`** — 1 KB. Written by the server as the last event of a validated batch. Client
clocks are claims and are labelled as such.
- `rules_package_version` text, req
- `client_build` text, req
- `event_count` integer, req: the validator's count (the one duplication §3.3 allows)
- `client_started_at` text or null, req: ISO 8601, client clock
- `client_ended_at` text or null, req: ISO 8601, client clock

#### Retention

**`content_redacted`** — 1 KB. The deletion event the 2026-08-22 retain-everything ruling requires.
The raw log keeps the original; every player-visible view and every export must apply redactions
before rendering. A reader that renders raw payload text without checking for redactions is a bug.
- `target_seq` integer, req: the `seq` of the event being redacted, same game
- `target_path` text, req: dotted path into that event's payload, e.g. `text`
- `reason` text, req: `author_request`, `moderation`, or `legal`
- `requested_by` uuid or null, req

### 6. The old vocabulary, mapped

Everything the old stack writes today, and where it lands. Sources: `src/models/Game.ts`
(`GameActionType`), `src/sockets/game.ts`, `src/sockets/lobby.ts`, `src/progression/finishGame.ts`.

| old | new |
|---|---|
| `PLACE_TILE` + `CONFIRM_TILE` | `tile_placed` (one event; the draft is not logged) |
| `REMOVE_TILE` | `tile_removed` |
| `EDIT_TILE` | `tile_edited` |
| `REVISE_TILE` | `tile_revised` |
| `PLACE_EMOJI` | `resolution_emoji_placed` |
| `UNDO_PLACE_EMOJI` | `resolution_emoji_removed` |
| `RESOLVE_THREAD` | `thread_resolved` |
| `REVISE_TOPIC_PROPOSAL` | `proposal_made` with `kind = topic_revision` |
| `REJECT_TOPIC_PROPOSAL` | `proposal_rejected` |
| `REVISE_TOPIC` | `proposal_accepted` then `topic_revised` |
| `PLACE_RULE_CARD` (commented out at `game.ts:840`, but present in production data) | `card_thrown` |
| `AI_FEEDBACK` | `ai_feedback_returned`, plus the new `ai_feedback_shown` |
| `END_GAME` | `game_ended`, without the counters |
| lobby `choosingTopic` | `topic_set` |
| lobby `selectRole` | `role_selected` |
| lobby `acknowledgeAgreement` | `agreement_signed` |
| lobby `startGame` / `startAiGame` | `game_created` then `game_started` |
| lobby `disconnect` | `player_left` |
| `typingTile`, `emojiResolutionOpened` / `Typing` / `Closed` | nothing: §3.2 |

New with no old equivalent: `tile_relocated`, the three proposal types, `card_throw_declined`,
`generosity_token_given`, `coach_nudge_delivered`, `ai_feedback_shown`, `gym_run_recorded`,
`content_redacted`.

Named in the design and deliberately **not** specified here, because their payloads would be
invention rather than derivation. Each is a compatible addition when its mechanic is built:
tile splitting (✂️ Divide and Conquer, level 6), boss habit retirement, thread reordering by
importance (level 4), fact-check retrieval results (level 5, needs a retrieval step the agent does
not have), co-premise notation, character cards, and the 60-second chat timer from the printed game.

### 7. Two reconciliations this catalogue forces

**Mode taxonomy.** The old `Game.mode` is `live | practice | solo`. `game_created.mode` is `gym` or
`live` only, with `level_id` and `boss_id` as separate fields. A solo gym run is `mode = gym` with
`join_code = null`. This settles `BRAIN-T260819-08` in the new schema rather than porting the old
three-way string, which conflated "who is playing" with "what kind of session".

**Where `source` lives.** The old `GameEvent.source` (`human | coach | system`) had no home in
`0001`'s table. It is now a column, not a payload key, for the reason in §2. This closes the gap the
port would otherwise have hit on its first badge criterion.

## Acceptance criteria (TYPED)

### Machine-checkable

- [x] `0002_event_type_catalogue.sql` applies cleanly against `tvtmltchotkzviqaywdy` and
      `select count(*) from public.game_event_types` returns 28.
- [x] Every type named in §5 has exactly one row in `game_event_types` at `schema_version = 1`, and
      no row exists that is not named in §5 (set comparison, both directions).
- [x] An insert naming a type not in the catalogue is refused (foreign key violation).
- [x] An insert of a retired type is refused by trigger, while existing rows of that type still read.
- [x] An insert whose `octet_length(payload::text)` exceeds that type's `payload_max_bytes` is
      refused; one at exactly the limit succeeds.
- [x] An insert whose payload exceeds 16384 bytes is refused by the table check regardless of type.
- [x] An insert at `seq = 1` whose type is not `game_created` is refused.
- [x] `append_game_event` and `append_game_events` both require `actor_role` and `source`, and the
      pre-0002 signatures no longer exist (`pg_get_functiondef` finds one definition each).
- [x] `anon` carrying only the publishable key is refused on both functions and on both tables
      (the PUBLIC-grant trap from the contract's §6, re-verified after the signature change).
- [x] `UPDATE` and `DELETE` still raise on `game_events` for the owning role.
- [x] The table is left empty after verification.

### Judgment-rubric

- [ ] Reviewer: Steve. Good looks like: the type list reads as the game he designed, with no name
      that makes him ask "what is that", and nothing missing that a player does at the table.
- [ ] Reviewer: Steve. Good looks like: §3.1 (no award is ever an event) is a rule he is willing to
      be held to, since it is what makes badge criteria retunable and it means a criterion change
      can in principle take a card away.
- [ ] Reviewer: Brain, at first projection. Good looks like: building the board-state projection
      requires no field that is missing here and reads no field it has to guess the meaning of.

## Constraints and rejected alternatives

- Constraint: append-only with no cleanup path. Every name and every field here is permanent.
- Constraint: `schema_version` is per type. Nothing in this file is a global version.
- Constraint: text lives inline in the payload (retain-everything, 2026-08-22). No reader may assume
  text is re-fetchable from a mutable table.
- Constraint: 16 KB hard cap on `octet_length(payload::text)`, per the contract's gap 6.
- Rejected: keeping `actor_role` and `source` in the payload. Both are non-null on every row and
  both are filtered by nearly every reader; JSON extraction in every badge criterion is how a
  criterion ends up silently not asking.
- Rejected: a bespoke event type per propose-and-approve mechanic (`topic_revision_proposed`,
  `relocation_proposed`, `reading_offered`, and so on). Six near-identical types with six
  near-identical accept and reject partners, where one parameterised trio does the same work and a
  seventh mechanic is a new `kind` rather than three new types.
- Rejected: recording `badge_earned`, `card_awarded`, `points_scored`, `level_reached`. These freeze
  the criterion that produced them and break the contract's central promise (§3.1).
- Rejected: logging draft tiles and typing. Permanent under retention, unread downstream, and the
  research signal survives without it because feedback fires post-commit (§3.2).
- Rejected: storing a correctness verdict on `card_thrown`. Same freezing problem; correctness is
  read from what followed the throw.
- Rejected: `pg_jsonschema` per-type payload validation in SQL. Supabase ships the extension, and it
  would enforce field names rather than only byte size, but it doubles the maintenance surface
  against the TypeScript types and each schema change becomes a migration. The rules package is the
  right home; revisit if payload drift actually happens.
- Rejected: repeating `mode` on every event so type sweeps can filter gym from live without a join.
  A denormalised field that can disagree with `game_created` in an append-only log has no fix path;
  the join belongs in a projection column instead.
- Rejected: numbering the batch's `gym_run_recorded` attestation first. Validation completes before
  the append, so it is written last, and `seq = 1` stays reserved for `game_created`.

## Open questions (UNRESOLVED)

1. **Tile text length is enforced only in the client** (`Tile.vue:189`, 100 characters). The 1 KB
   per-type byte cap is a backstop, not the rule. `UNKNOWN, resolve by`: the shared rules package
   landing. Owner: Brain.
2. **The resolution emoji vocabulary.** Three sources disagree: the printed game has 👍 thumbs-up
   and 👀 spot-it, the frontend's `Tile.emoji` allows `thumbs-up | shared-facts | wine | scale`
   (wine and scale being dead holdovers from a fact/priorities/taste scheme), and the 2026-08-17
   progression model counts `resolutionsByType` across fact, priorities, and taste.
   `UNRESOLVED: the allowed value set for resolution_emoji_placed.emoji`. Not blocking: the payload
   is a string and settling it does not bump the version. Owner: Steve.
3. **SETTLED (BRAIN-T260816-18): three signing lines**, ids `mutual_respect`, `honest_thinking`,
   `shared_facts`, shipped in `lib/board/setup.ts:32-34`. It is a ritual, not a consent checkbox,
   which is why the Figma frame's fourth radio line and the printed game's `same_team` are both out.
   The badge list agreed already (✍️1 Mutual Respect, ✍️2 Honest Thinking, ✍️3 Shared Facts, no Same
   Team badge). Never blocking: `items` is an array, so the set can change without a version bump.
4. **Presence debounce threshold** before `player_left` is appended. Picking a number here would be
   fabricated precision. `UNKNOWN, resolve by`: the presence layer being built. Owner: Brain.
5. **Who may relocate a tile** (the author, the thrower, or a moderator) is open from the 2026-08-04
   rule-card audit. The catalogue carries both paths: an unprompted move is `tile_relocated`, and a
   move that has to be agreed is a proposal whose acceptance produces the same event with
   `via_proposal_id`. `UNRESOLVED: which path 🎯3 uses`. Owner: Steve.
6. **Rung id strings** (`rung_id` on `card_thrown`). The rungs are written as emoji plus a numeral
   (🎯2, 💬1, 🎭3) and no ASCII id scheme exists yet. `UNKNOWN, resolve by`: the rung and badge
   table being written. Owner: Brain.
7. **Cards can in principle be un-earned.** §3.1 makes card ownership a projection, so a criterion
   change plus a rebuild can take away a card a player already has. For badges that is fine and
   intended; for cards, which change what you may do in a live game, it is a real product problem.
   The cheap mitigation is a policy that card criteria may only ever loosen, enforced by review
   rather than by schema. `UNRESOLVED: whether that policy is enough`. Owner: Steve.
8. **Account-scoped events have no home.** `game_id` is `not null`, so sign-up, coach preference
   changes, and account deletion cannot be logged here. Account deletion in particular collides with
   the retention ruling and the IRB data-privacy language, which is already tracked as
   `BRAIN-T260822-04`. `UNRESOLVED: whether a second log exists at all`. Owner: Steve and the PI.

## Verified

Against project `tvtmltchotkzviqaywdy` (Postgres 17.6) on 2026-08-22, every machine-checkable
criterion above. The whole run lived inside one `DO` block that ended by raising, so all test rows
rolled back: the log has no delete path, and verification must not be the thing that puts the first
permanent junk row in it.

- Catalogue holds 28 rows, all at `schema_version = 1`, set-equal to §5 in both directions.
- Single and batch appends both succeed carrying `actor_role` and `source`; the batch reads them
  off each array element. Numbering stayed contiguous (4 rows, max seq 4).
- Refused, each with the intended SQLSTATE: unknown type `23001`, non-`game_created` at `seq = 1`
  `23001`, a second `game_created` later in a game `23001`, a retired type `23001` (while that
  type's existing rows still read), payload one byte over the per-type limit `54000`, payload one
  byte over the 16384 hard cap `54000` even for the type allowed the full cap,
  `actor_role = 'observer'` `23514`, `source = 'robot'` `23514`, `UPDATE` `23001`, `DELETE` `23001`.
- Accepted at exactly the limit: a 1024-byte `tile_placed` payload and a 16384-byte
  `ai_feedback_returned` payload.
- One definition each of `append_game_event` and `append_game_events`; no pre-0002 signature
  survives.
- The PUBLIC-grant trap re-checked after the signature change, by privilege and then over HTTP.
  `has_function_privilege` false for `anon` and `authenticated` on both functions, true for
  `service_role`; `has_table_privilege` false for `anon` on both tables. A live request carrying
  only the publishable key got 401 on both RPCs and both table reads (`42501`, permission denied
  for function `append_game_event`).
- `select count(*) from public.game_events` is 0 and no catalogue row is left retired.

## Change history

- 2026-08-22: created, closing gap 1 of `BRAIN-T260819-18` (the event log contract). Carries that
  spec's two 2026-08-22 rulings: retain everything (hence `content_redacted` and inline text) and
  the 16 KB payload cap (hence the per-type limits here).
- 2026-08-22: migration `0002_event_type_catalogue.sql` applied and verified against
  `tvtmltchotkzviqaywdy`; see the Verified section. The judgment-rubric criteria are still open and
  wait on Steve.
