"use client";

import { useSyncExternalStore } from "react";

import { Counter } from "@/components/counter";
import { foldStreaks, localDayKey } from "@/lib/games/streak";

/** The reader's timezone never changes mid-visit, so there is nothing to watch. */
const subscribe = () => () => {};

/**
 * The two streak numbers as one string, `current/longest`.
 *
 * A string and not the `Streaks` object it describes: `useSyncExternalStore`
 * compares snapshots with `Object.is`, so a fresh object on every call would
 * spin forever, while two equal strings are the same snapshot. That also makes
 * the closures below safe to rebuild on every render.
 */
function read(playedAt: string[], timeZone?: string): string {
  const today = localDayKey(new Date().toISOString(), timeZone);
  if (!today) return "0/0";
  const days = playedAt
    .map((iso) => localDayKey(iso, timeZone))
    .filter((day): day is string => day !== null);
  const { current, longest } = foldStreaks(days, today);
  return `${current}/${longest}`;
}

/**
 * Days in a row, counted in the reader's own timezone.
 *
 * A client component for the same reason `LocalDay` is one: the server does not
 * know where the reader is standing, and a streak that breaks because of a
 * timezone is worse than no streak at all. The server renders the UTC reading
 * and the browser corrects it on hydration.
 */
export function StreakCounters({ playedAt }: { playedAt: string[] }) {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => read(playedAt, undefined),
    () => read(playedAt, "UTC"),
  );
  const [current, longest] = snapshot.split("/").map(Number);

  // Nobody who has never played wants to be told their longest streak is zero.
  // The empty history below already says the same thing more kindly.
  if (longest === 0) return null;

  return (
    <>
      <Counter
        label="Current streak"
        value={current}
        unit={current === 1 ? "day" : "days"}
      />
      <Counter
        label="Longest streak"
        value={longest}
        unit={longest === 1 ? "day" : "days"}
      />
    </>
  );
}
