"use client";

import { useMemo } from "react";
import { TokenGlyph } from "@/components/board/token-glyph";
import type { Side } from "@/lib/events/types";

/**
 * "Ways to win": a postage-stamp minimap mirror of the board, not a
 * tile-anchored pop-up. It sits beside the board for the whole game rather
 * than opening and closing over a tile, so it is built as its own small
 * presentational component instead of a `TilePopover` configuration, the
 * same reasoning that keeps it off the "one generic pop-up" ruling: that
 * ruling is about the three transient resolution/reference surfaces, not
 * about every piece of board chrome.
 *
 * Ported from the retired client's `WaysToWinCard.vue` (91 lines): the four
 * starter threads sit at the four corners in their real side colors, a
 * corner fills in with the resolving token once that thread closes, and a
 * center pencil stands in for revising the topic. Hovering a corner or the
 * pencil is reported upward via `onHover` so the caller can spotlight the
 * matching tile on the real board; the minimap itself is not a click
 * target except the pencil, which reports through `onRevise`.
 */

export interface MiniThread {
  tileId: string;
  side: Side;
  /**
   * The board edge this thread's root tile sits on, or null when the caller
   * has no edge geometry to give. The projection records no position for a
   * tile, so the live board passes null and the corners fill in thread order.
   */
  parentEdge: number | null;
  resolved: boolean;
  /** The resolution token that closed this thread, or null while it is still open. */
  token: string | null;
}

type HoverPayload = { tileId: string; kind: "resolved" | "open" | "topic" } | null;

const SIDE_FILL: Record<Side, string> = {
  plus: "bg-green",
  minus: "bg-orange",
};

// Board edge index -> stamp corner (1 = top-right, 3 = bottom-right, 5 =
// bottom-left, 7 = top-left, matching the retired client's edge numbering).
// Falls back to filling whatever corner is still free, in order, if a game
// ever starts a thread on an edge outside that set.
const EDGE_TO_CORNER: Record<number, "tr" | "br" | "bl" | "tl"> = {
  1: "tr",
  3: "br",
  5: "bl",
  7: "tl",
};
const CORNER_POSITION: Record<"tr" | "br" | "bl" | "tl", string> = {
  tl: "left-[2%] top-[2%]",
  tr: "left-[66%] top-[2%]",
  bl: "left-[2%] top-[66%]",
  br: "left-[66%] top-[66%]",
};
const ALL_CORNERS: Array<"tr" | "br" | "bl" | "tl"> = ["tr", "br", "bl", "tl"];

// GAP: this layout only has four corners, one per starter thread. It does
// not extend to a fifth or sixth thread, and `MAX_THREADS` (lib/board/rules.ts)
// is 6. The retired client had the same limit; carried forward rather than
// solved here, since redesigning the minimap's geometry is a bigger surface
// change than this task's lane covers. Flagged in the build report.
export function WaysToWinCard({
  threads,
  resolvedCount,
  onHover,
  onRevise,
}: {
  threads: MiniThread[];
  resolvedCount: number;
  onHover?: (payload: HoverPayload) => void;
  onRevise?: () => void;
}) {
  const corners = useMemo(() => {
    const cornerFor = (edge: number | null) =>
      edge === null ? undefined : EDGE_TO_CORNER[edge];
    const free = ALL_CORNERS.filter(
      (corner) => !threads.some((thread) => cornerFor(thread.parentEdge) === corner),
    );
    return threads.slice(0, 4).map((thread) => ({
      ...thread,
      corner: cornerFor(thread.parentEdge) ?? free.shift() ?? "tr",
    }));
  }, [threads]);

  // The number is the board's own live thread count, never a fixed target:
  // winning is resolving every thread there is, however many a game happens
  // to have (Steve, 2026-09-01). A board with two threads reads "resolve all
  // 2 threads", and the engine now ends that game when both are resolved: the
  // old floor of four is gone, so this card and the rules agree.
  const target = threads.length;

  return (
    <div className="border-gray/30 bg-offwhite w-full rounded-2xl border p-4 shadow-md select-none">
      <h4 className="text-gold mb-3 text-center text-[11px] font-extrabold tracking-[0.13em] uppercase">
        Ways to win
      </h4>

      <div className="flex items-start gap-2 pl-2">
        <span className="text-neutral-black bg-offwhite border-gray/30 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-extrabold">
          1
        </span>
        <span className="text-neutral-black text-p-sm leading-tight font-bold">
          Resolve all
          <br />
          {target === 0 ? "threads" : `${target} threads`}
        </span>
      </div>
      <p className="text-gray mt-1 mb-1 text-center text-xs font-semibold">
        <span className="text-neutral-black font-extrabold">{resolvedCount}</span> of{" "}
        {target} resolved
      </p>

      <div className="relative mx-auto my-1 aspect-square w-[74%]">
        {corners.map((thread) => (
          <button
            key={thread.tileId}
            type="button"
            tabIndex={-1}
            className={`absolute aspect-square w-[32%] cursor-help border-none p-0 transition-transform [clip-path:polygon(29%_0,71%_0,100%_29%,100%_71%,71%_100%,29%_100%,0_71%,0_29%)] hover:scale-110 ${CORNER_POSITION[thread.corner]} ${thread.resolved ? SIDE_FILL[thread.side] : "bg-gray/30"}`}
            aria-label={thread.resolved ? "Thread resolved" : "Thread not yet resolved"}
            onMouseEnter={() =>
              onHover?.({
                tileId: thread.tileId,
                kind: thread.resolved ? "resolved" : "open",
              })
            }
            onMouseLeave={() => onHover?.(null)}
          >
            <span
              className={`bg-offwhite absolute inset-[2px] flex items-center justify-center [clip-path:inherit] ${thread.resolved ? SIDE_FILL[thread.side] : ""}`}
            >
              {thread.token ? <TokenGlyph token={thread.token} size={20} /> : null}
            </span>
          </button>
        ))}
        <button
          type="button"
          className="bg-neutral-black absolute top-[34%] left-[34%] aspect-square w-[32%] cursor-pointer border-none p-0 [clip-path:polygon(29%_0,71%_0,100%_29%,100%_71%,71%_100%,29%_100%,0_71%,0_29%)]"
          aria-label="Revise the topic"
          onMouseEnter={() => onHover?.({ tileId: "0", kind: "topic" })}
          onMouseLeave={() => onHover?.(null)}
          onClick={() => onRevise?.()}
        >
          <span className="bg-neutral-black text-p-sm absolute inset-[2px] flex items-center justify-center text-neutral-white [clip-path:inherit]">
            ✎
          </span>
        </button>
      </div>

      <div className="text-brown mt-1 text-center leading-none font-extrabold">↑</div>
      <div className="mt-1 flex items-center gap-2 pl-2">
        <span className="text-neutral-black bg-offwhite border-gray/30 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-extrabold">
          2
        </span>
        <span className="text-neutral-black text-p-sm font-bold">Revise the topic</span>
      </div>
    </div>
  );
}
