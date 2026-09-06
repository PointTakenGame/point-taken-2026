import Link from "next/link";

import type { Uuid } from "@/lib/events/types";
import {
  METRIC_LABELS,
  type LeaderboardMetric,
  type LeaderboardRow,
} from "@/lib/db/leaderboard";
import { Avatar } from "@/components/avatar";

/**
 * The three columns the board can sort by, and the row itself.
 *
 * Pulled out of `app/leaderboard/page.tsx` on 2026-09-05 (BRAIN-T260904-14)
 * so the home page can show the same board a signed-out visitor would see on
 * `/leaderboard`, rather than a second copy of this markup. The page keeps
 * `readMetric` and the `searchParams` parsing, since only a route has a query
 * string to read; everything about rendering the rows lives here.
 */
export const LEADERBOARD_METRICS: LeaderboardMetric[] = [
  "wins",
  "cooperation",
  "sustained",
];

/** How a player with no name shows up, matching the account page's wording. */
const UNNAMED_PLAYER = "an unnamed player";

/**
 * The rank number, sharing a place between ties.
 *
 * Two players on the same score are the same rank, and the next one down
 * skips the places they used up. Numbering them 1, 2, 3 regardless would tell
 * one of two identical players that they are behind the other.
 */
function ranks(rows: LeaderboardRow[], metric: LeaderboardMetric): number[] {
  const out: number[] = [];
  let lastValue: number | null = null;
  let lastRank = 0;
  rows.forEach((row, index) => {
    if (row[metric] !== lastValue) {
      lastRank = index + 1;
      lastValue = row[metric];
    }
    out.push(lastRank);
  });
  return out;
}

function SortLinks({ active }: { active: LeaderboardMetric }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-label text-ink-soft text-[11px] font-bold tracking-widest uppercase">
        Rank by
      </span>
      {LEADERBOARD_METRICS.map((metric) =>
        metric === active ? (
          <span
            key={metric}
            aria-current="true"
            className="font-label border-ink bg-card text-ink rounded-full border-[1.5px] px-4 py-1.5 text-xs font-bold tracking-widest uppercase"
          >
            {METRIC_LABELS[metric]}
          </span>
        ) : (
          <Link
            key={metric}
            href={`/leaderboard?by=${metric}`}
            className="font-label border-ink/30 text-ink-soft hover:border-ink hover:text-ink rounded-full border-[1.5px] px-4 py-1.5 text-xs font-bold tracking-widest uppercase transition-colors"
          >
            {METRIC_LABELS[metric]}
          </Link>
        ),
      )}
    </div>
  );
}

/**
 * The board itself: the sort links plus the ranked list, with no page chrome
 * around it. `playerId` is whoever is looking, or null for a signed-out
 * visitor; either way the rows are the same public data, so nothing here
 * requires a session, and null just means no row gets the "you" badge.
 */
export function LeaderboardBoard({
  metric,
  playerId,
  rows,
}: {
  metric: LeaderboardMetric;
  playerId: Uuid | null;
  rows: LeaderboardRow[];
}) {
  const places = ranks(rows, metric);

  return (
    <div className="flex flex-col gap-6">
      <SortLinks active={metric} />

      {rows.length === 0 ? (
        <p className="font-secondary text-ink-soft">
          Nobody has played a game yet. The first one starts the board.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((row, index) => {
            const you = row.playerId === playerId;
            // A little more weight for the top three, never a different colour
            // or a medal glyph: the rank number already carries the ranking,
            // and both win conditions here are cooperative, so nothing on the
            // row should read as a podium.
            const podium = places[index] <= 3;
            return (
              <li
                key={row.playerId}
                className={
                  you
                    ? "sticker border-stat-warm flex items-center gap-3 p-4"
                    : "sticker flex items-center gap-3 p-4"
                }
              >
                <span
                  className={`font-figure text-ink w-8 shrink-0 text-right font-black tabular-nums ${
                    podium ? "text-2xl" : "text-lg"
                  }`}
                >
                  {places[index]}
                </span>
                <Avatar
                  playerId={row.playerId}
                  name={row.displayName}
                  size="sm"
                  emoji={row.avatarEmoji}
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-2">
                    <span
                      className={`font-figure text-ink font-black tracking-wide uppercase ${
                        row.displayName ? "" : "opacity-60"
                      }`}
                    >
                      {row.displayName ?? UNNAMED_PLAYER}
                    </span>
                    {you ? (
                      <span className="font-label border-stat-warm text-stat-warm rounded-full border-[1.5px] px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase">
                        you
                      </span>
                    ) : null}
                  </span>
                  <span className="font-secondary text-p-sm text-ink-soft">
                    {row.gamesPlayed} game{row.gamesPlayed === 1 ? "" : "s"} played
                  </span>
                </span>
                <span className="ml-auto flex shrink-0 items-baseline gap-4">
                  {LEADERBOARD_METRICS.map((column) => (
                    <span key={column} className="flex w-20 flex-col items-end gap-0.5">
                      <span
                        className={`font-figure text-xl font-black tabular-nums ${
                          column === metric ? "text-ink" : "text-ink-soft"
                        }`}
                      >
                        {row[column]}
                      </span>
                      <span className="font-label text-ink-soft text-[10px] font-bold tracking-widest uppercase">
                        {METRIC_LABELS[column]}
                      </span>
                    </span>
                  ))}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
