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
  /**
   * True means the script owns every word on this board, not the player.
   * The draft opens read-only (Place or cancel, no typing) and a reason
   * already on the board offers neither edit nor remove.
   *
   * Steve, 2026-09-07: a level teaches one rule against a board whose next
   * move is known, and Stick to the Root has nothing left to be about if the
   * player rewrites the root, or takes it off the board. Both doors close
   * together for the same reason.
   */
  lockedText: boolean;
  /**
   * The one tile the current beat asks the player to rewrite, exempt from
   * `lockedText` for as long as that beat is up. Level 3's third rung is the
   * player pulling back their own oversized claim, which cannot happen on a
   * board where every tile is read-only, and the tile-level exemption is what
   * keeps the rest of the board the script's.
   */
  editableTileId: string | null;
};

const NONE: CookedPlacement = Object.freeze({
  onlySlot: null,
  ownReplies: true,
  ghosts: true,
  lockedText: false,
  editableTileId: null,
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
      next.lockedText === current.lockedText &&
      next.editableTileId === current.editableTileId)
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
