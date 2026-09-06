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
defined in `globals.css` (`.form-base`, `.btn-primary`, `.btn-icon`, `.input-primary`) that are applied
directly as class names, e.g. `className="form-base btn-primary ..."`.

## 2. Design tokens

All values below are copied verbatim from `app/globals.css:21-56` `[ruled]`. Do not invent a hex code,
font stack, or spacing value that is not on this list; anything a screen needs that is not here is a
`GAP:` for a designer to fill, not something to guess.

### Color

| Token | Value | Note |
|---|---|---|
| `--color-green` | `#49ca81` | Plus side, everywhere in the game (`app/globals.css:23`). |
| `--color-orange` | `#ffb42f` | Minus side, everywhere in the game (`app/globals.css:24`). |
| `--color-mint` | `#9df4c5` | Secondary, used as success-alert background (`app/globals.css:27`). |
| `--color-peach` | `#ffe083` | Secondary (`app/globals.css:28`). |
| `--color-neutral-black` | `#1e1e1e` | Body text (`app/globals.css:33`). |
| `--color-neutral-white` | `#fffcf5` | Same value as `--color-offwhite`; both names are kept because ported markup uses both (`app/globals.css:30-36`). |
| `--color-gray` | `#747474` | Form borders, secondary text (`app/globals.css:35`). |
| `--color-offwhite` | `#fffcf5` | Page background (`app/globals.css:36`). |
| `--color-sand` | `#ffd979` | Button hover background (`app/globals.css:39`). |
| `--color-gold` | `#efae45` | Button hover border (`app/globals.css:40`). |
| `--color-brown` | `#73674e` | Warm accent, tile chrome (`app/globals.css:41`). |

There is no `--color-red`, `--color-blue`, or `--color-amber` token. Three of the four alert variants use
stock Tailwind default-palette colors that are not declared anywhere in `@theme`; see the gap noted in
section 9.

### Typography

| Token | Value | Font | Note |
|---|---|---|---|
| `--font-primary` | `var(--font-anton), sans-serif` | Anton (400, next/font/google) | Headings only (`app/globals.css:45`, `app/layout.tsx`). |
| `--font-secondary` | `var(--font-noto-sans), sans-serif` | Noto Sans (next/font/google) | Body text (`app/globals.css:46`). |
| `--font-tiles` | `var(--font-coming-soon), cursive` | Coming Soon (400, next/font/google) | The handwritten face reason tiles are set in; the header comment calls this "the single most recognisable thing about the game's look" (`app/globals.css:43-47`). |

Heading sizes, hardcoded outside the `@theme` block (`app/globals.css:65-89`): h1 56px, h2 48px, h3 24px,
all `--font-primary`, weight normal. h4/h5/h6/p use `--font-secondary`.

Body text scale (`app/globals.css:49-51`): `--text-p-lg: 20px`, `--text-p-md: 16px` (the body default),
`--text-p-sm: 13px`. There is no `--text-p-xs` or any size below 13px. There is no defined line-height
token; line-height is left to Tailwind's or the browser's default wherever it is not set inline. `GAP:`
what line-height should a coding agent use for body copy, if the default isn't intentional.

### Spacing and radius

There is no spacing-scale token and no radius token in `@theme`. Every padding, gap, and border-radius
value in the codebase is an ordinary Tailwind utility (`p-4`, `gap-2`, `rounded-2xl`, etc.) chosen
per-component, not read from a named token. The one exception is `.form-base`'s own hardcoded
`border-radius: 6px` (`app/globals.css:100`). `GAP:` there is no ratified spacing scale; a new screen has
to match nearby components by eye rather than by reading a token.

### Shadow

| Token | Value |
|---|---|
| `--shadow-sm` | `0px 2px 4px rgba(0, 0, 0, 0.1)` |
| `--shadow-md` | `0px 4px 8px rgba(0, 0, 0, 0.1)` |
| `--shadow-lg` | `0px 4px 8px rgba(0, 0, 0, 0.15)` |

