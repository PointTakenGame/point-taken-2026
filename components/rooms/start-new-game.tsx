"use client";

import { createRoom } from "@/app/join/actions";
import { ArrowGlyph } from "@/components/account/account-shell";
import { useRoom } from "@/components/rooms/room-entry";

/**
 * Opens a brand new room and drops you straight into it, full width.
 *
 * The action is `createRoom`, run through `useRoom`
 * (`components/rooms/room-entry.tsx`), the same hook every other way of
 * starting or joining a room already goes through. That is what gives a
 * signed-out caller the silent anonymous-mint retry (POST
 * `/api/auth/anonymous`, then call again) instead of the dead-end "Start
 * playing first" error. Built for the profile's Live play card, where
 * starting a new game and getting back to one already running are now both
 * on offer at once rather than an either/or (BRAIN-T260905 profile play card
 * rework).
 *
 * An unfinished game, if one is running when this fires, is ended before the
 * new one opens: `createRoom` calls `endInFlightGame`
 * (`lib/games/abandon.ts`), so the other player sees it end exactly as if
 * this player had left it. No confirmation here, by Steve's ruling
 * (2026-09-05, BRAIN-T260905-44): the choice to start over is the confirmation.
 */
export function StartNewGameButton({ className }: { className: string }) {
  const { pending, error, enter } = useRoom();

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() => enter(createRoom)}
      >
        {pending ? (
          "Opening a room..."
        ) : (
          <>
            Start a new game
            <ArrowGlyph onDark />
          </>
        )}
      </button>
      {error && <p className="font-secondary text-p-sm text-stat-warm">{error}</p>}
    </div>
  );
}
