---
tid: BRAIN-T260822-09
type: spec
thread: new-stack-migration
status: active
owner: claude (brain), pending Steve review on the open questions in §8
governs: web/point-taken-2026/supabase/migrations/0004_identity_and_games.sql
created: 2026-08-22
must_read_full: true
---

# Identity and the read models the log projects into

> This file is a registry-backed durable artifact. It exists only because a row
> in the project's todos.csv points at it (source_doc). If you are reading a copy
> with no such row, it is an orphan: file a needs-triage row or delete it.

## Purpose

`0001_event_log.sql` shipped a log with nothing to point at. It said so, deferring its own read
policy on the grounds that "until there is a `game_players` table there is no way to express
membership," and it left `game_events.game_id` as a bare uuid pointing at nothing. `0002` filled in
the vocabulary. This is the missing noun: who a player is, what a game is, and where the log's
`game_id` actually lands.

`BRAIN-T260817-05` is why it comes before the level content rather than after it. An unleveled
account still needs a durable home, and a dashboard still needs a queryable history. The log is the
history. This is the home.

## Scope and non-goals

In scope: the `players` profile row and how it gets created; the `games` row and its lifecycle
columns; the `game_players` membership row; the trigger that derives the last two from the log; the
foreign key from the log to `games`; the row-level security and grants that make all four tables
readable by exactly the right people.

Not in scope, deliberately:

- **Progression totals.** No points column, no badge column, no level column. Every one of those is
  derivable from `game_events`, and a projection table earns its place when a real read is slow,
  not when a designer draws a number on a dashboard. See §5.
- **The name list.** `display_name` starts null. The three-random-word vocabulary
  (`BRAIN-T260714-71`) is content and belongs in the rules package, not in a migration that would
  freeze it.
- **Tiles, threads, and board state.** Those are events. If a read of them turns out to need a
  table, that table is a later migration and it is derived, exactly like these two.

## 1. `players`: one row per authenticated human

```
id           uuid primary key references auth.users (id) on delete cascade
display_name text, null until assigned, non-empty when present
claimed_at   timestamptz, null while the account is still anonymous
created_at   timestamptz not null default now()
```

Anonymous sign-in is enabled on this project (`BRAIN-T260819-16`), so every player, including one
who never gives an email, gets an `auth.users` row and a real JWT. The `anon` Postgres role is only
ever the pre-sign-in state and is never a player. That is why `players.id` can be a hard foreign key
to `auth.users` with no nullable escape hatch.

The row is created by `handle_new_auth_user()`, an `after insert` trigger on `auth.users`, rather
than by the application. An app that must remember to create a profile is an app that will
eventually forget, most likely on the anonymous path that nobody tests.

`players_display_name_key` is unique on `lower(display_name)` where not null, so names are
case-insensitively unique but a nameless account does not collide with every other nameless
account. `claimed_at` distinguishes an anonymous account from one that has attached an email; it is
a timestamp rather than a boolean so the moment is recoverable.

## 2. `games`: the lifecycle row

```
mode          text not null, 'gym' or 'live'
level_id      text, gym only
boss_id       text, gym only
join_code     text, live only
status        text not null default 'lobby', one of lobby / active / ended
created_by    uuid references auth.users on delete set null
started_at, ended_at, created_at   timestamptz
win_condition text, one of threads_resolved / topic_agreed / abandoned / timeout
```

The mode taxonomy is exactly two values with `level_id` and `boss_id` as separate fields, per
`BRAIN-T260816-18`. Dojo is retired; the name is Gym.

Three check constraints keep impossible rows out rather than trusting the writer:
`games_gym_has_no_join_code` (a solo coached run has nobody to invite), `games_ended_has_condition`
(written as an equality between two booleans, so `ended` without a timestamp and a timestamp
without `ended` are both refused), and `games_active_has_start`.

`games_join_code_open_key` is unique on `upper(join_code)` **where the game is not ended**. A join
code is a scarce four-to-six character token; making it globally unique forever would burn the
namespace for no benefit. Scoping uniqueness to open games means a code returns to the pool when its
game finishes, and the verification confirms a finished game's code can immediately be reused.

## 3. `game_players`: membership, and the seat

Primary key `(game_id, player_id)`, plus `role` (`plus` / `minus`, null until chosen), `joined_at`,
and `left_at`. `game_players_one_per_side` is unique on `(game_id, role)` where role is not null:
two players cannot both be plus.

`left_at` is a stamp, not a delete. A disconnect marks the row; a rejoin clears the stamp on the
same row via `on conflict do update`. The seat is the identity, so a player who drops and returns is
the same participant with the same history rather than a second one.

## 4. The projection rule

**The log is the authority for what happened. `games` and `game_players` are read models.**

One trigger, `project_game_event()`, fires `after insert` on `game_events` and is the only thing
that ever writes those two tables. It handles `player_joined`, `role_selected`, `player_left`,
`game_started`, and `game_ended`, and ignores everything else. Nothing else may write them: there is
no insert, update, or delete policy on any table in this schema, and `authenticated` holds no write
grant beyond `players.display_name`.

