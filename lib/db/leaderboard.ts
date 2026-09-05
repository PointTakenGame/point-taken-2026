import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import type { Uuid } from "@/lib/events/types";
import { getPlayerStats, type PlayerStats } from "./stats";
import type { PlayerRow } from "./types";

/**
 * The board that shows everyone, not just you.
 *
 * `player_stats` answers about one player at a time and there is no SQL
 * function that answers about all of them, so this fans out: one cheap query
 * to find who has played, then one RPC each for the leaders. That is N+1 on
 * purpose. Writing the aggregate in TypeScript instead would mean restating
 * the attribution rules from `0005_player_stats.sql` (acts belong to the
 * actor, outcomes belong to every participant) in a second place, and the
 * header of that migration is explicit that a second copy of this arithmetic
 * is how it goes wrong. When the fan-out is measurably slow, the fix is a
 * `leaderboard()` function beside `player_stats`, which is a core change and
 * goes through Nathan.
 *
 * `LEADERBOARD_SIZE` is what bounds the cost. Everyone is counted for the
 * ranking; only the leaders are asked for full stats.
 */

export const LEADERBOARD_SIZE = 25;

/** What each metric means, in the words the page uses. */
export type LeaderboardMetric = "wins" | "cooperation" | "sustained";

export interface LeaderboardRow {
  playerId: Uuid;
  /** Null when a player has never been named. The page supplies a fallback. */
  displayName: string | null;
  /** Null for a player who has not picked one, which keeps the initials mark. */
  avatarEmoji: string | null;
  gamesPlayed: number;
  /**
   * Games that reached one of the two cooperative win conditions. Not "games
   * completed": a game can end by being abandoned or timing out, and counting
   * those as wins would reward walking away.
   */
  wins: number;
  /**
   * Threads both players agreed on. A thread resolves only when both sides
   * place the same token, so this is the closest thing the log holds to a
   * measure of cooperating rather than of winning.
   */
  cooperation: number;
  /**
   * Tiles placed. Labelled "sustained play" on the page, and explicitly a
   * placeholder: it was chosen over minutes elapsed because elapsed time
   * rewards leaving a tab open, but it still rewards volume over quality.
   */
  sustained: number;
}

/** How the three columns sort, and what the page calls each one. */
export const METRIC_LABELS: Record<LeaderboardMetric, string> = {
  wins: "Wins",
  cooperation: "Threads agreed",
  sustained: "Sustained play",
};

function winsFrom(stats: PlayerStats): number {
  return Object.values(stats.games_by_win_condition).reduce(
    (total, n) => total + (n ?? 0),
    0,
  );
}

/**
 * The scripted opponents. A Gym boss holds a real seat, so he shows up in
 * `game_players` like anyone else, and before `players.kind` existed he was
 * quietly climbing this board by being played against. Cheap query: the
 * partial index in `0013_player_kind.sql` covers exactly this predicate.
 */
async function bossPlayerIds(): Promise<Set<Uuid>> {
  const { data, error } = await serviceClient()
    .from("players")
    .select("id")
    .eq("kind", "boss");

  if (error) throw new Error(`leaderboard boss filter failed: ${error.message}`);

  return new Set(((data ?? []) as { id: Uuid }[]).map((row) => row.id));
}

/**
 * Every player who has been seated in a game, with how many games each has
 * been in. One query, grouped here rather than in SQL because a `group by`
 * through PostgREST needs a view, and a view is a migration. Bosses are
 * dropped here rather than after the slice, so a boss cannot take one of the
 * `LEADERBOARD_SIZE` places away from a person.
 */
async function playerGameCounts(): Promise<Map<Uuid, number>> {
  const [{ data, error }, bosses] = await Promise.all([
    serviceClient().from("game_players").select("player_id"),
    bossPlayerIds(),
  ]);

  if (error) throw new Error(`leaderboard roster failed: ${error.message}`);

  const counts = new Map<Uuid, number>();
  for (const row of (data ?? []) as { player_id: Uuid }[]) {
    if (bosses.has(row.player_id)) continue;
    counts.set(row.player_id, (counts.get(row.player_id) ?? 0) + 1);
  }
  return counts;
}

/**
 * The leaders, already sorted by `metric`. Ties break on games played, so a
 * player who did it in fewer games sits above one who took more, and then on
 * the player id so the order is stable between two identical reads.
 */
export async function readLeaderboard(
  metric: LeaderboardMetric = "wins",
): Promise<LeaderboardRow[]> {
  const counts = await playerGameCounts();
  if (counts.size === 0) return [];

  const candidates = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, LEADERBOARD_SIZE)
    .map(([playerId]) => playerId);

  const identities = await playerIdentities(candidates);

  const rows = await Promise.all(
    candidates.map(async (playerId): Promise<LeaderboardRow> => {
      const stats = await getPlayerStats(playerId);
      return {
        playerId,
        displayName: identities.get(playerId)?.display_name ?? null,
        avatarEmoji: identities.get(playerId)?.avatar_emoji ?? null,
        gamesPlayed: stats.games_played,
        wins: winsFrom(stats),
        cooperation: stats.threads_resolved,
        sustained: stats.tiles_placed,
      };
    }),
  );

  return rows.sort(
    (a, b) =>
      b[metric] - a[metric] ||
      a.gamesPlayed - b.gamesPlayed ||
      a.playerId.localeCompare(b.playerId),
  );
}

type Identity = Pick<PlayerRow, "display_name" | "avatar_emoji">;

/**
 * Names and avatars for the rows on the board.
 *
 * The avatar column arrived with migration 0015 (2026-09-05). Applying that
 * migration to the dev project needs a person to run it (the session that
 * wrote it was not allowed to), so until it is applied the select falls back
 * to names only rather than taking the whole leaderboard down with a
 * "column does not exist" error. Postgres error 42703 is that one condition;
 * anything else still throws. Remove the fallback once 0015 is on every
 * database this code runs against.
 */
async function playerIdentities(ids: Uuid[]): Promise<Map<Uuid, Identity>> {
  const withAvatar = await serviceClient()
    .from("players")
    .select("id, display_name, avatar_emoji")
    .in("id", ids);
  if (!withAvatar.error) {
    return new Map(
      ((withAvatar.data ?? []) as (Identity & { id: Uuid })[]).map((row) => [
        row.id,
        { display_name: row.display_name, avatar_emoji: row.avatar_emoji },
      ]),
    );
  }
  if (withAvatar.error.code !== "42703") {
    throw new Error(`leaderboard names failed: ${withAvatar.error.message}`);
  }
  const namesOnly = await serviceClient()
    .from("players")
    .select("id, display_name")
    .in("id", ids);
  if (namesOnly.error) {
    throw new Error(`leaderboard names failed: ${namesOnly.error.message}`);
  }
  return new Map(
    ((namesOnly.data ?? []) as { id: Uuid; display_name: string | null }[]).map((row) => [
      row.id,
      { display_name: row.display_name, avatar_emoji: null },
    ]),
  );
}
