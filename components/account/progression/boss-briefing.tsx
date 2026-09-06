import { coachCard } from "@/lib/coach/cards";
import type { PlayerAwards } from "@/lib/db/awards";
import { levelById } from "@/lib/gym/levels";
import type { Rung } from "@/lib/progression/sample";
import { ArrowGlyph, BUTTON_PRIMARY, Chip } from "@/components/account/account-shell";
import { StartLevelButton } from "@/components/gym/start-level-button";

/**
 * The boss standing at the player's current rung, drawn inside the ladder
 * card the way Rannie draws it (Figma `1066:216757`, adopted 2026-09-04,
 * BRAIN-T260904-40): the illustration and a lettered name on the left, and a
 * dark reverse-contrast tip card on the right.
 *
 * The old "Current boss" panel was a small card two sections under the
 * ladder. The boss is the thing the whole ladder points at, so this gives it
 * the most real estate on the page and puts it under the orange pointer that
 * hangs off the current node.
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
 * "Teaches {card}" line broke it. Before the card is earned the bullet tells
 * the player where to look for it instead.
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
    <div className="grid items-center gap-8 pt-6 md:grid-cols-[minmax(200px,1fr)_minmax(0,1.6fr)]">
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

      <div className="bg-ink text-card flex flex-col gap-3 rounded-2xl p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h4 className="font-figure text-2xl font-black tracking-wide uppercase">
            Boss challenge: {level.bossName}
          </h4>
          <Chip tone="warm">Level {level.number}</Chip>
        </div>
        <p className="font-secondary text-p-sm text-card/85">
          {level.bossName} {level.bossHabit ?? "argues badly on purpose"}. Before facing
          them, you must:
        </p>
        <ul className="font-secondary text-p-sm text-card/85 flex list-disc flex-col gap-1.5 pl-5">
          {level.bossTip ? (
            <li>{level.bossTip[0].toUpperCase() + level.bossTip.slice(1)}.</li>
          ) : null}
          <li>
            {holdsCard && card ? (
              <>
                Throw{" "}
                <span className="text-card font-semibold">
                  {card.icon} {card.name}
                </span>{" "}
                the moment they break it.
              </>
            ) : (
              "Find the rule card, still face down, partway through the level."
            )}
          </li>
          <li>Finish the level to earn its certificate.</li>
        </ul>
        <div className="pt-2">
          <StartLevelButton levelId={level.id} className={BUTTON_PRIMARY}>
            Fight this boss
            <ArrowGlyph />
          </StartLevelButton>
        </div>
      </div>
    </div>
  );
}
