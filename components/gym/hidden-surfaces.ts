"use client";

/**
 * Board chrome the level is still holding back, from the Director to the
 * board.
 *
 * Steve, 2026-09-05: level 1 starts with the ways-to-win card and the
 * rule-card tray both off screen, so a first-time player is not shown two
 * pieces of furniture nobody has explained yet. Each one appears the moment
 * the pause beat that explains it becomes current (`Level.hiddenSurfaces`,
 * `Beat.reveal` in lib/gym/script.ts), and stays visible for the rest of the
 * level, because `levelProgress`'s beat index only moves forward.
 *
 * Same shape and reasons as `sample-answers.ts`: the Director and the board
 * are siblings on the game page, only the Director knows the level script,
 * and neither imports the other.
 */

import { useSyncExternalStore } from "react";

import type { BoardSurface } from "@/lib/gym/script";

const NONE: readonly BoardSurface[] = Object.freeze([]);

let current: readonly BoardSurface[] = NONE;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): readonly BoardSurface[] {
  return current;
}

function serverSnapshot(): readonly BoardSurface[] {
  return NONE;
}

/**
 * The surfaces still hidden right now, not the ones the level ever hides:
 * the Director works out what has been revealed so far and publishes only
 * what is left. An unchanged list is a no-op, same as `sample-answers.ts`.
 */
export function publishHiddenSurfaces(surfaces: readonly BoardSurface[]): void {
  const next = surfaces.length === 0 ? NONE : surfaces;
  if (next === current) return;
  if (
    next.length === current.length &&
    next.every((surface) => current.includes(surface))
  ) {
    return;
  }
  current = next;
  for (const listener of listeners) listener();
}

/** Clears the offer. The Director calls this as it unmounts. */
export function clearHiddenSurfaces(): void {
  publishHiddenSurfaces(NONE);
}

export function useHiddenSurfaces(): readonly BoardSurface[] {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
