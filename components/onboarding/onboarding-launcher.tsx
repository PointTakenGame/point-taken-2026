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
        className="form-base btn-primary self-start border-gray bg-offwhite text-neutral-black"
        onClick={() => setOpen(true)}
      >
        Watch the 4-step tutorial
      </button>
      <OnboardingOverlay open={open} onClose={() => setOpen(false)} />
    </>
  );
}
