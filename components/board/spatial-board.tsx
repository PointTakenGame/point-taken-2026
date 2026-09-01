"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { CELL_PITCH_RATIO, OCTAGON_CLIP } from "@/components/board/geometry";
import {
  TOPIC_CELL_ID,
  legalPlacements,
  topicRootedLayout,
  type BoardLayout,
  type GridPosition,
} from "@/components/board/layout";

/**
 * The board as a plane instead of an indented list.
 *
 * The retired client drew the game this way and the rebuild never did: until
 * now `live-board.tsx` rendered each thread as a `<ul>` with `ml-6` on the
 * nested ones, and a player chose where a tile went from a `<select>` of every
 * tile on the board. That reads as a filing cabinet, not an argument.
 *
 * ## The one number that spaces the octagons
 *
 * A tile is a regular octagon inscribed in a box of `size` on a side, and the
 * grid pitch is not derived from that shape at all. It is measured: the
 * retired `GameBoard.vue` lays 14rem cells and hangs 18.5rem tiles on them, so
 * the pitch is 14/18.5 of the box and every tile overhangs its own cell. See
 * `components/board/geometry.ts`.
 *
 * That spacing is deliberately looser than contact. Octagons at these centres
 * do not touch: they leave the square gaps of an octagon-and-square
 * tessellation, which is the faint lattice behind Rannie's board. Measured off
 * her render the pitch averages 0.816 of the tile; the retired rem values
 * predict 0.824, and the difference is hand-placement jitter in Figma.
 *
 * This number was 0.5 for as long as the tile was drawn as a diamond, which
 * was correct for a diamond and for nothing else: a diamond's vertices sit at
 * its box's edge midpoints, so half-pitch is exactly edge contact. Both the
 * shape and this constant were wrong together, which is why neither looked
 * wrong on its own.
 *
 * ## Why the topic is a cell and not a header
 *
 * `layoutBoard` positions a tile relative to its parent, and the projection
 * gives a thread root a `parentId` of null. Four threads are therefore four
 * competing origins unless something reparents them, and the thing that does
 * is the topic tile: it sits at the centre and each thread hangs off one of
 * its four diagonals. See `topicRootedLayout`.
 *
 * That also gives "start a new thread" a place on the board instead of a
 * dropdown: the four open diagonals around the topic tile are the four
 * threads, so hovering the topic and clicking one is the whole gesture, and
 * a board at its cap simply has none left to offer.
 */

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;

export interface SpatialTile {
  id: string;
  parentId: string | null;
  /** Placement order. The layout replays history, so this has to be stable. */
  placedAtSeq: number;
}

export interface SpatialBoardProps<T extends SpatialTile> {
  tiles: T[];
  /** Drawn in the centre cell. Pass null for a game with no topic set yet. */
  topic: ReactNode;
  /** Draws one placed tile. Receives the tile and whether it is the hovered one. */
  renderTile: (tile: T, state: { hovered: boolean }) => ReactNode;
  /**
   * Called when a player clicks an open diagonal slot. The argument is the id
   * of the tile the new one would hang off, which is what the retired
   * `<select>` was asking for and what the composer needs.
   */
  onPlace?: (parentId: string) => void;
  /**
   * Whether placement is offered at all. False during the other player's turn
   * or when the composer is closed, so the board does not advertise a move
   * that would be rejected.
   */
  placementEnabled?: boolean;
  /**
   * Whether a new tile may hang off this particular parent right now. The
   * rules answer differently per parent: a resolved thread takes no more
   * replies, and the topic cell stops offering new threads once the board is
   * at its cap. Defaults to allowing everything, so a caller that does not
   * care passes nothing.
   */
  canPlaceOn?: (parentId: string) => boolean;
  /** Tile edge length in rem. */
  size?: number;
}

interface PositionedTile<T> {
  tile: T;
  pos: GridPosition;
}

/**
 * The hit area, which is not the same as the box.
 *
 * Every cell is a `size` by `size` square box holding an octagon inscribed in
 * it. Because the grid pitch is 14/18.5 of the box, each box overlaps each of
 * its four diagonal neighbours across a corner square, and the later-rendered
 * box wins the mouse there. Without this, hovering the upper-right corner of a
 * tile silently selects the tile up and to the right of it, and the ghost
 * slots then open around the wrong parent.
 *
 * Clipping the box to the octagon fixes hit testing as well as painting: a
 * clipped-away region does not receive pointer events. The polygon is the same
 * silhouette `TileShape` produces by intersection, so nothing visible is cut
 * off, and the clipped corners are exactly the squares of the tessellation
 * that no tile ever occupies.
 */

function pixelStyle(pos: GridPosition, layout: BoardLayout, size: number): CSSProperties {
  const pitch = size * CELL_PITCH_RATIO;
  return {
    position: "absolute",
    left: `${(pos.x + layout.offsetX) * pitch}rem`,
    top: `${(pos.y + layout.offsetY) * pitch}rem`,
    width: `${size}rem`,
    height: `${size}rem`,
    clipPath: OCTAGON_CLIP,
  };
}

/**
 * An open diagonal slot: a dashed octagon at half opacity that fills in on
 * hover. Clipped to the same silhouette as `TileShape` so a ghost lands
 * exactly where the real tile will. A dashed border cannot be drawn by the
 * intersection trick (the two squares would each dash independently), so this
 * one uses the clip path and accepts a slightly softer outline.
 */
