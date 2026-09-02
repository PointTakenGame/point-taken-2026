"use client";

/**
 * The full-viewport win celebration, rebuilt from the retired Nuxt client's
 * `WinAlert.vue` per the written spec
 * (`docs/reference/materials/design-briefs/2026-08-25_alerts-win-info-interaction-spec.md`,
 * BRAIN-T260825-34). Not a code port: this app's win data is a single
 * `winCondition` enum plus five resolution token types
 * (`lib/board/rules.ts`'s `RESOLUTION_TOKENS` + `DEFERRED_RESOLUTION_TOKENS`),
 * not the retired client's fixed four-icon grid, so the threads-resolved
 * summary below is grouped generically by whichever token types are
 * actually present rather than hardcoded to four slots.
 *
 * Mounted on the ended branch of `app/game/[gameId]/page.tsx`, NOT on the
 * live board: a game whose status is "ended" never renders
 * `components/board/live-board.tsx` at all, so mounting it there would mean
 * a win nobody ever sees. `board` is plain data, so a server component can
 * pass it straight in. See the build report for `BRAIN-T260825-12`.
 *
 * Two things called out here because they are disclosed design choices, not
 * facts recovered from the retired source (the spec says both were
 * indeterminate from `WinAlert.vue`):
 *   - Keyboard focus: trapped while open, restored to whatever had it on
 *     close, plus Escape-to-close. See `./use-focus-trap.ts`.
 *   - Entrance/exit animation: the retired component had none at all ("a
 *     deliberate contrast with the alert stack's fade"), and the spec says a
 *     rebuild is free to add one or keep the instant appear/disappear "as a
 *     design choice rather than a technical constraint." This rebuild keeps
 *     it instant, matching the retired behaviour, rather than inventing one.
 *
 * The "Share to LinkedIn" button was originally scoped OUT of this pass,
 * then added back in by an explicit scope change from Steve delivered
 * mid-task: build it using LinkedIn's public, auth-free share-offsite URL
 * (no API key, no OAuth, nothing posted on anyone's behalf; the player's own
 * browser opens LinkedIn's own composer in a new tab and the player decides
 * whether to post). The link intentionally carries only the game's public
 * marketing URL, nothing about the specific game, players, or topic argued.
 */

import { useRef, useState } from "react";
import Link from "next/link";
import type { BoardState } from "@/lib/board/project";
import { liveThreads } from "@/lib/board/project";
import { Glyph } from "@/components/brand/art";
import { TokenGlyph, tokenLabel } from "@/components/board/token-glyph";
import { TopicTile } from "@/components/board/topic-tile";
import { getFeedbackShareMoreUrl } from "@/lib/feedback/config";
import { useFocusTrap } from "./use-focus-trap";

/**
 * The public game URL used only for the outbound LinkedIn share link.
 * Deliberately NOT derived from `window.location`: nothing about this
 * specific game, either player, the topic they argued about, or the game id
 * may appear in a link the player is about to post publicly. This is the
 * entire URL; nothing is appended to it. No `NEXT_PUBLIC_` site-URL env var
 * exists anywhere in this codebase to read instead (checked before adding
 * this), so this is a small hardcoded constant rather than a config read.
 */
const PUBLIC_GAME_URL = "https://play.pointtaken.social";

type WinVariant = "threads" | "topic";

function deriveVariant(board: BoardState): WinVariant | null {
  // A revised-topic win takes priority over a resolved-threads win if both
  // were somehow true at once, per the spec. This app's `winCondition` is a
  // single enum rather than two independent booleans, so the two can never
  // literally both be true here; topic_agreed is still checked first so the
  // priority holds if that ever changes.
  if (board.winCondition === "topic_agreed") return "topic";
  if (board.winCondition === "threads_resolved") return "threads";
  return null;
}

function ReopenPill({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="form-base btn-primary fixed right-6 bottom-6 z-40 rounded-full px-5 py-3 text-p-sm font-secondary"
    >
      🎉 You both won. Show results
    </button>
  );
}

