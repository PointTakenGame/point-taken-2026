import { Wordmark } from "@/components/brand/art";
import { RoomEntry } from "@/components/rooms/room-entry";
import { HotseatBar } from "@/components/dev/hotseat-bar";
import { HomeLinks } from "@/components/home/home-links";
import { hotseatAllowed } from "@/lib/dev/hotseat";
import { listDemoPlayers } from "@/lib/dev/demo-players";
import { currentPlayerId } from "@/lib/supabase/session";

/**
 * The front door: join a room with its code, or open one.
 *
 * Rebuilt 2026-09-02 from Rannie's landing frame (Figma `1096:244927`, spec
 * BRAIN-T260902-21) on Steve's instruction that her flow is the base for this
 * whole area rather than a reference alongside it. Hers is almost nothing: the
 * wordmark large and centred over the dot-grid ground, a room-number field with
 * "Join a game" beside it, the word OR, and "Create a room" under that. The
 * page this replaced was the retired Nuxt client's splash screen, ported in
 * August, which put starting a room first and carried a paragraph of
 * explanation.
 *
 * Two things of hers are not here, both on purpose.
 *
 * There is no site nav. She does not draw one on any of the three 832-tall
 * frames, and the four-tab account hub is how you get to an account now
 * (`components/account/account-shell.tsx`). This screen's job is to get two
 * people into the same room.
 *
 * The quiet links at the bottom are ours and she draws no equivalent. A player
 * who attached an email months ago and cleared their cookies has exactly one
 * way back to their games, and it is /signin. Dropping the only door back in
 * to match a frame would be a real loss to a real person for a gain nobody
 * would notice.
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
      <main className="dot-ground flex min-h-screen w-full flex-1 flex-col items-center justify-center gap-14 p-8">
        {/* The mark carries the name, so there is no heading text to repeat. */}
        <h1>
          <Wordmark width={420} />
        </h1>

        <RoomEntry />

        <HomeLinks signedIn={me !== null} />
      </main>
      {dev ? <HotseatBar me={me} players={demoPlayers} /> : null}
    </>
  );
}