The trigger runs inside `append_game_event`'s per-game advisory lock, because it is called from
inside that function's transaction. This is what makes the two-player cap and the one-seat-per-side
rule genuinely atomic rather than a check-then-act race that usually happens to win. A third
`player_joined` raises `check_violation` with the game id in the message; a rejoin by an existing
member does not.

The single exception to "the log is the authority" is the `games` row itself, which must exist
before its first event, because the log now has a foreign key to it. `create_game()` closes that
gap: one `security definer` function that inserts the row and appends `game_created` at seq 1 in the
same transaction, so a game without its creation event is not a state the database can be left in.

## 5. Why no totals here

Points, badges, cards, and level standing are all functions of the log. Writing them as columns
would create a second authority that can disagree with the first, and the disagreement would be
discovered months later by a player whose badge count is wrong and whose history says otherwise.

The rule for adding one later: a projection table is justified by a measured slow read, it is
rebuilt from the log by a function that can be run at any time, and it is never the thing a human
edits to fix a number. Fixing a number means appending an event.

## 6. The foreign key is `restrict`, not `cascade`

`game_events.game_id` now references `games (id) on delete restrict`. The retain-everything ruling
(`BRAIN-T260822-03`) says deletion is an appended event and never erasure. `cascade` would make
`delete from games` a silent shredder for exactly the history that ruling protects, so a game
holding events is simply not deletable and the attempt raises. Verification confirms it does.

Adding this constraint was only cheap because the log was still empty. It would have been a
data-migration project a month from now.

## 7. Reading: RLS and grants

RLS is on for all four tables. Five policies, all `select` except one:

- `players_read_self_and_opponents`: yourself, plus anyone you share a game with.
- `players_update_self`: `using` **and** `with check`, both `id = auth.uid()`. Without the
  `with check` half, a player could update their own row into someone else's id.
- `games_read_member`, `game_players_read_member`, and `game_events_read_member`, all gated on
  `is_game_member(id)`. The last one is the policy 0001 deferred, and because Supabase Realtime
  respects RLS, it is also the line that finally lets a client subscribe to its own game. Broadcast
  no longer has to be relayed server-side.

`is_game_member()` is `security definer` for a load-bearing reason, not out of habit: it is the body
of a policy on `game_players` whose own query reads `game_players`. Under the caller's role that
recurses. Running it as the owner, who is exempt from RLS, breaks the cycle. Do not "simplify" it
into an inlined `exists()` in the policy; the comment above it in the migration says the same thing.

Grants, with the PUBLIC trap handled. Postgres grants `execute` to `PUBLIC` on every new function
and `anon` / `authenticated` inherit from `PUBLIC`, so revoking from them by name alone does
nothing. Every revoke here names `public` first. A real exploit of exactly this was verified on
2026-08-19.

- `authenticated`: select on all four tables, update on `players.display_name` only.
- `anon`: nothing.
- `service_role`: select, insert, update on the three new tables; select but **not** insert on
  `game_events`, because a direct insert would bypass the sequence assignment.
- `is_game_member` is the one function `authenticated` may still execute, because it is the body of
  four policies and a policy runs as the querying role. Revoking it would break every read.

## 8. Gaps and open questions

Marked rather than invented. None of these block the current build.

1. **Who calls `create_game`.** Only `service_role` can. The route that does it does not exist yet,
   and neither does the check that a player is allowed to start the game they are asking for.
2. **Join-code generation.** Nothing here generates one. Length, alphabet (ambiguous characters
   excluded or not), and collision-retry are unspecified and belong with the lobby work.
3. **Name assignment.** `display_name` is null until something assigns it, and that something is the
   rules package, unwritten. Until then `player_joined` will reject a join, since it requires a name
   in the payload.
4. **Abandonment.** `status` can sit at `lobby` or `active` forever. Nothing sweeps a game whose
   players walked away, and `win_condition` has `abandoned` and `timeout` values with no writer.
5. **`claimed_at` has no writer.** The anonymous-to-claimed upgrade flow is not built.
6. **Deletion as an event.** `BRAIN-T260822-03` says deletion is appended, and `content_redacted`
   exists in the catalogue, but nothing yet reads it when reconstructing state. A redaction today
   is recorded and ignored.

## 9. Verification

Run as one rolled-back `do` block against the live project on 2026-08-22, ending in a raise so
nothing persisted and the log stayed empty. Confirmed: the auth trigger created three profiles;
`create_game` produced a `lobby` game and `game_created` at seq 1 atomically, with `level_id`,
`boss_id`, and `join_code` present as explicit nulls and `client_build` present only when supplied;
gym-with-join-code refused (23514); an event against a nonexistent game refused (23503); membership,
role, and `left_at` all projected; a third player refused (23514); a duplicate side refused (23505);
a rejoin reused the seat; status walked lobby to active to ended with the win condition recorded; a
finished game's join code was immediately reusable; deleting a game holding events refused (23503);
`is_game_member` answered true for a member and false for a stranger without recursing; and the full
privilege matrix read exactly as §7 describes.

Note that this change **breaks the older `verify0002.sql`**, which appends against invented game ids
with no `games` row. That script is no longer runnable as written.
