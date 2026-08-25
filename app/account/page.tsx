import Link from "next/link";
import { currentPlayerId } from "@/lib/supabase/session";
import { getPlayer } from "@/lib/db/players";
import { getPlayerStats, type PlayerStats } from "@/lib/db/stats";
import {
  listGamesForPlayer,
  readCardThrowsForGames,
  readOpponentsForGames,
  readPlayDaysForPlayer,
  readResolutionsForGames,
  readTopicsForGames,
  type GameTopic,
} from "@/lib/db/games";
import type { GameMode, GameRow } from "@/lib/db/types";
import type { Uuid } from "@/lib/events/types";
import { Counter } from "@/components/counter";
import { LocalDay } from "@/components/local-day";
import { ResumeOrStart } from "@/components/resume-or-start";
import { StreakCounters } from "@/components/streak-counters";
import { SiteNav } from "@/components/site-nav";
import { StartPlaying } from "./start-playing";
import { TokenGlyph, tokenLabel } from "@/components/board/token-glyph";
import { Avatar } from "@/components/avatar";

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
  abandoned: "Left unfinished",
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
 * How many of these games were joined in the last seven days.
 *
 * Deliberately a rolling 168 hours rather than "since Monday" or "today minus
 * six days". A rolling window needs no notion of where the reader is or when
 * their week starts, so unlike the streak it is safe to work out on the server.
 */
function joinedThisWeek(playedAt: readonly string[], now = Date.now()): number {
  const cutoff = now - 7 * 24 * 60 * 60 * 1000;
  return playedAt.filter((iso) => {
    const at = Date.parse(iso);
    return Number.isFinite(at) && at >= cutoff && at <= now;
  }).length;
}

/**
 * How many different things this player has argued about.
 *
 * Matched on the text, case and surrounding space ignored, so arguing the same
 * question twice counts once. A topic whose text has been redacted is left out
 * rather than counted: the text is gone on purpose, and counting it would mean
 * guessing whether it was a repeat.
 */
function countTopics(topics: Map<Uuid, GameTopic>): number {
  const seen = new Set<string>();
  for (const topic of topics.values()) {
    if (topic.redacted) continue;
    const key = topic.text.trim().toLowerCase();
    if (key) seen.add(key);
  }
  return seen.size;
}

/** The two kinds of game, in the words the history uses. */
const MODE_LABEL: Record<GameMode, string> = { gym: "Gym", live: "Live" };

/** Only a real mode narrows the list. Anything else in the URL is ignored. */
function readMode(raw: string | undefined): GameMode | null {
  return raw === "gym" || raw === "live" ? raw : null;
}

/**
 * Narrow the history to one kind of game.
 *
 * Links rather than tabs, so the choice is in the URL: it survives a reload,
 * it can be sent to somebody, and it works before any JavaScript arrives. The
 * caller renders this only when the player actually has both kinds, because a
 * filter with one populated side is a control that does nothing.
 */
