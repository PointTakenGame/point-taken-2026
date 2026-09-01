import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import type { HotseatPlayer } from "@/components/dev/hotseat-bar";

/**
 * The invented players, so the hot seat can become one of them.
 *
 * `scripts/seed-demo-history.ts` fills a dev database with about twenty
 * fictional players and weeks of finished games, which is what makes the
 * profile and the leaderboard look inhabited. But none of that history belongs
 * to whoever opens the browser: a fresh visitor gets a new anonymous account
 * with nothing in it, sees a leaderboard of twenty strangers, and an account
 * page with one game on it. The invented history is there and unreachable,
 * which is the opposite of the point.
 *
 * So the hot-seat bar on the front door lists them. Click one and you are
 * them, with their games, their counters and their place on the board.
 *
 * Finding them relies on the seed script's marker convention: every row it
 * creates gets a deterministic id under the `5eed0000` prefix. PostgREST has
 * no LIKE for a uuid column, so the prefix is matched as a range, which is the
 * same trick the seed script uses on itself.
 *
 * Local dev only, by construction: every caller is already behind
 * `hotseatAllowed()`, which is false in production and false without
 * PT_DEV_AUTOLOGIN.
 */

const MARKER_LO = "5eed0000-0000-0000-0000-000000000000";
const MARKER_HI = "5eed0001-0000-0000-0000-000000000000";

/**
 * How many to offer. The bar is one row across the bottom of the screen and
 * stops being usable long before twenty buttons, so this is the handful most
 * likely to be worth becoming, ordered by name for a stable list.
 */
export const DEMO_PLAYERS_SHOWN = 8;

export async function listDemoPlayers(): Promise<HotseatPlayer[]> {
  const { data, error } = await serviceClient()
    .from("players")
    .select("id, display_name")
    .gte("id", MARKER_LO)
    .lt("id", MARKER_HI)
    .order("display_name")
    .limit(DEMO_PLAYERS_SHOWN);

  // A dev-only convenience must never be the reason the front door 500s. An
  // unseeded database is the ordinary case, not an error.
  if (error) return [];

  return ((data ?? []) as { id: string; display_name: string | null }[]).map((row) => ({
    id: row.id as HotseatPlayer["id"],
    displayName: row.display_name,
    role: null,
  }));
}
