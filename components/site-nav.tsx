import Link from "next/link";

import { getPlayer } from "@/lib/db/players";
import { currentPlayerId } from "@/lib/supabase/session";

/**
 * The one bar that ties the out-of-game screens together.
 *
 * Before this existed the front door linked nowhere: a player who came back
 * the next day could start a room, but could not reach the games they had
 * already played, the cards they hold, or the coach switch. Each account
 * screen also cross-linked to two of its three siblings and never home, so
 * which links you saw depended on which door you came in by.
 *
 * Signed out it renders nothing. A visitor with no account has no account to
 * visit, and the front door already explains itself.
 *
 * Not on the board. A game in progress has its own links and does not want a
 * row of ways to leave it sitting above the argument.
 */

type Here = "home" | "account" | "cards" | "settings" | "how";

const LINKS: { here: Here; href: string; label: string }[] = [
  { here: "home", href: "/", label: "Start a room" },
  { here: "account", href: "/account", label: "Your games" },
  { here: "cards", href: "/cards", label: "Your cards" },
  { here: "settings", href: "/settings", label: "Settings" },
  { here: "how", href: "/how-to-play", label: "How to play" },
];

export async function SiteNav({ here }: { here: Here }) {
  const playerId = await currentPlayerId();
  if (!playerId) return null;

  const player = await getPlayer(playerId);
  if (!player) return null;

  return (
    <nav className="border-b border-current/10">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-baseline gap-x-4 gap-y-1 p-4 text-sm">
        <span className="font-semibold">{player.display_name ?? "You"}</span>
        {LINKS.filter((link) => link.here !== here).map((link) => (
          <Link key={link.href} href={link.href} className="underline opacity-70">
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
