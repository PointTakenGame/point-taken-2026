---
slot: ui-components.md
game: brain
purpose: Component inventory, design tokens, and interaction specs for a coding agent building a new BRAIN screen.
written: 2026-08-28 by biz
status: draft, unreviewed by Steve
sources:
  - point-taken-brain/web/point-taken-2026/app/globals.css
  - point-taken-brain/web/point-taken-2026/app/layout.tsx
  - point-taken-brain/web/point-taken-2026/components/ (all files)
  - point-taken-brain/web/point-taken-2026/app/ (all page files)
  - point-taken-brain/web/point-taken-2026/lib/board/rules.ts
  - point-taken-brain/web/point-taken-2026/lib/board/setup.ts
  - point-taken-brain/web/point-taken-2026/public/README.md
  - point-taken-brain/docs/reference/materials/design-briefs/2026-08-25_alerts-win-info-interaction-spec.md
  - point-taken-brain/docs/reference/materials/design-briefs/2026-08-19_rannie-figma-delta.md
  - point-taken-brain/docs/reference/materials/design-briefs/2026-07-23_brief_finished-map-and-thread-compression.md
  - point-taken-brain/docs/reference/materials/design-reference/ (viewed, not linked; see section 8)
  - point-taken-brain/web/point-taken-2026/components/gym/ (all files)
  - point-taken-brain/web/point-taken-2026/components/account/ (all files)
  - point-taken-brain/web/point-taken-2026/components/cards/ (all files)
  - point-taken-brain/web/point-taken-2026/lib/avatar.ts
---

# BRAIN: UI Components and Design System

This document describes only the BRAIN game, repo `point-taken-brain/web/point-taken-2026`. It says
nothing about Heart. Heart is a separate print/card game with its own separate design system in a
separate repo; do not carry any value from this document into Heart work, and do not read this document
as though it applied there.

Audience: a coding agent that has cloned this repo and needs to build a new screen that looks and
behaves like the rest of the game, with no other context.

## 1. Styling approach

Tailwind CSS v4, using the CSS-native `@theme` directive. There is no `tailwind.config.js` and no other
JS-based Tailwind config file in the repo `[unratified]`, confirmed by directory listing and
`package.json` (`"tailwindcss": "^4"`, `"@tailwindcss/postcss": "^4"`).

All design tokens are declared in one file: `app/globals.css`, lines 21-56, inside a single `@theme {}`
block. That file's own header comment states the tokens were "ported verbatim from the retired Nuxt
client (point-taken-frontend, app/assets/main.css) on 2026-08-25... the one the live game at
play.pointtaken.social is using today" `[ruled]` (`app/globals.css:4-8`). Two departures from that source
are disclosed in the same comment: no dark mode (a deliberate decision, not an oversight), and the three
typefaces load through `next/font` in `app/layout.tsx` rather than a render-blocking `@import`.

There is no separate theme file, no CSS modules, and no styled-components. Every component in
`components/` and `app/` is styled with Tailwind utility classes plus a small number of custom classes
defined in `globals.css` (`.form-base`, `.btn-primary`, `.btn-icon`, `.input-primary`, `.sticker`) that
are applied directly as class names, e.g. `className="form-base btn-primary ..."`. `.sticker` is the
account flow's raised-card look (paired with the `--shadow-sticker`/`--shadow-sticker-sm` tokens below),
used in `settings-form.tsx`, `coach-persona-picker.tsx`, `leaderboard-board.tsx`, and `name-reroll.tsx`;
it is visually distinct from the board's own tile/card chrome, which never uses it.

## 2. Design tokens

All values below are copied verbatim from `app/globals.css:21-115` (the whole `@theme {}` block)
`[ruled]`. Do not invent a hex code, font stack, or spacing value that is not on this list; anything a
screen needs that is not here is a `GAP:` for a designer to fill, not something to guess.

### Color

| Token | Value | Note |
|---|---|---|
| `--color-green` | `#49ca81` | Plus side, everywhere in the game (`app/globals.css:23`). |
| `--color-orange` | `#ffb42f` | Minus side, everywhere in the game (`app/globals.css:24`). |
| `--color-mint` | `#9df4c5` | Secondary, used as success-alert background (`app/globals.css:27`). |
| `--color-peach` | `#ffe083` | Secondary (`app/globals.css:28`). |
| `--color-neutral-black` | `#1e1e1e` | Body text; the board's own black, distinct from the account flow's `--color-ink` (`app/globals.css:33`). |
| `--color-neutral-white` | `#fffcf5` | Same value as `--color-offwhite`; both names are kept because ported markup uses both (`app/globals.css:34,36`). |
| `--color-gray` | `#747474` | Form borders, secondary text (`app/globals.css:35`). |
| `--color-offwhite` | `#fffcf5` | Page background (`app/globals.css:36`). |
| `--color-board-ground` | `#f5f2f0` | The ground under the board only, per Rannie's live-board frame (`1096:252192`); everywhere else a card sits on offwhite and is offwhite itself (`app/globals.css:39-46`). |
| `--color-sand` | `#ffd979` | Button hover background (`app/globals.css:49`). |
| `--color-gold` | `#efae45` | Button hover border (`app/globals.css:50`). |
| `--color-brown` | `#73674e` | Warm accent, tile chrome (`app/globals.css:51`). |
| `--color-ink` | `#4d4c4a` | Rannie's account-flow near-black (Figma `60wr75TY7I95UnL6jkLz2J`, `BRAIN-T260902-21`); every border/stroke/sticker-shadow on the account pages uses this, never `--color-neutral-black`. The two are not interchangeable (`app/globals.css:53-59`). |
| `--color-ink-soft` | `#747474` | Account flow, same value as `--color-gray` (`app/globals.css:60`). |
| `--color-paper` | `#f5f2f0` | Account flow page ground, same value as `--color-board-ground` (`app/globals.css:61`). |
| `--color-card` | `#fffdf9` | Account flow card background (`app/globals.css:62`). |
| `--color-tile-plus-wash` / `-border` / `-accent` | `#9bef9b` / `#6ed59e` / `#3abaaa` | A plus-side reason tile's three distinct tones (outer wash, bold border, watermark/glyph accent); kept apart from `--color-green` so the board's tile palette can move independently of buttons and stance icons (`app/globals.css:64-78`). |
| `--color-tile-minus-wash` / `-border` / `-accent` | `#ffba6f` / `#eda065` / `#f48625` | Same three-tone split for a minus-side tile (`app/globals.css:79-81`). |
| `--color-tile-topic-border` | `#4d4c4a` | The topic tile's measured border; duplicates `--color-ink`'s hex on purpose without reusing that token, since `--color-ink` is reserved for the account flow (`app/globals.css:71-74,82`). |
| `--color-tile-empty` | `#e5c4ad` | (`app/globals.css:83`.) |
| `--color-stat-warm` | `#e08e3c` | Small note under a number, for a count going up (`app/globals.css:87`). |
| `--color-stat-good` | `#3fa88e` | Small note under a number, for something settled (`app/globals.css:88`). |

There is no `--color-red`, `--color-blue`, or `--color-amber` token. Three of the four alert variants use
stock Tailwind default-palette colors that are not declared anywhere in `@theme`; see the gap noted in
section 9.

### Typography

| Token | Value | Font | Note |
|---|---|---|---|
| `--font-primary` | `var(--font-anton), sans-serif` | Anton (400, next/font/google) | Headings only (`app/globals.css:94`, `app/layout.tsx`). |
| `--font-secondary` | `var(--font-noto-sans), sans-serif` | Noto Sans (next/font/google) | Body text (`app/globals.css:95`). |
| `--font-tiles` | `var(--font-coming-soon), cursive` | Coming Soon (400, next/font/google) | The handwritten face reason tiles are set in; the header comment calls this "the single most recognisable thing about the game's look" (`app/globals.css:90-96`). |
| `--font-figure` | `var(--font-barlow-condensed), sans-serif` | Barlow Condensed (next/font/google) | Account flow only: the big condensed number half of its number-over-label pairing (`app/globals.css:97`). |
| `--font-label` | `var(--font-dm-sans), sans-serif` | DM Sans (next/font/google) | Account flow only: the small wide-tracked label half of the same pairing (`app/globals.css:98`). |

