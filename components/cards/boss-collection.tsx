import Image from "next/image";

import { bossArt, bossPlaqueInk } from "@/lib/progression/art";
import { BOSSES } from "@/lib/progression/sample";
import { SampleTag } from "./sample-tag";

/**
 * The boss collection: one plaque per lib/progression/sample.ts's BOSSES.
 *
 * Ruled on by Steve 2026-09-03 (BRAIN-T260903-11): "these are just tiles on a
 * website with db queries behind them." Nothing here is derived from a game
 * you actually played; the level ladder that would make it real is not built
 * yet, so every tile is sample data.
 *
 * "Reformed" is Rannie's word for a boss you beat: the boss does not lose,
 * they learn the rule, which is the only ending this game has.
 *
 * The plaque is her artwork from Boss Collection `790:111876` (Steve,
 * 2026-09-07, "Ranny's Figma also had a suggestion for the artwork here"):
 * an octagonal plaque in that level's colour, a honeycomb wash over it, the
 * level chip in the top corner, a REFORMED band across the middle, and the
 * name in white under the band. Her drawn figure sits on the plaque as of
 * 2026-09-07; a boss with no drawing falls back to the emoji. The habit
 * sentence her plaques have no room for sits under the plaque instead.
 *
 * Her ladder is eight bosses in a different order, and the four she draws at
 * the levels we have built are named exactly what ours are, so each portrait
 * lands on the boss it was drawn for. Levels 5 to 8 stay anonymous: she has
 * four more characters, but naming a boss for a rule nobody has written is a
 * promise (Steve's own 2026-09-03 call on rule cards 5 to 11).
 *
 * A boss she drew wears the colour she drew them in (BOSS_PLAQUE_INK in
 * lib/progression/art.ts), because her figures are single-hue and clash on
 * any other ground. PLAQUE_INK below is the fallback for a boss with no
 * drawing: a spectrum walking level 1 to 8, which is her palette.
 */

const PLAQUE_INK = [
  "#3ab0a4",
  "#4fbe6e",
  "#a8bb3c",
  "#5079d8",
  "#8a5fd0",
  "#c162c6",
  "#dd5a52",
  "#ec8f3c",
];

function plaqueInk(id: string, level: number): string {
  return bossPlaqueInk(id) ?? PLAQUE_INK[(level - 1) % PLAQUE_INK.length];
}

function BossTile({ boss }: { boss: (typeof BOSSES)[number] }) {
  const locked = boss.status === "locked";
  const art = locked ? null : bossArt(boss.id);

  return (
    <li className="flex flex-col items-center gap-2">
      <div
        className={`boss-plaque octagon w-full ${locked ? "opacity-45 grayscale" : ""}`}
      >
        <div
          className="boss-plaque-face octagon honeycomb"
          style={{ "--plaque": plaqueInk(boss.id, boss.level) } as React.CSSProperties}
        >
          {/* A locked plaque's name is already "Level 5", so no chip on those. */}
          {locked ? null : (
            <span className="boss-plaque-level font-label text-[10px] font-bold tracking-widest uppercase">
              L{boss.level}
            </span>
          )}
          {art ? (
            <Image
              src={art}
              alt=""
              width={360}
              height={360}
              className="mt-1 h-24 w-24 object-contain"
            />
          ) : (
            <span aria-hidden className="pt-3 text-5xl leading-none">
              {locked ? "❔" : boss.emoji}
            </span>
          )}
          <span className="boss-plaque-band font-label mt-auto text-[10px] font-bold tracking-[0.25em] uppercase">
            {locked
              ? "Not yet met"
              : boss.status === "reformed"
                ? "Reformed"
                : "In progress"}
          </span>
          <h3 className="boss-plaque-name font-figure text-base leading-tight font-black tracking-wide uppercase">
            {locked ? `Level ${boss.level}` : boss.name}
          </h3>
        </div>
      </div>
      {locked ? null : (
        <p className="font-secondary text-ink-soft text-p-sm text-center">{boss.habit}</p>
      )}
    </li>
  );
}

export function BossCollection() {
  return (
    <section className="mb-8">
      <div className="pb-4">
        <SampleTag />
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
        {BOSSES.map((boss) => (
          <BossTile key={boss.id} boss={boss} />
        ))}
      </ul>
    </section>
  );
}
