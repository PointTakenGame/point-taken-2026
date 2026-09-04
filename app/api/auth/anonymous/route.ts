import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sessionClient } from "@/lib/supabase/session";
import { ensureDisplayName } from "@/lib/db/players";
import { AGREEMENT_COOKIE } from "@/lib/legal";

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
 *
 * Making the account is also the moment somebody becomes a user of the thing,
 * so it is the moment the agreement has to have happened (Steve, 2026-09-03:
 * nothing is minted or played before the visitor ticks the Terms of Use and
 * Privacy Policy). The check is here rather than only on the page because this
 * is a public endpoint, and a rule enforced by a checkbox is not enforced. It
 * guards the sign-in branch alone: an account that already exists was made
 * under the same rule, and refusing to name it again would strand a player who
 * cleared their cookies mid-game.
 */
export async function POST() {
  const supabase = await sessionClient();

  const existing = await supabase.auth.getUser();
  let userId = existing.data.user?.id;

  if (!userId) {
    const jar = await cookies();
    if (jar.get(AGREEMENT_COOKIE)?.value !== "1") {
      return NextResponse.json(
        {
          error: "Tick the box to agree to the Terms of Use and Privacy Policy first.",
          agreement: true,
        },
        { status: 403 },
      );
    }

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
