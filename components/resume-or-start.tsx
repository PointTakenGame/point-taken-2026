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
 *
 * Styled as the one card on the page that gets an orange pill button rather
 * than the plain form-base treatment everywhere else: this is the single
 * highest-priority action here, and Rannie's frames reserve that colour for
 * exactly one call to action per card for the same reason.
 */

const CARD =
  "flex flex-col items-start gap-3 rounded-2xl border-2 border-neutral-black bg-neutral-white p-5 shadow-sm";

const BUTTON =
  "font-primary tracking-wide rounded-full bg-orange px-5 py-2.5 text-neutral-black shadow-sm transition-shadow hover:shadow-md active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50";

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
      <div className={CARD}>
        <h2 className="font-primary text-p-lg tracking-wide">
          {waiting ? "Your room is open" : "Pick up where you left off"}
        </h2>
        <p className="font-secondary text-p-sm text-gray">
          {waiting
            ? "Nobody has taken the other seat yet. The room holds the code to send them."
            : topic
              ? `Still going: ${topic}`
              : "Still going, and nobody has named the topic yet."}
        </p>
        <Link href={`/game/${gameId}`} className={BUTTON}>
          {waiting ? "Back to your room" : "Back to your game"}
        </Link>
      </div>
    );
  }

  return (
    <div className={CARD}>
      <h2 className="font-primary text-p-lg tracking-wide">Ready when you are</h2>
      <p className="font-secondary text-p-sm text-gray">
        Nothing running right now. Starting a room gives you a code to send whoever you
        want to argue with.
      </p>
      <button type="button" className={BUTTON} disabled={pending} onClick={begin}>
        {pending ? "Opening a room..." : "Start a room"}
      </button>
      {failed && <p className="font-secondary text-p-sm text-orange">{failed}</p>}
    </div>
  );
}
