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
  - point-taken-brain/web/point-taken-2026/lib/board/project.ts (referenced, not opened this pass)
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
  - point-taken-brain/web/point-taken-2026/supabase/migrations/0001 through 0011
  - point-taken-brain/docs/reference/materials/2026-08-22_platform-rebuild-handoff.md
  - point-taken-brain/docs/reference/materials/spec/release-hygiene.md
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

From `package.json`, read directly, current as of this pass:

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

Runtime shape: every route is `export const dynamic = "force-dynamic"`, so
there is no static page cache to reason about and no build-time secret
requirement. Hosting target (Vercel tier, region) is `[unratified]`, discussed
in `2026-08-22_platform-rebuild-handoff.md` but not confirmed in code or a
registry ruling; GAP: what hosting tier and region does the deployed app
actually run on.

The database is a single Supabase project, Postgres 17.6, per
`2026-08-22_platform-rebuild-handoff.md` (project ref and region named there,
not re-quoted here since this doc does not carry infra identifiers a reader
could act on without the source file). No values from `../point-taken-biz/api-keys/`
were read for this document; those env files are referenced by variable name
only: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `ANTHROPIC_API_KEY`, `PT_DEV_AUTOLOGIN`,
`COACH_EVAL`.

An older AWS stack (Nuxt3, Express5+Socket.io, DynamoDB, Cognito, Elastic
Beanstalk, S3/CloudFront) preceded this one and is fully superseded; it is
history, not current architecture, and is not described further here.

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
- `lib/dev/hotseat.ts`: dev-only identity override, inert outside
  `NODE_ENV !== "production"`.
- `components/board/`: `live-board.tsx` (the active game UI),
  `use-game-feed.ts` (the Supabase Realtime subscription), `game-setup.tsx`,
  `finished-map.tsx`, `ending.tsx`.
- `components/dev/hotseat-bar.tsx`: the dev hot-seat UI bar.
- `supabase/migrations/`: 11 numbered SQL files, `0001` through `0011`,
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
5. The page branches on `board.status`: `ended` renders `Ending` +
   `FinishedMap` + `WinOverlay`; `lobby` (or `active` with no role yet)
   renders `GameSetup`; `active` with a role renders `LiveBoard`.

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
SQL this pass). UPDATE and DELETE are blocked by trigger: `[ruled]`, Steve
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

**`public.players`** (also `0004`, altered by `0007_coach_setting.sql` and
`0009_claim_account.sql`): one row per authenticated human, created by a
trigger on `auth.users` so the anonymous signup path cannot skip it.
`PlayerRow`: `id`, `display_name` (null until assigned), `claimed_at` (null
while anonymous), `created_at`, `coach_enabled` (boolean, added by `0007`,
default off). No points, badges, or token totals live on this row; everything
of that kind is derived live from the log.

**`public.player_stats(uuid)`** is a Postgres function
(`0005_player_stats.sql`, extended by `0010_card_stats.sql` and
`0011_stats_totals_match_breakdowns.sql`, both `create or replace` on the same
function signature, no new tables introduced by either), granted to
`service_role` only, explicitly revoked from `public`, `anon`, and
`authenticated` because it takes a player id as an argument without checking
who is calling. `lib/db/stats.ts` wraps it. Nothing is cached; every call
re-derives from the event log. `[ruled]`, no tokens/ledger exists in Brain
today: no migration in `0001`-`0011` creates a token table, consistent with
the given fact that Brain has no token ledger for now.

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

28 named event types, defined identically in `lib/events/types.ts`
(TypeScript, compile-time) and `0002_event_type_catalogue.sql` (Postgres,
runtime), with `lib/events/catalogue.test.ts` run in CI
(`.github/workflows/gate.yml`) asserting the two lists never drift:
`game_created`, `player_joined`, `role_selected`, `agreement_signed`,
`topic_set`, `game_started`, `player_left`, `game_ended`, `tile_placed`,
`tile_edited`, `tile_revised`, `tile_relocated`, `tile_removed`,
`resolution_emoji_placed`, `resolution_emoji_removed`, `thread_resolved`,
`proposal_made`, `proposal_accepted`, `proposal_rejected`, `topic_revised`,
`card_thrown`, `card_throw_declined`, `generosity_token_given`,
`ai_feedback_returned`, `ai_feedback_shown`, `coach_nudge_delivered`,
`gym_run_recorded`, `content_redacted`.

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
file's own comment: "Enforced both sides." This replaces an older citation to
a pre-rewrite Vue file that no longer exists in this codebase; the current
number is confirmed directly in TypeScript, not carried over from a stale
pointer.

