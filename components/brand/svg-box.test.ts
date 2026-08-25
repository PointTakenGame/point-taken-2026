import { describe, expect, it } from "vitest";
import { svgBox } from "./svg-box";

describe("svgBox", () => {
  it("treats an unlisted file as square", () => {
    // Every `*-hovered.svg` token is 68 by 68, and so are four of the five
    // glyphs. They are deliberately absent from the table.
    expect(svgBox("/tokens/thumbs-up-hovered.svg", 32)).toEqual({
      width: 32,
      height: 32,
    });
    expect(svgBox("/glyphs/heart.svg", 24)).toEqual({ width: 24, height: 24 });
  });

  it("derives the height a non-square file will actually render at", () => {
    // 20 * 74/68 = 21.76, and the browser lays out from the rounded width.
    expect(svgBox("/tokens/thumbs-up.svg", 20)).toEqual({ width: 20, height: 22 });
    // 28 * 50/52 = 26.92, matching the 28 x 26.9 measured live in the browser.
    expect(svgBox("/glyphs/party.svg", 28)).toEqual({ width: 28, height: 27 });
    expect(svgBox("/tokens/scale.svg", 32)).toEqual({ width: 32, height: 31 });
    expect(svgBox("/tokens/wine.svg", 52)).toEqual({ width: 52, height: 68 });
  });

  it("keys by file path, so a token's resting and hovered art can differ", () => {
    expect(svgBox("/tokens/thumbs-up.svg", 68)).toEqual({ width: 68, height: 74 });
    expect(svgBox("/tokens/thumbs-up-hovered.svg", 68)).toEqual({
      width: 68,
      height: 68,
    });
  });

  it("reproduces the wordmark height that used to be written out by hand", () => {
    // `Wordmark` in ./art.tsx carried `Math.round((width * 227) / 300)`.
    for (const width of [120, 200, 240, 300, 480]) {
      expect(svgBox("/brand/logo.svg", width)).toEqual({
        width,
        height: Math.round((width * 227) / 300),
      });
    }
  });

  it("never returns a fractional dimension", () => {
    for (const src of [
      "/tokens/thumbs-up.svg",
      "/tokens/scale.svg",
      "/tokens/wine.svg",
      "/glyphs/party.svg",
      "/brand/logo.svg",
    ]) {
      for (let width = 1; width <= 64; width += 1) {
        const box = svgBox(src, width);
        expect(Number.isInteger(box.height)).toBe(true);
        expect(box.width).toBe(width);
      }
    }
  });
});
