"use client";

/**
 * Which reason is waiting to be put somewhere else, from the board to the
 * Director.
 *
 * The other stores in this folder run the other way, Director to board:
 * `pointed-slot.ts` and `pointed-tile.ts` say where to point, `sample-answers.ts`
 * what the coach is offering to write. This one is the return leg, and level 2's
 * Move it lesson is the only thing that needs it.
 *
 * Moving a reason is two clicks (BRAIN-T260905-64): Move it on the tile's card
 * arms the board, then the empty spot you click is where the reason goes. The
 * second click writes the move immediately, so between the two clicks nothing
 * has been appended and the board's own log cannot tell the coach which of the
 * two clicks the player is on. Before the no-approval ruling the Director read
 * that phase off a pending relocation proposal, which is exactly the waiting
 * card Steve took out. So the board says it directly: null before Move it is
 * pressed, the tile's id while the board is in pick mode, null again the moment
 * the move lands or the player cancels.
 *
 * Same shape and the same reason as its siblings: the Director and the board
 * are siblings on the game page, and neither imports the other.
 */

import { useSyncExternalStore } from "react";

let current: string | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): string | null {
  return current;
}

function serverSnapshot(): string | null {
  return null;
}

export function publishMovingTile(tileId: string | null): void {
  if (tileId === current) return;
  current = tileId;
  for (const listener of listeners) listener();
}

export function clearMovingTile(): void {
  publishMovingTile(null);
}

export function useMovingTile(): string | null {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
