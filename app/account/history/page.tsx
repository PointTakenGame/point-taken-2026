import Link from "next/link";

import { currentPlayerId } from "@/lib/supabase/session";
import type { GameMode } from "@/lib/db/types";
import { AccountHeading, AccountShell, Panel } from "@/components/account/account-shell";
import { MatchList } from "@/components/account/match-list";
import { StartPlaying } from "../start-playing";
import { loadAccount } from "../data";

/**
 * The History tab: every game this player has been in.
 *
 * Split out of /account on 2026-09-02, because Rannie makes History one of the
 * four account tabs (Figma `1096:224142`, spec BRAIN-T260902-21) rather than the
 * bottom half of the profile. The profile keeps the four most recent and links
 * here; this page is the whole archive, and the mode filter moved here with it,
 * since a filter belongs on the list it filters.
 *
 * Her frame carries a search box, a date-range picker and a sort control above
 * the list. None of those are built: `listGamesForPlayer` returns at most fifty
 * games newest first, and a search box over fifty rows that cannot page is a
 * control that promises more than it does. When the archive grows past what one
 * page holds, all three arrive together with the paging that makes them mean
 * something.
 */

export const dynamic = "force-dynamic";

/** The two kinds of game, in the words the history uses. */
const MODE_LABEL: Record<GameMode, string> = { gym: "Gym", live: "Live" };

/** Only a real mode narrows the list. Anything else in the URL is ignored. */
function readMode(raw: string | undefined): GameMode | null {
  return raw === "gym" || raw === "live" ? raw : null;
}

/**
 * Narrow the history to one kind of game.
 *
 * Links rather than tabs, so the choice is in the URL: it survives a reload, it
 * can be sent to somebody, and it works before any JavaScript arrives. The
 * caller renders this only when the player actually has both kinds, because a
 * filter with one populated side is a control that does nothing.
 */
function ModeFilter({ modes, active }: { modes: GameMode[]; active: GameMode | null }) {
  const options: { value: GameMode | null; label: string; href: string }[] = [
    { value: null, label: "All", href: "/account/history" },
    ...modes.map((mode) => ({
      value: mode,
      label: MODE_LABEL[mode],
      href: `/account/history?mode=${mode}`,
    })),
  ];

  return (
    <nav aria-label="Filter games" className="flex flex-wrap gap-2 pb-6">
      {options.map((option) =>
        option.value === active ? (
          <span
            key={option.label}
            aria-current="true"
            className="font-label border-ink bg-card text-ink shadow-sticker-sm rounded-full border-[1.5px] px-4 py-1 text-xs font-bold tracking-widest uppercase"
          >
            {option.label}
          </span>
        ) : (
          <Link
            key={option.label}
            href={option.href}
            className="font-label border-ink/40 text-ink-soft hover:border-ink hover:text-ink rounded-full border-[1.5px] px-4 py-1 text-xs font-bold tracking-widest uppercase transition-colors"
          >
            {option.label}
          </Link>
        ),
      )}
    </nav>
  );
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const playerId = await currentPlayerId();

  if (!playerId) {
    return (
      <AccountShell tab="history">
        <AccountHeading title="Game history">
          Your games are kept on the account you get by playing. Start one and this fills
          up.
        </AccountHeading>
        <Panel className="flex max-w-2xl flex-col items-start gap-4">
          <StartPlaying />
        </Panel>
      </AccountShell>
    );
  }

  const { games, topics, opponents, cardsThrown, resolutions } =
    await loadAccount(playerId);

  const mode = readMode((await searchParams).mode);
  // Which filters are worth offering: only the kinds this player has actually
  // played. Offering "Gym" to somebody who has never opened it is a link to an
  // empty list.
  const modes = (["gym", "live"] as GameMode[]).filter((kind) =>
    games.some((game) => game.mode === kind),
  );
  const shown = mode ? games.filter((game) => game.mode === mode) : games;

  return (
    <AccountShell tab="history">
      <AccountHeading title="Game history">
        {games.length === 0
          ? "Nothing here yet."
          : `${games.length} game${games.length === 1 ? "" : "s"}, newest first.`}
      </AccountHeading>
      {modes.length > 1 ? <ModeFilter modes={modes} active={mode} /> : null}
      <MatchList
        games={shown}
        topics={topics}
        opponents={opponents}
        cardsThrown={cardsThrown}
        resolutions={resolutions}
        empty={
          mode
            ? `No ${MODE_LABEL[mode]} games yet.`
            : "No games yet. The first one starts the archive."
        }
      />
    </AccountShell>
  );
}
