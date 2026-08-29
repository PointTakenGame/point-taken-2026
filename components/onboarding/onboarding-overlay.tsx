"use client";

/**
 * The four-step new-player walkthrough, full screen.
 *
 * Ported from the retired client's OnboardingModal.vue and OnboardingVideo.vue
 * (app/components/ in point-taken-frontend), which is the only place the
 * mechanic-teaching motion for the plus/minus tile mechanic exists: nothing in
 * this repo explains "hover to add a tile" or "hover to place a token" any
 * other way. See BRAIN-T260825-06.
 *
 * Why this is not built on top of TilePopover (components/ui/tile-popover.tsx):
 * that component is an anchor-relative pop-up, fixed at `w-72`, positioned off
 * a trigger element and clamped to stay near it. This is a full-screen,
 * un-anchored, multi-step wizard with its own backdrop, so it does not fit
 * that shape and would have to fight the anchoring logic at every step. It is
 * a sibling surface instead, reusing the same design tokens (green/orange
 * accents, form-base/btn-icon chrome, the close glyph) so the two read as the
 * same product.
 *
 * Scope note: the retired component actually has six steps. The fifth plays a
 * YouTube embed and the sixth is a callout about the AI coach's turn, with no
 * video asset of its own (the source file says so in a comment). The coach's
 * turn is explicitly listed as still moving in this repo's own CLAUDE.md, so
 * teaching it here would be teaching something that has not been decided yet.
 * Only the first four steps, the ones with an actual instructional clip, are
 * ported. If the coach step is wanted later it needs its own pass once that
 * shape settles.
 *
 * No "remembers seen" behaviour: the retired component always reset to step
 * one on open and never wrote a seen flag anywhere, so this does not either.
 */

import { useEffect, useState } from "react";
import Image from "next/image";

import { RESOLUTION_TOKENS } from "@/lib/board/rules";
import { TokenGlyph, tokenLabel } from "@/components/board/token-glyph";
import { OnboardingVideo } from "@/components/onboarding/onboarding-video";

type OnboardingRole = "plus" | "minus";

type OnboardingMedia =
  { kind: "video"; src: string } | { kind: "images"; top: string; bottom: string };

type OnboardingStep = {
  id: string;
  heading: string;
  subtitle?: string;
  media: OnboardingMedia;
  showTokenLegend?: boolean;
};

const ACCENT_BORDER: Record<OnboardingRole, string> = {
  plus: "border-green",
  minus: "border-orange",
};

const ACCENT_BUTTON: Record<OnboardingRole, string> = {
  plus: "bg-green border-green text-neutral-black",
  minus: "bg-orange border-orange text-neutral-black",
};

const ACCENT_DOT: Record<OnboardingRole, string> = {
  plus: "bg-green",
  minus: "bg-orange",
};

