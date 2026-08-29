"use client";

/**
 * The persistent "paths to winning" panel, rebuilt from the retired Nuxt
 * client's `InfoDisplay.vue` per the written spec
 * (`docs/reference/materials/design-briefs/2026-08-25_alerts-win-info-interaction-spec.md`,
 * BRAIN-T260825-34). The retired component floated fixed in a corner on the
 * old multiplayer game page (a placement `WaysToWinCard.vue` later
 * replaced), and docks in normal document flow on the current demo page;
 * this rebuild is a plain in-flow card, matching the current placement
 * pattern rather than the superseded floating one, since the spec says the
 * two differ materially and does not ask for the floating one back.
 *
 * Always mounted, never dismissed, no timer: the same "one instance at a
 * time" always-visible panel described in the spec. Not wired into
 * `components/board/live-board.tsx` this round, for the same
 * concurrent-editing reason as `components/win/win-overlay.tsx`; a caller
 * passes the live `BoardState` in as `board` plus an `onRevise` callback and
 * mounts this wherever the board page's own layout has room. See the build
 * report for `BRAIN-T260825-12`.
 *
 * Two deliberate departures from the retired component's exact shape:
 *
 * 1. The resolved-threads grid does not hardcode "4" slots or the literal
 *    "N/4" copy. This app's resolution model is five token types
 *    (`RESOLUTION_TOKENS` + `DEFERRED_RESOLUTION_TOKENS` in
 *    `lib/board/rules.ts`), not the retired client's four fixed icons, and
 *    the spec explicitly says the old "N/4" slot-remap logic was "an
 *    implementation detail of the old data shape, not an interaction-design
 *    decision": a rebuild should map however makes sense for its own model,
 *    keeping the same 2x2-grid *idea*. Separately, this repo's own
 *    `CLAUDE.md` lists "how many threads a game must have before it can
 *    end" as still-moving and unratified (currently 4 in code, "carried
 *    forward from the old server rather than ratified"), so baking a fixed
 *    4 into this panel's copy would silently take a side on an open
 *    question. The count shown instead is resolved threads over live
 *    threads on the board today: well-defined regardless of what the
 *    eventual target turns out to be.
 * 2. The "Instructions" button is left out entirely rather than built
 *    inert. The spec could not determine what, if anything, it opened back
 *    when this component was live on the multiplayer game page (the
 *    demo-only, unrelated instructions affordance that exists today is not
 *    wired to this component), so there is nothing to route it to yet. A
 *    caller that wants one back can add it once that behaviour is decided.
 */

import type { BoardState } from "@/lib/board/project";
import { liveThreads } from "@/lib/board/project";
import { RESOLUTION_TOKENS, DEFERRED_RESOLUTION_TOKENS } from "@/lib/board/rules";
import { TokenGlyph } from "@/components/board/token-glyph";

const ALL_RESOLUTION_TOKENS = [...RESOLUTION_TOKENS, ...DEFERRED_RESOLUTION_TOKENS];

export function PathsToWinningCard({
  board,
  onRevise,
}: {
  board: BoardState;
  onRevise: () => void;
}) {
  const threads = liveThreads(board);
  const resolvedTokens = new Set(
    threads
      .filter((thread) => thread.resolution)
      .map((thread) => thread.resolution!.emoji),
  );
  const resolvedCount = threads.filter((thread) => thread.resolution).length;
  const topicRevised = (board.topic?.revisions.length ?? 0) > 0;

  return (
    <section
      aria-label="Paths to winning"
      className="flex w-full max-w-xs flex-col gap-4 rounded-2xl border-2 border-neutral-black bg-offwhite p-4 shadow-sm"
    >
      <h3 className="font-primary text-p-lg tracking-wide">PATHS TO WINNING</h3>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          {ALL_RESOLUTION_TOKENS.map((token) => (
            <div
              key={token}
              className={`flex h-10 items-center justify-center rounded-lg border ${
                resolvedTokens.has(token)
                  ? "border-green bg-mint"
                  : "border-gray opacity-40"
              }`}
            >
              <TokenGlyph token={token} size={22} hovered={resolvedTokens.has(token)} />
            </div>
          ))}
        </div>
        <p className="font-secondary text-p-sm text-gray text-center">
          {resolvedCount}/{threads.length}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div
          aria-hidden="true"
          className={`h-4 w-4 rotate-45 border-2 ${
            topicRevised ? "border-green bg-green" : "border-gray bg-transparent"
          }`}
        />
        <span className="font-secondary text-p-sm">
          {topicRevised ? "Revised" : "Not yet"}
        </span>
      </div>

      <button
        type="button"
        onClick={onRevise}
        className="form-base btn-primary px-4 py-2 text-p-sm font-secondary"
      >
        Revise
      </button>
    </section>
  );
}
