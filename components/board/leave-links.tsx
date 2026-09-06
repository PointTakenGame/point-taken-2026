import Link from "next/link";

/**
 * The quiet way off a board that is still going.
 *
 * The account hub's tab bar deliberately does not render here, and should
 * not: a row of tabs, sitting above an argument in progress, invites leaving. But
 * the alternative that shipped was worse. A live board and a room waiting for
 * its second player had no link out at all, so the only way back to your games
 * was the browser's back button or typing a URL, and the finished board was the
 * one state that offered anything.
 *
 * So: two links, at the bottom, in the same understated style the finished
 * board already used. Leaving a game in progress does not end it. The board is
 * a projection of the log, so the argument is exactly where you left it when
 * you come back to it from the history.
 */
export function LeaveLinks() {
  return (
    <nav className="mx-auto flex w-full max-w-3xl gap-4 px-8 pb-8 text-p-sm text-gray print:hidden">
      <Link href="/account" className="underline decoration-gold underline-offset-2">
        Your games
      </Link>
      <Link href="/leaderboard" className="underline decoration-gold underline-offset-2">
        Leaderboard
      </Link>
    </nav>
  );
}
