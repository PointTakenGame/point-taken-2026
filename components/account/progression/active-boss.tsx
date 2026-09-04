import Link from "next/link";

import { coachCard } from "@/lib/coach/cards";
import type { PlayerAwards } from "@/lib/db/awards";
import { SCRIPTED_LEVELS } from "@/lib/gym/levels";
import { boss } from "@/lib/progression/sample";
import { ladderFor } from "@/lib/progression/state";
import { Panel, SectionHeading } from "@/components/account/account-shell";
import { StartLevelButton } from "@/components/gym/start-level-button";

/**
 * The boss standing at the player's current rung.
 *
 * "Reformed" is Rannie's word: a boss you beat does not lose, they learn the
 * rule, which is the only ending this game has, so this widget names the
 * habit rather than a fight. As of 2026-09-04 (Steve) there is no more Gym
 * page to hand a player off to, so this starts the boss's level directly,
 * matched off `SCRIPTED_LEVELS[].bossId`. A boss with no matching scripted
 * level (a locked slot above level 4) falls back to a plain link to the
 * ladder instead of a button that would start nothing.
 *
 * Which rung is current is real: the first designed level this player has not
 * cleared (lib/progression/state.ts). A player who has cleared everything
 * designed gets no panel, which is correct until there is a level 5.
 */
export function ActiveBoss({ awards }: { awards: PlayerAwards }) {
  const rung = ladderFor(awards).find((candidate) => candidate.status === "current");
  const activeBoss = rung?.bossId ? boss(rung.bossId) : undefined;
  const card = rung?.cardId ? coachCard(rung.cardId) : undefined;
  const level = activeBoss
    ? SCRIPTED_LEVELS.find((candidate) => candidate.bossId === activeBoss.id)
    : undefined;

  if (!rung || !activeBoss) return null;

  return (
    <Panel className="mb-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <SectionHeading title="Current boss" note={`Level ${rung.level}`} />
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <span aria-hidden className="text-6xl leading-none">
          {activeBoss.emoji}
        </span>
        <div className="flex min-w-56 flex-1 flex-col gap-1">
          <h3 className="font-figure text-ink text-2xl font-black tracking-wide uppercase">
            {activeBoss.name}
          </h3>
          <p className="font-secondary text-ink-soft text-p-sm">{activeBoss.habit}</p>
          {card ? (
            <p className="text-p-sm text-ink-soft flex items-center gap-2">
              <span aria-hidden className="text-p-lg leading-none">
                {card.icon}
              </span>
              Teaches {card.name}
            </p>
          ) : null}
        </div>
        {level ? (
          <StartLevelButton
            levelId={level.id}
            className="font-primary border-ink text-ink hover:bg-sand shrink-0 rounded-full border px-6 py-2 tracking-wide uppercase transition-colors"
          >
            Fight this boss
          </StartLevelButton>
        ) : (
          <Link
            href="/#ladder"
            className="font-primary border-ink text-ink hover:bg-sand shrink-0 rounded-full border px-6 py-2 tracking-wide uppercase transition-colors"
          >
            Go to the ladder
          </Link>
        )}
      </div>
    </Panel>
  );
}
