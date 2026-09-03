import { PROFILE_STATS, THROW_POINTS } from "@/lib/progression/sample";
import { Panel, SectionHeading } from "@/components/account/account-shell";
import { SampleTag } from "./sample-tag";

/**
 * One stat block, styled like components/counter.tsx's sticker tile. Not
 * reused directly: Counter takes a raw number and this row needs formatted
 * figures ("#31", "8.4") that Counter has no way to print.
 */
function Tile({ label, figure, note }: { label: string; figure: string; note: string }) {
  return (
    <div className="sticker flex flex-col gap-1 p-4">
      <div className="font-label text-ink-soft min-h-[2lh] text-[11px] font-bold tracking-widest uppercase">
        {label}
      </div>
      <div className="font-figure text-ink text-4xl leading-none font-black tabular-nums">
        {figure}
      </div>
      <div className="font-label text-stat-warm text-xs font-semibold">{note}</div>
    </div>
  );
}

/**
 * Four of Rannie's stat blocks that the real-data identity panel below does
 * not carry: points, cooperation score, and ladder rank have no formula
 * behind them yet, only the numbers she drew (see the header of
 * lib/progression/sample.ts). Games played duplicates the real counter
 * further down the page on purpose, so this row reads as one dashboard rather
 * than three sample figures next to one blank space.
 */
export function StatTiles() {
  const s = PROFILE_STATS;
  const throwsPlaced = Math.round(s.points / THROW_POINTS);

  return (
    <Panel className="mb-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <SectionHeading title="Progress" />
        <SampleTag />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Tile
          label="Games played"
          figure={String(s.gamesPlayed)}
          note={`+${s.gamesThisWeek} this week`}
        />
        <Tile
          label="Points"
          figure={String(s.points)}
          note={`${throwsPlaced} clean throws`}
        />
        <Tile
          label="Cooperation score"
          figure={s.cooperationScore.toFixed(1)}
          note={`Top ${s.cooperationPercentile}% globally`}
        />
        <Tile
          label="Ladder rank"
          figure={`#${s.ladderRank}`}
          note={`${s.division} division`}
        />
      </div>
    </Panel>
  );
}
