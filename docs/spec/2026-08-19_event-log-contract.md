---
tid: BRAIN-T260819-18
type: spec
thread: new-stack-migration
status: open
author: claude (brain)
date: 2026-08-19
enforced_by: web/point-taken-2026/supabase/migrations/0001_event_log.sql
---

# The game event log: a versioned public contract

Fable's architecture crit made one demand ahead of every other:

> treat the event log as a versioned public contract, and write that down before any code

with the reason attached: *"retune criteria without invalidating earned badges" is only true if old
events stay interpretable forever.* That is the whole argument for this document. A badge criterion
we write in November has to be able to read a game recorded in August and reach a defensible
answer, or every criterion change is a choice between breaking history and never improving.

This file is the contract. `0001_event_log.sql` is the enforcement. Where they disagree, the SQL
is what actually runs, and one of the two is a bug.

## 1. The row

Every event is one row in `public.game_events`:

| column | meaning |
|---|---|
| `id` | global cursor for rebuilds. Meaningless *between* games; never read it as ordering. |
| `game_id` | which game |
| `seq` | **the ordering authority.** Per game, starts at 1, no gaps. |
| `type` | what happened. A stable string, never renamed. |
| `schema_version` | the version of *this type's* payload. Not a version of the log. |
| `actor_id` | who caused it, or null for server-generated events |
| `payload` | JSONB, everything type-specific |
| `created_at` | server time, always |

`(game_id, seq)` is unique, which is the line that lets realtime be dumb pub/sub. Postgres decides
who moved first, not an in-memory room object on one server. That is the single most load-bearing
constraint in the system and the reason the old socket-server authority is not being ported.

## 2. Append-only, and what that costs

`UPDATE` and `DELETE` raise, via triggers rather than via permissions, so the prohibition survives
the secret key. A log that whoever holds admin can quietly edit is not a log.

The cost is real and worth stating up front: **there is no cleanup path.** A bad event is corrected
by appending a corrective event, never by fixing the row. Test data cannot be tidied away; it is
removed by dropping the table. Plan accordingly before writing to production.

## 3. Versioning, which is the actual contract

**`schema_version` is per event type.** Adding a required field to `tile_confirmed` bumps
`tile_confirmed` from 1 to 2 and touches no other type. There is no global log version, because a
global version would make every reader care about every change.

**Writers may only ever add.** Within one version of one type, a payload field never changes
meaning, never changes type, and is never removed. If you need any of those, that is a new version.

**Readers declare what they understand.** Every projection and every badge criterion states the
`(type, version)` pairs it handles. On anything else it *skips and records that it skipped*. It
does not guess, and it does not crash. A criterion that crashes on an old event is a criterion that
cannot be deployed until history is rewritten, which is the exact trap this design exists to avoid.

**Types are retired by no longer writing them, never by renaming or deleting.** Recorded history
means what the type said at the time it was written.

Compatible, no version bump: adding an optional payload field; adding a new event type; adding an
index; adding a projection.

Breaking, bump the version: a new required field; a field changing type or units; a field changing
meaning while keeping its name (the most dangerous of the three, because nothing fails loudly).

## 4. Projections are disposable

Every derived table (profiles, counters, card and certificate holdings, leaderboards) is a cache of
the log and can be dropped and rebuilt from it. Nothing is *only* in a projection. This is what
makes retuning safe: change the criterion, rebuild, and the answer is what the new rule says about
the real history.

Consequence for anyone tempted otherwise: never write a value into a projection that cannot be
recomputed from events. The moment one exists, the rebuild is lossy and the whole property is gone.

## 5. The two append paths

`append_game_event(...)` is one event, for live play.

`append_game_events(game_id, jsonb_array)` is a whole batch, for gym runs, which are
client-authoritative by Steve's decision. Fable was explicit that this cannot be added later:
*"a client-authoritative gym wants events designed for batch upload and replay validation, and
retrofitting that is a rewrite."* Hence both paths in the first migration.

Both take a per-game advisory lock before numbering, so simultaneous moves serialize instead of
colliding on the unique constraint. Two different games never contend.

**Validation is the caller's job and happens before the call.** The batch function numbers and
stores; it does not judge. A gym run is replayed through the shared rules package first, and only a
legal run is appended. A determined player forging a gym log is an accepted cost for personal
badges in a free game; an *unvalidated* log reaching the table is not.

