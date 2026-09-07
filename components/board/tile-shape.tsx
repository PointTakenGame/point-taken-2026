import type { CSSProperties, ReactNode } from "react";

import {
  INNER_FRAME_RATIO,
  OCTAGON_CLIP,
  TILE_CONTENT_INSET_PX,
  type TileWeight,
} from "@/components/board/geometry";

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
export type { TileWeight };

/**
 * A reason tile is three distinct tones per side, not one hue at two
 * opacities (re-measured against Figma 60wr75TY7I95UnL6jkLz2J, section
 * 1096:240649, 2026-09-05; the CSS custom properties are defined and
 * explained in `app/globals.css`, "Tile chrome"):
 *
 *  - SIDE_WASH: the pale outer ring, and its border when the tile is not
 *    selected.
 *  - SIDE_BORDER: the inner octagon's own bold border, always; also the
 *    outer ring's border once the tile is selected, so selecting a tile
 *    reads as the ring stepping up to the tile's own colour rather than as
 *    an unrelated highlight.
 *  - STROKE_COLOR: the corner watermark's outline and the small glyph row,
 *    a third, more saturated tone again, distinct from the tile's own
 *    border. Confirmed by direct pixel sampling of her render: the
 *    watermark stroke is visibly a different, more teal green than the
 *    tile's mint border, not the same hue at higher opacity.
 *
 * The topic tile keeps a single charcoal border (no three-tone breakdown was
 * measured for it) and its own wash stays the board's neutral-black at low
 * opacity, since no distinct wash tone was measured for it either.
 */
const SIDE_WASH: Record<TileSide, string> = {
  plus: "bg-[color:var(--color-tile-plus-wash)]",
  minus: "bg-[color:var(--color-tile-minus-wash)]",
  neutral: "bg-neutral-black/5",
};

const SIDE_WASH_BORDER: Record<TileSide, string> = {
  plus: "border-[color:var(--color-tile-plus-wash)]",
  minus: "border-[color:var(--color-tile-minus-wash)]",
  neutral: "border-neutral-black/30",
};

const SIDE_BORDER: Record<TileSide, string> = {
  plus: "border-[color:var(--color-tile-plus-border)]",
  minus: "border-[color:var(--color-tile-minus-border)]",
  neutral: "border-[color:var(--color-tile-topic-border)]",
};

/**
 * The root tile's border colour, and why it is not `SIDE_BORDER`.
 *
 * Steve, 2026-09-07: "the thread starter tile line thickness request was not
 * acted on". It had been: a root has worn a 9px border against a reply's 3px
 * since 2026-09-05, and both draw all the way around. What it had not done is
 * *read* as a thicker line, because `--color-tile-plus-border` is #6ed59e on an
 * off-white tile. At 3px that pale green is a line; at 9px it is a halo. The
 * eye sees a glow around the tile and no more outline than before, which is
 * exactly the report.
 *
 * So a root also steps up to the accent tone, the most saturated of the three
 * per side (#3abaaa and #f48625), which is the one already used for the corner
 * watermark's stroke. Weight plus contrast, rather than weight alone.
 *
 * The topic tile is unchanged: its border is already the dark neutral, so it
 * never had this problem.
 */
const SIDE_BORDER_ROOT: Record<TileSide, string> = {
  plus: "border-[color:var(--color-tile-plus-accent)]",
  minus: "border-[color:var(--color-tile-minus-accent)]",
  neutral: "border-[color:var(--color-tile-topic-border)]",
};

/** The `-webkit-text-stroke` colour behind the corner watermark and the
 *  small glyph row: the third, most saturated tone per side. */
