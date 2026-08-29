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

const SIDE_RING: Record<TileSide, string> = {
  plus: "ring-green",
  minus: "ring-orange",
  neutral: "ring-neutral-black",
};

/**
 * The retired client's harvested `plus.svg` / `minus.svg` art, now copied
 * into `public/icons/`. `active` picks the committed-side drawing over the
 * grey not-selected one, matching the retired stance picker's two states.
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
  const src = active
    ? side === "plus"
      ? "/icons/plus.svg"
      : "/icons/minus.svg"
    : side === "plus"
      ? "/icons/plus-notselected.svg"
      : "/icons/minus-notselected.svg";
  return (
    // eslint-disable-next-line @next/next/no-img-element -- non-square art, sized by caller className
    <img src={src} alt="" aria-hidden="true" className={`object-contain ${className ?? ""}`} />
  );
}

export function TileShape({
  side,
  size = 13,
  watermark,
  dimmed = false,
  selected = false,
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
  /** Retired client's selected/active tile highlight: a stronger, side-coloured ring. */
  selected?: boolean;
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

  const sideIcon = side === "plus" ? "/icons/plus.svg" : "/icons/minus.svg";

  return (
    <div
      className={`group shrink-0 ${dimmed ? "opacity-20" : ""} ${className ?? ""}`}
      style={{
        position: "relative",
        width: `${size}rem`,
        height: `${size}rem`,
        ...style,
      }}
    >
      <div
        className={`absolute rotate-45 border bg-offwhite shadow-sm transition-shadow duration-150 group-hover:shadow-md ${SIDE_BORDER[side]} ${selected ? `ring-2 ring-offset-2 ${SIDE_RING[side]}` : ""}`}
        style={{ inset: `${outerInset}rem` }}
        aria-hidden="true"
      />
      <div
        className={`absolute rotate-45 border-[3px] bg-offwhite ${SIDE_BORDER[side]}`}
        style={{ inset: `${innerInset}rem` }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 px-6 text-center">
        {side !== "neutral" && (
          // eslint-disable-next-line @next/next/no-img-element -- decorative watermark, no intrinsic size needed
          <img
            src={sideIcon}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 m-auto size-24 object-contain opacity-8"
          />
        )}
        {watermark && (
          <span
            className={`font-primary pointer-events-none absolute top-3 z-10 text-xs tracking-wide uppercase ${SIDE_TEXT[side]} opacity-40`}
          >
            {watermark}
          </span>
        )}
        <div className="font-tiles text-p-md text-neutral-black relative z-10 flex max-h-full flex-col items-center gap-1 overflow-y-auto">
          {children}
        </div>
        {side !== "neutral" && (
          <div className="pointer-events-none absolute bottom-2 z-10 flex gap-4" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              // eslint-disable-next-line @next/next/no-img-element -- decorative row, no intrinsic size needed
              <img key={i} src={sideIcon} alt="" className="size-5 object-contain" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
