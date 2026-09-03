"use client";

import { useState } from "react";
import { TokenGlyph, tokenLabel } from "@/components/board/token-glyph";

// Row of tokens for resolving a thread, ported from the retired client's
// TileEmojis.vue. Placeable tokens come from RESOLUTION_TOKENS only.
export function ResolutionPicker({
  tokens,
  disabledTokens = [],
  onPick,
}: {
  tokens: readonly string[];
  disabledTokens?: readonly string[];
  onPick: (token: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* One line doing two jobs, which is the retired client's own trick:
          at rest it tells you the tokens are readable, and under the cursor
          it is the name of the token you are pointing at. It used to rest on
          "Resolve thread", which put a second heading directly under the
          card's own "Where do you two disagree?" and said nothing the tokens
          did not already say. Two drawings mean nothing cold, so the resting
          line now points at the way to read them. */}
      <p className="text-p-sm font-secondary text-gray">
        {hovered ? tokenLabel(hovered) : "Point at one to read it"}
      </p>
      {/* Wider than the buttons look, because each drawing overflows its own
          56px box by six pixels a side. Four would leave the two tokens almost
          touching. */}
      <div className="flex flex-row items-center gap-6">
        {tokens.map((token) => {
          const isDisabled = disabledTokens.includes(token);
          return (
            <button
              key={token}
              type="button"
              disabled={isDisabled}
              onClick={() => onPick(token)}
              onMouseEnter={() => setHovered(token)}
              onMouseLeave={() =>
                setHovered((current) => (current === token ? null : current))
              }
              // Focus reads the token out on the line above, same as hover.
              // Without it the one control on the board that means nothing
              // until it is named is the one control a keyboard cannot name.
              onFocus={() => setHovered(token)}
              onBlur={() => setHovered((current) => (current === token ? null : current))}
              // The glyph is decorative art, so the button has no text of its
              // own and `title` alone is not a reliable accessible name.
              aria-label={tokenLabel(token)}
              title={tokenLabel(token)}
              className="ease-in-out flex size-14 items-center justify-center overflow-visible duration-150 hover:-translate-y-2 hover:rotate-[-10deg] disabled:pointer-events-none disabled:opacity-40"
            >
              {/* Drawn at the source art's own size, not shrunk to fit the
                  button. The retired client set these SVGs `w-auto h-auto
                  overflow-visible` inside the same 56px box, so a 68-wide
                  drawing spilled six pixels past each edge and the tokens
                  read at arm's length. Ours were rendered at 40 and Steve
                  called them "way too small" (2026-09-02); this is the old
                  client's number, not a new guess. */}
              <TokenGlyph token={token} size={68} hovered={hovered === token} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
