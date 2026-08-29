"use client";

import { useState, useTransition } from "react";

/**
 * Ask for the link, and then say so in words.
 *
 * The answer is deliberately the same whether or not the address has an
 * account. Anything else here would let a stranger read the membership list one
 * address at a time, and the cost of the silence is one sentence of copy
 * explaining that nothing arrives if nothing is attached.
 *
 * Chrome comes from `app/globals.css`, which ports the retired client's
 * `.form-base` / `.input-primary` / `.btn-primary` verbatim. This file used to
 * carry its own two-line approximation of them instead, which is how a screen
 * ends up wearing none of the design system while all five gate commands stay
 * green.
 *
 * The label is visible rather than `sr-only`, matching the retired login form,
 * which labelled every field. The retired one also carried a red asterisk for
 * required; there is one field here and the button is disabled until it has
 * something in it, so the asterisk would be marking the obvious.
 */

const SENT =
  "If that address has an account, a link is on its way. It is good for one hour and one use. Nothing arrives if no account was ever attached to it.";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          setError(null);
          setSent(false);
          try {
            const response = await fetch("/api/auth/signin", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ email }),
            });
            const body: { error?: string } = await response.json().catch(() => ({}));
            if (!response.ok) {
              setError(body.error ?? "That did not go through. Try again in a moment.");
              return;
            }
            setSent(true);
          } catch {
            setError("That did not go through. Check your connection and try again.");
          }
        });
      }}
    >
      <div className="flex flex-col gap-2">
        <label className="font-secondary text-p-sm font-medium" htmlFor="signin-email">
          Email
        </label>
        <input
          id="signin-email"
          type="email"
          autoComplete="email"
          className="form-base input-primary w-full"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <button
        type="submit"
        className="form-base btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
        disabled={pending || !email}
      >
        {pending ? "Sending..." : "Mail me a link"}
      </button>
      {sent ? <p className="font-secondary text-p-sm text-gray">{SENT}</p> : null}
      {error ? <p className="font-secondary text-p-sm text-orange">{error}</p> : null}
    </form>
  );
}
