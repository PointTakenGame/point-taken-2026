"use client";

/**
 * The boss's tile as it is being typed, from the Director to the board.
 *
 * Steve, 2026-09-04: "have Bob's typing be dynamic too." The player's own
 * sample answers are typed into the composer a character at a time
 * (`useTypedSample`, live-board.tsx), and the boss used to answer by
 * appearing whole a second later, which made him read as a lookup rather
 * than a person at the other keyboard. Now the Director works out the
 * boss's line and the slot it will land in, publishes a growing prefix of
 * it here at typing speed, and asks the server for the real move only once
 * the last character is down. The board draws the slot with the prefix in
 * it, on the boss's side, and it is never a control.
 *
 * Same shape and reasons as `sample-answers.ts` and `pointed-slot.ts`: the
 * Director and the board are siblings on the game page, and neither imports
 * the other.
 */

import { useSyncExternalStore } from "react";

import type { Side, TileCorner } from "@/lib/events/types";

export type BossDraft = {
  /** The parent tile's id, or `TOPIC_CELL_ID` for an opening reason. */
  parentId: string;
  corner: TileCorner;
  side: Side;
  /** What has been typed so far. */
  text: string;
};

let current: BossDraft | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): BossDraft | null {
  return current;
}

function serverSnapshot(): BossDraft | null {
  return null;
}

export function publishBossDraft(draft: BossDraft | null): void {
  if (
    draft === current ||
    (draft &&
      current &&
      draft.parentId === current.parentId &&
      draft.corner === current.corner &&
      draft.side === current.side &&
      draft.text === current.text)
  ) {
    return;
  }
  current = draft;
  for (const listener of listeners) listener();
}

export function clearBossDraft(): void {
  publishBossDraft(null);
}

export function useBossDraft(): BossDraft | null {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
