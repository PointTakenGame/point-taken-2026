"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { AgreementTick, useAgreed } from "@/components/legal/agreement";

/**
 * Signs in anonymously, then re-renders the page as the new player.
 *
 * The tick box above the button is the gate: the account is made by pressing
 * this, so this is where the visitor agrees. `/api/auth/anonymous` refuses
 * without the cookie the tick writes, so the disabled button is a courtesy
 * rather than the rule.
 */
export function StartPlaying({
  label = "Start playing",
  withTick = true,
}: {
  label?: string;
  /** False where the screen already shows one tick box for a set of actions
   *  this button is part of. The gate is the cookie, not the box, so a second
   *  box would be two controls for one answer. */
  withTick?: boolean;
}) {
  const router = useRouter();
  const agreed = useAgreed();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setFailed(null);
    try {
      const res = await fetch("/api/auth/anonymous", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `sign-in failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setFailed(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      {withTick ? <AgreementTick /> : null}
      <button
        type="button"
        onClick={start}
        disabled={busy || !agreed}
        className="form-base btn-primary font-secondary disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Getting you a name..." : label}
      </button>
      {failed && <p className="font-secondary text-p-sm text-orange">{failed}</p>}
    </div>
  );
}
