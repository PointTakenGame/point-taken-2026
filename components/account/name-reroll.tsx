"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { rerollName } from "@/app/settings/actions";
import { useFocusTrap } from "@/components/win/use-focus-trap";

/**
 * The cycle button beside the display name on the profile, and the one warning
 * it shows before the first reroll.
 *
 * Steve, 2026-09-07: the reroll used to live in Settings, under a heading
 * called "Your name". That is the wrong place for it twice over. A player who
 * wants a different name is looking at the name, which is on the profile, not
 * hunting through a settings page for a section about a thing they can already
 * see. And the name is not a setting: it is the identity the rest of the page
 * is about.
 *
 * **One warning, then never again.** The first press opens a modal that says
 * plainly that the current name is not coming back, because it is not: the
 * generator draws a fresh three-word name and nothing anywhere stores the old
 * one. Once the player has been told that once, they have been told, so every
 * later press rerolls immediately, as many times as they want. Steve's words:
 * "once they do it once, then let them hit it as many times as they want to
 * generate new fresh names."
 *
 * The modal is two lines because Steve wrote those two lines, 2026-09-07,
 * cutting a longer version that explained the generator and promised the
 * player would not be asked again. Neither fact is worth a paragraph in front
 * of somebody who has already decided.
 *
 * The "told once" flag is per player in this browser's localStorage. It is not
 * a database column because nothing depends on it: a player who clears their
 * storage sees one warning they have seen before, which is the harmless
 * direction for this to fail in.
 */

function warnedKey(playerId: string) {
  return `pt.name-reroll-warned.${playerId}`;
}

function alreadyWarned(playerId: string): boolean {
  try {
    return window.localStorage.getItem(warnedKey(playerId)) === "1";
  } catch {
    // Private windows and blocked site data throw on read.
    return false;
  }
}

function markWarned(playerId: string) {
  try {
    window.localStorage.setItem(warnedKey(playerId), "1");
  } catch {
    // Nothing depends on it; see above.
  }
}

/** The recycle glyph: two curved arrows chasing a loop. Moved here verbatim
 *  from the Settings form it used to sit in. */
function RerollIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={15}
      height={15}
      aria-hidden
      className="shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13.5 8a5.5 5.5 0 0 0-9.9-3.3M2.5 8a5.5 5.5 0 0 0 9.9 3.3" />
      <path d="M3.2 2.6v2.6h2.6M12.8 13.4v-2.6h-2.6" />
    </svg>
  );
}

export function NameReroll({ playerId }: { playerId: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const roll = () => {
    setError(null);
    start(async () => {
      const outcome = await rerollName();
      if (!outcome.ok) {
        setError(outcome.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        aria-label="Draw a new name"
        title="Draw a new name"
        disabled={pending}
        className="border-ink bg-card text-ink shadow-sticker-sm hover:bg-orange flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
        onClick={() => {
          if (alreadyWarned(playerId)) {
            roll();
            return;
          }
          setAsking(true);
        }}
      >
        <RerollIcon />
      </button>

      {error ? (
        <p className="font-secondary text-p-sm text-stat-warm w-full text-center">
          {error}
        </p>
      ) : null}

      {asking ? (
        <WarningModal
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            markWarned(playerId);
            setAsking(false);
            roll();
          }}
        />
      ) : null}
    </>
  );
}

function WarningModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useFocusTrap(true, panel, onCancel);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-neutral-black/40 p-6"
      role="presentation"
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-reroll-heading"
        className="bg-offwhite border-ink w-full max-w-[26rem] rounded-2xl border-[1.5px] p-6 text-left shadow-2xl"
      >
        <h2
          id="name-reroll-heading"
          className="font-primary text-ink text-2xl leading-tight tracking-wide uppercase"
        >
          Are you sure you want to change your name?
        </h2>
        <p className="font-secondary text-p-sm text-ink-soft mt-3 leading-relaxed">
          You can’t get this one back.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="font-label text-ink-soft hover:text-ink rounded-full px-4 py-1.5 text-xs font-bold tracking-widest uppercase"
          >
            Keep this name
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className="font-label border-ink bg-ink text-card rounded-full border-[1.5px] px-5 py-1.5 text-xs font-bold tracking-widest uppercase"
          >
            Draw a new one
          </button>
        </div>
      </div>
    </div>
  );
}
