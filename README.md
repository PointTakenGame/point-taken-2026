# point-taken-2026

The rebuilt Point Taken game: Next on Vercel, Supabase for Postgres + Auth + Realtime, Resend for
mail. Replaces the Nuxt frontend / Express backend / DynamoDB stack in `../point-taken-frontend`
and `../point-taken-backend`.

Repo: `PointTakenGame/point-taken-2026` (private). It lives inside the brain agent's working tree
but has its own git history and its own remote; nothing here is tracked by the outer repo.

Supabase project `point-taken-2026`, ref `tvtmltchotkzviqaywdy`, us-east-1. Credentials live in
`../../../point-taken-biz/api-keys/supabase-point-taken-2026.env`, which is gitignored and outside
this tree. Nothing in here holds a secret.

## Layout

```
app/                    Next App Router. /api/health is the deploy probe.
app/account/            the post-login page: name, counters, game history
app/api/auth/anonymous  POST to sign in with no email and get named
lib/events/types.ts     the 28 event types in TypeScript, mirroring the database
lib/events/append.ts    the only write path: appendGameEvent / appendGameEvents / readGameEvents
lib/db/types.ts         players, games, game_players: read-shaped, because a trigger writes them
lib/db/games.ts         createGame and the reads over those tables
lib/games/joinCode.ts   the six-character room code a player reads aloud
lib/db/players.ts       player reads and ensureDisplayName, the one player write
lib/db/stats.ts         getPlayerStats, a thin wrapper over the player_stats function
lib/names/              the display-name word list (content) and the draw (mechanism)
lib/supabase/server.ts  service-role client, server-only, never importable from a client component
lib/supabase/session.ts the signed-in player's own client, and currentPlayerId()
proxy.ts                keeps the session cookie fresh (Next 16's name for middleware)
supabase/migrations/    ordered SQL, applied in filename order
```

## The one thing to read first

`supabase/migrations/0001_event_log.sql` and its prose half,
`../../docs/reference/materials/spec/2026-08-19_event-log-contract.md` (registry row
`BRAIN-T260819-18`). Every projection, badge criterion, analytic, and replay reads that table, so
its shape is the hardest thing here to change later. The type catalogue is
`0002_event_type_catalogue.sql` plus `../../docs/reference/materials/spec/2026-08-22_event-type-catalogue.md`.

`0004_identity_and_games.sql` adds the tables the log points at, with
`../../docs/reference/materials/spec/2026-08-22_identity-and-read-models.md` as its prose half
(registry row `BRAIN-T260822-09`). **`games` and `game_players` are read models.** One trigger on
`game_events` maintains them and nothing else may write them. If you find yourself updating a game's
status by hand, the event you should have appended is the actual fix.

**A live game draws its own join code.** `createGame` picks one from a 32-character alphabet with
0/O and 1/I removed, because codes get spoken and handwritten (`BRAIN-T260713-12`), and redraws on
a collision. The database is what actually guarantees uniqueness: `games_join_code_open_key` is a
**partial** unique index over open games only, so a code frees up when its game ends. A caller who
passes an explicit code gets told it is taken rather than quietly given a different one. Registry
row `BRAIN-T260714-67`.

`players.display_name` is null until the app assigns one. **The word list is content, so it lives in
`lib/names/wordlist.ts`, not in a migration**, and `ensureDisplayName` in `lib/db/players.ts` is the
only thing that writes it: a guarded update that fires only while the column is still null, so two
concurrent callers cannot overwrite each other. Registry row `BRAIN-T260714-71`.

`0005_player_stats.sql` adds `player_stats(uuid)`, the account-page counters: games played and
completed, thread resolutions by emoji, tiles placed, and revised-topic wins. **Nothing is cached.**
Every one of those facts is already in the log, so a stats column on the player row would be a
second source of truth that goes stale the first time a projection changes. Add a projection table
when a real page is measurably slow, not before. The function is granted to **service_role only**:
it takes a player id and does not check it against the caller, so granting it to `authenticated`
would let anyone count anyone. `lib/db/stats.ts` is the wrapper. Registry row `BRAIN-T260714-70`.

**Players sign in anonymously first.** `POST /api/auth/anonymous` creates a real auth user with no
email and no password, which makes the `players` row by trigger and names it in the same call. An
email attached later claims that same account instead of making a second one. Session cookies are
refreshed in `proxy.ts`: that file is Next 16's rename of `middleware.ts`, so every Supabase guide
you find will use the old name. Read the session with `currentPlayerId()`, which asks the auth
server; `getSession()` trusts a cookie the browser could have written and must never gate a page.

`/account` is the page a player lands on: display name, headline counters from `player_stats`, and
every game they have been in. It is plain on purpose. Rannie's profile frames carry a level ladder,
a ranked division and a cooperation score that are not decided yet (`BRAIN-T260817-02`), and
re-opening a past board waits on a board renderer. Registry row `BRAIN-T260714-69`.

**The database is the authority and `lib/events/types.ts` mirrors it.** Adding an event type means
a migration first, then the TypeScript. Changing one without the other is a bug in the TypeScript.

## Running it locally

```
cp .env.example .env.local     # fill from the api-keys file above
npm install
TMPDIR=/tmp npm run dev
```

`http://localhost:3000/api/health?deep=1` should report 28 catalogue types in the database, 28 in
code, empty `missing_in_db` / `missing_in_code`, and a `tables` block with a count for each of
`players`, `games`, `game_players`, and `game_events`. That is the fastest proof the app is talking
to the right project with every migration applied.

**`TMPDIR=/tmp` is a local quirk, not a project setting.** Turbopack's postcss worker cannot bind
its socket under a very long temp path, and the sandbox this repo is usually developed in hands out
exactly that. It panics with `binding to a port: Operation not permitted`. Vercel is unaffected, so
`npm run build` stays plain `next build`. `next build --webpack` also sidesteps it.

`npm test` runs the vitest suites under `lib/` (the name generator and the naming race). They are
pure unit tests: nothing in them touches Supabase, so they need no credentials and no network.

`npx tsc --noEmit` needs one `next build` first: Next 16 generates the typed-routes globals
(`LayoutProps`, `PageProps`) into `.next/types` at build time, so on a clean checkout tsc fails on
names that do not exist yet.
