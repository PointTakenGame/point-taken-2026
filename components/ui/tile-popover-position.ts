/**
 * Pure positioning math for TilePopover.
 *
 * Split out from the component so the edge-clamping and flip logic can be
 * unit tested without a DOM: jsdom's getBoundingClientRect returns all
 * zeros unless every test mocks it, so a plain function that takes plain
 * rectangles is a lot cheaper to verify than mounting the real component
 * for every edge case.
 *
 * Placement rule ported from the retired ResolveAgreementModal.vue anchor
 * prop (decision BRAIN-T260716-07): sit below the tile by default, flip
 * above it only when there truly isn't room, and never let the card cross
 * the viewport edge regardless of where the tile sits.
 */

export interface PopoverRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface PopoverSize {
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface AnchoredPosition {
  left: number;
  top: number;
  placement: "above" | "below";
}

/**
 * Given the anchor tile's rect, the popover's own measured size, and the
 * viewport, return the top/left to render the popover at so it sits just
 * outside the tile and stays fully on screen.
 */
export function computeAnchoredPosition(
  anchor: PopoverRect,
  popover: PopoverSize,
  viewport: Viewport,
  gap = 12,
  margin = 8,
): AnchoredPosition {
  const spaceBelow = viewport.height - (anchor.top + anchor.height);
  const spaceAbove = anchor.top;
  const fitsBelow = spaceBelow >= popover.height + gap;
  const placement: "above" | "below" =
    fitsBelow || spaceBelow >= spaceAbove ? "below" : "above";

  const rawTop =
    placement === "below"
      ? anchor.top + anchor.height + gap
      : anchor.top - popover.height - gap;

  const maxTop = Math.max(viewport.height - popover.height - margin, margin);
  const top = Math.min(Math.max(rawTop, margin), maxTop);

  const idealLeft = anchor.left + anchor.width / 2 - popover.width / 2;
  const maxLeft = Math.max(viewport.width - popover.width - margin, margin);
  const left = Math.min(Math.max(idealLeft, margin), maxLeft);

  return { left, top, placement };
}