(`app/globals.css:53-55`.) `.btn-primary` uses `shadow-sm` at rest, `shadow-md` on hover, back to
`shadow-sm` on active (`app/globals.css:121-131`).

### Form chrome and motion

`.form-base` (`app/globals.css:97-119`): 12px padding, 2px solid `--color-gray` border, 6px radius,
`--color-neutral-white` background, `--color-gray` text, 600 weight, 16px, centered. Hover (buttons only,
not disabled): background to `--color-sand`, border to `--color-gold`. Active: `transform: scale(0.97)`.
Transitions: background-color and box-shadow at 0.15s ease, transform at 0.1s ease.

`.btn-icon` (`app/globals.css:133-143`): fixed 52px height, flex-centered, 0.5 opacity when disabled.

Alert enter/exit animation, added 2026-08-25 for BRAIN-T260825-12 (`app/globals.css:154-188`): fade plus
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
- `board/resolution-picker.tsx`: the row of resolution tokens a player picks from to close a thread. Now
  labels every token with its word underneath, always visible rather than only on hover, and rings the
  token the other player has already placed in gold with a caption "They put this down. Match it to close
  the thread." `[unratified]` (`components/board/resolution-picker.tsx:33,45,57-69`).
- `board/rule-card-popup.tsx`: a rule card shown as reference, built on `TilePopover` with an empty body.
  Not rendered anywhere in the app: `level-intro.tsx` no longer shows a rule card at all
  `[ruled Steve 2026-09-05, BRAIN-T260905-39]`, and `rule-card-tray.tsx` does not import it either. The
  only caller is its own test file `[unratified]` (`components/board/rule-card-popup.test.tsx`).
- `board/rule-card-tray.tsx`: the "My rule cards" deck row with per-card counts; a first-use hint above it
  ("Click a card, then click the reason it applies to.") is owned and gated by `live-board.tsx`, not by
  the tray component itself `[unratified]` (`components/board/rule-card-tray.tsx:24-85`,
  `components/board/live-board.tsx:3253-3264`).
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
  (`components/board/spatial-board.tsx:76-98,147,1064-1120,1246-1350,1681-1704`).
- `board/stance-picker.tsx`: the plus/minus stance-selection buttons at setup.
- `board/tile-picker.tsx`: (new since the last pass; not read for this document, `GAP:` needs its own
  description).
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
- `board/topic-cell.tsx`: (new since the last pass; not read for this document, `GAP:` needs its own
  description; likely related to or replacing `topic-tile.tsx`, not confirmed).
- `board/topic-tile.tsx`: the neutral "TOPIC" watermark diamond; display-only in this pass. Renders with
  `weight="root"`, the same thick border as a thread's opening reason, since the topic tile is load-bearing
  too `[ruled Steve 2026-09-05]` (`components/board/topic-tile.tsx:20`).
- `board/use-game-feed.ts`: hook that triggers a server re-projection when the other player moves.
- `board/ways-to-win-card.tsx`: no longer a display-only minimap. The four corner slots (root tiles) and
  the center "TOPIC" octagon are now hoverable and clickable: hovering spotlights the matching tile on the
  real board, clicking a corner or the topic with a landed tile opens it; a corner with nothing placed yet
  renders as a plain non-interactive span `[unratified]` (`components/board/ways-to-win-card.tsx:20-25,
  210-216,270-342`). The header comment attributes the change to a 2026-09-05 playtest finding that the
  icons used to be inert.

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
- `info/paths-to-winning-card.tsx`: the persistent "paths to winning" HUD card. Exists but is not
  currently imported anywhere (see section 9).
- `local-day.tsx`: renders a UTC date string in the reader's own local timezone via
  `useSyncExternalStore`.
- `onboarding/onboarding-launcher.tsx`: the trigger button plus overlay bundle for the how-to-play page.
- `onboarding/onboarding-overlay.tsx`: the four-step full-screen new-player walkthrough.
- `onboarding/onboarding-video.tsx`: one looping instructional clip with a deliberate pause between
  loops.
