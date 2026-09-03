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

const BUTTON =
  "form-base btn-primary font-secondary disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The front door, arranged the way Rannie draws it (Figma `1096:244927`,
 * pulled 2026-09-02, spec BRAIN-T260902-21): the room code first, an OR, and
 * then starting a room underneath. That is the opposite of the order this
 * screen used to be in, and the order is the point. Almost everyone arriving
 * here has been sent a code by somebody else; the person opening a room is the
 * one who already knows what they came to do.
 *
 * Her two actions are plain text, with no button chrome at all. Kept, but each
 * carries an underline so it is visibly a thing you can press: a bare word in
 * the middle of an empty page is a lovely drawing and an invisible control.
 */
export function RoomEntry() {
  const { pending, error, enter } = useRoom();
  const [code, setCode] = useState("");

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <form
        className="flex w-full items-center justify-center gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          enter(() => joinRoom(code));
        }}
      >
        <label className="sr-only" htmlFor="join-code">
          Room number
        </label>
        <input
          id="join-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={JOIN_CODE_LENGTH}
          autoComplete="off"
          spellCheck={false}
          placeholder="Enter Room Number"
          className="border-ink text-ink placeholder:text-ink-soft w-72 rounded-[10px] border bg-transparent px-4 py-3 text-center font-secondary tracking-widest uppercase"
        />
        <button
          type="submit"
          className="text-ink font-secondary cursor-pointer underline decoration-gold decoration-2 underline-offset-4 transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40"
          disabled={pending || code.trim().length !== JOIN_CODE_LENGTH}
        >
          {pending ? "Working..." : "Join a game"}
        </button>
      </form>

      <span className="text-ink font-secondary text-[10px] tracking-[0.3em]">OR</span>

      <button
        type="button"
        className="text-ink font-secondary cursor-pointer underline decoration-gold decoration-2 underline-offset-4 transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={pending}
        onClick={() => enter(createRoom)}
      >
        {pending ? "Working..." : "Create a room"}
      </button>

      {error && <p className="font-secondary text-p-sm text-orange">{error}</p>}
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
      {error && <p className="font-secondary text-p-sm text-orange">{error}</p>}
    </div>
  );
}
