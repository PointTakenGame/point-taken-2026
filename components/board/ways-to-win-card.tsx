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
 * matching tile on the real board; the pencil is a click target through
 * `onRevise`, and a corner whose thread carries an `onOpen` is a click
 * target too, opening that thread's root tile the way the board's own
 * `ThreadTokenBadge` does (Steve, 2026-09-05 playtest: the icons were inert).
 * A corner without one, or with no thread at all, stays decorative.
 */

export type MiniCorner = "tr" | "br" | "bl" | "tl";

export interface MiniThread {
  tileId: string;
  side: Side;
  /**
   * The board edge this thread's root tile sits on, or null when the caller has
   * no edge geometry to give. Kept on the payload but no longer read: corners
   * come from `corner` now, or from side when the caller has none.
   */
  parentEdge: number | null;
  /**
   * The corner of the topic tile this thread's root actually sits on, read
   * off the board's own layout, or null when the caller cannot say. Steve,
   * 2026-09-04 playtest: level 1's two threads hang off the bottom corners
   * and the stamp was lighting the top two, "which are not even available",
   * because the corners were dealt out by side. A thread with a corner goes
   * there; the rest fall back to the side queue.
   */
  corner?: MiniCorner | null;
  resolved: boolean;
  /** The resolution token that closed this thread, or null while it is still open. */
  token: string | null;
  /**
   * A token one side has put down that the other has not matched yet. `mine`
   * says whose. Drawn faint in the corner so a thread waiting on the viewer's
   * own token looks different from one nobody has moved on; the 2026-09-04
   * playtest stalled on exactly that, a 👍 sitting unmatched with nothing
   * on the stamp saying so.
   */
  pending?: { emoji: string; mine: boolean } | null;
  /**
   * Opens this thread's root tile card, the same way the board's own
   * `ThreadTokenBadge` does. Undefined when there is nothing to open yet (a
   * thread whose root has not landed), in which case the corner draws as a
   * plain span rather than a button that would do nothing on click.
   */
  onOpen?: () => void;
}

type HoverPayload = { tileId: string; kind: "resolved" | "open" | "topic" } | null;

const SIDE_FILL: Record<Side, string> = {
  plus: "bg-green",
  minus: "bg-orange",
};

/**
 * The same two colours at a quarter strength, for a starter with nothing in it
 * yet. An empty slot is a place a thread could go, so it is drawn in the colour
 * of the side that would go there rather than in grey.
 */
const SIDE_FILL_EMPTY: Record<Side, string> = {
  plus: "bg-green/25",
  minus: "bg-orange/25",
};

const SIDE_SIGN: Record<Side, string> = { plus: "+", minus: "\u2212" };

const CORNER_POSITION: Record<"tr" | "br" | "bl" | "tl", string> = {
  tl: "left-[2%] top-[2%]",
  tr: "left-[66%] top-[2%]",
  bl: "left-[2%] top-[66%]",
  br: "left-[66%] top-[66%]",
};

/**
 * The four starter slots, and the side that owns each.
 *
 * Position is side: the two on the right belong to Plus, the two on the left to
 * Minus, which is the convention the board itself now draws around the topic
 * tile (`spatial-board.tsx`, BRAIN-T260902-15). Without it, this stamp was four
 * corners lighting up in whatever order threads happened to start, so it could
 * not be read as a picture of the board it is a picture of.
 *
 * All four are always drawn. They used to appear only once a thread existed, so
 * a fresh board showed an empty square around a TOPIC and gave no hint that four
 * threads were the thing to fill in.
 */
const SLOTS: ReadonlyArray<{ corner: "tr" | "br" | "bl" | "tl"; side: Side }> = [
  { corner: "tr", side: "plus" },
  { corner: "br", side: "plus" },
  { corner: "tl", side: "minus" },
  { corner: "bl", side: "minus" },
];

