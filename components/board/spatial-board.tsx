"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  CELL_PITCH_RATIO,
  OCTAGON_CLIP,
  OUTER_FRAME_REM,
} from "@/components/board/geometry";
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
 * ## The pane is the screen
 *
 * Ported from `point-taken-frontend/app/pages/game/[gameCode].vue`, whose
 * board pane fills the viewport and carries four floating clusters over it.
 * So this component draws no border and no heading: it fills whatever box it
 * is given, and the caller gives it the whole screen. Its own chrome is the
 * zoom cluster, which floats at the bottom right of the pane exactly as it
 * does in the shipped game.
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
 * tessellation, which is the faint lattice behind Rannie's board, drawn here
 * as the pane's background at the same pitch.
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
/**
 * The floor for the automatic refit that runs as tiles land.
 *
 * Fitting a growing board on screen is worth doing, but past a point it stops
 * being a board and becomes a diagram of one. Rannie's live-board frame
 * (`1096:252192`) draws the octagons big enough to read at a glance and simply
 * lets the outer ones run off the bottom edge, and the retired client did the
 * same. The Fit to screen button still fits everything, because that is what
 * it is for; this only stops the board shrinking itself out from under the
 * player who never asked it to.
 */
const COMFORT_ZOOM = 0.8;
const MAX_ZOOM = 2;

/** Breathing room, in px, left around the board when it is fitted to screen.
 *  Enough that a tile does not touch the edge, and no more: at 14rem a tile
 *  is 224px, which is the 234px Rannie draws, and a fit that shrinks a
 *  four-tile board below life size is throwing away the one thing on screen. */
const FIT_MARGIN = 96;

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
  onPlace?: (parentId: string, pos: GridPosition) => void;
  /**
   * Where the caller is currently composing, if anywhere. The retired client
   * wrote the reason on the board rather than in a form under it: you clicked
   * an open diagonal and the tile appeared there with a cursor in it. The
   * board does not know what a composer is, so the caller hands back the
   * markup in `draft` and the board only says where it goes.
   */
  draftAt?: GridPosition | null;
  /** Drawn in the `draftAt` cell in place of that cell's open slot. */
  draft?: ReactNode;
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
  /** Extra controls rendered inside the zoom cluster, to its right. The
   *  retired client's "Their move" jump lives there. */
  extraControls?: ReactNode;
  /**
   * Called when a tile itself is clicked, as opposed to one of the open slots
   * around it. What a tile can do belongs on the tile, so the caller opens
   * whatever it wants beside it; the board only reports the click.
   */
  onSelect?: (tileId: string) => void;
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
 * The ground under the board: a fine dot grid, which is what Rannie draws
 * behind the live 1v1 board in `1096:252192`. Background rather than
 * elements, because it is ground: it is infinite and nothing ever interacts
 * with it.
 *
 * This used to be an octagon-and-square lattice at one cell per tile pitch,
 * read off the Gym canvas frame (`1064:214081`). Two things were wrong with
 * that. She does not use the lattice on the live board at all, and where she
 * does use it, its cell is about 1.7 times the tile pitch, not equal to it.
 * At one cell per pitch it stopped being ground and started competing with
 * the tiles for the eye. The Gym canvas can have its lattice back as a prop
 * on this component the day the Gym exists; the board Steve opens today is
 * the 1v1 board.
 *
 * The dots hold at 1px whatever the zoom, and only their spacing scales, so
 * a zoomed-out board gets a finer ground rather than a coarser one.
 */
const DOT_GROUND =
  "radial-gradient(circle, color-mix(in srgb, var(--color-neutral-black) 14%, transparent) 1px, transparent 1.2px)";

/** Dots per tile pitch. Measured off `1096:252192`: 28px dot spacing against
 *  a 191px pitch, which is a hair under a seventh. */
const DOTS_PER_PITCH = 7;

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

/**
 * One rem in px, read off the document. Everything on the board is sized in
 * rem and fitting it to a pane needs the pane's pixels.
 *
 * Read through useSyncExternalStore, the same shape `components/ui/
 * tile-popover.tsx` uses, so the server renders the 16px default and the
 * client corrects it during hydration rather than in an effect that would
 * render twice.
 */
const subscribeNoop = () => () => {};

function remSnapshot(): number {
  const size = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(size) && size > 0 ? size : 16;
}

function remServerSnapshot(): number {
  return 16;
}

