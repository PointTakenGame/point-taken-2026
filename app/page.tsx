import Link from "next/link";

import { Profile } from "@/app/account/profile";
import { StartPlaying } from "@/app/account/start-playing";
import { Wordmark } from "@/components/brand/art";
import { AgreementTick } from "@/components/legal/agreement";
import { HotseatBar } from "@/components/dev/hotseat-bar";
import { HomeLinks } from "@/components/home/home-links";
import { LandingOnboarding } from "@/components/onboarding/landing-onboarding";
import { CalendarStrip } from "@/components/account/calendar-strip";
import { LeaderboardBoard } from "@/components/account/leaderboard-board";
import { hotseatAllowed } from "@/lib/dev/hotseat";
import { listDemoPlayers } from "@/lib/dev/demo-players";
import { currentPlayerId } from "@/lib/supabase/session";
import { readLeaderboard } from "@/lib/db/leaderboard";

/**
 * Home, which is two different screens depending on whether anybody is here.
 *
 * **Signed in, it is the profile** (Steve, 2026-09-03): the same screen as
 * /account, opening with the Gym play and Live play cards above the stats. A
 * player with an account has somewhere to be, and the room code field they
 * would have come here for is on the Live play card.
 *
 * **Signed out, it is the front door**, originally built 2026-09-02 from
 * Rannie's landing frame (Figma `1096:244927`, spec BRAIN-T260902-21) and
 * trimmed 2026-09-08 (Steve): the room-code field, "Join a game" and "Create
 * a room" moved off this screen entirely, since offering them before a
 * visitor has an account was confusing. They live only on the profile's Live
 * play card now (`components/account/hero.tsx`). What is left here is the
 * wordmark, the Terms of Use / Privacy Policy tick, "Set me up" for a guest
 * account, and a Login button back to an existing one.
 *
 * Every action here quietly mints an account, so the visitor ticks the Terms
 * of Use and the Privacy Policy before any of them will fire, and
 * `/api/auth/anonymous` refuses without it. There is one tick box for the
 * whole screen, and the guest-account button below reads the same answer
 * rather than asking again.
 *
 * There is no site nav on the signed-out half. She does not draw one on any of
 * the three 832-tall frames, and the four-tab account hub is how you get around
 * once you are in (`components/account/account-shell.tsx`). The quiet links at
 * the bottom are ours: a player who attached an email months ago and cleared
 * their cookies has exactly one way back to their games, and it is /signin.
 *
 * Below that front door, since 2026-09-05 (`BRAIN-T260904-14`, Steve's ruling
 * "Both. It goes in both places."), sits the same sample events calendar and
 * the same leaderboard that already sit at the foot of the profile. Rannie's
 * empty landing frame stays the first thing anyone sees; these are a second,
 * lower section rather than a change to hers. Both components are already
 * standalone, so this reuses them rather than redrawing them: `CalendarStrip`
 * carries no player-specific data at all, and `LeaderboardBoard` takes whoever
 * is looking (null here) and just renders no "you" badge, which is the public
 * form the same board would show a signed-out visitor on /leaderboard.
 */

export const dynamic = "force-dynamic";

export default async function Home() {
  // Local sandbox bypass, see docs/filed/SANDBOX.md. The bar is here as well as
  // on the board so that "back to my own login" is always one click away: a
  // hot seat you cannot get out of is worse than no hot seat.
  const dev = hotseatAllowed();
  const me = await currentPlayerId();
  // The seeded history belongs to invented players, so without this the front
  // door is the one place you cannot reach it from. See lib/dev/demo-players.ts.
  const demoPlayers = dev ? await listDemoPlayers() : [];
  // Only the signed-out half shows these below the fold: the profile already
  // has both at its own foot, and the sorted-by-wins rows are the same public
  // data a visitor would see with nobody signed in, so this never asks for
  // `me`'s own stats.
  const leaderboard = me ? null : await readLeaderboard("wins");

  return (
    <>
      {me ? (
        <Profile playerId={me} />
      ) : (
        <main className="dot-ground flex w-full flex-1 flex-col items-center gap-16 p-8 pb-16">
          <div className="flex min-h-screen w-full flex-col items-center justify-center gap-14">
            {/* The mark carries the name, so there is no heading text to repeat. */}
            <h1>
              <Wordmark width={420} />
            </h1>

            <div className="flex flex-col items-center gap-4">
              <AgreementTick id="pt-agreement-home" />
              <div className="flex flex-wrap items-center justify-center gap-3">
                <StartPlaying label="Set me up" withTick={false} />
                <Link href="/signin" className="form-base font-secondary">
                  Login
                </Link>
              </div>
            </div>

            <HomeLinks signedIn={false} />
          </div>

          <div className="flex w-full max-w-3xl flex-col gap-8">
            <CalendarStrip />

            <section className="border-ink bg-card w-full overflow-hidden rounded-2xl border-[1.5px]">
              <header className="bg-stat-warm text-card flex flex-wrap items-center gap-3 px-6 py-4">
                <h2 className="font-figure text-2xl font-black tracking-wide uppercase">
                  Leaderboard
                </h2>
                <Link
                  href="/leaderboard"
                  className="font-label border-card text-card hover:bg-card hover:text-stat-warm ml-auto rounded-lg border-[1.5px] px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-colors"
                >
                  Full board
                </Link>
              </header>
              <div className="p-6">
                <LeaderboardBoard metric="wins" playerId={me} rows={leaderboard ?? []} />
              </div>
            </section>
          </div>
        </main>
      )}
      {dev ? <HotseatBar me={me} players={demoPlayers} /> : null}
      <LandingOnboarding signedIn={me !== null} />
    </>
  );
}
