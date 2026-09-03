"use client";

/**
 * The trigger button plus the overlay it opens, bundled together so a server
 * component (app/how-to-play/page.tsx) can drop in one client island without
 * itself needing local state.
 */

import { useState } from "react";

import { OnboardingOverlay } from "@/components/onboarding/onboarding-overlay";

export function OnboardingLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="font-label border-ink bg-card text-ink hover:bg-sand self-start rounded-full border-[1.5px] px-5 py-2 text-xs font-bold tracking-widest uppercase transition-colors"
        onClick={() => setOpen(true)}
      >
        Watch the 4-step tutorial
      </button>
      <OnboardingOverlay open={open} onClose={() => setOpen(false)} />
    </>
  );
}
