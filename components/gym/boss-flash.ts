"use client";

/**
 * The boss's just-landed tile, flagged for the same brief highlight the
 * player's own throw gets (`flashTileId` in live-board.tsx). Published from
 * the Director once `bossAct` reports success, by the slot the tile landed
 * in rather than by tile id: the server generates that id, and it never
 * comes back to the Director (`bossAct`'s `ActionResult` is a plain ok/error
 * flag). `plan.parentId` + `plan.corner` is the same slot the Director
 * already used to draft the tile, and it is unique for one boss move.
 *
 * BRAIN-T260905-27: a tester replayed a card after the boss's auto-played
 * tile appeared, unsure it had actually landed. `flashTileId` already covers
 * a player's own throw; this is the same fix for the boss's move.
 *
 * Same siblings-on-the-page shape as `boss-draft.ts`.
 */

import { useSyncExternalStore } from "react";

import type { TileCorner } from "@/lib/events/types";

export type BossFlash = { parentId: string; corner: TileCorner };

let current: BossFlash | null = null;
let clearTimer = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): BossFlash | null {
  return current;
}

function serverSnapshot(): BossFlash | null {
  return null;
}

function notify(): void {
  for (const listener of listeners) listener();
}

// Two beats of 0.7s in globals.css, plus a little air. Same duration as
// `flashTileId`'s own timer in live-board.tsx.
const FLASH_MS = 1600;

/**
 * Self-clearing: nothing downstream is guaranteed to call `clearBossFlash`
 * for a boss move the way `bossAct`'s failure path calls `clearBossDraft`.
 */
export function publishBossFlash(flash: BossFlash): void {
  window.clearTimeout(clearTimer);
  current = flash;
  notify();
  clearTimer = window.setTimeout(() => {
    current = null;
    notify();
  }, FLASH_MS);
}

export function clearBossFlash(): void {
  window.clearTimeout(clearTimer);
  if (current === null) return;
  current = null;
  notify();
}

export function useBossFlash(): BossFlash | null {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
