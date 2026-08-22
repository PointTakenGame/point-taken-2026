import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import type { Uuid } from "@/lib/events/types";
import type { GameMode, GamePlayerRow, GameRow } from "./types";

/**
 * Creating a game is the one place the app writes a row before its event.
 * The log carries a foreign key to `games`, so the row has to exist first;
 * `create_game` inserts it and appends `game_created` at seq 1 in the same
 * transaction, which is why this goes through the RPC and never through a
 * plain insert. Everything after creation is an appended event.
 */

export interface CreateGameInput {
  mode: GameMode;
  createdBy: Uuid;
  levelId?: string | null;
  bossId?: string | null;
  joinCode?: string | null;
  clientBuild?: string | null;
}

export async function createGame(input: CreateGameInput): Promise<GameRow> {
  if (input.mode === "gym" && input.joinCode) {
    throw new Error("A gym run has nobody to invite, so it takes no join code.");
  }

  const { data, error } = await serviceClient().rpc("create_game", {
    p_mode: input.mode,
    p_created_by: input.createdBy,
    p_level_id: input.levelId ?? null,
    p_boss_id: input.bossId ?? null,
    p_join_code: input.joinCode ?? null,
    p_client_build: input.clientBuild ?? null,
  });

  if (error) throw new Error(`create_game failed: ${error.message}`);
  return data as GameRow;
}

export async function getGame(gameId: Uuid): Promise<GameRow | null> {
  const { data, error } = await serviceClient()
    .from("games")
    .select("*")
    .eq("id", gameId)
    .maybeSingle();

  if (error) throw new Error(`read game failed: ${error.message}`);
  return (data as GameRow) ?? null;
}

/**
 * Look up an open lobby by its code. Join codes are unique only among games
 * that have not ended, so this must not be used to find historical games.
 */
export async function findOpenGameByJoinCode(
  joinCode: string,
): Promise<GameRow | null> {
  const { data, error } = await serviceClient()
    .from("games")
    .select("*")
    .eq("join_code", joinCode.toUpperCase())
    .neq("status", "ended")
    .maybeSingle();

  if (error) throw new Error(`join-code lookup failed: ${error.message}`);
  return (data as GameRow) ?? null;
}

export async function getGamePlayers(gameId: Uuid): Promise<GamePlayerRow[]> {
  const { data, error } = await serviceClient()
    .from("game_players")
    .select("*")
    .eq("game_id", gameId)
    .order("joined_at", { ascending: true });

  if (error) throw new Error(`read members failed: ${error.message}`);
  return (data ?? []) as GamePlayerRow[];
}

// Player reads and the display-name write live in ./players.ts.

/** A player's own games, newest first. The history a dashboard reads. */
export async function listGamesForPlayer(
  playerId: Uuid,
  limit = 50,
): Promise<GameRow[]> {
  const { data, error } = await serviceClient()
    .from("game_players")
    .select("games(*)")
    .eq("player_id", playerId)
    .order("joined_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`read player games failed: ${error.message}`);
  return ((data ?? []) as unknown as { games: GameRow }[])
    .map((row) => row.games)
    .filter(Boolean);
}