function buildSteps(myRole: OnboardingRole): OnboardingStep[] {
  return [
    {
      id: "starting-tiles",
      heading: "Each player writes two starting reason tiles supporting their opinion.",
      media: {
        kind: "video",
        src:
          myRole === "minus"
            ? "/onboarding/step1-minus.mp4"
            : "/onboarding/step1-plus.mp4",
      },
    },
    {
      id: "add-a-tile",
      heading: "Hover to add a tile.",
      subtitle: "Write only one short idea per tile.",
      media: { kind: "video", src: "/onboarding/step2.mp4" },
    },
    {
      id: "resolve-a-thread",
      heading: "Hover to resolve a thread by placing a token on the tile.",
      subtitle: "What does each token mean?",
      media: { kind: "video", src: "/onboarding/step3.mp4" },
      showTokenLegend: true,
    },
    {
      id: "two-ways-to-win",
      heading: "Two ways to win.",
      media: {
        kind: "images",
        top: "/onboarding/step4-top.png",
        bottom: "/onboarding/step4-bottom.svg",
      },
    },
  ];
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

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  const d = direction === "left" ? "M10 2 L4 8 L10 14" : "M6 2 L12 8 L6 14";
  return (
    <svg viewBox="0 0 16 16" width={12} height={12} aria-hidden="true" focusable="false">
      <path
        d={d}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function OnboardingOverlay({
  open,
  onClose,
  myRole = "plus",
}: {
  open: boolean;
  onClose: () => void;
  /** No live game role exists at every entry point this overlay is reachable from, so it defaults to plus, same as the retired component did when the prop was left unset. */
  myRole?: OnboardingRole;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const steps = buildSteps(myRole);
  const step = steps[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === steps.length - 1;

  // Resets to step one every time the overlay opens, matching the retired
  // component: there is no "resume where you left off". This component stays
  // mounted while closed (it only returns null after the hooks below), so a
  // simple key-based remount will not do the reset for us.
  //
  // Adjusted during render rather than in a useEffect, per React's own
  // guidance for "reset state when a prop changes": calling setState from an
  // effect body causes an extra, avoidable render pass.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setStepIndex(0);
  }

  // Body scroll lock while open, and Escape closes. The retired component
  // toggled document.body.style.overflow the same way.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  function goTo(index: number) {
    setStepIndex(Math.min(Math.max(index, 0), steps.length - 1));
  }

  function handleNext() {
    if (isLastStep) {
      onClose();
      return;
    }
    goTo(stepIndex + 1);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      {/* Purely decorative: no onClick here, so click-outside-to-close is not
          implemented. The retired component's own click-outside behavior
          could not be confirmed from its source, so it was not guessed at.
          Escape and the close button are the real dismiss controls. */}
      <div
        className="absolute inset-0 bg-neutral-black/40 backdrop-blur-sm"
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-labelledby="onboarding-heading"
        className={`relative z-10 flex max-h-full w-full max-w-[680px] flex-col gap-4 overflow-y-auto rounded-2xl border-2 bg-offwhite p-6 shadow-lg ${ACCENT_BORDER[myRole]}`}
      >
        <button
          type="button"
          className="btn-icon absolute right-3 top-3 text-gray"
          aria-label="Close tutorial"
          onClick={onClose}
        >
          <CloseIcon />
        </button>

        <div className="flex flex-col gap-1 pr-8 text-center">
          <h2
            id="onboarding-heading"
            className="font-primary text-p-lg text-neutral-black"
          >
            {step.heading}
          </h2>
          {step.subtitle ? (
            <p className="font-secondary text-p-sm text-gray">{step.subtitle}</p>
          ) : null}
        </div>

        <div className="flex min-h-48 items-center justify-center">
          {step.media.kind === "video" ? (
            <div className="aspect-video w-full max-w-md overflow-hidden rounded-lg border border-gray/30">
              <OnboardingVideo key={step.media.src} src={step.media.src} />
            </div>
          ) : (
            <div className="flex w-full flex-col items-center gap-2">
              <Image
                src={step.media.top}
                alt=""
                width={420}
                height={240}
                unoptimized
                className="h-auto w-full max-w-sm rounded-lg border border-gray/30 object-contain"
              />
              <span className="font-primary text-p-md text-gray">OR</span>
              <Image
                src={step.media.bottom}
                alt=""
                width={420}
                height={240}
                unoptimized
                className="h-auto w-full max-w-sm object-contain"
              />
            </div>
          )}
        </div>

        {step.showTokenLegend ? (
          <ul className="flex flex-col items-center gap-2">
            {RESOLUTION_TOKENS.map((token) => (
              <li key={token} className="flex items-center gap-3 text-p-sm">
                <TokenGlyph token={token} size={24} />
                <span className="text-gray">{tokenLabel(token)}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-col items-center gap-3 pt-2">
          <div className="flex items-center gap-2">
            {steps.map((dotStep, index) => (
              <button
                key={dotStep.id}
                type="button"
                aria-label={`Go to step ${index + 1}`}
                onClick={() => goTo(index)}
                className={`h-2 w-2 rounded-full transition-colors ${
                  index === stepIndex ? ACCENT_DOT[myRole] : "bg-gray/30"
                }`}
              />
            ))}
          </div>
          <p className="text-p-sm font-secondary text-gray">
            Step {stepIndex + 1} of {steps.length}
          </p>
          <div className="flex w-full items-center justify-between gap-2">
            <button
              type="button"
              className={`form-base flex items-center gap-1 border-gray bg-offwhite text-neutral-black ${isFirstStep ? "invisible" : ""}`}
              onClick={() => goTo(stepIndex - 1)}
              disabled={isFirstStep}
            >
              <ArrowIcon direction="left" />
              Back
            </button>
            <button
              type="button"
              className="text-p-sm font-secondary text-gray underline"
              onClick={onClose}
            >
              Skip tutorial
            </button>
            <button
              type="button"
              className={`form-base btn-primary flex items-center gap-1 ${ACCENT_BUTTON[myRole]}`}
              onClick={handleNext}
            >
              {isLastStep ? "Finish" : "Next"}
              {isLastStep ? null : <ArrowIcon direction="right" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
