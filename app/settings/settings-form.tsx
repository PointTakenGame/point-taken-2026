"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { claimAccount, renamePlayer, setCoach, type SettingsResult } from "./actions";

/**
 * The three settings forms, each its own island.
 *
 * They are separate components rather than one form with three fields because
 * they are three unrelated commitments: renaming is instant, the coach toggle
 * is a preference, and attaching an email starts something that finishes in a
 * mail client. A single Save button would imply they land together.
 *
 * Every one of them reports back in words rather than by silently succeeding.
 * A settings page that changes nothing visible when you press the button is a
 * page you press twice.
 */

/*
  Chrome comes from `app/globals.css`, which ports the retired client's
  `.form-base` / `.input-primary` / `.btn-primary` verbatim. These two names
  used to hold a bespoke approximation of them, which is how a screen ends up
  wearing none of the design system while all five gate commands stay green.

  Only the controls change here. The page's layout and typography stay plain on
  purpose: Rannie's settings frame carries rows for systems that are not decided
  (BRAIN-T260817-02), so laying this out against it now would bake in a design
  nobody has ratified. See the header comment on `./page.tsx`.
*/
const BUTTON =
  "form-base btn-primary px-4 py-2 text-p-sm font-secondary disabled:cursor-not-allowed disabled:opacity-50";
const FIELD = "form-base input-primary";

function Note({ result }: { result: SettingsResult | null }) {
  if (!result) return null;
  return (
    <p className={result.ok ? "text-p-sm text-gray" : "text-p-sm text-orange"}>
      {result.ok ? result.message : result.error}
    </p>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-t border-current/10 pt-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-p-lg font-semibold">{title}</h2>
        <p className="text-p-sm text-gray">{hint}</p>
      </div>
      {children}
    </section>
  );
}

function Rename({ current }: { current: string }) {
  const router = useRouter();
  const [name, setName] = useState(current);
  const [result, setResult] = useState<SettingsResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          const outcome = await renamePlayer(name);
          setResult(outcome);
          if (outcome.ok) router.refresh();
        });
      }}
    >
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="display-name">
          Display name
        </label>
        <input
          id="display-name"
          className={FIELD}
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
        />
        <button
          type="submit"
          className={BUTTON}
          disabled={pending || name.trim() === current}
        >
          {pending ? "Saving..." : "Save name"}
        </button>
      </div>
      <Note result={result} />
    </form>
  );
}

/**
 * The toggle re-reads the server's answer when it changes, using the sentinel
 * recipe: `useState(enabled)` captures the prop once, so after a refresh (or a
 * hot-seat switch to a player with the opposite setting) the switch would still
 * be showing the previous player's choice.
 */
function CoachToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [lastFromServer, setLastFromServer] = useState(enabled);
  const [result, setResult] = useState<SettingsResult | null>(null);
  const [pending, start] = useTransition();

  if (enabled !== lastFromServer) {
    setLastFromServer(enabled);
    setOn(enabled);
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={on}
          disabled={pending}
          onChange={(event) => {
            const next = event.target.checked;
            setOn(next);
            start(async () => {
              const outcome = await setCoach(next);
              setResult(outcome);
              if (outcome.ok) router.refresh();
              else setOn(!next);
            });
          }}
        />
        <span>Let the coach read my reasons</span>
      </label>
      <Note result={result} />
    </div>
  );
}

function ClaimAccount() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<SettingsResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => setResult(await claimAccount(email)));
      }}
    >
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="claim-email">
          Email address
        </label>
        <input
          id="claim-email"
          type="email"
          className={FIELD}
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button type="submit" className={BUTTON} disabled={pending || !email}>
          {pending ? "Sending..." : "Send the link"}
        </button>
      </div>
      <Note result={result} />
    </form>
  );
}

/**
 * Letting go of this browser's session.
 *
 * Offered even when the account has no email, because on the live site this is
 * the only way for one person to become a second player, and refusing would
 * leave testers clearing cookies by hand. But for an unclaimed account it is
 * one way, so it asks twice and says plainly what the second click ends.
 *
 * Leaving is a push followed by a refresh. The response to the sign-out has
 * already cleared the cookies, but the router still holds server-rendered
 * output from when they existed, so without the refresh the front door would
 * come back still greeting you by name.
 */
function SignOut({ claimed }: { claimed: boolean }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const needsConfirming = !claimed && !armed;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={BUTTON}
          disabled={pending}
          onClick={() => {
            if (needsConfirming) {
              setArmed(true);
              return;
            }
            start(async () => {
              setError(null);
              try {
                const response = await fetch("/api/auth/signout", { method: "POST" });
                if (!response.ok) {
                  setError("That did not go through. Try again in a moment.");
                  return;
                }
                router.replace("/");
                router.refresh();
              } catch {
                setError("That did not go through. Check your connection and try again.");
              }
            });
          }}
        >
          {pending ? "Signing out..." : armed ? "Yes, end this account" : "Sign out"}
        </button>
        {armed ? (
          <button
            type="button"
            className="text-p-sm underline text-gray"
            onClick={() => setArmed(false)}
          >
            Keep me signed in
          </button>
        ) : null}
      </div>
      {error ? <p className="text-p-sm text-orange">{error}</p> : null}
    </div>
  );
}

export function SettingsForm({
  displayName,
  coachEnabled,
  claimed,
}: {
  displayName: string;
  coachEnabled: boolean;
  claimed: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Section
        title="Your name"
        hint="This is what your opponent sees. You were given one; change it if you want a different one."
      >
        <Rename current={displayName} />
      </Section>

      <Section
        title="The coach"
        hint="Off by default. When it is on, the coach reads each reason as you place it and can offer a rule card or a rewrite. Only you see what it says about your own reasons."
      >
        <CoachToggle enabled={coachEnabled} />
      </Section>

      <Section
        title="Keeping this account"
        hint={
          claimed
            ? "This account has an email attached, so it survives this browser. Adding a different address sends a new confirmation link."
            : "This account lives in this browser only. Attach an email and it survives a cleared cache or a new machine. No password: signing back in is a mailed link."
        }
      >
        <ClaimAccount />
      </Section>

      <Section
        title="This browser"
        hint={
          claimed
            ? "Signing out ends the session here. Your account keeps everything, and a mailed link brings you back to it."
            : "This account has no email, so it exists only as a cookie in this browser. Signing out ends it: the games on it stay in the database but nothing can reach them again. Attach an email above first if you want it back."
        }
      >
        <SignOut claimed={claimed} />
      </Section>
    </div>
  );
}
