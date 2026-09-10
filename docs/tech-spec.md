---
slot: tech-spec.md
game: brain
purpose: Architecture and data contracts a coding agent needs before changing anything in point-taken-brain/web/point-taken-2026.
written: 2026-08-28 by biz
status: draft, unreviewed by Steve
sources:
  - point-taken-brain/web/point-taken-2026/package.json
  - point-taken-brain/web/point-taken-2026/CLAUDE.md
  - point-taken-brain/web/point-taken-2026/README.md
  - point-taken-brain/web/point-taken-2026/lib/events/types.ts
  - point-taken-brain/web/point-taken-2026/lib/events/append.ts
  - point-taken-brain/web/point-taken-2026/lib/board/rules.ts
  - point-taken-brain/web/point-taken-2026/lib/board/project.ts
  - point-taken-brain/web/point-taken-2026/lib/supabase/server.ts
  - point-taken-brain/web/point-taken-2026/lib/supabase/session.ts
  - point-taken-brain/web/point-taken-2026/lib/supabase/browser.ts
  - point-taken-brain/web/point-taken-2026/proxy.ts
  - point-taken-brain/web/point-taken-2026/app/api/auth/anonymous/route.ts
  - point-taken-brain/web/point-taken-2026/app/api/auth/signin/route.ts
  - point-taken-brain/web/point-taken-2026/app/api/auth/signout/route.ts
  - point-taken-brain/web/point-taken-2026/app/auth/callback/route.ts
  - point-taken-brain/web/point-taken-2026/lib/db/players.ts
  - point-taken-brain/web/point-taken-2026/lib/db/games.ts
  - point-taken-brain/web/point-taken-2026/lib/db/types.ts
  - point-taken-brain/web/point-taken-2026/lib/coach/evaluate.ts
  - point-taken-brain/web/point-taken-2026/lib/coach/run.ts
  - point-taken-brain/web/point-taken-2026/lib/coach/checks.ts
  - point-taken-brain/web/point-taken-2026/lib/games/abandon.ts
  - point-taken-brain/web/point-taken-2026/app/game/[gameId]/page.tsx
  - point-taken-brain/web/point-taken-2026/app/game/[gameId]/actions.ts
  - point-taken-brain/web/point-taken-2026/components/board/use-game-feed.ts
  - point-taken-brain/web/point-taken-2026/supabase/migrations/0001 through 0016
  - point-taken-brain/docs/reference/materials/2026-08-22_platform-rebuild-handoff.md
  - point-taken-brain/docs/reference/materials/spec/release-hygiene.md
  - point-taken-brain/web/point-taken-2026/lib/gym/script.ts
  - point-taken-brain/web/point-taken-2026/lib/gym/awards.ts
  - point-taken-brain/web/point-taken-2026/lib/gym/boss-account.ts
  - point-taken-brain/web/point-taken-2026/lib/gym/levels/index.ts
  - point-taken-brain/web/point-taken-2026/app/gym/actions.ts
  - point-taken-brain/web/point-taken-2026/lib/db/awards.ts
  - point-taken-brain/web/point-taken-2026/lib/progression/state.ts
  - point-taken-brain/web/point-taken-2026/lib/progression/sample.ts
  - point-taken-brain/web/point-taken-2026/lib/avatar.ts
  - point-taken-brain/web/point-taken-2026/app/settings/actions.ts
  - point-taken-brain/web/point-taken-2026/app/api/health/route.ts
  - point-taken-brain/web/point-taken-2026/lib/db/leaderboard.ts
  - point-taken-brain/web/point-taken-2026/components/account/account-shell.tsx
  - point-taken-brain/web/point-taken-2026/components/board/live-board.tsx
  - point-taken-brain/web/point-taken-2026/components/board/coach-panel.tsx
  - point-taken-brain/web/point-taken-2026/components/gym/cooked-placement.ts
  - point-taken-brain/web/point-taken-2026/lib/feedback/config.ts
  - point-taken-brain/web/point-taken-2026/.env.example
  - point-taken-brain/web/point-taken-2026/.vercel/project.json
  - https://point-taken-2026.vercel.app/api/health?deep=1
---

# Brain tech spec

This is what a coding agent needs to know before touching
`point-taken-brain/web/point-taken-2026`, the current Next.js build of Point
Taken Brain. It covers everything a player could not notice changing: stack,
data model, event contract, AI plumbing, identity, and the decisions behind
them. What a player would notice (card text, copy, win screens) belongs in
`rules.md`, not here.

Where a doc's stated intent and the code disagree, the code is what runs today.
Both are stated below; the doc's version is marked intended-but-unbuilt. That
distinction is the single most valuable thing in this document, because a doc
is a claim and the code is what a player actually hits.

## 1. Stack and versions

From `package.json`, read directly:

- Next.js 16.3.2, React 19.2.8, React DOM 19.2.8. App Router (`app/`).
- `@supabase/supabase-js` ^2.112.3, `@supabase/ssr` ^0.12.4. One Postgres
  project is the entire backend: no separate API server.
- `@anthropic-ai/sdk` ^0.120.0. The only AI dependency. `[ruled]` per the
  2026-08-19 decision to replace an older Python pipeline with one
  in-process TypeScript SDK call; confirmed built (section 6).
- `server-only` ^0.0.1, marking modules that must never ship to the browser
  (`lib/supabase/server.ts`, `lib/coach/*`, `lib/db/*`).
- TypeScript ^5. Tailwind CSS ^4 via `@tailwindcss/postcss`.
- Vitest ^4.1.11 with `jsdom`, `@testing-library/react`, `@testing-library/user-event`.
- ESLint ^9 with `eslint-config-next` 16.3.2. Prettier ^3.9.6.