function ModeFilter({ modes, active }: { modes: GameMode[]; active: GameMode | null }) {
  const options: { value: GameMode | null; label: string; href: string }[] = [
    { value: null, label: "All", href: "/account" },
    ...modes.map((mode) => ({
      value: mode,
      label: MODE_LABEL[mode],
      href: `/account?mode=${mode}`,
    })),
  ];

  return (
    <nav aria-label="Filter games" className="flex gap-3 text-sm">
      {options.map((option) => (
        <Link
          key={option.label}
          href={option.href}
          aria-current={option.value === active ? "true" : undefined}
          className={
            option.value === active
              ? "font-semibold underline"
              : "opacity-70 hover:underline"
          }
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
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
  resolutions,
  filtered,
}: {
  games: GameRow[];
  topics: Map<Uuid, GameTopic>;
  opponents: Map<Uuid, string | null>;
  cardsThrown: Map<Uuid, number>;
  resolutions: Map<Uuid, Map<string, number>>;
  /** True when a filter is on, so an empty list means filtered out, not new. */
  filtered: boolean;
}) {
  if (games.length === 0) {
    return (
      <p className="opacity-70">
        {filtered
          ? "No games of that kind yet."
          : "No games yet. The first one starts the archive."}
      </p>
    );
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

        // How the threads in this game ended. The profile totals the same
        // tokens across every game; this is that game's share of them.
        const tokens = [...(resolutions.get(game.id) ?? [])];

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
                {tokens.length > 0 ? (
                  <span className="flex flex-wrap items-center gap-3 pt-0.5">
                    {tokens.map(([token, count]) => (
                      <span
                        key={token}
                        title={tokenLabel(token)}
                        className="flex items-center gap-1 text-sm tabular-nums opacity-70"
                      >
                        <TokenGlyph token={token} size={16} />
                        {count}
                      </span>
                    ))}
                  </span>
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

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
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
  const [topics, opponents, cardsThrown, resolutions] = await Promise.all([
    readTopicsForGames(gameIds),
    readOpponentsForGames(gameIds, playerId),
    readCardThrowsForGames(gameIds),
    readResolutionsForGames(gameIds),
  ]);

  // The game to offer going back to. `games` is already newest first, so the
  // first hit is the most recent one. A game underway beats a room still
  // waiting for its second player, because the argument you left in the middle
  // is more urgent than the invitation nobody accepted.
  const inFlight =
    games.find((game) => game.status === "active") ??
    games.find((game) => game.status === "lobby") ??
    null;

  // The filter narrows the list below and nothing else. Every counter on this
  // page is a lifetime number, and a filtered lifetime is not a thing.
  const mode = readMode((await searchParams).mode);
  const modes = [...new Set(games.map((game) => game.mode))];
  const shown = mode ? games.filter((game) => game.mode === mode) : games;

  const thisWeek = joinedThisWeek(playedAt);
  // Nobody wants to read "0 per game" on a profile with no games in it.
  const perGame =
    stats.games_played > 0
      ? (stats.tiles_placed / stats.games_played).toFixed(1).replace(/\.0$/, "")
      : null;

  return (
    <>
      <SiteNav here="account" />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-8">
        <header className="flex items-center gap-4">
          <Avatar playerId={playerId} name={player?.display_name ?? null} size="lg" />
          <div className="flex flex-col gap-1">
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
          </div>
        </header>

        <ResumeOrStart
          gameId={inFlight?.id ?? null}
          waiting={inFlight?.status === "lobby"}
          topic={inFlight ? (topics.get(inFlight.id)?.text ?? null) : null}
        />

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Counter
            label="Games played"
            value={stats.games_played}
            note={thisWeek > 0 ? `+${thisWeek} this week` : undefined}
          />
          {/*
            "Ended", not "finished": `games_completed` counts every game whose
            status reached `ended`, which includes one somebody walked out of.
            Calling that finished contradicts the history row right below it,
            which reads "Left unfinished" for the same game. The stricter number
            (games that reached a win condition) cannot be worked out here,
            because `listGamesForPlayer` is capped at fifty and a headline stat
            derived from a capped list quietly goes wrong on the fifty-first
            game. Splitting the two is a stats change, so it is flagged rather
            than made: BRAIN-T260824-29.
          */}
          <Counter label="Games ended" value={stats.games_completed} />
          <Counter label="Topics debated" value={countTopics(topics)} />
          <Counter label="Threads resolved" value={stats.threads_resolved} />
          <Counter
            label="Tiles placed"
            value={stats.tiles_placed}
            note={perGame === null ? undefined : `${perGame} per game`}
          />
          {/*
            Two more cards, or none: the streak is worked out in the browser,
            because only the browser knows which day it is where the reader is.
          */}
          <StreakCounters playedAt={playedAt} />
        </section>

        <Signature stats={stats} />

        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold">Your games</h2>
            {modes.length > 1 ? <ModeFilter modes={modes} active={mode} /> : null}
          </div>
          <History
            games={shown}
            topics={topics}
            opponents={opponents}
            cardsThrown={cardsThrown}
            resolutions={resolutions}
            filtered={mode !== null}
          />
        </section>
      </main>
    </>
  );
}
