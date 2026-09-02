"use client";

import { useState, type ReactNode } from "react";

/**
 * A titled card that folds away, for the things that float over the board.
 *
 * The board is the screen now (`components/board/live-board.tsx`), so
 * everything that is not a tile is a small panel over one of its corners. Most
 * of those panels are things a player consults rather than watches: how the
 * game ends, the thread list, the coach. Folded by default, they cost a strip
 * of header; open, they cost as much room as they need and no more.
 *
 * Uncontrolled on purpose. Nothing outside needs to know whether a player has
 * the thread list open, and a caller that does can lift it later.
 */
export function FloatingPanel({
  title,
  children,
  defaultOpen = false,
}: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-gray/30 bg-offwhite overflow-hidden rounded-2xl border shadow-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="hover:bg-sand/40 flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-2 text-left"
      >
        <span className="font-primary text-p-sm tracking-wide uppercase">{title}</span>
        <span aria-hidden="true" className="text-gray text-p-sm">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? (
        <div className="border-gray/20 max-h-[60vh] overflow-y-auto border-t px-4 py-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}