Runtime shape: every page that reads game or player data declares
`export const dynamic = "force-dynamic"`, so there is no static page cache to
reason about and no build-time secret requirement. The two pages that do not
are `app/gym/page.tsx` (a pure `redirect()`) and `app/dev/tile-popover/page.tsx`
(a dev harness); of the route handlers only `app/api/health/route.ts` declares
it, the rest being dynamic by what they do. Hosting target (Vercel tier,
region) is `[unratified]`, discussed in
`2026-08-22_platform-rebuild-handoff.md` but not confirmed in code or a
registry ruling. The open question about it is in section 10, with the rest of
this document's gaps.

The database is a single Supabase project, Postgres 17.6, per
`2026-08-22_platform-rebuild-handoff.md` (project ref and region named there,
not re-quoted here since this doc does not carry infra identifiers a reader
could act on without the source file). No values from `../point-taken-biz/api-keys/`
were read for this document; those env files are referenced by variable name
only. `.env.example` names six: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`PT_DEV_AUTOLOGIN`, `ANTHROPIC_API_KEY`, plus three that point the in-app
feedback pop-up at a Google Form that does not exist yet and that
`lib/feedback/config.ts` is written to work correctly without:
`NEXT_PUBLIC_FEEDBACK_FORM_ACTION_URL`, `NEXT_PUBLIC_FEEDBACK_FORM_ENTRY_IDS`,
`NEXT_PUBLIC_FEEDBACK_SHARE_MORE_URL`. One more, `COACH_EVAL`, is not an
application variable at all: it un-skips a model-comparison test
(`lib/coach/coach-eval.test.ts:107`) and is set on the command line, never in
a deployment.

No part of the older AWS stack (Nuxt3, Express5+Socket.io, DynamoDB, Cognito,
Elastic Beanstalk, S3/CloudFront) is in play here. It runs the game at
`play.pointtaken.social` and it is not this architecture; nothing in this
repository talks to it.

## 2. Repo layout

Everything lives under `point-taken-brain/web/point-taken-2026/`:

- `app/`: Next.js App Router. `app/game/[gameId]/` holds one game's
  page, its server actions (`actions.ts`), and setup-room actions
  (`setup-actions.ts`). `app/api/auth/` holds the anonymous, signin, and
  signout route handlers; `app/auth/callback/route.ts` completes magic-link
  sign-in. `app/account/` is the player's own dashboard.
- `lib/events/`: the event vocabulary (`types.ts`) and the sole write/read
  path (`append.ts`). Core file, off-limits for casual edits per `CLAUDE.md`.
- `lib/board/`: `rules.ts` (what moves are legal, shared by client and
  server) and `project.ts` (`projectBoard`, event log to board state). Core
  file.
- `lib/supabase/`: the three client tiers: `server.ts` (service role),
  `session.ts` (authenticated user), `browser.ts` (publishable key, RLS-only).
- `lib/db/`: typed reads/writes against `players`, `games`, `game_players`
  (`players.ts`, `games.ts`, `types.ts`).
- `lib/coach/`: the AI integration: `evaluate.ts` (the model call),
  `run.ts` (when it fires and what it writes back), `checks.ts` (the ported
  nine-check rubric and card derivation), `cards.ts` (the four rule cards).
- `lib/games/`: `membership.ts` (who may act on a game), `abandon.ts`
  (ending a game nobody is left to play), `streak.ts`, `joinCode.ts`.
- `lib/gym/`: the Gym script engine. `script.ts` is the pure walk (a level as
  an ordered list of beats, bound against the projected board); `levels/`
  holds the four scripts (`onboarding.ts`, `ground-rules.ts`,
  `claim-size.ts`, `clarity.ts`) exported in ladder order from `index.ts`,
  which also exports `cardsThroughLevel()`, the display filter that keeps a
  level's tray to the cards taught at or before it; `boss-account.ts` derives
  a stable auth user id per boss; `awards.ts` writes the four award events
  once a Gym game ends on a cooperative win; `taught.ts` derives which later
  moves and tokens a level has reached; `root-suggestions.ts` feeds the
  coach's sample answers.
- `lib/progression/`: `state.ts` reads real award data off the log
  (`lib/db/awards.ts`) into the shapes the profile widgets draw; `sample.ts`
  is the sample data those same widgets fall back to for anything not yet
  real (rungs 5 and up, badge display names, the cooperation/rank tiles).
- `lib/avatar.ts`: the nine fixed avatar emoji and the derived-initials
  fallback.
- `lib/dev/hotseat.ts`: dev-only identity override, inert outside
  `NODE_ENV !== "production"`.
- `components/board/`: `live-board.tsx` (the active game UI, now over 4,000
  lines), `use-game-feed.ts` (the Supabase Realtime subscription),
  `game-setup.tsx`, `finished-map.tsx`, `ending.tsx`, `spatial-board.tsx`
  (pan/zoom/fit canvas), `coach-panel.tsx` (the coach's own card, rendered
  only outside the Gym), `tile-shape.tsx`, `topic-cell.tsx`,
  `rule-card-face.tsx`, `rule-card-popup.tsx`, `rule-card-tray.tsx`,
  `stance-picker.tsx`, `ways-to-win-card.tsx`, `same-side-notice.tsx`,
  `layout.ts` and `geometry.ts` (where tiles sit), `later-moves.ts`,
  `peer-notices.ts`, `side-label.ts`, `seat-speech.ts`. There is no
  resolution-picker: a thread is closed from its own root tile, which flanks
  itself with the two tokens on hover. See `docs/ui-components.md` for
  behavior.