## 6. Access, today

RLS is on with no policies, which means deny-all for `anon` and `authenticated`. Writes go through
server-side code holding the secret key. This is a decision, not an unfinished edge: player-scoped
policies need a games table naming who is in a game, that table is not designed yet, and a
permissive placeholder policy written now is how a log ends up world-readable later.

Realtime respects RLS, so clients cannot subscribe to this table until those policies land either.
Until then, broadcast is server-side.

One trap, recorded because it already bit once: Postgres grants `EXECUTE` on new functions to
`PUBLIC`, and `anon` inherits from `PUBLIC`. Revoking from `anon` by name does nothing. The first
version of `0001` did exactly that, and a request carrying only the publishable key appended a
forged event with HTTP 200. Revoke from `PUBLIC`, then grant back to the one role that should have
it, by name.

## 7. Gaps, stated rather than invented

These are open. None is fabricated below as if decided.

1. ~~**The event type catalogue does not exist yet.**~~ **CLOSED 2026-08-22.** The catalogue is
   `docs/reference/materials/spec/2026-08-22_event-type-catalogue.md` (`BRAIN-T260822-05`), 28 types
   at `schema_version = 1` with payload fields and a per-type byte ceiling each, enforced by
   `supabase/migrations/0002_event_type_catalogue.sql`: a `game_event_types` table, a foreign key
   from `game_events`, and a validation trigger. `tile_confirmed` and `gym_move` were verification
   placeholders and are not in the catalogue, so they are now refused. Both append functions gained
   required `actor_role` and `source` arguments, which the catalogue promotes out of the payload;
   the pre-0002 signatures were dropped rather than overloaded. Eight open questions in that spec's
   §7 remain, none of them blocking the port.
2. **RLS read policies** wait on the games table (section 6).
3. **Replay validation for gym runs** is named as required in section 5 and is not built. It lives
   in the shared rules package, which does not exist yet.
4. **The projection rebuild script** is asserted as a property in section 4 and is not written. The
   property is only real once a rebuild has actually been run end to end.
5. ~~**Retention and personal data.**~~ **DECIDED 2026-08-22 by Steve.** The log retains
   everything. Tile text lives inline in the payload, and deletion is modelled as its own appended
   event rather than as erasure, because the whole game interaction has to stay studiable. There is
   therefore no update path, no delete path, and no admin escape hatch that disables the trigger:
   the catalogue gets a deletion event type, projections and exports honour it, and the raw log
   keeps the original. Consequence to carry into the catalogue: every text-bearing event holds its
   text inline at version 1, and no reader may assume text can be re-fetched from a mutable table.
   Open and NOT decided here: whether a legal erasure demand can be honoured at all under this
   design, and how that squares with the deletion language in the IRB data-privacy response. That
   is a PI and IRB question, tracked separately, and must not be silently assumed either way.
6. ~~**Payload size.**~~ **DECIDED 2026-08-22 (Brain's call, reported to Steve).** Hard cap of
   16 KB per payload, enforced as a check constraint on `octet_length(payload::text)`, landing in
   the same migration as the catalogue. `octet_length` on the text form rather than
   `pg_column_size` because the latter reports the compressed and possibly TOASTed size, which is
   not a stable contract. The number is anchored on real content: a tile is capped at 100
   characters in the client (`Tile.vue:189`), so a tile event is well under 1 KB, and the largest
   realistic event is an AI evaluation carrying feedback text, a suggestion, flagged categories,
   model name and prompt version, a few KB at worst. 16 KB is roughly two orders of magnitude of
   headroom over a tile and a comfortable multiple over AI feedback, while still small enough that
   a paste bomb or a serialisation bug is refused at write time instead of being retained forever.
   Retention makes this stricter, not looser: nothing is ever removed, so an oversized row is
   permanent. Per-type limits tighter than 16 KB belong in the catalogue, starting with tile text
   at the game's own 100 characters, which is currently enforced only in the client.

## 8. Verified

Against project `tvtmltchotkzviqaywdy` (Postgres 17.6) on 2026-08-19: contiguous numbering across
mixed single and batch appends (1..5); `UPDATE` and `DELETE` both refused by trigger for the owning
role; duplicate `seq` refused by constraint; empty batch a no-op; non-array batch refused loudly;
anon refused on read, single append, and batch append; secret key able to do both appends. Table
left empty.
