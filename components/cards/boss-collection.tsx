import { BOSSES } from "@/lib/progression/sample";
import { SampleTag } from "./sample-tag";

/**
 * The boss collection: one tile per lib/progression/sample.ts's BOSSES.
 *
 * Ruled on by Steve 2026-09-03 (BRAIN-T260903-11): "these are just tiles on a
 * website with db queries behind them." Nothing here is derived from a game
 * you actually played; the level ladder that would make it real is not built
 * yet, so every tile is sample data.
 *
 * "Reformed" is Rannie's word for a boss you beat: the boss does not lose,
 * they learn the rule, which is the only ending this game has.
 */

function BossTile({ boss }: { boss: (typeof BOSSES)[number] }) {
  const locked = boss.status === "locked";

  return (
    <li
      className={`sticker flex flex-col items-center gap-2 p-5 text-center ${
        locked ? "opacity-50 grayscale" : ""
      }`}
    >
      <span aria-hidden className="text-4xl">
        {boss.emoji}
      </span>
      <h3 className="font-figure text-ink text-lg font-black tracking-wide uppercase">
        {locked ? "Not yet met" : boss.name}
      </h3>
      {locked ? (
        <p className="font-label text-ink-soft text-xs font-bold tracking-widest uppercase">
          Level {boss.level}
        </p>
      ) : (
        <>
          <p className="font-secondary text-ink-soft text-p-sm">{boss.habit}</p>
          {boss.status === "reformed" ? (
            <span className="font-label text-stat-good mt-1 rounded-full border border-stat-good px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase">
              Reformed
            </span>
          ) : (
            <span className="font-label text-stat-warm text-xs font-bold tracking-widest uppercase">
              Level {boss.level}, in progress
            </span>
          )}
        </>
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
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {BOSSES.map((boss) => (
          <BossTile key={boss.id} boss={boss} />
        ))}
      </ul>
    </section>
  );
}