- `components/gym/`: `director.tsx` (drives a level: reads the script, calls
  `bossAct`, tells the board what to highlight), `level-intro.tsx`,
  `gym-lobby.tsx`, `start-level-button.tsx`, `certificate.tsx`,
  `sample-answers.ts`, `boss-draft.ts`, and a set of one-fact channels the
  Director publishes to and the board reads: `cooked-placement.ts` (how
  tightly the current beat narrows placement, including the one tile a repair
  beat unlocks for editing), `pointed-slot.ts` and `pointed-tile.ts` (what
  the script is pointing at), `boss-flash.ts` (the slot the boss's tile just
  landed in, so it gets the same brief highlight the player's own throw
  does), `hidden-surfaces.ts` (board chrome the level is still holding back),
  `moving-tile.ts` (which reason is waiting to be relocated),
  `taught-moves.ts` (which later moves and tokens the level has taught).
- `components/account/`: `account-shell.tsx` (the four-tab chrome shared by
  every out-of-game screen), `hero.tsx`, `avatar-picker.tsx`,
  `calendar-strip.tsx`, `match-list.tsx`, `progression/` (ladder, badges,
  certificates, boss briefing, sample-data tagging).
- `components/dev/hotseat-bar.tsx`: the dev hot-seat UI bar.
- `app/gym/actions.ts`: `startLevel` (creates the cooked game, seats the
  boss, signs for it) and `bossAct` (the boss's one scripted move),
  server actions, core lane.
- `app/leaderboard/`, `app/cards/`: the leaderboard and the Cards & Badges
  tab.
- `lib/feedback/` and `components/feedback/`: the in-app feedback pop-up and
  the env-driven Google Form config it posts to, inert while those vars are
  unset.
- `supabase/migrations/`: 16 numbered SQL files, `0001` through `0016`,
  applied in order, the database's own source of truth.
- `proxy.ts`: Next 16's renamed `middleware.ts`. Refreshes session cookies
  on every request; also the dev autologin gate.

Server actions under `app/**/actions.ts` and `app/**/setup-actions.ts`, plus
everything in `lib/events/`, `lib/board/`, and `supabase/migrations/**`, are
named in `CLAUDE.md` as core files requiring review outside a casual edit.

## 3. Request and render path for one turn of play

Reading a board (`app/game/[gameId]/page.tsx`, a server component,
`force-dynamic`):

1. Validate `gameId` is a UUID; 404 otherwise.
2. `readSeat(gameId)` (`lib/games/membership.ts`) establishes who the caller
   is and whether they belong to this game. A non-member gets the same 404 as
   a nonexistent game, so game ids cannot be probed.
3. `readGameEvents(gameId)` (`lib/events/append.ts`) pulls the full event log
   for that game, ordered by `seq`, via the service-role client.
4. `projectBoard(events)` (`lib/board/project.ts`) folds the log into a
   `BoardState`. This is the only way a board is computed; there is no
   separate cached board row.
5. The page branches on `board.status`, and within it on whether the game
   carries a Gym level. A cleared level renders `Certificate` +
   `FinishedMap` + `WinOverlay`, the overlay dismissing in place onto the
   certificate rather than navigating; a level that ended without being
   cleared (someone left partway) gets the same sentence and map an ordinary
   game gets, deliberately without a certificate. Any other `ended` game
   renders `Ending` + `FinishedMap` + `WinOverlay`; `lobby` (or `active` with
   no role yet) renders `GameSetup`; `active` with a role renders
   `LiveBoard`.

Placing a tile (`app/game/[gameId]/actions.ts`, `placeTile`, a server
action):

1. Validate the game id, then `readMembership(gameId)` establishes the caller
   from the server-side session, never from a client-supplied player id
   (structurally enforced by `lib/games/action-identity.test.ts` per
   `CLAUDE.md`).
2. Re-project the board from the log (`projectBoard(readGameEvents(...))`).
3. `rules.canPlaceTile(board, text, parentTileId)` checks legality. A refusal
   returns as an ordinary `{ ok: false, error }` value, not a thrown
   exception.
4. `appendGameEvent(gameId, { type: "tile_placed", ... })` writes the one
   event that makes the tile real.
5. The response is returned to the browser (`revalidatePath` triggers a
   server-render refresh) **before** the coach runs. The coach call is
   scheduled with Next's `after()` API, which runs after the response is
   sent: `lib/coach/run.ts`'s own comment states this plainly, "placing a
   tile never waits on a model call." Any AI feedback that results lands a
   moment later over Supabase Realtime, and only for the player it was
   written for. This is covered in more detail, including a contradiction
   with a fact this document was asked to assume, in section 6.
6. The other player's browser is not polling; `components/board/use-game-feed.ts`
   holds a Supabase Realtime subscription on `game_events` for that game id
   and calls `router.refresh()` (debounced 60ms via `setTimeout`/`clearTimeout`)
   when a new row arrives, which re-runs the server component and
   re-projects the board.

## 4. Data model

Three tables, one append-only and two projected from it.

**`public.game_events`** (migration `0001_event_log.sql`, `0002` for the
type catalogue, `0003` for the grant fix). Columns, per `GameEventRow` in
`lib/events/types.ts`: `id`, `game_id`, `seq`, `type`, `schema_version`,
`actor_role` (`plus`/`minus`/`server`), `source` (`human`/`coach`/`system`),
`actor_id` (nullable), `payload` (jsonb), `created_at`. `(game_id, seq)` is
unique. Ordering is enforced by `pg_advisory_xact_lock(hashtextextended(game_id::text, 0))`,
a transaction-scoped lock that releases on rollback (`[unratified]`, stated
in `2026-08-22_platform-rebuild-handoff.md`, consistent with `append.ts`'s
single-writer RPC pattern but not independently re-read from the migration's
SQL). UPDATE and DELETE are blocked by trigger: `[ruled]`, Steve
2026-08-22, quoted in the handoff doc, "we want all the data, there is a
separate deletion event" (the deletion event is `content_redacted`, an
ordinary append that marks another row's payload gone, not a row removal).

`0003_service_role_read.sql` grants `service_role` SELECT on `game_events` and
restates the same grant on `game_event_types`. `0001` turned RLS on with no
policies and revoked everything from `anon` and `authenticated`, and never
granted anything back to `service_role` because nothing read the table yet;
writes kept working because `append_game_event`/`append_game_events` are
SECURITY DEFINER, so the missing grant stayed invisible until the first reader
hit `42501` on a select. **SELECT only, deliberately.** A direct INSERT grant
would let a caller write a row without the append functions, and the `seq`
those functions assign under the per-game advisory lock is the entire ordering
guarantee: one write path. UPDATE and DELETE stay off for the same reason
`0001` blocks them. `anon` and `authenticated` remain ungranted with no policy.

**`public.games`** and **`public.game_players`** are read models, maintained
purely by a trigger off `game_events` (`0004_identity_and_games.sql`).
Nothing in the application writes them directly except one exception: game
creation. `lib/db/games.ts`'s `createGame` calls RPC `create_game`, which
inserts the `games` row and appends `game_created` at `seq` 1 in the same
transaction, because the log carries a foreign key to `games` and the row has
to exist first. Every other row-shaping event flows through the trigger.

`GameRow` (`lib/db/types.ts`): `id`, `mode` (`gym`/`live`), `level_id`,
`boss_id`, `join_code`, `status` (`lobby`/`active`/`ended`), `created_by`,
`created_at`, `started_at`, `ended_at`, `win_condition`
(`threads_resolved`/`topic_agreed`/`abandoned`/`timeout`). There is no topic
column by design: the topic is something a player said, so it lives in the
log (`topic_set`/`topic_revised`/`content_redacted` events), and
`lib/db/games.ts`'s `foldTopics` derives it for list views without
re-projecting a full board per row.

`GamePlayerRow`: `game_id`, `player_id`, `role` (`plus`/`minus`/null),
`joined_at`, `left_at` (a stamp, not a delete; rejoin clears it on the same
row).

**`public.players`** (also `0004`, altered by `0007_coach_setting.sql`,
`0009_claim_account.sql`, `0013_player_kind.sql`,
`0015_player_avatar.sql`, and `0016_coach_on_by_default.sql`): one row per
authenticated human, created by a trigger on `auth.users` so the anonymous
signup path cannot skip it.
`PlayerRow`: `id`, `display_name` (null until assigned), `claimed_at` (null
while anonymous), `created_at`, `coach_enabled` (boolean, added by `0007`,
**on** by default since `0016` `[ruled]` Steve 2026-09-07, reversing
`BRAIN-T260713-06`: the column default is the entire decision about what a
first-time player gets, because the `0004` trigger inserts a `players` row
with only an id and no application code ever passes the flag. `0016`
deliberately backfills nothing, so a player already sitting at false stays
there), `kind` (`human`/`boss`, added by `0013`, default `human`),
`avatar_emoji` (added by `0015`, null until a player opts into one of nine
fixed emoji, `PLAYER_EMOJIS` in `lib/avatar.ts`) `[unratified]`
(`supabase/migrations/0015_player_avatar.sql`; `data/todos.csv` carries this
build as `BRAIN-T260904-42`, status `review`, not yet a closed decision). No
points, badges, or token
totals live on this row; everything of that kind is derived live from the
log, now including a real one (see the awards paragraph below).

`0012_root_stage.sql` adds no table. It adds `root_target` to
`game_started`'s payload (a live game and Gym levels 2-4 open with four
thread roots down before any rebuttal is legal; Gym level 1 opens with two,
the whole point of that level being to teach what a thread is,
`[ruled]` per `BRAIN-T260903-21`/`BRAIN-T260903-22`). That is a shape change
to an existing payload, so `game_started` versions to schema 2 rather than
being edited in place; version-1 rows still project and read a missing
`root_target` as the live default of four (`LIVE_ROOT_TARGET`,
`lib/board/project.ts:199`).

