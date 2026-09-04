/**
 * Where a tile sits on the spatial board.
 *
 * The retired client stored a `parentEdge` on every tile at the moment a
 * player placed it, then just replayed those stored edges to lay the board
 * out (`useGameBoard.ts`'s `buildGameBoard`). `BoardTile` here has no such
 * field, so a position has to be derived from the tree structure instead of
 * read back. This function derives it by replaying placement history against
 * the same legality rule the retired client's hover UI used to decide where
 * a tile was even allowed to go (`GameBoard.vue`'s `hoverPositions`), so a
 * game ported from the old schema lays out the way it actually would have on
 * production, and a new game lays out the same way it plays.
 *
 * Two things about that rule are easy to get wrong by guessing instead of
 * reading the source:
 *
 * - Only the four diagonal neighbors are placeable, never the four
 *   orthogonal ones. The retired client's `offsets` array has eight entries;
 *   `placeableOffsets` filters it down to the diagonals, and `computeEdge`
 *   separately rejects any orthogonal placement a click resolves to. This is
 *   a rule of the game, not a consequence of the tile's shape: the tile is a
 *   regular octagon and has flat edges in all eight directions, so nothing
 *   about the geometry forbids a north or east neighbour. The retired client
 *   simply does not offer one, and neither do we.
 * - A candidate cell is illegal if the tile has any other tile
 *   touching it, not just if the cell itself is occupied. A candidate is
 *   thrown out if any of its own eight neighbors already belongs to a tile
 *   other than the one being built on, which keeps a new tile from visually
 *   crowding into some unrelated thread. Skipping this half of the rule
 *   produces a layout that fits, but not the one production would have
 *   produced.
 */

export interface GridPosition {
  x: number;
  y: number;
}

interface LayoutInput {
  id: string;
  parentId: string | null;
  /**
   * Which side's corner this tile wants, when it has a choice of four.
   *
   * Only the thread starters hanging off the topic pass one. Everything deeper
   * leaves it off and takes the first legal diagonal, as it always has.
   */
  side?: "plus" | "minus" | null;
}

