"use client";

/**
 * The landing-page tutorial: four short lessons, one per rule card, each
 * run in the same three-phase shape (learn the card, practice the call,
 * card earned) with its own progress tracker, ending in a screen offering
 * a live game now or the Gym first.
 *
 * Opens over the signed-out front door on every visit, new player or
 * returning. Unlike `useOnboarding`'s "seen" flag on the older
 * `OnboardingOverlay` (components/onboarding/onboarding-overlay.tsx, still
 * used unchanged everywhere it already appears: the live board, the "?"
 * launcher, `HomeLinks`' "How to play"), this is a plain `useState(true)`
 * with nothing written to storage: no flag survives a close, so the next
 * page load starts fresh. `cardIndex` and `subPhase` are session-only too,
 * for the same reason, and both reset by construction the moment the
 * overlay unmounts (Skip, or the end screen's own two exits), since neither
 * is read from storage in the first place.
 *
 * This is a different screen from `OnboardingOverlay`'s five-step video
 * walkthrough, not a wrapper around it: Steve's brief for this one is
 * modelled on the Gym's own Level 1 intro pattern (a progress tracker, a
 * dark coach panel, a tappable rule card that expands into examples, a
 * binary practice call), which teaches the empty-hand mechanic this repo's
 * `lib/board/setup.ts` documents: a live round only ever holds the cards
 * both players have already earned, one per Gym level. See
 * `components/onboarding/landing-tutorial-content.ts` for the four lessons'
 * content and its sourcing notes.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

import { coachCard } from "@/lib/coach/cards";
import { StartPlaying } from "@/app/account/start-playing";
import { AgreementTick, useAgreed } from "@/components/legal/agreement";
import { RuleCardFace } from "@/components/board/rule-card-face";
import { StepTracker } from "@/components/onboarding/step-tracker";
import { NarratorPanel } from "@/components/onboarding/narrator-panel";
import { CardDetail } from "@/components/onboarding/card-detail";
import { MakeTheCall } from "@/components/onboarding/make-the-call";
import { CARD_LESSONS } from "@/components/onboarding/landing-tutorial-content";

const PHASES = [
  { label: "Learn the card" },
  { label: "Practice the call" },
  { label: "Card earned" },
];

type SubPhase = "dialogue" | "tap" | "detail" | "practice" | "confirmed";

/** Which of the 3 tracker nodes a sub-phase counts as. */
function trackerStep(subPhase: SubPhase): number {
  if (subPhase === "practice") return 1;
  if (subPhase === "confirmed") return 2;
  return 0;
}

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
 * Mints a guest account the same way `StartPlaying` does, then goes to the
 * Gym instead of refreshing in place. Needed because `/gym` redirects a
 * signed-out visitor straight back to `/#ladder` (app/gym/page.tsx): a
 * brand-new visitor reaching this screen has no account yet, so a plain
 * link to `/gym` would just bounce them home.
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

