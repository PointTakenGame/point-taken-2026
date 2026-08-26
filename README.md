# point-taken-2026

The rebuilt Point Taken game: Next on Vercel, Supabase for Postgres + Auth + Realtime, Resend for
mail. Replaces the Nuxt frontend / Express backend / DynamoDB stack in `../point-taken-frontend`
and `../point-taken-backend`.

Repo: `PointTakenGame/point-taken-2026` (private). It lives inside the brain agent's working tree
but has its own git history and its own remote; nothing here is tracked by the outer repo.

Supabase project `point-taken-2026`, ref `tvtmltchotkzviqaywdy`, us-east-1. Credentials live in
`../../../point-taken-biz/api-keys/supabase-point-taken-2026.env`, which is gitignored and outside
this tree. Nothing in here holds a secret. If you cloned this repo standalone (no
`point-taken-biz` alongside it), you won't have that path either way: Steve sends the four
`.env.local` values directly (see "Running it locally" below).

## What the game is

Code questions are answered here. Design questions are answered by the docs in `docs/design/`
and `docs/spec/` in this repo, and where anything else disagrees with those files, they win:

- **Levels 1 to 4, the game itself** (beats, bosses, cards, badges, points):
  `docs/design/2026-08-22_gym-levels-1-4-implementation-guide.md`. This is the source of record.
- **What skill each level teaches, and why in that order:**
  `docs/design/2026-08-22_skill-ladder-levels-1-4.md`.
- **Account screens and the entities behind them:**
  `docs/design/2026-08-23_account-pages-entity-list.md`.
- **Build order:**
  `docs/roadmap/2026-08-16_dev-roadmap.md`.

Levels 5 to 8 are not designed yet. The one document that touches them,
`2026-08-04_level-build-table.md`, is mostly superseded (only its levels-5-to-8 half still
stands, and even that is provisional) and is not copied into this repo. It lives in the brain
agent's tree at `point-taken-brain/docs/reference/materials/roadmap-consolidation/`, which this
repo cannot see from a standalone clone. If levels 5 to 8 become active work, ask Steve for that
file rather than guessing at scope.

The Gym (the scripted practice ladder those documents describe) is **not** what this codebase
builds today. Steve's 2026-08-17 scope ruling took the scripted opponent off the critical path,
because the prototype is live play against a human. The design documents above are what the account
and the coach have to be compatible with, not a description of what currently runs.

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
docs/design/            game-design source docs: levels, skill ladder, account entities
docs/spec/              architecture prose behind the migrations: event log, catalogue, identity
docs/roadmap/           build order
```

The docs under `docs/` are copies of documents whose canonical version lives in the brain agent's
own tree (`point-taken-brain/docs/reference/materials/`). They're copied in here so a standalone
clone of this repo is self-contained; if the canonical version changes, these copies go stale
until someone re-copies them. Check with Steve if a doc here looks like it might be outdated.

## The one thing to read first

`supabase/migrations/0001_event_log.sql` and its prose half,
`docs/spec/2026-08-19_event-log-contract.md` (registry row
`BRAIN-T260819-18`). Every projection, badge criterion, analytic, and replay reads that table, so
its shape is the hardest thing here to change later. The type catalogue is
`0002_event_type_catalogue.sql` plus `docs/spec/2026-08-22_event-type-catalogue.md`.

`0004_identity_and_games.sql` adds the tables the log points at, with
`docs/spec/2026-08-22_identity-and-read-models.md` as its prose half
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
cp .env.example .env.local     # fill in the values Steve sends you (see .env.example's comments)
npm install
TMPDIR=/tmp npm run dev
```

`http://localhost:3100/api/health?deep=1` should report 28 catalogue types in the database, 28 in
code, empty `missing_in_db` / `missing_in_code`, and a `tables` block with a count for each of
`players`, `games`, `game_players`, and `game_events`. That is the fastest proof the app is talking
to the right project with every migration applied.

**`TMPDIR=/tmp` is a local quirk, not a project setting.** Turbopack's postcss worker cannot bind
its socket under a very long temp path, and the sandbox this repo is usually developed in hands out
exactly that. It panics with `binding to a port: Operation not permitted`. Vercel is unaffected, so
`npm run build` stays plain `next build`.

`build:local` is that same Turbopack build with `TMPDIR` set, so the local gate gets compiled by
the same bundler Vercel will use. It carried `--webpack` until 2026-08-24 as a second way around
the socket panic; setting `TMPDIR` turned out to be enough on its own, and a gate that builds with
a bundler production never sees is a gate that can pass while the deploy fails.

`npm test` runs the vitest suites under `lib/` and `components/`. They are pure unit tests:
nothing in them touches Supabase, so they need no credentials and no network. The one exception
skips itself, the coach bake-off in `lib/coach/coach-eval.test.ts`, which runs only when
`COACH_EVAL=1` is set and a real Anthropic key is loaded.

`npx tsc --noEmit` needs one `next build` first: Next 16 generates the typed-routes globals
(`LayoutProps`, `PageProps`) into `.next/types` at build time, so on a clean checkout tsc fails on
names that do not exist yet.

## The gate

Five commands. All five have to pass before a commit is worth pushing:

```
npx tsc --noEmit
npx eslint app lib components proxy.ts
npx prettier --check .
npx vitest run
npm run build:local
```

`.github/workflows/gate.yml` runs the same five on every push and pull request, in build-first
order for the tsc reason above. It needs no secrets: every page is `force-dynamic` and nothing is
fetched at build time, so placeholder Supabase values are enough to compile, and the only test that
wants a real key skips itself. If you add a step to the gate, add it in both places.