export interface BoardLayout {
  positions: Map<string, GridPosition>;
  /** Tiles that could not find a legal cell, in the order they were skipped. */
  unplaced: string[];
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

const DIAGONAL_OFFSETS: readonly GridPosition[] = [
  { x: 1, y: -1 }, // NE
  { x: 1, y: 1 }, // SE
  { x: -1, y: 1 }, // SW
  { x: -1, y: -1 }, // NW
];

/**
 * The order a thread starter tries the topic's four diagonals in.
 *
 * Steve ruled on 2026-09-03 that the side is the position on the real board,
 * not only on the hover ghosts: Plus starts threads on the right, Minus on the
 * left, and a two-thread game fills the two bottom corners. So each side tries
 * its own bottom corner first, then its own top one, and only then the other
 * side's, which it reaches at all only because `lib/board/rules.ts` still
 * allows a root anywhere and a board whose history predates this convention
 * must still draw.
 *
 * This has to agree with the Ways to win minimap (`ways-to-win-card.tsx`,
 * SLOTS): tr and br are Plus, tl and bl are Minus. y grows downward here, so
 * the bottom corners are the positive ones.
 */
const SIDE_OFFSETS: Record<"plus" | "minus", readonly GridPosition[]> = {
  plus: [
    { x: 1, y: 1 }, // bottom right
    { x: 1, y: -1 }, // top right
    { x: -1, y: 1 }, // bottom left
    { x: -1, y: -1 }, // top left
  ],
  minus: [
    { x: -1, y: 1 }, // bottom left
    { x: -1, y: -1 }, // top left
    { x: 1, y: 1 }, // bottom right
    { x: 1, y: -1 }, // top right
  ],
};

const ALL_NEIGHBOR_OFFSETS: readonly GridPosition[] = [
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
];

/**
 * A parent id no tile can hold, passed to `isLegal` when the caller wants a
 * cell whose every neighbour counts as a third party. Tile ids are uuids and
 * the centre cell is TOPIC_CELL_ID, so nothing real holds a space.
 */
const NO_PARENT = "no parent";

function cellKey(pos: GridPosition): string {
  return `${pos.x},${pos.y}`;
}

function isLegal(
  target: GridPosition,
  parentId: string,
  occupancy: Map<string, string>,
): boolean {
  if (occupancy.has(cellKey(target))) return false;
  for (const offset of ALL_NEIGHBOR_OFFSETS) {
    const neighbor = { x: target.x + offset.x, y: target.y + offset.y };
    const occupant = occupancy.get(cellKey(neighbor));
    if (occupant != null && occupant !== parentId) return false;
  }
  return true;
}

/**
 * A cell for a parentless tile that is not the first one, found by walking
 * outward along the NE/SW diagonal until one is far enough from everything
 * already placed. Only reached by callers that do not root the board on the
 * topic tile; see the note at the call site.
 */
function firstFreeRootCell(occupancy: Map<string, string>): GridPosition | null {
  if (occupancy.size === 0) return { x: 0, y: 0 };
  for (let ring = 2; ring <= 64; ring += 2) {
    for (const candidate of [
      { x: ring, y: -ring },
      { x: -ring, y: ring },
      { x: ring, y: ring },
      { x: -ring, y: -ring },
    ]) {
      // A sentinel parent id no tile can have, so every neighbour counts as a
      // third party and the new root keeps clear of every existing thread.
      if (isLegal(candidate, NO_PARENT, occupancy)) return candidate;
    }
  }
  return null;
}

/**
 * Placement order, with any tile that hangs off a later one pulled after its
 * parent.
 *
 * Placement order is almost always parent-first already, because you place a
 * reason on a reason that is on the board. A relocation breaks that: "move it"
 * can hang an early tile under a tile that was written after it, and the layout
 * replays history, so it would reach the child while the parent still has no
 * position and drop the child as unplaced. On screen that is a reason both
 * players can read in the THREADS drawer and cannot see on the board.
 *
 * So the order is relaxed, not abandoned: each pass takes the tiles whose
 * parent is already out, in their original order, which leaves every board that
 * was already parent-first laid out exactly as before. A tile whose parent is
 * not in the list at all, and a reparenting cycle, both stall the passes; the
 * leftovers go on the end in their original order and fail the same
 * parent-has-no-position check they always did.
 */
function parentsFirst(tiles: LayoutInput[]): LayoutInput[] {
  const ordered: LayoutInput[] = [];
  const placed = new Set<string>();
  let remaining = tiles;

  while (remaining.length > 0) {
    const ready: LayoutInput[] = [];
    const waiting: LayoutInput[] = [];
    for (const tile of remaining) {
      if (tile.parentId == null || placed.has(tile.parentId)) ready.push(tile);
      else waiting.push(tile);
    }
    if (ready.length === 0) return [...ordered, ...waiting];
    for (const tile of ready) {
      ordered.push(tile);
      placed.add(tile.id);
    }
    remaining = waiting;
  }

  return ordered;
}

/**
 * Lays out tiles in placement order. `tiles` should already exclude removed
 * ones: a removed tile has no place on the spatial board and does not block
 * a cell for anyone else, matching `BoardThread.orphans` treating its
 * children as parentless rather than as still hanging off it.
 */
export function layoutBoard(tiles: LayoutInput[]): BoardLayout {
  const positions = new Map<string, GridPosition>();
  const occupancy = new Map<string, string>();
  const unplaced: string[] = [];

  for (const tile of parentsFirst(tiles)) {
    if (tile.parentId == null) {
      // The first parentless tile takes the origin. A later one cannot also
      // take it, and this used to overwrite: a real board has one parentless
      // tile per thread, so every thread root landed on (0,0) and all but the
      // last vanished from the layout while still counting as placed.
      //
      // Callers should not reach this case more than once. `topicRootedLayout`
      // below reparents every thread root onto the topic tile, which is the
      // actual board geometry. This is the fallback for a caller that does
      // not, and it spirals outward through the diagonals so the tiles are at
      // least all visible and none is silently lost.
      const root = firstFreeRootCell(occupancy);
      if (!root) {
        unplaced.push(tile.id);
        continue;
      }
      positions.set(tile.id, root);
      occupancy.set(cellKey(root), tile.id);
      continue;
    }

    const parentPos = positions.get(tile.parentId);
    if (!parentPos) {
      unplaced.push(tile.id);
      continue;
    }

    const offsets = tile.side ? SIDE_OFFSETS[tile.side] : DIAGONAL_OFFSETS;
    const spot = offsets
      .map((offset) => ({
        x: parentPos.x + offset.x,
        y: parentPos.y + offset.y,
      }))
      .find((candidate) => isLegal(candidate, tile.parentId as string, occupancy));

    if (!spot) {
      unplaced.push(tile.id);
      continue;
    }

    positions.set(tile.id, spot);
    occupancy.set(cellKey(spot), tile.id);
  }

  if (positions.size === 0) {
    return { positions, unplaced, width: 1, height: 1, offsetX: 0, offsetY: 0 };
  }

  const PADDING = 1;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const pos of positions.values()) {
    minX = Math.min(minX, pos.x);
    maxX = Math.max(maxX, pos.x);
    minY = Math.min(minY, pos.y);
    maxY = Math.max(maxY, pos.y);
  }

