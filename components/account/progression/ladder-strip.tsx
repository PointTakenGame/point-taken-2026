import { coachCard } from "@/lib/coach/cards";
import type { PlayerAwards } from "@/lib/db/awards";
import { levelById } from "@/lib/gym/levels";
import { type Rung } from "@/lib/progression/sample";
import { designedRungs, ladderFor } from "@/lib/progression/state";
import { Panel, SectionHeading } from "@/components/account/account-shell";
import { StartLevelButton } from "@/components/gym/start-level-button";

/**
 * The octagon badge Rannie draws for a rung, holding the level number.
 *
 * A plain clip-path rather than an SVG, because the only thing inside it is a
 * number and the tile already sets the fill and text colour.
 */
const OCTAGON_CLIP =
  "polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%)";

function OctagonBadge({ level, current }: { level: number; current: boolean }) {
  return (
    <span
      aria-hidden
      style={{ clipPath: OCTAGON_CLIP }}
      className={`font-figure flex h-9 w-9 items-center justify-center text-base font-black tabular-nums ${
        current ? "bg-ink text-orange" : "bg-ink text-card"
      }`}
    >
      {level}
    </span>
  );
}

/**
 * One step of the ladder.
 *
 * A locked rung has no id, title or card yet (LADDER's rungs 5 and up), so it
 * shows only its number and a lock glyph rather than guessing at a name.
 *
 * Every other rung is the level select now (Steve, 2026-09-04): clicking on
 * "Enter the gym" used to hand a player off to a second nav bar with its own
 * page; now the ladder rung itself starts the level, through the same
 * `StartLevelButton` the old Gym page used. All four scripted levels are open
 * regardless of cleared state (Steve, 2026-09-03), so a rung is clickable
 * whenever it has a matching scripted level, not only once it becomes
 * current. Cleared rungs keep the card icon; the current rung stays orange.
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
  const cleared = rung.status === "cleared";
  const card = current || cleared ? coachCard(rung.cardId ?? "") : undefined;
  const level = levelById(rung.id);

  const tileClass = `border-ink flex min-w-[7rem] flex-col items-center gap-1 rounded-2xl border-[1.5px] px-4 py-4 text-center transition-transform hover:-translate-y-0.5 ${
    current ? "bg-orange shadow-sticker-sm" : "bg-card"
  }`;

  const body = (
    <>
      <span
        className={`font-label text-[10px] font-bold tracking-widest uppercase ${
          current ? "text-ink" : "text-ink-soft"
        }`}
      >
        Level {rung.level}
      </span>
      <OctagonBadge level={rung.level} current={current} />
      <span className="font-figure text-ink text-sm leading-tight font-black uppercase">
        {rung.title}
      </span>
      {cleared && card ? (
        <span aria-hidden className="text-xl leading-none">
          {card.icon}
        </span>
      ) : null}
    </>
  );

  if (level) {
    return (
      <li className="shrink-0">
        <StartLevelButton levelId={level.id} className={tileClass}>
          {body}
        </StartLevelButton>
      </li>
    );
  }

  // No scripted level to start yet (rungs above 4 once they gain an id
  // before a level is written for them). Falls back to the plain, unclickable
  // tile rather than a dead button.
  return (
    <li aria-current={current ? "step" : undefined} className={`${tileClass} shrink-0`}>
      {body}
    </li>
  );
}

/**
 * The level ladder, one rung per LADDER entry, and the level select for the
 * Gym.
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
 *
 * `id="ladder"` is a navigation target now, not decoration: `/gym` is a
 * redirect to `/#ladder` (Steve, 2026-09-04), because there is no longer a
 * second out-of-game nav to hand a player off to, and this panel is the
 * level select.
 */
export function LadderStrip({ awards }: { awards: PlayerAwards }) {
  const rungs = ladderFor(awards);
  const cleared = rungs.filter((rung) => rung.status === "cleared").length;

  return (
    <Panel id="ladder" className="mb-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <SectionHeading
          title="Level progress ladder"
          note={`${cleared} / ${designedRungs()} cleared · Pick a level to enter the gym`}
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
