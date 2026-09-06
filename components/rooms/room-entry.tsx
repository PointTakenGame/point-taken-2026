"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createRoom, joinRoom, type RoomResult } from "@/app/join/actions";
import { AgreementTick, useAgreed } from "@/components/legal/agreement";
import { ArrowGlyph } from "@/components/account/account-shell";
import { JOIN_CODE_LENGTH } from "@/lib/games/joinCode";

/**
 * The two ways in: open a room, or type the code somebody sent you.
 *
 * A player with no account yet gets one on the spot. The action says so with
 * `signIn`, the client POSTs /api/auth/anonymous and tries the same call again,
 * so nobody has to press a button twice to do one thing.
 *
 * That silent mint is why both of these take `signedIn`. A visitor with no
 * account is about to be given one by pressing a button that says something
 * else, so they get the tick box first and the button stays dead until it is
 * ticked (Steve, 2026-09-03). Somebody already signed in agreed when their
 * account was made, and is not asked twice.
 */

async function signInAnonymously(): Promise<void> {
  const res = await fetch("/api/auth/anonymous", { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `sign-in failed (${res.status})`);
  }
}

export function useRoom() {
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
export function RoomEntry({ signedIn }: { signedIn: boolean }) {
  const { pending, error, enter } = useRoom();
  const agreed = useAgreed();
  const blocked = !signedIn && !agreed;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      {signedIn ? null : <AgreementTick id="pt-agreement-room" />}

      <JoinByCode signedIn={signedIn} />

      <span className="text-ink font-secondary text-[10px] tracking-[0.3em]">OR</span>

      <button
        type="button"
        className="text-ink font-secondary cursor-pointer underline decoration-gold decoration-2 underline-offset-4 transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={blocked || pending}
        onClick={() => enter(createRoom)}
      >
        {pending ? "Working..." : "Create a room"}
      </button>

      {error && <p className="font-secondary text-p-sm text-orange">{error}</p>}
    </div>
  );
}

/**
 * The room-code half on its own.
 *
 * The profile's Live Play card wants this without "Create a room" underneath
 * it, because that card already carries the one orange button on the page for
 * starting or resuming a game, and two ways to open a room side by side is a
 * choice nobody asked for.
 */
export function JoinByCode({ signedIn }: { signedIn: boolean }) {
  const { pending, error, enter } = useRoom();
  const [code, setCode] = useState("");
  const agreed = useAgreed();
  const blocked = !signedIn && !agreed;

  return (
    <div className="flex w-full flex-col items-center gap-2">
      {/*
        Wraps rather than overflowing: inside the profile's Live play card the
        input and the link do not fit on one line, and a link that breaks
        mid-word looks broken (BRAIN-T260904-40).
      */}
      <form
        className="flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-2"
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
          className="border-ink text-ink placeholder:text-ink-soft w-72 max-w-full rounded-[10px] border bg-transparent px-4 py-3 text-center font-secondary tracking-widest uppercase"
        />
        <button
          type="submit"
          className="text-ink font-secondary cursor-pointer whitespace-nowrap underline decoration-gold decoration-2 underline-offset-4 transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40"
          disabled={blocked || pending || code.trim().length !== JOIN_CODE_LENGTH}
        >
          {pending ? "Working..." : "Join a game"}
        </button>
      </form>

      {error && <p className="font-secondary text-p-sm text-orange">{error}</p>}
    </div>
  );
}

/**
 * "Join game" (Steve, 2026-09-05: shortened from "Join a game" so the room
 * code beside it has room for all its characters) as a solid button on the
 * left with the room-number field on its right, rather than the plain-text link `JoinByCode` uses. Built for the
 * profile's Live play card (`components/account/hero.tsx`), which now offers
 * starting a new game and joining one at once, so the join control needed to
 * read as a peer of the "Start a new game" button beside it rather than a
 * quiet link underneath it.
 */
export function JoinRoomInline({
  signedIn,
  buttonClassName,
}: {
  signedIn: boolean;
  buttonClassName: string;
}) {
  const { pending, error, enter } = useRoom();
  const [code, setCode] = useState("");
  const agreed = useAgreed();
  const blocked = !signedIn && !agreed;

  return (
    <div className="flex w-full flex-col gap-2">
      <form
        className="flex w-full items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          enter(() => joinRoom(code));
        }}
      >
        <button
          type="submit"
          className={`${buttonClassName} shrink-0`}
          disabled={blocked || pending || code.trim().length !== JOIN_CODE_LENGTH}
        >
          {pending ? (
            "Working..."
          ) : (
            <>
              Join game
              <ArrowGlyph onDark />
            </>
          )}
        </button>
        <label className="sr-only" htmlFor="join-code-inline">
          Room number
        </label>
        <input
          id="join-code-inline"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={JOIN_CODE_LENGTH}
          autoComplete="off"
          spellCheck={false}
          placeholder="Room #"
          className="border-ink text-ink placeholder:text-ink-soft w-28 min-w-0 rounded-[10px] border bg-transparent px-3 py-2.5 text-center font-secondary text-sm tracking-widest uppercase"
        />
      </form>
      {error && <p className="font-secondary text-p-sm text-orange">{error}</p>}
    </div>
  );
}

export function JoinRoom({
  code,
  label,
  signedIn,
}: {
  code: string;
  label: string;
  signedIn: boolean;
}) {
  const { pending, error, enter } = useRoom();
  const agreed = useAgreed();
  const blocked = !signedIn && !agreed;

  return (
    <div className="flex flex-col items-start gap-3">
      {signedIn ? null : <AgreementTick id="pt-agreement-join" />}
      <button
        type="button"
        className={BUTTON}
        disabled={blocked || pending}
        onClick={() => enter(() => joinRoom(code))}
      >
        {pending ? "Working..." : label}
      </button>
      {error && <p className="font-secondary text-p-sm text-orange">{error}</p>}
    </div>
  );
}
