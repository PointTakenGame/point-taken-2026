import "server-only";

import { getGame, getGamePlayers } from "@/lib/db/games";
import type { GameRow } from "@/lib/db/types";
import type { Side, Uuid } from "@/lib/events/types";
import { currentPlayerId } from "@/lib/supabase/session";

/**
 * Who is asking, and what they are allowed to be on this board.
 *
 * Every write to a game goes through here first. The actor_role that lands in
 * the event log is read off game_players, never off anything the client sent,
 * so a client cannot write as the other player by editing a form field.
 */

export interface Membership {
  playerId: Uuid;
  role: Side;
  /** Set when they walked away and have not rejoined. Not a delete. */
  leftAt: string | null;
  game: GameRow;
}

export type MembershipDenial =
  /** Nobody is signed in. */
  | "anonymous"
  /** No such game, or one this player has no business seeing. */
  | "not_found"
  /** In the game, but has not picked a side yet, so cannot act on the board. */
  | "no_side";

export type MembershipResult =
  | { ok: true; membership: Membership }
  | { ok: false; denial: MembershipDenial };

/**
 * A non-member gets "not_found", the same answer a nonexistent game gets. That
 * is deliberate (BRAIN-T260822-14): distinguishing the two would let anyone
 * probe which game ids are real.
 */
export async function readMembership(gameId: Uuid): Promise<MembershipResult> {
  const playerId = await currentPlayerId();
  if (!playerId) return { ok: false, denial: "anonymous" };

  const players = await getGamePlayers(gameId);
  const mine = players.find((player) => player.player_id === playerId);
  if (!mine) return { ok: false, denial: "not_found" };

  const game = await getGame(gameId);
  if (!game) return { ok: false, denial: "not_found" };

  if (mine.role === null) return { ok: false, denial: "no_side" };

  return {
    ok: true,
    membership: { playerId, role: mine.role, leftAt: mine.left_at, game },
  };
}

export const MEMBERSHIP_MESSAGES: Record<MembershipDenial, string> = {
  anonymous: "Sign in to play.",
  not_found: "That game is not open to you.",
  no_side: "Pick a side before you play a reason.",
};
