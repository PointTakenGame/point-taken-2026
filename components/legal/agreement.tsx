"use client";

import { useSyncExternalStore } from "react";

import { AGREEMENT_COOKIE, AGREEMENT_MAX_AGE, PRIVACY_URL, TERMS_URL } from "@/lib/legal";

/**
 * The tick box a visitor passes through before an account is made for them.
 *
 * Steve, 2026-09-03: nothing may be minted or played until the visitor has
 * agreed to the Terms of Use and the Privacy Policy. So this is not decoration
 * on a button. The tick writes a cookie, and `/api/auth/anonymous` refuses to
 * sign anybody in without it, which means the rule holds even for somebody
 * calling the endpoint directly with no page in front of them.
 *
 * The cookie is read through `useSyncExternalStore` rather than an effect, for
 * the same reason the Gym director reads sessionStorage that way: the server
 * render has no cookies, and a snapshot function lets the two disagree without
 * it being a hydration error. A visitor who agreed last week sees the box
 * already ticked a beat after the page paints.
 */

const CHANGE_EVENT = "pt-agreement-change";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

function read(): string {
  try {
    return document.cookie.split("; ").some((entry) => entry === `${AGREEMENT_COOKIE}=1`)
      ? "1"
      : "0";
  } catch {
    return "0";
  }
}

/** True once this browser has agreed. False on the server, always. */
export function useAgreed(): boolean {
  return useSyncExternalStore(subscribe, read, () => "0") === "1";
}

/** Record the answer, or take it back. Unticking is allowed and does nothing
 *  to an account that already exists: this is consent to make one. */
export function setAgreed(next: boolean): void {
  document.cookie = next
    ? `${AGREEMENT_COOKIE}=1; path=/; max-age=${AGREEMENT_MAX_AGE}; samesite=lax`
    : `${AGREEMENT_COOKIE}=; path=/; max-age=0; samesite=lax`;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

const LINK = "text-ink decoration-gold underline underline-offset-2";

export function AgreementTick({ id = "pt-agreement" }: { id?: string }) {
  const agreed = useAgreed();

  return (
    <label
      htmlFor={id}
      className="text-ink-soft font-secondary text-p-sm flex max-w-md cursor-pointer items-start gap-3 text-left"
    >
      <input
        id={id}
        type="checkbox"
        checked={agreed}
        onChange={(event) => setAgreed(event.target.checked)}
        className="border-ink accent-orange mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
      />
      <span>
        I agree to the{" "}
        <a className={LINK} href={TERMS_URL} target="_blank" rel="noreferrer">
          Terms of Use
        </a>{" "}
        and the{" "}
        <a className={LINK} href={PRIVACY_URL} target="_blank" rel="noreferrer">
          Privacy Policy
        </a>
        .
      </span>
    </label>
  );
}
