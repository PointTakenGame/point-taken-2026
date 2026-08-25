import Image from "next/image";

/**
 * The drawn art for a resolution token, and the words for what it means.
 *
 * Both come from the retired Nuxt client, which is the only place either has
 * ever existed: `app/assets/emojis/*.svg` for the drawings and
 * `app/components/TileEmojis.vue` for the phrases players read while choosing.
 * The SVGs are copied verbatim into `public/tokens/`. Copyright (c) 2025-2026
 * Experception LLC, same as the rest of the game.
 *
 * The token itself is still the unicode character, because that is what the
 * event log stores and what `lib/board/rules.ts` accepts. This file is a lookup
 * from that character to how it should look and read, so nothing here can drift
 * the vocabulary: a token with no art falls back to rendering the character.
 *
 * The three deferred tokens are listed even though nothing can place one yet.
 * Their art was drawn years before this codebase existed and would otherwise be
 * lost when the old repository goes cold.
 */

type TokenFace = { art: string | null; hoveredArt: string | null; label: string };

// hoveredArt is the retired client's swap-on-hover drawing (`TileEmojis.vue`'s
// `hovered` field). `eyes` never got a hovered variant drawn ("no hovered
// variant drawn yet; reuse the base art," per that file's own comment), so it
// falls back to the base art here too.
const FACES: Record<string, TokenFace> = {
  "👍": {
    art: "/tokens/thumbs-up.svg",
    hoveredArt: "/tokens/thumbs-up-hovered.svg",
    label: "Agree to agree",
  },
  "👀": {
    art: "/tokens/eyes.svg",
    hoveredArt: "/tokens/eyes.svg",
    label: "Agree to disagree",
  },
  // Deferred behind progression, see DEFERRED_RESOLUTION_TOKENS.
  "🔍": {
    art: "/tokens/mag-glass.svg",
    hoveredArt: "/tokens/mag-glass-hovered.svg",
    label: "Disagree on a fact",
  },
  "⚖️": {
    art: "/tokens/scale.svg",
    hoveredArt: "/tokens/scale-hovered.svg",
    label: "Disagree on priorities",
  },
  "🍷": {
    art: "/tokens/wine.svg",
    hoveredArt: "/tokens/wine-hovered.svg",
    label: "Disagree on personal taste",
  },
};

/** What a token means, in the words a player sees. Falls back to the character. */
export function tokenLabel(token: string): string {
  return FACES[token]?.label ?? token;
}

/**
 * One token, drawn. `size` is in pixels because these are fixed-size glyphs
 * sitting inside buttons, not images that reflow with the text around them.
 */
export function TokenGlyph({
  token,
  size = 24,
  className,
  hovered = false,
}: {
  token: string;
  size?: number;
  className?: string;
  /** Show the hover-swap drawing instead of the resting one. */
  hovered?: boolean;
}) {
  const face = FACES[token];
  const src = hovered ? (face?.hoveredArt ?? face?.art) : face?.art;
  if (!src) {
    return (
      <span className={className} aria-hidden="true">
        {token}
      </span>
    );
  }
  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      className={className}
      unoptimized
    />
  );
}
