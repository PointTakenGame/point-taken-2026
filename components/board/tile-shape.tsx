import type { CSSProperties, ReactNode } from "react";

import { INNER_FRAME_RATIO } from "@/components/board/geometry";

/**
 * The tile: a regular octagon with a double border, built exactly the way the
 * retired client builds it, plus an upright content layer on top.
 *
 * The construction looks like two rotations and is really an intersection. A
 * wrapper clips to an axis-aligned square; inside it a child is rotated 45
 * degrees, and that child clips its own `::before`, which is rotated a further
 * 45 degrees back to upright. Square meets rotated square, and the overlap is
 * a regular octagon: the rotated square contributes the four diagonal edges,
 * the `::before` contributes the four orthogonal ones. Neither element is
 * decorative and neither can be dropped. See `components/board/geometry.ts`
 * for the arithmetic and for what happened the last time one was.
 *
 * This is `Tile.vue` / `TileShape.vue` / `TopicTile.vue` ported whole, down to
 * the 18.5rem-to-17rem ratio between the two frames. It is not a redesign, and
 * a rewrite that "simplifies" it to a `clip-path` loses the box-shadow and the
 * selected-state border, both of which are visible in Rannie's render.
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

/** The outer ring is a tint, not a second full-strength line: measured at a
 * light wash of the side colour in Rannie's render, ~10px outside the main
 * border. `border: inherit` on the `::before` carries the alpha with it. */
const SIDE_BORDER_SOFT: Record<TileSide, string> = {
  plus: "border-green/40",
  minus: "border-orange/40",
  neutral: "border-neutral-black/30",
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
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className={`object-contain ${className ?? ""}`}
    />
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
  /** Declared box in rem, outer ring included. The retired client's board tile is 18.5 here; 13 fits this list layout without dominating it. */
  size?: number;
  /** The stroked corner watermark word, e.g. "reason" or "topic". */
  watermark?: string;
  /** Resolution-thread dimming (retired `resolvingThreadRoot`): fades everything but the thread being resolved. No engine state drives this yet; wired for the day one exists. */
  dimmed?: boolean;
  /** Retired client's selected/active tile highlight. A CSS ring would be clipped away by the octagon wrappers, so the outer frame goes to full strength instead. */
  selected?: boolean;
  className?: string;
  /** Extra inline style, merged after the size. Lets callers (e.g. the collapsed-thread fan) position instances absolutely without a bespoke size prop. */
  style?: CSSProperties;
  children: ReactNode;
}) {
  // Callers (ThreadBlock, CollapsedThread's fan spacing, the spatial grid)
  // size and position this component by its declared box, so that box is the
  // outer ring, the true visual bound. The inner frame sits inside it at the
  // retired client's 17-to-18.5 ratio. Both octagons fill their own box
  // exactly, because the intersection that makes the shape is inscribed in
  // the square rather than overflowing it.
  const innerInset = (size * (1 - INNER_FRAME_RATIO)) / 2;

  const sideIcon = side === "plus" ? "/icons/plus.svg" : "/icons/minus.svg";

  return (
    <div
      className={`group shrink-0 transition-[filter] duration-150 [filter:drop-shadow(0_1px_2px_rgb(0_0_0_/_0.10))] hover:[filter:drop-shadow(0_3px_6px_rgb(0_0_0_/_0.16))] ${dimmed ? "opacity-20" : ""} ${className ?? ""}`}
      style={{
        position: "relative",
        width: `${size}rem`,
        height: `${size}rem`,
        ...style,
      }}
    >
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className={`absolute inset-0 overflow-hidden rotate-45 border bg-offwhite before:absolute before:[inset:-1px] before:rotate-45 before:[border:inherit] before:content-[''] ${
            selected ? SIDE_BORDER[side] : SIDE_BORDER_SOFT[side]
          }`}
        />
      </div>
      <div
        className="absolute overflow-hidden"
        style={{ inset: `${innerInset}rem` }}
        aria-hidden="true"
      >
        <div
          className={`absolute inset-0 overflow-hidden rotate-45 border-[3px] bg-offwhite before:absolute before:[inset:-3px] before:rotate-45 before:[border:inherit] before:content-[''] ${SIDE_BORDER[side]}`}
        />
      </div>
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
          <div
            className="pointer-events-none absolute bottom-2 z-10 flex gap-4"
            aria-hidden="true"
          >
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
