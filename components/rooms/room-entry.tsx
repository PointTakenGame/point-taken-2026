"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createRoom, joinRoom, type RoomResult } from "@/app/join/actions";
import { JOIN_CODE_LENGTH } from "@/lib/games/joinCode";

/**
 * The two ways in: open a room, or type the code somebody sent you.
 *
 * A player with no account yet gets one on the spot. The action says so with
 * `signIn`, the client POSTs /api/auth/anonymous and tries the same call again,
 * so nobody has to press a button twice to do one thing.
 */

async function signInAnonymously(): Promise<void> {
  const res = await fetch("/api/auth/anonymous", { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `sign-in failed (${res.status})`);
  }
}

function useRoom() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function enter(call: () => Promise<RoomResult>) {
    setError(null);
    start(async () => {
      try {
        let result = await call();
        if (!result.ok && result.signIn) {
          await signInAnonymously();
          result = await call();
        }
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.push(`/game/${result.gameId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return { pending, error, enter };
}

const BUTTON = "rounded-md bg-foreground px-4 py-2 text-background disabled:opacity-50";

export function RoomEntry() {
  const { pending, error, enter } = useRoom();
  const [code, setCode] = useState("");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          className={BUTTON}
          disabled={pending}
          onClick={() => enter(createRoom)}
        >
          {pending ? "Working..." : "Start a room"}
        </button>
        <p className="text-sm opacity-70">
          You get a code to send whoever you want to argue with.
        </p>
      </div>

      <form
        className="flex flex-col items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          enter(() => joinRoom(code));
        }}
      >
        <label className="text-sm opacity-70" htmlFor="join-code">
          Or join a room with its code
        </label>
        <div className="flex items-center gap-2">
          <input
            id="join-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={JOIN_CODE_LENGTH}
            autoComplete="off"
            spellCheck={false}
            placeholder="PTKN2"
            className="w-32 rounded-md border border-current/25 bg-transparent px-3 py-2 font-mono uppercase tracking-widest"
          />
          <button
            type="submit"
            className={BUTTON}
            disabled={pending || code.trim().length !== JOIN_CODE_LENGTH}
          >
            Join
          </button>
        </div>
      </form>

      {error && <p className="text-sm text-orange">{error}</p>}
    </div>
  );
}

export function JoinRoom({ code, label }: { code: string; label: string }) {
  const { pending, error, enter } = useRoom();

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        className={BUTTON}
        disabled={pending}
        onClick={() => enter(() => joinRoom(code))}
      >
        {pending ? "Working..." : label}
      </button>
      {error && <p className="text-sm text-orange">{error}</p>}
    </div>
  );
}
