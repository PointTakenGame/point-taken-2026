import Link from "next/link";
import { currentPlayerId } from "@/lib/supabase/session";
import { readLeaderboard, type LeaderboardMetric } from "@/lib/db/leaderboard";
import { AccountHeading, AccountShell } from "@/components/account/account-shell";
import {
  LEADERBOARD_METRICS,
  LeaderboardBoard,
} from "@/components/account/leaderboard-board";

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
 *
 * Lives inside the four-tab account hub as of 2026-09-04 (Steve): the Gym and
 * the Leaderboard are not tabs of their own, so this renders under the
 * Profile tab and offers a small link back to it instead of a second nav bar.
 */

export const dynamic = "force-dynamic";

function readMetric(raw: string | string[] | undefined): LeaderboardMetric {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return LEADERBOARD_METRICS.includes(value as LeaderboardMetric)
    ? (value as LeaderboardMetric)
    : "wins";
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

  return (
    <AccountShell tab="profile">
      <Link
        href="/"
        className="font-label text-ink-soft hover:text-ink mb-4 inline-block text-xs font-bold tracking-widest uppercase transition-colors"
      >
        &larr; Profile
      </Link>

      <AccountHeading title="Leaderboard">
        Both ways to win this game are cooperative, so none of these columns measures
        beating anybody.
      </AccountHeading>

      <div className="pb-8">
        <LeaderboardBoard metric={metric} playerId={playerId} rows={rows} />
      </div>
    </AccountShell>
  );
}
