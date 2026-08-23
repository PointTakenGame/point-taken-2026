"use client";

import { useState, useTransition, type ReactElement } from "react";

import type { ActionResult } from "@/app/game/[gameId]/actions";
import { dismissCoachReading, setCoach } from "@/app/game/[gameId]/actions";
import type { BoardState, CoachReading } from "@/lib/board/project";
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
}: {
  gameId: string;
  reading: CoachReading;
  tileText: string | null;
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

  return (
    <li className="flex flex-col gap-1 rounded border border-current/20 p-3 text-sm">
      <p className="font-semibold">
        {card ? `${card.icon} ${card.name}` : "The coach has a note"}
      </p>
      {card && <p className="opacity-70">{card.plain}</p>}
      {tileText && <p className="italic opacity-60">&ldquo;{tileText}&rdquo;</p>}
      {reading.feedback && <p>{reading.feedback}</p>}
      {reading.suggestion && (
        <p className="opacity-80">
          <span className="opacity-60">One way to put it: </span>
          {reading.suggestion}
        </p>
      )}
      <p className="opacity-50">
        Only you can see this. Edit your tile above if you want to, or leave it.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={dismiss}
          disabled={pending}
          className="w-fit border border-current/30 px-2 py-1"
        >
          {pending ? "..." : "Got it"}
        </button>
        {error && <span className="text-red-600">{error}</span>}
      </div>
    </li>
  );
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
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">Coach</h2>
      <label className="flex w-fit items-center gap-2 text-sm">
        <input type="checkbox" checked={on} onChange={toggle} disabled={pending} />
        Let the coach read my reasons
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!on && (
        <p className="text-sm opacity-50">
          Off. Nothing you write is sent anywhere while this is unchecked.
        </p>
      )}
      {on && mine.length === 0 && (
        <p className="text-sm opacity-50">
          Nothing to say so far. Silence is the usual answer.
        </p>
      )}
      {mine.length > 0 && (
        <ul className="flex flex-col gap-2">
          {mine.map((reading) => (
            <ReadingCard
              key={reading.seq}
              gameId={gameId}
              reading={reading}
              tileText={
                board.tiles.find((tile) => tile.id === reading.tileId)?.text ?? null
              }
            />
          ))}
        </ul>
      )}
    </section>
  );
}