function EndScreen() {
  return (
    <div className="flex flex-col items-center gap-5 pt-2 text-center">
      <div className="flex flex-col gap-1 pr-8">
        <h2 className="font-primary text-p-lg text-neutral-black">
          One thing before you jump in.
        </h2>
        <p className="font-secondary text-gray text-p-sm">
          A live game only ever puts a rule card on the table if both players already hold
          it. Skip straight to a live game and neither of you holds any yet, so you start
          with an empty hand and stay that way until you train. Train first, and you walk
          in with a full one.
        </p>
      </div>

      <ul className="flex w-full max-w-sm flex-col gap-2 rounded-lg border border-gray/30 p-4 text-left">
        {CARD_LESSONS.map((lesson) => {
          const card = coachCard(lesson.cardId);
          if (!card) return null;
          return (
            <li key={lesson.cardId} className="flex items-center gap-3 text-p-sm">
              <span aria-hidden="true">{card.icon}</span>
              <span className="text-neutral-black">{card.name}</span>
              <span className="text-gray ml-auto">Level {card.earnedAtLevel}</span>
            </li>
          );
        })}
      </ul>
      <p className="font-secondary text-gray text-p-sm -mt-2">
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
  const [open, setOpen] = useState(true);
  const [stage, setStage] = useState<"lessons" | "end">("lessons");
  const [cardIndex, setCardIndex] = useState(0);
  const [subPhase, setSubPhase] = useState<SubPhase>("dialogue");

  if (!open) return null;

  const lesson = CARD_LESSONS[cardIndex];
  const card = coachCard(lesson.cardId);

  function goToCard(index: number) {
    setCardIndex(index);
    setSubPhase("dialogue");
  }

  function handleConfirmedNext() {
    if (cardIndex < CARD_LESSONS.length - 1) {
      goToCard(cardIndex + 1);
    } else {
      setStage("end");
    }
  }

  const close = () => setOpen(false);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div
        className="bg-neutral-black/40 absolute inset-0 backdrop-blur-sm"
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label={
          stage === "end" ? "Ready to play" : `${card?.name ?? "Rule card"} lesson`
        }
        className="border-green relative z-10 flex max-h-full w-full max-w-[680px] flex-col gap-5 overflow-y-auto rounded-2xl border-2 bg-offwhite p-6 shadow-lg"
      >
        <button
          type="button"
          className="btn-icon text-gray absolute top-3 right-3"
          aria-label="Skip tutorial"
          onClick={close}
        >
          <CloseIcon />
        </button>

        {stage === "lessons" ? (
          <>
            <div className="flex flex-col items-center gap-1 pr-8">
              <StepTracker phases={PHASES} current={trackerStep(subPhase)} />
              <p className="font-secondary text-gray text-p-sm text-center">
                {lesson.bossEmoji} {lesson.boss} &middot; {lesson.topic}
              </p>
            </div>

            {subPhase === "dialogue" ? (
              <NarratorPanel
                key={lesson.cardId}
                lines={lesson.dialogue}
                onDone={() => setSubPhase("tap")}
              />
            ) : null}

            {subPhase === "tap" && card ? (
              <div className="flex flex-col items-center gap-4 py-2">
                <p className="font-secondary text-neutral-black text-p-md">
                  Tap the card.
                </p>
                <button
                  type="button"
                  onClick={() => setSubPhase("detail")}
                  aria-label={`Tap the ${card.name} card`}
                  className="cursor-pointer transition-transform hover:-translate-y-1"
                >
                  <RuleCardFace cardId={lesson.cardId} />
                </button>
              </div>
            ) : null}

            {subPhase === "detail" ? (
              <CardDetail
                cardId={lesson.cardId}
                cardIndex={cardIndex}
                examples={lesson.examples}
                takeaway={lesson.takeaway}
                onClose={() => setSubPhase("tap")}
                onContinue={() => setSubPhase("practice")}
              />
            ) : null}

            {subPhase === "practice" ? (
              <MakeTheCall
                key={lesson.cardId}
                prompt={lesson.practice.prompt}
                correctVerdict={lesson.examples[lesson.practice.exampleIndex].verdict}
                explain={lesson.practice.explain}
                onContinue={() => setSubPhase("confirmed")}
              />
            ) : null}

            {subPhase === "confirmed" && card ? (
              <div className="flex flex-col items-center gap-4 py-2 text-center">
                <RuleCardFace cardId={lesson.cardId} />
                <p className="font-primary text-p-lg text-neutral-black">
                  {card.name} is yours.
                </p>
                <button
                  type="button"
                  className="form-base btn-primary bg-green border-green text-neutral-black"
                  onClick={handleConfirmedNext}
                >
                  {cardIndex < CARD_LESSONS.length - 1 ? "Next card" : "See what's next"}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <EndScreen />
        )}
      </div>
    </div>
  );
}
