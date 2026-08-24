"use client";

import { useState, useTransition } from "react";

/**
 * Ask for the link, and then say so in words.
 *
 * The answer is deliberately the same whether or not the address has an
 * account. Anything else here would let a stranger read the membership list one
 * address at a time, and the cost of the silence is one sentence of copy
 * explaining that nothing arrives if nothing is attached.
 */

const BUTTON = "rounded-md bg-foreground px-4 py-2 text-background disabled:opacity-50";
const FIELD = "rounded-md border border-current/25 bg-transparent px-3 py-2";

const SENT =
  "If that address has an account, a link is on its way. It is good for one hour and one use. Nothing arrives if no account was ever attached to it.";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-col gap-3"
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
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="signin-email">
          Email address
        </label>
        <input
          id="signin-email"
          type="email"
          autoComplete="email"
          className={FIELD}
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button type="submit" className={BUTTON} disabled={pending || !email}>
          {pending ? "Sending..." : "Mail me a link"}
        </button>
      </div>
      {sent ? <p className="text-sm opacity-70">{SENT}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
