import { NextResponse } from "next/server";

import { ensureDisplayName } from "@/lib/db/players";
import { sessionClient } from "@/lib/supabase/session";

/**
 * Where a mailed sign-in link lands.
 *
 * Supabase's link goes to its own verify endpoint first, which checks the token
 * and then bounces the browser here with a one-time code in the query string.
 * Exchanging that code is what actually writes the session cookies, so this
 * route is the last step of signing in rather than a formality after it.
 *
 * The exchange needs the code verifier that was stored when the link was
 * requested, and that verifier is a cookie. So the link has to be opened in the
 * browser that asked for it: a link requested on a laptop and tapped on a phone
 * fails here, with a real message rather than a silent bounce to a signed-out
 * page.
 *
 * Nothing here stamps `claimed_at`. A database trigger does it the moment the
 * email is confirmed (migration 0009), precisely so that a callback that is
 * never reached cannot leave a confirmed account looking anonymous.
 */

const WRONG_BROWSER =
  "That link could not be used here. Sign-in links only work in the browser that asked for one, so ask for a fresh link from this browser.";

export async function GET(request: Request) {
  const url = new URL(request.url);

  function back(reason: string) {
    return NextResponse.redirect(
      new URL(`/signin?failed=${encodeURIComponent(reason)}`, url),
    );
  }

  const refused =
    url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (refused) return back(refused);

  const code = url.searchParams.get("code");
  if (!code) {
    return back("That link carried no sign-in code. Ask for a fresh one.");
  }

  const supabase = await sessionClient();

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return back(WRONG_BROWSER);

  // Belt and braces. A claimed account already has a name, but an account that
  // reached an email without ever finishing the front door would otherwise be
  // unable to join a game, because `player_joined` requires one.
  await ensureDisplayName(data.user.id);

  return NextResponse.redirect(new URL("/account", url));
}
