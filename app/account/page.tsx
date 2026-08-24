import Link from "next/link";
import { currentPlayerId } from "@/lib/supabase/session";
import { getPlayer } from "@/lib/db/players";
import { getPlayerStats, type PlayerStats } from "@/lib/db/stats";
import {
  listGamesForPlayer,
  readCardThrowsForGames,
  readOpponentsForGames,
  readPlayDaysForPlayer,
  readTopicsForGames,
  type GameTopic,
} from "@/lib/db/games";
import type { GameRow } from "@/lib/db/types";
import type { Uuid } from "@/lib/events/types";
import { Counter } from "@/components/counter";
import { LocalDay } from "@/components/local-day";
import { StreakCounters } from "@/components/streak-counters";
import { SiteNav } from "@/components/site-nav";
import { StartPlaying } from "./start-playing";
import { TokenGlyph, tokenLabel } from "@/components/board/token-glyph";

/**
 * The page a player lands on after signing in: who they are, what they have
 * done, and every game they have been in.
 *
 * Deliberately unstyled beyond plain type. Rannie's profile frames carry a
 * level ladder, a ranked division and a cooperation score that are not decided
 * yet (BRAIN-T260817-02, BRAIN-T260816-08), so building to them now would bake
 * in numbers the game does not have. Each game in the history opens its board,
 * replayed from the log at /game/[gameId]. Registry row BRAIN-T260714-69.
 */

export const dynamic = "force-dynamic";

/** What a game ended as, in the words a player would use. */
const OUTCOME: Record<string, string> = {
  threads_resolved: "All threads resolved",
  topic_agreed: "Agreed a new topic",
  abandoned: "Abandoned",
  timeout: "Ran out of time",
};

/** How a game reads on one line when nobody has named the argument yet. */
const UNNAMED = "Not named yet";

/** The other player, when there is one and nobody has renamed them. */
const UNNAMED_PLAYER = "an unnamed player";

/**
 * How long the argument took, once it is over.
 *
 * Only a finished game has both stamps, so a game still running shows nothing
 * rather than a number that keeps growing while you look at it.
 */
function duration(game: GameRow): string | null {
  if (!game.started_at || !game.ended_at) return null;
  const ms = Date.parse(game.ended_at) - Date.parse(game.started_at);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "under a minute";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/**
 * The archive, newest first.
 *
 * The topic leads because it is the only part of a game a player will
 * recognise a week later. Mode, outcome and date used to be the whole row, and
 * three rows reading "Live, All threads resolved" told you nothing about which
 * of them was the one about the parking permits.
 */
function History({
  games,
  topics,
  opponents,
  cardsThrown,
}: {
  games: GameRow[];
  topics: Map<Uuid, GameTopic>;
  opponents: Map<Uuid, string | null>;
  cardsThrown: Map<Uuid, number>;
}) {
  if (games.length === 0) {
    return <p className="opacity-70">No games yet. The first one starts the archive.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-current/10">
      {games.map((game) => {
        const topic = topics.get(game.id);

        // A game nobody has joined yet is absent from the map, which is not the
        // same as a seat filled by somebody who has no name on record.
        const opponent = opponents.has(game.id)
          ? (opponents.get(game.id) ?? UNNAMED_PLAYER)
          : null;

        // Standing throws only, the ones the author did not decline. The same
        // number is the profile's "catches", whose player-facing label is still
        // unresolved (BIZ-T260823-04), so this row says what it counts instead.
        const cards = cardsThrown.get(game.id) ?? 0;
        const detail = [
          duration(game),
          cards > 0 ? `${cards} rule card${cards === 1 ? "" : "s"} thrown` : null,
        ].filter(Boolean);

        return (
          <li key={game.id}>
            <Link
              href={`/game/${game.id}`}
              className="flex items-baseline justify-between gap-4 py-3 hover:underline"
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className={topic ? "" : "opacity-60"}>
                  {topic?.text ?? UNNAMED}
                </span>
                <span className="text-sm opacity-70">
                  {game.mode === "gym" ? "Gym" : "Live"}
                  {opponent ? ` with ${opponent}` : ""}
                  {game.status === "ended"
                    ? `, ${OUTCOME[game.win_condition ?? ""] ?? "Ended"}`
                    : game.status === "active"
                      ? ", in progress"
                      : ", waiting to start"}
                </span>
                {detail.length > 0 ? (
                  <span className="text-sm opacity-50">{detail.join(", ")}</span>
                ) : null}
              </span>
              <span className="shrink-0 text-sm opacity-70">
                <LocalDay iso={game.ended_at ?? game.started_at ?? game.created_at} />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Signature({ stats }: { stats: PlayerStats }) {
  const emoji = Object.entries(stats.resolutions_by_emoji);
  if (emoji.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">How your threads end</h2>
      <ul className="flex flex-wrap gap-4">
        {emoji.map(([mark, count]) => (
          <li key={mark} className="flex items-center gap-2 tabular-nums">
            <TokenGlyph token={mark} size={24} />
            <span>
              {tokenLabel(mark)}: {count}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function AccountPage() {
  const playerId = await currentPlayerId();

  if (!playerId) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
        <h1 className="text-2xl font-semibold">Your account</h1>
        <p className="opacity-70">
          You are not signed in. Starting a game gives you a name and an account, with no
          email and no password. You can attach an email later to keep it.
        </p>
        <StartPlaying />
      </main>
    );
  }

  const [player, stats, games, playedAt] = await Promise.all([
    getPlayer(playerId),
    getPlayerStats(playerId),
    listGamesForPlayer(playerId),
    readPlayDaysForPlayer(playerId),
  ]);
  // A second round trip on purpose: all three of these are keyed by the game
  // ids the first query returned, so they cannot start any earlier. They do run
  // together, since none of them depends on the others.
  const gameIds = games.map((game) => game.id);
  const [topics, opponents, cardsThrown] = await Promise.all([
    readTopicsForGames(gameIds),
    readOpponentsForGames(gameIds, playerId),
    readCardThrowsForGames(gameIds),
  ]);

  return (
    <>
      <SiteNav here="account" />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">
            {player?.display_name ?? "Your account"}
          </h1>
          <p className="text-sm opacity-70">
            {player?.claimed_at ? (
              <>
                Account kept since <LocalDay iso={player.claimed_at} />.
              </>
            ) : (
              "This account is anonymous. Attach an email to keep it."
            )}
          </p>
        </header>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Counter label="Games played" value={stats.games_played} />
          <Counter label="Games finished" value={stats.games_completed} />
          <Counter label="Threads resolved" value={stats.threads_resolved} />
          <Counter label="Tiles placed" value={stats.tiles_placed} />
          {/*
            Two more cards, or none: the streak is worked out in the browser,
            because only the browser knows which day it is where the reader is.
          */}
          <StreakCounters playedAt={playedAt} />
        </section>

        <Signature stats={stats} />

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Your games</h2>
          <History
            games={games}
            topics={topics}
            opponents={opponents}
            cardsThrown={cardsThrown}
          />
        </section>
      </main>
    </>
  );
}
