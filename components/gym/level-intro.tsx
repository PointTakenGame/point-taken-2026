"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { signAgreement, startGame } from "@/app/game/[gameId]/setup-actions";
import { OCTAGON_CLIP } from "@/components/board/geometry";
import { SideAvatar } from "@/components/board/tile-shape";
import type { BoardState } from "@/lib/board/project";
import { SIGNING_LINES } from "@/lib/board/setup";
import { coachCard } from "@/lib/coach/cards";
import type { Level } from "@/lib/gym/script";

/**
 * The two-card intro that opens a Gym level, in place of the plain
 * sign-and-start room this used to be. Card one introduces the boss and the
 * challenge (Figma `1058:211649`, "boss intro"); card two shows the rule
 * card the level teaches, the signing ritual, and the start button (Figma
 * `1077:220185`, "rule card intro"). Steve ruled 2026-09-04 (BRAIN-T260904-21)
 * to build from Rannie's staging rather than the old single-screen lobby.
 *
 * The rule card on card two is shown face up only if the player already
 * earned it on an earlier clear. Otherwise it is a question mark: the rule
 * is discovered partway through the level, not handed out up front (Steve,
 * 2026-09-04, "we can always replace any rule cards that haven't been given
 * yet with a question mark"). The three signing lines are shown as read-only
 * small print, not four checkboxes: the Figma still draws four, but the
 * signing ritual is three lines signed as one act, settled on the 2026-08-31
 * call and restated in this repo's CLAUDE.md, and the Figma is the stale one
 * there.
 *
 * Neither card renders LiveBoard. There is no board yet, only a level that
 * has not started, so the ground behind the cards is the same dot-grid and
 * corner-badge look the live board uses, drawn statically here rather than
 * imported from it.
 */

const PILL_DARK =
  "font-primary rounded-full border-[1.5px] border-ink bg-ink px-6 py-2.5 tracking-wide uppercase text-card shadow-[var(--shadow-sticker-sm)] transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40";

const BACK_LINK = "font-secondary text-p-sm text-ink-soft underline";

const SIDE_WORD = { plus: "Plus", minus: "Minus" } as const;

export function LevelIntro({
  gameId,
  level,
  board,
  me,
  cardEarned,
}: {
  gameId: string;
  level: Level;
  board: BoardState;
  me: { playerId: string };
  cardEarned: boolean;
}) {
  const [step, setStep] = useState<1 | 2>(1);

  return (
    <div className="dot-ground relative min-h-screen w-full overflow-hidden">
      <BoardChrome level={level} />
      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-6 py-20">
        {step === 1 ? (
          <BossIntroCard level={level} onNext={() => setStep(2)} />
        ) : (
          <RuleCardIntroCard
            gameId={gameId}
            level={level}
            board={board}
            me={me}
            cardEarned={cardEarned}
          />
        )}
      </main>
    </div>
  );
}

/**
 * The board's corner chrome, redrawn statically rather than imported from
 * live-board.tsx: that component's own top-left and top-right pieces exist
 * for a live opponent and a way to leave a running game, neither of which
 * applies here. This is decoration only, so it carries no interaction.
 */
function BoardChrome({ level }: { level: Level }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-0 flex items-start justify-between p-6"
    >
      <span className="border-ink/30 text-ink-soft font-primary flex h-9 items-center gap-1 rounded-full border px-2 text-sm">
        <span>−</span>
        <span>+</span>
      </span>
      <span className="flex items-center gap-2">
        <SideAvatar side={level.bossSide} className="h-9 w-9" />
        <span
          className="font-primary text-p-sm uppercase tracking-wide"
          style={{
            color:
              level.bossSide === "plus" ? "var(--color-green)" : "var(--color-orange)",
          }}
        >
          {SIDE_WORD[level.bossSide]} Peer
        </span>
      </span>
    </div>
  );
}