`MIN_THREADS_TO_END = 4` carries a `GAP:` in its own source comment
(`lib/board/rules.ts`): Steve ruled the six-thread ceiling on 2026-08-23 but
did not restate this floor, so 4 is carried forward from the deployed 2024
server rather than freshly ratified (tracked `BRAIN-T260823-10`). `MAX_THREADS
= 6` is `[ruled]`, same date, same source. `RESOLUTION_TOKENS = ["👍", "👀"]`
is `[ruled]` 2026-08-23; three more tokens (`🔍`, `⚖️`, `🍷`) exist in code as
`DEFERRED_RESOLUTION_TOKENS` but are not accepted by `isResolutionToken`, so
nothing can place one yet. This is intended-but-unbuilt, gated behind a
progression system that does not exist today (section 9).

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
`players.coach_enabled` (off by default; `runCoach` checks this before
spending a call). But it is advisory feedback on a move already committed,
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
- **The Gym (scripted practice opponent, levels 1-4) is on the critical
  path** `[ruled]` (Steve, 2026-08-28), so progression persistence is in
  scope. This reverses a 2026-08-17 scope ruling that took the scripted
  opponent off the critical path. Three places in this repository still
  quote the superseded ruling and are stale, not authoritative: `CLAUDE.md`,
  `README.md`, and a comment in `app/gym/page.tsx`. Read them as history.
  Correcting them is tracked separately; this document is not the place it
  gets fixed. `GameMode` does still include `"gym"` as a real database and
  TypeScript value (`lib/db/types.ts`, `lib/board/rules.ts`'s
  `topicAgreementEndsGame`), and `appendGameEvents` (the batch RPC) exists
  specifically for validated gym runs, so gym mode is not entirely absent
  from the code; what the repo's own docs say is unbuilt is the scripted
  opponent and level content that would make it playable end to end.
- **The three-way 👀 split (fact/priorities/taste)** — the deferred 🔍 ⚖️ 🍷
  tokens of `DEFERRED_RESOLUTION_TOKENS`, which take the five-token vocabulary
  to its full size — referenced in
  `lib/board/rules.ts`'s comments as Steve's 2026-07-09 intent, gated behind
  the same not-yet-built progression system.

## 10. Known risks and gaps

- **GAP: what hosting tier and region does the deployed app run on?**
  Discussed in `2026-08-22_platform-rebuild-handoff.md` as pending, not
  confirmed in code.
- **GAP: does anything enforce a 30-second speaker timer or a 45-second
  summarize timer, client or server?** This document was given both numbers
  as `[ruled]` facts to state precisely where they are enforced. A direct
  search across `app/`, `lib/`, and `components/` for timer, timeout, and
  the literal values 30/45-as-seconds found no turn-clock logic anywhere.
  The one closely related artifact is `WinCondition`'s `"timeout"` value
  (`lib/db/types.ts`), and `lib/games/abandon.ts`'s own comment confirms
  the gap explicitly: "This is the only writer of `abandoned`. `timeout`
  still has none [a writer]." The concept of a timeout ending a game is
  represented in the type system; nothing produces it. The honest answer to
  "where are these timers enforced" is: nowhere yet.
- **Doc contradicts code, AI critical path.** See section 6 in full. The
  given fact "AI inference is on the critical path of a turn" is
  contradicted by `app/game/[gameId]/actions.ts` (uses `after()` to run the
  coach post-response), by `lib/coach/run.ts`'s own comment, and by its
  silent-failure design ("the coach is an offer, not a gate").
- **Gym critical path: settled, and three in-repo comments are stale.** The
  Gym levels 1 to 4 are on the critical path `[ruled]` (Steve, 2026-08-28).
  `CLAUDE.md`, `README.md`, and `app/gym/page.tsx` still quote the
  superseded 2026-08-17 ruling. See section 9.
- **`MIN_THREADS_TO_END = 4` is unratified**, carried forward from a 2024
  server rather than restated when the six-thread ceiling was ruled
  (`lib/board/rules.ts`, tracked `BRAIN-T260823-10`).
- **The advisory-lock ordering mechanism and the exact grant SQL for
  `player_stats`'s card-stats extension (`0010`, `0011`) were read at the
  grant/function-signature level, not line by line.** Low risk: the pattern
  is identical and explicitly re-stated across all three migrations that
  touch this function, but a reader wanting the exact column set added by
  `0010_card_stats.sql` should open it directly.
- **Three items `CLAUDE.md` itself lists as still moving, not settled**:
  level/badge taxonomy naming, the coach's turn shape beyond what section 6
  confirms, and whether the thread-count-to-end-a-game number (see above)
  should be treated as ratified. A fourth, whether the agreement is three
  lines or four, is settled at three (`rules.md` section 3, and
  `SIGNING_LINES` in `lib/board/setup.ts:31-35` ships three).
- **This document reflects one read of `0001`-`0011`.** `0001`, `0002`, and
  `0004` were previously confirmed via their own prose specs plus targeted
  code reads (`lib/events/types.ts`, `lib/db/types.ts`) rather than a full
  line-by-line reread of the SQL in this final pass; the TypeScript and the
  CI catalogue test (`lib/events/catalogue.test.ts`) are the higher-
  confidence source for the event vocabulary specifically, since that test
  is what keeps the SQL and TypeScript from drifting.
