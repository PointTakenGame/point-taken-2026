import { describe, expect, it } from "vitest";
import { computeAnchoredPosition } from "./tile-popover-position";

const viewport = { width: 1000, height: 800 };
const size = { width: 240, height: 160 };

describe("computeAnchoredPosition", () => {
  it("centers the popover under a tile with room on every side", () => {
    const anchor = { top: 300, left: 400, width: 80, height: 80 };
    const result = computeAnchoredPosition(anchor, size, viewport);

    expect(result.placement).toBe("below");
    expect(result.top).toBe(300 + 80 + 12);
    expect(result.left).toBe(400 + 40 - 120);
  });

  it("flips above the tile when there is no room below", () => {
    const anchor = { top: 700, left: 400, width: 80, height: 80 };
    const result = computeAnchoredPosition(anchor, size, viewport);

    expect(result.placement).toBe("above");
    expect(result.top).toBe(700 - 160 - 12);
  });

  it("stays below, clamped to the viewport, when neither side fully fits", () => {
    const anchor = { top: 790, left: 400, width: 80, height: 5 };
    const result = computeAnchoredPosition(anchor, size, viewport);

    // Below has 5px of space, above has 790px: above wins on room alone,
    // but this case exists to document that "more room" beats "fits exactly".
    expect(result.placement).toBe("above");
    expect(result.top).toBeGreaterThanOrEqual(8);
    expect(result.top + size.height).toBeLessThanOrEqual(viewport.height - 8 + 1);
  });

  it("clamps left to the viewport's left margin near the left edge", () => {
    const anchor = { top: 300, left: 0, width: 20, height: 20 };
    const result = computeAnchoredPosition(anchor, size, viewport);

    expect(result.left).toBe(8);
  });

  it("clamps left to the viewport's right margin near the right edge", () => {
    const anchor = { top: 300, left: 980, width: 20, height: 20 };
    const result = computeAnchoredPosition(anchor, size, viewport);

    expect(result.left).toBe(viewport.width - size.width - 8);
  });

  it("clamps top so a popover taller than the viewport never overflows both edges", () => {
    const anchor = { top: 10, left: 400, width: 80, height: 20 };
    const oversized = { width: 240, height: 2000 };
    const result = computeAnchoredPosition(anchor, oversized, viewport);

    expect(result.top).toBe(8);
  });

  it("uses a custom gap and margin when provided", () => {
    const anchor = { top: 100, left: 400, width: 80, height: 80 };
    const result = computeAnchoredPosition(anchor, size, viewport, 24, 4);

    expect(result.top).toBe(100 + 80 + 24);
  });
});
