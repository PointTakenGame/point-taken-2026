/**
 * The width and height to declare on a `next/image` showing one of the raw
 * SVGs in `public/`, so that the declared height is the height the browser is
 * actually going to use.
 *
 * Why this exists. Tailwind's preflight sets `height: auto` on every `img`, so
 * the browser honours the declared `width` exactly and then derives the height
 * from the file's own aspect ratio. In development only, Next compares each
 * rendered dimension against the attribute that was declared and warns when
 * exactly one of the two differs (`next/dist/client/image-component.js`, inside
 * its load handler):
 *
 *     const heightModified = img.height.toString() !== img.getAttribute('height')
 *     const widthModified  = img.width.toString()  !== img.getAttribute('width')
 *     if ((heightModified && !widthModified) || (!heightModified && widthModified)) warnOnce(...)
 *
 * Declaring a square box around a non-square file therefore warns every single
 * time: the width matches by construction and the height cannot. Two token
 * glyphs were doing exactly that.
 *
 * The fix is not to pin the height with CSS, which would squash the drawing by
 * up to about nine percent. It is to declare the height the browser will
 * compute anyway, which is what `Wordmark` in `./art.tsx` was already doing by
 * hand for the logo. Nothing about the rendered result changes; only the
 * attribute now agrees with it.
 *
 * `width` stays the caller's number and the height follows from it, so `size`
 * means "this many pixels wide" rather than "fit inside this square". That is
 * what these images already did, so no call site moves.
 *
 * Keyed by path under `public/`, not by token or glyph name, because a token's
 * resting and hovered drawings are different shapes: `thumbs-up.svg` is 68 by
 * 74 while `thumbs-up-hovered.svg` is 68 by 68.
 *
 * Only the non-square files need an entry; anything absent is treated as
 * square, which is what it already rendered as. Measured off each file's root
 * `<svg>` open tag (its width/height attributes when it has them, its viewBox
 * otherwise). Square, and so deliberately absent: every `*-hovered.svg` token
 * (68x68), `tokens/eyes.svg`, `tokens/mag-glass.svg`, and the `book`,
 * `glasses`, `heart`, and `monacle` glyphs.
 */

const INTRINSIC: Record<string, readonly [width: number, height: number]> = {
  "/tokens/thumbs-up.svg": [68, 74],
  "/tokens/scale.svg": [73, 71],
  "/tokens/wine.svg": [52, 68],
  // No width/height attributes; carries its own `style="width:24px;height:auto"`,
  // whose implied ratio is the same 52:50 as the viewBox, so this holds either way.
  "/glyphs/party.svg": [52, 50],
  "/brand/logo.svg": [300, 227],
};

/**
 * The `width` and `height` to declare for `src` at `width` pixels wide.
 *
 * The height is derived from the width the browser was given, already rounded
 * to an integer, and not from the original scale factor: the browser rounds the
 * width first and then lays out from that, so rounding both axes independently
 * can land a pixel off and warn anyway.
 */
export function svgBox(src: string, width: number): { width: number; height: number } {
  const intrinsic = INTRINSIC[src];
  if (!intrinsic) return { width, height: width };
  return { width, height: Math.round((width * intrinsic[1]) / intrinsic[0]) };
}