function GhostSlot({
  style,
  onClick,
  label,
}: {
  style: CSSProperties;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="group absolute cursor-pointer border-none bg-transparent p-0"
      style={style}
    >
      <span
        className="border-gray group-hover:border-gold group-hover:bg-gold/10 absolute inset-0 border-2 border-dashed opacity-50 transition-all duration-150 group-hover:opacity-100"
        style={{ clipPath: OCTAGON_CLIP }}
        aria-hidden="true"
      />
      <span className="font-primary text-gray group-hover:text-gold absolute inset-0 z-10 flex items-center justify-center text-2xl opacity-50 transition-opacity duration-150 group-hover:opacity-100">
        +
      </span>
    </button>
  );
}

export function SpatialBoard<T extends SpatialTile>({
  tiles,
  topic,
  renderTile,
  onPlace,
  placementEnabled = false,
  canPlaceOn,
  size = 14,
}: SpatialBoardProps<T>) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<GridPosition>({ x: 0, y: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(
    null,
  );

  // Placement order is the layout's input order, and the projection does not
  // promise the array arrives sorted. Sorting here rather than trusting the
  // caller keeps the board from silently laying out differently depending on
  // which query produced the tiles.
  const ordered = useMemo(
    () => [...tiles].sort((a, b) => a.placedAtSeq - b.placedAtSeq),
    [tiles],
  );

  const layout = useMemo(
    () => topicRootedLayout(ordered.map((t) => ({ id: t.id, parentId: t.parentId }))),
    [ordered],
  );

  const placed = useMemo<PositionedTile<T>[]>(() => {
    const out: PositionedTile<T>[] = [];
    for (const tile of ordered) {
      const pos = layout.positions.get(tile.id);
      if (pos) out.push({ tile, pos });
    }
    return out;
  }, [ordered, layout]);

  const unplaced = useMemo(
    () => ordered.filter((t) => layout.unplaced.includes(t.id)),
    [ordered, layout],
  );

  // Open slots are shown for the hovered tile only. Showing every open slot on
  // the board at once turns a four-thread game into sixteen plus signs and
  // reads as noise rather than as an invitation.
  const ghosts = useMemo(() => {
    if (!placementEnabled || !hoveredId) return [];
    if (canPlaceOn && !canPlaceOn(hoveredId)) return [];
    return legalPlacements(layout, hoveredId).map((pos) => ({
      pos,
      parentId: hoveredId,
    }));
  }, [placementEnabled, hoveredId, layout, canPlaceOn]);

  const pitch = size * CELL_PITCH_RATIO;
  const canvasWidth = (layout.width - 1) * pitch + size;
  const canvasHeight = (layout.height - 1) * pitch + size;

  const fit = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // Only a drag on the background pans. A drag that starts on a tile is
      // the browser's own text selection, which a player needs in order to
      // read and copy a reason.
      if (event.target !== event.currentTarget) return;
      dragRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [pan],
  );

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setPan({
      x: drag.panX + (event.clientX - drag.x),
      y: drag.panY + (event.clientY - drag.y),
    });
  }, []);

  const endDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.25))}
          className="border-neutral-black/20 font-primary text-p-sm cursor-pointer border px-3 py-1"
          aria-label="Zoom out"
        >
          Zoom out
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.25))}
          className="border-neutral-black/20 font-primary text-p-sm cursor-pointer border px-3 py-1"
          aria-label="Zoom in"
        >
          Zoom in
        </button>
        <button
          type="button"
          onClick={fit}
          className="border-neutral-black/20 font-primary text-p-sm cursor-pointer border px-3 py-1"
        >
          Fit to screen
        </button>
        <span className="font-primary text-p-sm text-gray">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      <div
        className="border-neutral-black/15 relative overflow-hidden border"
        style={{ height: "min(70vh, 44rem)", touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          style={{
            position: "absolute",
            left: `${pan.x}px`,
            top: `${pan.y}px`,
            width: `${canvasWidth}rem`,
            height: `${canvasHeight}rem`,
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
          }}
        >
          {layout.positions.get(TOPIC_CELL_ID) ? (
            <div
              style={pixelStyle(
                layout.positions.get(TOPIC_CELL_ID) as GridPosition,
                layout,
                size,
              )}
              onMouseEnter={() => setHoveredId(TOPIC_CELL_ID)}
            >
              {topic}
            </div>
          ) : null}

          {placed.map(({ tile, pos }) => (
            <div
              key={tile.id}
              style={pixelStyle(pos, layout, size)}
              onMouseEnter={() => setHoveredId(tile.id)}
            >
              {renderTile(tile, { hovered: hoveredId === tile.id })}
            </div>
          ))}

          {ghosts.map(({ pos, parentId }) => (
            <GhostSlot
              key={`${pos.x},${pos.y}`}
              style={pixelStyle(pos, layout, size)}
              label={
                parentId === TOPIC_CELL_ID
                  ? "Start a new thread here"
                  : "Answer this reason here"
              }
              onClick={() => onPlace?.(parentId)}
            />
          ))}
        </div>
      </div>

      {unplaced.length > 0 ? (
        // Never silently drop a tile. Four is the tile board's capacity, not
        // a bug and not a win condition: a centre tile has four diagonals.
        // MAX_THREADS in lib/board/rules.ts says 6 because that is compact
        // mode's ceiling, three a side (Steve, 2026-09-01). The two numbers
        // describe different views and are meant to differ. Winning is
        // resolving *all* threads, however many a game happens to have.
        <p className="text-p-sm text-orange">
          {unplaced.length === 1
            ? "One reason has no room on the board and is not drawn."
            : `${unplaced.length} reasons have no room on the board and are not drawn.`}{" "}
          The board holds four threads.
        </p>
      ) : null}
    </div>
  );
}
