"use client";

/**
 * The five-step new-player walkthrough, full screen.
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
 * Scope note: the retired component has six steps. Five are here. The sixth is
 * a callout about the AI coach's turn, with no media of its own (the retired
 * source says so in a comment), and the coach's turn is listed as still moving
 * in this repo's own CLAUDE.md, so teaching it here would be teaching something
 * that has not been decided yet. It needs its own pass once that shape settles.
 *
 * The fifth, the explainer video, was left out of the first port for the same
 * reason as the sixth and should not have been: it is the same video the live
 * game shows today, it teaches nothing that is still moving, and it is the one
 * step where a person explains the game in their own voice. Restored on Steve's
 * ask, 2026-09-02.
 *
 * No "remembers seen" behaviour: the retired component always reset to step
 * one on open and never wrote a seen flag anywhere, so this does not either.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";

import { RESOLUTION_TOKENS } from "@/lib/board/rules";
import { TokenGlyph, tokenLabel } from "@/components/board/token-glyph";
import { OnboardingVideo } from "@/components/onboarding/onboarding-video";

type OnboardingRole = "plus" | "minus";

type OnboardingMedia =
  | { kind: "video"; src: string }
  | { kind: "images"; top: string; bottom: string }
  /**
   * Somebody else's player in an iframe, as opposed to `video`, which is one of
   * our own looping clips served from `public/`. Kept as its own kind rather
   * than folded into `video` because the two share no markup: this one cannot
   * loop, cannot be muted by us, and has to carry the permissions list.
   */
  | { kind: "embed"; src: string };