const STROKE_COLOR: Record<TileSide, string> = {
  plus: "var(--color-tile-plus-accent)",
  minus: "var(--color-tile-minus-accent)",
  neutral: "var(--color-tile-topic-border)",
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

/**
 * A player, drawn as the game's own shape.
 *
 * Rannie hangs an octagon badge in the board's top corner rather than a bare
 * mark (`1096:252192`): the side colour as a ring, offwhite inside it, and the
 * plus or minus in the middle. It is a tile in miniature, which is the point.
 * A player on this board is the colour of the reasons they place, and saying
 * that with the same silhouette is how the corner reads as part of the board
 * instead of as an icon borrowed from a toolbar.
 *
 * Deliberately not `TileShape` at a small size: that component draws a
 * watermark word, a background mark, and a row of three side glyphs, all
 * sized for a 296 px octagon, and none of them survive being shrunk to 48.
 */
export function SideAvatar({
  side,
  className,
}: {
  side: "plus" | "minus";
  className?: string;
}) {
  const ring = side === "plus" ? "bg-green" : "bg-orange";
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${className ?? ""}`}
      aria-hidden="true"
    >
      <span className={`absolute inset-0 ${ring}`} style={{ clipPath: OCTAGON_CLIP }} />
      <span
        className="bg-offwhite absolute inset-[3px]"
        style={{ clipPath: OCTAGON_CLIP }}
      />
      <SideGlyph side={side} className="relative h-[45%] w-[45%]" />
    </span>
  );
}

export function TileShape({
  side,
  size = 13,
  weight = "normal",
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
  /** "root" is Steve's 2026-09-05 ruling: the topic tile and the reason that
   *  opens each thread (`tile.parentId === null`) carry a border about 3x a
   *  normal tile's, so both read as load-bearing at a glance. Not one of
   *  Rannie's values; see `TILE_BORDER_PX` in geometry.ts. */
  weight?: TileWeight;
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

  // The extra stroke on a "root" tile eats into the tile's own white padding
  // rather than growing the octagon, so the content layer moves inward by
  // the same amount to keep text and the plus/minus glyph clear of it.
  const contentInsetPx = TILE_CONTENT_INSET_PX[weight];
  const contentPadding = contentInsetPx
    ? {
        paddingLeft: `${24 + contentInsetPx}px`,
        paddingRight: `${24 + contentInsetPx}px`,
      }
    : undefined;
  const topOffset = contentInsetPx ? { top: `${12 + contentInsetPx}px` } : undefined;
  const bottom3Offset = contentInsetPx
    ? { bottom: `${12 + contentInsetPx}px` }
    : undefined;
  const bottom2Offset = contentInsetPx
    ? { bottom: `${8 + contentInsetPx}px` }
    : undefined;

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
          className={`absolute inset-0 overflow-hidden rotate-45 border before:absolute before:[inset:-1px] before:rotate-45 before:[border:inherit] before:content-[''] ${
            SIDE_WASH[side]
          } ${selected ? SIDE_BORDER[side] : SIDE_WASH_BORDER[side]}`}
        />
      </div>
      <div
        className="absolute overflow-hidden"
        style={{ inset: `${innerInset}rem` }}
        aria-hidden="true"
      >
        <div
          className={`absolute inset-0 overflow-hidden rotate-45 bg-offwhite before:absolute before:rotate-45 before:[border:inherit] before:content-[''] ${
            weight === "root"
              ? "border-[9px] before:[inset:-9px]"
              : "border-[3px] before:[inset:-3px]"
          } ${weight === "root" ? SIDE_BORDER_ROOT[side] : SIDE_BORDER[side]}`}
        />
      </div>
      <div
        className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 px-6 text-center"
        style={contentPadding}
      >
        {side === "neutral" && (
          // The topic tile's own watermark, where a reason tile carries its
          // stance glyph. Rannie draws the speech-bubble mark behind the
          // topic sentence and the wordmark along the bottom edge
          // (`1064:214081`), which is the one tile on the board that belongs
          // to the game rather than to either player.
          // eslint-disable-next-line @next/next/no-img-element -- decorative watermark, no intrinsic size needed
          <img
            src="/brand/logo-notext.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 m-auto size-24 object-contain opacity-8"
          />
        )}
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
          // White fill with a stance-coloured outline, which is what the
          // retired Tile.vue does to this word and what Rannie draws. A flat
          // tinted label reads as body text that happens to be small; the
          // outline reads as a stamp on the tile, which is what it is.
          //
          // The stroke is 0.75px, not the 1.5px that client used, because
          // that rule was on `h3.reason`, a heading several times this size.
          // A stroke is laid down on both sides of the contour, so 1.5px on
          // 12px Anton closes the counters and eats the white fill: "TOPIC"
          // and the wordmark below both came out as coloured smears rather
          // than as words. Scale the stroke with the type if this size ever
          // moves.
          <span
            // Not `uppercase`: Rannie stamps "reason" in lower case and
            // "TOPIC" in upper, so the case belongs to the word the caller
            // passes, not to this class list.
            className="font-primary pointer-events-none absolute top-3 z-10 text-xs tracking-wide text-white"
            style={{
              WebkitTextStrokeWidth: "0.75px",
              WebkitTextStrokeColor: STROKE_COLOR[side],
              ...topOffset,
            }}
          >
            {watermark}
          </span>
        )}
        {/* Scrolls, but never shows a bar for it. Fractional line heights
            leave scrollHeight a rounded-up pixel above clientHeight on almost
            every tile, so `auto` parks a permanent scrollbar down the right
            of the octagon and takes 15px of text width with it. A tile is a
            drawn object, not a text box; the wheel still works for the rare
            reason long enough to need it. */}
        <div className="font-tiles text-p-md text-neutral-black relative z-10 flex max-h-full flex-col items-center gap-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {children}
        </div>
        {side === "neutral" && (
          <span
            className="font-primary pointer-events-none absolute bottom-3 z-10 text-xs tracking-wide text-white"
            aria-hidden="true"
            style={{
              WebkitTextStrokeWidth: "0.75px",
              WebkitTextStrokeColor: STROKE_COLOR.neutral,
              ...bottom3Offset,
            }}
          >
            PointTaken
          </span>
        )}
        {side !== "neutral" && (
          <div
            className="pointer-events-none absolute bottom-2 z-10 flex gap-4"
            aria-hidden="true"
            style={bottom2Offset}
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
