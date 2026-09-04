import "server-only";
import { createHash } from "node:crypto";

import { getPlayer } from "@/lib/db/players";
import type { Uuid } from "@/lib/events/types";
import { serviceClient } from "@/lib/supabase/server";

/**
 * A Gym boss is a real player row, because the read model insists on it:
 * `player_joined` carries an actor_id with a foreign key to auth.users, and
 * the trigger that maintains game_players refuses a seat without one
 * (supabase/migrations/0004, the game_events trigger). So each boss gets one
 * auth user, created once through the admin API with a deterministic id, and
 * every level that boss appears in seats that same user. Nobody can sign in
 * as a boss: there is no password and the address is not deliverable.
 *
 * `players.kind` says what he is (0013_player_kind.sql), which is what every
 * player-facing roster filters on. The auth user is still here: dropping it
 * would mean changing what `public.players.id` references, and that column is
 * the identity spine of every RLS policy in 0004 and 0009. Steve's 2026-09-03
 * ruling allowed the auth user to stay if that turned out to be the case.
 */

const UNIQUE_VIOLATION = "23505";

/** Stable per boss: the same boss id always maps to the same auth user. */
export function bossPlayerId(bossId: string): Uuid {
  const tail = createHash("sha1").update(`gym-boss:${bossId}`).digest("hex").slice(0, 12);
  return `b055b055-0000-4000-8000-${tail}`;
}

function bossEmail(bossId: string): string {
  return `${bossId}@gym-boss.invalid`;
}

/**
 * Make sure the boss's auth user and players row exist and carry the name.
 * Idempotent: an existing user is left alone, a taken display name falls
 * back to a suffixed one rather than failing the level start.
 */
export async function ensureBossAccount(
  bossId: string,
  displayName: string,
): Promise<Uuid> {
  const id = bossPlayerId(bossId);
  const db = serviceClient();

  let row = await getPlayer(id);
  if (!row) {
    const { error } = await db.auth.admin.createUser({
      id,
      email: bossEmail(bossId),
      email_confirm: true,
      user_metadata: { gym_boss: bossId },
    });
    // Another level start won the race: the row will be there on re-read.
    if (error && !/already|exists|duplicate/i.test(error.message)) {
      throw new Error(`create boss user failed: ${error.message}`);
    }
    row = await getPlayer(id);
    if (!row) throw new Error(`boss ${bossId} has no players row after createUser`);
  }

  // The trigger that made the row defaults everyone to human, so say what he
  // is here rather than relying on the metadata backfill in 0013, which only
  // ever ran once. Cheap, idempotent, and the thing every roster filters on.
  if (row.kind !== "boss") {
    const { error } = await db.from("players").update({ kind: "boss" }).eq("id", id);
    if (error) throw new Error(`mark boss ${bossId} failed: ${error.message}`);
  }

  if (row.display_name === displayName) return id;

  for (const candidate of [displayName, `${displayName} (Gym)`]) {
    const { error } = await db
      .from("players")
      .update({ display_name: candidate })
      .eq("id", id);
    if (!error) return id;
    if (error.code !== UNIQUE_VIOLATION) {
      throw new Error(`name boss ${bossId} failed: ${error.message}`);
    }
  }
  // Both names taken: the boss keeps whatever it was called. The script
  // names him in the coach bubble regardless.
  return id;
}
