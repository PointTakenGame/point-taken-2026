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
 * Not wired into `components/board/live-board.tsx` this round: that file is
 * off limits while a parallel agent is working in it. A caller passes the
 * live `BoardState` in as `board`; mounting `<WinOverlay board={board} />`
 * somewhere reachable from the board is left for the orchestrator. See the
 * build report for `BRAIN-T260825-12`.
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
 * The "Share to Linkedin" button was originally scoped OUT of this pass,
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
      🎉 You won — show results
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
          className="absolute top-4 right-4 text-xl leading-none opacity-70 hover:opacity-100"
        >
          ✕
        </button>

        <h2 id="win-overlay-heading" className="font-primary text-3xl">
          You&apos;ve won!
        </h2>

        {variant === "threads" ? (
          <div className="flex w-full flex-col items-center gap-3">
            <p className="font-secondary text-p-md text-center">
              You&apos;ve resolved all threads on the game board:
            </p>
            <div className="grid w-full grid-cols-2 gap-3">
              {Array.from(resolvedByToken.entries()).map(([token, count]) => (
                <div key={token} className="flex items-center gap-2">
                  <TokenGlyph token={token} size={28} />
                  <span className="font-secondary text-p-sm">
                    {count} {tokenLabel(token)} {count === 1 ? "thread" : "threads"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-col items-center gap-3">
            <p className="font-secondary text-p-md text-center">
              You&apos;ve agreed on a revised topic:
            </p>
            <TopicTile text={board.currentTopicText} />
          </div>
        )}

        <p className="font-secondary text-p-sm text-gray text-center italic">
          Feel free to stay if you want to review the game board, expand your arguments,
          or try to agree on a revised topic!
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
            Share to Linkedin
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
