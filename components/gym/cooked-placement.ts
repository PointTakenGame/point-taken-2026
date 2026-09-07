"use client";

/**
 * How tightly the current beat wants placement narrowed, from the Director
 * to the board.
 *
 * Steve, 2026-09-05: level 1 is "fully cooked", meaning the player is never
 * given a choice a script has not already made for them. Another Gym level
 * keeps the hover ghosts and the replies under its own tiles, but its draft
 * is locked too (Steve, 2026-09-07): every scripted level needs the tile it
 * placed to say what the script thinks it says.
 * `NONE`, fully unrestricted, is what a board with no Director mounted sees,
 * which means every live game.
 *
 * Same shape and reasons as `sample-answers.ts`: the Director and the board
 * are siblings on the game page, only the Director knows whether the level
 * is cooked, and neither imports the other.
 */

import { useSyncExternalStore } from "react";

import type { PointedSlot } from "@/components/gym/pointed-slot";

export type CookedPlacement = {
  /** The one slot allowed, or null for no restriction (or nothing to offer). */
  onlySlot: PointedSlot | null;
  /** False hides every "add a tile" affordance on the player's own tiles. */
  ownReplies: boolean;
  /** False draws no hover ghosts and no unpointed root diagonals. */
  ghosts: boolean;
  /** True opens the draft read-only: Place or cancel, no typing. */
  lockedText: boolean;
};

const NONE: CookedPlacement = Object.freeze({
  onlySlot: null,
  ownReplies: true,
  ghosts: true,
  lockedText: false,
});

let current: CookedPlacement = NONE;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): CookedPlacement {
  return current;
}

function serverSnapshot(): CookedPlacement {
  return NONE;
}

function sameSlot(a: PointedSlot | null, b: PointedSlot | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.parentId === b.parentId && a.corner === b.corner;
}

export function publishCookedPlacement(next: CookedPlacement): void {
  if (
    next === current ||
    (sameSlot(next.onlySlot, current.onlySlot) &&
      next.ownReplies === current.ownReplies &&
      next.ghosts === current.ghosts &&
      next.lockedText === current.lockedText)
  ) {
    return;
  }
  current = next;
  for (const listener of listeners) listener();
}

/** Back to unrestricted. The Director calls this as it unmounts. */
export function clearCookedPlacement(): void {
  publishCookedPlacement(NONE);
}

export function useCookedPlacement(): CookedPlacement {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
