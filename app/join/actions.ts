"use server";

import { revalidatePath } from "next/cache";

import { projectBoard } from "@/lib/board/project";
import { canJoin } from "@/lib/board/setup";
import { createGame, findOpenGameByJoinCode, getGamePlayers } from "@/lib/db/games";
import { ensureDisplayName } from "@/lib/db/players";
import { appendGameEvent, readGameEvents } from "@/lib/events/append";
import { normalizeJoinCode } from "@/lib/games/joinCode";
import { currentPlayerId } from "@/lib/supabase/session";

/**
 * Getting into a room: opening one, and walking into one you were invited to.
 *
 * `signIn` on a refusal means "you have no account yet", which the client
 * fixes by POSTing /api/auth/anonymous and calling again. It is a separate
 * flag rather than an error string because it is the one refusal the client can
 * act on by itself.
 */

export type RoomResult =
  | { ok: true; gameId: string }
  | { ok: false; error: string; signIn?: true };

const NEEDS_NAME: RoomResult = {
  ok: false,
  error: "Start playing first, so you have a name to join with.",
  signIn: true,
};

/** Seats a player. actor_role is `server`: no side exists to name yet. */
async function seat(gameId: string, playerId: string): Promise<void> {
  const player = await ensureDisplayName(playerId);
  await appendGameEvent(gameId, {
    type: "player_joined",
    actorRole: "server",
    source: "human",
    actorId: playerId,
    payload: { display_name: player.display_name ?? "Player" },
  });
}

export async function createRoom(): Promise<RoomResult> {
  const playerId = await currentPlayerId();
  if (!playerId) return NEEDS_NAME;

  const game = await createGame({ mode: "live", createdBy: playerId });
  await seat(game.id, playerId);

  revalidatePath("/account");
  return { ok: true, gameId: game.id };
}

export async function joinRoom(rawCode: string): Promise<RoomResult> {
  const playerId = await currentPlayerId();
  if (!playerId) return NEEDS_NAME;

  const code = normalizeJoinCode(rawCode);
  if (!code) return { ok: false, error: "That is not a room code." };

  const game = await findOpenGameByJoinCode(code);
  if (!game) return { ok: false, error: "No open room has that code." };

  // Already seated: this is a rejoin, and the board is where they belong.
  const seated = await getGamePlayers(game.id);
  if (seated.some((row) => row.player_id === playerId && row.left_at === null)) {
    return { ok: true, gameId: game.id };
  }

  const board = projectBoard(await readGameEvents(game.id));
  const verdict = canJoin(board, playerId);
  if (!verdict.ok) return { ok: false, error: verdict.error };

  await seat(game.id, playerId);

  revalidatePath(`/game/${game.id}`);
  return { ok: true, gameId: game.id };
}
