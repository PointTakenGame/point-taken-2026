import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import type { GameEventType, Uuid } from "@/lib/events/types";
import type { GameMode, WinCondition } from "./types";

/**
 * Account-page counters, derived from the event log on every call.
 *
 * The counting happens in `supabase/migrations/0005_player_stats.sql`, not
 * here: one round trip, and the arithmetic sits next to the data. Read that
 * migration's header for why nothing is cached and how credit is assigned.
 * Two rules, in short: acts belong to the actor, because `actor_id` says who
 * placed a tile; outcomes belong to every participant, because a thread
 * resolves only by agreement and a game is cooperative.
 *
 * `player_stats` is granted to service_role alone. It takes a player id as an
 * argument and does not check it against the caller, so exposing it to
 * `authenticated` would let anyone count anyone. Keep it behind a route that
 * has already established whose page this is.
 */

/**
 * The keys the function returns. Counts are always present and start at
 * zero; the maps are always present and start empty; only the two timestamps
 * are nullable, and both are null until the player joins a first game.
 */
export interface PlayerStats {
  player_id: Uuid;
  games_played: number;
  games_completed: number;
  games_by_mode: Partial<Record<GameMode, number>>;
  games_by_win_condition: Partial<Record<WinCondition, number>>;
  /** Catching the snitch: the game ended on an agreed revision of the topic. */
  topic_agreed_wins: number;
  threads_resolved: number;
  /**
   * Keyed by the emoji in the `thread_resolved` payload. Deliberately not a
   * fixed union: the resolution vocabulary lives in the rules package and is
   * still moving, so this counts whatever the log actually holds.
   */
  resolutions_by_emoji: Record<string, number>;
  tiles_placed: number;
  /** Throws this player made, in total and split by which card. */
  cards_thrown: number;
  cards_thrown_by_id: Record<string, number>;
  /** Throws aimed at this player's reasons that they refused rather than
      rewriting. Refusing is a move, not an absence. */
  card_throws_declined: number;
  /**
   * Cards this player's own coach raised about this player's own reasons,
   * counted from `ai_feedback_returned.error_types`. Private by construction:
   * the log tags a reading with the player it was for, and 0008 keeps the other
   * side out of it. Not a fixed union, for the same reason as the emoji map:
   * the card set lives in the rules package and is still moving.
   */
  coach_flags_by_id: Record<string, number>;
  /** Every act this player took, by event type. New counters read a key here. */
  events_by_type: Partial<Record<GameEventType, number>>;
  first_game_at: string | null;
  last_game_at: string | null;
}

export async function getPlayerStats(playerId: Uuid): Promise<PlayerStats> {
  const { data, error } = await serviceClient().rpc("player_stats", {
    p_player_id: playerId,
  });

  if (error) throw new Error(`player_stats failed: ${error.message}`);
  return data as PlayerStats;
}
