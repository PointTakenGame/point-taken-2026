"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createRoom } from "@/app/join/actions";
import { ArrowGlyph } from "@/components/account/account-shell";

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
 *
 * `compact` (2026-09-04, BRAIN-T260904-40) drops the card and renders only the
 * button, for the Live play card on the profile hero, where the card around it
 * already carries the heading and the blurb. The caller passes the button
 * class, because on that card it is the dark secondary button (Gym play holds
 * the orange one) and it carries the circled arrow, the profile's mark for a
 * button that leaves the page.
 */

// Restyled 2026-09-02: this now sits inside a sticker panel on the profile, and
// a hard-shadowed card inside a hard-shadowed card reads as a mistake. It keeps
// its own edge, one step quieter than its container.
const CARD =
  "flex w-full flex-col items-start gap-3 rounded-xl border border-ink/25 bg-paper p-5";

const BUTTON =
  "font-primary tracking-wide rounded-full border-[1.5px] border-ink bg-orange px-5 py-2.5 text-ink shadow-sticker-sm transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50";

export function ResumeOrStart({
  gameId,
  waiting,
  topic,
  compact = false,
  className,
}: {
  /** The game still running, if there is one. */
  gameId: string | null;
  /** True while the other seat is still empty. */
  waiting: boolean;
  /** The topic of that game, when somebody has set one. */
  topic: string | null;
  /** Button only, no card around it. */
  compact?: boolean;
  /** Button class in compact mode; ignored otherwise. */
  className?: string;
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

  if (compact) {
    const buttonClass = className ?? BUTTON;
    if (gameId) {
      return (
        <Link href={`/game/${gameId}`} className={buttonClass}>
          {waiting ? "Back to your room" : "Back to your game"}
          <ArrowGlyph onDark />
        </Link>
      );
    }
    return (
      <span className="flex flex-col items-start gap-2">
        <button type="button" className={buttonClass} disabled={pending} onClick={begin}>
          {pending ? "Opening a room..." : "Live play"}
          <ArrowGlyph onDark />
        </button>
        {failed && (
          <span className="font-secondary text-p-sm text-stat-warm">{failed}</span>
        )}
      </span>
    );
  }

  if (gameId) {
    return (
      <div className={CARD}>
        <h2 className="font-figure text-ink text-xl font-black tracking-wide uppercase">
          {waiting ? "Your room is open" : "Pick up where you left off"}
        </h2>
        <p className="font-secondary text-p-sm text-ink-soft">
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
      <h2 className="font-figure text-ink text-xl font-black tracking-wide uppercase">
        Ready when you are
      </h2>
      <p className="font-secondary text-p-sm text-ink-soft">
        Nothing running right now. Starting a room gives you a code to send whoever you
        want to argue with.
      </p>
      <button type="button" className={BUTTON} disabled={pending} onClick={begin}>
        {pending ? "Opening a room..." : "Start a room"}
      </button>
      {failed && <p className="font-secondary text-p-sm text-stat-warm">{failed}</p>}
    </div>
  );
}
