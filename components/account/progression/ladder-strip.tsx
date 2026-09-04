import { coachCard } from "@/lib/coach/cards";
import type { PlayerAwards } from "@/lib/db/awards";
import { type Rung } from "@/lib/progression/sample";
import { designedRungs, ladderFor } from "@/lib/progression/state";
import { Panel, SectionHeading } from "@/components/account/account-shell";

/**
 * One step of the ladder.
 *
 * A locked rung has no id, title or card yet (LADDER's rungs 5 and up), so it
 * shows only its number and a lock glyph rather than guessing at a name. A
 * cleared or current rung shows the card its level teaches; an open rung is
 * plain on purpose, per the ruling that only cleared and current rungs earn
 * the card icon.
 */
function RungTile({ rung }: { rung: Rung }) {
  if (rung.status === "locked") {
    return (
      <li
        aria-label={`Level ${rung.level}, locked`}
        className="border-ink/30 text-ink-soft flex min-w-[4.5rem] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border-[1.5px] border-dashed px-3 py-4"
      >
        <span aria-hidden className="text-lg leading-none">
          🔒
        </span>
        <span className="font-figure text-lg font-black tabular-nums">{rung.level}</span>
      </li>
    );
  }

  const current = rung.status === "current";
  const card =
    current || rung.status === "cleared" ? coachCard(rung.cardId ?? "") : undefined;

  return (
    <li
      aria-current={current ? "step" : undefined}
      className={`border-ink flex min-w-[7rem] shrink-0 flex-col items-center gap-1 rounded-2xl border-[1.5px] px-4 py-4 text-center ${
        current ? "bg-orange shadow-sticker-sm" : "bg-card"
      }`}
    >
      <span
        className={`font-label text-[10px] font-bold tracking-widest uppercase ${
          current ? "text-ink" : "text-ink-soft"
        }`}
      >
        Level {rung.level}
      </span>
      <span className="font-figure text-ink text-sm leading-tight font-black uppercase">
        {rung.title}
      </span>
      {card ? (
        <span aria-hidden className="text-xl leading-none">
          {card.icon}
        </span>
      ) : null}
    </li>
  );
}

/**
 * The level ladder, one rung per LADDER entry.
 *
 * Rannie's profile frame draws L1 to L8. LADDER may grow past eight (Steve,
 * 2026-09-03: "on the newest planning with Nathan we may even have 10
 * rungs"), so this reads LADDER.length rather than assuming a count, and lays
 * the strip out with no fixed widths: it scrolls inside its own
 * overflow-x-auto rather than squeezing rungs to fit a row built for four.
 *
 * Which rungs are cleared is now real: it comes off the player's own
 * level_cleared events (lib/progression/state.ts). The count reads against the
 * designed rungs rather than every drawn one, so an untouched account says
 * "0 / 4 cleared" rather than "0 / 8" against four levels that do not exist.
 */
export function LadderStrip({ awards }: { awards: PlayerAwards }) {
  const rungs = ladderFor(awards);
  const cleared = rungs.filter((rung) => rung.status === "cleared").length;

  return (
    <Panel className="mb-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <SectionHeading
          title="Level ladder"
          note={`${cleared} / ${designedRungs()} cleared`}
          noteTone="good"
        />
      </div>
      <ul className="flex gap-3 overflow-x-auto pb-1">
        {rungs.map((rung) => (
          <RungTile key={rung.level} rung={rung} />
        ))}
      </ul>
    </Panel>
  );
}
