"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createRoom } from "@/app/join/actions";
import { ArrowGlyph } from "@/components/account/account-shell";

/**
 * Opens a brand new room and drops you straight into it, full width.
 *
 * The action is `createRoom`, the same one every other way of starting a room
 * already goes through (`components/resume-or-start.tsx`,
 * `components/rooms/room-entry.tsx`'s "Create a room" link). This is a
 * different button around the same call, built for the profile's Live play
 * card, where starting a new game and getting back to one already running are
 * now both on offer at once rather than an either/or (BRAIN-T260905 profile
 * play card rework).
 *
 * An unfinished game, if one is running when this fires, is ended before the
 * new one opens: `createRoom` calls `endInFlightGame`
 * (`lib/games/abandon.ts`), so the other player sees it end exactly as if
 * this player had left it. No confirmation here, by Steve's ruling
 * (2026-09-05, BRAIN-T260905-44): the choice to start over is the confirmation.
 */
export function StartNewGameButton({ className }: { className: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState<string | null>(null);

  function begin() {
    setFailed(null);
    start(async () => {
      try {
        const result = await createRoom();
        if (!result.ok) {
          setFailed(result.error);
          return;
        }
        router.push(`/game/${result.gameId}`);
      } catch (err) {
        setFailed(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" className={className} disabled={pending} onClick={begin}>
        {pending ? (
          "Opening a room..."
        ) : (
          <>
            Start a new game
            <ArrowGlyph onDark />
          </>
        )}
      </button>
      {failed && <p className="font-secondary text-p-sm text-stat-warm">{failed}</p>}
    </div>
  );
}
