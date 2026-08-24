# Point Taken: working agreement

@AGENTS.md

## Read this before you conclude the codebase is broken

**This repo is a deliberately rough prototype and the roughness is your assignment, not a
defect.** Almost every screen is unstyled black text on white. Copy is placeholder. Buttons
say what they do and nothing else. That is not neglect, it is where the work stopped on
purpose, because the thing being proved first was that the game runs end to end.

Underneath it, the event log, the projection, and the migrations are careful and load-bearing.
**The ugliness is on the surface, on purpose, and the care is underneath.** Do not infer from
bad copy that the architecture also needs rescuing. Fix the surface. Leave the gears.

## Your writable surface

You own the presentation layer: `components/`, `app/**/page.tsx`, `app/**/layout.tsx`, the
stylesheets, and every user-facing string wherever it sits.

## What the game is

Two players, one on the Plus side and one on the Minus side, disagree about a topic they type
themselves. They take turns writing short tiles, each a single reason, and hang each tile off
an existing one so the board grows as a tree of threads rather than a chat log.

A thread ends when both players place the **same** token on it, agreeing about what kind of
disagreement it turned out to be. Rule cards let one player challenge the other's tile; the
consequence is always that the target revises the tile, never that anyone loses a point.

Both win conditions are cooperative. Either the players resolve their threads, or they agree
on a revised wording of the topic itself.

There is no ruleset document in this repo. The design sources live in Steve's other working
folders, outside this git history, so nothing here can link to them. Ask Steve for these three
by name:

- `2026-08-22_gym-levels-1-4-implementation-guide.md`, the game itself at levels 1 to 4
- `2026-08-22_skill-ladder-levels-1-4.md`, what each level teaches and why in that order
- `2026-08-23_account-pages-entity-list.md`, the account screens and the entities behind them

Where those documents describe the practice ladder (the Gym), they describe something this
codebase does not build. Steve's 2026-08-17 scope ruling took the scripted practice opponent
off the critical path, because the prototype is live play against a human. Treat them as what
the account and the coach must stay compatible with, not as a description of what runs today.

## The one architectural fact

**The event log is truth. Every aggregate is a cache.**

`game_events` is append-only and ordered by `(game_id, seq)`. Everything else, including the
`games` and `game_players` tables, is a read model maintained by a trigger. A board is
`projectBoard(events)` and nothing else. A correction is a new corrective event, never an edit
to an old row.

If you find yourself updating a game's status by hand, the event you should have appended is
the actual fix.

## Core files: do not edit, route instead

- `lib/events/` and `lib/board/`
- `supabase/migrations/**`
- anything that adds, renames, or removes an event type
- anything that changes the shape of an existing payload

The event vocabulary is written down twice, in `lib/events/types.ts` and in
`supabase/migrations/0002_event_type_catalogue.sql`. **CI asserts the two agree**
(`lib/events/catalogue.test.ts`, run by `.github/workflows/gate.yml`). If that test fails, the
fix is to make them agree. Never change the test.

## When your task needs a core file

1. Tell Nathan what you need and why, before writing it.
2. Ship whatever part of the task is possible without the core change.
3. The core part goes in its own pull request, separately reviewed.

Core changes are not forbidden. They are just never approved as a side effect of something
else. **Do not merge your own pull requests.**

## Running it and playing it

```
cp .env.example .env.local     # Steve supplies the values
npm install
TMPDIR=/tmp npm run dev        # http://localhost:3100
```

`TMPDIR=/tmp` is a local workaround, not a project setting: Turbopack's postcss worker cannot
bind its socket under a very long temp path and panics with `binding to a port: Operation not
permitted`. If your temp path is short you will never see it, and Vercel is unaffected.

`http://localhost:3100/api/health?deep=1` is the fastest proof the app is talking to the right
database with every migration applied. It should report 28 catalogue types in the database, 28
in code, and empty `missing_in_db` / `missing_in_code`.

**Driving both seats yourself.** A real game needs two people, and there is no practice
opponent, so local dev has a hot seat. Set `PT_DEV_AUTOLOGIN=1` in `.env.local` and a yellow
`DEV HOT SEAT` bar appears at the bottom of the home page and of any board. From it:

- **`+ practice opponent`** mints a second anonymous player, seats them in the game you are
  looking at, and puts you in that new seat. This is how a one-person game becomes two-handed.
- **the player buttons** switch you between the two seated players, so you can take a turn as
  Plus, click, and take the next as Minus.
