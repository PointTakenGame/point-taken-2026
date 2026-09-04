import Link from "next/link";

import { currentPlayerId } from "@/lib/supabase/session";
import { readPlayerAwards } from "@/lib/db/awards";
import type { GameTopic } from "@/lib/db/games";
import type { PlayerStats } from "@/lib/db/stats";
import type { Uuid } from "@/lib/events/types";
import { Counter } from "@/components/counter";
import { LocalDay } from "@/components/local-day";
import { ResumeOrStart } from "@/components/resume-or-start";
import { StreakCounters } from "@/components/streak-counters";
import { AccountShell, Panel, SectionHeading } from "@/components/account/account-shell";
import { MatchList } from "@/components/account/match-list";
import { ActiveBoss } from "@/components/account/progression/active-boss";
import { BadgeStrip } from "@/components/account/progression/badge-strip";
import { CertificateWall } from "@/components/account/progression/certificate-wall";
import { LadderStrip } from "@/components/account/progression/ladder-strip";
import { StatTiles } from "@/components/account/progression/stat-tiles";
import { StartPlaying } from "./start-playing";
import { TokenGlyph, tokenLabel } from "@/components/board/token-glyph";
import { Avatar } from "@/components/avatar";
import { joinedThisWeek, loadAccount } from "./data";

/**
 * The Profile tab: who this player is and what they have done.
 *
 * Rebuilt 2026-09-02 from Rannie's Profile frame (Figma `1066:216757`, spec
 * BRAIN-T260902-21) on Steve's instruction to make her account flow the base
 * for this area. What comes from her: the four-tab hub this page now sits in,
 * the identity row of avatar-plus-name-plus-joined-date with a band of stat
 * blocks beside it, the sticker panels, the "View All" link out of a section
 * that continues on another tab, and the type pairing throughout.
 *
 * The widgets her frame also draws, that an earlier ruling had left out (a
 * level ladder, a stat row with a cooperation score and a ladder rank, an
 * active boss challenge, a certificate wall, and a recent-badges strip), are
 * built now, above the sections listed above. Steve, 2026-09-03: the
 * progression layer behind them waits on Nathan's script, but "design the
 * screen that summarizes what happened, just fake some data," and on these
 * specific widgets, "these are just tiles on a website with db queries behind
 * them. I would rather have more fake ones now as inspiration and remove them
 * later. We will be iterating on them anyway." (BRAIN-T260903-10,
 * BRAIN-T260903-11.)
 *
 * Those widgets were built on invented numbers, because at the time nothing
 * wrote an award anywhere. Since 0014_awards.sql something does: clearing a
 * level appends level_cleared, badge_granted, points_changed and
 * certificate_granted, and every widget above now reads this player's own
 * awards through lib/progression/state.ts. What is left of the invented set is
 * the shape of the ladder above level 4 and the display names of the badges,
 * and only those still carry a "Sample" tag.
 *
 * Not built: a calendar of scheduled events with sign-ups and a countdown,
 * which stayed out because there is no event system anywhere in this codebase
 * to fake data for, only a UI to draw.
 *
 * The archive itself moved to /account/history, which is her own arrangement:
 * History is one of the four tabs. This page keeps the four most recent games,
 * because a profile with no games visible on it is a profile that does not know
 * you.
 */

export const dynamic = "force-dynamic";

/** How many of the archive fits on the profile before it becomes the archive. */
const RECENT = 4;

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

