import { describe, expect, it } from "vitest";
import {
  JOIN_CODE_ALPHABET,
  JOIN_CODE_LENGTH,
  generateJoinCode,
  normalizeJoinCode,
} from "./joinCode";

// Derived from the constant so shortening the code does not break the shape test.
const CODE_SHAPE = new RegExp(`^[${JOIN_CODE_ALPHABET}]{${JOIN_CODE_LENGTH}}$`);

describe("generateJoinCode", () => {
  it("draws the full code length from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateJoinCode();
      expect(code).toHaveLength(JOIN_CODE_LENGTH);
      expect(code).toMatch(CODE_SHAPE);
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

describe("normalizeJoinCode", () => {
  it("accepts a code as generated", () => {
    expect(normalizeJoinCode("PTKN2")).toBe("PTKN2");
  });

  it("forgives how a person types one off a text message", () => {
    expect(normalizeJoinCode(" ptkn2 ")).toBe("PTKN2");
    expect(normalizeJoinCode("ptk-n2")).toBe("PTKN2");
    expect(normalizeJoinCode("PTK N2")).toBe("PTKN2");
  });

  it("refuses the wrong length", () => {
    expect(normalizeJoinCode("PTKN")).toBeNull();
    expect(normalizeJoinCode("PTKN23")).toBeNull();
    expect(normalizeJoinCode("")).toBeNull();
  });

  it("refuses glyphs the alphabet does not use", () => {
    expect(normalizeJoinCode("PTKNO")).toBeNull();
    expect(normalizeJoinCode("PTKN1")).toBeNull();
    expect(normalizeJoinCode("PTKN!")).toBeNull();
  });
});