`0013_player_kind.sql` is what lets a Gym boss have a real seat (`player_joined`
carries an actor id with a foreign key to `auth.users`, so a scripted
opponent needs one) without being counted as a person anywhere a roster is
shown: the leaderboard and every player-facing list filter `kind = 'human'`.
Steve's 2026-09-03 ruling kept the boss's auth user rather than teaching the
trigger to accept a seat with none, because that column is the identity
spine of every RLS policy in `0004` and `0009`
(`supabase/migrations/0013_player_kind.sql`).

**`public.player_stats(uuid)`** is a Postgres function
(`0005_player_stats.sql`, extended by `0010_card_stats.sql` and
`0011_stats_totals_match_breakdowns.sql`, both `create or replace` on the same
function signature, no new tables introduced by either), granted to
`service_role` only, explicitly revoked from `public`, `anon`, and
`authenticated` because it takes a player id as an argument without checking
who is calling. `lib/db/stats.ts` wraps it. Nothing is cached; every call
re-derives from the event log.

**A lightweight points ledger exists, event-sourced, not a table.**
`0014_awards.sql` adds four
event types written about a player rather than about the board:
`level_cleared` (the rung and the card it grants), `badge_granted` (one
badge, with an occurrence count so repeats are countable), `points_changed`
(a signed delta and a stable reason word, negative only for a stake a player
chose to put down in the level 3 dare, refunded by a second positive delta
when the claim is repaired), and `certificate_granted` (the level and the
date, written once so a reprint says the same thing). `[ruled]`: these are
not a score against an opponent and never record a loss
(`supabase/migrations/0014_awards.sql`). The writer, `lib/gym/awards.ts`, is
idempotent by re-projecting and returning early if the game already carries
`level_cleared`, and refuses to award anything for a live game, an abandoned
or timed-out game, or the boss. `lib/db/awards.ts` reads a player's whole
award history back with one indexed query over `game_events`, no join, since
every award event carries the earning player's `actor_id`.

