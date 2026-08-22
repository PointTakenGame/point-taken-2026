import { NextResponse } from "next/server";
import { sessionClient } from "@/lib/supabase/session";
import { ensureDisplayName } from "@/lib/db/players";

/**
 * Start playing without an account.
 *
 * Anonymous sign-in is a real auth user, so the trigger on `auth.users` makes
 * the `players` row and everything downstream (events, membership, stats) works
 * unchanged. Attaching an email later claims the same account rather than
 * making a second one, which is why the game never asks for one up front.
 *
 * Naming happens here rather than at first join, because `player_joined`
 * requires a display name and a lobby is a bad place to discover that.
 */
export async function POST() {
  const supabase = await sessionClient();

  const existing = await supabase.auth.getUser();
  let userId = existing.data.user?.id;

  if (!userId) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      return NextResponse.json(
        { error: `anonymous sign-in failed: ${error.message}` },
        { status: 502 },
      );
    }
    userId = data.user?.id;
  }

  if (!userId) {
    return NextResponse.json({ error: "no session after sign-in" }, { status: 502 });
  }

  const player = await ensureDisplayName(userId);
  return NextResponse.json({
    player_id: player.id,
    display_name: player.display_name,
  });
}
