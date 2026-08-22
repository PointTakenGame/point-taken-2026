"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Signs in anonymously, then re-renders the page as the new player. */
export function StartPlaying() {
  const router = useRouter();
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
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="rounded-md bg-foreground px-4 py-2 text-background disabled:opacity-50"
      >
        {busy ? "Getting you a name..." : "Start playing"}
      </button>
      {failed && <p className="text-sm text-red-600">{failed}</p>}
    </div>
  );
}
