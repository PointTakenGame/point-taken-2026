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
      <p className="text-p-md font-secondary font-bold text-gray">
        {hovered ? tokenLabel(hovered) : "Resolve thread"}
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
