# Where the art came from

Everything in these four directories was drawn for Point Taken years before this
codebase existed and copied here verbatim out of the retired Nuxt client,
`point-taken-frontend`. Copyright (c) 2025-2026 Experception LLC, same as the
rest of the game. Nothing here was redrawn, recoloured, or re-exported; the only
change made to any file was lowercasing `Logo.svg` to `logo.svg` on the way in.

The old repository is going cold. Some of this is rendered today, some of it is
here purely so that it survives, which is the same reason the three deferred
resolution tokens are in `tokens/` with nothing able to place one. A drawing that
exists in exactly one repository and no longer has a use is one `rm -rf` away
from being gone.

## `brand/`

| file | source | rendered? |
|---|---|---|
| `logo.svg` | `app/assets/Logo.svg` | yes, `components/brand/art.tsx` |
| `logo.png` | `app/assets/logo.png` | no |
| `logo-notext.png` | `app/assets/logo-notext.png` | no |

`logo.svg` colours every shape from a `<style>` block rather than from inline
`fill` attributes, using the generic class names `.st0` through `.st14`. Load it
as an image, never inline it into a page: those names would collide with the
document around them. The visible ink is cream `#fdf8f3`, dark grey `#4d4c4a`,
teal `#3abaaa`, and orange `#f48625`. There is no background plate. Every
`<rect>` in the file lives inside a `<mask>`.

## `glyphs/`

From `app/assets/emojis/`. `monacle.svg` is misspelled in the source and the
misspelling is kept, so the two repositories name the same file the same way.

| file | rendered? |
|---|---|
| `book.svg` | yes, beside the signing agreement, which is what the old client used it for (`PlayerAgreement.vue`) |
| `party.svg` | yes, on a game that reached one of the two cooperative endings, as in the old `WinAlert.vue` |
| `glasses.svg` | no |
| `heart.svg` | no |
| `monacle.svg` | no |

The last three were never attached to a feature in the old client either. They
are preservation only.

## `priority/`

From `app/assets/icons/priority-modal/`. Eight icons: equity, globalism, liberty,
merit, nationalism, progress, safety, tradition. Nothing renders them, because
this codebase has no priorities mechanic.

**Keep and use them as a set.** They are politically balanced by construction,
four readable one way and four the other, and picking a subset breaks the balance
that makes them usable at all.

## `tokens/`

From `app/assets/emojis/`, ported earlier. Wired through
`components/board/token-glyph.tsx`, which also carries the words a player reads
for each one. Two of the five can be placed today; the other three are deferred
behind progression and are here so they are not lost.