- **`back to my own login`** drops the override and returns you to your own session.

The switch is an override of `currentPlayerId()`, the single function every read and every
write already goes through, so nothing downstream has a dev branch in it. Seat checks still
apply and `actor_role` still comes off the database rather than off anything the client sent.
The bar renders only where `PT_DEV_AUTOLOGIN=1` and `NODE_ENV` is not production, and the route
behind it 404s everywhere else, so a deploy carries nothing.

The bar is visible whenever dev mode is on, whether or not an override is currently active, so
its presence is not a sign that you are in somebody else's seat.

**Two route gotchas.** `/join/<CODE>` takes the six-character room code a player reads aloud
and redirects to `/game/<uuid>`. `/game/` itself takes the UUID, so `/game/<CODE>` is a 404,
not a bug. And there is no host role in setup: either seated player can set the topic and start.

**When a board renders wrong, look upstream of the projection, never inside it.** The board is
a pure function of the events. If it shows the wrong thing, either the wrong event was written
or the right one was not.

## The gate

Five commands. All five have to pass before you push:

```
npx tsc --noEmit
npx eslint app lib components proxy.ts
npx prettier --check .
npx vitest run
npm run build:local
```

`.github/workflows/gate.yml` runs the same five on every push and pull request, in build-first
order: Next 16 generates the typed-route globals (`PageProps`, `LayoutProps`) into `.next/types`
at build time, so on a fresh checkout `tsc` fails on names that do not exist until a build has
run once. If you add a step to the gate, add it in both places.

Formatting is prettier, wired as `npm run format` and `npm run format:check`. Markdown is not
checked; everything else is, YAML included.

CI needs no secrets. Every page is `force-dynamic` and nothing is fetched at build time, so
placeholder values compile, and the one test that wants a real API key skips itself.

## Content lives inline, and that is on purpose

There is no `content/` directory. Strings sit next to the components that render them, and
the coach's card set sits in `lib/coach/cards.ts`. Extracting all of it into a content layer is
deliberately deferred until the wording stops moving.

**Ids stay stable.** A card is `you_is_taboo` or `stick_to_root` forever, whatever its display
name becomes. Rename freely. Renumber never. The same goes for event type names, which are
foreign-keyed in the database.

**Content never carries its own logic.** If a string needs to know the game state to decide
what it says, that decision belongs in code and the string takes it as an input.

## Political neutrality is a bright line

Point Taken is a game about disagreement and it cannot be seen to take a side. Every
politically perceptible example needs an equally vivid counterpart from the opposite
direction, or an explicit note that the set is unbalanced and why.

Two corrections to what you may have been told about how this is enforced here, because the
mechanism does not exist yet in this repo:

- **There are no topics in the codebase.** Players type their own, up to 300 characters. There
  is no topic list to keep balanced and no counterpart-id mechanism.
- **CI does not check neutrality.** No such test exists.

So the rule is currently enforced by whoever is writing, which for now means you. It applies to
example text you add anywhere: placeholder copy, help text, screenshots, and in particular the
coach's test fixtures in `lib/coach/fixtures.ts`, which state the requirement at the top of the
file. If you add a politically readable example without its counterpart, nothing will stop you.
That is exactly why it is written down here.

## Working style

- Small pull requests. One concern each.
- **Play what you change.** Open a board, run the hot seat, take a turn on both sides.
- Do not reformat files you were not asked to change.
- If you cannot tell which lane something is in, it is a core file. Ask.
- **Never use the word "snitch" in code, comments, metric names, or player-facing copy. It is
  banned project-wide.**
- No em dashes anywhere: prose, comments, or copy.
- `AGENTS.md` is written and re-added by `next dev`. Removing it from a diff only re-creates
  the uncommitted change. Commit it with your work and the tree stays clean.

## What is settled and what is still moving

Settled, and not up for redesign in a surface pull request:

- event log discipline, and the projection as a pure function of it
- two seats, Plus and Minus, and a seat being permanent once taken
- the tile tree, and tokens as the way a thread ends
- both win conditions being cooperative
- permanent ids

Still moving, and known to be inconsistent between the code and the design documents:

- the number of agreement lines in the signing ritual, three in the brief and four in the Figma
- the level and badge taxonomy, and the name of every level
- the shape of the coach's turn
- how many threads a game must have before it can end (the code says four, carried forward from
  the old server rather than ratified, and says so in a comment)

**Do not resolve any of these by choosing one. Flag it.**