`0006_realtime_game_events.sql` turns on Supabase Realtime for
`game_events`, riding the read policy `0004` already wrote.
`0008_private_coach_feedback.sql` narrows that read policy further: a
`game_events_read_member` policy lets an authenticated member read their
game, except `ai_feedback_returned` and `ai_feedback_shown` rows, which are
visible only when `actor_id` equals the reader (`auth.uid()`). This bends the
convention (stated in `0001`) that `actor_id` is null for server-generated
events: a coach reading needs a recipient, so it carries one. Realtime
respects RLS, so the opponent's subscription never even wakes on a reading
that is not theirs.

`0009_claim_account.sql` creates function `handle_auth_user_claimed()` and
trigger `on_auth_user_claimed` (fires `after update of email_confirmed_at on
auth.users`), which stamps `players.claimed_at` the moment an email is
confirmed, guarded by `claimed_at is null` so it is idempotent and never
overwritten by a later email change. No application code stamps this column;
`app/auth/callback/route.ts`'s own comment says so directly.

## 5. Event contract

32 named event types, defined identically in `lib/events/types.ts`
(TypeScript, compile-time) and `0002_event_type_catalogue.sql` (Postgres,
runtime, extended by `0012_root_stage.sql` and `0014_awards.sql`), with
`lib/events/catalogue.test.ts` run in CI (`.github/workflows/gate.yml`)
asserting the two lists never drift by distinct type name:
`game_created`, `player_joined`, `role_selected`, `agreement_signed`,
`topic_set`, `game_started`, `player_left`, `game_ended`, `tile_placed`,
`tile_edited`, `tile_revised`, `tile_relocated`, `tile_removed`,
`resolution_emoji_placed`, `resolution_emoji_removed`, `thread_resolved`,
`proposal_made`, `proposal_accepted`, `proposal_rejected`, `topic_revised`,
`card_thrown`, `card_throw_declined`, `generosity_token_given`,
`ai_feedback_returned`, `ai_feedback_shown`, `coach_nudge_delivered`,
`gym_run_recorded`, `level_cleared`, `badge_granted`, `points_changed`,
`certificate_granted`, `content_redacted`.

`game_started` versions to schema 2 (`lib/events/types.ts:366-368`) rather
than being edited in place, because `0012_root_stage.sql` adds a shape
change to its payload (`root_target`, the thread-root count required before
the first rebuttal, see section 4). The catalogue keeps one row per
`(type, schema_version)` ever shipped and never removes an old version, so a
version-2 row is a second catalogue row for the same type. That is why
`/api/health?deep=1` reports three numbers, not two:
`catalogue_rows: 33` (every row, so `game_started`'s two versions both
count), `catalogue_types: 33 - 1 = 32` (distinct type names in the database),
and `catalogue_types_in_code: 32` (`EVENT_TYPE_NAMES.length`). The last two
are the pair meant to match; `catalogue_rows` is never comparable to either.
Whenever rows and types differ the route also returns `multi_version_types`
naming which type carries more than one version. `missing_in_db` and
`missing_in_code` both come back empty because that comparison dedupes by
type name first (`app/api/health/route.ts`).

Each type carries its own `schemaVersion` (never a global one) and a
`maxBytes` ceiling, from 256 bytes (the smallest, e.g. `role_selected`,
`tile_removed`) to 16384 bytes (`ai_feedback_returned`, also the table-level
`PAYLOAD_HARD_CAP_BYTES`). `payloadBytes()` in `lib/events/append.ts` counts
the JSON-text byte length client-side before every append; `assertPayloadFits()`
throws before the call is made if it would exceed either the per-type or
global ceiling. A field typed `T | null` is required-and-nullable, distinct
from an optional `?` field, a distinction the spec deliberately preserves.

Two write functions exist: `appendGameEvent` (single event, RPC
`append_game_event`) and `appendGameEvents` (batch, RPC `append_game_events`,
intended for validated gym runs). The batch function's own comment is a
warning worth repeating verbatim in spirit: replay the run through the rules
package before calling it, since it validates envelopes and sizes, never
legality. Both go through `serviceClient()`; there is no path for a browser
to append an event directly (see section 7 and the PUBLIC-grant incident
below).

Tile text is capped at 100 characters `[unratified: lib/board/rules.ts:14]`,
`TILE_MAX_CHARS`, enforced in the same shared module the client and
server both import (`canPlaceTile`, `canEditTile`, `canReviseTile`), with the
file's own comment: "Enforced both sides." The client copy can be bypassed and
this file cannot append anything, which is why the same module is what the
server action imports.

There is no minimum thread count and no thread floor at any level: no
`MIN_THREADS_TO_END` constant exists. A game ends once every live thread
resolves, whatever their number, and a thread with no live tiles left does
not count toward that `[ruled Steve 2026-09-01, BRAIN-T260901-06,
`threadsWinReached`, lib/board/rules.ts:124-138]`, reconfirmed final
2026-09-07. `MAX_THREADS = 4` (`lib/board/rules.ts:69`) is `[ruled Steve
2026-09-05, BRAIN-T260905-33]`: level 1 of the Gym runs two threads, one per
side, on the tile board's two bottom diagonals; level 2 and up in the Gym, and
live play, run four threads total, two per side, which is the tile board's
full capacity; six threads belongs only to compact mode, when it ships. It is
enforced on placement, so the refusal a player reads names the number.
`RESOLUTION_TOKENS = ["👍", "👀"]` (`lib/board/rules.ts:45`)
is `[ruled]` 2026-08-23; three more tokens (`🔍`, `⚖️`, `🍷`) exist in code as
`DEFERRED_RESOLUTION_TOKENS` (`lib/board/rules.ts:53`) but are not accepted by
`isResolutionToken`, so nothing can place one yet. This is
intended-but-unbuilt, gated behind a progression system that does not exist
today (section 9). The thread ceiling and the token vocabulary are both things
a player can see change, so `rules.md` is their home and this section names
only where the code holds them.

