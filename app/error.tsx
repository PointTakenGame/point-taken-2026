"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * The last thing between a thrown render error and a blank page.
 *
 * Without this file Next serves its own default, which inside this layout is
 * the word "Point Taken" and nothing else. A reviewer who hits it can only
 * report "it broke", which is not a bug report anybody can act on.
 *
 * So this page does two jobs. It tells the player the game is still there and
 * their board is not lost, which is true: the log is append-only, so a screen
 * that failed to draw has not thrown away anything that was written. And it
 * shows the digest, the id Next assigns to the error and writes into the server
 * log beside the stack trace. Quoting it is what turns "a page broke" into a
 * line somebody can find.
 *
 * Retry first. Most of what lands here is a failed read, and the same render
 * a second time is often simply fine.
 */

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The server already logged this one with its digest. This is the browser
    // half, for the console of whoever is looking at the screen.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center gap-6 p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">This screen did not draw</h1>
        <p className="text-gray">
          Something went wrong on our end, not yours. Nothing either of you wrote is lost:
          a game is stored as the run of moves that made it, and a page that failed to
          draw has not touched that.
        </p>
      </header>

      <div className="flex items-center gap-4">
        <button
          type="button"
          className="border border-current/60 px-4 py-2 font-semibold"
          onClick={reset}
        >
          Try again
        </button>
        <span className="text-p-sm opacity-60">
          Usually enough. If it comes back twice, it is real.
        </span>
      </div>

      {error.digest ? (
        <p className="text-p-sm text-gray">
          Reporting it? Quote this:{" "}
          <span className="font-mono font-semibold">{error.digest}</span>, along with the
          build id in the corner below. Together they say exactly which code failed and
          where to find the rest of it.
        </p>
      ) : null}

      <nav className="flex gap-4 text-p-sm">
        <Link href="/" className="underline">
          Start a room
        </Link>
        <Link href="/account" className="underline">
          Your games
        </Link>
        <Link href="/how-to-play" className="underline">
          How to play
        </Link>
      </nav>
    </main>
  );
}
