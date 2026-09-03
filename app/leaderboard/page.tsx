import Link from "next/link";
import { currentPlayerId } from "@/lib/supabase/session";
import {
  METRIC_LABELS,
  readLeaderboard,
  type LeaderboardMetric,
  type LeaderboardRow,
} from "@/lib/db/leaderboard";
import { Avatar } from "@/components/avatar";
import { SiteNav } from "@/components/site-nav";

/**
 * Where everybody stands, which until now was the one screen the game had no
 * way to show.
 *
 * Nobody has designed this. The Figma file was read frame by frame on
 * 2026-08-31 (BRAIN-T260831-78) and holds no ranked list anywhere: the only
 * ranking in it is one line of text on the profile that shows a player their
 * own position and nobody else's. So this is built in the account page's type
 * and colour and is expected to be redrawn (BRAIN-T260831-80).
 *
 * Three columns, from the 2026-08-31 decisions, and it is worth saying what
 * each is honest about. Wins counts games that reached one of the two
 * cooperative win conditions, so walking out of a game is not a win. Threads
 * agreed counts resolutions, which need both players, so it is the closest
 * the log comes to measuring cooperating rather than beating somebody.
 * Sustained play counts tiles placed, and is a placeholder: it beat minutes
 * elapsed because elapsed time rewards leaving a tab open, but it still
 * rewards volume.
 *
 * The board is sorted by whichever column you pick, rather than by a blended
 * score. A single number would have to weigh cooperation against winning, and
 * nobody has decided that trade, so the page declines to imply one.
 */

export const dynamic = "force-dynamic";

const METRICS: LeaderboardMetric[] = ["wins", "cooperation", "sustained"];

/** How a player with no name shows up, matching the account page's wording. */
const UNNAMED_PLAYER = "an unnamed player";

function readMetric(raw: string | string[] | undefined): LeaderboardMetric {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return METRICS.includes(value as LeaderboardMetric)
    ? (value as LeaderboardMetric)
    : "wins";
}

/**
 * The rank number, sharing a place between ties.
 *
 * Two players on the same score are the same rank, and the next one down skips
 * the places they used up. Numbering them 1, 2, 3 regardless would tell one of
 * two identical players that they are behind the other.
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
      {METRICS.map((metric) =>
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

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const metric = readMetric((await searchParams).by);
  const [playerId, rows] = await Promise.all([
    currentPlayerId(),
    readLeaderboard(metric),
  ]);
  const places = ranks(rows, metric);

  return (
    <div className="dot-ground min-h-screen w-full">
      <SiteNav here="leaderboard" />
      <main className="mx-auto flex w-full max-w-[1229px] flex-col gap-6 px-6 pb-16">
        <header className="flex flex-col gap-2 pb-2">
          <h1 className="font-primary text-ink text-5xl tracking-wide uppercase">
            Leaderboard
          </h1>
          <p className="font-secondary text-ink-soft max-w-2xl">
            Both ways to win this game are cooperative, so none of these columns measures
            beating anybody.
          </p>
        </header>

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
                  <Avatar playerId={row.playerId} name={row.displayName} size="sm" />
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
                    {METRICS.map((column) => (
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
      </main>
    </div>
  );
}
