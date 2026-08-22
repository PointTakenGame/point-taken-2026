import { describe, expect, it } from "vitest";
import {
  JOIN_CODE_ALPHABET,
  JOIN_CODE_LENGTH,
  generateJoinCode,
} from "./joinCode";

describe("generateJoinCode", () => {
  it("draws six characters from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateJoinCode();
      expect(code).toHaveLength(JOIN_CODE_LENGTH);
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  it("excludes the glyphs that get misread aloud", () => {
    for (const glyph of ["0", "O", "1", "I"]) {
      expect(JOIN_CODE_ALPHABET).not.toContain(glyph);
    }
  });

  it("uses the picker for every character", () => {
    const drawn: number[] = [];
    const code = generateJoinCode((bound) => {
      drawn.push(bound);
      return drawn.length - 1;
    });
    expect(drawn).toEqual(Array(JOIN_CODE_LENGTH).fill(32));
    expect(code).toBe(JOIN_CODE_ALPHABET.slice(0, JOIN_CODE_LENGTH));
  });
});
