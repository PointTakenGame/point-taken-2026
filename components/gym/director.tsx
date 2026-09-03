"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import { placeTile } from "@/app/game/[gameId]/actions";
import { bossAct } from "@/app/gym/actions";
import type { BoardState } from "@/lib/board/project";
import { coachCard } from "@/lib/coach/cards";
import { levelById } from "@/lib/gym/levels";
import { currentBeat, levelProgress, type Beat, type Level } from "@/lib/gym/script";

/**
 * The Gym director: the coach at the top centre of the board and the pauses
 * between beats, driven by the level script against the live board.
 *
 * It renders beside LiveBoard rather than inside it. The board is the same
 * board a live game uses; the director only reads it (through the page's
 * server render, which the realtime feed already refreshes) and adds three
 * things on top: the coach's line for the current beat, a suggestion picker
 * when the beat wants a tile, and a full-screen pause when the script stops
 * to explain something. When the beat is the boss's it waits a moment, so
 * the boss reads as thinking rather than instant, and asks the server to
 * play the boss's move.
 *
 * Which pauses have been read is client state, kept in sessionStorage per
 * game so a refresh does not replay them. Everything else is the log.
 */

const BOSS_DELAY_MS = 1200;

function storageKey(gameId: string): string {
  return `pt-gym-pauses:${gameId}`;
}

// sessionStorage as an external store, so the read is a snapshot rather
// than a setState inside an effect (react-hooks/set-state-in-effect), and
// the server render sees an empty set rather than a hydration mismatch.
const CHANGE_EVENT = "pt-gym-pauses-change";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readRaw(gameId: string): string {
  try {
    return window.sessionStorage.getItem(storageKey(gameId)) ?? "[]";
  } catch {
    return "[]";
  }
}

