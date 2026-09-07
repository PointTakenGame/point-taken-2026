import { useSyncExternalStore } from "react";

import type { Side } from "@/lib/events/types";

/**
 * Who on the board is currently thinking, typing, or saying something, so it
 * can be drawn next to them instead of next to the coach.
 *
 * Steve, 2026-09-07: "the Bashful Bob is thinking notification appears under
 * the coach instead of near Bashful Bob. Bashful Bob should have some area
 * above him where his thoughts are available." The gym's boss beats used to
 * put "Bashful Bob is typing..." in the coach's own speech bubble at the top
 * centre of the screen, which is the coach reporting on somebody else rather
 * than that person visibly doing it. The seat badge draws it now, in the space
 * reserved on the inward side of each face (`SeatBadge`, live-board.tsx).
 *
 * A module store rather than a prop, for the same reason `CookedPlacement` is
 * one: the Director is a sibling overlay, not an ancestor of the board, so
 * there is no component that could hand this down. Both read through
 * `useSyncExternalStore`, so a write here re-renders only what subscribes.
 *
 * A live game never writes to it. Two people at two keyboards have no shared
 * signal to publish yet; when they do (a real "they are typing" over the
 * socket) it writes here and the seat draws it with no further work.
 */
export type SeatSpeech = {
  /** Which seat is speaking. The badge on that side picks it up. */
  side: Side;
  /** `typing` when words are actually landing, `thinking` for the pause before. */
  state: "thinking" | "typing";
};

let current: SeatSpeech | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Publishes what a seat is doing, or clears it with `null`. Idempotent: the
 *  same value twice does not re-render anybody. */
export function setSeatSpeech(next: SeatSpeech | null) {
  if (current === next) return;
  if (current && next && current.side === next.side && current.state === next.state) {
    return;
  }
  current = next;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot() {
  return current;
}

/** The server render has nobody speaking, which is also the first client
 *  frame, so the two agree and React does not warn. */
function serverSnapshot(): SeatSpeech | null {
  return null;
}

/** What this side is doing right now, or null. */
export function useSeatSpeech(side: Side): SeatSpeech["state"] | null {
  const speech = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return speech && speech.side === side ? speech.state : null;
}
