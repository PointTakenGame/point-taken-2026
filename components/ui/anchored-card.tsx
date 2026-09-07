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
  /** Which edge the arrow sits on, or null when this placement carries no arrow. */
  arrowSide: "left" | "right" | null;
  /** Arrow's vertical offset from the card's top edge, in px. */
  arrowTop: number;
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
      setPos({ left, top, arrowSide: null, arrowTop: 0 });
      return;
    }

    // To the right of the tile by default, flipped to the left when there is
    // no room, and always kept inside the viewport vertically.
    const rightLimit = window.innerWidth - 8 - reserveRight * 16;
    let left = rect.right + gap;
    let arrowSide: "left" | "right" = "left";
    if (left + cardWidth > rightLimit) {
      left = rect.left - gap - cardWidth;
      arrowSide = "right";
    }
    if (left < 8) left = 8;
    const top = Math.min(
      Math.max(8, rect.top + rect.height / 2 - cardHeight / 2),
      Math.max(8, window.innerHeight - cardHeight - 8),
    );
    const arrowTop = Math.min(
      Math.max(16, rect.top + rect.height / 2 - top),
      cardHeight - 16,
    );
    setPos({ left, top, arrowSide: arrow ? arrowSide : null, arrowTop });
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
          card pointing at the thing the card is about. Two borders rather than
          four: a square with a border all the way round draws a visible V
          across the card's interior once half of it overlaps the panel. Which
          two depends on the side, because a 45-degree rotation turns the left
          and bottom edges into the outward faces of a leftward tip, and the
          top and right edges into those of a rightward one. */}
      {pos?.arrowSide ? (
        <div
          aria-hidden
          className={`border-gray/40 bg-offwhite pointer-events-none absolute h-3 w-3 rotate-45 ${
            pos.arrowSide === "left" ? "border-b border-l" : "border-t border-r"
          }`}
          style={{
            top: `${pos.arrowTop - 6}px`,
            ...(pos.arrowSide === "left" ? { left: "-6px" } : { right: "-6px" }),
          }}
        />
      ) : null}
    </div>,
    document.body,
  );
}

/** Nothing ever changes, so nothing ever needs to notify. */
function subscribeNoop(): () => void {
  return () => {};
}
