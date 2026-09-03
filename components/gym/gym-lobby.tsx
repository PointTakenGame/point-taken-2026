"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { signAgreement, startGame } from "@/app/game/[gameId]/setup-actions";
import type { BoardState } from "@/lib/board/project";
import { SIGNING_LINES } from "@/lib/board/setup";
import { coachCard } from "@/lib/coach/cards";
import { levelById } from "@/lib/gym/levels";
import type { Level } from "@/lib/gym/script";

/**
 * The room before a Gym level starts. Sides and topic are the script's, and
 * the boss has already signed, so the only thing left for the player is the
 * signing ritual: three lines, one button. Signing and starting are the same
 * setup-actions a live room uses; this screen just does them back to back.
 */

const PILL =
  "font-primary rounded-full border-[1.5px] border-ink bg-orange px-6 py-2.5 tracking-wide uppercase text-ink transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40";

const SIDE_WORD = { plus: "Plus (yes)", minus: "Minus (no)" } as const;

/** Level by id, not by object: see GymDirector for why. */
export function GymLobby({
  gameId,
  levelId,
  board,
  me,
}: {
  gameId: string;
  levelId: string;
  board: BoardState;
  me: { playerId: string };
}) {
  const level = levelById(levelId);
  if (!level) return null;
  return <Lobby gameId={gameId} level={level} board={board} me={me} />;
}

function Lobby({
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
  const signed = (mine?.signed?.length ?? 0) > 0;
  const card = coachCard(level.cardId);

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
    <div className="dot-ground min-h-screen w-full">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
        <header className="flex flex-col gap-2">
          <span className="font-label text-ink-soft">Gym · Level {level.number}</span>
          <h1 className="font-primary text-ink text-4xl tracking-wide uppercase">
            {level.title}
          </h1>
          <p className="font-secondary text-ink-soft">{level.banner}</p>
        </header>

        <section className="sticker flex flex-col gap-3 p-6">
          <span className="font-label text-ink-soft">Topic</span>
          <p className="font-figure text-ink text-2xl font-black">{level.topic}</p>
          <div className="font-secondary text-p-sm text-ink-soft flex flex-wrap gap-x-6 gap-y-1">
            <span>
              You argue{" "}
              <strong className="text-ink">{SIDE_WORD[level.playerSide]}</strong>
            </span>
            <span>
              {level.bossEmoji} {level.bossName} argues{" "}
              <strong className="text-ink">{SIDE_WORD[level.bossSide]}</strong>
            </span>
            {card ? (
              <span>
                Teaches {card.icon} {card.name}
              </span>
            ) : null}
          </div>
        </section>

        <section className="sticker flex flex-col gap-4 p-6">
          <h2 className="font-figure text-ink text-xl font-black tracking-wide uppercase">
            Before you start
          </h2>
          <p className="font-secondary text-p-sm text-ink-soft">
            Three things both of you agree to. {level.bossName} has already put a name to
            them.
          </p>
          <ol className="flex flex-col gap-2">
            {SIGNING_LINES.map((line, index) => (
              <li key={line.id} className="flex items-baseline gap-3">
                <span className="font-figure text-ink w-6 text-xl font-black">
                  {index + 1}
                </span>
                <span className="font-primary text-ink tracking-wide uppercase">
                  {line.text}
                </span>
                <span className="font-label text-ink-soft">{line.family}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" className={PILL} disabled={pending} onClick={go}>
              {signed ? "Start" : "Sign and start"}
            </button>
            <Link
              href="/gym"
              className="font-secondary text-p-sm text-ink-soft underline"
            >
              Back to the Gym
            </Link>
          </div>
          {error ? (
            <p className="font-secondary text-p-sm text-red-700">{error}</p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