function writeDismissed(gameId: string, ids: Set<string>): void {
  try {
    window.sessionStorage.setItem(storageKey(gameId), JSON.stringify([...ids]));
  } catch {
    // Storage is a convenience; the pause just shows again on reload.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function parseDismissed(raw: string): Set<string> {
  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

const PILL =
  "font-primary rounded-full border-[1.5px] border-ink bg-orange px-5 py-2 tracking-wide uppercase text-ink transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40";

const CHIP =
  "font-secondary text-p-sm rounded-2xl border-[1.5px] border-ink bg-card px-4 py-2 text-left text-ink shadow-[2px_3px_0_0_#4D4C4A] transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Takes the level by id rather than as an object: a level's boss lines can
 * be functions of what the player wrote, and a function cannot cross the
 * server-to-client prop boundary. The lookup is pure and runs on both sides.
 */
export function GymDirector({
  gameId,
  levelId,
  board,
}: {
  gameId: string;
  levelId: string;
  board: BoardState;
}) {
  const level = levelById(levelId);
  if (!level) return null;
  return <Director gameId={gameId} level={level} board={board} />;
}

function Director({
  gameId,
  level,
  board,
}: {
  gameId: string;
  level: Level;
  board: BoardState;
}) {
  const router = useRouter();
  const rawDismissed = useSyncExternalStore(
    subscribe,
    () => readRaw(gameId),
    () => "[]",
  );
  const dismissed = useMemo(() => parseDismissed(rawDismissed), [rawDismissed]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const progress = useMemo(
    () => levelProgress(level, board, dismissed),
    [level, board, dismissed],
  );
  const beat = currentBeat(level, progress);

  // One boss move per (beat, board) pair. A second render with the same
  // board must not fire again; a refreshed board with the same beat may,
  // because that means the first attempt did not land.
  const firedRef = useRef<string | null>(null);
  const beatId = beat?.id ?? null;
  const beatKind = beat?.kind ?? null;
  useEffect(() => {
    if (beatKind !== "boss" || !beatId) return;
    const stamp = `${beatId}@${board.lastSeq}`;
    if (firedRef.current === stamp) return;
    firedRef.current = stamp;
    const timer = window.setTimeout(() => {
      startTransition(async () => {
        const result = await bossAct(gameId);
        if (!result.ok) setError(result.error);
        router.refresh();
      });
    }, BOSS_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [beatId, beatKind, board.lastSeq, gameId, router]);

  if (!beat) return null;

  const dismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    writeDismissed(gameId, next);
  };

  const suggest = (text: string, parentKey: string | null) => {
    const parentTileId = parentKey === null ? null : (progress.keys[parentKey] ?? null);
    if (parentKey !== null && !parentTileId) return;
    setError(null);
    startTransition(async () => {
      const result = await placeTile(gameId, { text, parentTileId });
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  };

  const step = `Level ${level.number} · ${progress.done.length + 1} of ${level.beats.length}`;

  if (beat.kind === "pause") {
    return (
      <Pause beat={beat} level={level} step={step} onDismiss={() => dismiss(beat.id)} />
    );
  }

  const nudging =
    beat.kind === "player" && !!beat.nudge && board.lastSeq > progress.cursor;
  const line =
    beat.kind === "player"
      ? nudging
        ? beat.nudge
        : beat.coach
      : beat.kind === "boss"
        ? (beat.coach ?? `${level.bossName} is thinking...`)
        : (beat.coach ?? "Every thread is closing. One moment.");

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center px-4">
      <div className="sticker pointer-events-auto flex w-full max-w-xl flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <span aria-hidden className="text-3xl leading-none">
            🧘
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-label text-ink-soft">Coach · {step}</span>
            {beat.kind === "boss" && beat.bossSays ? (
              <p className="font-secondary text-p-sm text-ink-soft italic">
                {level.bossEmoji} {level.bossName}: “{beat.bossSays}”
              </p>
            ) : null}
            <p className="font-secondary text-ink">{line}</p>
          </div>
        </div>

        {beat.kind === "player" && beat.expect.kind === "tile" ? (
          <div className="flex flex-col gap-2">
            {beat.expect.suggestions.map((text) => (
              <button
                key={text}
                type="button"
                className={CHIP}
                disabled={pending}
                onClick={() =>
                  suggest(text, beat.expect.kind === "tile" ? beat.expect.parent : null)
                }
              >
                {text}
              </button>
            ))}
            <span className="font-label text-ink-soft">
              {beat.expect.parent === null
                ? "Or write your own on the board, hung off the topic."
                : "Or write your own on the board, under the same tile."}
            </span>
          </div>
        ) : null}

        {error ? <p className="font-secondary text-p-sm text-red-700">{error}</p> : null}
      </div>
    </div>
  );
}

function Pause({
  beat,
  level,
  step,
  onDismiss,
}: {
  beat: Extract<Beat, { kind: "pause" }>;
  level: Level;
  step: string;
  onDismiss: () => void;
}) {
  const card = beat.cardId ? coachCard(beat.cardId) : undefined;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`gym-pause-${beat.id}`}
      className="bg-ink/40 fixed inset-0 z-[60] flex items-center justify-center p-6"
    >
      <div className="sticker flex w-full max-w-lg flex-col gap-4 p-8">
        <span className="font-label text-ink-soft">Coach · {step}</span>
        <h2
          id={`gym-pause-${beat.id}`}
          className="font-figure text-ink text-2xl font-black tracking-wide uppercase"
        >
          {beat.title}
        </h2>
        {card ? (
          <div className="border-ink bg-card flex items-start gap-3 rounded-2xl border-[1.5px] p-4">
            <span aria-hidden className="text-3xl leading-none">
              {card.icon}
            </span>
            <div className="flex flex-col gap-1">
              <span className="font-primary text-ink tracking-wide uppercase">
                {card.name}
              </span>
              <span className="font-secondary text-p-sm text-ink-soft">{card.plain}</span>
            </div>
          </div>
        ) : null}
        {beat.bossSays ? (
          <p className="font-secondary text-ink-soft italic">
            {level.bossEmoji} {level.bossName}: “{beat.bossSays}”
          </p>
        ) : null}
        <p className="font-secondary text-ink">🧘 {beat.body}</p>
        <div>
          <button type="button" className={PILL} onClick={onDismiss} autoFocus>
            {beat.button}
          </button>
        </div>
      </div>
    </div>
  );
}