function Signature({ stats }: { stats: PlayerStats }) {
  const emoji = Object.entries(stats.resolutions_by_emoji);
  if (emoji.length === 0) return null;

  return (
    <Panel>
      <SectionHeading title="How your threads end" />
      <ul className="flex flex-wrap gap-6">
        {emoji.map(([mark, count]) => (
          <li key={mark} className="flex items-center gap-2">
            <TokenGlyph token={mark} size={40} />
            <span className="flex flex-col">
              <span className="font-figure text-ink text-2xl leading-none font-black tabular-nums">
                {count}
              </span>
              <span className="font-label text-ink-soft text-[11px] font-bold tracking-widest uppercase">
                {tokenLabel(mark)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export default async function AccountPage() {
  const playerId = await currentPlayerId();

  if (!playerId) {
    return (
      <AccountShell tab="profile">
        <Panel className="flex max-w-2xl flex-col items-start gap-4">
          <h1 className="font-primary text-ink text-3xl tracking-wide">Your account</h1>
          <p className="text-ink-soft font-secondary">
            You are not signed in. Starting a game gives you a name and an account, with
            no email and no password. You can attach an email later to keep it.
          </p>
          <StartPlaying />
        </Panel>
      </AccountShell>
    );
  }

  const [
    { player, stats, games, playedAt, topics, opponents, cardsThrown, resolutions },
    awards,
  ] = await Promise.all([loadAccount(playerId), readPlayerAwards(playerId)]);

  // The game to offer going back to. `games` is already newest first, so the
  // first hit is the most recent one. A game underway beats a room still
  // waiting for its second player, because the argument you left in the middle
  // is more urgent than the invitation nobody accepted.
  const inFlight =
    games.find((game) => game.status === "active") ??
    games.find((game) => game.status === "lobby") ??
    null;

  const thisWeek = joinedThisWeek(playedAt);
  // Nobody wants to read "0 per game" on a profile with no games in it.
  const perGame =
    stats.games_played > 0
      ? (stats.tiles_placed / stats.games_played).toFixed(1).replace(/\.0$/, "")
      : null;

  return (
    <AccountShell tab="profile">
      <LadderStrip awards={awards} />
      <StatTiles awards={awards} stats={stats} gamesThisWeek={thisWeek} />
      <ActiveBoss awards={awards} />
      <CertificateWall awards={awards} />
      <BadgeStrip awards={awards} />

      {/*
        Her top row is two promo cards side by side: an active boss challenge on
        the left, and "Play with your peers" with Gym and Live buttons on the
        right. The active-boss card is above now, built on sample data; this row
        is still the right-hand card alone, widened, with the one action this
        page actually has.
      */}
      <Panel className="mb-8 flex flex-col gap-4">
        <SectionHeading title="Play with your peers" />
        <div className="flex flex-wrap items-start justify-between gap-6">
          <p className="text-ink-soft font-secondary max-w-lg">
            Invite somebody you disagree with and play live, or take a practice round in
            the Gym on your own first.
          </p>
          <Link
            href="/gym"
            className="font-primary border-ink text-ink hover:bg-sand rounded-full border px-6 py-2 tracking-wide uppercase transition-colors"
          >
            Gym play
          </Link>
        </div>
        <ResumeOrStart
          gameId={inFlight?.id ?? null}
          waiting={inFlight?.status === "lobby"}
          topic={inFlight ? (topics.get(inFlight.id)?.text ?? null) : null}
        />
      </Panel>

      <Panel className="mb-8">
        <div className="flex flex-wrap items-center gap-6 pb-6">
          <Avatar playerId={playerId} name={player?.display_name ?? null} size="xl" />
          <div className="flex flex-col gap-1">
            <h1 className="font-figure text-ink text-3xl font-black tracking-wide uppercase">
              {player?.display_name ?? "Your account"}
            </h1>
            <p className="font-label text-ink-soft text-sm">
              {player?.claimed_at ? (
                <>
                  Player since <LocalDay iso={player.claimed_at} />
                </>
              ) : (
                "This account is anonymous. Attach an email to keep it."
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Counter
            label="Games played"
            value={stats.games_played}
            note={thisWeek > 0 ? `+${thisWeek} this week` : undefined}
          />
          {/*
            "Ended", not "finished": `games_completed` counts every game whose
            status reached `ended`, which includes one somebody walked out of.
            Calling that finished contradicts the history row, which reads
            "Unfinished" for the same game. The stricter number (games that
            reached a win condition) cannot be worked out here, because
            `listGamesForPlayer` is capped at fifty and a headline stat derived
            from a capped list quietly goes wrong on the fifty-first game.
            Splitting the two is a stats change, so it is flagged rather than
            made: BRAIN-T260824-29.
          */}
          <Counter label="Games ended" value={stats.games_completed} />
          <Counter label="Topics debated" value={countTopics(topics)} />
          <Counter
            label="Threads resolved"
            value={stats.threads_resolved}
            noteTone="good"
          />
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
        </div>
      </Panel>

      <div className="mb-8">
        <Signature stats={stats} />
      </div>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <SectionHeading
            title="Recent matches"
            note={`${games.length} game${games.length === 1 ? "" : "s"}`}
          />
          {games.length > RECENT ? (
            <Link
              href="/account/history"
              className="font-label text-ink hover:text-stat-warm text-sm font-bold transition-colors"
            >
              View all &rarr;
            </Link>
          ) : null}
        </div>
        <MatchList
          games={games.slice(0, RECENT)}
          topics={topics}
          opponents={opponents}
          cardsThrown={cardsThrown}
          resolutions={resolutions}
          empty="No games yet. The first one starts the archive."
        />
      </section>
    </AccountShell>
  );
}
