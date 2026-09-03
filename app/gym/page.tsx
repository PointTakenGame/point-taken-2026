import { SiteNav } from "@/components/site-nav";
import { StartLevelButton } from "@/components/gym/start-level-button";
import { coachCard } from "@/lib/coach/cards";
import { levelById } from "@/lib/gym/levels";

/**
 * The Gym: a level-select ladder for practice mode, levels 1 to 4.
 *
 * Levels 1 and 2 are scripted (lib/gym/levels) and Start opens a cooked
 * game against the level's boss. Levels 3 and 4 have a door and no script
 * yet, so their buttons stay dark and say so. Nothing here decides whether
 * a level unlocks another: Steve, 2026-09-03, all four open.
 *
 * Content (topic, rule card taught, boss) is ratified against Steve's
 * 2026-08-22 gym-levels and skill-ladder design docs. The rule card each
 * level teaches is read from lib/coach/cards.ts rather than re-typed here.
 *
 * Boss ids are kebab-case, matching lib/progression/sample.ts and the
 * casing rule in BIZ-T260823-66 (card ids snake, everything else kebab).
 * They were snake_case here before 2026-09-03; nothing had been written
 * to `games.boss_id` under the old spelling.
 */

export const dynamic = "force-dynamic";

interface GymLevel {
  id: string;
  number: number;
  title: string;
  topic: string;
  cardId: string;
  bossId: string;
  bossName: string;
  bossEmoji: string;
}

const LEVELS: readonly GymLevel[] = [
  {
    id: "onboarding",
    number: 1,
    title: "Onboarding",
    topic: "Should a hot dog be called a sandwich?",
    cardId: "you_is_taboo",
    bossId: "bashful-bob",
    bossName: "Bashful Bob",
    bossEmoji: "🧑🏻‍💼",
  },
  {
    id: "ground_rules",
    number: 2,
    title: "Ground rules",
    topic: "Should we stop changing the clocks twice a year?",
    cardId: "stick_to_root",
    bossId: "rambling-rosa",
    bossName: "Rambling Rosa",
    bossEmoji: "🧑🏿‍🔧",
  },
  {
    id: "claim_size",
    number: 3,
    title: "Claim size",
    topic: "Should tipping be replaced by higher wages?",
    cardId: "no_exaggeration",
    bossId: "braggy-brenda",
    bossName: "Braggy Brenda",
    bossEmoji: "🧑🏼‍🔬",
  },
  {
    id: "clarity",
    number: 4,
    title: "Clarity",
    topic: "Should AI-generated content be labeled?",
    cardId: "help_me_understand",
    bossId: "sloppy-salma",
    bossName: "Sloppy Salma",
    bossEmoji: "🧑🏾‍🍳",
  },
];

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
            opponent, with the coach at the top of the board. Levels 1 and 2 are playable;
            3 and 4 are not written yet.
          </p>
        </header>

        <ul className="flex flex-col gap-4">
          {LEVELS.map((level) => {
            const card = coachCard(level.cardId);
            const scripted = levelById(level.id) !== undefined;
            return (
              <li key={level.id} className="sticker flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <h2 className="font-figure text-ink text-xl font-black tracking-wide uppercase">
                    Level {level.number}: {level.title}
                  </h2>
                  {scripted ? (
                    <StartLevelButton levelId={level.id} className={START_BUTTON} />
                  ) : (
                    <button
                      type="button"
                      className={START_BUTTON}
                      disabled
                      aria-disabled="true"
                      title="No script for this level yet"
                    >
                      Start
                    </button>
                  )}
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
                  {!scripted ? (
                    <span className="font-label"> · script not written yet</span>
                  ) : null}
                </p>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
