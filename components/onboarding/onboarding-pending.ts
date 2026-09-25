import { useSyncExternalStore } from "react";

/**
 * Whether the landing popup is owed to this browser: set the moment an account
 * is made here, cleared the moment the popup first shows.
 *
 * The popup used to open on every visit to "/" for everyone, so a player
 * going "back to the profile" watched the tutorial again. It is now something
 * a new account is owed once, straight after being set up, and nothing else
 * brings it back. A returning signed-in player never has the marker, so they
 * never see it; the "?" on the board and "How to play" on the front door open
 * the walkthrough on purpose and do not touch this.
 *
 * It lives in this browser rather than in the event log for the same reason
 * `pt.onboarding.seen` does (onboarding-overlay.tsx): having been shown a
 * tutorial is a fact about the person, not about any game. Losing it costs
 * one missed or repeated popup, so storage failures are swallowed.
 */

const KEY = "pt.onboarding.pending";
const CHANGE = "pt-onboarding-pending-change";

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function markOnboardingPending(): void {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // Private window or blocked site data: the popup is simply not owed.
  }
  window.dispatchEvent(new Event(CHANGE));
}

export function clearOnboardingPending(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Same as above.
  }
  window.dispatchEvent(new Event(CHANGE));
}

/** False on the server, so nothing flashes before hydration. */
export function useOnboardingPending(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