function useRemPx(): number {
  return useSyncExternalStore(subscribeNoop, remSnapshot, remServerSnapshot);
}

export function SpatialBoard<T extends SpatialTile>({
  tiles,
  topic,
  renderTile,
  onPlace,
  draftAt = null,
  draft,
  placementEnabled = false,
  canPlaceOn,
  // The declared box is the outer ring, so `size * CELL_PITCH_RATIO` is the
  // grid pitch, and at 18.5 that comes out at the retired client's 14rem
  // columns exactly. It sat at 14 for a while, which quietly drew the whole
  // board at 76% of the size Rannie draws it and the shipped game plays it.
  size = OUTER_FRAME_REM,
  extraControls,
  onSelect,
}: SpatialBoardProps<T>) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<GridPosition>({ x: 0, y: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const paneRef = useRef<HTMLDivElement | null>(null);
  const [pane, setPane] = useState<{ w: number; h: number } | null>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(
    null,
  );
  const [panning, setPanning] = useState(false);
  // Whether the player has moved the view themselves. Until they have, the
  // board refits as it grows, so the first four tiles never appear offscreen.
  // Once they have, their view is theirs until they press Fit to screen.
  const touched = useRef(false);
  const remPx = useRemPx();

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
    // A reason already being written is the only invitation on the board
    // worth having. Leaving the other slots up would offer to start a second
    // one on top of it, and the hover that put them there is gone the moment
    // the cursor moves to the keyboard anyway.
    if (draftAt) return [];
    if (!placementEnabled || !hoveredId) return [];
    if (canPlaceOn && !canPlaceOn(hoveredId)) return [];
    return legalPlacements(layout, hoveredId).map((pos) => ({
      pos,
      parentId: hoveredId,
    }));
  }, [draftAt, placementEnabled, hoveredId, layout, canPlaceOn]);

  const pitch = size * CELL_PITCH_RATIO;
  const canvasWidth = (layout.width - 1) * pitch + size;
  const canvasHeight = (layout.height - 1) * pitch + size;

  // The pane's own size, which is the screen. Needed to fit and to centre.
  useLayoutEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const measure = () => setPane({ w: el.clientWidth, h: el.clientHeight });
    measure();
    // jsdom has no ResizeObserver. One measurement is the whole of what a
    // test needs, and the window never resizes there.
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /**
   * Fit to screen, which in the rebuild used to mean "reset zoom to 100%" and
   * therefore clipped half the board (BRAIN-T260901-11). The retired client's
   * `fitBoardToScreen` does the real thing, and so does this: scale the whole
   * footprint down until it fits the pane, then centre it.
   */
  const fit = useCallback(
    (floor = MIN_ZOOM) => {
      if (!pane) return;
      const w = canvasWidth * remPx;
      const h = canvasHeight * remPx;
      const room = Math.min(
        (pane.w - FIT_MARGIN) / w,
        (pane.h - FIT_MARGIN) / h,
        // Never magnify past life size to fill a big screen: a two-tile board
        // blown up to 200% looks broken rather than roomy.
        1,
      );
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, floor, room));
      setZoom(next);
      setPan({ x: (pane.w - w * next) / 2, y: (pane.h - h * next) / 2 });
      touched.current = false;
    },
    [pane, canvasWidth, canvasHeight, remPx],
  );

  // Refit while the view is still the one we chose. Depends on the footprint,
  // so it runs when a tile is placed and when the window resizes.
  useEffect(() => {
    if (touched.current) return;
    // Floored: a tile landing should not shrink the whole board under the
    // player's cursor. Pressing Fit to screen is the way to ask for that.
    fit(COMFORT_ZOOM);
  }, [fit]);

  const zoomTo = useCallback(
    (next: number, anchor?: { x: number; y: number }) => {
      const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
      setZoom((current) => {
        if (clamped === current) return current;
        const at = anchor ?? { x: (pane?.w ?? 0) / 2, y: (pane?.h ?? 0) / 2 };
        // Keep whatever is under the anchor point under it after the scale.
        setPan((p) => ({
          x: at.x - ((at.x - p.x) * clamped) / current,
          y: at.y - ((at.y - p.y) * clamped) / current,
        }));
        return clamped;
      });
      touched.current = true;
    },
    [pane],
  );

  const onWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const step = event.deltaY > 0 ? 0.9 : 1.1;
      zoomTo(zoom * step, {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    },
    [zoom, zoomTo],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // Only a drag on the background pans. A drag that starts on a tile is
      // the browser's own text selection, which a player needs in order to
      // read and copy a reason.
      if (event.target !== event.currentTarget) return;
      dragRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
      setPanning(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [pan],
  );

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    touched.current = true;
    setPan({
      x: drag.panX + (event.clientX - drag.x),
      y: drag.panY + (event.clientY - drag.y),
    });
  }, []);

  const endDrag = useCallback(() => {
    dragRef.current = null;
    setPanning(false);
  }, []);

  return (
    <div
      ref={paneRef}
      className={`absolute inset-0 overflow-hidden ${panning ? "cursor-grabbing select-none" : "cursor-grab"}`}
      style={{
        touchAction: "none",
        backgroundImage: DOT_GROUND,
        backgroundSize: `${(pitch * remPx * zoom) / DOTS_PER_PITCH}px ${(pitch * remPx * zoom) / DOTS_PER_PITCH}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onWheel={onWheel}
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
            data-tile-id={TOPIC_CELL_ID}
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
            data-tile-id={tile.id}
            style={pixelStyle(pos, layout, size)}
            onMouseEnter={() => setHoveredId(tile.id)}
            onClick={() => onSelect?.(tile.id)}
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
            onClick={() => onPlace?.(parentId, pos)}
          />
        ))}

        {/* Drawn outside the ghost list on purpose. Open slots come and go
            with the hover, and the cursor leaves the board the instant
            typing starts; a draft that lived in that list would vanish
            under the player's hands. */}
        {draftAt && (
          <div
            className="z-20"
            // Deliberately unclipped, unlike every other cell. The composer
            // hangs its Place and cancel buttons below the octagon, and the
            // octagon-shaped clip that fixes hit testing for placed tiles
            // would cut them off.
            style={{ ...pixelStyle(draftAt, layout, size), clipPath: undefined }}
          >
            {draft}
          </div>
        )}
      </div>

      {/*
        The zoom cluster, bottom right, which is where the retired client
        moved it after it collided with the room code in the top left. Same
        pill, same order, same wording.
      */}
      <div className="border-gray/30 bg-offwhite absolute right-8 bottom-8 z-30 flex items-center gap-1 rounded-full border px-2 py-1 shadow-md">
        <button
          type="button"
          onClick={() => zoomTo(zoom - 0.25)}
          disabled={zoom <= MIN_ZOOM}
          aria-label="Zoom out"
          className="text-neutral-black hover:bg-sand flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-lg font-bold disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
        >
          &minus;
        </button>
        <button
          type="button"
          onClick={() => fit()}
          title="Reset zoom and centre the board"
          className="text-neutral-black hover:bg-sand text-p-sm min-w-[3.25rem] cursor-pointer rounded-full px-1 font-semibold"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => zoomTo(zoom + 0.25)}
          disabled={zoom >= MAX_ZOOM}
          aria-label="Zoom in"
          className="text-neutral-black hover:bg-sand flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-lg font-bold disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
        >
          +
        </button>
        <div className="bg-gray/30 mx-1 h-5 w-px" />
        <button
          type="button"
          onClick={() => fit()}
          title="Fit the whole board on screen"
          className="text-neutral-black hover:bg-sand text-p-sm cursor-pointer rounded-full px-2 py-1 font-semibold"
        >
          Fit to screen
        </button>
        {extraControls}
      </div>

      {unplaced.length > 0 ? (
        // Never silently drop a tile. Four is the tile board's capacity, not
        // a bug and not a win condition: a centre tile has four diagonals.
        // MAX_THREADS in lib/board/rules.ts says 6 because that is compact
        // mode's ceiling, three a side (Steve, 2026-09-01). The two numbers
        // describe different views and are meant to differ. Winning is
        // resolving *all* threads, however many a game happens to have.
        <p className="text-p-sm text-orange bg-offwhite border-orange/40 absolute bottom-8 left-1/2 z-30 -translate-x-1/2 rounded-full border px-4 py-2 shadow-md">
          {unplaced.length === 1
            ? "One reason has no room on the board and is not drawn."
            : `${unplaced.length} reasons have no room on the board and are not drawn.`}{" "}
          The board holds four threads.
        </p>
      ) : null}
    </div>
  );
}
