"use client";

/**
 * Opens the five-step walkthrough over the signed-out front door, on every
 * visit, new player or returning. Unlike `useOnboarding`'s "seen" flag (still
 * in force everywhere else the overlay opens: the live board, the "?"
 * launcher, `HomeLinks`' "How to play"), this is a plain `useState(true)`
 * with nothing written to storage, because a visitor who has not started a
 * game yet has nowhere else to be told the one rule this screen exists to
 * teach: a live round only ever holds the cards both players have already
 * earned in the Gym.
 *
 * Steve, 2026-09-16: make this the first thing every visitor to "/" sees,
 * signed-out, and add a choice at the end of it rather than just closing.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

import { OnboardingOverlay } from "@/components/onboarding/onboarding-overlay";
import { StartPlaying } from "@/app/account/start-playing";
import { AgreementTick, useAgreed } from "@/components/legal/agreement";
import { COACH_CARDS } from "@/lib/coach/cards";

/**
 * "Go train in the Gym" from here starts from the same signed-out state
 * "Start playing now" does, and `/gym` bounces anybody with no account back
 * to `/#ladder` (app/gym/page.tsx): a brand-new visitor has none yet. So this
 * mints one the same way `StartPlaying` does, through the same
 * `/api/auth/anonymous` endpoint and behind the same agreement tick, and only
 * then moves on, rather than linking straight to a page that would refuse
 * them.
 */
function TrainInGymButton() {
  const router = useRouter();
  const agreed = useAgreed();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setFailed(null);
    try {
      const res = await fetch("/api/auth/anonymous", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `sign-in failed (${res.status})`);
      }
      router.push("/gym");
    } catch (err) {
      setFailed(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={start}
        disabled={busy || !agreed}
        className="form-base btn-primary bg-green border-green text-neutral-black disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Getting you a name..." : "Go train in the Gym"}
      </button>
      <span className="font-secondary text-p-sm text-gray">Recommended</span>
      {failed && <p className="font-secondary text-p-sm text-orange">{failed}</p>}
    </div>
  );
}

function TrainInGymEndScreen() {
  return (
    <div className="flex flex-col items-center gap-5 pt-2 text-center">
      <div className="flex flex-col gap-1 pr-8">
        <h2 id="onboarding-heading" className="font-primary text-p-lg text-neutral-black">
          One thing before you jump in.
        </h2>
        <p className="font-secondary text-p-sm text-gray">
          A live game only ever puts a rule card on the table if both players already hold
          it. Skip straight to a live game and neither of you holds any yet, so you start
          with an empty hand and stay that way until you train.
        </p>
      </div>

      <ul className="flex w-full max-w-sm flex-col gap-2 rounded-lg border border-gray/30 p-4 text-left">
        {COACH_CARDS.map((card) => (
          <li key={card.id} className="flex items-center gap-3 text-p-sm">
            <span aria-hidden="true">{card.icon}</span>
            <span className="text-neutral-black">{card.name}</span>
            <span className="text-gray ml-auto">Level {card.earnedAtLevel}</span>
          </li>
        ))}
      </ul>
      <p className="font-secondary text-p-sm text-gray -mt-2">
        One card per level. Clearing all four in the Gym is the only way to unlock the
        full hand.
      </p>

      <AgreementTick id="pt-agreement-onboarding-end" />

      <div className="flex w-full flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-center">
        <StartPlaying label="Start playing now" withTick={false} />
        <TrainInGymButton />
      </div>
    </div>
  );
}

export function LandingOnboarding() {
  // No "seen" check and nothing persisted: every load of the signed-out front
  // door starts this true. See the module comment above for why that is the
  // point rather than an oversight.
  const [open, setOpen] = useState(true);

  return (
    <OnboardingOverlay
      open={open}
      onClose={() => setOpen(false)}
      endScreen={<TrainInGymEndScreen />}
    />
  );
}
