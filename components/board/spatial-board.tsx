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
  INNER_FRAME_RATIO,
  OCTAGON_CLIP,
  OCTAGON_POINTS,
  OUTER_FRAME_REM,
  TILE_BODY_PX,
  TILE_LEAD_PX,
} from "@/components/board/geometry";
import {
  TOPIC_CELL_ID,
  cornerOffset,
  legalPlacements,
  topicRootedLayout,
  type BoardLayout,
  type GridPosition,
} from "@/components/board/layout";
import { stripDuplicateLead, tileLead } from "@/components/board/side-label";
import { TileShape, type TileSide } from "@/components/board/tile-shape";
import type { CookedPlacement } from "@/components/gym/cooked-placement";
import type { Side, TileCorner } from "@/lib/events/types";

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
/** One click of the pan pad, in screen pixels. */
const PAN_STEP_PX = 160;

/**
 * The four arrows of the pan pad, left to right. `dx`/`dy` are the direction
 * the board moves, which is the opposite of the direction the player is
 * looking: the up arrow shows what is above, so it slides the board down.
 *
 * A T rather than a row (Steve, 2026-09-03): up on the top line, then left,
 * down and right on the line under it. A flat row of four arrows reads as
 * four of the same thing and gives no clue which way is which; the T is half
 * a d-pad, which everybody already knows how to read, and it is still short
 * enough to sit in the strip below the right rail without reaching behind it.
 */
const PAN_UP = { dx: 0, dy: 1, label: "Pan up", path: "M8 12V4M4.5 7.5 8 4l3.5 3.5" };

const PAN_ROW = [
  { dx: 1, dy: 0, label: "Pan left", path: "M12 8H4M7.5 4.5 4 8l3.5 3.5" },
  { dx: 0, dy: -1, label: "Pan down", path: "M8 4v8M4.5 8.5 8 12l3.5-3.5" },
  { dx: -1, dy: 0, label: "Pan right", path: "M4 8h8M8.5 4.5 12 8l-3.5 3.5" },
] as const;

interface PanStep {
  dx: number;
  dy: number;
  label: string;
  path: string;
}

