import Link from "next/link";

import { Wordmark } from "@/components/brand/art";
import { getPlayer } from "@/lib/db/players";
import { currentPlayerId } from "@/lib/supabase/session";
import { SignInForm } from "./signin-form";

/**
 * The way back in.
 *
 * An account here is made by playing, not by signing up, so this page is not a
 * front door. It is for the second visit: a player who attached an email in
 * settings, then cleared a cache or picked up a different machine, and whose
 * games are otherwise unreachable. There is no password to offer, because none
 * was ever set. The mailbox is the credential.
 *
 * It says out loud what it is about to cost a guest, because the cost is real
 * and invisible: signing in replaces whatever session this browser is holding,
 * and an account with no email cannot be returned to afterwards.
 *
 * The shape is the retired client's login screen (`app/pages/login.vue`): the
 * whole viewport, centred, the lockup carrying the top of the page, then one
 * narrow column of form. The retired page had no heading at all, the logo did
 * that job, but this one keeps a small `font-primary` line because "Sign in"
 * is doing work the lockup cannot: it distinguishes coming back from starting
 * out. It is `text-3xl` rather than the global h1's 56px, which under a 300px
 * lockup reads as two competing titles.
 */

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ failed?: string }>;
}) {
  const { failed } = await searchParams;

  const playerId = await currentPlayerId();
  const player = playerId ? await getPlayer(playerId) : null;
  const guest = player !== null && player.claimed_at === null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      {/* Declared at its intrinsic 300 by 227 so the box needs no rounding. */}
      <section className="mb-12">
        <Wordmark width={300} />
      </section>

      <div className="flex w-full max-w-lg flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="font-primary text-3xl">Sign in</h1>
          <p className="font-secondary text-p-sm text-gray">
            Give the address you attached to your account and we will mail you a link.
            There is no password to remember, because there was never one to set.
          </p>
        </header>

        {failed ? (
          <p className="font-secondary text-p-sm rounded-md border border-red-600/40 p-3 text-red-600">
            {failed}
          </p>
        ) : null}

        {player ? (
          <p className="font-secondary text-p-sm text-gray">
            {guest
              ? `You are already playing as ${player.display_name ?? "a player with no name yet"}, on an account with no email. Signing in here puts this browser into the other account and leaves that one behind for good, so if you are mid-game, finish first.`
              : `You are already signed in as ${player.display_name ?? "a player with no name yet"}.`}
          </p>
        ) : null}

        <SignInForm />

        <div className="font-secondary text-p-sm text-gray flex flex-col gap-1 border-t border-current/10 pt-6">
          <p>
            Open the link in this same browser. It carries half of a key that was left
            here when you asked for it, so a link forwarded to a phone will not open.
          </p>
          <p>
            Never attached an email?{" "}
            <Link href="/" className="underline">
              Start a room
            </Link>{" "}
            and you get an account without one.
          </p>
        </div>
      </div>
    </main>
  );
}
