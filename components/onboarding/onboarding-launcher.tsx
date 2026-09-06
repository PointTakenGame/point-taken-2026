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
