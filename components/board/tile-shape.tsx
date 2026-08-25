import type { CSSProperties, ReactNode } from "react";

/**
 * The diamond: a rotated-square double border, built from two absolutely
 * positioned squares (a thin outer frame, a thick inner frame) with upright
 * content laid on top in a third, non-rotated layer. This is the retired
 * client's core tile construction (`Tile.vue` / `TileShape.vue` /
 * `TopicTile.vue`), ported without its `:before` pseudo-element trick: here
 * the content overlay sits above both diamonds instead, which reads
 * identically and needs no scoped CSS.
 *
 * Deliberately self-contained: unlike the retired app's CSS-Grid board, this
 * has no absolute spatial dependency and composes fine inside an ordinary
 * flow layout (a list item, a flex column, wherever the caller puts it).
 */

export type TileSide = "plus" | "minus" | "neutral";

const SIDE_BORDER: Record<TileSide, string> = {
  plus: "border-green",
  minus: "border-orange",
  neutral: "border-neutral-black",
};

const SIDE_TEXT: Record<TileSide, string> = {
  plus: "text-green",
  minus: "text-orange",
  neutral: "text-neutral-black",
};

/**
 * A small plus or minus, drawn with two strokes rather than harvested art.
 * The retired client's `plus.svg` / `minus.svg` live under `~/assets/icons/`
 * in that repo; there is no `public/icons/` folder here yet, and one glyph
 * this simple is not worth opening new asset-pipeline surface area for,
 * especially while a background agent is mid-flight touching unrelated
 * files in this same working tree. See the final report for the full note.
 *
 * `active` distinguishes the retired stance picker's not-selected (grey) and
 * selected/hovered (side colour) icon states; every other caller draws an
 * already-committed side and wants colour, so it defaults to true. The
 * retired minus artwork also mirrored horizontally on that same transition,
 * carried here as a literal transform. With this glyph's plain horizontal
 * stroke that mirror has no visible effect (a horizontal line mirrored
 * horizontally is unchanged), but the behaviour is wired correctly for
 * whenever the glyph gains asymmetric detail.
 */
export function SideGlyph({
  side,
  className,
  active = true,
}: {
  side: "plus" | "minus";
  className?: string;
  active?: boolean;
}) {
  const stroke = active
    ? side === "plus"
      ? "var(--color-green)"
      : "var(--color-orange)"
    : "var(--color-gray)";
  const mirror = active && side === "minus";
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={mirror ? { transform: "scaleX(-1)" } : undefined}
      aria-hidden="true"
    >
      <line
        x1="4"
        y1="12"
        x2="20"
        y2="12"
        stroke={stroke}
        strokeWidth={3}
        strokeLinecap="round"
      />
      {side === "plus" && (
        <line
          x1="12"
          y1="4"
          x2="12"
          y2="20"
          stroke={stroke}
          strokeWidth={3}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

export function TileShape({
  side,
  size = 13,
  watermark,
  dimmed = false,
  className,
  style,
  children,
}: {
  side: TileSide;
  /** Edge length in rem. The retired client used 17 for a standalone tile, 17 for a collapsed stack, and smaller ghost sizes on its spatial grid; 13 fits this list layout without dominating it. */
  size?: number;
  /** The stroked corner watermark word, e.g. "reason" or "topic". */
  watermark?: string;
  /** Resolution-thread dimming (retired `resolvingThreadRoot`): fades everything but the thread being resolved. No engine state drives this yet; wired for the day one exists. */
  dimmed?: boolean;
  className?: string;
  /** Extra inline style, merged after the size. Lets callers (e.g. the collapsed-thread fan) position instances absolutely without a bespoke size prop. */
  style?: CSSProperties;
  children: ReactNode;
}) {
  // A square rotated 45deg has a diagonal of edge*sqrt(2), so a diamond drawn
  // with edge length equal to the container's own size overflows that
  // container on all four sides. Size the diamonds down so the outer
  // (thinner-bordered) one lands exactly on the container's edges instead,
  // and keep the inner one a touch smaller for the double-border reveal.
  // Callers (ThreadBlock, CollapsedThread's fan spacing) size and position
  // this component by its declared box, so that box has to be the true
  // visual bound, not an underestimate of it.
  const outerEdge = size / Math.SQRT2;
  const outerInset = (size - outerEdge) / 2;
  const innerEdge = outerEdge - 0.75;
  const innerInset = (size - innerEdge) / 2;

  return (
    <div
      className={`shrink-0 ${dimmed ? "opacity-20" : ""} ${className ?? ""}`}
      style={{
        position: "relative",
        width: `${size}rem`,
        height: `${size}rem`,
        ...style,
      }}
    >
      <div
        className={`absolute rotate-45 border bg-offwhite ${SIDE_BORDER[side]}`}
        style={{ inset: `${outerInset}rem` }}
        aria-hidden="true"
      />
      <div
        className={`absolute rotate-45 border-[3px] bg-offwhite ${SIDE_BORDER[side]}`}
        style={{ inset: `${innerInset}rem` }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 px-6 text-center">
        {watermark && (
          <span
            className={`font-primary pointer-events-none absolute top-3 text-xs tracking-wide uppercase ${SIDE_TEXT[side]} opacity-40`}
          >
            {watermark}
          </span>
        )}
        <div className="font-tiles text-p-md text-neutral-black flex max-h-full flex-col items-center gap-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
