"use client";

import { useState } from "react";
import { TokenGlyph, tokenLabel } from "@/components/board/token-glyph";

/**
 * The row of tokens a player picks from to say what kind of disagreement a
 * thread turned out to be. Ported from the retired client's `TileEmojis.vue`:
 * same hover lift/rotate, same swap from a default header to the hovered
 * token's own phrase.
 *
 * Only two tokens are live here (thumbs-up, eyes) because
 * `RESOLUTION_TOKENS` in `lib/board/rules.ts` only accepts two; the other
 * three drawings exist in `public/tokens/` and in `tokenLabel` but are
 * deferred behind progression that does not exist yet, exactly as the
 * retired client's own `SHOW_FLAVORED_DISAGREE = false` gate left them.
 */
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
    <div className="flex flex-col items-center gap-2">
      <p className="text-p-sm font-secondary text-neutral-black">
        {hovered ? tokenLabel(hovered) : "Resolve thread"}
      </p>
      <div className="flex items-center gap-3">
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
              className="ease-in-out flex flex-col items-center gap-1 rounded-full p-1.5 duration-150 hover:-translate-y-2 hover:rotate-[-10deg] disabled:pointer-events-none disabled:opacity-40"
            >
              <TokenGlyph token={token} size={32} hovered={hovered === token} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
