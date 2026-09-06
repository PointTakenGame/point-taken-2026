"use client";

/**
 * The slot the coach is pointing at, from the Director to the board.
 *
 * Reply slots are drawn only while the cursor is over their parent tile, so a
 * coach bubble that says "click here" and points at a reply slot would point
 * at nothing until the player happened to hover the right tile (Steve,
 * 2026-09-04: the placement hint must be spatial, an arrow at the spot). The
 * Director publishes the slot its current beat anchors, the board draws that
 * one slot permanently, and the arrow has something to land on.
 *
 * Same shape and reasons as `sample-answers.ts`: the Director and the board
 * are siblings on the game page, only the Director knows the current beat,
 * and neither imports the other.
 */

import { useSyncExternalStore } from "react";

import type { TileCorner } from "@/lib/events/types";

export type PointedSlot = {
  /** The parent tile's id, or `TOPIC_CELL_ID` for an opening reason. */
  parentId: string;
  corner: TileCorner;
};

let current: PointedSlot | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): PointedSlot | null {
  return current;
}

function serverSnapshot(): PointedSlot | null {
  return null;
}

export function publishPointedSlot(slot: PointedSlot | null): void {
  if (
    slot === current ||
    (slot &&
      current &&
      slot.parentId === current.parentId &&
      slot.corner === current.corner)
  ) {
    return;
  }
  current = slot;
  for (const listener of listeners) listener();
}

export function clearPointedSlot(): void {
  publishPointedSlot(null);
}

export function usePointedSlot(): PointedSlot | null {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
