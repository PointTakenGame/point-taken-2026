import Link from "next/link";

/**
 * The 404, which is a routine destination here rather than an edge case.
 *
 * Three ordinary things land a player on it. They typed a room code into the
 * game address, which cannot work: /game/ takes the long id and a five-character
 * code goes to /join/. They opened a link to a game that has since ended. Or
 * they opened a link to a game they were never in, because a game holds what
 * two people actually said to each other and only those two can open it
 * (BRAIN-T260822-14).
 *
 * The page says all three and never says which. A non-member and a game that
 * does not exist get the same answer on purpose, so nobody can sit here trying
 * ids to find out which ones are real. That property is the reason this copy
 * is a list of possibilities instead of a diagnosis.
 *
 * No session lookup, no nav bar, nothing that can itself fail. Next renders
 * this page for the whole app, including at build time, and a 404 that throws
 * is worse than a plain one. Every way out below is a static link.
 */

export const metadata = {
  title: "Not here - Point Taken",
};

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center gap-6 p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">That page is not here</h1>
        <p className="text-gray">
          Nothing is broken. This address does not open anything for you right now.
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-p-md font-semibold">The usual reasons</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-p-sm opacity-80">
          <li>
            A room code went in the wrong place. The five characters someone reads aloud
            go to <span className="font-mono">/join/</span> and the code, like{" "}
            <span className="font-mono">/join/ABC23</span>. The{" "}
            <span className="font-mono">/game/</span> address takes the long id the site
            hands you once you are in.
          </li>
          <li>The game finished and the room closed.</li>
          <li>
            The link is to a game you were not in. A finished game is private to the two
            people who played it, so it opens for them and for nobody else.
          </li>
          <li>The address is a character off.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-p-md font-semibold">Where to go instead</h2>
        <ul className="flex flex-col gap-1 text-p-sm">
          <li>
            <Link href="/" className="underline">
              Start a room
            </Link>{" "}
            from the front door, or put a code in the box there to join one.
          </li>
          <li>
            <Link href="/account" className="underline">
              Your games
            </Link>{" "}
            lists every game you have played, finished ones included.
          </li>
          <li>
            <Link href="/how-to-play" className="underline">
              How to play
            </Link>{" "}
            is the whole game in one page.
          </li>
        </ul>
      </section>
    </main>
  );
}
