import Link from "next/link";

import { coachCard } from "@/lib/coach/cards";
import { boss, currentRung } from "@/lib/progression/sample";
import { Panel, SectionHeading } from "@/components/account/account-shell";
import { SampleTag } from "./sample-tag";

/**
 * The boss standing at the player's current rung.
 *
 * "Reformed" is Rannie's word: a boss you beat does not lose, they learn the
 * rule, which is the only ending this game has, so this widget names the
 * habit rather than a fight. No start-a-level logic here; the link is a plain
 * link to /gym, and the Gym's own Start buttons decide what happens next.
 */
export function ActiveBoss() {
  const rung = currentRung();
  const activeBoss = rung.bossId ? boss(rung.bossId) : undefined;
  const card = rung.cardId ? coachCard(rung.cardId) : undefined;

  // The ladder always has exactly one "current" rung today, and it always
  // names a boss, but a widget reading sample data should not assume that
  // stays true as the ladder grows.
  if (!activeBoss) return null;

  return (
    <Panel className="mb-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <SectionHeading title="Current boss" note={`Level ${rung.level}`} />
        <SampleTag />
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
        <Link
          href="/gym"
          className="font-primary border-ink text-ink hover:bg-sand shrink-0 rounded-full border px-6 py-2 tracking-wide uppercase transition-colors"
        >
          Go to the Gym
        </Link>
      </div>
    </Panel>
  );
}
