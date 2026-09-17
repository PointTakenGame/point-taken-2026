"use client";

/**
 * A dark dialogue panel: a coach icon anchored to the left, vertically
 * centered against whatever line of text is currently showing, one line at
 * a time. New, purpose-built for the landing tutorial.
 *
 * The Gym's own coach dialogue (components/gym/director.tsx, PauseBubble /
 * LineBubble) is a different shape entirely: a light speech bubble anchored
 * to a point on a live board, portaled and re-measured every frame against
 * board tiles. There is no board here, so this is a plain in-flow panel
 * instead, not an adaptation of that one.
 *
 * Reset between cards by the caller passing a new `key`, the ordinary React
 * way to drop a component's internal state rather than syncing it with an
 * effect: see the sibling components in this folder for the same pattern.
 */

import { useState } from "react";

export function NarratorPanel({
  lines,
  onDone,
  doneLabel = "Continue",
}: {
  lines: readonly string[];
  /** Called once, after the last line's Continue is pressed. */
  onDone: () => void;
  doneLabel?: string;
}) {
  const [index, setIndex] = useState(0);
  const isLast = index === lines.length - 1;

  return (
    <div className="bg-neutral-black flex min-h-[200px] items-center gap-4 rounded-2xl p-6 sm:p-7">
      <span aria-hidden="true" className="shrink-0 text-4xl leading-none">
        🧘
      </span>
      <div className="flex flex-1 flex-col gap-4">
        <p
          aria-live="polite"
          className="font-secondary text-offwhite text-p-md leading-snug"
        >
          {lines[index]}
        </p>
        <button
          type="button"
          className="form-base btn-primary bg-green border-green text-neutral-black self-start"
          onClick={() => (isLast ? onDone() : setIndex((current) => current + 1))}
        >
          {isLast ? doneLabel : "Next"}
        </button>
      </div>
    </div>
  );
}
