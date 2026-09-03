"use client";

/**
 * The one-time nudge a player gets the first time they answer their own tile.
 *
 * The board alternates by convention, not by rule: one player writes, the
 * other answers. Hanging a reason off your own reason is legal, and sometimes
 * it is exactly right, because a reason can need a second sentence to stand
 * up. What it is not is the point of the game. The retired client refused the
 * move outright; Steve's call on 2026-09-02 is softer, and the reason is that
 * a refusal teaches nothing: say what the move is for, say what the game is
 * for, then get out of the way.
 *
 * So this fires once per match, on the first same-side answer, and never
 * again in that match however many times they do it. It is a notice with one
 * button, not a decision with two: the player already decided by clicking the
 * slot, and taking that back would make the warning a gate.
 */

import { useRef } from "react";
import { useFocusTrap } from "@/components/win/use-focus-trap";

/** One match, one warning. Cleared with the browser, which is fine: the point
 * is not to keep a permanent record, it is to not nag inside a single game. */
export function sameSideNoticeKey(gameId: string) {
  return `pt.same-side-notice.${gameId}`;
}

export function sameSideNoticeSeen(gameId: string): boolean {
  try {
    return window.localStorage.getItem(sameSideNoticeKey(gameId)) === "1";
  } catch {
    // Private windows and blocked site data throw on read. A player who
    // cannot be remembered sees the notice again, which is the harmless
    // direction to fail in.
    return false;
  }
}

export function markSameSideNoticeSeen(gameId: string) {
  try {
    window.localStorage.setItem(sameSideNoticeKey(gameId), "1");
  } catch {
    // See above. Nothing to do about it, and nothing depends on it.
  }
}

export function SameSideNotice({ onDismiss }: { onDismiss: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useFocusTrap(true, panel, onDismiss);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-neutral-black/40 p-6"
      role="presentation"
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="same-side-notice-heading"
        className="bg-offwhite border-gold/60 w-full max-w-[26rem] rounded-2xl border p-6 shadow-2xl"
      >
        <h2
          id="same-side-notice-heading"
          className="font-primary text-h4 text-neutral-black"
        >
          That one is yours.
        </h2>
        <p className="text-p-sm text-gray mt-3 leading-relaxed">
          You can extend your own reasoning, and sometimes a reason does need a second
          line to stand up.
        </p>
        <p className="text-p-sm text-gray mt-2 leading-relaxed">
          Your main goal, though, is to give gentle rebuttals to the other side. That is
          where the argument actually moves.
        </p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            autoFocus
            onClick={onDismiss}
            className="bg-gold text-neutral-white font-primary rounded-full px-6 py-1.5 tracking-wide uppercase shadow-lg"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
