import { useSyncExternalStore } from "react";

/**
 * When the landing popup is owed to this browser. Three rules, one place.
 *
 * - **Just got an account:** `markOnboardingPending` (set by "Set me up") means
 *   show it now, as the next thing the new player sees.
 * - **Signed in, once a day:** it is due when the last day it was shown is not
 *   today. The day is stored as a local date string ("2026-09-26"), not a
 *   timestamp, so it reopens on a new calendar day and not 24 hours later.
 *   Showing it, for any reason, records today, so getting an account counts as
 *   that day's showing and a new player does not see it twice in a row.
 * - **On demand:** `requestOnboarding` opens it whatever the day says.
 *
 * It lives in this browser rather than in the event log for the same reason
 * `pt.onboarding.seen` does (onboarding-overlay.tsx): having been shown a
 * tutorial is a fact about the person, not about any game. Every storage read
 * and write is guarded, because a browser that blocks site data must still
 * render the page. Where storage cannot be read the answer is "due", so that
 * browser sees the tutorial rather than never seeing it.
 */

const PENDING_KEY = "pt.onboarding.pending";
const SHOWN_KEY = "pt.onboarding.lastShown";
const CHANGE = "pt-onboarding-change";
const REQUEST = "pt-onboarding-request";

/** The visitor's own calendar day, as a date string. */
export function localDate(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function readPending(): boolean {
  try {
    return window.localStorage.getItem(PENDING_KEY) === "1";
  } catch {
    return false;
  }
}

function readDue(): boolean {
  try {
    return window.localStorage.getItem(SHOWN_KEY) !== localDate();
  } catch {
    return true;
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
    window.localStorage.setItem(PENDING_KEY, "1");
  } catch {
    // Storage blocked: nothing to remember. The signed-in rule still applies.
  }
  window.dispatchEvent(new Event(CHANGE));
}

export function clearOnboardingPending(): void {
  try {
    window.localStorage.removeItem(PENDING_KEY);
  } catch {
    // Same as above.
  }
  window.dispatchEvent(new Event(CHANGE));
}

/** Record that the popup was shown today. */
export function recordOnboardingShown(): void {
  try {
    window.localStorage.setItem(SHOWN_KEY, localDate());
  } catch {
    // Same as above.
  }
  window.dispatchEvent(new Event(CHANGE));
}

/** Open the popup now, whatever the day says. */
export function requestOnboarding(): void {
  window.dispatchEvent(new Event(REQUEST));
}

/** Calls back whenever somebody asks for the popup on demand. */
export function onOnboardingRequested(callback: () => void): () => void {
  window.addEventListener(REQUEST, callback);
  return () => window.removeEventListener(REQUEST, callback);
}

/** A new account is waiting for its walkthrough. False on the server. */
export function useOnboardingPending(): boolean {
  return useSyncExternalStore(subscribe, readPending, () => false);
}

/** The popup has not been shown today. False on the server, so nothing
 *  flashes before hydration. */
export function useOnboardingDue(): boolean {
  return useSyncExternalStore(subscribe, readDue, () => false);
}
