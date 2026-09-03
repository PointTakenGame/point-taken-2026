import { SiteNav } from "@/components/site-nav";
import { coachCard } from "@/lib/coach/cards";

/**
 * The Gym: a level-select ladder for practice mode, levels 1 to 4.
 *
 * This is the screen, not the game. There is no scripted practice opponent
 * yet (Steve's 2026-08-17 scope ruling took it off the critical path, see
 * this repo's CLAUDE.md), so "Start" on every card is inert on purpose rather
 * than a stub for a server action nobody has written. Nothing here decides
 * whether a level unlocks another: that rule is not confirmed anywhere, so
 * every level renders open, in order, all four at once.
 *
 * Content (topic, rule card taught, boss) is ratified against Steve's
 * 2026-08-22 gym-levels and skill-ladder design docs, not placeholder. The
 * rule card each level teaches is read from lib/coach/cards.ts rather than
 * re-typed here, so the name, icon and id can never drift from the card the
 * player actually holds.
 *
 * Level and boss ids are new and permanent as of this page: snake_case,
 * chosen to be readable rather than derived from anything, since nothing in
 * the schema constrains them (level_id and boss_id are free text on `games`).
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
    bossId: "bashful_bob",
    bossName: "Bashful Bob",
    bossEmoji: "🧑🏻‍💼",
  },
  {
    id: "ground_rules",
    number: 2,
    title: "Ground rules",
    topic: "Should clock-change twice a year stop?",
    cardId: "stick_to_root",
    bossId: "rambling_rosa",
    bossName: "Rambling Rosa",
    bossEmoji: "🧑🏿‍🔧",
  },
  {
    id: "claim_size",
    number: 3,
    title: "Claim size",
    topic: "Should tipping be replaced by higher wages?",
    cardId: "no_exaggeration",
    bossId: "braggy_brenda",
    bossName: "Braggy Brenda",
    bossEmoji: "🧑🏼‍🔬",
  },
  {
    id: "clarity",
    number: 4,
    title: "Clarity",
    topic: "Should AI-generated content be labeled?",
    cardId: "help_me_understand",
    bossId: "sloppy_salma",
    bossName: "Sloppy Salma",
    bossEmoji: "🧑🏾‍🍳",
  },
];

/*
  Restyled 2026-09-02 into the account flow's language (BRAIN-T260902-30), so
  that stepping out of the four-tab hub into the Gym does not read as stepping
  into a different product. The button is the flow's orange pill because
  starting a level is the one thing this page wants; it is disabled here
  because the levels are not wired up yet, and it says so above rather than
  looking live and doing nothing.
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
            person waiting on you. Each level teaches one rule card. Starting a level is
            not wired up yet, so the Start buttons are dark.
          </p>
        </header>

        <ul className="flex flex-col gap-4">
          {LEVELS.map((level) => {
            const card = coachCard(level.cardId);
            return (
              <li key={level.id} className="sticker flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <h2 className="font-figure text-ink text-xl font-black tracking-wide uppercase">
                    Level {level.number}: {level.title}
                  </h2>
                  <button
                    type="button"
                    className={START_BUTTON}
                    disabled
                    aria-disabled="true"
                  >
                    Start
                  </button>
                </div>
                <p className="text-p-sm text-ink-soft">Topic: {level.topic}</p>
                {card ? (
                  <p className="flex items-center gap-2 text-p-sm text-ink-soft">
                    <span aria-hidden className="text-p-lg leading-none">
                      {card.icon}
                    </span>
                    Teaches {card.name}
                  </p>
                ) : null}
                <p className="flex items-center gap-2 text-p-sm text-ink-soft">
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