type OnboardingStep = {
  id: string;
  heading: string;
  subtitle?: string;
  /** Makes the subtitle a link out. Only the video step uses it. */
  subtitleHref?: string;
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

/**
 * The explainer the live game already shows (retired `OnboardingVideo.vue`).
 *
 * `youtube-nocookie.com` rather than `youtube.com`: same video, same player, no
 * tracking cookie set on a player who never presses play. The retired client
 * used the plain host, which was the default at the time and not a decision.
 */
const EXPLAINER_EMBED_URL = "https://www.youtube-nocookie.com/embed/bqh1aegbaU8";
const EXPLAINER_WATCH_URL = "https://www.youtube.com/watch?v=bqh1aegbaU8";

function buildSteps(myRole: OnboardingRole): OnboardingStep[] {
  return [
    {
      id: "starting-tiles",
      heading: "Each player writes reason tiles that back their side.",
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
      subtitle: "One short idea per tile.",
      media: { kind: "video", src: "/onboarding/step2.mp4" },
    },
    {
      id: "resolve-a-thread",
      heading: "Hover to place a token and resolve a thread.",
      subtitle: "What each token means:",
      media: { kind: "video", src: "/onboarding/step3.mp4" },
      showTokenLegend: true,
    },
    {
      id: "watch-the-explainer",
      heading: "Watch this video (recommended).",
      subtitle: "Or watch it on YouTube",
      subtitleHref: EXPLAINER_WATCH_URL,
      media: { kind: "embed", src: EXPLAINER_EMBED_URL },
    },
    {
      id: "two-ways-to-win",
      heading: "Two ways to win.",
      subtitle:
        "Agree and agree-to-disagree tokens go on the first tile of a thread, not on later ones.",
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
  onFinish,
}: {
  open: boolean;
  onClose: () => void;
  /** No live game role exists at every entry point this overlay is reachable from, so it defaults to plus, same as the retired component did when the prop was left unset. */
  myRole?: OnboardingRole;
  /**
   * Fires instead of `onClose` when `handleNext` completes the walkthrough
   * from its last step (the "Finish" button). Every other exit (the X
   * button, Escape, Skip tutorial) still calls `onClose`, unchanged. Omit
   * this prop and "Finish" calls `onClose` exactly as it always has: every
   * existing call site (the live board, the "?" launcher, `HomeLinks`'
   * "How to play") passes nothing here and is unaffected.
   */
  onFinish?: () => void;
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
      if (onFinish) {
        onFinish();
      } else {
        onClose();
      }
      return;
    }
    goTo(stepIndex + 1);
  }

  return (
    // `bottom-[var(--dev-bar-h,0px)]` rather than `inset-0`: the dev hot-seat
    // bar (components/dev/hotseat-bar.tsx) is `fixed bottom-0 z-50`, above
    // this overlay's z-40, and on a long step (step 5's images push the
    // dialog low enough) it covered Finish. `--dev-bar-h` is the bar's own
    // measured height, published to the document root the same way
    // components/board/live-board.tsx already reserves space for it; the
    // `,0px` fallback keeps this a no-op wherever the bar isn't rendered,
    // production included.
    <div className="fixed inset-x-0 top-0 bottom-[var(--dev-bar-h,0px)] z-40 flex items-center justify-center p-4">
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
        className={`relative z-10 flex max-h-full w-full ${step.media.kind === "images" ? "max-w-[880px]" : "max-w-[680px]"} flex-col gap-4 overflow-y-auto rounded-2xl border-2 bg-offwhite p-6 shadow-lg ${ACCENT_BORDER[myRole]}`}
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
            <p className="font-secondary text-p-sm text-gray">
              {step.subtitleHref ? (
                <a
                  href={step.subtitleHref}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="hover:text-neutral-black underline underline-offset-2"
                >
                  {step.subtitle}
                </a>
              ) : (
                step.subtitle
              )}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-center">
          {step.media.kind === "video" ? (
            <div className="aspect-video w-[min(100%,28rem,calc(34vh*1.7778))] overflow-hidden rounded-lg border border-gray/30">
              <OnboardingVideo key={step.media.src} src={step.media.src} />
            </div>
          ) : step.media.kind === "embed" ? (
            <div className="aspect-video w-[min(100%,28rem,calc(34vh*1.7778))] overflow-hidden rounded-lg border border-gray/30">
              {/* Permissions and referrer policy carried over verbatim from the
                  retired client's OnboardingVideo.vue, which is what YouTube's
                  own share dialog emits. */}
              <iframe
                key={step.media.src}
                src={step.media.src}
                title="How to play Point Taken"
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-6">
              <Image
                src={step.media.top}
                alt=""
                width={480}
                height={348}
                unoptimized
                className="h-auto w-full max-w-xs rounded-lg border border-gray/30 object-contain sm:w-1/2"
              />
              <span className="font-primary text-p-md text-gray">OR</span>
              <Image
                src={step.media.bottom}
                alt=""
                width={179}
                height={161}
                unoptimized
                className="h-auto w-full max-w-xs object-contain sm:w-1/2"
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

/**
 * Whether this browser has already been walked through the four steps.
 *
 * The overlay used to open on every mount, so it covered the board again on
 * every reload, and reloading mid-game is an ordinary thing to do. There is
 * no event for this and there should not be: having read a tutorial is a fact
 * about the person, not about the game, so it lives in their browser rather
 * than in the log. Losing it costs them one dismissal.
 */
const SEEN_KEY = "pt.onboarding.seen";

const subscribeNoop = () => () => {};

function seenSnapshot(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    // A private window or blocked site data throws on access rather than
    // answering null. Showing the walkthrough again is the harmless answer.
    return false;
  }
}

/**
 * Read once at mount, and never again: the value cannot change under us
 * because this hook is the only thing that writes it.
 *
 * The server answers "seen" so a returning player never gets a frame of
 * backdrop over the board before hydration corrects it. A new player waits
 * one frame for the tutorial instead, which is the right way round.
 */
export function useOnboarding({ auto = true }: { auto?: boolean } = {}): {
  open: boolean;
  show: () => void;
  close: () => void;
} {
  const seen = useSyncExternalStore(subscribeNoop, seenSnapshot, () => true);
  const [dismissed, setDismissed] = useState(false);
  // Asked for on purpose, from the board's "?" button, which has to work
  // whether or not the walkthrough has been read before.
  const [asked, setAsked] = useState(false);

  const show = useCallback(() => setAsked(true), []);

  const close = useCallback(() => {
    setAsked(false);
    setDismissed(true);
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Same as above: it just means they see it again next time.
    }
  }, []);

  // `auto: false` keeps the "?" button working and stops the unasked-for
  // open. A scripted Gym level is its own walkthrough, beat by beat, and two
  // tutorials stacked on the first frame teach neither.
  return { open: asked || (auto && !seen && !dismissed), show, close };
}
