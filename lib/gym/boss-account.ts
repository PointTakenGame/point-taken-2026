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
 * This is the first of the blockers Steve asked to have named
 * (BRAIN-T260903-09): the schema has no notion of a non-human seat, so the
 * boss is a human-shaped row with a robot behind it. A `players.kind` column
 * would be the honest fix and is a core change.
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
