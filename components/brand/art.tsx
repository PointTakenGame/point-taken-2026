import Image from "next/image";
import { svgBox } from "./svg-box";

/**
 * The drawn brand art, and the only two ways this codebase puts it on a screen.
 *
 * All of it is copied verbatim out of the retired Nuxt client, which is the one
 * place it has ever existed: `app/assets/Logo.svg` for the wordmark and
 * `app/assets/emojis/*.svg` for the glyphs. Copyright (c) 2025-2026 Experception
 * LLC, same as the rest of the game. `public/README.md` records what came from
 * where, including the pieces nothing here renders yet.
 *
 * The wordmark is loaded as an image and never inlined. Its colours live in a
 * `<style>` block using generic class names, `.st0` through `.st14`, which would
 * collide with the page the moment the markup shared a document with it. As a
 * separate image document those names are scoped to the file.
 *
 * It reads on both grounds. The letter faces are cream, `#fdf8f3`, which sounds
 * like a problem on a white page until you look: every letter carries a dark
 * grey contour behind it, so the shape survives on `#ffffff` and on `#0a0a0a`
 * alike. Checked on both before it went in.
 */

const LOGO_SRC = "/brand/logo.svg";

/** The full lockup: bubble, wordmark, plus. viewBox is 300 by 227. */
export function Wordmark({
  width = 240,
  className,
}: {
  width?: number;
  className?: string;
}) {
  const box = svgBox(LOGO_SRC, width);
  return (
    <Image
      src={LOGO_SRC}
      alt="Point Taken"
      width={box.width}
      height={box.height}
      className={className}
      priority
      unoptimized
    />
  );
}

/**
 * One drawn glyph. `size` is the pixel width, and the height follows from the
 * file's own proportions (`./svg-box.ts`) rather than being forced square:
 * `party.svg` is 52 by 50 and squashing it both warns in development and
 * distorts the drawing.
 *
 * Decorative by default: every call site here already says the same thing in
 * words, so the alt text is empty and the glyph is not announced twice.
 */
export function Glyph({
  name,
  size = 24,
  className,
}: {
  name: "book" | "glasses" | "heart" | "monacle" | "party";
  size?: number;
  className?: string;
}) {
  const src = `/glyphs/${name}.svg`;
  const box = svgBox(src, size);
  return (
    <Image
      src={src}
      alt=""
      width={box.width}
      height={box.height}
      className={className}
      unoptimized
    />
  );
}
