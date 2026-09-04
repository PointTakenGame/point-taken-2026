import { SiteNav } from "@/components/site-nav";
import { StartLevelButton } from "@/components/gym/start-level-button";
import { coachCard } from "@/lib/coach/cards";
import { SCRIPTED_LEVELS } from "@/lib/gym/levels";

/**
 * The Gym: a level-select ladder for practice mode, levels 1 to 4.
 *
 * All four levels are scripted now (lib/gym/levels), so this page is a
 * straight render of `SCRIPTED_LEVELS` and Start opens a cooked game against
 * the level's boss. It used to carry its own copy of the four levels, with
 * levels 3 and 4 as dark doors; that table has been deleted rather than
 * updated, because two lists of the same four topics drift. Nothing here
 * decides whether a level unlocks another: Steve, 2026-09-03, all four open.
 *
 * Content (topic, rule card taught, boss) is ratified against Steve's
 * 2026-08-22 gym-levels and skill-ladder design docs. The rule card each
 * level teaches is read from lib/coach/cards.ts rather than re-typed here.
 *
 * Boss ids are kebab-case, matching lib/progression/sample.ts and the
 * casing rule in BIZ-T260823-66 (card ids snake, everything else kebab).
 */

export const dynamic = "force-dynamic";

/*
  Restyled 2026-09-02 into the account flow's language (BRAIN-T260902-30), so
  that stepping out of the four-tab hub into the Gym does not read as stepping
  into a different product. The button is the flow's orange pill because
  starting a level is the one thing this page wants.
*/
const START_BUTTON =
  "font-primary rounded-full border-[1.5px] border-ink bg-orange px-5 py-2 tracking-wide uppercase text-ink transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0";

export default function GymPage() {
  return (
    <div className="dot-ground min-h-screen w-full">
      <SiteNav here="gym" />
      <main className="mx-auto flex w-full max-w-[1229px] flex-col gap-6 px-6 pb-16">
        <header className="flex flex-col gap-2 pb-2">
          <h1 className="font-primary text-ink text-5xl tracking-wide uppercase">Gym</h1>
          <p className="font-secondary text-ink-soft max-w-2xl">
            A practice board you can open on your own, to try the moves without a second
            person waiting on you. Each level teaches one rule card against a scripted
            opponent, with the coach at the top of the board. All four are playable.
          </p>
        </header>

        <ul className="flex flex-col gap-4">
          {SCRIPTED_LEVELS.map((level) => {
            const card = coachCard(level.cardId);
            return (
              <li key={level.id} className="sticker flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <h2 className="font-figure text-ink text-xl font-black tracking-wide uppercase">
                    Level {level.number}: {level.title}
                  </h2>
                  <StartLevelButton levelId={level.id} className={START_BUTTON} />
                </div>
                <p className="text-p-sm text-ink-soft">Topic: {level.topic}</p>
                {card ? (
                  <p className="text-p-sm text-ink-soft flex items-center gap-2">
                    <span aria-hidden className="text-p-lg leading-none">
                      {card.icon}
                    </span>
                    Teaches {card.name}
                  </p>
                ) : null}
                <p className="text-p-sm text-ink-soft flex items-center gap-2">
                  <span aria-hidden className="text-p-lg leading-none">
                    {level.bossEmoji}
                  </span>
                  Boss: {level.bossName}
                </p>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