export function WinOverlay({ board }: { board: BoardState }) {
  const variant = deriveVariant(board);
  // Identifies a particular win, not just a win condition: a fresh
  // topic-agreed win with different revised text is still a *new* win and
  // must force the pop-up back open even though `winCondition` itself did
  // not change value.
  const winKey = variant ? `${board.winCondition}:${board.currentTopicText ?? ""}` : null;

  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const open = winKey !== null && dismissedFor !== winKey;
  useFocusTrap(open, cardRef, () => setDismissedFor(winKey));

  if (!variant || !winKey) return null;

  if (!open) {
    return <ReopenPill onClick={() => setDismissedFor(null)} />;
  }

  function close() {
    setDismissedFor(winKey);
  }

  const shareMoreUrl = getFeedbackShareMoreUrl();
  const linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(PUBLIC_GAME_URL)}`;

  const resolvedByToken = new Map<string, number>();
  if (variant === "threads") {
    for (const thread of liveThreads(board)) {
      if (thread.resolution) {
        const key = thread.resolution.emoji;
        resolvedByToken.set(key, (resolvedByToken.get(key) ?? 0) + 1);
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-neutral-black/40 p-4 backdrop-blur-sm"
      onClick={close}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="win-overlay-heading"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="relative flex w-full max-w-md flex-col items-center gap-4 rounded-2xl bg-offwhite p-8 shadow-lg"
      >
        <div className="absolute -top-5 left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border-2 border-neutral-black bg-offwhite shadow-sm">
          <Glyph name="party" size={20} />
        </div>

        <button
          type="button"
          aria-label="Close and review the board"
          onClick={close}
          className="absolute top-4 right-4 text-xl leading-none text-gray hover:opacity-100"
        >
          ✕
        </button>

        {/* "You both won", not "You've won". Both win conditions in this
            game are cooperative and the recap page under this overlay already
            says so in as many words. A headline that congratulates one player
            is the one sentence on the screen that contradicts the game. */}
        <h2 id="win-overlay-heading" className="font-primary text-3xl">
          You both won.
        </h2>

        {variant === "threads" ? (
          <div className="flex w-full flex-col items-center gap-3">
            <p className="font-secondary text-p-md text-center">
              Every thread got a token:
            </p>
            {/* Sized to content rather than laid out in fixed columns: the number of
                distinct token types here is 1 to 5, and a rigid two-column grid wrapped
                the single-type case across two lines mid-phrase. */}
            <div className="flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-3">
              {Array.from(resolvedByToken.entries()).map(([token, count]) => (
                <div key={token} className="flex items-center gap-2">
                  <TokenGlyph token={token} size={28} />
                  {/* Name first, tally second. Counting first produced
                      "1 Agree to disagree thread", which puts a capitalised
                      three-word label inside a noun phrase and has to be
                      re-read to parse. What the players agreed is the thing
                      worth reading here; how many times is the footnote. */}
                  <span className="font-secondary text-p-sm">
                    {tokenLabel(token)}{" "}
                    <span className="text-gray">
                      {count} {count === 1 ? "thread" : "threads"}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-col items-center gap-3">
            <p className="font-secondary text-p-md text-center">
              You agreed on a wording you would both sign:
            </p>
            <TopicTile text={board.currentTopicText} />
          </div>
        )}

        <p className="font-secondary text-p-sm text-gray text-center italic">
          Stay as long as you like. The board is still here, and nothing stops you reading
          it back, adding to it, or trying for the other ending too.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {shareMoreUrl ? (
            <a
              href={shareMoreUrl}
              target="_blank"
              rel="noreferrer"
              className="form-base btn-primary px-4 py-2 text-p-sm font-secondary"
            >
              Leave feedback
            </a>
          ) : null}
          <a
            href={linkedInShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="form-base btn-primary px-4 py-2 text-p-sm font-secondary"
          >
            Share to LinkedIn
          </a>
        </div>
      </div>

      <Link
        href="/"
        onClick={(event) => event.stopPropagation()}
        className="form-base btn-primary px-4 py-2 text-p-sm font-secondary"
      >
        Play Again
      </Link>
    </div>
  );
}
