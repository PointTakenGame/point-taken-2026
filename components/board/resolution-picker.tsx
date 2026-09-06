"use client";

import { TokenGlyph, tokenLabel } from "@/components/board/token-glyph";

// Row of tokens for resolving a thread, ported from the retired client's
// TileEmojis.vue. Placeable tokens come from RESOLUTION_TOKENS only.
export function ResolutionPicker({
  tokens,
  disabledTokens = [],
  theirs = null,
  onPick,
}: {
  tokens: readonly string[];
  disabledTokens?: readonly string[];
  /**
   * The token the other side has already placed on this thread, if any.
   * That button is highlighted (the same gold ring the pending badge on the
   * board itself uses) and carries a caption telling the player to match it,
   * because closing a thread is placing the SAME token the other side did,
   * and nothing on the picker used to say so.
   */
  theirs?: string | null;
  onPick: (token: string) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Wider than the buttons look, because each drawing overflows its own
          56px box by six pixels a side. Four would leave the two tokens almost
          touching. */}
      <div className="flex flex-row items-start gap-6">
        {tokens.map((token) => {
          const isDisabled = disabledTokens.includes(token);
          const isTheirs = theirs === token;
          return (
            <div key={token} className="flex w-20 flex-col items-center gap-1">
              <button
                type="button"
                disabled={isDisabled}
                onClick={() => onPick(token)}
                // The glyph is decorative art, so the button has no text of its
                // own and `title` alone is not a reliable accessible name.
                aria-label={tokenLabel(token)}
                title={tokenLabel(token)}
                className={`ease-in-out flex size-14 items-center justify-center overflow-visible rounded-full duration-150 hover:-translate-y-2 hover:rotate-[-10deg] disabled:pointer-events-none disabled:opacity-40 ${
                  isTheirs ? "border-gold bg-sand border-2" : ""
                }`}
              >
                {/* Drawn at the source art's own size, not shrunk to fit the
                    button. The retired client set these SVGs `w-auto h-auto
                    overflow-visible` inside the same 56px box, so a 68-wide
                    drawing spilled six pixels past each edge and the tokens
                    read at arm's length. Ours were rendered at 40 and Steve
                    called them "way too small" (2026-09-02); this is the old
                    client's number, not a new guess. */}
                <TokenGlyph token={token} size={68} />
              </button>
              {/* The word under the drawing, always on, not only on hover: a
                  drawing of a pair of eyes does not say "agree to disagree"
                  to anyone who has not been told, and a control that means
                  nothing until the cursor finds it is one nobody can read
                  cold. */}
              <p className="text-p-sm font-secondary text-gray text-center">
                {tokenLabel(token)}
              </p>
              {isTheirs ? (
                <p className="text-p-sm font-secondary text-center font-semibold">
                  They put this down. Match it to close the thread.
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
