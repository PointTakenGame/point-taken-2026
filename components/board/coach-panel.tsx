"use client";

import { useEffect, useMemo, useState, useTransition, type ReactElement } from "react";

import type { ActionResult } from "@/app/game/[gameId]/actions";
import { dismissCoachReading, editTile, setCoach } from "@/app/game/[gameId]/actions";
import type {
  BoardNudge,
  BoardState,
  BoardTile,
  CoachReading,
} from "@/lib/board/project";
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
    <li className="border-gray/30 bg-neutral-white text-p-sm flex flex-col gap-1 rounded-xl border p-3">
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
        <div className="border-gold/60 flex flex-col gap-1 border-l-2 pl-2">
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
            className="border-gray/40 hover:bg-sand/40 w-fit cursor-pointer rounded-full border px-3 py-0.5 text-xs disabled:cursor-default disabled:opacity-40"
          >
            {pending ? "..." : "Take the dare"}
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          disabled={pending}
          className="border-gray/40 hover:bg-sand/40 w-fit cursor-pointer rounded-full border px-3 py-0.5 text-xs disabled:cursor-default disabled:opacity-40"
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

/**
 * How long the panel is willing to say it is still reading.
 *
 * The round trip is a model call, measured here at eight to ten seconds on
 * haiku, and a silent reading writes nothing at all, so there is no event that
 * means "finished, and had nothing to say". This is the only clock available.
 * Fifteen is comfortably past the slowest reading observed without leaving the
 * line up long enough to become its own lie.
 */
const COACH_WAIT_MS = 15_000;

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

  // The reason I placed most recently, which is the one the coach is reading if
  // it is reading anything at all.
  const myNewest = useMemo(() => {
    let best: BoardTile | null = null;
    for (const tile of board.tiles) {
      if (tile.placedBy !== me.playerId) continue;
      if (!best || tile.placedAtSeq > best.placedAtSeq) best = tile;
    }
    return best;
  }, [board.tiles, me.playerId]);

  // Between placing a reason and the reading coming back, this panel used to
  // say "Nothing to say so far", which is exactly what it says when the coach
  // is broken. Steve read it the obvious way: the coach is on and does nothing
  // (2026-09-02). It was working the whole time; it just had no way to say it
  // was still reading. Now it does.
  //
  // Seeded from the board rather than from null, so opening a game that
  // already has my reasons on it does not claim to be reading the oldest one.
  const [seenTile, setSeenTile] = useState<string | null>(() => myNewest?.id ?? null);
  const [waitingFor, setWaitingFor] = useState<string | null>(null);
  if (myNewest && seenTile !== myNewest.id) {
    setSeenTile(myNewest.id);
    setWaitingFor(on ? myNewest.id : null);
  }
  useEffect(() => {
    if (!waitingFor) return;
    const timer = setTimeout(() => setWaitingFor(null), COACH_WAIT_MS);
    return () => clearTimeout(timer);
  }, [waitingFor]);

  const answered =
    myNewest !== null &&
    board.coachReadings.some((reading) => reading.tileId === myNewest.id);
  const reading = on && waitingFor !== null && waitingFor === myNewest?.id && !answered;

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
            keeps the label, the focus ring, and the keyboard. Too small to
            carry the full sentence, so the short form is its accessible
            name and the full sentence is the hover tooltip, matching the
            Settings tab's spelled-out wording of the same toggle. */}
        <label
          className="relative inline-flex cursor-pointer items-center"
          title="Let the coach give me feedback and help me as I play"
        >
          <input
            type="checkbox"
            checked={on}
            onChange={toggle}
            disabled={pending}
            className="peer sr-only"
            aria-label="Coach feedback"
          />
          <span className="bg-gray/30 peer-checked:bg-green peer-focus-visible:ring-gold/60 h-5 w-9 rounded-full transition-colors peer-focus-visible:ring-2 peer-disabled:opacity-50" />
          <span className="bg-offwhite pointer-events-none absolute top-0.5 left-0.5 h-4 w-4 rounded-full shadow transition-transform peer-checked:translate-x-4" />
        </label>
      </div>
      <p className="text-gray mt-1 text-xs">
        {on
          ? "It gives you feedback as you play and can offer a note. It never blocks a move."
          : "Off. Nothing you write is sent anywhere while this is off."}
      </p>

      {error && <p className="text-p-sm text-orange mt-2">{error}</p>}
      {on && reading && (
        <p className="text-gray mt-2 text-xs italic">Reading that one now...</p>
      )}
      {on && !reading && mine.length === 0 && (
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
