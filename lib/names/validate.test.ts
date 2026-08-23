import { describe, expect, it } from "vitest";
import { MAX_NAME_LENGTH, validateDisplayName } from "./validate";

/** Built from code points, so the test file has no invisible characters in it. */
const point = (code: number) => String.fromCodePoint(code);

describe("validateDisplayName", () => {
  it("accepts an ordinary name and hands back the trimmed form", () => {
    expect(validateDisplayName("  Quiet   Amber Fjord ")).toEqual({
      ok: true,
      name: "Quiet Amber Fjord",
    });
  });

  it("accepts names in any script, and emoji", () => {
    for (const name of ["Ståle", "otter 🦦", "Zoë Q"]) {
      expect(validateDisplayName(name).ok, name).toBe(true);
    }
  });

  it("refuses a name that is too short once trimmed", () => {
    expect(validateDisplayName("  x  ").ok).toBe(false);
    expect(validateDisplayName("   ").ok).toBe(false);
  });

  it("counts length in characters, not UTF-16 units", () => {
    // 40 astral characters is 80 code units. Counting the wrong one would
    // reject a name that sits exactly at the limit.
    const emoji = "🦦".repeat(MAX_NAME_LENGTH);
    expect(emoji.length).toBe(MAX_NAME_LENGTH * 2);
    expect(validateDisplayName(emoji).ok).toBe(true);
    expect(validateDisplayName("🦦".repeat(MAX_NAME_LENGTH + 1)).ok).toBe(
      false,
    );
  });

  it("refuses characters that would misrepresent the interface", () => {
    const cases: Record<string, number> = {
      "right-to-left override": 0x202e,
      "zero-width space": 0x200b,
      "bell, a C0 control": 0x0007,
    };
    for (const [label, code] of Object.entries(cases)) {
      expect(validateDisplayName(`Alice${point(code)}Bob`).ok, label).toBe(
        false,
      );
    }
  });

  it("normalizes the characters JavaScript calls whitespace", () => {
    // A tab, and a byte order mark: both are `\s`, so both collapse to a
    // space rather than reaching the deceptive-character check.
    for (const code of [0x09, 0xfeff]) {
      expect(validateDisplayName(`Quiet${point(code)}Fjord`)).toEqual({
        ok: true,
        name: "Quiet Fjord",
      });
    }
  });
});