- `resume-or-start.tsx`: the profile's single action button that reads either "resume" or "start."
- `rooms/room-entry.tsx`: the join/create-room entry form (agreement tick when signed out, join-by-code,
  "Create a room"); also exports standalone `JoinByCode` and `JoinRoom`, reused elsewhere (e.g. the
  Profile hero's Live-play card) `[unratified]` (`components/rooms/room-entry.tsx:75-155`).
- `legal/agreement.tsx`: the Terms/Privacy tick box (`AgreementTick`) gating anonymous account creation.
  Distinct from the three-line signing ritual in `lib/board/setup.ts`, which is a separate, later
  affirmation `[unratified]` (`components/legal/agreement.tsx:56-84`).
- `home/home-links.tsx`: the footer link row on the signed-out front door.
- `topics/enter-topic-button.tsx`: (new since the last pass; not read for this document, `GAP:` needs its
  own description).
- **`site-nav.tsx` is deleted `[ruled]`** (`BRAIN-T260904-22`, commit `ccca4ae`, "one nav out of game: the
  four tabs, and the ladder is the level select"). Rannie's frames draw one nav bar total, the four-tab
  account shell (see the new Account group below); nothing else in the app shows a nav bar.
- `streak-counters.tsx`: the `current/longest` streak string, read via `useSyncExternalStore`.

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
- `gym/gym-lobby.tsx`: (not read in full for this document; the ladder/level-select surface itself is
  `account/progression/ladder-strip.tsx` below, per BRAIN-T260904-22).
- `gym/level-intro.tsx`: one component, two cards toggled by internal state before a level starts. Card
  one is the boss portrait/title/tip card with "Next →." Card two used to show the level's rule card face
  down; that is gone `[ruled Steve 2026-09-05, BRAIN-T260905-39]`, since telling a player about a rule
  card before they know rule cards exist undercuts the moment the board later teaches it. Card two is now
  an agreement screen: one sentence naming the level, boss, and topic, the three `SIGNING_LINES` pledges
  read in full, then two separately gated buttons, "I agree to all three" (signs) and "Start the game →"
  (disabled until signed) `[unratified]` (`components/gym/level-intro.tsx:111-278`).
- `gym/pointed-slot.ts`, `gym/pointed-tile.ts`: `useSyncExternalStore` pub/sub stores letting the director
  tell the spatial board which empty slot or existing tile to auto-frame.
- `gym/sample-answers.ts`: (not read in full for this document).
- `gym/start-level-button.tsx`: (not read in full for this document).

**Account** (the four-tab shell that replaced `site-nav.tsx`; none of this existed in the previous pass)
- `account/account-shell.tsx`: the shared four-tab chrome for every out-of-game screen. Exactly four tabs,
  Profile (`/`), Cards & Badges (`/cards`), History (`/account/history`), Settings (`/settings`)
  `[ruled]` (`BRAIN-T260904-22`, `components/account/account-shell.tsx:45-58`).
- `account/avatar-picker.tsx`: opens a dialog with a 3x3 grid of the nine fixed `PLAYER_EMOJIS`
  (`lib/avatar.ts:37-47`) plus a "Use my initials" reset button; triggered from the clickable hero avatar
  `[unratified]` (`components/account/avatar-picker.tsx:88,101,104-133`).
- `account/calendar-strip.tsx`: (not read in full for this document).
- `account/hero.tsx`: `ProfileHero`, the identity block atop Profile (clickable avatar, name, "Player
  since"/anonymous line, level pill, two action cards for Gym play and Live play, three stat tiles); the
  "Cooperation score" stat tile links to `/leaderboard?by=cooperation` `[unratified]`
  (`components/account/hero.tsx:40-45,120-127,200-206`).
- `account/match-list.tsx`: the History tab's full game archive list, filterable by mode via the page's own
  `ModeFilter` when a player has both Gym and Live games.
- `account/progression/badge-strip.tsx`, `account/progression/certificate-wall.tsx`: badge and certificate
  displays on Profile; sample-data status for badges not confirmed in this pass (see the progression
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
  `[unratified]` (`components/ui/anchored-card.tsx:41-60`).
- `ui/floating-panel.tsx`: (not read in full for this document, `GAP:` needs its own description).
- `ui/tile-popover.tsx` (754 lines): the single generic anchor-relative pop-up. See section 5.
- `ui/tile-popover-position.ts`: pure positioning/clamping math for `TilePopover`, split out to be
  unit-testable without a DOM.
- `ui/tile-popover-presets.ts`: static copy/shape presets (heading, subtitle, glyph, field placeholders)
  for the game's known `TilePopover` uses; carries no live state.

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
  a signed-out visitor instead sees the front door (wordmark, `RoomEntry signedIn={false}`, a guest-only
  "Set me up" button, `HomeLinks`) `[unratified]` (`app/page.tsx:1,4,6,41,54,62,71`, ruled 2026-09-03 per
  the header comment).
- `app/how-to-play/page.tsx`: the rules page, uses `TokenGlyph` and coach-card data.
- `app/game/[gameId]/page.tsx`: the board page. Branches on game status: setup renders `GameSetup`,
  in-progress renders `LiveBoard`, ended renders `Ending` + `FinishedMap` + `WinOverlay`. Also imports
  `HotseatBar` (sandbox-only).
- `app/account/page.tsx`: no longer the profile screen itself. It stays only as the `/account` route
  target (linked from the tab bar and elsewhere) and redirects its rendering to `app/account/profile.tsx`
  for a signed-in player, or a "you are not signed in" panel with `StartPlaying` otherwise `[unratified]`
  (`app/account/page.tsx:1-33`).
- `app/account/profile.tsx`: the actual Profile screen (`Counter`, `LocalDay`, `ResumeOrStart`,
  `StreakCounters` are folded into or superseded by the newer `ProfileHero` / `LadderStrip` /
  `CertificateWall` / `BadgeStrip` / `CalendarStrip` composition described under the Account component
  group above; not verified line-by-line for every one of those four older names).
- `app/account/history/page.tsx`: the History tab, `MatchList` plus a link-based Gym/Live `ModeFilter`
  shown only when a player has games in both modes.
- `app/join/[code]/page.tsx`: public invite-entry route.
- `app/cards/page.tsx`: the Cards & Badges tab, three components in order: `CardWall`, `BossCollection`,
  `BadgeGallery`, inside `AccountShell tab="cards"` `[unratified]` (`app/cards/page.tsx:7-13,66-122`). The
  earlier note that "only the cards half is built" is now out of date; badges render too, flagged sample.
- `app/gym/page.tsx`: no longer a level-select page. It is a redirect only, to `/#ladder`, per the
  2026-09-04 one-nav ruling; the Profile's ladder strip is the level select now `[ruled]`
  (`BRAIN-T260904-22`, `app/gym/page.tsx`).
- `app/gym/actions.ts`: the `startLevel` and `bossAct` server actions that drive a Gym match.
- `app/leaderboard/page.tsx`: renders inside `AccountShell tab="profile"` with a back link, not as its own
  tab, since it is a stat's detail page rather than a place of its own `[unratified]`
  (`app/leaderboard/page.tsx:10,117-209`).
- `app/signin/page.tsx`, `app/settings/page.tsx`: auth and settings; the settings page's header comment
  cites Rannie's frame 755:25347 for systems still undecided. `app/settings/settings-form.tsx` and
  `app/settings/coach-persona-picker.tsx` are new since the last pass (not read in full for this document).

## 5. Interaction specs for non-obvious pieces

Source: `docs/reference/materials/design-briefs/2026-08-25_alerts-win-info-interaction-spec.md`
(BRAIN-T260825-34) `[ruled]`, cross-checked against the actual code. All three surfaces below were
explicitly evaluated against `TilePopover` and rejected as a fit; each is its own component.

### Alert stack (`components/alerts/`)
Fixed `bottom-4 left-4`, `z-50` (topmost layer in the app), width `22rem` capped at `92vw`. Enter/exit is
fade plus an 8px vertical slide, 180ms each way (`animate-alert-in` / `animate-alert-out`,
`app/globals.css:160-188`). Auto-dismiss: 4000ms for the `success`/`error`/`info`/`warning` convenience
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
determined either way.

### Paths-to-winning card (`components/info/paths-to-winning-card.tsx`)
A persistent, non-transient HUD card: no animation, no timeout, at most one instance. Header text is the
static string "PATHS TO WINNING". Body is a `grid-cols-2` of all five tokens in
`ALL_RESOLUTION_TOKENS` (`[...RESOLUTION_TOKENS, ...DEFERRED_RESOLUTION_TOKENS]`, so 👍 👀 🔍 ⚖️ 🍷,
three of which are not placeable, which is contradiction 5 in `rules.md` section 13), a dynamic
`{resolvedCount}/{threads.length}` count, and a diamond indicator reading either "Revised" or "Not yet"
for the topic-revision state. One button, "Revise"; its behavior is owned by whichever parent mounts the
card, not by the card itself. The card docks in normal document flow rather than floating fixed in a page
corner, per the spec's note that the two placements differ materially and the floating one was not
requested back. **Nothing mounts it.** Its only importer is
`components/info/paths-to-winning-card.test.tsx`; see sections 3 and 9.

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
- **The card no longer restates the tile's own text.** The octagon is already on the board a few pixels
  away in its own hand and colour, so the card's job is only what a player cannot already see by looking
  `[ruled Steve 2026-09-05]` (`components/board/live-board.tsx:3461-3467`).

All action items render as real `<button type="button">` elements, not links or plain text
(`ActionItem` at `components/board/live-board.tsx:481`; Edit/Remove rows at `:1314,1323`). A second,
simpler "yours:" link row exists for a non-`onBoard` context (the folded thread drawer) and still shows
plain "edit"/"remove" text links there; its "remove" link is gated only by the raw `removeVerdict`, not
by `isTerminal` `[unratified]` (`components/board/live-board.tsx:1310-1332`).

### Turn timers
There is no turn timer component to build. Turn timers are out of scope for this edition by ruling
[ruled Steve 2026-09-03, BRAIN-T260903-01]; they belong to the Heart edition. `app/how-to-play/page.tsx:110`
already states the correct rule in its player-facing copy: a thread resolves "when a player concedes,
and not when a timer runs out." An earlier version of this section cited a 30-second speaker timer and
a 45-second summarize timer as an established, ruled fact needing a build; that citation was a mistake
and is superseded.

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
count, not a fraction). One item in an earlier pass of this section is now stale: `current`/`longest`
streak was rendered on the profile via `StreakCounters`, but the 2026-09-04 profile restyle
(`BRAIN-T260904-40`) removed both `Counter` and `StreakCounters` from that page (they "stay in the tree
for the tabs that still use them," per the page's own header comment), so the streak is not shown on
Profile today `[unratified]` (`app/account/profile.tsx:57-62`); `roadmap.md` section 5 separately defers
streaks because the data model does not support them, which is a second, independent reason it stays
unshown. Emoji resolutions broken out by type (fact/priorities/taste) remains a field Figma shows that
the app does not store this way. One conflict this list used to carry as unresolved is now settled: Figma's
signing-ritual frame draws four lines; shipped code keeps three, folding "I'll control my emotions" into
Mutual Respect and cutting it as its own line `[ruled]` (`lib/board/setup.ts:45-70`). The three pledges'
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
- `PathsToWinningCard` is exported from `components/info/paths-to-winning-card.tsx` but is never imported
  anywhere in `app/` or `components/` `[unratified]` (confirmed by grep). Its own header comment discloses
  this: "Not wired into `components/board/live-board.tsx` this round." A coding agent should not assume
  this card is visible on the live board just because it exists in the tree.