## 6. AI integration

One model call per tile, made by `evaluateTile()` in `lib/coach/evaluate.ts`.
Model: `claude-haiku-4-5-20251001` (`COACH_MODEL`), pinned over Sonnet 5 by a
measured tradeoff recorded in the file's own comment
(`BIZ-T260823-78`: Haiku never speaks up on a clean reason, which is the
expensive failure to avoid; a silence where a card was wanted is the cheap
one). Call shape: `Anthropic` SDK client, `timeout: 12_000` ms
(`TIMEOUT_MS`), `maxRetries: 1`, `max_tokens: 900`, a forced tool call
(`tool_choice: { type: "tool", name: "record_reading" }`) so the model must
return structured output matching the `record_reading` tool schema:
`relation` (`supports`/`rebuts`/`irrelevant`), `violations` (array from a
nine-key fallacy checklist ported from a Northwestern study evaluator, see
`lib/coach/checks.ts`), `off_root`, `clarification_needed`, `trigger_phrase`,
`feedback`, `suggestion`, `suggestion_preserves_stance`,
`suggestion_confidence`. Input: the game's current topic, the text at the
root of the tile's thread (or null if the tile starts a thread), and the
tile's own text.

Failure and timeout handling: `evaluateTile` wraps the entire call in a
try/catch and returns `null` on any failure, parse error, missing tool-use
block, or timeout, with no retry beyond the SDK's own `maxRetries: 1`. Its
caller, `runCoach()` in `lib/coach/run.ts`, treats `null` (and a verdict with
zero cards) as "say nothing" and returns silently. The function's own comment
states the design intent directly: "The coach is an offer, not a gate (Steve,
2026-08-23)." A missing `ANTHROPIC_API_KEY`, a network failure, or a
12-second timeout all produce the same visible behavior to a player: no
coach reading appears for that tile, and the game continues unaffected.

**This directly contradicts a fact this document was instructed to treat as
`[ruled]`: "the referee is the AI, AI inference is on the critical path of a
turn."** The code says the opposite, in three independent places:

- `app/game/[gameId]/actions.ts`'s `placeTile` action appends the
  `tile_placed` event and returns a success response to the browser, then
  schedules `runCoach(...)` via Next's `after()` API, which by definition
  runs after the response has already gone out.
- `lib/coach/run.ts`'s own comment: "This runs after the tile is already in
  the log, never before it. A player waiting on a model call to see their
  own tile land would feel the coach as lag; instead the tile appears at
  once and the reading arrives a second later over realtime."
- `runCoach`'s outer try/catch is deliberately silent on any AI failure
  specifically so that a coach failure changes nothing the player can see.

The AI call exists, is real, and is gated per-player behind
`players.coach_enabled` (on by default since `0016_coach_on_by_default.sql`;
`runCoach` checks it at `lib/coach/run.ts:55` before spending a call). But it
is advisory feedback on a move already committed,
not a gate a turn passes through, and it is not the game's referee: legality
of a move is decided entirely by `lib/board/rules.ts`, a pure TypeScript
function with no model call in it. Whatever the phrase "AI inference is on
the critical path of a turn" was meant to describe, it does not describe how
this codebase runs a turn today. Treat the given fact as the intended
direction and the code above as what actually ships; do not silently pick
one.

On success, two events may be appended: `ai_feedback_returned` (the full
reading, capped at 16384 bytes, the largest ceiling in the catalogue) and,
only if the model offered a rewrite that fits inside `TILE_MAX_CHARS`,
`coach_nudge_delivered` (the "dare," a separate event because "the coach saw
something" and "the coach put words in front of you" are different facts
worth telling apart later). A verdict with zero cards is not logged at all:
"silence is the normal answer," and logging every null result would bury the
readings that matter.

The coach is suppressed entirely, not merely defaulted off, whenever a board
is in Gym mode: `CoachPanel` (`components/board/coach-panel.tsx`, its own
card rather than a section inside a floating panel) is rendered only when
`board.mode !== "gym"` `[unratified]`
(`components/board/live-board.tsx:3752-3754`), with a comment explaining the
reasoning immediately above it: the Gym's Director already runs a scripted
coach at the top of the board, and a player's own coach preference is not a
Gym setting, so neither the panel nor a toggle for it exists there regardless
of `coachEnabled`. This is distinct from `players.coach_enabled`
(which governs live games only) and is tied to no registry
decision; a coding agent should not assume the Gym's own
scripted director (`components/gym/director.tsx`, `lib/gym/script.ts`) is
"the coach" under a different name, the two systems are unrelated code
paths.

## 7. Identity and auth

Exactly one Supabase project is referenced anywhere in this codebase
(`SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`). A separate, planned
third-project identity split described in a 2026-08-25 proposal doc is not
built; see section 9.

Three client tiers, `lib/supabase/`:

- `server.ts`, `serviceClient()`: service-role key, bypasses RLS entirely,
  `server-only`, used by every `lib/db/*` and `lib/events/*` read/write.
- `session.ts`, `sessionClient()`: the authenticated user's own session,
  `currentPlayerId()` resolves identity via `auth.getUser()`, never the
  insecure `getSession()`.
- `browser.ts`, `browserClient()`: publishable key only, RLS-gated, no
  write path exists through it for game state.

