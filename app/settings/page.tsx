import Link from "next/link";

import { getPlayer } from "@/lib/db/players";
import { currentPlayerId } from "@/lib/supabase/session";
import { SiteNav } from "@/components/site-nav";
import { StartPlaying } from "../account/start-playing";
import { SettingsForm } from "./settings-form";

/**
 * The three things a player controls: their name, the coach, and whether the
 * account outlives this browser.
 *
 * Same card and type system as /account (BRAIN-T260831-76) as of this pass.
 * Rannie's settings frame (755:25347) still carries rows for systems that are
 * not decided (BRAIN-T260817-02), so those stay out, but the chrome that is
 * here now matches the rest of the walkthrough instead of standing apart from
 * it.
 */

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const playerId = await currentPlayerId();
  const player = playerId ? await getPlayer(playerId) : null;

  if (!player) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
        <h1 className="font-primary text-3xl tracking-wide">Settings</h1>
        <p className="text-gray">
          You are not signed in. Starting a game gives you a name and an account, with no
          email and no password.
        </p>
        <StartPlaying />
        <p className="text-p-sm opacity-60">
          Or, if you attached an email to an account before,{" "}
          <Link href="/signin" className="underline">
            sign in
          </Link>{" "}
          and it comes back with its games.
        </p>
      </main>
    );
  }

  return (
    <>
      <SiteNav here="settings" />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
        <header className="flex flex-col gap-2">
          <h1 className="font-primary text-3xl tracking-wide">Settings</h1>
          <p className="text-p-sm text-gray">
            Signed in as {player.display_name ?? "a player with no name yet"}.
          </p>
        </header>

        <SettingsForm
          displayName={player.display_name ?? ""}
          coachEnabled={player.coach_enabled}
          claimed={player.claimed_at !== null}
        />
      </main>
    </>
  );
}