Heading sizes, hardcoded outside the `@theme` block (`app/globals.css:127-151`): h1 56px, h2 48px, h3 24px,
all `--font-primary`, weight normal. h4/h5/h6/p use `--font-secondary`.

Body text scale (`app/globals.css:100-102`): `--text-p-lg: 20px`, `--text-p-md: 16px` (the body default),
`--text-p-sm: 13px`. There is no `--text-p-xs` or any size below 13px. There is no defined line-height
token; line-height is left to Tailwind's or the browser's default wherever it is not set inline. `GAP:`
what line-height should a coding agent use for body copy, if the default isn't intentional.

### Spacing and radius

There is no spacing-scale token and no radius token in `@theme`. Every padding, gap, and border-radius
value in the codebase is an ordinary Tailwind utility (`p-4`, `gap-2`, `rounded-2xl`, etc.) chosen
per-component, not read from a named token. The one exception is `.form-base`'s own hardcoded
`border-radius: 6px` (`app/globals.css:166`). `GAP:` there is no ratified spacing scale; a new screen has
to match nearby components by eye rather than by reading a token.

### Shadow

| Token | Value | Note |
|---|---|---|
| `--shadow-sticker` | `4px 5px 0 0 #4d4c4a` | Account flow only: a hard offset block of ink with no blur, paired with a 1.5px `--color-ink` border, under the `.sticker` class (see section 1). The whole reason her account pages read as printed cards rather than web panels; it stops working if softened (`app/globals.css:104-109`). |
| `--shadow-sticker-sm` | `2px 3px 0 0 #4d4c4a` | Smaller variant of the same sticker shadow (`app/globals.css:110`). |
| `--shadow-lg` | `0px 4px 8px rgba(0, 0, 0, 0.15)` | (`app/globals.css:112`.) |
| `--shadow-md` | `0px 4px 8px rgba(0, 0, 0, 0.1)` | (`app/globals.css:113`.) |
| `--shadow-sm` | `0px 2px 4px rgba(0, 0, 0, 0.1)` | (`app/globals.css:114`.) |

`.btn-primary` uses `shadow-sm` at rest, `shadow-md` on hover, back to `shadow-sm` on active
(`app/globals.css:187-198`).

### Form chrome and motion

`.form-base` (`app/globals.css:162-183`): 12px padding, 2px solid `--color-gray` border, 6px radius,
`--color-neutral-white` background, `--color-gray` text, 600 weight, 16px, centered. Hover (buttons only,
not disabled): background to `--color-sand`, border to `--color-gold`. Active: `transform: scale(0.97)`.
Transitions: background-color and box-shadow at 0.15s ease, transform at 0.1s ease.

`.btn-icon` (`app/globals.css:199-209`): fixed 52px height, flex-centered, 0.5 opacity when disabled.

Alert enter/exit animation, added 2026-08-25 for BRAIN-T260825-12 (`app/globals.css:227-254`): fade plus
an 8px vertical slide, 180ms each direction, `alert-in` uses `ease-out`, `alert-out` uses `ease-in
forwards`.

## 3. Component inventory

One line each, from `components/`. All are `[unratified]`, cited by path; every one carries its own
JSDoc header in the file documenting rationale, most also documenting Vue-source provenance from the
retired Nuxt client (`point-taken-frontend`).

**Alerts**
- `alerts/alert-stack.tsx`: renders the bottom-left toast queue. Mounted in `app/layout.tsx` on every
  page. No production caller pushes a toast yet (see section 9).
- `alerts/alert-store.ts`: the toast queue's state, held outside React via `useSyncExternalStore`.
  Exports `alertActions.{push,remove,success,error,info,warning}`.

**Board**