`proxy.ts` (Next 16's rename of `middleware.ts`) refreshes the session
cookie on every request and implements a dev-only anonymous autologin: gated
on `NODE_ENV !== "production"` AND `PT_DEV_AUTOLOGIN === "1"`, inert
otherwise.

Identity is anonymous-first, no password, ever. `POST /api/auth/anonymous`
creates a real anonymous Supabase user (which trips the `players`-row
creation trigger) and assigns a display name via `ensureDisplayName()`
(`lib/db/players.ts`): idempotent, race-safe (`UPDATE ... WHERE display_name
IS NULL`, retries on Postgres unique-violation `23505`, re-reads on a lost
race), drawing from a word list (`lib/names/wordlist.ts`,
`generateDisplayName()`/`numericTail()` in `lib/names/generate.ts`).
`/settings` lets a player attach an email; confirming it stamps
`players.claimed_at` purely by the `0009` database trigger, never by
application code (section 4). `/signin` uses Supabase magic-link OTP with
`shouldCreateUser: false`, and deliberately swallows "unknown address"
errors so a failed sign-in attempt cannot be used to test which emails have
accounts. PKCE via `@supabase/ssr` means a magic link only completes in the
browser that requested it.

A dev hot-seat mechanism lets one person drive both seats locally:
`lib/dev/hotseat.ts` overrides `currentPlayerId()`, surfaced by
`components/dev/hotseat-bar.tsx` and `app/api/dev/hotseat/route.ts`. The
override changes identity only, never authorization: seat and role checks
still come from the database, and the whole mechanism is 404/inert outside
dev per `hotseatAllowed()`.

A security incident is worth carrying forward as a standing caution rather
than a footnote: per `2026-08-22_platform-rebuild-handoff.md`, an earlier
migration left `game_events` reachable with the publishable key alone (a
"PUBLIC-grant trap," Postgres's default grant to `PUBLIC` on a newly created
function/table surviving an owner's later, narrower grant), and a forged
event was actually written that way before it was caught. The fix pattern,
`revoke ... from public` before `grant ... to service_role`, is now applied
explicitly and re-stated on every migration that touches `player_stats`
(`0005`, `0010`, `0011`), specifically so a reader of any one file alone
cannot conclude the function is open.

## 8. Architectural decisions and rationale

- **Event log as the single source of truth.** `games` and `game_players`
  are disposable projections; the log is what actually persisted. Rationale:
  a bug in a projection is fixable by replaying, never by data recovery.
- **Append-only, no UPDATE/DELETE, ever.** `[ruled]`, Steve 2026-08-22: "we
  want all the data, there is a separate deletion event"
  (`content_redacted`). Rationale: a corrupted history is worse than a
  visibly-marked redaction.
- **Per-type schema_version, never a global one.** Rationale: one event
  type's shape can evolve without forcing every other type's readers to
  re-check a version they do not care about.
- **Ordering via a transaction-scoped advisory lock keyed on `game_id`.**
  Rationale: serializes concurrent appends to the same game without locking
  unrelated games against each other.
- **One TypeScript Anthropic SDK call, not a separate Python pipeline.**
  `[ruled]`, 2026-08-19. Confirmed built: `@anthropic-ai/sdk` is a real
  dependency and `lib/coach/evaluate.ts` makes exactly one call per tile.
- **The coach runs after the response, not before it.** See section 6.
  Rationale, in the code's own words: a player waiting on a model call to
  see their own tile land would feel it as lag.
- **The coach is an offer, not a gate.** `[ruled]`, Steve 2026-08-23.
  Rationale: any AI failure mode (timeout, bad key, unparseable output)
  degrades to silence, never to a blocked turn.
- **Haiku over Sonnet for the coach model.** `[ruled]`, `BIZ-T260823-78`.
  Rationale: measured on twelve paired fixtures, Haiku's only failure mode
  is silence on a reason that deserved a card, which is the cheap failure;
  Sonnet's better accuracy did not justify its cost and latency for that
  gap.
- **Coach readings are visible only to the player they were written for**,
  enforced by RLS (`0008`), not by client-side hiding. Rationale, in the
  migration's own words: "the UI is a promise and RLS is enforcement."
- **RLS denies by default; every grant is explicit and re-stated per
  migration touching a sensitive function.** Rationale: the PUBLIC-grant
  incident (section 7) showed that an implicit, inherited grant is invisible
  until exploited.
- **`player_stats` and `create_game` are Postgres functions granted to
  `service_role` only, never `authenticated`.** Rationale: both take a
  caller-supplied id or produce a row with side effects that must not be
  trusted to an arbitrary authenticated caller.
- **No topic column on `games`.** Rationale, `lib/db/games.ts`'s own
  comment: the topic is something players said, so it belongs in the log
  like everything else they said, not as a second place the same fact can
  drift.
- **Anonymous accounts first, magic-link email attachment second, no
  passwords anywhere.** Rationale (implicit in the auth routes): the game
  should be playable with zero signup friction; an email is an upgrade, not
  a gate.

## 9. Intended but not built

- **A third, separate Supabase project for shared identity across the
  Point Taken family**, described in a 2026-08-25 proposal doc. Not present
  in any current code: every `lib/supabase/*.ts` client references exactly
  one project. This is a proposal, not an in-progress migration.
- **A progression system gating three more resolution tokens** (`🔍`, `⚖️`,
  `🍷`) beyond the two that ship today (`👍`, `👀`). The tokens exist as
  `DEFERRED_RESOLUTION_TOKENS` in `lib/board/rules.ts` but are not accepted
  anywhere; nothing can place one.
- **The Gym is built, not pending. It ships, playable end to end, all four
  levels**, so it belongs in this section only as a boundary marker for what
  around it is still sketch.
  `SCRIPTED_LEVELS` (`lib/gym/levels/index.ts:8`) holds four playable levels
  (onboarding/Bashful Bob, ground rules/Rambling Rosa, claim size/Braggy
  Bogdan, clarity/Sloppy Salma), driven by a pure script-walk engine
  (`lib/gym/script.ts`) and server actions (`startLevel`/`bossAct` in
  `app/gym/actions.ts`). Progression persists for real, event-sourced, via
  the four award events added in `0014_awards.sql` (`level_cleared`,
  `badge_granted`, `points_changed`, `certificate_granted`; see section 4)
  and an idempotent writer (`lib/gym/awards.ts`) that never awards for a live
  game, an abandoned or timed-out game, or the boss. `app/gym/page.tsx` is a
  bare `redirect("/#ladder")` and nothing else: the ladder strip on the
  Profile screen is the level select, and `/gym` exists only so old links land
  somewhere `[ruled]` (`BRAIN-T260904-22`). See the next bullet for what
  progression data on the profile is real versus still invented, and the
  standing open question (`BRAIN-T260817-02`) on any level named or numbered
  above 4.
- **Progression display is a mix of real and still-invented data, deliberately
  seamed apart in code.** `lib/progression/state.ts` computes what is real
  from the event log: level clears, earned cards, badge counts, points, and
  certificates. `lib/progression/sample.ts` is a separate file whose own
  header comment states plainly that "every number, date and streak in this
  file is invented" `[unratified]`; it backs whatever is not yet real,
  including any rung past level 4, badge names and icons, and the
  cooperation/percentile/rank/division tiles shown on the profile and
  leaderboard. Wherever a screen mixes the two, `SampleTag` marks the
  invented parts on screen (`components/cards/sample-tag.tsx`,
  `components/account/progression/sample-tag.tsx`). A coding agent should not
  assume a number on the profile is real just because it looks like one of
  the real award types; check which of the two files supplied it.
- **The three-way 👀 split (fact/priorities/taste)**, the deferred 🔍 ⚖️ 🍷
  tokens of `DEFERRED_RESOLUTION_TOKENS`, which take the five-token vocabulary
  to its full size, referenced in
  `lib/board/rules.ts`'s comments as Steve's 2026-07-09 intent, gated behind
  the same not-yet-built progression system.

## 10. Known risks and gaps

- **GAP: what hosting tier and region does the deployed app run on?**
  Discussed in `2026-08-22_platform-rebuild-handoff.md` as pending, not
  confirmed in code.
- **The app is live on Vercel, project id `prj_lHzLzr7QQw1FNagOceDJrsksGiqF`
  (`.vercel/project.json`)**, served at
  `https://point-taken-2026.vercel.app`, with
  `/api/health?deep=1` the fastest proof it is talking to the right database
  with every migration applied `[unratified]`. `main` is the only branch;
  every push to it deploys. There is no branch-pinned production and no
  release branch to reconcile against.
- **There is no turn clock: no speaker timer and no summarize timer.** Turn
  timers are out of scope for Brain and belong to the Heart edition
  `[ruled Steve 2026-09-03, BRAIN-T260903-01]`. `WinCondition`'s `"timeout"`
  value (`lib/db/types.ts`) and `lib/games/abandon.ts` are an unrelated
  abandon-the-game path with no writer of its own, and are not a turn clock
  under a different name.
- **Doc contradicts code, AI critical path.** See section 6 in full. The
  given fact "AI inference is on the critical path of a turn" is
  contradicted by `app/game/[gameId]/actions.ts` (uses `after()` to run the
  coach post-response), by `lib/coach/run.ts`'s own comment, and by its
  silent-failure design ("the coach is an offer, not a gate").
- **`CLAUDE.md`'s health-check paragraph names a catalogue count the code
  disagrees with.** It says `/api/health?deep=1` "should report 28 catalogue
  types in the database, 28 in code"; the code carries 32 distinct event type
  names (`EVENT_TYPE_NAMES`, `lib/events/types.ts`) across 33 catalogue rows.
  `CLAUDE.md` is outside this document's lane, so the number is flagged here
  rather than fixed there.
- **The advisory-lock ordering mechanism and the exact grant SQL for
  `player_stats`'s card-stats extension (`0010`, `0011`) were read at the
  grant/function-signature level, not line by line.** Low risk: the pattern
  is identical and explicitly re-stated across all three migrations that
  touch this function, but a reader wanting the exact column set added by
  `0010_card_stats.sql` should open it directly.
- **Two items `CLAUDE.md` itself lists as still moving, not settled**:
  level/badge taxonomy naming and any level above 4 (`BRAIN-T260817-02`), and
  the coach's turn shape beyond what section 6 confirms. The thread ceiling is
  settled: two threads, one per side, on level 1 of the Gym; four threads, two
  per side, on level 2 and up in the Gym and in live play; six threads only in
  compact mode, when it ships `[ruled Steve 2026-09-05, BRAIN-T260905-33]`.
  The signing ritual is settled at three lines (`rules.md` section 3, and
  `SIGNING_LINES` at `lib/board/setup.ts:49` ships three, ids
  `mutual_respect` / `honest_thinking` / `shared_facts`, the third of which
  displays as Shared Evidence while keeping its id).
- **Confidence is uneven across `0001`-`0016`.** For the event vocabulary
  specifically the TypeScript and the CI catalogue test
  (`lib/events/catalogue.test.ts`) are the higher-confidence source, since
  that test is what keeps the SQL and TypeScript from drifting. `0001`,
  `0002`, and `0004` are covered here through those code reads
  (`lib/events/types.ts`, `lib/db/types.ts`) rather than a line-by-line read
  of their SQL.
