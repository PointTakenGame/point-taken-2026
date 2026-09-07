"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/**
 * A card that follows a thing on the board.
 *
 * `components/ui/tile-popover.tsx` is the pop-up for a question with a known
 * shape: some text fields, or a pick-one, or a confirm. This is the other
 * case, where the content is arbitrary markup that already exists (a tile's
 * whole set of actions, say) and all that is wanted is for it to appear
 * beside the tile it belongs to.
 *
 * The anchor is looked up by selector rather than passed as a ref because the
 * thing it anchors to lives inside a panned and zoomed canvas that renders its
 * own children: a ref would have to be threaded through the board's render
 * callback for every tile, and the board would then know what a popover is.
 *
 * Position is re-measured on every animation frame while open. That sounds
 * expensive and is not: one `getBoundingClientRect` per frame, only while a
 * card is open, and it is the only approach that cannot go stale, because the
 * board moves under it by pan, by zoom, by wheel, and by a tile arriving.
 */
type Pos = {
  left: number;
  top: number;
  /**
   * Which edge of the card the arrow sits on, or null when this placement
   * carries no arrow. "left" and "right" are a card beside its anchor;
   * "top" and "bottom" are a card below or above it.
   */
  arrowSide: "left" | "right" | "top" | "bottom" | null;
  /** Arrow's offset along that edge from the card's top or left corner, in px. */
  arrowOffset: number;
} | null;