// Four corners, one per thread, which matches `MAX_THREADS` (lib/board/rules.ts)
// on the tile board. Compact mode's six-thread ceiling will need a wider
// layout here when it ships.
export function WaysToWinCard({
  threads,
  resolvedCount,
  onHover,
  onRevise,
  reviseHint = null,
  ceilingNote = null,
  footer = null,
  showRevise = true,
}: {
  threads: MiniThread[];
  resolvedCount: number;
  onHover?: (payload: HoverPayload) => void;
  onRevise?: () => void;
  /** How to take route 2, in one line. Null when the rules do not currently
   *  allow a topic revision, so the card never explains a door that is shut. */
  reviseHint?: string | null;
  /** Only when the thread cap is close enough to matter. */
  ceilingNote?: string | null;
  /** The cooperative point, last, because it is the thing about this game
   *  that a player arriving from any other game does not expect. */
  footer?: string | null;
  /** BRAIN-T260903-06: false while topic revision is held back from the
   *  game. Route 2 leaves the list and the centre stamp stops being a
   *  button, so the card describes one way to win, not one and a locked
   *  door. Default true keeps the retired client's two-route card. */
  showRevise?: boolean;
}) {
  // Each slot takes the next thread of its own side, so a board with one Plus
  // thread lights the top right and leaves the other three faint.
  //
  // `parentEdge` is not consulted, because the live board has none to give: the
  // projection records no position for a tile, so it passes null for every
  // thread (BRAIN-T260902-02). Side is the one thing always known, and under the
  // position convention side is enough to put a thread on the right half of the
  // stamp. A thread whose own side is already full falls into whatever slot is
  // still free rather than being dropped.
  const slots = useMemo(() => {
    const queue = threads.slice(0, 4);
    const used = new Set<number>();
    // A thread that knows its corner takes it first, so the stamp is a
    // picture of the board rather than of the placement order.
    const byCorner = SLOTS.map((slot) => {
      const at = queue.findIndex(
        (thread, index) => thread.corner === slot.corner && !used.has(index),
      );
      if (at === -1) return { ...slot, thread: null as MiniThread | null };
      used.add(at);
      return { ...slot, thread: queue[at] as MiniThread | null };
    });
    const filled = byCorner.map((slot) => {
      if (slot.thread) return slot;
      const at = queue.findIndex(
        (thread, index) =>
          thread.side === slot.side && !thread.corner && !used.has(index),
      );
      if (at === -1) return slot;
      used.add(at);
      return { ...slot, thread: queue[at] as MiniThread | null };
    });
    const spare = queue.filter((_, index) => !used.has(index));
    return filled.map((slot) =>
      slot.thread ? slot : { ...slot, thread: spare.shift() ?? null },
    );
  }, [threads]);

  // The number is the board's own live thread count, never a fixed target:
  // winning is resolving every thread there is, however many a game happens
  // to have (Steve, 2026-09-01). A board with two threads reads "resolve all
  // 2 threads", and the engine now ends that game when both are resolved: the
  // old floor of four is gone, so this card and the rules agree.
  const target = threads.length;

  return (
    // Rannie's card, not a tooltip: white, generous, left aligned, and headed
    // in the display face at reading size. It spent a while as a centred gold
    // 11px all-caps label, which is the styling this project gives to a
    // section marker inside a panel, and this is not a marker inside anything.
    // It is the one card in the rail that says what the game is for.
    <div
      data-ui="ways-to-win"
      className="border-gray/30 bg-offwhite w-full rounded-2xl border px-5 py-4 shadow-md select-none"
    >
      <h4 className="font-primary text-neutral-black text-p-lg mb-3">Ways to win</h4>

      <div className="flex items-center gap-2">
        <span className="text-neutral-black bg-offwhite border-gray/40 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold">
          1
        </span>
        <span className="text-neutral-black text-p-sm leading-tight">
          {/* "Resolve all 1 threads" is what the obvious version of this line
              says on the board a player sees right after their first tile,
              which is the worst possible moment for the game to read as
              unfinished. One thread gets its own wording rather than a
              bracketed plural. */}
          {target === 0
            ? "Resolve all threads"
            : target === 1
              ? "Resolve the one thread"
              : `Resolve all ${target} threads`}
        </span>
      </div>
      {/* An empty board has no count worth printing. "0 of 0 resolved" reads
          either as a finished game or as a broken counter, and it is the first
          thing a new player sees on the first screen of a real match. Say what
          happens next instead, and start counting once there is something to
          count. */}
      {target === 0 ? (
        <p className="text-gray mt-1 pl-7 text-xs">
          None yet. The first reason you place starts one.
        </p>
      ) : (
        <p className="text-gray mt-1 pl-7 text-xs">
          <span className="text-neutral-black font-bold">{resolvedCount}</span> of{" "}
          {target} resolved
        </p>
      )}

      <div className="relative mx-auto my-1 aspect-square w-[74%]">
        {slots.map(({ corner, side, thread }) => {
          // A slot with a thread in it is drawn as a filled octagon with an
          // offwhite one inset inside, so an open thread reads as an outline
          // in its own side colour and a resolved one fills in. An empty slot
          // is the same shape at a quarter strength, carrying its side's sign.
          const openable = Boolean(thread?.onOpen);
          const className = `absolute aspect-square w-[32%] border-none p-0 transition-transform [clip-path:polygon(29%_0,71%_0,100%_29%,100%_71%,71%_100%,29%_100%,0_71%,0_29%)] ${CORNER_POSITION[corner]} ${
            thread
              ? `${openable ? "cursor-pointer" : "cursor-help"} hover:scale-110 ${SIDE_FILL[side]}`
              : `cursor-default ${SIDE_FILL_EMPTY[side]}`
          }`;
          const label = thread
            ? thread.resolved
              ? "Thread resolved"
              : thread.pending
                ? thread.pending.mine
                  ? "Your token is down on this thread, waiting for theirs"
                  : "Their token is down on this thread, waiting for yours"
                : "Thread not yet resolved"
            : `No thread started yet on this ${side === "plus" ? "Plus" : "Minus"} corner`;
          const onMouseEnter = thread
            ? () =>
                onHover?.({
                  tileId: thread.tileId,
                  kind: thread.resolved ? "resolved" : "open",
                })
            : undefined;
          const onMouseLeave = thread ? () => onHover?.(null) : undefined;
          const content = (
            <span
              className={`bg-offwhite absolute inset-[3px] flex items-center justify-center [clip-path:inherit] ${thread?.resolved ? SIDE_FILL[side] : ""}`}
            >
              {thread ? (
                thread.token ? (
                  <TokenGlyph token={thread.token} size={20} />
                ) : thread.pending ? (
                  // Half there: one side's token, faint, and pulsing when it
                  // is the viewer's move that would close the thread.
                  <span
                    className={`flex items-center justify-center opacity-50 ${
                      thread.pending.mine ? "" : "animate-pulse"
                    }`}
                  >
                    <TokenGlyph token={thread.pending.emoji} size={18} />
                  </span>
                ) : null
              ) : (
                <span
                  className={`font-primary text-base leading-none font-bold ${side === "plus" ? "text-green/70" : "text-orange/70"}`}
                >
                  {SIDE_SIGN[side]}
                </span>
              )}
            </span>
          );
          // A thread with nothing to open yet (its root has not landed) is
          // drawn as a plain span: a button that does nothing on click reads
          // as broken, not as decorative, and this one already looks
          // clickable (`cursor-help`, the hover scale) for a different
          // reason, so the element itself has to say which it is.
          if (thread && !openable) {
            return (
              <span
                key={corner}
                className={className}
                aria-label={label}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
              >
                {content}
              </span>
            );
          }
          return (
            <button
              key={corner}
              type="button"
              tabIndex={openable ? 0 : -1}
              className={className}
              aria-label={label}
              onClick={openable ? thread!.onOpen : undefined}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
            >
              {content}
            </button>
          );
        })}
        <button
          type="button"
          className="bg-neutral-black group/topic absolute top-[34%] left-[34%] aspect-square w-[32%] cursor-pointer border-none p-0 [clip-path:polygon(29%_0,71%_0,100%_29%,100%_71%,71%_100%,29%_100%,0_71%,0_29%)]"
          aria-label={showRevise ? "Revise the topic" : "Topic"}
          onMouseEnter={() => onHover?.({ tileId: "0", kind: "topic" })}
          onMouseLeave={() => onHover?.(null)}
          onClick={showRevise ? () => onRevise?.() : undefined}
        >
          {/* Labelled, not a pencil. Rannie stamps the middle of the stamp
              "TOPIC" the same way the real centre tile is stamped, so the
              minimap is legible as a picture of the board rather than as a
              toolbar with an edit button in it. The pencil still appears,
              on hover, because this is also the way to open the rewrite. */}
          <span className="bg-neutral-black font-primary absolute inset-[3px] flex items-center justify-center text-[9px] tracking-wide text-white [clip-path:inherit]">
            <span className={showRevise ? "group-hover/topic:hidden" : ""}>TOPIC</span>
            {showRevise ? (
              <span className="hidden group-hover/topic:inline">✎</span>
            ) : null}
          </span>
        </button>
      </div>

      {showRevise ? (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-neutral-black bg-offwhite border-gray/40 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold">
            2
          </span>
          <span className="text-neutral-black text-p-sm">Revise the topic</span>
        </div>
      ) : null}
      {showRevise && reviseHint ? (
        <p className="text-gray mt-1 pl-7 text-xs">{reviseHint}</p>
      ) : null}

      {ceilingNote ? <p className="text-gray mt-3 text-xs">{ceilingNote}</p> : null}
      {footer ? (
        <p className="border-gray/20 text-gray mt-3 border-t pt-2 text-xs">{footer}</p>
      ) : null}
    </div>
  );
}
