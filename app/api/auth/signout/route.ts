import { NextResponse } from "next/server";
import { sessionClient } from "@/lib/supabase/session";

/**
 * Let go of this browser's session.
 *
 * Deliberately allowed for accounts with no email attached, even though for
 * those it is one way, because it is the only way to become a second player on
 * a machine where the dev hot seat does not exist. On the live site that is how
 * one person tests both seats, and refusing here would leave them clearing
 * cookies by hand to do something the app should just offer.
 *
 * The warning belongs on the button, not in this handler. The surface says
 * plainly that an account with no email cannot be signed back into, and then
 * this does what it was asked.
 */
export async function POST() {
  const supabase = await sessionClient();

  const { error } = await supabase.auth.signOut();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }

  return NextResponse.json({ signedOut: true });
}
