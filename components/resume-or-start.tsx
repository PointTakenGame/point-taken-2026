"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createRoom } from "@/app/join/actions";

/**
 * The one action on the profile: back into the game you are in the middle of,
 * or into a new one.
 *
 * Never both. Somebody who left an argument half-finished wants exactly one
 * thing from this page, and a "start a room" button beside the unfinished game
 * is an invitation to abandon it. The entity list (BIZ-T260823-04) asks for one
 * button that changes what it says, so this is one button that changes what it
 * says.
 */

const BUTTON = "rounded-md bg-foreground px-4 py-2 text-background disabled:opacity-50";

export function ResumeOrStart({
  gameId,
  waiting,
  topic,
}: {
  /** The game still running, if there is one. */
  gameId: string | null;
  /** True while the other seat is still empty. */
  waiting: boolean;
  /** The topic of that game, when somebody has set one. */
  topic: string | null;
}) {
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

  if (gameId) {
    return (
      <div className="flex flex-col items-start gap-2">
        <Link href={`/game/${gameId}`} className={BUTTON}>
          {waiting ? "Back to your room" : "Back to your game"}
        </Link>
        <p className="text-sm opacity-70">
          {waiting
            ? "Nobody has taken the other seat yet. The room holds the code to send them."
            : topic
              ? `Still going: ${topic}`
              : "Still going, and nobody has named the topic yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" className={BUTTON} disabled={pending} onClick={begin}>
        {pending ? "Opening a room..." : "Start a room"}
      </button>
      <p className="text-sm opacity-70">
        Nothing running right now. Starting a room gives you a code to send whoever you
        want to argue with.
      </p>
      {failed && <p className="text-sm text-orange">{failed}</p>}
    </div>
  );
}
