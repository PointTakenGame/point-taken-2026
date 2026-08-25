import Link from "next/link";

import { Wordmark } from "@/components/brand/art";
import { RoomEntry } from "@/components/rooms/room-entry";
import { SiteNav } from "@/components/site-nav";
import { HotseatBar } from "@/components/dev/hotseat-bar";
import { hotseatAllowed } from "@/lib/dev/hotseat";
import { currentPlayerId } from "@/lib/supabase/session";

/**
 * The front door: start a room, or join one with its code.
 *
 * Plain type on purpose, with one exception. Rannie's frames for this surface
 * are aesthetics to apply later, and the roadmap governs what is on the screen
 * (BRAIN-T260823-09). The wordmark is not part of that: it is the mark the game
 * has always shipped under, copied out of the retired client rather than
 * designed here, and a front door that does not say whose it is fails at the one
 * job a front door has.
 */

export const dynamic = "force-dynamic";

export default async function Home() {
  // Local sandbox bypass, see docs/filed/SANDBOX.md. The bar is here as well as
  // on the board so that "back to my own login" is always one click away: a
  // hot seat you cannot get out of is worse than no hot seat.
  const dev = hotseatAllowed();
  const me = await currentPlayerId();

  return (
    <>
      <SiteNav here="home" />
      <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center gap-6 p-8">
        <header className="flex flex-col gap-2">
          {/* The mark carries the name, so there is no heading text to repeat. */}
          <h1>
            <Wordmark width={220} />
          </h1>
          <p className="opacity-70">
            A writing game for two people who disagree. You trade reasons, link them, and
            find out exactly where you part ways.
          </p>
        </header>
        <RoomEntry />
        {/*
          The rules link is here and not only in SiteNav, which renders nothing
          for a signed-out visitor. That visitor is exactly the person who has
          never played.
        */}
        <p className="text-sm opacity-60">
          Never played?{" "}
          <Link href="/how-to-play" className="underline">
            How to play
          </Link>{" "}
          is the whole thing in one page.
        </p>
        {me ? null : (
          <p className="text-sm opacity-60">
            Played before and attached an email?{" "}
            <Link href="/signin" className="underline">
              Sign in
            </Link>{" "}
            to get back to those games. Otherwise just start a room: an account comes with
            it.
          </p>
        )}
      </main>
      {dev ? <HotseatBar me={me} /> : null}
    </>
  );
}
