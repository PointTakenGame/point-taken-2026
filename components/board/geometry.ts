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
