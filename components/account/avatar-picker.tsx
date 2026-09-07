"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setAvatar } from "@/app/settings/actions";
import { PLAYER_EMOJIS } from "@/lib/avatar";
import { Avatar } from "@/components/avatar";
import { PencilGlyph } from "@/components/ui/pencil-glyph";

/**
 * The hero avatar, made clickable.
 *
 * `ProfileHero` (`components/account/hero.tsx`) only ever renders for the
 * signed-in player looking at their own profile (`/` and `/account` both
 * check `currentPlayerId()` before reaching it), so this never has to ask
 * whether the viewer owns the row it is about to change.
 *
 * A plain absolutely-positioned popover under the button, not
 * `components/ui/tile-popover.tsx`'s anchored card or `AnchoredCard`: both of
 * those solve following a target around a panned, zoomed board, and this
 * button never moves, so a re-measuring positioner would be solving a problem
 * this screen does not have. Escape and an outside click both close it, the
 * same as the heavier popovers, because a picker that only closes on its own
 * buttons is a trap.
 *
 * Nobody is picked by default: `currentEmoji` is whatever
 * `players.avatar_emoji` already holds, which is null until this picker is
 * used once, and null keeps the derived initials mark rather than choosing a
 * first entry for the player.
 */
export function AvatarPicker({
  playerId,
  name,
  currentEmoji,
}: {
  playerId: string;
  name: string | null;
  currentEmoji: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  // Outside click and Escape both close the picker. Neither calls setState
  // from the body of this effect: both live inside event-handler callbacks
  // that only run later, in response to a real click or keypress, which is
  // what the repo's react-hooks/set-state-in-effect rule actually forbids
  // against. Mirrors the outside-click and Escape effects already in
  // components/ui/tile-popover.tsx and components/ui/anchored-card.tsx.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function choose(next: string | null) {
    setError(null);
    start(async () => {
      const outcome = await setAvatar(next);
      if (!outcome.ok) {
        setError(outcome.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div ref={rootRef} className="relative flex flex-col items-center gap-1">
      {/* Steve, 2026-09-06: the words "Click to change" become the pencil the
          rest of the app already uses for edit. The badge is a span, not a
          second button: the whole avatar is the click target, so a nested
          button would be invalid markup and a second tab stop for the one
          action. It sits on the lower-right corner in the same vocabulary as
          the on-tile pencil (round, bordered, its own ground, lifting on
          hover), in the account flow's ink/card tokens rather than the
          board's neutral-black/offwhite. `group-hover` on the parent button
          means hovering anywhere on the avatar lifts the pencil too, so the
          two read as one control. */}
      <button
        type="button"
        aria-label="Choose your avatar"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        className="group relative rounded-2xl transition-transform hover:-translate-y-0.5 active:translate-y-0"
      >
        <Avatar playerId={playerId} name={name} size="hero" emoji={currentEmoji} />
        <span className="border-ink/30 bg-card text-ink shadow-sticker absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full border-[1.5px] p-1.5 transition-transform group-hover:-translate-y-0.5">
          <PencilGlyph className="size-full" />
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Choose your avatar"
          className="border-ink bg-card shadow-sticker absolute top-full z-20 mt-3 w-64 rounded-2xl border-[1.5px] p-4"
        >
          <div className="grid grid-cols-3 gap-2">
            {PLAYER_EMOJIS.map((option) => {
              const selected = option === currentEmoji;
              return (
                <button
                  key={option}
                  type="button"
                  aria-label={`Use ${option} as your avatar`}
                  aria-pressed={selected}
                  disabled={pending}
                  onClick={() => choose(option)}
                  className={`flex h-14 w-14 items-center justify-center rounded-xl border-[1.5px] text-2xl transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected
                      ? "border-ink ring-gold ring-2 ring-offset-2"
                      : "border-ink/30"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={pending || currentEmoji === null}
            onClick={() => choose(null)}
            className="font-label text-ink-soft hover:text-ink border-ink/30 mt-3 w-full rounded-lg border-[1.5px] py-1.5 text-[11px] font-bold tracking-widest uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            Use my initials
          </button>
          {error ? (
            <p className="font-secondary text-stat-warm text-p-sm pt-2">{error}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
