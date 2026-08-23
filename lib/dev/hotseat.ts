import "server-only";
import { cookies } from "next/headers";

import type { Uuid } from "@/lib/events/types";

/**
 * Local sandbox bypass, see docs/filed/SANDBOX.md.
 *
 * One browser drives both sides. A live game needs two people and the gym does
 * not exist yet (BRAIN-T260823-28), so without this the only way to exercise
 * the board is a normal window plus a private window, which is miserable when
 * the thing you are testing is the twentieth event type of a long game.
 *
 * The switch is an override of who `currentPlayerId()` says you are. That is
 * the single door every read and every write already goes through, so nothing
 * downstream needs a dev branch: `readSeat` still refuses a player who is not
 * seated, and `actor_role` still comes off `game_players` rather than off
 * anything the client sent.
 *
 * Guarded exactly like the autologin in proxy.ts, and for the same reason:
 * `next build` sets NODE_ENV=production, so a deploy cannot carry this even if
 * someone sets the env var on the host.
 */

export const HOTSEAT_COOKIE = "pt_dev_hotseat";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function hotseatAllowed(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.PT_DEV_AUTOLOGIN === "1";
}

/** Who the dev bar says you are, or null to fall through to the real session. */
export async function hotseatPlayerId(): Promise<Uuid | null> {
  if (!hotseatAllowed()) return null;
  const value = (await cookies()).get(HOTSEAT_COOKIE)?.value ?? "";
  return UUID.test(value) ? (value as Uuid) : null;
}
