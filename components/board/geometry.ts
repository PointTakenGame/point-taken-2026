/**
 * Tile geometry, in one place, traced back to the two sources that agree.
 *
 * The tile is a **regular octagon**, and it has been one in the shipped game
 * for a year. The retired client draws it without ever naming it: `Tile.vue`
 * puts a 45-degree-rotated square inside an `overflow-hidden` wrapper of the
 * same size, and a square intersected with itself rotated 45 degrees is a
 * regular octagon. The corner lands where the cut line `x + y = 0.707` meets
 * `x = 0.5`, which is `y = 0.207`, so the vertex sits 29.3% along each edge.
 *
 * That is why the retired repo contains no `clip-path` and not one use of the
 * word "octagon" on the board: the shape is a consequence of two rotations,
 * so nothing had to name it. An earlier port of `Tile.vue` read the rotation
 * and not the clipping, dropped the second square as a redundant "trick", and
 * shipped a diamond. These constants exist so that cannot happen twice.
 *
 * Measured independently off Rannie's render (Figma `1064:214081`, the play
 * canvas that live 1v1 and the Gym both use): tiles are 234 px square, the
 * corner cut reaches full width between 29.1% and 29.9%, the faint outer ring
 * sits at 254 px (ratio 1.085), and the diagonal centre-to-centre pitch
 * averages 191 px (ratio 0.816). The retired client's rem values predict
 * 1.088 and 0.824. The design and the shipped code are the same board.
 */

/** `Tile.vue` outer-wrapper: the 17rem inner box grown by `-inset-3` a side. */
export const OUTER_FRAME_REM = 18.5;

/** `Tile.vue` inner-wrapper: `size-[17rem]`, the tile people actually see. */
export const INNER_FRAME_REM = 17;

/** `GameBoard.vue` grid: `repeat(var(--cols), 14rem)`. Tiles overhang cells. */
export const CELL_REM = 14;

/**
 * Inner octagon as a fraction of the component's declared box. Callers size
 * and position a tile by that box, so the box is the outer ring, the true
 * visual bound, and the inner frame is inset within it.
 */
export const INNER_FRAME_RATIO = INNER_FRAME_REM / OUTER_FRAME_REM;

/**
 * Grid pitch as a fraction of the declared box. Octagons at this pitch do not
 * touch: they leave the square gaps of an octagon-and-square tessellation,
 * which is the faint background lattice in Rannie's render. Edge-to-edge
 * contact would be 0.707, and the board is deliberately looser than that.
 */
export const CELL_PITCH_RATIO = CELL_REM / OUTER_FRAME_REM;

/**
 * The silhouette, for hit testing and for anything that needs the outline
 * without the two-rotation construction. Identical to the polygon already in
 * `ways-to-win-card.tsx`, itself ported from the retired `WaysToWinCard.vue`,
 * which is the one place the old repo did draw the shape explicitly.
 */
export const OCTAGON_CLIP =
  "polygon(29% 0%, 71% 0%, 100% 29%, 100% 71%, 71% 100%, 29% 100%, 0% 71%, 0% 29%)";

/**
 * The same eight corners, in a form an SVG can draw a line along.
 *
 * A clip-path cannot be stroked, and a CSS border on a clipped box draws only
 * the four straight sides: the corners are cut away by the clip, so an empty
 * slot outlined that way came out as four floating dashed segments with no
 * diagonals, which reads as a broken rectangle rather than as the shape of the
 * tile that is about to land there. Anything that needs the outline itself,
 * rather than the silhouette to cut to, uses these points instead.
 *
 * Percentages of the box, so the polygon goes in a `viewBox="0 0 100 100"`.
 */
export const OCTAGON_POINTS = "29,0 71,0 100,29 100,71 71,100 29,100 0,71 0,29";

/**
 * Tile text, sized against the tile rather than against the page.
 *
 * Measured off Rannie's live board (`1096:252192`): on a 256 px tile the lead
 * line ("No, because") runs about 8.6% of the tile's width and the reason
 * under it about 7.4%. The two lines are separated by size, not by weight:
 * Coming Soon ships one weight, so a `font-semibold` on the lead is the
 * browser faking a bold that does not exist, and it reads as smudged rather
 * than as emphasis.
 *
 * Kept as px derived from `OUTER_FRAME_REM` instead of the page's `--text-p-*`
 * scale, because a tile is a drawn object at a fixed rem size: its text has to
 * hold its share of the octagon, not its place in the UI type ramp. The board
 * scales the whole pane, so these scale with it.
 */
export const TILE_LEAD_RATIO = 0.086;
export const TILE_BODY_RATIO = 0.074;

/** The two sizes at the board's own tile. A component drawn at some other
 *  size (the collapsed-thread fan, a tile in a list) applies the ratios to
 *  its own box instead, so its text stays in proportion to what it drew. */
export const TILE_LEAD_PX = Math.round(OUTER_FRAME_REM * 16 * TILE_LEAD_RATIO);
export const TILE_BODY_PX = Math.round(OUTER_FRAME_REM * 16 * TILE_BODY_RATIO);

/**
 * The two things a thread is "about" read as load-bearing at a glance: the
 * topic, and the reason that opens each thread off it (`tile.parentId ===
 * null`). Steve's ruling, 2026-09-05: give both a border about three times a
 * normal reason tile's, with the extra thickness eating into the tile's own
 * white padding rather than growing the octagon, so text and the plus/minus
 * glyph move inward to keep clear of it.
 *
 * Not a Figma measurement. Rannie's frames use one stroke weight everywhere;
 * this is a decision layered on top of her palette, not a port of one of her
 * values. `TileShape`'s border classes are written out literally at 3px and
 * 9px (Tailwind's arbitrary-value scanner needs the literal class text, not
 * a computed one), so these two numbers are the ones to change together if
 * the ruling ever changes.
 */
export type TileWeight = "normal" | "root";
export const TILE_BORDER_PX: Record<TileWeight, number> = { normal: 3, root: 9 };
/** How far the content layer (text, watermark, glyph row) moves inward on
 *  top of its normal padding, to stay clear of the thicker root border. */
export const TILE_CONTENT_INSET_PX: Record<TileWeight, number> = { normal: 0, root: 6 };
