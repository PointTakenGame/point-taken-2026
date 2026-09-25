"use client";

/**
 * The trigger plus the overlay it opens, bundled together so a server
 * component can drop in one client island without itself needing local state.
 *
 * There used to be a How to play page, and four screens linked to it. Steve
 * retired it on 2026-09-03: the four-step overlay says the same thing without
 * making a player leave whatever they were doing to read it. So this launcher
 * took the page's place at all four of those doors, and each one styles it to
 * look like the link it replaced by passing `className` and its own words.
 */

import { useState, type ReactNode } from "react";

import { OnboardingOverlay } from "@/components/onboarding/onboarding-overlay";
import { requestOnboarding } from "@/components/onboarding/onboarding-pending";

const DEFAULT_CLASS =
  "font-label border-ink bg-card text-ink hover:bg-sand self-start rounded-full border-[1.5px] px-5 py-2 text-xs font-bold tracking-widest uppercase transition-colors";

export function OnboardingLauncher({
  className = DEFAULT_CLASS,
  children = "Watch the 4-step tutorial",
  label,
}: {
  className?: string;
  children?: ReactNode;
  /** For a launcher whose visible text is a glyph, the "?" on the board. */
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={label}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      <OnboardingOverlay open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/**
 * A visible "How to play" for a signed-in player, fixed to the corner of the
 * page. Opens the full tutorial popup (`LandingOnboarding`, mounted by
 * app/page.tsx) whatever the once-a-day rule says, which is the point: the
 * popup opens itself once a day, and a player who is lost between those
 * times needs somewhere obvious to ask for it. The launchers above open the
 * plain five-step walkthrough and stay where they are; the small "Help" in
 * the account footer is easy to miss.
 *
 * Bottom left, because the feedback button owns the bottom right and the dev
 * hot-seat bar (`--dev-bar-h`) sits under both.
 */
export function HowToPlayButton() {
  return (
    <button
      type="button"
      onClick={requestOnboarding}
      className="font-label border-ink bg-card text-ink hover:bg-sand fixed bottom-[calc(1rem+var(--dev-bar-h,0px))] left-4 z-30 cursor-pointer rounded-full border-[1.5px] px-4 py-2 text-xs font-bold tracking-widest uppercase shadow-md transition-colors"
    >
      How to play
    </button>
  );
}
