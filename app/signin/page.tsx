import Link from "next/link";

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
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="opacity-70">
          Give the address you attached to your account and we will mail you a link. There
          is no password to remember, because there was never one to set.
        </p>
      </header>

      {failed ? (
        <p className="rounded-md border border-red-600/40 p-3 text-sm text-red-600">
          {failed}
        </p>
      ) : null}

      {player ? (
        <p className="text-sm opacity-70">
          {guest
            ? `You are already playing as ${player.display_name ?? "a player with no name yet"}, on an account with no email. Signing in here puts this browser into the other account and leaves that one behind for good, so if you are mid-game, finish first.`
            : `You are already signed in as ${player.display_name ?? "a player with no name yet"}.`}
        </p>
      ) : null}

      <SignInForm />

      <div className="flex flex-col gap-1 border-t border-current/10 pt-6 text-sm opacity-70">
        <p>
          Open the link in this same browser. It carries half of a key that was left here
          when you asked for it, so a link forwarded to a phone will not open.
        </p>
        <p>
          Never attached an email?{" "}
          <Link href="/" className="underline">
            Start a room
          </Link>{" "}
          and you get an account without one.
        </p>
      </div>
    </main>
  );
}
