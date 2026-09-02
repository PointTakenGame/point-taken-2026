"use client";

import { useState, useTransition, type ReactElement } from "react";

import type { ActionResult } from "@/app/game/[gameId]/actions";
import { dismissCoachReading, editTile, setCoach } from "@/app/game/[gameId]/actions";
import type { BoardNudge, BoardState, CoachReading } from "@/lib/board/project";
import { coachCard } from "@/lib/coach/cards";

/**
 * The coach, as the player meets it.
 *
 * It offers and never blocks: a reading appears beside the board a moment after
 * the tile lands, cites at most one card, and goes away when dismissed. Nothing
 * here can stop a move (Steve, 2026-08-23).
 *
 * Only my own readings. The server projection carries both players' because it
 * reads through the service role; the filter is here, and the database refuses
 * the other side's rows to a browser client besides.
 */

function ReadingCard({
  gameId,
  reading,
  tileText,
  dare,
}: {
  gameId: string;
  reading: CoachReading;
  tileText: string | null;
  dare: BoardNudge | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const card = reading.cardIds.map(coachCard).find(Boolean);

  const dismiss = () => {
    setError(null);
    startTransition(async () => {
      const result: ActionResult = await dismissCoachReading(gameId, reading.seq);
      if (!result.ok) setError(result.error);
    });
  };

  // Taking the dare is an ordinary edit by the player, written under their own
  // name. The coach offered the words; the player owns the reason, and the log
  // should not say otherwise.
  const takeDare = () => {
    if (!dare?.text) return;
    setError(null);
    startTransition(async () => {
      const edited: ActionResult = await editTile(gameId, {
        tileId: reading.tileId,
        text: dare.text ?? "",
      });
      if (!edited.ok) {
        setError(edited.error);
        return;
      }
      const seen: ActionResult = await dismissCoachReading(gameId, reading.seq);
      if (!seen.ok) setError(seen.error);
    });
  };

  return (
    <li className="flex flex-col gap-1 rounded border border-current/20 p-3 text-p-sm">
      <p className="font-semibold">
        {card ? `${card.icon} ${card.name}` : "The coach has a note"}
      </p>
      {card && <p className="text-gray">{card.plain}</p>}
      {tileText && <p className="italic opacity-60">&ldquo;{tileText}&rdquo;</p>}
      {reading.feedback && <p>{reading.feedback}</p>}
      {/* When a dare is on offer the rewrite appears below with a button, so
          printing it here as well would just be the same sentence twice. */}
      {reading.suggestion && !dare && (
        <p className="opacity-80">
          <span className="opacity-60">One way to put it: </span>
          {reading.suggestion}
        </p>
      )}
      <p className="opacity-50">
        Only you can see this. Edit your tile above if you want to, or leave it.
      </p>
      {dare?.text && (
        <div className="flex flex-col gap-1 border-l-2 border-current/30 pl-2">
          <p className="opacity-60">Dare you to say it this way:</p>
          <p>&ldquo;{dare.text}&rdquo;</p>
        </div>
      )}
      <div className="flex items-center gap-3">
        {dare?.text && (
          <button
            type="button"
            onClick={takeDare}
            disabled={pending}
            className="w-fit border border-current/30 px-2 py-1"
          >
            {pending ? "..." : "Take the dare"}
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          disabled={pending}
          className="w-fit border border-current/30 px-2 py-1"
        >
          {pending ? "..." : dare?.text ? "Keep mine" : "Got it"}
        </button>
        {error && <span className="text-orange">{error}</span>}
      </div>
    </li>
  );
}

/**
 * The dare that belongs to one reading.
 *
 * Written immediately after the reading it came from, so a later seq on the
 * same tile is the match. Taking a dare edits the tile and a fresh reading
 * follows, which is why the newest one wins rather than the first.
 */
function dareFor(
  board: BoardState,
  playerId: string,
  reading: CoachReading,
): BoardNudge | null {
  const found = board.nudges.filter(
    (nudge) =>
      nudge.kind === "dare" &&
      nudge.forPlayer === playerId &&
      nudge.targetTileId === reading.tileId &&
      nudge.seq > reading.seq,
  );
  return found.length > 0 ? found[found.length - 1] : null;
}

export function CoachPanel({
  gameId,
  board,
  me,
  enabled,
}: {
  gameId: string;
  board: BoardState;
  me: { playerId: string };
  enabled: boolean;
}): ReactElement {
  // The switch is optimistic, so it keeps its own copy; but the server value is
  // the truth, and it changes under us whenever the page refetches (or, in the
  // dev hot seat, whenever we become the other player). React's documented
  // recipe for that: notice the prop moved, and take it.
  const [on, setOn] = useState(enabled);
  const [lastFromServer, setLastFromServer] = useState(enabled);
  if (lastFromServer !== enabled) {
    setLastFromServer(enabled);
    setOn(enabled);
  }
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const mine = board.coachReadings.filter(
    (reading) => reading.forPlayer === me.playerId && !reading.shown,
  );

  const toggle = () => {
    const next = !on;
    // Optimistic: the switch is a preference, and a failed write leaves the
    // next tile unread rather than breaking anything.
    setOn(next);
    setError(null);
    startTransition(async () => {
      const result: ActionResult = await setCoach(gameId, next);
      if (!result.ok) {
        setOn(!next);
        setError(result.error);
      }
    });
  };

  return (
    // Its own card in the rail, under Ways to win, which is where Rannie draws
    // it (`1096:252192`): a title, a switch on the same line, and one line of
    // subtitle. It used to be a fold-away disclosure row headed "MY AI COACH",
    // which hid the switch behind a click and made the coach look like a
    // drawer of settings rather than the second thing on the screen.
    <section className="border-gray/30 bg-offwhite flex w-full flex-col rounded-2xl border px-5 py-4 shadow-md">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-primary text-neutral-black text-p-lg">AI Coach</h2>
        {/* A switch, not a checkbox. Still a real checkbox underneath, so it
            keeps the label, the focus ring, and the keyboard. */}
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={on}
            onChange={toggle}
            disabled={pending}
            className="peer sr-only"
            aria-label="Let the coach read my reasons"
          />
          <span className="bg-gray/30 peer-checked:bg-green peer-focus-visible:ring-gold/60 h-5 w-9 rounded-full transition-colors peer-focus-visible:ring-2 peer-disabled:opacity-50" />
          <span className="bg-offwhite pointer-events-none absolute top-0.5 left-0.5 h-4 w-4 rounded-full shadow transition-transform peer-checked:translate-x-4" />
        </label>
      </div>
      <p className="text-gray mt-1 text-xs">
        {on
          ? "It reads your reasons and offers a note. It never blocks a move."
          : "Off. Nothing you write is sent anywhere while this is off."}
      </p>

      {error && <p className="text-p-sm text-orange mt-2">{error}</p>}
      {on && mine.length === 0 && (
        <p className="text-gray mt-2 text-xs">
          Nothing to say so far. Silence is the usual answer.
        </p>
      )}
      {mine.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {mine.map((reading) => (
            <ReadingCard
              key={reading.seq}
              gameId={gameId}
              reading={reading}
              tileText={
                board.tiles.find((tile) => tile.id === reading.tileId)?.text ?? null
              }
              dare={dareFor(board, me.playerId, reading)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
