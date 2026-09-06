"use client";

import { useState, useTransition } from "react";
import { PledgeText } from "@/components/lobby/player-agreement";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { signAgreement, startGame } from "@/app/game/[gameId]/setup-actions";
import { OCTAGON_CLIP } from "@/components/board/geometry";
import { SideAvatar } from "@/components/board/tile-shape";
import type { BoardState } from "@/lib/board/project";
import { SIGNING_LINES } from "@/lib/board/setup";
import type { Level } from "@/lib/gym/script";

/**
 * The two-card intro that opens a Gym level, in place of the plain
 * sign-and-start room this used to be. Card one introduces the boss and the
 * challenge (Figma `1058:211649`, "boss intro"). Card two used to show the
 * level's rule card face down; Steve killed that on his level 1 playthrough,
 * 2026-09-05: "we're telling about the rule card before they even understand
 * that there are rule cards" applies to every level, not just this one, so
 * no level intro shows a rule card any more. A rule card is only ever met on
 * the board, the moment the script actually teaches it.
 *
 * Card two is now the agreement: one sentence naming the level, the boss,
 * and the topic, then the three signing-line pledges from `SIGNING_LINES`
 * (`lib/board/setup.ts`), then "I agree to all three", which signs, then
 * "Start the game", which stays disabled until agreed. Both call the same
 * `signAgreement` / `startGame` actions the old sign-and-start card used. If
 * the player already signed (a rejoin, or the peer started this screen
 * first), it opens already agreed.
 *
 * `cardEarned` stays in the props so `components/gym/gym-lobby.tsx` (not
 * this lane) does not need a matching edit; it is unused here now that no
 * card is shown.
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
}: {
  gameId: string;
  level: Level;
  board: BoardState;
  me: { playerId: string };
  /** Unused now that no level intro shows a rule card. Kept in the type so
   * gym-lobby.tsx, which is not this lane, needs no matching edit. */
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
          <AgreementCard gameId={gameId} level={level} board={board} me={me} />
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
  // Steve, 2026-09-05: no level intro names the rule card up front any more
  // ("we're telling about the rule card before they even understand that
  // there are rule cards"), so this line is the boss's habit alone, with no
  // mention of the card the level will teach. A level with no habit shows no
  // line at all rather than a sentence about a card nobody has met yet.
  const habitLine = level.bossHabit ? `${level.bossName} ${level.bossHabit}.` : null;
  const readyLine = `Ready? The topic: "${level.topic}". You're playing ${SIDE_WORD[level.playerSide]}.`;

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

        {habitLine ? (
          <p className="font-secondary text-ink-soft text-p-md">{habitLine}</p>
        ) : null}

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

/**
 * The agreement screen. Replaces the old rule-card-plus-sign-and-start card
 * (Steve, 2026-09-05): one sentence naming the level, boss, and topic, the
 * three signing-line pledges read in full, then two steps in one place
 * rather than one button doing both. "I agree to all three" signs; once
 * signed, "Start the game" ungreys. A player who is already signed (a
 * rejoin, or the peer opened this screen first and this player signed
 * elsewhere) opens straight into the agreed state.
 */
function AgreementCard({
  gameId,
  level,
  board,
  me,
}: {
  gameId: string;
  level: Level;
  board: BoardState;
  me: { playerId: string };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const mine = board.players.find((player) => player.id === me.playerId);
  const [agreed, setAgreed] = useState((mine?.signed?.length ?? 0) > 0);

  const introLine =
    level.number === 1
      ? `You're about to play your first game, against ${level.bossName}, on the question: ${level.topic}`
      : `You're about to play level ${level.number} against ${level.bossName}, on: ${level.topic}`;

  const agree = () => {
    setError(null);
    startTransition(async () => {
      const result = await signAgreement(gameId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAgreed(true);
    });
  };

  const start = () => {
    setError(null);
    startTransition(async () => {
      const result = await startGame(gameId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="sticker flex w-full flex-col items-center gap-4 p-8 text-center">
      <p className="font-secondary text-ink text-p-md">{introLine}</p>

      <p className="font-secondary text-ink text-p-md font-bold">
        When you play Point Taken, you agree to three things:
      </p>

      <ol className="flex w-full flex-col gap-3 text-left">
        {SIGNING_LINES.map((line) => (
          <li key={line.id} className="flex flex-col gap-0.5">
            <span className="font-primary text-ink text-p-md uppercase tracking-wide">
              {line.title}
            </span>
            <PledgeText
              text={line.pledge}
              className="font-secondary text-ink-soft text-p-sm"
            />
          </li>
        ))}
      </ol>

      <button
        type="button"
        className={PILL_DARK}
        disabled={pending || agreed}
        onClick={agree}
      >
        {agreed ? "Agreed" : "I agree to all three"}
      </button>

      <button
        type="button"
        className={PILL_DARK}
        disabled={pending || !agreed}
        onClick={start}
      >
        {"Start the game →"}
      </button>

      {error ? <p className="font-secondary text-p-sm text-red-700">{error}</p> : null}

      <Link href="/" className={BACK_LINK}>
        Back to your profile
      </Link>
    </div>
  );
}
