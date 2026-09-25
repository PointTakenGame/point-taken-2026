"use client";

/**
 * The tutorial popup: three stages shown in order over the profile.
 *
 * 1. A short intro to what the game is, before anything else.
 * 2. The existing five-step walkthrough (`OnboardingOverlay`), reused
 *    unchanged apart from an additive `onFinish` prop that fires on its
 *    last step's "Finish", so this wrapper can move to stage 3 instead of
 *    the walkthrough just closing. Every other call site passes nothing there.
 * 3. An end screen with the two ways in, and both open a board rather than a
 *    menu: "Go to the Gym" opens the level the player should do next
 *    (`startCurrentLevel`) and "Play a game from the beginning" opens a fresh
 *    live room (`createRoom`), both through `useRoom`, which mints a guest
 *    account when needed.
 *
 * When it opens (rules in onboarding-pending.ts):
 * - Signed out: never. The visitor is set up first ("Set me up" is
 *   `StartPlaying`, which leaves a marker) and the popup opens straight
 *   after, over the new profile.
 * - Signed in: the first visit to "/" each day, and not again that day.
 * - On demand: `HowToPlayButton` (onboarding-launcher.tsx) opens it at any
 *   time, ignoring the day.
 * Showing it for any reason records today, so a new account counts as that
 * day's showing and is not followed by a second one. `signedIn` comes from
 * the server (`currentPlayerId()` in app/page.tsx); the stage variable resets
 * when this unmounts.
 */

import { useEffect, useState, type ReactNode } from "react";

import { startCurrentLevel } from "@/app/gym/actions";
import { createRoom } from "@/app/join/actions";
import { AgreementTick, useAgreed } from "@/components/legal/agreement";
import { useRoom } from "@/components/rooms/room-entry";
import { OnboardingOverlay } from "@/components/onboarding/onboarding-overlay";
import {
  clearOnboardingPending,
  onOnboardingRequested,
  recordOnboardingShown,
  useOnboardingDue,
  useOnboardingPending,
} from "@/components/onboarding/onboarding-pending";
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

/**
 * The chrome stages 1 and 3 share: same backdrop, same dialog panel, same
 * close button as `OnboardingOverlay` itself, so all three stages read as
 * one popup rather than three different ones. Stage 2 is `OnboardingOverlay`
 * rendered on its own, which draws this same chrome itself.
 *
 * `bottom-[var(--dev-bar-h,0px)]` on the outer layer, not just padding on the
 * dialog, so the dialog's own `items-center` centering shrinks to fit above
 * the bar too, rather than staying centered on the full viewport and
 * growing past the shrunk space. `--dev-bar-h` is the dev hot-seat bar's own
 * measured height (components/dev/hotseat-bar.tsx, `fixed bottom-0 z-50`,
 * above this popup's z-40), published to the document root the same way
 * `components/board/live-board.tsx` already reserves space for it. The
 * `,0px` fallback is what keeps this a no-op in production, where the bar
 * never renders and the property is never set.
 */
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
    <div className="fixed inset-x-0 top-0 bottom-[var(--dev-bar-h,0px)] z-40 flex items-center justify-center p-4">
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
 * Opens the level this player should do next and goes to its board.
 *
 * The destination is the server's call, not this component's: `startCurrentLevel`
 * reads the ladder and returns the first rung the player has not cleared, so a
 * brand-new visitor lands in level 1 and somebody coming back lands where they
 * left off. Nothing here needs to know which that is.
 *
 * `useRoom` carries the guest-account handshake: when the action answers
 * `signIn`, it POSTs /api/auth/anonymous and calls again, so one press does one
 * thing. The agreement tick gates the button only for a signed-out visitor,
 * who is about to be given an account by pressing it; somebody already signed
 * in agreed when their account was made and is not asked twice.
 */
function GoToGymButton({ signedIn }: { signedIn: boolean }) {
  const agreed = useAgreed();
  const { pending, error, enter } = useRoom();

  return (
    <div className="flex w-full flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => enter(startCurrentLevel)}
        disabled={pending || (!signedIn && !agreed)}
        className="form-base btn-primary bg-green border-green text-neutral-black w-full py-4 text-lg disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Opening your level..." : "Go to the Gym"}
      </button>
      <span className="font-label text-stat-good text-xs font-bold tracking-widest uppercase">
        Recommended
      </span>
      {error && <p className="font-secondary text-p-sm text-orange">{error}</p>}
    </div>
  );
}

/**
 * Opens a fresh live room and drops the visitor into it, the same call and the
 * same hook as "Start a new game" on the profile's Live play card. Gated on the
 * one tick the end screen already shows, for the same reason as the Gym button
 * above.
 */
function PlayFromBeginningButton({ signedIn }: { signedIn: boolean }) {
  const agreed = useAgreed();
  const { pending, error, enter } = useRoom();

  return (
    <div className="flex w-full flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => enter(createRoom)}
        disabled={pending || (!signedIn && !agreed)}
        className="form-base font-secondary w-full disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Opening a room..." : "Play a game from the beginning"}
      </button>
      {error && <p className="font-secondary text-p-sm text-orange">{error}</p>}
    </div>
  );
}

function EndStage({ onClose, signedIn }: { onClose: () => void; signedIn: boolean }) {
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
          <GoToGymButton signedIn={signedIn} />
          <PlayFromBeginningButton signedIn={signedIn} />
        </div>
      </div>
    </PopupShell>
  );
}

export function LandingOnboarding({ signedIn = false }: { signedIn?: boolean }) {
  const pending = useOnboardingPending();
  const dueToday = useOnboardingDue();
  // Signed out is never due: the account step comes first, and the marker
  // that "Set me up" leaves is what brings the popup after it.
  const owed = pending || (signedIn && dueToday);
  const [open, setOpen] = useState(false);
  const [autoShown, setAutoShown] = useState(false);
  const [stage, setStage] = useState<Stage>("intro");

  // Opens itself once per mount. Latched, because where storage is blocked
  // "due" never turns false and would reopen it the moment it was closed.
  if (owed && !open && !autoShown) {
    setOpen(true);
    setAutoShown(true);
  }

  // Whatever opened it, today is now spent and a marker is consumed, so a
  // refresh or a reload mid-walkthrough does not bring it back.
  useEffect(() => {
    if (!open) return;
    clearOnboardingPending();
    recordOnboardingShown();
  }, [open]);

  // On demand, from the How to play button: from the top, whatever the day.
  useEffect(
    () =>
      onOnboardingRequested(() => {
        setStage("intro");
        setOpen(true);
      }),
    [],
  );

  if (!open) return null;

  const close = () => setOpen(false);

  if (stage === "walkthrough") {
    return <OnboardingOverlay open onClose={close} onFinish={() => setStage("end")} />;
  }

  if (stage === "end") {
    return <EndStage onClose={close} signedIn={signedIn} />;
  }

  return <IntroStage onNext={() => setStage("walkthrough")} onClose={close} />;
}
