"use client";

/**
 * The tile the coach is pointing at, from the Director to the board.
 *
 * `pointed-slot.ts` (same folder) tells the board which empty slot to draw
 * and frame; this is the same idea for a beat whose anchor is an existing
 * tile rather than an empty one, the "relocate" lesson in level 2 being the
 * first one that needs it: the coach names a tile already on the board and
 * the board has no reason to have panned or zoomed it into view on its own,
 * especially on a resumed game where the last save's camera position has
 * nothing to do with the beat the player is now on. Without this, the
 * coach's speech bubble still finds the tile (`AnchoredCard` measures the DOM
 * directly) and its arrow can end up pointing off the edge of the screen at
 * a tile the player never sees.
 *
 * Same shape and reasons as `pointed-slot.ts`: the Director and the board
 * are siblings on the game page, only the Director knows the current beat,
 * and neither imports the other.
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

export function publishPointedTile(tileId: string | null): void {
  if (tileId === current) return;
  current = tileId;
  for (const listener of listeners) listener();
}

export function clearPointedTile(): void {
  publishPointedTile(null);
}

export function usePointedTile(): string | null {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
