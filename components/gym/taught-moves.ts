"use client";

/**
 * Which later moves and resolution tokens the level has taught by now, from
 * the Director to the board.
 *
 * Steve, 2026-09-06: a level 1 player was offered "Say it back", "Pin down a
 * word", "move", and the whole resolution picker from the first beat, none of
 * which level 1 ever mentions. `lib/gym/taught.ts` works out what the ladder
 * has actually exercised; this carries the answer across.
 *
 * `null` means nothing is withheld, which is live play, a board with no
 * Director mounted, and a Gym level whose script has run to the end. It is the
 * server snapshot too, so nothing is hidden in the first paint and then
 * revealed: withholding is the client's job, after the Director has read the
 * board.
 *
 * Same shape and reasons as `hidden-surfaces.ts`: the Director and the board
 * are siblings on the game page, only the Director knows the level script, and
 * neither imports the other.
 */

import { useSyncExternalStore } from "react";

import type { TaughtMoves } from "@/lib/gym/taught";

let current: TaughtMoves | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): TaughtMoves | null {
  return current;
}

function serverSnapshot(): TaughtMoves | null {
  return null;
}

function same(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item) => b.includes(item));
}

export function publishTaughtMoves(next: TaughtMoves | null): void {
  if (next === current) return;
  if (
    next !== null &&
    current !== null &&
    same(next.proposals, current.proposals) &&
    same(next.tokens, current.tokens)
  ) {
    return;
  }
  current = next;
  for (const listener of listeners) listener();
}

/** Back to withholding nothing. The Director calls this as it unmounts. */
export function clearTaughtMoves(): void {
  publishTaughtMoves(null);
}

export function useTaughtMoves(): TaughtMoves | null {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
