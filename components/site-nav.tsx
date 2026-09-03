import Link from "next/link";

import { getPlayer } from "@/lib/db/players";
import { currentPlayerId } from "@/lib/supabase/session";
import { Wordmark } from "@/components/brand/art";

/**
 * The one bar that ties the out-of-game screens together.
 *
 * Before this existed the front door linked nowhere: a player who came back
 * the next day could start a room, but could not reach the games they had
 * already played, the cards they hold, or the coach switch. Each account
 * screen also cross-linked to two of its three siblings and never home, so
 * which links you saw depended on which door you came in by.
 *
 * Restyled 2026-09-02 into Rannie's account-flow language (ghost outline pills
 * in ink on the warm ground, the wordmark carrying the way home) so that
 * leaving the account hub for the Gym does not look like leaving the product.
 * It renders on the three screens that are not part of the four-tab hub;
 * inside the hub, `components/account/account-shell.tsx` is the nav.
 *
 * Signed out it keeps the wordmark and drops the links. A visitor with no
 * account has no account to visit, but these three screens are reachable
 * signed out (the rules in particular are meant to be readable before you
 * play), and a page with no way back to the front door is a dead end.
 *
 * Not on the board. A game in progress has its own links and does not want a
 * row of ways to leave it sitting above the argument.
 */

type Here = "home" | "account" | "leaderboard" | "cards" | "gym" | "settings" | "how";

const LINKS: { here: Here; href: string; label: string }[] = [
  { here: "account", href: "/account", label: "Your account" },
  { here: "gym", href: "/gym", label: "Gym" },
  { here: "leaderboard", href: "/leaderboard", label: "Leaderboard" },
  { here: "how", href: "/how-to-play", label: "How to play" },
];

export async function SiteNav({ here }: { here: Here }) {
  const playerId = await currentPlayerId();
  const player = playerId ? await getPlayer(playerId) : null;

  return (
    <nav
      aria-label="Point Taken"
      className="mx-auto flex w-full max-w-[1229px] flex-wrap items-center gap-4 px-6 pt-10 pb-8"
    >
      {/* The mark is the way home, exactly as it is in the account hub. */}
      <Link href="/" className="pr-6 opacity-60 transition-opacity hover:opacity-100">
        <Wordmark width={132} />
        <span className="sr-only">Start a room</span>
      </Link>
      {(player ? LINKS : []).map((link) => {
        const active = link.here === here;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`font-primary rounded-[10px] border border-ink px-6 py-3 text-xl transition-colors hover:bg-card ${
              active ? "text-ink bg-card" : "text-ink-soft"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
