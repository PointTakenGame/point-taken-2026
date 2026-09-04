/**
 * The identity and read-model tables, in TypeScript.
 *
 * The database is the authority: `supabase/migrations/0004_identity_and_games.sql`
 * defines these shapes and enforces every constraint named in the comments below.
 * Prose half: docs/reference/materials/spec/2026-08-22_identity-and-read-models.md.
 *
 * `games` and `game_players` are read models projected from the event log by a
 * trigger. Nothing in the app writes them, so these types are read-shaped: there
 * is no Insert or Update variant, on purpose.
 */

import type { Side, Uuid } from "@/lib/events/types";

/** Exactly two modes. `level_id` and `boss_id` belong to gym, `join_code` to live. */
export type GameMode = "gym" | "live";

export type GameStatus = "lobby" | "active" | "ended";

export type WinCondition = "threads_resolved" | "topic_agreed" | "abandoned" | "timeout";

/**
 * What is behind a player row. A Gym boss holds a real seat and there is
 * nobody there: he is a script. Every player-facing roster filters on this,
 * and `boss` rows are still named as your opponent in your own history,
 * because that is who you played (0013_player_kind.sql).
 */
export type PlayerKind = "human" | "boss";

/**
 * One row per authenticated account, created by a trigger on auth.users so the
 * anonymous path cannot forget to. `display_name` is null until the rules
 * package assigns one; `claimed_at` is null while the account is still
 * anonymous. No points or badge totals live here: those derive from the log.
 */
export interface PlayerRow {
  id: Uuid;
  display_name: string | null;
  claimed_at: string | null;
  created_at: string;
  /** Player has asked the coach to read their reasons. Off by default. */
  coach_enabled: boolean;
  kind: PlayerKind;
}

export interface GameRow {
  id: Uuid;
  mode: GameMode;
  level_id: string | null;
  boss_id: string | null;
  join_code: string | null;
  status: GameStatus;
  created_by: Uuid | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  win_condition: WinCondition | null;
}

/** `left_at` is a stamp, not a delete: a rejoin clears it on the same row. */
export interface GamePlayerRow {
  game_id: Uuid;
  player_id: Uuid;
  role: Side | null;
  joined_at: string;
  left_at: string | null;
}
