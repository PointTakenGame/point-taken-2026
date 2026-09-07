import { coachCard } from "@/lib/coach/cards";
import type { PlayerAwards } from "@/lib/db/awards";
import { levelById } from "@/lib/gym/levels";
import type { Rung } from "@/lib/progression/sample";
import { ArrowGlyph, BUTTON_PRIMARY, Chip } from "@/components/account/account-shell";
import { StartLevelButton } from "@/components/gym/start-level-button";

/**
 * The boss standing at the player's current rung, drawn inside the ladder
 * card, from Rannie's frame `1066:216757` (adopted 2026-09-04,
 * BRAIN-T260904-40): a dark reverse-contrast challenge card and the boss
 * standing beside it.
 *
 * The old "Current boss" panel was a small card two sections under the
 * ladder. The boss is the thing the whole ladder points at, so this gives it
 * the most real estate on the page.
 *
 * **Sides swapped and moved above the strip, Steve 2026-09-07.** Her frame
 * puts the figure on the left, but the only call to action on this page is
 * the button in the dark card, and it was sitting on the right below a large
 * illustration. So the challenge takes the upper left where reading starts,
 * the boss takes the upper right, and the ladder strip runs along the bottom
 * of the panel (see ladder-strip.tsx).
 *
 * The dark card is the profile's one reverse-contrast surface (the event
 * detail card, which is not built, would be the other). Reversing the colours
 * says "this one is different in kind" without a heading that says so: every
 * other card on the page reports on the player, this one is a brief about
 * somebody else.
 *
 * The rule card is only named once the player holds it. "A rule card not yet
 * earned is shown as a question mark, never named early" is a settled rule
 * for the account pages (web/point-taken-2026/CLAUDE.md), and the old panel's
 * "Teaches {card}" line broke it. Before it is earned, the goals say what the
 * card will do for the player without naming it.
 *
 * The emoji is placeholder art; her frame has a drawn character with a
 * wordmark, and the art is on Rannie, not on this build.
 */
export function BossBriefing({ rung, awards }: { rung: Rung; awards: PlayerAwards }) {
  const level = levelById(rung.id);
  if (!level) return null;

  const card = coachCard(level.cardId);
  const holdsCard = awards.cardIds.includes(level.cardId);
  const nameLines = level.bossName.split(" ");

  return (
    <div className="grid items-center gap-8 pb-8 md:grid-cols-[minmax(0,1.6fr)_minmax(200px,1fr)]">
      <div className="bg-ink text-card flex flex-col gap-3 rounded-2xl p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h4 className="font-figure text-2xl font-black tracking-wide uppercase">
            Boss challenge: {level.bossName}
          </h4>
          <Chip tone="warm">Level {level.number}</Chip>
        </div>
        {/* Learning goals, not a checklist. Steve, 2026-09-07: somebody
          standing in front of level 1 has not seen a board yet, so "throw the
          card the moment they break it" names three things they cannot
          picture. What they can picture is what they will be able to do
          afterwards, so that is what this says. The copy is per level, in
          `learningGoals` (lib/gym/script.ts), because only the level knows
          what it teaches. */}
        <div className="font-secondary text-p-sm text-card/85 flex flex-col gap-2">
          {(
            level.learningGoals ?? [
              `You'll play a level against ${level.bossName} and come out the other side knowing something you didn't.`,
            ]
          ).map((line) => (
            <p key={line}>{line}</p>
          ))}
          {/* Named only once it is theirs: an unearned card is a question
            mark, never a name (web/point-taken-2026/CLAUDE.md). Once they
            hold it, saying so is the reward for having come back. */}
          {holdsCard && card ? (
            <p className="text-card/60">
              You already hold{" "}
              <span className="text-card font-semibold">
                {card.icon} {card.name}
              </span>{" "}
              from this one.
            </p>
          ) : null}
        </div>
        <div className="pt-2">
          <StartLevelButton levelId={level.id} className={BUTTON_PRIMARY}>
            Fight this boss
            <ArrowGlyph />
          </StartLevelButton>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 text-center">
        <span
          aria-hidden
          className="border-ink bg-paper flex h-32 w-32 items-center justify-center rounded-full border-[1.5px] text-7xl leading-none"
        >
          {level.bossEmoji}
        </span>
        <h3 className="font-primary text-ink text-4xl leading-[0.95] tracking-wide uppercase">
          {nameLines.map((line, i) => (
            <span key={i} className="block">
              {line}
            </span>
          ))}
        </h3>
        <span className="font-label text-ink-soft text-[11px] font-bold tracking-widest uppercase">
          Level boss
        </span>
      </div>
    </div>
  );
}
