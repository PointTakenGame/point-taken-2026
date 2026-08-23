"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { Side, Uuid } from "@/lib/events/types";

/**
 * Local sandbox bypass, see docs/filed/SANDBOX.md.
 *
 * The bar that lets one person play both sides. It is deliberately ugly and
 * deliberately says so: the point is that nobody mistakes it for a feature.
 *
 * It renders only where lib/dev/hotseat.ts says the override is live, and the
 * route it posts to 404s everywhere else, so shipping it does nothing.
 */

export interface HotseatPlayer {
  id: Uuid;
  displayName: string | null;
  role: Side | null;
}

export function HotseatBar({
  gameId,
  me,
  players = [],
}: {
  /** Absent away from a board, where there is nothing to switch between. */
  gameId?: string;
  me: Uuid | null;
  players?: HotseatPlayer[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function call(body: Record<string, string>) {
    setError(null);
    start(async () => {
      const response = await fetch("/api/dev/hotseat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const reason = await response.json().catch(() => ({}));
        setError(reason.error ?? `Failed (${response.status}).`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center gap-2 border-t-2 border-dashed border-yellow-600 bg-yellow-100 px-4 py-2 text-sm text-yellow-950 print:hidden">
      <span className="font-mono font-bold">DEV HOT SEAT</span>

      {players.map((player) => {
        const mine = player.id === me;
        return (
          <button
            key={player.id}
            type="button"
            disabled={pending || mine}
            onClick={() => call({ action: "become", playerId: player.id })}
            className={
              mine
                ? "rounded border border-yellow-900 bg-yellow-900 px-2 py-1 text-yellow-50"
                : "rounded border border-yellow-700 px-2 py-1 underline disabled:opacity-50"
            }
          >
            {player.displayName ?? "unnamed"}
            {player.role ? ` (${player.role})` : " (no side)"}
            {mine ? " ← you" : ""}
          </button>
        );
      })}

      {gameId && players.length < 2 ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => call({ action: "opponent", gameId })}
          className="rounded border border-yellow-700 px-2 py-1 underline disabled:opacity-50"
        >
          + practice opponent
        </button>
      ) : null}

      <button
        type="button"
        disabled={pending}
        onClick={() => call({ action: "release" })}
        className="ml-auto rounded border border-yellow-700 px-2 py-1 underline disabled:opacity-50"
      >
        back to my own login
      </button>

      {error ? <span className="w-full text-red-700">{error}</span> : null}
    </div>
  );
}