export function AnchoredCard({
  anchorSelector,
  fallbackSelector,
  onClose,
  showClose = true,
  arrow = false,
  placement = "side",
  children,
  width = 22,
  reserveRight = 0,
}: {
  /** CSS selector for the element to sit beside. */
  anchorSelector: string;
  /**
   * CSS selector to dock under (below, centered, no arrow) when
   * `anchorSelector` matches nothing. For the gym coach: a placement target
   * that has not entered the DOM yet (agent B's `data-slot-*` attributes, or
   * a tile not placed yet) should not just vanish, it should fall back to
   * the coach persona itself.
   */
  fallbackSelector?: string;
  onClose: () => void;
  /** Whether the corner close button renders. Defaults on, as every existing caller wants it. */
  showClose?: boolean;
  /** Whether a small tail points from the card at its anchor. Only ever drawn when genuinely anchored, never for the fallback dock. */
  arrow?: boolean;
  /** "side" (default, beside the anchor) or "below" (centered under it, no arrow). */
  placement?: "side" | "below";
  children: ReactNode;
  /** Card width in rem. */
  width?: number;
  /**
   * A strip along the right edge this card may not enter, in rem.
   *
   * The board's canvas runs the full width of the window and the right rail
   * floats over its last few inches, so "inside the viewport" is not the same
   * as "not on top of the rail". Without this the card opened to the right of
   * any tile in the middle of the board and landed squarely on Ways to win,
   * which reads as two panels fighting rather than as a card belonging to a
   * tile. Callers that have no furniture on the right pass nothing.
   */
  reserveRight?: number;
}) {
  const [pos, setPos] = useState<Pos>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  // There is no document to portal into on the server, so the card renders
  // nothing until the client has it. Written as a store read rather than a
  // state-in-effect because that is what the repo's lint allows and what
  // components/ui/tile-popover.tsx already does.
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  const place = useCallback(() => {
    const primary = document.querySelector(anchorSelector);
    const anchor =
      primary ?? (fallbackSelector ? document.querySelector(fallbackSelector) : null);
    if (!anchor) {
      setPos(null);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const card = cardRef.current?.getBoundingClientRect();
    const cardWidth = card?.width ?? width * 16;
    const cardHeight = card?.height ?? 240;
    const gap = 12;
    // A fallback dock always renders below, arrowless, whatever `placement`
    // asked for: it is anchored to the coach persona, not to the thing the
    // beat actually means, so pointing an arrow at it would lie.
    const mode: "side" | "below" = primary ? placement : "below";

    if (mode === "below") {
      const rightLimit = window.innerWidth - 8 - reserveRight * 16;
      let left = rect.left + rect.width / 2 - cardWidth / 2;
      left = Math.min(Math.max(8, left), Math.max(8, rightLimit - cardWidth));
      const top = Math.min(
        rect.bottom + gap,
        Math.max(8, window.innerHeight - cardHeight - 8),
      );
      setPos({ left, top, arrowSide: null, arrowOffset: 0 });
      return;
    }

    // Four places a card can go: beside the anchor on either side, or below
    // or above it. Staying inside the window is not enough on the game board,
    // where a card is wider than a tile and the tiles are packed on a
    // diagonal: "to the right of the anchor" put the coach's card squarely on
    // top of the neighbouring reason more often than not (Steve, 2026-09-07,
    // playing level 1: the pause card sits on top of the tiles it is talking
    // about). So all four are measured against what is actually on the board
    // and the one that covers the least wins.
    const rightLimit = window.innerWidth - 8 - reserveRight * 16;
    const clampLeft = (value: number) =>
      Math.min(Math.max(8, value), Math.max(8, rightLimit - cardWidth));
    const clampTop = (value: number) =>
      Math.min(Math.max(8, value), Math.max(8, window.innerHeight - cardHeight - 8));

    const midX = rect.left + rect.width / 2;
    const midY = rect.top + rect.height / 2;

    // Ordered: the first entry wins a tie, so an unobstructed board still
    // places the card where it has always been placed.
    const candidates: {
      side: "left" | "right" | "top" | "bottom";
      left: number;
      top: number;
    }[] = [
      {
        side: "left",
        left: clampLeft(rect.right + gap),
        top: clampTop(midY - cardHeight / 2),
      },
      {
        side: "right",
        left: clampLeft(rect.left - gap - cardWidth),
        top: clampTop(midY - cardHeight / 2),
      },
      {
        side: "top",
        left: clampLeft(midX - cardWidth / 2),
        top: clampTop(rect.bottom + gap),
      },
      {
        side: "bottom",
        left: clampLeft(midX - cardWidth / 2),
        top: clampTop(rect.top - gap - cardHeight),
      },
    ];

    // Everything the card should not bury: every reason on the board, and the
    // anchor itself, which the clamps above can otherwise slide the card
    // straight on top of when neither side has room.
    //
    // A tile is drawn as an octagon, clipped out of its box by OCTAGON_CLIP in
    // components/board/geometry.ts, so its four corners are empty air that
    // still measures solid in getBoundingClientRect. Scoring the raw box makes
    // the card flee a corner it is not actually covering, and the tiles sit on
    // a diagonal, so corners are exactly where the gaps between them are. Pull
    // each box in far enough that a corner graze is free and burying the text
    // still costs everything.
    const obstacles: Edges[] = [rect];
    for (const tile of document.querySelectorAll("[data-tile-id]")) {
      const box = tile.getBoundingClientRect();
      if (box.width <= 4 || box.height <= 4) continue;
      const insetX = box.width * CORNER_INSET;
      const insetY = box.height * CORNER_INSET;
      obstacles.push({
        left: box.left + insetX,
        right: box.right - insetX,
        top: box.top + insetY,
        bottom: box.bottom - insetY,
      });
    }

    const covered = (left: number, top: number) => {
      let total = 0;
      for (const obstacle of obstacles) {
        const overlapX =
          Math.min(left + cardWidth, obstacle.right) - Math.max(left, obstacle.left);
        const overlapY =
          Math.min(top + cardHeight, obstacle.bottom) - Math.max(top, obstacle.top);
        if (overlapX > 0 && overlapY > 0) total += overlapX * overlapY;
      }
      return total;
    };

    let best = candidates[0];
    let bestCost = covered(best.left, best.top);
    for (const candidate of candidates.slice(1)) {
      const cost = covered(candidate.left, candidate.top);
      if (cost < bestCost) {
        best = candidate;
        bestCost = cost;
      }
    }

    // The arrow runs along whichever edge faces the anchor, so a card beside
    // the anchor offsets its tail vertically and one below or above it
    // offsets horizontally.
    const vertical = best.side === "left" || best.side === "right";
    const arrowOffset = vertical
      ? Math.min(Math.max(16, midY - best.top), Math.max(16, cardHeight - 16))
      : Math.min(Math.max(16, midX - best.left), Math.max(16, cardWidth - 16));

    setPos({
      left: best.left,
      top: best.top,
      arrowSide: arrow ? best.side : null,
      arrowOffset,
    });
  }, [anchorSelector, fallbackSelector, width, reserveRight, placement, arrow]);

  useEffect(() => {
    // Place once on a timer as well as on the frame loop: a background or
    // throttled tab does not run animation frames, and a card that waits for
    // its first frame sits at -9999px until the tab is fronted. Timers still
    // fire there. The frame loop then keeps it current while the board moves.
    const first = window.setTimeout(place, 0);
    let frame = 0;
    const tick = () => {
      place();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      window.clearTimeout(first);
      cancelAnimationFrame(frame);
    };
  }, [place]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={cardRef}
      role="dialog"
      className="fixed z-50"
      style={{
        left: pos ? `${pos.left}px` : "-9999px",
        top: pos ? `${pos.top}px` : "-9999px",
        width: `${width}rem`,
      }}
    >
      {/* Steve, 2026-09-06: the arrow used to render inside the card, pointing
          the wrong way, and several cards grew small scrollbars they did not
          need. Both were the same bug. This positioning wrapper used to be the
          card itself and carried `overflowY: auto`, which makes an element a
          scroll container in both axes (overflow-x computes to auto the moment
          overflow-y is not visible). So the arrow, absolutely positioned at
          -6px, was clipped at the border box, leaving only its inner half
          visible as a wedge pointing into the card, and its outside half
          counted as horizontal overflow, which is where the stray scrollbars
          came from. The wrapper now positions and nothing else; the border,
          the ground, and any scrolling belong to the panel below it. */}
      <div
        className="border-gray/40 bg-offwhite relative flex flex-col rounded-2xl border shadow-lg"
        style={{
          // Nearly the whole window, not 70vh of it. A tile's action list plus
          // the token row runs about 590px, and on a 720px window 70vh is 504,
          // so the card scrolled and the thing it cut off was the token row:
          // "Where do you two disagree?" was on screen and the tokens that
          // answer it were not, with no scrollbar and nothing to say they were
          // there. `place` already keeps the card inside the window, so the
          // remaining 30% was being held back for nothing.
          maxHeight: "calc(100dvh - 3rem)",
        }}
      >
        {showClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray hover:text-neutral-black absolute top-2 right-3 z-10 cursor-pointer text-lg leading-none"
          >
            ×
          </button>
        ) : null}
        <div className="overflow-y-auto p-4">{children}</div>
      </div>

      {/* Drawn after the panel, and outside it, so it reads as a tail on the
          card pointing at the thing the card is about. Which borders it draws,
          and why only two of them, is `ARROW_BORDERS` below. */}
      {pos?.arrowSide ? (
        <div
          aria-hidden
          className={`border-gray/40 bg-offwhite pointer-events-none absolute h-3 w-3 rotate-45 ${ARROW_BORDERS[pos.arrowSide]}`}
          style={
            pos.arrowSide === "left" || pos.arrowSide === "right"
              ? {
                  top: `${pos.arrowOffset - 6}px`,
                  ...(pos.arrowSide === "left" ? { left: "-6px" } : { right: "-6px" }),
                }
              : {
                  left: `${pos.arrowOffset - 6}px`,
                  ...(pos.arrowSide === "top" ? { top: "-6px" } : { bottom: "-6px" }),
                }
          }
        />
      ) : null}
    </div>,
    document.body,
  );
}

/**
 * Which two of the tail's four borders are its outward faces.
 *
 * A 45-degree rotation turns the square's left and bottom edges into the two
 * faces of a leftward tip, its top and right into those of a rightward one,
 * and so on round. Drawing all four puts a visible V across the card's
 * interior where the tail overlaps the panel.
 */
/** The sides of a rectangle, which is all the overlap maths below needs. */
type Edges = { left: number; right: number; top: number; bottom: number };

/**
 * How far into a tile's bounding box its octagon actually starts, as a
 * fraction of the box. OCTAGON_CLIP cuts each corner at 29%; this is a little
 * under half of that, which is the most that can be shaved off all four sides
 * at once without eating into the tile's own text.
 */
const CORNER_INSET = 0.13;

const ARROW_BORDERS: Record<"left" | "right" | "top" | "bottom", string> = {
  left: "border-b border-l",
  right: "border-t border-r",
  top: "border-t border-l",
  bottom: "border-b border-r",
};

/** Nothing ever changes, so nothing ever needs to notify. */
function subscribeNoop(): () => void {
  return () => {};
}
