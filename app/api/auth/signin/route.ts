import { NextResponse } from "next/server";
import { sessionClient } from "@/lib/supabase/session";

/**
 * Ask for a sign-in link.
 *
 * This is a route handler rather than a server action on purpose. Every server
 * action in this codebase has to establish who is asking before it does
 * anything, and `lib/games/action-identity.test.ts` enforces that structurally.
 * Signing in is the one operation where nobody is anybody yet, so it lives
 * beside `/api/auth/anonymous`, which is a route handler for the same reason.
 *
 * No password is ever set. An account is claimed by confirming an email
 * (see migration 0009) and re-entered by a mailed link, so the address is the
 * whole credential and the mailbox is the second factor.
 *
 * `shouldCreateUser: false` matters twice. It keeps the front door honest,
 * because an account here is made by playing rather than by signing up, and it
 * stops this endpoint from becoming a way to mint empty accounts at strangers'
 * addresses. The cost is that an unknown address comes back as an error, and
 * that error is deliberately not passed on: telling a caller which addresses
 * have accounts turns this into a membership oracle. Everyone gets the same
 * answer and the page explains the wait.
 */

const ADDRESS = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Supabase's way of saying "no such account", which we decline to repeat. */
function unknownAddress(error: { code?: string; message: string }): boolean {
  return error.code === "otp_disabled" || /signups? not allowed/i.test(error.message);
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => ({}));
  const raw = (body as { email?: unknown }).email;
  const address = typeof raw === "string" ? raw.trim() : "";

  if (!ADDRESS.test(address)) {
    return NextResponse.json(
      { error: "That does not look like an email address." },
      { status: 400 },
    );
  }

  const supabase = await sessionClient();

  const { error } = await supabase.auth.signInWithOtp({
    email: address,
    options: {
      shouldCreateUser: false,
      // Derived from the request rather than an environment variable so that
      // local dev, the live site, and any future host each send a link back to
      // themselves. Supabase still checks it against the redirect allow list.
      emailRedirectTo: new URL("/auth/callback", request.url).toString(),
    },
  });

  if (error && !unknownAddress(error)) {
    // Rate limiting lands here, and it is worth repeating verbatim: "you can
    // only request this after 60 seconds" is the answer to why nothing arrived.
    return NextResponse.json({ error: error.message }, { status: error.status ?? 502 });
  }

  return NextResponse.json({ sent: true });
}
