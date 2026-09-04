import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import type { Uuid } from "@/lib/events/types";
import type { PlayerRow } from "./types";
import { generateDisplayName, numericTail } from "@/lib/names/generate";

// Player reads and the one player write. A trigger on auth.users creates the
// row; naming it is the app's job, because the word list is content.

/**
 * The one read failure that is not a failure: a token minted a fraction of a
 * second ahead of the clock that is checking it. Seen on 2026-09-03 on the
 * first load of /account after a dev-server restart, where it took the whole
 * page down to the error screen and a plain reload then worked
 * (`BRAIN-T260903-37`). It is a race, not a state, so the cure is to ask again
 * rather than to tell the player their account did not draw.
 */
const CLOCK_SKEW = /issued at future/i;
const SKEW_RETRY_MS = 300;

function readPlayerRow(playerId: Uuid) {
  return serviceClient().from("players").select("*").eq("id", playerId).maybeSingle();
}

export async function getPlayer(playerId: Uuid): Promise<PlayerRow | null> {
  let { data, error } = await readPlayerRow(playerId);

  if (error && CLOCK_SKEW.test(error.message)) {
    await new Promise((resolve) => setTimeout(resolve, SKEW_RETRY_MS));
    ({ data, error } = await readPlayerRow(playerId));
  }

  if (error) throw new Error(`read player failed: ${error.message}`);
  return (data as PlayerRow) ?? null;
}

/** How many names to try before giving up. The last two carry a numeric tail. */
export const NAME_ATTEMPTS = 6;

const UNIQUE_VIOLATION = "23505";

/**
 * Give a player a name if they have none, and return the row either way.
 * Idempotent: the update only fires while `display_name` is still null, so two
 * concurrent callers cannot overwrite each other and the loser reads the
 * winner's name back.
 */
export async function ensureDisplayName(playerId: Uuid): Promise<PlayerRow> {
  const existing = await getPlayer(playerId);
  if (!existing) throw new Error(`no players row for ${playerId}`);
  if (existing.display_name) return existing;

  for (let attempt = 0; attempt < NAME_ATTEMPTS; attempt += 1) {
    const candidate =
      attempt < NAME_ATTEMPTS - 2
        ? generateDisplayName()
        : `${generateDisplayName()} ${numericTail()}`;

    const { data, error } = await serviceClient()
      .from("players")
      .update({ display_name: candidate })
      .eq("id", playerId)
      .is("display_name", null)
      .select()
      .maybeSingle();

    if (error) {
      // A taken name is an ordinary outcome of 632k names and a redraw.
      if (error.code === UNIQUE_VIOLATION) continue;
      throw new Error(`assign display name failed: ${error.message}`);
    }

    if (data) return data as PlayerRow;

    // No error and no row: someone named this player first. Take theirs.
    const named = await getPlayer(playerId);
    if (named?.display_name) return named;
    throw new Error(`players row for ${playerId} vanished mid-assignment`);
  }

  throw new Error(
    `could not find a free display name for ${playerId} in ${NAME_ATTEMPTS} tries`,
  );
}

/** Set a chosen name. Uniqueness is enforced on lower(display_name). */
export async function setDisplayName(
  playerId: Uuid,
  displayName: string,
): Promise<PlayerRow> {
  const { data, error } = await serviceClient()
    .from("players")
    .update({ display_name: displayName })
    .eq("id", playerId)
    .select()
    .single();

  if (error) throw new Error(`set display name failed: ${error.message}`);
  return data as PlayerRow;
}

/**
 * Turn the coach on or off for this player. It is a preference, not a move: it
 * stays off the event log, and it only ever affects whose reasons get read.
 */
export async function setCoachEnabled(
  playerId: Uuid,
  enabled: boolean,
): Promise<PlayerRow> {
  const { data, error } = await serviceClient()
    .from("players")
    .update({ coach_enabled: enabled })
    .eq("id", playerId)
    .select()
    .single();

  if (error) throw new Error(`set coach_enabled failed: ${error.message}`);
  return data as PlayerRow;
}