  return {
    positions,
    unplaced,
    width: maxX - minX + 1 + PADDING * 2,
    height: maxY - minY + 1 + PADDING * 2,
    offsetX: PADDING - minX,
    offsetY: PADDING - minY,
  };
}

/** The synthetic id the topic diamond occupies in a topic-rooted layout. */
export const TOPIC_CELL_ID = "topic";

/**
 * The board's real geometry: the topic diamond sits at the centre and every
 * thread hangs off one of its four diagonals.
 *
 * The projection gives a thread root a `parentId` of null, so a flat
 * `layoutBoard` call treats four threads as four competing origins. They are
 * not: they are four children of the topic, which is drawn on the board and
 * which the retired client positioned exactly this way. Reparenting them onto
 * `TOPIC_CELL_ID` is what makes a multi-thread board lay out at all.
 *
 * It also makes the four-thread cap geometric rather than a rule enforced
 * elsewhere: a centre tile has four diagonals, so a fifth thread has nowhere
 * to go and comes back in `unplaced`. Note that `MAX_THREADS` in
 * `lib/board/rules.ts` is currently 6, which this geometry cannot draw. Steve
 * ruled on 2026-08-31 that the board caps at four and that six is unreachable
 * until compact mode ships, so the mismatch is in the rules constant, not
 * here. That constant is in a core file and is not ours to change: a caller
 * that gets a non-empty `unplaced` should say so on screen rather than drop
 * the tiles.
 */
export function topicRootedLayout(tiles: LayoutInput[]): BoardLayout {
  return layoutBoard([
    { id: TOPIC_CELL_ID, parentId: null },
    ...tiles.map((tile) => ({
      id: tile.id,
      parentId: tile.parentId ?? TOPIC_CELL_ID,
      // Only a thread starter gets a corner of its own. Everything deeper is
      // laid out relative to the reason it answers, where left and right carry
      // no meaning, so passing the side down would only make a reply prefer a
      // diagonal for no reason a player could read.
      side: tile.parentId == null ? (tile.side ?? null) : null,
    })),
  ]);
}

/**
 * The cells a new tile may legally go in if built on `parentId` right now.
 * Same rule `layoutBoard` replays historically, run live against a layout
 * that already exists, for the hover-to-place affordance.
 */
export function legalPlacements(
  layout: BoardLayout,
  parentId: string,
  side?: "plus" | "minus" | null,
): GridPosition[] {
  const parentPos = layout.positions.get(parentId);
  if (!parentPos) return [];

  const occupancy = new Map<string, string>();
  for (const [id, pos] of layout.positions) occupancy.set(cellKey(pos), id);

  const offsets = side ? SIDE_OFFSETS[side] : DIAGONAL_OFFSETS;
  return offsets
    .map((offset) => ({
      x: parentPos.x + offset.x,
      y: parentPos.y + offset.y,
    }))
    .filter((candidate) => isLegal(candidate, parentId, occupancy));
}
