"use client";

/**
 * The landing-page popup: three stages shown in order over the signed-out
 * front door, on every visit, new player or returning.
 *
 * 1. A short intro to what the game is, before anything else.
 * 2. The existing five-step walkthrough (`OnboardingOverlay`), reused
 *    unchanged: same component, same steps, same everything, used exactly
 *    the way the live board and the "?" launcher already use it. The only
 *    thing this wrapper adds is `onFinish`, an additive prop on that
 *    component that fires when the walkthrough's own last-step "Finish" is
 *    pressed, so this wrapper can move to stage 3 instead of the walkthrough
 *    just closing. Every other call site passes nothing there and is
 *    unaffected.
 * 3. An end screen: go train in the Gym (recommended, and it mints a guest
 *    account first, since `/gym` otherwise bounces a signed-out visitor
 *    back to `/#ladder`), or play a live game from the beginning, reusing
 *    `StartPlaying` exactly as the plain landing page does.
 *
 * Nothing here is read from or written to storage: `useState(true)` for
 * whether the popup is open at all, and a plain stage variable for which of
 * the three is showing. Both reset to their initial values the moment this
 * component unmounts, which is exactly what "reopens every visit" needs and
 * nothing more.
 */

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { StartPlaying } from "@/app/account/start-playing";
import { AgreementTick, useAgreed } from "@/components/legal/agreement";
import { OnboardingOverlay } from "@/components/onboarding/onboarding-overlay";
import { COACH_CARDS } from "@/lib/coach/cards";

type Stage = "intro" | "walkthrough" | "end";

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden="true" focusable="false">
      <path
        d="M2 2 L14 14 M14 2 L2 14"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The chrome stages 1 and 3 share: same backdrop, same dialog panel, same
 *  close button as `OnboardingOverlay` itself, so all three stages read as
 *  one popup rather than three different ones. Stage 2 is `OnboardingOverlay`
 *  rendered on its own, which draws this same chrome itself. */
function PopupShell({
  onClose,
  label,
  children,
}: {
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div
        className="bg-neutral-black/40 absolute inset-0 backdrop-blur-sm"
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label={label}
        className="border-green relative z-10 flex max-h-full w-full max-w-[680px] flex-col gap-4 overflow-y-auto rounded-2xl border-2 bg-offwhite p-6 shadow-lg"
      >
        <button
          type="button"
          className="btn-icon text-gray absolute top-3 right-3"
          aria-label="Close tutorial"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
        {children}
      </div>
    </div>
  );
}

function IntroStage({ onNext, onClose }: { onNext: () => void; onClose: () => void }) {
  return (
    <PopupShell onClose={onClose} label="Welcome to Point Taken">
      <div className="flex flex-col items-center gap-4 pt-2 pr-8 text-center">
        <h2 className="font-primary text-p-lg text-neutral-black">
          Point Taken is a game about disagreeing well.
        </h2>
        <p className="font-secondary text-gray text-p-md max-w-md leading-relaxed">
          Two players take opposite sides of a question and place short reason tiles, one
          idea per tile, each hung off an earlier one. A thread ends the moment both
          players put the same token on it, agreeing about how that piece of the
          disagreement turned out.
        </p>
      </div>
      <div className="flex w-full flex-col items-center gap-3 pt-2">
        <button
          type="button"
          className="form-base btn-primary bg-green border-green text-neutral-black"
          onClick={onNext}
        >
          Next
        </button>
        <button
          type="button"
          className="text-p-sm font-secondary text-gray underline"
          onClick={onClose}
        >
          Skip tutorial
        </button>
      </div>
    </PopupShell>
  );
}

/**
 * Mints a guest account the same way `StartPlaying` does, then goes to the
 * Gym instead of refreshing in place. Needed because `/gym` redirects a
 * signed-out visitor straight back to `/#ladder` (app/gym/page.tsx): a
 * brand-new visitor reaching this screen has no account yet, so a plain
 * link to `/gym` would just bounce them home.
 */
function GoToGymButton() {
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
    <div className="flex w-full flex-col items-center gap-1">
      <button
        type="button"
        onClick={start}
        disabled={busy || !agreed}
        className="form-base btn-primary bg-green border-green text-neutral-black w-full py-4 text-lg disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Getting you a name..." : "Go to the Gym"}
      </button>
      <span className="font-label text-stat-good text-xs font-bold tracking-widest uppercase">
        Recommended
      </span>
      {failed && <p className="font-secondary text-p-sm text-orange">{failed}</p>}
    </div>
  );
}

function EndStage({ onClose }: { onClose: () => void }) {
  return (
    <PopupShell onClose={onClose} label="Ready to play">
      <div className="flex flex-col items-center gap-5 pt-2 pr-8 text-center">
        <div className="flex flex-col gap-1">
          <h2 className="font-primary text-p-lg text-neutral-black">
            One thing before you jump in.
          </h2>
          <p className="font-secondary text-gray text-p-sm max-w-md">
            All four rule cards are earned one per Gym level. A live round only ever holds
            the cards both players have already earned, so training first means starting a
            live round with a full hand instead of an empty one.
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

        <AgreementTick id="pt-agreement-onboarding-end" />

        <div className="flex w-full max-w-sm flex-col items-center gap-4">
          <GoToGymButton />
          <StartPlaying label="Play a game from the beginning" withTick={false} />
        </div>
      </div>
    </PopupShell>
  );
}

export function LandingOnboarding() {
  const [open, setOpen] = useState(true);
  const [stage, setStage] = useState<Stage>("intro");

  if (!open) return null;

  const close = () => setOpen(false);

  if (stage === "walkthrough") {
    return <OnboardingOverlay open onClose={close} onFinish={() => setStage("end")} />;
  }

  if (stage === "end") {
    return <EndStage onClose={close} />;
  }

  return <IntroStage onNext={() => setStage("walkthrough")} onClose={close} />;
}
