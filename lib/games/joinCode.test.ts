import { describe, expect, it } from "vitest";
import {
  JOIN_CODE_ALPHABET,
  JOIN_CODE_LENGTH,
  generateJoinCode,
  normalizeJoinCode,
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

describe("normalizeJoinCode", () => {
  it("accepts a code as generated", () => {
    expect(normalizeJoinCode("PTKN23")).toBe("PTKN23");
  });

  it("forgives how a person types one off a text message", () => {
    expect(normalizeJoinCode(" ptkn23 ")).toBe("PTKN23");
    expect(normalizeJoinCode("ptk-n23")).toBe("PTKN23");
    expect(normalizeJoinCode("PTK N23")).toBe("PTKN23");
  });

  it("refuses the wrong length", () => {
    expect(normalizeJoinCode("PTKN2")).toBeNull();
    expect(normalizeJoinCode("PTKN234")).toBeNull();
    expect(normalizeJoinCode("")).toBeNull();
  });

  it("refuses glyphs the alphabet does not use", () => {
    expect(normalizeJoinCode("PTKN2O")).toBeNull();
    expect(normalizeJoinCode("PTKN21")).toBeNull();
    expect(normalizeJoinCode("PTKN2!")).toBeNull();
  });
});
