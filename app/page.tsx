import { Wordmark } from "@/components/brand/art";
import { RoomEntry } from "@/components/rooms/room-entry";
import { SiteNav } from "@/components/site-nav";
import { HotseatBar } from "@/components/dev/hotseat-bar";
import { HomeLinks } from "@/components/home/home-links";
import { hotseatAllowed } from "@/lib/dev/hotseat";
import { listDemoPlayers } from "@/lib/dev/demo-players";
import { currentPlayerId } from "@/lib/supabase/session";

/**
 * The front door: start a room, or join one with its code.
 *
 * Styled to the archived client's splash screen (point-taken-frontend's
 * pages/index.vue): a centered wordmark over cream, a bordered card holding
 * the room actions, quiet links below it. Presentation only, ported now that
 * the roadmap has settled what belongs on this screen (BRAIN-T260823-09). The
 * wordmark is not part of that settling: it is the mark the game has always
 * shipped under, copied out of the retired client rather than designed here,
 * and a front door that does not say whose it is fails at the one job a front
 * door has.
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
      <SiteNav here="home" />
      <main className="mx-auto flex min-h-[80vh] max-w-2xl flex-1 flex-col items-center justify-center gap-10 p-8">
        <header className="flex flex-col items-center gap-3 text-center">
          {/* The mark carries the name, so there is no heading text to repeat. */}
          <h1>
            <Wordmark width={260} />
          </h1>
          <p className="font-secondary text-p-lg text-gray">
            A writing game for two people who disagree. You trade reasons, link them, and
            find out exactly where you part ways.
          </p>
        </header>

        <div className="border-gray/30 bg-offwhite w-full rounded-2xl border p-6 shadow-md sm:p-8">
          <RoomEntry />
        </div>

        <HomeLinks signedIn={me !== null} />
      </main>
      {dev ? <HotseatBar me={me} players={demoPlayers} /> : null}
    </>
  );
}