function BossIntroCard({ level, onNext }: { level: Level; onNext: () => void }) {
  const bossLines = level.bossName.split(" ");
  const habitLine =
    level.bossHabit && level.bossTip
      ? `You will earn a rule card and beat the boss. The rule card you will learn is still face down: you find it partway through the level. ${level.bossName} ${level.bossHabit}. The tip to beat them: ${level.bossTip}.`
      : "You will earn a rule card and beat the boss. The rule card you will learn is still face down: you find it partway through the level.";
  const readyLine = `ready? the topic is "${level.topic}" and you will be ${SIDE_WORD[level.playerSide]} peer`;

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="flex items-center gap-3">
        <span
          className="bg-orange border-ink relative flex h-14 w-14 shrink-0 items-center justify-center border-[1.5px]"
          style={{ clipPath: OCTAGON_CLIP }}
        >
          <span className="font-primary text-ink text-2xl leading-none">★</span>
        </span>
        <div className="flex flex-col">
          <span className="font-figure text-ink-soft text-p-sm uppercase tracking-wide">
            Level {level.number}
          </span>
          <span className="font-figure text-ink text-2xl leading-none font-black uppercase">
            {level.title}
          </span>
        </div>
      </div>

      {/* The boss sits half above the card's top edge, as she draws it. A
          negative top margin on the portrait does that in normal flow, so the
          name and the heading under it can never collide, whatever the name's
          length or the reader's font size. */}
      <div className="sticker mt-14 flex w-full flex-col items-center gap-4 p-8 pt-0 text-center">
        <span className="bg-offwhite border-ink -mt-14 flex h-28 w-28 items-center justify-center rounded-full border-[1.5px] text-6xl shadow-[var(--shadow-sticker-sm)]">
          {level.bossEmoji}
        </span>
        <span className="font-primary text-ink text-4xl leading-[0.95] tracking-wide uppercase">
          {bossLines.map((word, index) => (
            <span key={`${word}-${index}`} className="block">
              {word}
            </span>
          ))}
        </span>

        <h2 className="font-figure text-ink mt-4 text-xl font-black tracking-wide uppercase">
          {`Level ${level.number} Game Challenge`}
        </h2>

        <p className="font-secondary text-ink-soft text-p-md">{habitLine}</p>

        <p className="font-secondary text-ink text-p-md font-bold">{readyLine}</p>

        <button type="button" className={PILL_DARK} onClick={onNext}>
          {"Next →"}
        </button>

        <Link href="/" className={BACK_LINK}>
          Back to your profile
        </Link>
      </div>
    </div>
  );
}

function RuleCardIntroCard({
  gameId,
  level,
  board,
  me,
  cardEarned,
}: {
  gameId: string;
  level: Level;
  board: BoardState;
  me: { playerId: string };
  cardEarned: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const mine = board.players.find((player) => player.id === me.playerId);
  const signed = (mine?.signed?.length ?? 0) > 0;
  const card = cardEarned ? coachCard(level.cardId) : undefined;

  const go = () => {
    setError(null);
    startTransition(async () => {
      if (!signed) {
        const signedResult = await signAgreement(gameId);
        if (!signedResult.ok) {
          setError(signedResult.error);
          return;
        }
      }
      const started = await startGame(gameId);
      if (!started.ok) {
        setError(started.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex w-full flex-col items-center">
      <div className="border-green bg-card relative z-10 mb-[-2rem] flex w-56 flex-col items-center gap-2 rounded-2xl border-2 px-4 pt-7 pb-8 text-center shadow-[var(--shadow-sticker)]">
        <span
          className="border-ink absolute -top-3 -left-3 flex h-9 w-9 items-center justify-center border-[1.5px]"
          style={{
            clipPath: OCTAGON_CLIP,
            backgroundColor: "color-mix(in srgb, var(--color-green) 60%, black)",
          }}
        >
          <span className="font-figure text-p-sm leading-none font-black text-white">
            {`L${level.number}`}
          </span>
        </span>
        {card ? (
          <>
            <span className="text-4xl">{card.icon}</span>
            <span className="font-primary text-ink text-p-md leading-tight uppercase">
              {card.name}
            </span>
            <span className="font-secondary text-ink-soft text-p-sm">{card.plain}</span>
          </>
        ) : (
          <>
            <span className="bg-orange border-ink text-ink flex h-14 w-14 items-center justify-center rounded-full border-[1.5px] text-2xl font-black">
              ?
            </span>
            <span className="font-primary text-ink text-p-md leading-tight uppercase">
              ?
            </span>
            <span className="font-secondary text-ink-soft text-p-sm">
              You earn this card partway through the level.
            </span>
          </>
        )}
      </div>

      <div className="sticker flex w-full flex-col items-center gap-4 p-8 pt-12 text-center">
        <h2 className="font-figure text-ink text-xl font-black tracking-wide uppercase">
          {`Level ${level.number} Game Challenge`}
        </h2>
        <p className="font-secondary text-ink-soft text-p-md">
          {"Find the boss's mistake and correct it on the board."}
        </p>

        <ol className="flex w-full flex-col gap-1">
          {SIGNING_LINES.map((line, index) => (
            <li key={line.id} className="font-label text-ink-soft text-p-sm uppercase">
              {index === 0 ? "By starting you agree: " : null}
              {line.text}
            </li>
          ))}
        </ol>

        <button type="button" className={PILL_DARK} disabled={pending} onClick={go}>
          {"Start the game →"}
        </button>
        {error ? <p className="font-secondary text-p-sm text-red-700">{error}</p> : null}

        <Link href="/" className={BACK_LINK}>
          Back to your profile
        </Link>
      </div>
    </div>
  );
}
