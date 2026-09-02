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
export function AnchoredCard({
  anchorSelector,
  onClose,
  children,
  width = 22,
}: {
  /** CSS selector for the element to sit beside. */
  anchorSelector: string;
  onClose: () => void;
  children: ReactNode;
  /** Card width in rem. */
  width?: number;
}) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
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
    const anchor = document.querySelector(anchorSelector);
    if (!anchor) {
      setPos(null);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const card = cardRef.current?.getBoundingClientRect();
    const cardWidth = card?.width ?? width * 16;
    const cardHeight = card?.height ?? 240;
    const gap = 12;
    // To the right of the tile by default, flipped to the left when there is
    // no room, and always kept inside the viewport vertically.
    let left = rect.right + gap;
    if (left + cardWidth > window.innerWidth - 8) left = rect.left - gap - cardWidth;
    if (left < 8) left = 8;
    const top = Math.min(
      Math.max(8, rect.top + rect.height / 2 - cardHeight / 2),
      Math.max(8, window.innerHeight - cardHeight - 8),
    );
    setPos({ left, top });
  }, [anchorSelector, width]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      place();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
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
      className="border-gray/40 bg-offwhite fixed z-50 rounded-2xl border shadow-lg"
      style={{
        left: pos ? `${pos.left}px` : "-9999px",
        top: pos ? `${pos.top}px` : "-9999px",
        width: `${width}rem`,
        maxHeight: "70vh",
        overflowY: "auto",
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="text-gray hover:text-neutral-black absolute top-2 right-3 cursor-pointer text-lg leading-none"
      >
        ×
      </button>
      <div className="p-4">{children}</div>
    </div>,
    document.body,
  );
}

/** Nothing ever changes, so nothing ever needs to notify. */
function subscribeNoop(): () => void {
  return () => {};
}
