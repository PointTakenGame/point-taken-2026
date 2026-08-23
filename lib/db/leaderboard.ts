import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import type { Uuid } from "@/lib/events/types";

/**
 * A ranking across every player who has played at least one game, by a
 * cooperative-positive metric: games completed, tiles placed, threads
 * resolved, or catching the snitch. Deliberately not head-to-head win/loss,
 * which would fight the cooperative soul of the game.
 *
 * The ranking happens in `supabase/migrations/0006_leaderboard.sql`, not
 * here. Read that migration's header for the attribution rules (shared with
 * `player_stats`) and for why this is one function call rather than a cached
 * table.
 *
 * `leaderboard` is granted to service_role alone, for the opposite reason
 * `player_stats` is: this function is *supposed* to return every ranked
 * player's handle and counts to whoever calls it, which is exactly why it
 * must not be reachable straight from the browser, unpaged and unrate-limited.
 * Keep it behind a route that can cap and paginate.
 */

export type LeaderboardMetric =
  | "games_completed"
  | "tiles_placed"
  | "threads_resolved"
  | "topic_agreed_wins";

/** One ranked player's row. Ties share a rank, so a later row's rank may repeat. */
export interface LeaderboardEntry {
  rank: number;
  player_id: Uuid;
  display_name: string | null;
  /** The value the current sort is ranking by; also broken out below by name. */
  value: number;
  games_completed: number;
  tiles_placed: number;
  threads_resolved: number;
  topic_agreed_wins: number;
}

export interface Leaderboard {
  metric: LeaderboardMetric;
  /** How many players are ranked at all, not just how many are returned. */
  total_ranked: number;
  top: LeaderboardEntry[];
  /** Null when no viewer id was passed, or that player has no ranked row yet. */
  viewer: LeaderboardEntry | null;
  /**
   * Ranked players near the viewer. May overlap `top` when the viewer is
   * already near the front; de-dupe by player_id when rendering both.
   */
  viewer_neighbors: LeaderboardEntry[];
}

export async function getLeaderboard(
  metric: LeaderboardMetric = "games_completed",
  viewerId?: Uuid | null,
  topN = 20,
  radius = 2,
): Promise<Leaderboard> {
  const { data, error } = await serviceClient().rpc("leaderboard", {
    p_metric: metric,
    p_viewer_id: viewerId ?? null,
    p_top_n: topN,
    p_radius: radius,
  });

  if (error) throw new Error(`leaderboard failed: ${error.message}`);
  return data as Leaderboard;
}