`collapsed-thread.tsx` and `resolution-capture-popup.tsx`, both listed here in an earlier pass of this
document, are deleted `[unratified]` (`git log --diff-filter=D`, commit `0945049`, "the finished game
reads as two columns of compact threads"); the finished board now composes `finished-map.tsx` directly.

- `board/coach-panel.tsx`: shows the AI coach's reading beside a placed tile; never blocks a move. Gated
  off entirely (not merely defaulted off) whenever `board.mode === "gym"`, so the coach never renders in
  Gym play `[unratified]` (`components/board/live-board.tsx:3183-3184`).
- `board/ending.tsx`: the one-sentence statement a finished game shows for how it ended.
- `board/finished-map.tsx`: pure, presentational render of a finished board; used by the game page, the
  account archive, and print.
- `board/game-setup.tsx`: the pre-game screen (topic pick, stance pick, signing).
- `board/geometry.ts`, `board/layout.ts`: pure slot/octagon geometry math for the spatial board, split out
  to be unit-testable without a DOM (`geometry.test.ts`/`layout.test.ts` exist alongside them).
- `board/later-moves.ts`: pure logic for which board actions are legal after a game has ended (review-only
  moves like reading a finished thread).
- `board/leave-links.tsx`: the "leave the game" / "back to your games" link pair shown on the board.
- `board/live-board.tsx`: the in-progress board itself, now 3300+ lines; contains several player-facing
  sub-behaviors documented in section 5 (`InTileComposer`, `ThreadTokenBadge`, `ResolutionRow`, the rule
  card tray's first-use hint).
- `board/peer-notices.ts`: diffs two successive server board projections to say what the other player
  just did, rather than reading a raw socket event.
**`board/resolution-picker.tsx` is deleted `[ruled]`** (commit `b6ab609`, "board: close a thread from the
root tile instead of a modal"). Closing a thread opens no modal: hovering a thread's root
tile flanks it with the two ways to close that thread, Agree to agree on the left and Agree to
disagree on the right, and one click places the token. Once the player's own token is down, that pair is
replaced by the one move left, "Take it back." `renderOverlay` gained a `{ hovered }` argument so an
overlay can hang buttons outside the tile's octagon clip and still know when to show them. A refused token
is a race now rather than a rules problem (the buttons only ever offer what the rules already allow), so
it surfaces as a dismissible banner instead of reopening a card `[ruled Steve 2026-09-07]` ("I want the
hover on a root tile to surface agree to agree on the left or agree to disagree on the right, and the user
can just click them there. There's no reason to bring up another modal.").
- `board/rule-card-face.tsx`: exports `RuleCardChip({cardId})`, a 72px square token-sized card for laying
  on a tile (sized per Steve 2026-09-07 as roughly 1.5x the rule-card tray's `size-12` button, "the same
  height as the emoji thumb or side eye icons... maybe 50% bigger than it is on the rule card thing on the
  bottom"), and `RuleCardFace({cardId})`, the full 180x226px card (art panel, name, throw-condition line,
  and a diamond level badge reading `L{card.earnedAtLevel}`). Ported from Rannie's Figma "game bar"
  component set (`60wr75TY7I95UnL6jkLz2J`, node `875:65982`), with two deliberate departures: her account-
  flow sticker-shadow chrome is replaced since this card floats over a board, not a white page, and the
  level badge reads this game's own `earnedAtLevel` rather than her printed L2/L3/L4 (the still-undecided
  second level-naming ladder). Distinct from `rule-card-popup.tsx`: that one is the three signing
  agreements, this is the four throwable cards `[unratified]` (`components/board/rule-card-face.tsx:1-160`).
- `board/rule-card-popup.tsx`: a rule card shown as reference, built on `TilePopover` with an empty body.
  Not rendered anywhere in the app: `level-intro.tsx` shows no rule card
  `[ruled Steve 2026-09-05, BRAIN-T260905-39]`, and `rule-card-tray.tsx` does not import it either. The
  only caller is its own test file `[unratified]` (`components/board/rule-card-popup.test.tsx`).
- `board/rule-card-tray.tsx`: the "My rule cards" deck row with per-card counts; a first-use hint above it
  ("Click a card, then click the reason it applies to.") is owned and gated by `live-board.tsx`, not by
  the tray component itself `[unratified]` (`components/board/rule-card-tray.tsx:24-85`,
  `components/board/live-board.tsx:3253-3264`). Its fixed positioning wrapper in `live-board.tsx` (and the
  tile-move banner sharing the same reserved footprint) splits `pointer-events: none` on the outer
  positioning div from `pointer-events: auto` on an inner wrapper around the actual visible content
  `[ruled]` (`BRAIN-T260908-03`, commit `21d1968`): before that split, the tray's full reserved width
  hit-tested even where visually empty, so board content panning underneath it (a tile's reply buttons,
  the composer's Place button) could have its clicks stolen by the tray instead of reaching the board.
- `board/same-side-notice.tsx`: a one-time-per-match modal shown the first time a player extends their own
  thread instead of rebutting the other side; not a gate, the move has already happened. Persisted via a
  per-game `localStorage` key so it shows once per match `[unratified]`
  (`components/board/same-side-notice.tsx:3-46,68`).
- `board/side-label.ts`: the canonical plus/minus glyph and label pair (`SIDE_MARK`, `SIDE_LABEL`).
- `board/spatial-board.tsx`: the pannable/zoomable board surface (replaces a fixed-canvas board). Fits to
  content on first mount and on "Fit to screen," never magnifying past 100%; pan via drag or a 4-arrow pan
  pad; zoom via a floating bottom-right cluster (`MIN_ZOOM 0.25`, `MAX_ZOOM 2`); auto-frames (pans/zooms
  out only, never in) around a coach-pointed slot, a coach-pointed tile, or an in-progress boss draft, with
  the boss draft taking priority if more than one target is set at once `[unratified]`
  (`components/board/spatial-board.tsx:76-98,147,1064-1120,1246-1350,1681-1704`). `COMFORT_ZOOM` (0.8) is a
  floor on the first fit only: once the board has centered once, the automatic refit may shrink below it
  and does not zoom back in on its own, while "Fit to screen" still recenters at any scale. Two effects
  (composer visibility, coach framing) deliberately go below that floor and deliberately leave `touched`
  alone, since neither is the player choosing a view; before commit `1a07ae4` ("board: stop the automatic
  refit fighting the two shrink effects") the automatic refit undid them every animation frame, reported by
  Steve while playing level 1 as "zooming in and out rapidly... it's really aversive." That commit also
  hoisted `UNRESTRICTED_PLACEMENT` (`{onlySlot: null, ownReplies: true, ghosts: true, lockedText: false}`)
  into a frozen module-level constant, replacing an inline default object that had been a fresh object
  identity on every render.
- `board/stance-picker.tsx`: the plus/minus stance-selection buttons at setup.
- `board/tile-shape.tsx`: the rotated-diamond tile primitive every other tile-like component builds on.
  A `weight` prop takes `"normal"` (3px border) or `"root"` (9px border, three times as thick), used for
  the topic tile and any reason tile with no parent, so both read as load-bearing at a glance
  `[ruled Steve 2026-09-05]` (`components/board/tile-shape.tsx:235-237`, `TILE_BORDER_PX` in
  `components/board/geometry.ts:111-115`). The octagon's corner cut ships as a clean 29% in
  `OCTAGON_CLIP` (`components/board/geometry.ts:60`), but that file's own header comment records
  measuring Rannie's render at a cut reaching full width somewhere between 29.1% and 29.9%.
  `GAP:` whether the tile's corner cuts should read as sharp or slightly rounded is not settled;
  the shipped 29% is a single clean value chosen inside a measurement range that disagreed with
  itself, not a value Steve has confirmed against the design.
- `board/token-glyph.tsx`: lookup from a resolution-token unicode character to its SVG art and label.
- `board/topic-cell.tsx`: the topic tile ported from `TopicTile.vue`, distinct from the display-only
  `topic-tile.tsx` below. Four states: idle, editing, waiting (a revision proposal is out), and answering
  (the peer's proposal is in and needs a response). A confirmation gate sits before a proposal actually
  sends; rejecting one optionally asks why `[ruled Steve 2026-09-01]` ("Whenever you agree or disagree to
  something, you should have a chance to say why. That's great data to capture."), but accepting one does
  not yet, since `ProposalAcceptedPayload` only carries `proposal_id` (`BRAIN-T260901-08`). Exports
  `pendingTopicRevision(board)` and `lastRejectedTopicRevision(board)`. A rejection note renders via
  `AnchoredCard` beside, not inside, the tile, since the cell itself is `clip-path` clipped to the octagon.
  The whole move is gated behind `canStartLaterMove(board, "topic_revision", taught)`, a Gym level 5+ move
  held back from live game (`BRAIN-T260903-06`) `[unratified]` (`components/board/topic-cell.tsx:1-510`).
- `board/topic-tile.tsx`: the neutral "TOPIC" watermark diamond, display-only. Renders with
  `weight="root"`, the same thick border as a thread's opening reason, since the topic tile is load-bearing
  too `[ruled Steve 2026-09-05]` (`components/board/topic-tile.tsx:20`).
- `board/use-game-feed.ts`: hook that triggers a server re-projection when the other player moves.
- `board/ways-to-win-card.tsx`: an interactive minimap, not a display-only one. The four corner slots
  (root tiles) and the center "TOPIC" octagon are hoverable and clickable: hovering spotlights the matching tile on the
  real board, clicking a corner or the topic with a landed tile opens it; a corner with nothing placed yet
  renders as a plain non-interactive span `[unratified]` (`components/board/ways-to-win-card.tsx:20-25,
  210-216,270-342`). The header comment attributes the interactivity to a 2026-09-05 playtest finding
  that inert icons read as broken.

**Brand**
- `brand/art.tsx`: the wordmark and glyph images, loaded as `next/image`, never inlined (a `<style>`
  class-name collision risk).
- `brand/svg-box.ts`: computes the width/height box to declare on a brand SVG so Next's dev-mode
  dimension warning doesn't fire.

**Chrome / utility**
- `build-stamp.tsx`: the build-id line shown on every page, load-bearing during review.
- `counter.tsx`: one labeled number, shared by the profile stat tiles.
- `dev/hotseat-bar.tsx`: local-only bypass that lets one person play both sides; renders nothing outside
  the sandbox.
- `feedback/feedback-popover.tsx`: the shared feedback pop-up behind the floating button and the in-game
  inline pill, built on `TilePopover`.
- `local-day.tsx`: renders a UTC date string in the reader's own local timezone via
  `useSyncExternalStore`.
- `onboarding/onboarding-launcher.tsx`: the trigger button plus overlay bundle for the four-step
  walkthrough. `app/how-to-play/page.tsx` is deleted `[ruled]` (commit `e26fbce`, "board: fewer panels,
  and the help where the trouble is"): how to play is not a page, so the four screens that would link to
  it open this same overlay in place, and the board itself carries a "?" button in its
  top-left corner, because a player stuck mid-argument should not have to leave the game to go read a
  page.
- `onboarding/onboarding-overlay.tsx`: the four-step full-screen new-player walkthrough.
- `onboarding/onboarding-video.tsx`: one looping instructional clip with a deliberate pause between
  loops.
- `resume-or-start.tsx`: the profile's single action button that reads either "resume" or "start."
- `rooms/room-entry.tsx`: `RoomEntry` itself is deleted `[ruled]` (commit `cb7ec32`); the file now exports
  `useRoom` (the shared pending/error/enter hook every room-entry surface goes through, including the
  silent anonymous-mint retry on `signIn`) plus three presentational forms built on it: `JoinByCode`
  (the plain-text link version, used by the Profile hero's Live-play card), `JoinRoomInline` (a solid
  "Join game" button beside the room-number field, built for the same Live-play card once it needed to
  offer starting and joining side by side), and `JoinRoom` (a single button against a fixed code, used by
  the invite-link route) `[unratified]` (`components/rooms/room-entry.tsx`).
- `rooms/start-new-game.tsx`: `StartNewGameButton`, the Profile Live-play card's "Start a new game"
  button. Calls `createRoom` through the same `useRoom` hook as every other room-entry surface, so a
  signed-out player gets the silent anonymous-mint retry rather than a dead-end error. If a game is
  already running when it fires, `createRoom` ends it first via `endInFlightGame`
  (`lib/games/abandon.ts`), so the other player sees it end exactly as if this player had left; there is
  no confirmation dialog, by ruling, because choosing to start over is the confirmation
  (`BRAIN-T260905-44`).
- `legal/agreement.tsx`: the Terms/Privacy tick box (`AgreementTick`) gating anonymous account creation.
  Distinct from the three-line signing ritual in `lib/board/setup.ts`, which is a separate, later
  affirmation `[unratified]` (`components/legal/agreement.tsx:56-84`).
- `home/home-links.tsx`: the footer link row on the signed-out front door.
- `hide-on-board.tsx`: `HideOnBoard`, a pathname-gated wrapper (`usePathname().startsWith("/game")`)
  around root-layout chrome that would otherwise land on top of the board. The board renders `fixed` and
  takes no space in document flow, so anything the layout renders after it collapses to the viewport's
  top-left corner, on top of the room code, without this; a wrapper rather than a prop on the hidden
  content because that content reads server-only environment and has to stay a server component.
- `auth/notice.tsx`: `Notice`, one conditional line above the sign-in form (a failed-callback reason or
  the player's session state); renders nothing when there is nothing to say.
- `topics/enter-topic-button.tsx`: `EnterTopicButton`, a purely presentational three-state (default/hover/
  selected) button ported from the retired frontend's `EnterTopicButton.vue`; hover and selected states
  only swap which SVG artwork renders (`/buttons/EnterTopic*.svg`). `GAP:` no caller in `app/` or
  `components/` imports it today, so, like the deleted `PathsToWinningCard`, it exists in the tree but is
  not wired into any live screen; confirm with Steve whether it is still wanted before building against it.
- **`site-nav.tsx` is deleted `[ruled]`** (`BRAIN-T260904-22`, commit `ccca4ae`, "one nav out of game: the
  four tabs, and the ladder is the level select"). Rannie's frames draw one nav bar total, the four-tab
  account shell (see the new Account group below); nothing else in the app shows a nav bar.
- `streak-counters.tsx`: the `current/longest` streak string, read via `useSyncExternalStore`.

**Lobby** (`components/lobby/`, the pre-game host/setup screen, both mounted from `board/game-setup.tsx`)
- `lobby/room-code-display.tsx`: `RoomCodeDisplay`, the room code as a gold Anton numeral with a
  "Share with your peer to join" / "link copied" line beneath it, the whole line acting as the copy
  button. Promoted from small print in the retired client's `RoomCodeDisplay.vue` to this size because a
  code read aloud to another person deserves it, matching Rannie's room-header pill (Figma `1096:251293`).
- `lobby/player-agreement.tsx`: `PlayerAgreement` plus its `PledgeText` helper, the three-pledge signing
  ritual (Mutual Respect, Honest Thinking, Shared Facts, `SIGNING_LINES` in `lib/board/setup.ts`). All
  three lines share one `signed` flag and sign in a single action, unlike the retired client's
  `PlayerAgreement.vue`, which checked each line independently. `PledgeText` renders authored pledge copy
  only: a blank line becomes a paragraph break, and text wrapped in single asterisks renders italic, with
  the word "collaborate" (and any inflection of it) additionally forced bold wherever it appears, per
  Steve's 2026-09-07 ruling on that word. Never run this splitting logic on player-typed text.

**Gym** (practice ladder against a scripted boss; none of this existed in the previous pass of this
document)
- `gym/boss-draft.ts`: the type and pub/sub store for an in-progress boss line being typed onto the board
  before it lands as a tile; the board renders it as a ghost/ink-outline octagon with an `sr-only` label
  "{bossName} is writing," not any visible "boss draft" copy `[unratified]`
  (`components/gym/boss-draft.ts:25-48`, `components/board/spatial-board.tsx:696`).
- `gym/certificate.tsx`: the end-of-level screen, headed "Certificate of Agreeable Disagreement." Shows
  resolution counts, points, the reformed boss, the card granted, and badges; reads real saved awards
  (`board.awards`, `0014_awards.sql`) when present, otherwise falls back to script-computed values and
  discloses the fallback on screen `[unratified]` (`components/gym/certificate.tsx:16-69,134-145`).
- `gym/director.tsx` (827 lines): the coach/director UI for a Gym level. `Bubble()` renders coach lines in
  an `AnchoredCard`, with an arrow only when it targets a specific board element; used by `PauseBubble` and
  `LineBubble` `[unratified]` (`components/gym/director.tsx:630-661,668,737`). No literal "SHOW ME" control
  exists anywhere in the repo; the closest strings are lowercase "Show me" and "Fix it," which dismiss a
  pause card rather than auto-fixing anything (the actual fix is a manual edit the player types in the next
  scripted beat) `[unratified]` (e.g. `lib/gym/levels/claim-size.ts:182,211,285,288-300`).
- `gym/boss-flash.ts`: `useSyncExternalStore` pub/sub store, siblings-on-the-page shape to `boss-draft.ts`,
  flagging the boss's just-landed tile for the same brief highlight the player's own throw gets
  (`flashTileId` in `live-board.tsx`). Published from the Director once `bossAct` reports success, keyed
  by the slot the tile landed in (`parentId` + `corner`) rather than by tile id, since the server-generated
  id never comes back through `bossAct`'s plain ok/error `ActionResult`. Fixes `BRAIN-T260905-27`, a
  tester replaying a card unsure the boss's auto-played tile had landed.
- `gym/gym-lobby.tsx`: the room before a Gym level starts. Sides and topic are the script's and the boss
  has already signed, so the only thing left for the player is the signing ritual; `GymLobby` itself does
  nothing but look up a `Level` by id (`levelById`) and hand it to `LevelIntro`, which draws the actual two
  cards. The lookup happens here, in a `"use client"` file, rather than being done server-side and passed
  down, because a `Level`'s beats can carry functions (level 1's do) and a function cannot cross from a
  server component into a client one; dropping the directive once turned this into a server component and
  broke level 1 with "Functions cannot be passed directly to Client Components" (level 2 masked the same
  bug, since none of its beats happen to use a function). The ladder/level-select surface itself is
  `account/progression/ladder-strip.tsx` below, per `BRAIN-T260904-22`.
- `gym/level-intro.tsx`: one component, two cards toggled by internal state before a level starts. Card
  one is the boss portrait/title/tip card with "Next →." Card two shows no rule card, face down or
  otherwise `[ruled Steve 2026-09-05, BRAIN-T260905-39]`, since telling a player about a rule card
  before they know rule cards exist undercuts the moment the board later teaches it. Card two is
  an agreement screen: one sentence naming the level, boss, and topic, the three `SIGNING_LINES` pledges
  read in full, then two separately gated buttons, "I agree to all three" (signs) and "Start the game →"
  (disabled until signed) `[unratified]` (`components/gym/level-intro.tsx:111-278`).
- `gym/pointed-slot.ts`, `gym/pointed-tile.ts`: `useSyncExternalStore` pub/sub stores letting the director
  tell the spatial board which empty slot or existing tile to auto-frame.
- `gym/sample-answers.ts`: `useSyncExternalStore` pub/sub store carrying the coach's sample answers from
  the Director to the board. They live on the board, not in the coach card (Steve, 2026-09-03): a chip
  that placed a tile outright on click let the player neither choose where it went nor see the words in
  a box they could change. The coach says to click one of the open tile spots, those slots
  carry the sample text as a ghost, and clicking one opens the composer already filled in for the player
  to edit, send as-is, or type over. A module rather than a prop because `GymDirector` and `LiveBoard` are
  siblings on `app/game/[gameId]/page.tsx`, not parent and child, and only the Director knows the current
  beat (from its own local-storage-backed pause dismissals); publishing avoids lifting the whole level
  script into the board, which has no concept of a level. Client-only, no-op on the server (starts empty,
  server snapshot is the same frozen empty array), so a server-rendered board draws plain slots and the
  samples appear once the Director mounts.
- `gym/start-level-button.tsx`: `StartLevelButton` opens a cooked game for one level (`startLevel` server
  action) and navigates to its board on success, showing an inline error and a disabled "Opening..." state
  otherwise.

**Account** (the four-tab shell that replaced `site-nav.tsx`; none of this existed in the previous pass)
- `account/account-shell.tsx`: the shared four-tab chrome for every out-of-game screen. Exactly four tabs,
  Profile (`/`), Cards & Badges (`/cards`), History (`/account/history`), Settings (`/settings`)
  `[ruled]` (`BRAIN-T260904-22`, `components/account/account-shell.tsx:45-58`).
- `account/avatar-picker.tsx`: opens a dialog with a 3x3 grid of the nine fixed `PLAYER_EMOJIS`
  (`lib/avatar.ts:37-47`) plus a "Use my initials" reset button; triggered from the clickable hero avatar
  `[unratified]` (`components/account/avatar-picker.tsx:88,101,104-133`).
- `account/calendar-strip.tsx`: the "Upcoming events" list-card at the foot of the profile. Every row is
  invented sample data: nothing in this codebase schedules anything, and the panel says so twice, a
  "Sample" chip in the header and a visibly dead "Sign-ups not built" pill on every row rather than a
  button that does nothing when pressed `[ruled Steve 2026-09-03]` ("I would rather have more fake ones
  now as inspiration and remove them later."). Restyled to Rannie's list-card anatomy (`BRAIN-T260904-40`):
  a teal-band header, and per row a date block, title, category `Chip`, one line of detail, and the state
  pill. Her countdown-and-join detail card is deliberately not adopted, since a scheduled-events system is
  one of the undecided widgets (`BRAIN-T260817-02`) and a countdown to nothing is worse than none. Links
  to `/leaderboard` twice (header button and closing sentence), the one real page these invented events
  point at. Event names are deliberately about who is playing rather than what they would argue about, to
  avoid an unreviewed politically-readable sample set.
- `account/hero.tsx`: `ProfileHero`, the identity block atop Profile (clickable avatar, name, "Player
  since"/anonymous line, level pill, two action cards for Gym play and Live play, three stat tiles); the
  "Cooperation score" stat tile links to `/leaderboard?by=cooperation` `[unratified]`
  (`components/account/hero.tsx:40-45,120-127,200-206`).
- `account/name-reroll.tsx`: `NameReroll`, the cycle button beside the display name on Profile, calling
  the `rerollName` server action. Moved off Settings onto the profile 2026-09-07: a player who wants a
  new name is looking at the name, not hunting a settings page for a section about a thing already on
  screen, and the name is not a "setting" in the first place. Warns once, in a two-line modal ("You can't
  get this one back"), before the first-ever reroll, since the generator draws a fresh name and nothing
  stores the old one; every later press rerolls immediately with no further warning. The "already warned"
  flag lives in this browser's `localStorage` keyed by player id, not a database column, since nothing
  depends on it surviving a cleared browser.
- `account/leaderboard-board.tsx`: `LeaderboardBoard`, pulled out of `app/leaderboard/page.tsx`
  (`BRAIN-T260904-14`) so the same ranked list can render for a signed-out visitor too, not just the
  `/leaderboard` route. Sorts by one of three `LeaderboardMetric`s (wins, cooperation, sustained) via
  plain links that carry the metric in the query string; ties share a rank and the next distinct score
  skips the places used up, so two equal players never see one ranked ahead of the other. The current
  viewer's own row (`playerId`, nullable for a signed-out visitor) gets a "you" badge and a warmer border,
  and the top three get a larger rank numeral, never a medal or a different colour, since both win
  conditions here are cooperative and nothing on the row should read as a podium.
- `account/match-list.tsx`: the History tab's full game archive list, filterable by mode via the page's own
  `ModeFilter` when a player has both Gym and Live games.
- `account/progression/badge-strip.tsx`, `account/progression/certificate-wall.tsx`: badge and certificate
  displays on Profile; sample-data status for badges unconfirmed (see the progression
  real-vs-sample split noted in `tech-spec.md`).
- `account/progression/boss-briefing.tsx`: sits under the ladder strip.
- `account/progression/ladder-strip.tsx`: the level-progress ladder, now doubling as the level-select
  surface (`/gym` redirects here). A row of octagon nodes, teal for cleared, an orange star for the current
  level, grey outline for levels ahead, all navigable, no padlock; a heading reads "Level progress ladder"
  with a "Pick a level to enter the gym" subline `[unratified]`
  (`components/account/progression/ladder-strip.tsx:11-52,115-145`).
- `account/progression/sample-tag.tsx`: the visual flag on any progression tile still backed by invented,
  not real, data.

**Cards** (the Cards & Badges tab; none of this existed in the previous pass)
- `cards/card-wall.tsx`: the rule-card wall, gated by `held`/`next`/`later` ownership, with real thrown and
  coached counts per card `[unratified]` (`components/cards/card-wall.tsx:86-127`).
- `cards/boss-collection.tsx`, `cards/badge-gallery.tsx`: both explicitly flagged on-screen as sample data
  via `SampleTag`, "Reformed" wording for cleared bosses `[unratified]`
  (`components/cards/boss-collection.tsx:39-66`, `components/cards/badge-gallery.tsx:54-67`).
- `cards/sample-tag.tsx`: the Cards-tab equivalent of `account/progression/sample-tag.tsx`.

**UI primitives**
- `ui/anchored-card.tsx`: a portal-rendered card that follows a DOM element found by CSS selector,
  re-measured every animation frame while open; used where a card must track a moving/panned/zoomed board
  element (the Gym director's coach bubble), distinct from `TilePopover`'s fixed-shape forms
  `[unratified]` (`components/ui/anchored-card.tsx:41-60`). Side placement scores four candidates (beside
  the anchor on either side, below, above) against the anchor plus every reason tile on the board and
  picks the one that covers the least, rather than trying right-then-left-then-clamp-to-window with no
  knowledge of the board underneath `[ruled]` (commit `682dbf1`, "board: stop the coach's card burying the
  tiles it is about"): a card is wider than a tile and the tiles sit on a diagonal, so the old placement
  regularly put the coach on top of a neighbouring reason, once burying one completely. Ties keep the
  historical right-first order, so an empty board still places the card where it always did. Each tile's
  hit box is pulled in 13% before scoring, since a tile is an octagon clipped out of a square box and a
  corner graze there is air. The same commit stopped a locked sample draft from arriving pre-selected:
  the effect that selects a finished sample line for editing skips a locked draft, which has nothing to
  replace it with and would otherwise arrive looking flagged rather than plainly written.
- `ui/floating-panel.tsx`: `FloatingPanel`, a titled card that folds away, used by `live-board.tsx` for
  the small panels that float over one of the board's corners (things a player consults rather than
  watches: how the game ends, the thread list, the coach). Folded by default (an uncontrolled `open`
  state, `defaultOpen` prop), it costs one header strip; open, it costs as much room as its children need,
  scrolling internally past `60vh`. Uncontrolled on purpose: nothing outside needs to know whether a
  player has a given panel open, and a caller that does can lift the state later.
- `ui/tile-popover.tsx` (754 lines): the single generic anchor-relative pop-up. See section 5.
- `ui/tile-popover-position.ts`: pure positioning/clamping math for `TilePopover`, split out to be
  unit-testable without a DOM.
- `ui/tile-popover-presets.ts`: static copy/shape presets (heading, subtitle, glyph, field placeholders)
  for the game's known `TilePopover` uses; carries no live state.
- `ui/pencil-glyph.tsx`: `PencilGlyph`, the one inline pencil SVG for "edit this" anywhere in the app
  (Steve, 2026-09-05, ruling on the tile card: edit should read as a standard pencil icon rather than a
  line of text). Lives here rather than beside its first caller because two unrelated screens draw it,
  the tile out on the board and the profile hero's avatar picker; colour comes from `currentColor` and
  size from the caller's `className`, so each surface keeps its own palette off one shared path. No icon
  package is installed in this project, so this is the pattern for any future one-off glyph too.

**Win**
- `win/win-overlay.tsx`: the full-viewport win celebration. See section 5.
- `win/use-focus-trap.ts`: the Tab-trap-and-restore hook shared by the win overlay (adapted from an
  inline version of the same logic inside `tile-popover.tsx`).

## 4. Layout and main screens

Every page under `app/` is composed from the components above plus page-local markup; there is no
separate layout-primitive library (no `<Card>`, `<Stack>`, `<Grid>` wrapper components). `app/layout.tsx`
mounts three things globally: `<AlertStack />` (every route), `<FeedbackPopover variant="floating" />`
(every route except `/game`), and `<BuildStamp />` in a footer (every route).

Main screens, one line each:
- `app/page.tsx`: home is the Profile screen for a signed-in visitor (`<Profile playerId={me} />`);
  a signed-out visitor instead sees the front door: the wordmark, an `AgreementTick`, a guest-only
  "Set me up" button, a "Login" link to `/signin`, and `HomeLinks` `[unratified]` (`app/page.tsx`, ruled
  2026-09-03 per the header comment). The room-code field, "Join a game," and "Create a room" that used
  to live here are gone `[ruled]` (commit `cb7ec32`, "home: drop room entry from the signed-out front
  door, add Login"): offering them before a visitor has an account was confusing, so they now live only
  on the Profile's Live-play card (`components/account/hero.tsx`), and `RoomEntry` itself is deleted.
- `app/game/[gameId]/page.tsx`: the board page. Branches on game status: setup renders `GameSetup`,
  in-progress renders `LiveBoard`, ended renders `Ending` + `FinishedMap` + `WinOverlay`. Also imports
  `HotseatBar` (sandbox-only).
- `app/account/page.tsx`: the `/account` route target, not the profile screen itself. It is the route
  target (linked from the tab bar and elsewhere) and redirects its rendering to `app/account/profile.tsx`
  for a signed-in player, or a "you are not signed in" panel with `StartPlaying` otherwise `[unratified]`
  (`app/account/page.tsx:1-33`).
- `app/account/profile.tsx`: the actual Profile screen (`Counter`, `LocalDay`, `ResumeOrStart`,
  `StreakCounters` are folded into the `ProfileHero` / `LadderStrip` / `CertificateWall` / `BadgeStrip`
  / `CalendarStrip` composition described under the Account component group above; not verified
  line-by-line for every one of those four names).
- `app/account/history/page.tsx`: the History tab, `MatchList` plus a link-based Gym/Live `ModeFilter`
  shown only when a player has games in both modes.
- `app/join/[code]/page.tsx`: public invite-entry route.
- `app/cards/page.tsx`: the Cards & Badges tab, three components in order: `CardWall`, `BossCollection`,
  `BadgeGallery`, inside `AccountShell tab="cards"` `[unratified]` (`app/cards/page.tsx:7-13,66-122`). The
  earlier note that "only the cards half is built" is now out of date; badges render too, flagged sample.
- `app/gym/page.tsx`: a redirect only, to `/#ladder`, per the
  2026-09-04 one-nav ruling; the Profile's ladder strip is the level select `[ruled]`
  (`BRAIN-T260904-22`, `app/gym/page.tsx`).
- `app/gym/actions.ts`: the `startLevel` and `bossAct` server actions that drive a Gym match.
- `app/leaderboard/page.tsx`: renders inside `AccountShell tab="profile"` with a back link, not as its own
  tab, since it is a stat's detail page rather than a place of its own `[unratified]`
  (`app/leaderboard/page.tsx:10,117-209`).
- `app/signin/page.tsx`, `app/settings/page.tsx`: auth and settings; the settings page's header comment
  cites Rannie's frame 755:25347 for systems still undecided.
- `app/settings/settings-form.tsx`: `SettingsForm({coachEnabled, claimed})`, three `Section`s in Steve's
  2026-09-07-ruled order. "Keeping this account" holds `ClaimAccount`, an email input that calls the
  `claimAccount` server action. "The coach" holds `CoachToggle`, a checkbox wired to the `setCoach`
  server action with a sentinel-recipe `useState(enabled)` plus a `lastFromServer` comparison so it
  re-syncs after a hot-seat switch, and renders `<CoachPersonaPicker />` beneath it. "This browser" holds
  `SignOut`, a two-click confirm for an unclaimed account and a one-click sign-out for a claimed one,
  ending in `fetch("/api/auth/signout")` then `router.replace("/")` and `router.refresh()`. There is no
  "Your name" field here any more; the reroll now lives beside the name on the profile
  (`components/account/name-reroll.tsx`).
- `app/settings/coach-persona-picker.tsx`: `CoachPersonaPicker`, a `radiogroup` of the three
  `COACH_PERSONAS` from `lib/progression/sample.ts` (`BIZ-T260823-68`, choosing a coach once per account
  rather than per level). A locked persona renders unclickable with `aria-disabled` and a "🔒 Unlocks
  later" caption rather than being hidden, so a player can see what is coming; the one persona that can
  be picked and the one that is picked are the two states the radiogroup actually tracks. Selection lives
  in local `useState` only and is not persisted anywhere. `GAP:` there is no players-table column for a
  chosen persona yet, wiring one up is a migration for the progression layer to add later, and the
  component says so under the tiles ("Sample data. Your choice is not saved yet.") rather than silently
  resetting on refresh and looking like a bug.

## 5. Interaction specs for non-obvious pieces

Source: `docs/reference/materials/design-briefs/2026-08-25_alerts-win-info-interaction-spec.md`
(BRAIN-T260825-34) `[ruled]`, cross-checked against the actual code. All three surfaces below were
explicitly evaluated against `TilePopover` and rejected as a fit; each is its own component.

### Alert stack (`components/alerts/`)
Fixed `bottom-4 left-4`, `z-50` (topmost layer in the app), width `22rem` capped at `92vw`. Enter/exit is
fade plus an 8px vertical slide, 180ms each way (`animate-alert-in` / `animate-alert-out`,
`app/globals.css:227-254`). Auto-dismiss: 4000ms for the `success`/`error`/`info`/`warning` convenience
helpers (`DEFAULT_HELPER_TIMEOUT_MS`, `alert-store.ts`), 3000ms for a raw `push()` call, persistent if
`timeoutMs` is explicitly 0. No cap on how many toasts can stack at once. Every toast, regardless of
variant, carries a flag glyph "⚑" (`aria-hidden`) and exactly one dismiss control, a "✕" button labeled
`aria-label="Dismiss"`. Four variants exist (`success`, `error`, `info`, `warning`); `warning` has never
been triggered by any caller in the retired source either, per the spec.

### Win overlay (`components/win/win-overlay.tsx`)
Full-viewport: `fixed inset-0`, `z-40` (below the alert stack, above corner UI), translucent
`bg-neutral-black/40` backdrop with `backdrop-blur-sm`. No entrance/exit animation, appears and disappears
instantly; the spec calls this "a deliberate contrast with the alert stack's fade," and the retired
source had no animation either. Card is centered, `rounded-2xl`, `bg-offwhite`, `shadow-lg`, with a
circular party-emoji badge floating above the card's top edge. Three ways to dismiss: the "✕" button, a
backdrop click, or "Play Again." Reopens via a fixed bottom-right pill with the exact copy "🎉 You won —
show results" (quoted verbatim from `components/win/win-overlay.tsx:81`; do not paraphrase it. Note that the shipped string itself contains an em dash, which is against house writing style, so the copy may change, but changing it is a copy decision and not something to silently "correct" in this document). Exactly one instance can be open at a time. Two win variants
share the headline "You've won!": `threads` (all threads resolved, shows a token/count breakdown grouped
by resolution type) and `topic` (topic revised, shows the revised `TopicTile`). If both conditions were
somehow true at once, `topic` takes priority `[ruled]`, though the current single-enum
`winCondition` model makes that impossible today. Button order: "✕", conditional "Leave feedback"
(external link, hidden if no feedback URL is configured), "Share to Linkedin" (public share-offsite URL,
no OAuth), "Play Again." Keyboard focus trapping and Escape-to-close are disclosed as this rebuild's own
design decision, not a fact recovered from the retired Vue source, which the spec says could not be
determined either way. `exitLabel`/`exitHref` (commit `5372d4e`) let a caller repoint the bottom pill:
defaulting to "Play Again" / `/`, the Gym-cleared branch instead passes a Gym-specific label and
`exitHref={null}`, which dismisses the overlay in place (the same as the close button) rather than
navigating away, revealing the certificate already rendered underneath it. This gives a cleared Gym
level the same win-celebration beat as a regular game.

### Paths-to-winning card

**`info/paths-to-winning-card.tsx` and its test are deleted `[ruled]`** (commit `16ed9f1`, "board: drop
the duplicate ways-to-win card nobody could reach"). It was imported only by its own test;
`board/ways-to-win-card.tsx` is the one `live-board.tsx` actually mounts, and Steve ruled on 2026-08-30
to consolidate on the live one. Two things existed only in the deleted file and were deliberately not
ported forward, because neither has a call site asking for it: a legend of which resolution-token kinds
have appeared on the board, and a literal "Revised" / "Not yet" label for the topic-revision state.
Filed for Steve rather than rebuilt on a guess.

### Tile popup (`components/board/live-board.tsx`)
Clicking a reason on the board opens a card, `TileNode` rendered with `onBoard` true. Three moves,
gated separately, as of Steve's 2026-09-05 ruling on the tile card:

- **Edit moved off the card and onto the tile.** A player's own reason now carries a small pencil icon
  drawn on the tile itself rather than an "Edit" row inside the card, so editing reads as "a standard
  pencil icon on top of the tile" `[ruled Steve 2026-09-05]` (`components/board/live-board.tsx:432-449`).
  The icon renders only when `mine && editVerdict?.ok` and sits at the tile's top-right corner
  (`style={{ right: CORNER_INSET, top: CORNER_INSET }}`), the mirror of `TileProposalBadge`'s top-left
  placement, so the two never collide `[unratified]` (`components/board/live-board.tsx:3138-3156`,
  `TileProposalBadge` at `:2586-2602`).
- **Remove is offered only on a terminal tile**, one with no live replies under it
  (`isTerminal = tile.children.filter(c => !c.removed).length === 0`), gated `mine && isTerminal`
  `[ruled Steve 2026-09-05]` (`components/board/live-board.tsx:1055,1275,1288`). This check lives in the
  presentation layer only: `lib/board/rules.ts`'s `canRemoveTile` has no children check and does not know
  about terminal tiles at all. A core follow-up to move the rule into `canRemoveTile` itself is filed as
  `BRAIN-T260905-45` and not yet done `[unratified]` (`lib/board/rules.ts:285-295`).
- **The card does not restate the tile's own text.** The octagon is already on the board a few pixels
  away in its own hand and colour, so the card's job is only what a player cannot already see by looking
  `[ruled Steve 2026-09-05]` (`components/board/live-board.tsx:3461-3467`).

A held rule card now steps back the reasons it cannot answer rather than leaving every tile looking
equally clickable `[ruled]` (commit `3fe57bc`, "board: show which reasons a held rule card can answer,
and flash the one it lands on"): `TileNode` takes a new `muted` prop (45% opacity, `saturate-50`),
computed with the same `canThrowCard` the click handler itself runs so the two can never disagree.
`muted` is deliberately distinct from the existing `dimmed` prop (20% opacity, for a tile that is out of
the game entirely); a player choosing a target is reading the other tiles, not ignoring them. The same
commit adds a `flash` prop (`animate-tile-flash`, a 0.7s ease-in-out pulse run twice) driven by
`flashTileId` state, held for 1600ms after a tile is thrown, so the just-placed tile visibly lands. Commit
`1d7ce1a` ("gym: flash the boss's tile when it lands, not just the player's own") extends the same
`flash` prop to the boss's own auto-played tile, matched by `parentId`/`corner` via the `useBossFlash()`
store in `components/gym/boss-flash.ts` rather than by tile id, since the server-generated id never comes
back through `bossAct`'s plain ok/error `ActionResult`; a tester had replayed a card unsure the boss's
move had landed (`BRAIN-T260905-27`).

All action items render as real `<button type="button">` elements, not links or plain text
(`ActionItem` at `components/board/live-board.tsx:481`; Edit/Remove rows at `:1314,1323`). A second,
simpler "yours:" link row exists for a non-`onBoard` context (the folded thread drawer) and still shows
plain "edit"/"remove" text links there; its "remove" link is gated only by the raw `removeVerdict`, not
by `isTerminal` `[unratified]` (`components/board/live-board.tsx:1310-1332`).

### Turn timers
There is no turn timer component to build. Turn timers are out of scope for this edition by ruling
[ruled Steve 2026-09-03, BRAIN-T260903-01]; they belong to the Heart edition. A thread resolves when a
player concedes, never when a timer runs out; there is no 30-second speaker timer or 45-second
summarize timer anywhere in this edition's design, ruled or otherwise.

## 6. Accessibility

What exists: `TilePopover` (`components/ui/tile-popover.tsx:552-617`) implements a real focus trap (Tab
wraps at the first/last focusable element inside the dialog), Escape-to-close, and focus restoration to
whatever was focused before the popover opened, falling back to the anchor element. `role="dialog"`,
`aria-labelledby`, and conditional `aria-describedby` are set on both `TilePopover` and `WinOverlay`.
`WinOverlay` has its own equivalent focus-trap hook (`components/win/use-focus-trap.ts`), explicitly
disclosed as this rebuild's own decision rather than a ported behavior. `Avatar` is deliberately hidden
from screen readers (no `aria-label`, or an explicit `aria-hidden`) because it always sits beside the
player's name and would otherwise announce the same identity twice `[unratified]`
(`components/avatar.tsx:6-9,29`). The alert stack's dismiss button and the popover close buttons all carry
explicit `aria-label`s. `ChoiceBodyView` in `TilePopover` uses `role="radiogroup"` / `role="radio"` /
`aria-checked` correctly for its pick-one chips.

What is missing or unverified: only 23 files across `components/` and `app/` reference `aria-` or `role=`
at all `[unratified]`, out of roughly 35 non-test component files plus 16 page files. 25 component files
have zero aria/role usage, including `site-nav.tsx`, `resume-or-start.tsx`, `topic-tile.tsx`,
`coach-panel.tsx`, and `ending.tsx` `[unratified]` (grepped directly). None of this means those components
are inaccessible by default (native `<button>` and `<a>` elements carry a lot for free), but there is no
systematic accessibility pass or checklist anywhere in the repo. `GAP:` no color-contrast audit exists
against the token palette above; `--color-gray` (`#747474`) text on `--color-offwhite`
(`#fffcf5`) background, used throughout form chrome, has not been verified against WCAG AA.

## 7. Responsive behavior

What exists: Tailwind responsive prefixes (`sm:`/`md:`/`lg:`/`xl:`/`2xl:`) appear only 6 times across the
entire `components/` and `app/` tree, in exactly 5 files: `components/avatar.tsx`,
`components/board/rule-card-popup.tsx`, `components/board/live-board.tsx`, `app/dev/tile-popover/page.tsx`,
and `app/account/page.tsx` `[unratified]` (grepped directly). `TilePopover` itself clamps its position to
the viewport (`tile-popover-position.ts`) so it never renders off-screen, but that is collision-avoidance,
not a responsive layout in the breakpoint sense.

What is missing: there is no documented mobile layout for the live board, the win overlay, or any of the
main screens. `GAP:` no design brief among the sources for this document specifies mobile or tablet
breakpoints, column reflow, or touch-target sizing for the diamond tile shapes. A coding agent building a
new screen has no responsive pattern to copy from an existing comparable screen; this is close to a blank
slate, not a gap in an otherwise-covered system.

## 8. Design assets not in this repo

These live at `point-taken-brain/docs/reference/materials/design-reference/`, above the repo root, and
are never pushed to the game's own repository. A coding agent working from a clone of
`point-taken-brain/web/point-taken-2026` alone cannot open any of these; each one must be requested from
Steve by the exact filename below.

- **`pt-game-board.png`**: a screenshot of the live board mid-game. Shows the octagonal-tile board with
  green/orange side-colored borders, a central black-bordered "TOPIC" octagon, a "RESOLVE THREAD" popup
  with resolution-token icons, a "RULE CARDS" row, a "Paths to Winning" card reading "1/4" and "Not yet,"
  a room-code header, and a "Plus Peer" indicator.
- **`pt-onboarding.png`**: the onboarding tooltip overlay over a dimmed board, showing two-step copy
  about writing supporting reasons, pagination dots, and a next arrow.
- **`pt-rule-cards.png`**: the rule-card popup mockup, a pink card headed "Mutual Respect / 'You' is
  Taboo," with agreement text, two example reason tiles (one struck through), and a list of forbidden
  phrases each marked with a circle-slash icon.
- **`pt-choose-topic.png`**: a room-join confirmation mockup: "Room #: 83083 / You have been joined the
  room," with two joined-player check icons.
- **`pt-popout-resolved.png`**: a "Disagree on priorities?" popup mockup showing four paired priority
  axes (Equity/Merit, Liberty/Safety, Globalism/Nationalism, Progress/Tradition) as a pick-one interface,
  plus one empty pair row.
- **`pt-original-overview.png`**: a wide screenshot of the full Figma board overview: dozens of small
  frame thumbnails across several gray section groups, not legible at a glance; useful only as a map of
  where things live in Figma, not as a spec of any single screen.
- **`rebrand-design-guide-full.png`**: a design-style reference sheet showing type samples ("Aa" in two
  weights, a "Heading 1" sample), color swatches (green and orange dots matching the tokens in section 2,
  plus black/red/yellow-face dots not matched to any token in `globals.css`), a small icon set, and
  several Point Taken cover/card mockups.
- **`2026-07-03_game-guide-panel.pdf`** (3.4MB): not opened for this document; must be requested by name.
- **`2026-07-03_onboarding-modal-step3.pdf`** (956KB): not opened for this document; must be requested by
  name.
- **`2026-07-14_account-page-mockups.html`** (37KB): referenced directly by
  `docs/reference/materials/design-briefs/2026-07-23_brief_finished-map-and-thread-compression.md`, which
  instructs a builder to "open it in a browser: it already sketches a 'Finished map' and a 'Certificate,'
  and uses the full PT color/type system" `[ruled]`. Not opened in full for this document; request by
  name and open locally rather than assuming its content.

Two designers, Rannie (Xinran Li) and Audrey Chung, hold Figma (`Pointaken_2026`,
`60wr75TY7I95UnL6jkLz2J`) as the actual source of truth; Figma is not in the repo and is not listed above
because it is a live tool, not a static asset, but it is the primary place a coding agent's visual
questions should be answered once these files run out.

## 9. Known gaps between Figma/spec and code

From `docs/reference/materials/design-briefs/2026-08-19_rannie-figma-delta.md` (BRAIN-T260817-02)
`[ruled]`, drawn-but-cut systems: an eight-rung level ladder with different names than the shipped
four-level ladder that actually ships (`SCRIPTED_LEVELS` at `lib/gym/levels/index.ts:8`, four entries;
`app/gym/page.tsx` itself is now only a redirect to the ladder strip, `[ruled]` `BRAIN-T260904-22`); a per-match
"Win/Loss" versus score (the actual model is one shared team score, and per-match opponent comparison
stays out of scope, `BIZ-T260822-05`); an events calendar with signups; a "Season 3" / version
footer; a boss-count badge pending a roster decision. No longer cut: a public "Cooperation Score" with
percentile rank, and a ladder rank in a named division, are now `[ruled Steve 2026-09-03]`
(`BRAIN-T260903-11`) to be built on the profile as tiles on invented sample data; see `roadmap.md`
section 3. Stale naming: "Dojo" (now "Gym," BRAIN-T260816-18);
rule cards named for the fallacy rather than the good move; 11 cards across levels 2-8 in Figma versus 8
card tracks in the decided model. `GAP:` across which levels do those 8 tracks run? Neither the four
levels the Gym ships nor the eight-rung ladder `roadmap.md` section 5 designs on paper divides into 8
tracks cleanly. Only the Figma delta brief can settle the range.

Fields Figma shows that the app does not store this way: city/location (no privacy decision has been made to collect it); email/password as a custom form
(should be a provider link-out); badges as a fraction (badges are re-earnable, so they need an occurrence
count, not a fraction). `current`/`longest` streak is not rendered on the profile: the 2026-09-04
profile restyle (`BRAIN-T260904-40`) takes both `Counter` and `StreakCounters` off that page (they
"stay in the tree
for the tabs that still use them," per the page's own header comment), so the streak is not shown on
Profile today `[unratified]` (`app/account/profile.tsx:57-62`); `roadmap.md` section 5 separately defers
streaks because the data model does not support them, which is a second, independent reason it stays
unshown. Emoji resolutions broken out by type (fact/priorities/taste) remains a field Figma shows that
the app does not store this way. Figma's signing-ritual frame draws four lines; shipped code keeps
three, folding "I'll control my emotions" into Mutual Respect and cutting it as its own line, which is
settled, not a live conflict `[ruled]` (`lib/board/setup.ts:46-49`). The three pledges'
short labels ("Play fair," "Stay on the thread," "Pin it down") are also gone: each pledge's title is now
its own family name (Mutual Respect, Honest Thinking, Shared Evidence) read out in full, not a nickname
`[ruled Steve 2026-09-05]` (`lib/board/setup.ts:45-70`); see `rules.md` section 3 for the full pledge text.
One conflict remains settled: Rannie's live-board frame has no hand/throw mechanic for picking up and
throwing a rule card at
a tile, which the brief called "the single largest new interaction in the whole roadmap." Shipped code
uses a two-click flow (click a card in the tray, then click the tile to play it on), with a first-use
hint saying exactly that (`components/board/live-board.tsx:3253-3264`). The two-click flow is the
gesture; a drag or throw is not wanted `[ruled Steve 2026-09-05, BRAIN-T260905-35]`.

From direct code inspection, three gaps not called out in any design brief:
- Three of the four alert variants (`error`, `info`, `warning`) render with hardcoded stock Tailwind
  colors (`border-red-600 bg-red-100`, `border-blue-600 bg-blue-100`, `border-amber-600 bg-amber-100`)
  that do not exist anywhere in the `@theme` token block; only `success` (`border-green bg-mint`) uses a
  real token `[unratified]` (`components/alerts/alert-stack.tsx`). A designer needs to either ratify these
  three colors as real tokens or hand back the intended values.
- `AlertStack` is mounted globally in `app/layout.tsx` and fully built, but grepping the entire
  `app/`/`components/`/`lib/` tree for `alertActions.` finds callers only in the test file
  (`alert-store.test.ts`) `[unratified]`. No production code path pushes a toast today.
