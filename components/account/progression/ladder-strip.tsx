import { Fragment } from "react";

import type { PlayerAwards } from "@/lib/db/awards";
import { levelById } from "@/lib/gym/levels";
import { type Rung } from "@/lib/progression/sample";
import { designedRungs, ladderFor } from "@/lib/progression/state";
import { Chip, Panel } from "@/components/account/account-shell";
import { BossBriefing } from "@/components/account/progression/boss-briefing";
import { StartLevelButton } from "@/components/gym/start-level-button";

/**
 * The level ladder, one node per LADDER entry, the level select for the Gym,
 * and the boss briefing under it: Rannie's spiral-bound notebook card (Figma
 * `1066:216757`, adopted object by object on 2026-09-04, BRAIN-T260904-40).
 *
 * **Nodes, not tiles.** The old ladder was a row of bordered tiles, each with
 * a label, a badge, a title and (on cleared ones) a card icon, and a dashed
 * box with a padlock for the undesigned rungs. Hers is a row of octagons with
 * dashes between them and the name in caps underneath, and the state is the
 * colour: teal for cleared, orange with a star for current, a grey outline for
 * everything ahead. A padlock says "you are not allowed"; a grey outline says
 * "not yet", which is the truthful one, since all four scripted levels are
 * open regardless of cleared state (Steve, 2026-09-03).
 *
 * **The pointer.** An orange bar with a caret hangs off the current node and
 * points down at the boss, so the ladder and the briefing read as one object:
 * "you are here, and this is who is waiting."
 *
 * Rannie's frame draws L1 to L8 with her own eight names. LADDER reads
 * whatever length it has and the four designed rungs keep our names; her
 * ladder above level 4 is one of the undecided systems (BRAIN-T260817-02) and
 * is not resolved here. The count reads against the designed rungs, so an
 * untouched account says "0 / 4 cleared" rather than "0 / 8".
 *
 * `id="ladder"` is a navigation target: `/gym` redirects to `/#ladder`
 * (Steve, 2026-09-04) because this panel is the level select.
 */

const OCTAGON_CLIP =
  "polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%)";

function Node({ rung }: { rung: Rung }) {
  const current = rung.status === "current";
  const cleared = rung.status === "cleared";
  const fill = cleared
    ? "bg-stat-good text-card"
    : current
      ? "bg-orange text-ink"
      : "bg-card text-ink-soft/60";
  // clip-path eats a CSS border, so the outline on the unreached nodes is a
  // slightly larger ink octagon behind the fill.
  const ring = cleared || current ? "bg-ink" : "bg-ink/35";

  return (
    <span
      aria-hidden
      style={{ clipPath: OCTAGON_CLIP }}
      className={`flex h-14 w-14 items-center justify-center ${ring}`}
    >
      <span
        style={{ clipPath: OCTAGON_CLIP }}
        className={`font-figure flex h-[calc(100%-3px)] w-[calc(100%-3px)] items-center justify-center text-lg font-black tabular-nums ${fill}`}
      >
        {current ? "★" : `L${rung.level}`}
      </span>
    </span>
  );
}

function RungNode({ rung }: { rung: Rung }) {
  const current = rung.status === "current";
  const cleared = rung.status === "cleared";
  const level = levelById(rung.id);
  const label = rung.title ?? "Locked";
  const labelTone = cleared
    ? "text-stat-good"
    : current
      ? "text-ink"
      : "text-ink-soft/70";

  const body = (
    <>
      <Node rung={rung} />
      <span
        className={`font-label max-w-[6rem] text-center text-[10px] leading-tight font-bold tracking-widest uppercase ${labelTone}`}
      >
        {label}
      </span>
    </>
  );

  const shape = "flex w-24 shrink-0 flex-col items-center gap-2";

  return (
    <li className="relative flex flex-col items-center">
      {level ? (
        <StartLevelButton
          levelId={level.id}
          className={`${shape} transition-transform hover:-translate-y-0.5`}
        >
          {body}
        </StartLevelButton>
      ) : (
        <span
          aria-label={
            rung.title
              ? `Level ${rung.level}, ${rung.title}`
              : `Level ${rung.level}, not yet designed`
          }
          className={shape}
        >
          {body}
        </span>
      )}
      {current ? (
        <span
          aria-hidden
          className="pointer-events-none absolute top-full left-1/2 mt-3 -translate-x-1/2"
        >
          <span className="bg-orange border-ink block h-2.5 w-24 rounded-full border-[1.5px]" />
          <span className="border-ink bg-orange absolute top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-r-[1.5px] border-b-[1.5px]" />
        </span>
      ) : null}
    </li>
  );
}

export function LadderStrip({ awards }: { awards: PlayerAwards }) {
  const rungs = ladderFor(awards);
  const cleared = rungs.filter((rung) => rung.status === "cleared").length;
  const current = rungs.find((rung) => rung.status === "current") ?? null;

  return (
    <Panel id="ladder" className="hex-confetti hex-confetti-tl mb-8 !pt-0">
      <div className="notebook-rings -mx-6" />
      <div className="flex flex-wrap items-center gap-3 pt-4 pb-6">
        <h2 className="font-figure text-ink text-2xl font-black tracking-wide uppercase">
          Level progress ladder
        </h2>
        <Chip tone="good">
          {cleared} / {designedRungs()} cleared
        </Chip>
        <span className="font-label text-ink-soft text-[10px] font-bold tracking-widest uppercase">
          Pick a level to enter the gym
        </span>
      </div>
      <ol className="flex items-start overflow-x-auto pb-8">
        {rungs.map((rung, i) => (
          <Fragment key={rung.level}>
            {i > 0 ? (
              <li
                aria-hidden
                className="border-ink/40 mt-7 w-6 shrink-0 border-t-2 border-dashed"
              />
            ) : null}
            <RungNode rung={rung} />
          </Fragment>
        ))}
      </ol>
      {current ? <BossBriefing rung={current} awards={awards} /> : null}
    </Panel>
  );
}
