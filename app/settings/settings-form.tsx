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

const BUTTON = "rounded-md bg-foreground px-4 py-2 text-background disabled:opacity-50";
const FIELD = "rounded-md border border-current/25 bg-transparent px-3 py-2";

function Note({ result }: { result: SettingsResult | null }) {
  if (!result) return null;
  return (
    <p className={result.ok ? "text-sm opacity-70" : "text-sm text-red-600"}>
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
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm opacity-70">{hint}</p>
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
    </div>
  );
}
