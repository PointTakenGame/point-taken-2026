"use client";

/**
 * The coach's sample answers, from the Director to the board.
 *
 * Steve moved these onto the board on 2026-09-03. They used to be chips in
 * the coach card at the top of the screen, and clicking one placed the tile
 * outright: the player never chose where it went and never saw the words in
 * a box they could change. Now the coach says "click one of the two tile
 * spots and I'll write you a sample answer", the open slots carry the sample
 * text as a ghost, and clicking one opens the composer already filled in. The
 * player edits it, or sends it as it stands, or types over it. Either way the
 * reason is placed by their own hand at a place they picked.
 *
 * Why a module and not a prop: `GymDirector` and `LiveBoard` are siblings on
 * `app/game/[gameId]/page.tsx`, not parent and child, and only the Director
 * knows which beat is current, because the pause dismissals that decide it
 * live in that component's own local storage. Lifting the whole Director into
 * the board to pass one array of strings would put the level script inside
 * the live-play board, which has no level. So the Director publishes, the
 * board subscribes, and neither one imports the other.
 *
 * Client only, and a no-op on the server: the store starts empty and the
 * server snapshot is that same frozen empty array, so a board rendered on the
 * server draws plain slots and the samples appear when the Director mounts.
 */

import { useSyncExternalStore } from "react";

const NONE: readonly string[] = Object.freeze([]);

let current: readonly string[] = NONE;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): readonly string[] {
  return current;
}

function serverSnapshot(): readonly string[] {
  return NONE;
}

/**
 * What the coach is offering to write, in the order the slots should carry
 * it. Publishing the same list twice is free: the identity check below keeps
 * an unchanged beat from waking every subscriber on each render.
 */
export function publishSampleAnswers(texts: readonly string[]): void {
  const next = texts.length === 0 ? NONE : texts;
  if (next === current) return;
  if (
    next.length === current.length &&
    next.every((text, index) => text === current[index])
  ) {
    return;
  }
  current = next;
  for (const listener of listeners) listener();
}

/** Clears the offer. The Director calls this as it unmounts. */
export function clearSampleAnswers(): void {
  publishSampleAnswers(NONE);
}

export function useSampleAnswers(): readonly string[] {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
