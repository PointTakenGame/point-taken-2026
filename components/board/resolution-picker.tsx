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
      <p className="text-p-md font-secondary font-bold text-gray">
        {hovered ? tokenLabel(hovered) : "Point at one to read it"}
      </p>
      <div className="flex flex-row items-center gap-4">
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
              title={tokenLabel(token)}
              className="ease-in-out flex size-14 items-center justify-center overflow-visible duration-150 hover:-translate-y-2 hover:rotate-[-10deg] disabled:pointer-events-none disabled:opacity-40"
            >
              <TokenGlyph token={token} size={40} hovered={hovered === token} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
