import { Profile } from "@/app/account/profile";
import { StartPlaying } from "@/app/account/start-playing";
import { Wordmark } from "@/components/brand/art";
import { RoomEntry } from "@/components/rooms/room-entry";
import { HotseatBar } from "@/components/dev/hotseat-bar";
import { HomeLinks } from "@/components/home/home-links";
import { hotseatAllowed } from "@/lib/dev/hotseat";
import { listDemoPlayers } from "@/lib/dev/demo-players";
import { currentPlayerId } from "@/lib/supabase/session";

/**
 * Home, which is two different screens depending on whether anybody is here.
 *
 * **Signed in, it is the profile** (Steve, 2026-09-03): the same screen as
 * /account, opening with the Gym play and Live play cards above the stats. A
 * player with an account has somewhere to be, and the room code field they
 * would have come here for is on the Live play card.
 *
 * **Signed out, it is the front door**, rebuilt 2026-09-02 from Rannie's
 * landing frame (Figma `1096:244927`, spec BRAIN-T260902-21). Hers is almost
 * nothing: the wordmark large and centred over the dot-grid ground, a
 * room-number field with "Join a game" beside it, the word OR, and "Create a
 * room" under that.
 *
 * One thing on it is not hers and is not optional. Every action here quietly
 * mints an account, so the visitor ticks the Terms of Use and the Privacy
 * Policy before any of them will fire, and `/api/auth/anonymous` refuses
 * without it. There is one tick box for the whole screen, inside RoomEntry,
 * and the guest-account button below reads the same answer rather than asking
 * again.
 *
 * There is no site nav on the signed-out half. She does not draw one on any of
 * the three 832-tall frames, and the four-tab account hub is how you get around
 * once you are in (`components/account/account-shell.tsx`). The quiet links at
 * the bottom are ours: a player who attached an email months ago and cleared
 * their cookies has exactly one way back to their games, and it is /signin.
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

  return (
    <>
      {me ? (
        <Profile playerId={me} />
      ) : (
        <main className="dot-ground flex min-h-screen w-full flex-1 flex-col items-center justify-center gap-14 p-8">
          {/* The mark carries the name, so there is no heading text to repeat. */}
          <h1>
            <Wordmark width={420} />
          </h1>

          <RoomEntry signedIn={false} />

          <div className="flex flex-col items-center gap-2">
            <p className="text-p-sm text-ink-soft">
              Or take the guest account on its own and look around first.
            </p>
            <StartPlaying label="Set me up" withTick={false} />
          </div>

          <HomeLinks signedIn={false} />
        </main>
      )}
      {dev ? <HotseatBar me={me} players={demoPlayers} /> : null}
    </>
  );
}
