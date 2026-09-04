import Link from "next/link";

import type { PlayerAwards } from "@/lib/db/awards";
import type { PlayerStats } from "@/lib/db/stats";
import { Panel, SectionHeading } from "@/components/account/account-shell";

/**
 * One stat block, styled like components/counter.tsx's sticker tile. Not
 * reused directly: Counter takes a raw number and this row needs formatted
 * figures ("#31", "8.4") that Counter has no way to print, and one of these
 * tiles is a link.
 */
function Tile({
  label,
  figure,
  note,
  href,
}: {
  label: string;
  figure: string;
  note: string;
  href?: string;
}) {
  const body = (
    <>
      <div className="font-label text-ink-soft min-h-[2lh] text-[11px] font-bold tracking-widest uppercase">
        {label}
      </div>
      <div className="font-figure text-ink text-4xl leading-none font-black tabular-nums">
        {figure}
      </div>
      <div
        className={`font-label text-stat-warm text-xs font-semibold ${
          href ? "underline decoration-dotted" : ""
        }`}
      >
        {note}
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="sticker flex flex-col gap-1 p-4 transition-transform hover:-translate-y-0.5"
      >
        {body}
      </Link>
    );
  }
  return <div className="sticker flex flex-col gap-1 p-4">{body}</div>;
}

/**
 * Rannie's stat row, on real figures.
 *
 * Every number here now has a formula behind it and a place it is computed:
 *
 * - Games played and cooperation come from `player_stats` (0005_player_stats.sql).
 * - Points come from the player's own points_changed events (0014_awards.sql).
 * - Levels cleared comes from their level_cleared events.
 *
 * **Cooperation score is threads agreed, and only that.** Steve, 2026-09-03:
 * one definition, the leaderboard's existing column, and this tile links to
 * it. There is no second formula and no percentile: the earlier
 * "Top n% globally" figure was invented, and a percentile needs a population
 * query nobody has written.
 *
 * Gone with it: the ladder rank and division tiles. Ranked divisions are ruled
 * out of scope (Steve, 2026-09-03), so a tile that shows one is a promise this
 * game does not intend to keep.
 */
export function StatTiles({
  awards,
  stats,
  gamesThisWeek,
}: {
  awards: PlayerAwards;
  stats: PlayerStats;
  gamesThisWeek: number;
}) {
  const cleared = awards.clearedLevels.length;

  return (
    <Panel className="mb-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <SectionHeading title="Progress" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Tile
          label="Games played"
          figure={String(stats.games_played)}
          note={gamesThisWeek > 0 ? `+${gamesThisWeek} this week` : "All time"}
        />
        <Tile
          label="Points"
          figure={String(awards.points)}
          note={
            cleared > 0
              ? `${cleared} level${cleared === 1 ? "" : "s"} cleared`
              : "None yet"
          }
        />
        <Tile
          label="Cooperation score"
          figure={String(stats.threads_resolved)}
          note="Threads agreed · see the leaderboard"
          href="/leaderboard?by=cooperation"
        />
        <Tile
          label="Tiles placed"
          figure={String(stats.tiles_placed)}
          note={`${stats.games_completed} game${stats.games_completed === 1 ? "" : "s"} ended`}
        />
      </div>
    </Panel>
  );
}