function PanButton({
  step,
  nudge,
}: {
  step: PanStep;
  nudge: (dx: number, dy: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => nudge(step.dx, step.dy)}
      aria-label={step.label}
      title={step.label}
      className="text-neutral-black hover:bg-sand flex h-7 w-7 cursor-pointer items-center justify-center rounded-full"
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5">
        <path
          d={step.path}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

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

/** Slack, in px, left between an open composer and the edge it was pushed in
 *  from. Small: this is a nudge to get the draft on screen, not a re-centring,
 *  and moving the board further than it has to under a player who just clicked
 *  loses them the tile they were answering. */
const DRAFT_EDGE = 24;

/** How far the composer hangs below its octagon, in rem, for its Place and
 *  cancel buttons. Only used to decide whether the draft is on screen. */
const DRAFT_TAIL_REM = 4;

export interface SpatialTile {
  id: string;
  parentId: string | null;
  /** Placement order. The layout replays history, so this has to be stable. */
  placedAtSeq: number;
  /**
   * Whose reason this is. Read only for a thread starter, whose side decides
   * which corner of the topic it takes (Steve, 2026-09-03): Plus on the right,
   * Minus on the left, bottom corners first. See `SIDE_OFFSETS` in layout.ts.
   */
  side?: "plus" | "minus" | null;
  /**
   * The diagonal the placer actually clicked, off the tile's own event
   * (`BoardTile.corner`, `TilePlacedPayload.corner`).
   *
   * Without this the layout only ever hears about `side`, which nothing but a
   * thread starter has, so every reply fell back to the default NE/SE/SW/NW
   * order and landed on the first free diagonal regardless of where it was
   * placed. Steve, from his 2026-09-06 level 1 playthrough: "firsrt reply to
   * bob still starts in lower right but then appears in uppwer rght." The
   * event carried the corner, the projection kept it, `LayoutInput` has
   * preferred it since 2026-09-04, and this interface was the one link in the
   * chain that dropped it on the floor.
   *
   * Optional, and null is fine: a tile with no recorded corner takes the old
   * default order, which is how a game logged before the field draws exactly
   * as it always did.
   */
  corner?: TileCorner | null;
}

export interface SpatialBoardProps<T extends SpatialTile> {
  tiles: T[];
  /** Drawn in the centre cell. Pass null for a game with no topic set yet. */
  topic: ReactNode;
  /** Draws one placed tile. Receives the tile and whether it is the hovered one. */
  renderTile: (tile: T, state: { hovered: boolean }) => ReactNode;
  /**
   * Draws unclipped content for a placed tile, positioned identically to its
   * clipped wrapper but with the octagon `clip-path` removed and pointer
   * events disabled. For content that has to hang past the tile's own edge
   * (a resolution badge straddling the bottom vertex), the same escape
   * `draftAt` already uses below for the composer's Place and cancel
   * buttons. Drawn in its own pass after every placed tile, so an overlay
   * always paints above every tile's clipped wrapper regardless of board
   * position.
   */
  renderOverlay?: (tile: T) => ReactNode;
  /**
   * Called when a player clicks an open diagonal slot. The argument is the id
   * of the tile the new one would hang off, which is what the retired
   * `<select>` was asking for and what the composer needs. `corner` is the
   * geometric diagonal the slot occupies relative to its parent (`ne`/`se`/
   * `sw`/`nw`), so the caller can record it on the placement event the same
   * way `TilePlacedPayload.corner` does (Steve, 2026-09-04: a rebuttal placed
   * on the lower right must not come back on the upper right).
   */
  onPlace?: (
    parentId: string,
    pos: GridPosition,
    sample: string | null | undefined,
    corner: TileCorner,
  ) => void;
  /**
   * Sample answers to draw in the open slots, in slot order, first slot
   * first. The Gym's coach writes these; a live game passes nothing. Clicking
   * a slot that carries one hands the text back through `onPlace` so the
   * caller can open its composer already filled in.
   */
  slotSamples?: readonly string[];
  /**
   * A reply slot to draw whether or not its parent is hovered: the one the
   * gym coach is pointing at (`components/gym/pointed-slot.ts`). Root slots
   * are drawn permanently anyway, so a topic slot here changes nothing.
   */
  pointedSlot?: { parentId: string; corner: TileCorner } | null;
  /**
   * The id of an already-placed tile the gym coach is pointing at
   * (`components/gym/pointed-tile.ts`), the relocate lesson in level 2 being
   * the first beat that names one. Purely a camera hint: unlike
   * `pointedSlot` there is nothing to draw, the tile is already on the
   * board, only "frame the coach's target" below reads it, to pan or zoom
   * the tile into view the way it already does for a pointed slot.
   */
  pointedTileId?: string | null;
  /**
   * The Gym boss's tile as he types it (`components/gym/boss-draft.ts`).
   * Drawn as an always-visible, non-interactive slot at the cell it will
   * land in, filled with the growing prefix of his line, so watching Bob
   * write reads as somebody at the other keyboard rather than a tile that
   * appears whole a beat after his "turn" ends (Steve, 2026-09-04). A live
   * game never passes this. While it is set, any hover ghost or the pointed
   * slot that would land on the same cell is left out, so the two do not
   * draw on top of each other.
   */
  bossDraft?: {
    parentId: string;
    corner: TileCorner;
    side: Side;
    text: string;
    /** The boss's own name, for the slot's label. See boss-draft.ts. */
    bossName: string;
    /** Skips the rest of the typing and plays the move now, if clicked. */
    finishNow?: () => void;
  } | null;
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
  /**
   * The side of the player who would fill an open slot, for colouring the
   * ghosts. Defaults to neutral for callers with no seat in play (the
   * finished-game map, say). Doubles as "the viewer's own side" for the root
   * placeholders below: a slot on the viewer's own side is the invitation and
   * stays clickable, the other side's is drawn for orientation only.
   */
  placeSide?: TileSide;
  /**
   * How many opening reasons this game wants hung off the topic before
   * anything can answer anything else (`rootTarget` in `lib/board/rules.ts`):
   * 4 in a normal game, 2 in gym level 1. Drives which corners of the topic
   * carry a permanent placeholder and when they stop. Defaults to 4, the
   * ordinary live-game value, so a caller that has not been updated to pass
   * this still gets the common case right rather than nothing at all; a gym
   * level 1 caller has to pass 2 explicitly or its board offers all four
   * corners instead of the two it should.
   */
  rootTarget?: number;
  /**
   * A strip down the right of the pane the board should not centre itself
   * under, in rem.
   *
   * The pane is the whole window and the caller floats a fixed rail over its
   * last few inches, so "centred in the pane" put the middle of the argument
   * behind Ways to win: on a two-tile board the newest tile was half under
   * the panel the moment it landed, and on the composer it was the cell you
   * were typing in. Nothing is clipped, it is simply centred on the wrong
   * box. Callers with no furniture over the board pass nothing.
   */
  reserveRight?: number;
  /**
   * A strip across the bottom of the pane the board should not centre itself
   * under, in rem. Same argument as `reserveRight`, for the furniture that
   * floats along the bottom edge: Place a reason, and the rule-card tray
   * under it. Without it the lowest tile on the board sits behind the hand,
   * which is the one piece of furniture a player is looking at and clicking
   * through at the same time.
   */
  reserveBottom?: number;
  /**
   * A strip across the top of the pane the coach's target should not land
   * under, in rem. Unlike `reserveRight`/`reserveBottom` this never affects
   * `fit`: the coach persona floats over the board rather than pushing it,
   * so a normal zoom-to-fit is unaffected. Only the "frame the coach's
   * target" behaviour below reads it, and only while a `pointedSlot` or
   * `bossDraft` is actually set, so a live game (which passes neither) is
   * untouched whether or not a caller bothers to pass this. Callers with no
   * coach on screen pass nothing.
   */
  reserveTop?: number;
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
  /**
   * Restricts what placement affordances the board draws, for a cooked Gym
   * level walking a player through one exact move. Defaults to today's
   * unrestricted live-game behaviour (every legal ghost drawn, own replies
   * included, free text) so a caller that has not been updated is untouched.
   * `onlySlot` (when `ghosts` is false) is the one slot, if any, still drawn
   * and clickable; everything else the ghost logic would otherwise offer
   * (hover ghosts on other tiles, the other root diagonals) is withheld.
   */
  placement?: CookedPlacement;
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
 * An open diagonal slot: a dashed octagon that fills in on hover. Clipped to
 * the same silhouette as `TileShape` so a ghost lands exactly where the real
 * tile will. A dashed border cannot be drawn by the intersection trick (the
 * two squares would each dash independently), so this one uses the clip path
 * and accepts a slightly softer outline.
 *
 * Drawn in the side colour of whoever is about to place, which is what Rannie
 * does in `937:68265`: the plus marks around her clicked tile are green
 * because a green player is holding the turn. It also stops the one thing on
 * the board that is an invitation from being the one thing drawn in the same
 * grey as the dot ground.
 *
 * It used to be grey at half opacity with a `text-2xl` plus in it, and at the
 * 0.8 comfort zoom that plus was about eleven screen pixels of 50% grey. It
 * read as ground texture. The affordance the whole game runs on cannot be the
 * faintest mark on screen, so it is now the side colour, a heavier dash, and
 * a plus sized off the cell rather than off the type scale.
 */
const GHOST_STROKE: Record<TileSide, string> = {
  plus: "stroke-green/70",
  minus: "stroke-orange/70",
  neutral: "stroke-gray/60",
};

const GHOST_MARK: Record<TileSide, string> = {
  plus: "text-green/70",
  minus: "text-orange/70",
  neutral: "text-gray/60",
};

const GHOST_WASH: Record<TileSide, string> = {
  plus: "fill-transparent group-hover:fill-green/10",
  minus: "fill-transparent group-hover:fill-orange/10",
  neutral: "fill-transparent group-hover:fill-gray/10",
};

/**
 * The four diagonals, keyed the way the event log records them (`TileCorner`
 * in lib/events/types.ts) and in the same NE/SE/SW/NW order as
 * `DIAGONAL_OFFSETS` in layout.ts, which this has to agree with.
 */
const CORNER_ORDER: readonly TileCorner[] = ["ne", "se", "sw", "nw"];

/** Gym level 1 only wants the two bottom corners: SE for Plus, SW for Minus
 *  (Steve, 2026-09-03: the side is the position, bottom corners first, and
 *  a two-thread game fills the bottom two). */
const ROOT_CORNERS_TWO: readonly TileCorner[] = ["se", "sw"];

/** Which side of the topic a corner belongs to: NE and SE are on the right,
 *  which is Plus's; SW and NW are on the left, Minus's. Has to agree with
 *  `SIDE_OFFSETS` in layout.ts and the Ways to win minimap's SLOTS. */
function cornerSide(corner: TileCorner): Side {
  return corner === "ne" || corner === "se" ? "plus" : "minus";
}

/**
 * The corner a grid offset from its parent corresponds to. Every legal
 * placement is exactly one diagonal step (dx, dy each +-1), so the sign of
 * each axis alone identifies the corner.
 */
export function cornerFromOffset(dx: number, dy: number): TileCorner {
  if (dy < 0) return dx > 0 ? "ne" : "nw";
  return dx > 0 ? "se" : "sw";
}

/** Whether two grid cells are the same cell, for filtering a ghost or the
 *  pointed slot out from under the Gym boss's draft. */
function sameCell(a: GridPosition, b: GridPosition): boolean {
  return a.x === b.x && a.y === b.y;
}

function GhostSlot({
  style,
  onClick,
  label,
  side,
  mark = "+",
  stem = null,
  interactive = true,
  parentId,
  corner,
}: {
  style: CSSProperties;
  onClick: () => void;
  label: string;
  /** Whose turn is about to be spent here. Colours the dash and the mark. */
  side: TileSide;
  /**
   * The glyph in the middle of the slot. A plus everywhere except the four
   * starters around the topic, where the sign is the side's own: the right
   * pair are the Plus side and carry a plus, the left pair are the Minus side
   * and carry a minus. Elsewhere a minus would read as "remove this", which
   * is not a move this game has.
   */
  mark?: string;
  /**
   * The lead line a root placeholder shows above its mark: "Yes, because" for
   * Plus, "No, because" for Minus (`tileLead`, side-label.ts), read off the
   * slot's own side rather than the viewer's. Root-only; a reply ghost passes
   * nothing, since its lead depends on what it answers, which is not
   * something a hover ghost needs to work out.
   */
  stem?: string | null;
  /**
   * False for the other side's root placeholders: visible so a player can
   * see where the whole argument is going, but not a control. Steve,
   * 2026-09-04: both sides show, only your own is clickable and
   * hover-highlighted.
   */
  interactive?: boolean;
  /**
   * The parent this slot hangs off ("topic" for a root), carried as a data
   * attribute so a coach overlay can point at the right slot without the
   * board exposing any more surface than that.
   */
  parentId: string;
  corner: TileCorner;
}) {
  const dataAttrs = {
    "data-slot-parent": parentId,
    "data-slot-corner": corner,
    // Only plus/minus are meaningful here; a neutral viewer (the finished
    // map) leaves it off rather than publish a value nothing reads.
    "data-slot-side": side === "neutral" ? undefined : side,
  };

  const inner = (
    <>
      {/* Drawn as a stroked polygon rather than as a dashed border on a
          clipped box: the clip cuts the corners away, so a border showed the
          four straight sides and nothing on the diagonals. Inset to the inner
          frame so the dashes land exactly where the tile's own octagon will,
          instead of a frame's width outside it. */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute"
        style={{ inset: `${((1 - INNER_FRAME_RATIO) / 2) * 100}%` }}
        aria-hidden="true"
      >
        <polygon
          points={OCTAGON_POINTS}
          className={`${GHOST_STROKE[side]} ${GHOST_WASH[side]} transition-all duration-150`}
          // Viewbox units, so the dash scales with the board the way the
          // tile art does. The border this replaced was 3px and the point of
          // it was that an empty slot had been the faintest mark on screen:
          // a hairline that stays a hairline at every zoom would put it back.
          strokeWidth={1.2}
          strokeDasharray="5 4"
          strokeLinejoin="round"
        />
      </svg>
      <span className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 px-[18%] text-center">
        {stem ? (
          <span
            className={`${GHOST_MARK[side]} font-secondary text-[0.65rem] leading-none font-semibold tracking-wide uppercase opacity-90`}
          >
            {stem}
          </span>
        ) : null}
        <span
          className={`${GHOST_MARK[side]} font-primary leading-none transition-opacity duration-150 ${
            interactive ? "group-hover:opacity-100" : ""
          }`}
          // Sized off the cell, not off the type scale, so it stays a mark on
          // the board at every zoom instead of shrinking into body text.
          style={{ fontSize: "3.5rem" }}
        >
          {mark}
        </span>
      </span>
    </>
  );

  if (!interactive) {
    // A dimmed div, not a disabled button: it is drawn for orientation, not
    // as a control nobody can reach, and a disabled button still reads as a
    // control to a screen reader.
    return (
      <div
        title={label}
        className="pointer-events-none absolute border-none bg-transparent p-0 opacity-35"
        style={style}
        {...dataAttrs}
      >
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="group absolute cursor-pointer border-none bg-transparent p-0"
      style={style}
      {...dataAttrs}
    >
      {inner}
    </button>
  );
}

/**
 * The Gym boss's tile as he types it (`components/gym/boss-draft.ts`). Sits
 * at the cell his tile will land in and fills in with the growing prefix of
 * his line, a caret blinking after it, so watching him write reads as
 * somebody at the other keyboard rather than a tile that appears whole a
 * beat after his "turn" ends (Steve, 2026-09-04).
 *
 * Clickable for as long as `onFinishNow` is passed, which the Director keeps
 * doing until the move actually goes out: a player who has already seen Bob
 * type once can tap the draft to skip straight to the finished line (Steve,
 * 2026-09-05 playtest, on a slow line reading as a stall rather than as
 * thinking). The tile itself is placed exactly as it would have been on its
 * own; this only skips the reveal animation.
 *
 * `aria-live="polite"` sits on a wrapper carrying a fixed label
 * ("{bossName} is writing"), not on the growing text itself: the text
 * changes on every keystroke, and a live region on it would have a screen
 * reader announce the draft over and over as it grows instead of once when
 * it starts. `bossName` comes from the level (Director), not a per-boss
 * default here: it used to read "Bashful Bob" on every level, Rambling Rosa
 * included (2026-09 playtest).
 */
function BossDraftSlot({
  style,
  side,
  text,
  lead,
  isOpening,
  parentId,
  corner,
  bossName,
  onFinishNow,
}: {
  style: CSSProperties;
  side: Side;
  text: string;
  /** The sentence-starter above the words, exactly as a placed tile draws it. */
  lead: string;
  /** Whether this reason hangs off the topic, which is what wears the thick border. */
  isOpening: boolean;
  parentId: string;
  corner: TileCorner;
  bossName: string;
  onFinishNow?: () => void;
}) {
  const dataAttrs = {
    "data-slot-parent": parentId,
    "data-slot-corner": corner,
    "data-boss-draft": true,
  };
  const label = onFinishNow
    ? `${bossName} is writing. Click to show the rest of the line now.`
    : `${bossName} is writing`;

  return (
    <div
      title={label}
      aria-label={onFinishNow ? label : undefined}
      role={onFinishNow ? "button" : undefined}
      tabIndex={onFinishNow ? 0 : undefined}
      onClick={onFinishNow}
      onKeyDown={
        onFinishNow
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onFinishNow();
              }
            }
          : undefined
      }
      className={`absolute border-none bg-transparent p-0 ${onFinishNow ? "cursor-pointer" : "pointer-events-none"}`}
      style={style}
      {...dataAttrs}
    >
      {/* Steve, 2026-09-06: this used to draw a faint ghost octagon with his
          words in small italics floating on it, which read as text behind a
          tile rather than as somebody writing in one. It is now the same
          `TileShape` the player's own composer opens (`Composer` in
          live-board.tsx) with the same lead line and the same two text sizes,
          so watching Bob write looks like the thing the player is about to do
          themselves. The caret is the only difference, and it is the point. */}
      <span className="sr-only" aria-live="polite">
        {bossName} is writing
      </span>
      <TileShape
        side={side}
        size={OUTER_FRAME_REM}
        weight={isOpening ? "root" : "normal"}
        watermark="reason"
        selected
      >
        <p className="font-tiles w-full text-center" aria-hidden="true">
          <span className="block leading-tight" style={{ fontSize: `${TILE_LEAD_PX}px` }}>
            {lead}
          </span>
          <span
            className="mt-1 block leading-snug"
            style={{ fontSize: `${TILE_BODY_PX}px` }}
          >
            {/* The same strip a placed tile does. The lead is drawn above,
                and the boss's scripted text writes the sentence out in full
                ("Yes, because a hot dog is..."), so without this the draft
                reads "Yes, because" twice while he types, then loses the
                repeat the moment the tile lands. */}
            {stripDuplicateLead(text)}
            <span className="motion-safe:animate-pulse">▍</span>
          </span>
        </p>
      </TileShape>
    </div>
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
  renderOverlay,
  onPlace,
  slotSamples,
  pointedSlot = null,
  pointedTileId = null,
  bossDraft = null,
  draftAt = null,
  draft,
  placementEnabled = false,
  canPlaceOn,
  placeSide = "neutral",
  rootTarget = 4,
  reserveRight = 0,
  reserveBottom = 0,
  reserveTop = 0,
  // The declared box is the outer ring, so `size * CELL_PITCH_RATIO` is the
  // grid pitch, and at 18.5 that comes out at the retired client's 14rem
  // columns exactly. It sat at 14 for a while, which quietly drew the whole
  // board at 76% of the size Rannie draws it and the shipped game plays it.
  size = OUTER_FRAME_REM,
  extraControls,
  onSelect,
  placement = { onlySlot: null, ownReplies: true, ghosts: true, lockedText: false },
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
  // The live zoom, readable from inside `fit` without making `fit` a new
  // function on every zoom change: it is a dependency of the automatic refit,
  // and rebuilding it is what re-runs that refit.
  const zoomRef = useRef(1);
  // Whether `fit` has ever run the full recentre (mount, or a manual Fit to
  // screen press). Every automatic refit after that only rescales in place;
  // see the comment inside `fit`.
  const hasCentered = useRef(false);
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
    () =>
      topicRootedLayout(
        ordered.map((t) => ({
          id: t.id,
          parentId: t.parentId,
          side: t.side ?? null,
          corner: t.corner ?? null,
        })),
      ),
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

  // The cell the Gym boss's draft will land in, if he is currently writing
  // one. Computed the same way a committed placement is (parent's position
  // plus the corner's offset), so the draft always sits exactly where his
  // tile lands a moment later rather than drifting from it.
  const bossDraftPos = useMemo(() => {
    if (!bossDraft) return null;
    const parentPos = layout.positions.get(bossDraft.parentId);
    if (!parentPos) return null;
    const offset = cornerOffset(bossDraft.corner);
    return { x: parentPos.x + offset.x, y: parentPos.y + offset.y };
  }, [bossDraft, layout]);

  // The cell a `pointedSlot` names, computed the same way `bossDraftPos` is.
  // Used only by the "frame the coach's target" effect below: `ghosts`
  // already resolves `pointedSlot` a different way (filtering the parent's
  // legal placements), and duplicating that here would be the wrong tool for
  // a plain "where is this corner" lookup.
  const pointedSlotPos = useMemo(() => {
    if (!pointedSlot) return null;
    const parentPos = layout.positions.get(pointedSlot.parentId);
    if (!parentPos) return null;
    const offset = cornerOffset(pointedSlot.corner);
    return { x: parentPos.x + offset.x, y: parentPos.y + offset.y };
  }, [pointedSlot, layout]);

  // The cell an already-placed `pointedTileId` sits in, read straight off
  // the layout: unlike a slot there is no corner offset to add, the tile is
  // already there. Same "frame the coach's target" consumer as the two
  // above; a resumed game's leftover pan/zoom has no reason to already show
  // whatever tile the current beat is pointing at.
  const pointedTilePos = useMemo(() => {
    if (!pointedTileId) return null;
    return layout.positions.get(pointedTileId) ?? null;
  }, [pointedTileId, layout]);

  // Open slots for a reply are shown for the hovered tile only. Showing every
  // open slot on the board at once turns a four-thread game into sixteen plus
  // signs and reads as noise rather than as an invitation. The topic's own
  // open corners are a different story: see `rootGhosts` below.
  const ghosts = useMemo(() => {
    // A reason already being written is the only invitation on the board
    // worth having. Leaving the other slots up would offer to start a second
    // one on top of it, and the hover that put them there is gone the moment
    // the cursor moves to the keyboard anyway.
    if (draftAt) return [];
    if (!placementEnabled) return [];
    const slotsUnder = (parentId: string) => {
      if (canPlaceOn && !canPlaceOn(parentId)) return [];
      const parentPos = layout.positions.get(parentId);
      if (!parentPos) return [];
      return legalPlacements(layout, parentId, null).map((pos) => ({
        pos,
        parentId,
        side: placeSide,
        corner: cornerFromOffset(pos.x - parentPos.x, pos.y - parentPos.y),
      }));
    };
    // The slot the coach is pointing at is drawn whether or not its parent
    // is under the cursor, and first, so it carries the first sample answer.
    // Skipped if the boss's draft already occupies that cell: the two are
    // never worth drawing on top of each other.
    const pointed =
      pointedSlot && pointedSlot.parentId !== TOPIC_CELL_ID
        ? slotsUnder(pointedSlot.parentId).filter(
            (slot) =>
              slot.corner === pointedSlot.corner &&
              !(bossDraftPos && sameCell(slot.pos, bossDraftPos)),
          )
        : [];
    // The topic's four diagonals are drawn permanently by `rootGhosts`, all
    // of them at once rather than only on hover, so a player can see the
    // whole shape of the argument before touching anything (Steve,
    // 2026-09-04). Nothing else can go straight on the topic, so there is
    // nothing left for a hover ghost to add here.
    if (!hoveredId || hoveredId === TOPIC_CELL_ID) return pointed;
    // A cooked level withholds ordinary hover ghosts entirely: the coach's
    // `pointed` slot above is the only move on offer, so nothing else lights
    // up under the cursor (Steve's 2026-09-05 ruling: no hover ghosts, no
    // other root diagonals, nothing under the player's own tiles).
    if (!placement.ghosts) return pointed;
    const hoveredTile = placed.find((p) => p.tile.id === hoveredId)?.tile;
    if (!placement.ownReplies && hoveredTile && hoveredTile.side === placeSide)
      return pointed;
    const hovered = slotsUnder(hoveredId).filter(
      (slot) =>
        !pointed.some((p) => p.pos.x === slot.pos.x && p.pos.y === slot.pos.y) &&
        !(bossDraftPos && sameCell(slot.pos, bossDraftPos)),
    );
    return [...pointed, ...hovered];
  }, [
    draftAt,
    placementEnabled,
    hoveredId,
    layout,
    canPlaceOn,
    placeSide,
    pointedSlot,
    bossDraftPos,
    placement,
    placed,
  ]);

  // The topic's open corners, drawn for as long as the game is still in its
  // root stage (`roots < rootTarget`, `lib/board/rules.ts`): every corner in
  // play, both sides at once, not only the one under the cursor. Steve,
  // 2026-09-04: switching seats had been showing "Yes, because" on both
  // placeholders, because the old topic ghosts borrowed the viewer's own
  // `placeSide` for the label instead of reading it off the corner the slot
  // actually sits in. Each slot below carries its own side from its own
  // corner, so a Minus corner reads "No, because" no matter who is looking at
  // it, and only the viewer's own corners are offered as something to click.
  const rootGhosts = useMemo(() => {
    if (draftAt) return [];
    if (!placementEnabled) return [];
    if (canPlaceOn && !canPlaceOn(TOPIC_CELL_ID)) return [];
    const topicPos = layout.positions.get(TOPIC_CELL_ID);
    if (!topicPos) return [];
    // A root tile's own `parentId` is null, not "topic": `topicRootedLayout`
    // is what reparents it onto the topic's diagonals for drawing. Counting
    // by the raw field, the way the layout itself does, is what keeps this in
    // step with `rootTarget`/`inRootStage` in `lib/board/rules.ts`, which
    // count the same way.
    const rootsPlaced = placed.filter((p) => p.tile.parentId === null).length;
    if (rootsPlaced >= rootTarget) return [];
    // A two-root game only ever offers the two bottom corners (SE for Plus,
    // SW for Minus); the top two are not in play at all, gym level 1 or not.
    // A cooked level narrows this further, to the one corner (if any) the
    // coach's anchor names: no other root diagonal is drawn at all.
    const cornersInPlay = !placement.ghosts
      ? placement.onlySlot && placement.onlySlot.parentId === TOPIC_CELL_ID
        ? [placement.onlySlot.corner]
        : []
      : rootTarget <= 2
        ? ROOT_CORNERS_TWO
        : CORNER_ORDER;
    const open = legalPlacements(layout, TOPIC_CELL_ID, null);
    const openByCorner = new Map(
      open.map((pos) => [cornerFromOffset(pos.x - topicPos.x, pos.y - topicPos.y), pos]),
    );
    let sampleIndex = -1;
    const slots: {
      pos: GridPosition;
      parentId: string;
      corner: TileCorner;
      side: Side;
      interactive: boolean;
      sampleIndex: number;
    }[] = [];
    for (const corner of cornersInPlay) {
      const pos = openByCorner.get(corner);
      if (!pos) continue;
      // The boss's draft, if one is landing on this exact corner, replaces
      // the placeholder rather than sitting beside it.
      if (bossDraftPos && sameCell(pos, bossDraftPos)) continue;
      const side = cornerSide(corner);
      // A caller with no seat in play (the finished map) passes neutral and
      // sees every corner as an invitation, same as it always could. A player
      // with a seat sees their own as the invitation and the other side's for
      // orientation only.
      const interactive = placeSide === "neutral" || side === placeSide;
      if (interactive) sampleIndex += 1;
      slots.push({
        pos,
        parentId: TOPIC_CELL_ID,
        corner,
        side,
        interactive,
        sampleIndex,
      });
    }
    return slots;
  }, [
    draftAt,
    placementEnabled,
    canPlaceOn,
    layout,
    placed,
    rootTarget,
    placeSide,
    bossDraftPos,
    placement,
  ]);

  const pitch = size * CELL_PITCH_RATIO;

  // Tiles are drawn at grid position plus the layout's offset, and that offset
  // grows whenever a tile lands above or left of everything placed so far:
  // the whole canvas then shifts down or right by a cell, which on screen is
  // a pan nobody asked for, the exact thing the automatic refit above is
  // built not to do (Steve, 2026-09-04, "never pan it unless they expect
  // that to happen"). Back the pan off by the same distance in the same
  // render, so every tile already on screen stays where it was and only the
  // new one appears. Written as state adjusted during render, the pattern
  // React documents for reacting to a prop change, because the lint here
  // forbids a synchronous setState inside an effect and a frame later would
  // flash the jump.
  const [seenOffset, setSeenOffset] = useState({ x: layout.offsetX, y: layout.offsetY });
  if (seenOffset.x !== layout.offsetX || seenOffset.y !== layout.offsetY) {
    const dx = (layout.offsetX - seenOffset.x) * pitch * remPx * zoom;
    const dy = (layout.offsetY - seenOffset.y) * pitch * remPx * zoom;
    setSeenOffset({ x: layout.offsetX, y: layout.offsetY });
    setPan((p) => ({ x: p.x - dx, y: p.y - dy }));
  }

  const canvasWidth = (layout.width - 1) * pitch + size;
  const canvasHeight = (layout.height - 1) * pitch + size;

  /**
   * The tiles' own extent inside the canvas, in rem.
   *
   * The canvas is deliberately bigger than the tiles: `layoutBoard` pads it by
   * a ring of empty cells so a board can grow in any direction without the
   * whole thing jumping, and a board that grew down one diagonal carries empty
   * rows on the other. Fitting the canvas therefore fits mostly nothing: a
   * two-tile board asked to fit landed at 43% with the tiles small in a large
   * empty area, because the canvas was nearly twice as tall as the two tiles
   * in it. Fit to the tiles instead, and the empty ring stays where it belongs,
   * off screen and ready.
   *
   * Placed tiles are not the only thing "Zoom to fit" promises to show,
   * though: a two-thread board only fit the second thread's placed tiles and
   * clipped the first thread's still-open ghost corner off the edge of the
   * screen (second playtest). The invitations drawn one cell past the last
   * tile, and whatever the coach is pointing at or the boss is drafting, are
   * on screen too, so they belong in the same box.
   */
  const content = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const include = (pos: GridPosition) => {
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y);
    };
    for (const pos of layout.positions.values()) include(pos);
    for (const ghost of ghosts) include(ghost.pos);
    for (const root of rootGhosts) include(root.pos);
    if (bossDraftPos) include(bossDraftPos);
    if (minX === Infinity) {
      return { left: 0, top: 0, width: canvasWidth, height: canvasHeight };
    }
    return {
      left: (minX + layout.offsetX) * pitch,
      top: (minY + layout.offsetY) * pitch,
      width: (maxX - minX) * pitch + size,
      height: (maxY - minY) * pitch + size,
    };
  }, [layout, pitch, size, canvasWidth, canvasHeight, ghosts, rootGhosts, bossDraftPos]);

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
    (floor = MIN_ZOOM, onlyWhenRescaling = false) => {
      if (!pane) return;
      const w = content.width * remPx;
      const h = content.height * remPx;
      // The part of the pane the board actually gets, which is the pane less
      // whatever the caller has floating over its edges.
      const usable = Math.max(FIT_MARGIN + 1, pane.w - reserveRight * remPx);
      const usableHeight = Math.max(FIT_MARGIN + 1, pane.h - reserveBottom * remPx);
      const room = Math.min(
        (usable - FIT_MARGIN) / w,
        (usableHeight - FIT_MARGIN) / h,
        // Never magnify past life size to fill a big screen: a two-tile board
        // blown up to 200% looks broken rather than roomy.
        1,
      );
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, floor, room));

      // The opponent's tile may rescale the board and may not pan it (Steve,
      // 2026-09-03). Fitting is both at once, so the automatic refit asks for
      // the pan half only when the scale actually changed: a tile that lands
      // inside the footprint the board already had leaves the view exactly
      // where the player left it, instead of sliding the argument sideways
      // under someone who is reading it. Pressing Fit to screen passes false
      // and still recentres, because that is a view the player asked for.
      //
      // Only once the view has been centred, though. A one-tile board fits at
      // life size, so on mount `next` equals the starting zoom and this used
      // to return here without ever centring: the topic sat at the canvas
      // origin, top-left of the pane, and the first tile that forced a
      // shrink took the full recentre below and slid the whole board to the
      // middle of the screen. That was the pan Steve's 2026-09-04 playtest
      // saw when Bob's tile landed (BRAIN-T260904-32).
      if (
        onlyWhenRescaling &&
        hasCentered.current &&
        Math.abs(next - zoomRef.current) < 0.001
      )
        return;

      // The very first fit, on mount, has no view yet for a pan to disturb,
      // so it centres the topic in the reserved area the way Fit to screen
      // always has. Every automatic refit after that (a tile landing and
      // growing the footprint) is not allowed to move the view at all, only
      // to shrink or grow it: rescale about the pane's own centre, so
      // whatever the player already has in the middle of their screen stays
      // there (Steve, 2026-09-04: "you can zoom it out but never pan it
      // unless they expect that to happen"). Pressing Fit to screen still
      // takes the full recentre below, because that pan is the one the
      // player asked for.
      if (onlyWhenRescaling && hasCentered.current) {
        const cx = pane.w / 2;
        const cy = pane.h / 2;
        const ratio = next / zoomRef.current;
        setZoom(next);
        zoomRef.current = next;
        setPan((p) => ({
          x: cx - (cx - p.x) * ratio,
          y: cy - (cy - p.y) * ratio,
        }));
        return;
      }

      // Centre in the reserved area only while the board still fits there.
      //
      // The automatic refit is floored at COMFORT_ZOOM, so a board past a
      // certain size overflows on purpose and runs off the edges, which is
      // what Rannie's frame and the retired client both do. Centring an
      // overflowing board inside the reserved area does not buy the furniture
      // any clearance, because there is none to buy; all it does is push the
      // overflow entirely to the opposite edge, so reserving 13rem at the
      // bottom took the top row further off the top of the screen and left the
      // bottom row under the hand anyway. When it does not fit, share the
      // overflow across the whole pane, which is the behaviour reserving
      // nothing always had.
      const across = w * next <= usable - FIT_MARGIN ? usable : pane.w;
      const down = h * next <= usableHeight - FIT_MARGIN ? usableHeight : pane.h;
      setZoom(next);
      zoomRef.current = next;
      setPan({
        // `pan` positions the canvas, and we just measured the tiles inside
        // it, so back out where the tiles sit within the canvas.
        x: (across - w * next) / 2 - content.left * remPx * next,
        y: (down - h * next) / 2 - content.top * remPx * next,
      });
      touched.current = false;
      hasCentered.current = true;
    },
    // The four numbers, not the object: `content` is rebuilt on every render,
    // and depending on it made `fit` a new function every render, which ran
    // the automatic refit below every render and snapped a board straight back
    // to COMFORT_ZOOM a moment after Fit to screen had fitted it.
    [
      pane,
      content.left,
      content.top,
      content.width,
      content.height,
      remPx,
      reserveRight,
      reserveBottom,
    ],
  );

  // Refit while the view is still the one we chose. Depends on the footprint,
  // so it runs when a tile is placed and when the window resizes.
  useEffect(() => {
    if (touched.current) return;
    // Floored: a tile landing should not shrink the whole board under the
    // player's cursor. Pressing Fit to screen is the way to ask for that.
    fit(COMFORT_ZOOM, true);
  }, [fit]);

  /**
   * Bring an open composer into view.
   *
   * Clicking an open slot low on the board opens the draft there, and that is
   * the one place a draft is most likely to be under the hand or off the
   * bottom of the screen, because a slot is by definition further out than the
   * tile it hangs off. A player who just clicked a slot and cannot find what
   * they opened has no reason to guess that dragging the board would show it.
   *
   * Zoom only, never pan. The view is not the player's to move on their
   * behalf (Steve, 2026-09-04: "you can zoom it out but never pan it unless
   * they expect that to happen"), so the fix for an off-screen composer is to
   * shrink the board around the pan the player already chose, not to slide
   * that pan out from under them. This used to nudge the pan instead; that
   * was the one automatic pan Steve's playtest note called out by name.
   */
  useEffect(() => {
    if (!draftAt || !pane) return;
    const usable = Math.max(FIT_MARGIN + 1, pane.w - reserveRight * remPx);
    const usableHeight = Math.max(FIT_MARGIN + 1, pane.h - reserveBottom * remPx);
    const fits = (scale: number) => {
      const left = pan.x + (draftAt.x + layout.offsetX) * pitch * scale;
      const top = pan.y + (draftAt.y + layout.offsetY) * pitch * scale;
      const right = left + size * scale;
      // The composer hangs its Place and cancel buttons below the octagon.
      const bottom = top + (size + DRAFT_TAIL_REM) * scale;
      return (
        left >= DRAFT_EDGE &&
        top >= DRAFT_EDGE &&
        right <= usable - DRAFT_EDGE &&
        bottom <= usableHeight - DRAFT_EDGE
      );
    };
    const currentScale = remPx * zoom;
    if (fits(currentScale)) return;
    // Shrink a step at a time rather than solving for the exact scale: the
    // pan is fixed here (unlike `fit`, which is free to choose it), so which
    // direction shrinking helps depends on which side of the pan origin the
    // draft sits on, and a dozen 8% steps finds it without working that out
    // algebraically. If the floor is reached and it still does not fit, the
    // composer stays exactly where it is rather than pan to chase it: an
    // imperfect view beats a view that moved on its own.
    let candidate = currentScale;
    for (let i = 0; i < 12 && candidate > MIN_ZOOM * remPx; i++) {
      candidate *= 0.92;
      if (fits(candidate)) break;
    }
    candidate = Math.max(MIN_ZOOM * remPx, candidate);
    const nextZoom = candidate / remPx;
    if (Math.abs(nextZoom - zoom) < 0.001) return;
    // On the next frame rather than in the effect body: the composer is
    // mounting as this runs, and a `setState` set synchronously here is a
    // cascading render for a view the player has not been shown yet.
    const frame = requestAnimationFrame(() => {
      setZoom(nextZoom);
      zoomRef.current = nextZoom;
    });
    // Deliberately leaves `touched` alone: this is the board protecting the
    // composer, not the player choosing a view, and claiming it was would
    // switch the automatic refit off for the rest of the game.
    return () => cancelAnimationFrame(frame);
  }, [draftAt, pane, pan, zoom, remPx, layout, pitch, size, reserveRight, reserveBottom]);

  /**
   * Frame the coach's target.
   *
   * When the Director publishes a pointed slot or a boss draft cell, the
   * coach is telling the player exactly where to look, so a pan here is the
   * pan the player is expecting, unlike the "never pan on the player's
   * behalf" rule the composer-visibility effect above follows for its own,
   * unannounced, adjustment. `bossDraft` wins when both are set: his tile is
   * the thing actually landing, mid-turn, over whatever slot the coach may
   * still be pointing at from the beat before.
   *
   * Zooms out, and only zooms out, until the target is fully inside the
   * pane, clear of the reserved furniture on every edge, including a
   * `reserveTop` strip for the persistent coach persona pill. The shrink is
   * about the pane's own centre, exactly as the automatic refit above does
   * it, so whatever the player already has in the middle of their screen
   * stays there.
   *
   * It used to pan as well, on the reasoning that a pan the coach announces
   * is a pan the player expects. Steve, 2026-09-06, ruled that out for good
   * after a level-1 playtest: the board "can zoom out, but never pan". So a
   * target that will not fit even at `MIN_ZOOM` is simply left where it is,
   * the same bargain the composer-visibility effect above already strikes.
   * An imperfect view beats a view that moved on its own.
   *
   * Does nothing if the target is already fully visible, and never runs
   * mid-drag: this is the board choosing a scale, not a correction to fight
   * a player who is already navigating.
   */
  useEffect(() => {
    if (!pane || panning || dragRef.current) return;
    const targetPos = bossDraftPos ?? pointedSlotPos ?? pointedTilePos;
    if (!targetPos) return;
    const pad = FIT_MARGIN / 2;
    const safeLeft = pad;
    const safeTop = Math.max(pad, reserveTop * remPx);
    const safeRight = pane.w - reserveRight * remPx - pad;
    const safeBottom = pane.h - reserveBottom * remPx - pad;
    if (safeRight <= safeLeft || safeBottom <= safeTop) return;
    const cellLeft = (targetPos.x + layout.offsetX) * pitch;
    const cellTop = (targetPos.y + layout.offsetY) * pitch;
    const box = (scale: number, at: GridPosition) => ({
      left: at.x + cellLeft * scale,
      top: at.y + cellTop * scale,
      right: at.x + cellLeft * scale + size * scale,
      bottom: at.y + cellTop * scale + size * scale,
    });
    const fullyVisible = (b: {
      left: number;
      top: number;
      right: number;
      bottom: number;
    }) =>
      b.left >= safeLeft &&
      b.top >= safeTop &&
      b.right <= safeRight &&
      b.bottom <= safeBottom;
    const currentScale = remPx * zoom;
    // Shrinking about the pane's centre moves the canvas origin, so the pan
    // that goes with a candidate scale is part of the candidate, not a
    // separate decision. On screen it reads as a pure zoom: the point in the
    // middle of the player's view does not move.
    const cx = pane.w / 2;
    const cy = pane.h / 2;
    const panFor = (scale: number) => {
      const ratio = scale / currentScale;
      return { x: cx - (cx - pan.x) * ratio, y: cy - (cy - pan.y) * ratio };
    };
    if (fullyVisible(box(currentScale, pan))) return;
    // A dozen 8% steps rather than solving for the scale directly: the
    // target has to clear four different edges, and which of them is
    // binding changes as the board shrinks around the pane's centre.
    let candidate = currentScale;
    let fitted = false;
    for (let i = 0; i < 12 && candidate > MIN_ZOOM * remPx; i++) {
      candidate = Math.max(MIN_ZOOM * remPx, candidate * 0.92);
      if (fullyVisible(box(candidate, panFor(candidate)))) {
        fitted = true;
        break;
      }
    }
    // Nothing found inside the zoom range. Leave the view alone rather than
    // shrink the whole board to its floor for a target that still will not
    // fit: the player would lose the view they had and gain nothing.
    if (!fitted) return;
    const nextZoom = candidate / remPx;
    const nextPan = panFor(candidate);
    if (Math.abs(nextZoom - zoom) < 0.001) return;
    // Next frame, matching the composer-visibility effect: the target is
    // arriving as this runs, and a synchronous `setState` here is a
    // cascading render for a view the player has not been shown yet.
    const frame = requestAnimationFrame(() => {
      setZoom(nextZoom);
      zoomRef.current = nextZoom;
      setPan(nextPan);
    });
    // Deliberately leaves `touched` alone, the same way the composer effect
    // does: this is the board choosing a scale for itself, not the player
    // choosing a view, and marking it touched would switch the automatic
    // refit off for the rest of the game.
    return () => cancelAnimationFrame(frame);
    // `pan` and `zoom` are read above but deliberately excluded: they are
    // this effect's own output, and depending on them would refire it after
    // every frame it just requested, fighting itself instead of settling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    bossDraftPos,
    pointedSlotPos,
    pointedTilePos,
    pane,
    panning,
    layout,
    pitch,
    size,
    remPx,
    reserveRight,
    reserveBottom,
    reserveTop,
  ]);

  /**
   * One click of the pan pad, in screen pixels. Independent of zoom on
   * purpose: the pad exists to move what you are looking at, and a fixed
   * screen distance is what "a bit to the left" means to the person clicking.
   */
  const nudge = useCallback((dx: number, dy: number) => {
    touched.current = true;
    setPan((p) => ({ x: p.x + dx * PAN_STEP_PX, y: p.y + dy * PAN_STEP_PX }));
  }, []);

  const zoomTo = useCallback(
    (next: number, anchor?: { x: number; y: number }) => {
      const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
      if (clamped === zoomRef.current) return;
      const at = anchor ?? { x: (pane?.w ?? 0) / 2, y: (pane?.h ?? 0) / 2 };
      // Same ratio-about-a-point math as the automatic refit's rescale branch
      // above: computed here, in the handler body, off `zoomRef.current` read
      // once, rather than inside the functional-updater form of `setZoom`.
      // That nested shape (`setZoom((current) => { ...; setPan(...); return
      // clamped; })`) put a side effect inside a state updater, and React's
      // Strict Mode double-invokes updater functions to catch exactly that:
      // the nested `setPan` call fired twice per click, the second time
      // compounding the first's already-moved pan into the ratio a second
      // time, which is what threw the board off screen (Steve, 2026-09-05
      // playtest: three fitted boards in a row, every "+" press). Keeping
      // `setZoom` and `setPan` as two plain, top-level calls here means
      // there is no updater function for Strict Mode to double-invoke.
      const ratio = clamped / zoomRef.current;
      setZoom(clamped);
      zoomRef.current = clamped;
      setPan((p) => ({
        x: at.x - (at.x - p.x) * ratio,
        y: at.y - (at.y - p.y) * ratio,
      }));
      touched.current = true;
    },
    [pane],
  );

  /**
   * Wheel gestures, in the vocabulary every other canvas already speaks: two
   * fingers pan, pinch zooms. A trackpad pinch reaches the page as a wheel
   * event carrying `ctrlKey`, which is the only thing that separates it from
   * an ordinary scroll, so that flag is the whole branch. Before this, every
   * wheel event zoomed, so a player who tried to look at the far side of the
   * board found the board shrinking instead of sliding.
   *
   * Attached by hand rather than through React's `onWheel` prop because React
   * registers wheel listeners passively, and a passive listener cannot call
   * `preventDefault`. Without that call the browser answers a pinch by zooming
   * the whole page and a horizontal two-finger swipe by navigating back, both
   * on top of whatever the board just did.
   */
  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      // Firefox reports some wheels in lines rather than pixels. A line is
      // not a unit this board has, so give it the height of a line of text.
      const scale = event.deltaMode === 1 ? 16 : 1;
      if (event.ctrlKey || event.metaKey) {
        const rect = pane.getBoundingClientRect();
        // Exponential so a pinch feels the same at either end of the range:
        // a fixed step is a third of the board down at 0.25 and a twentieth
        // of it at 2. Clamped first because the two devices that send this
        // are not on the same scale: a trackpad pinch arrives as a stream of
        // single digits, while one notch of a mouse wheel with ctrl held is
        // 120, which unclamped took the board from 100% to the 200% ceiling
        // in a single click.
        const delta = Math.max(-40, Math.min(40, event.deltaY * scale));
        zoomTo(zoom * Math.exp(-delta / 160), {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        });
        return;
      }
      touched.current = true;
      setPan((p) => ({
        x: p.x - event.deltaX * scale,
        y: p.y - event.deltaY * scale,
      }));
    };
    pane.addEventListener("wheel", onWheel, { passive: false });
    return () => pane.removeEventListener("wheel", onWheel);
  }, [zoom, zoomTo]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // Only a drag on the background pans. A drag that starts on a tile is
      // the browser's own text selection, which a player needs in order to
      // read and copy a reason, and a drag that starts on a control belongs
      // to the control.
      //
      // This used to test `event.target !== event.currentTarget`, which is
      // true only for the handful of pixels where the pane itself is the
      // topmost element. Everywhere else the transform layer is on top, so
      // most of the empty ground refused to pan and grab-and-drag worked
      // "sometimes" with no way to tell which times (Steve, 2026-09-02). Ask
      // what was actually grabbed instead of where the listener happens to
      // sit.
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "[data-tile-id], button, a, input, textarea, select, [role='button'], [contenteditable='true']",
        )
      ) {
        return;
      }
      // Middle and right buttons are the browser's, not ours.
      if (event.button !== 0) return;
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
        // Ground, not page. See --color-board-ground in app/globals.css for
        // why the board is the one screen that does not sit on offwhite.
        backgroundColor: "var(--color-board-ground)",
        backgroundImage: DOT_GROUND,
        backgroundSize: `${(pitch * remPx * zoom) / DOTS_PER_PITCH}px ${(pitch * remPx * zoom) / DOTS_PER_PITCH}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }}
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

        {/* A second pass over the same tiles, deliberately unclipped. Kept
            as its own loop rather than interleaved with the clipped wrapper
            above so every overlay paints after (and therefore above) every
            tile's octagon, no matter where the two tiles sit relative to
            each other on the board. */}
        {renderOverlay &&
          placed.map(({ tile, pos }) => (
            <div
              key={`overlay:${tile.id}`}
              className="pointer-events-none"
              style={{ ...pixelStyle(pos, layout, size), clipPath: undefined }}
            >
              {renderOverlay(tile)}
            </div>
          ))}

        {rootGhosts.map(({ pos, parentId, corner, side, interactive, sampleIndex }) => {
          // The sample itself is no longer shown in the slot (Steve,
          // 2026-09-04: a player should pick a spot before the words are
          // already there for them), but it still rides along to `onPlace`
          // so the composer that opens after the click can type it in.
          const raw = interactive ? (slotSamples?.[sampleIndex] ?? null) : null;
          const sample = raw === null ? null : stripDuplicateLead(raw);
          return (
            <GhostSlot
              key={`root:${corner}`}
              style={pixelStyle(pos, layout, size)}
              label={
                interactive
                  ? `Start a new thread on the ${side === "minus" ? "Minus" : "Plus"} side`
                  : `The ${side === "minus" ? "Minus" : "Plus"} side's opening reason`
              }
              side={side}
              stem={tileLead(side, true, null)}
              mark={side === "minus" ? "\u2212" : "+"}
              interactive={interactive}
              parentId={parentId}
              corner={corner}
              onClick={() => onPlace?.(parentId, pos, sample, corner)}
            />
          );
        })}

        {ghosts.map(({ pos, parentId, side, corner }, index) => {
          // Same deal as the root slots above: the sample is not drawn, only
          // handed to `onPlace` for the composer to type in after the click.
          const raw = slotSamples?.[index] ?? null;
          const sample = raw === null ? null : stripDuplicateLead(raw);
          return (
            <GhostSlot
              key={`${pos.x},${pos.y}`}
              style={pixelStyle(pos, layout, size)}
              label="Click to write your reason here"
              side={side}
              parentId={parentId}
              corner={corner}
              onClick={() => onPlace?.(parentId, pos, sample, corner)}
            />
          );
        })}

        {bossDraft && bossDraftPos && (
          <BossDraftSlot
            style={pixelStyle(bossDraftPos, layout, size)}
            side={bossDraft.side}
            text={bossDraft.text}
            lead={tileLead(
              bossDraft.side,
              bossDraft.parentId === TOPIC_CELL_ID,
              placed.find((entry) => entry.tile.id === bossDraft.parentId)?.tile.side ??
                null,
            )}
            isOpening={bossDraft.parentId === TOPIC_CELL_ID}
            parentId={bossDraft.parentId}
            corner={bossDraft.corner}
            bossName={bossDraft.bossName}
            onFinishNow={bossDraft.finishNow}
          />
        )}

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
        pill, same order.

        The percentage between the steppers is a readout and not a button: it
        used to be a second Fit to screen, so the cluster held two controls
        that did the same thing and neither said so. The one that does it now
        is the small square at the end, which is the standard four-corner mark
        rather than a word, both because it is the tiny button Steve asked for
        and because a player who has just scrolled the board off the edge is
        looking for a shape, not reading a label.
      */}
      {/* Bottom right, one row: how to move, then how much to see. Both live
          in the strip below the right rail, which is the only clear band on
          this screen. */}
      <div
        data-ui="nav-controls"
        className="absolute right-8 bottom-8 z-30 flex items-center gap-2"
      >
        {/*
          The pan pad.

          Dragging the ground pans, and a trackpad's two fingers pan, and both
          of those are invisible: nothing on the screen says so. This is the
          way out for a player on a plain mouse who never discovers either
          (Steve, 2026-09-02). A plain nudge rather than a held repeat, on
          purpose, because the thing it rescues is "I cannot see my tile",
          which is one or two clicks, not a joystick.
        */}
        <div className="border-gray/30 bg-offwhite flex flex-col items-center rounded-3xl border px-2 py-1 shadow-md">
          <PanButton step={PAN_UP} nudge={nudge} />
          <div className="flex items-center gap-1">
            {PAN_ROW.map((step) => (
              <PanButton key={step.label} step={step} nudge={nudge} />
            ))}
          </div>
        </div>

        <div className="border-gray/30 bg-offwhite flex items-center gap-1 rounded-full border px-2 py-1 shadow-md">
          <button
            type="button"
            onClick={() => zoomTo(zoom - 0.25)}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out"
            className="text-neutral-black hover:bg-sand flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-lg font-bold disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
          >
            &minus;
          </button>
          <span className="text-neutral-black text-p-sm min-w-[3.25rem] text-center font-semibold tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
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
            title="Zoom to fit: put the whole board back on screen"
            aria-label="Zoom to fit"
            className="text-neutral-black hover:bg-sand flex h-6 w-6 cursor-pointer items-center justify-center rounded-full"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5">
              <g
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6.2V3h3.2" />
                <path d="M13 6.2V3H9.8" />
                <path d="M3 9.8V13h3.2" />
                <path d="M13 9.8V13H9.8" />
              </g>
            </svg>
          </button>
          {extraControls}
        </div>
      </div>

      {unplaced.length > 0 ? (
        // Never silently drop a tile. Four is the tile board's capacity, not
        // a bug and not a win condition: a centre tile has four diagonals.
        // MAX_THREADS in lib/board/rules.ts is also 4 now (Steve,
        // 2026-09-05); compact mode raises it to six, three a side, when it
        // ships. Winning is resolving *all* threads, however many a game
        // happens to have.
        //
        // The second sentence used to say "the board holds four threads" on
        // every one of these, which is only the reason when the tile that
        // found nowhere to go was starting a thread of its own. A reason
        // hanging off another reason ran out of room beside its parent, and
        // blaming the thread count for that sends the reader to count threads
        // and find nothing wrong. So the cause is read off the tile.
        <p className="text-p-sm text-orange bg-offwhite border-orange/40 absolute bottom-8 left-1/2 z-30 -translate-x-1/2 rounded-full border px-4 py-2 shadow-md">
          {unplaced.length === 1
            ? "One reason has no room on the board and is not drawn."
            : `${unplaced.length} reasons have no room on the board and are not drawn.`}{" "}
          {unplaced.every((t) => t.parentId == null)
            ? "The board holds four threads."
            : "There was no free space beside the reason it answers."}
        </p>
      ) : null}
    </div>
  );
}
