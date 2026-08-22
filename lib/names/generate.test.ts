import { describe, expect, it } from "vitest";
import { ADJECTIVES, NOUNS } from "./wordlist";
import {
  TOTAL_COMBINATIONS,
  displayNameSlug,
  formatDisplayName,
  generateDisplayName,
  generateNameParts,
  numericTail,
  randomIndex,
} from "./generate";

describe("the word list", () => {
  const all = [...ADJECTIVES, ...NOUNS];

  it("is lowercase letters only", () => {
    expect(all.filter((w) => !/^[a-z]{3,10}$/.test(w))).toEqual([]);
  });

  it("has no duplicates, within a list or across the two", () => {
    expect(new Set(all).size).toBe(all.length);
  });

  it("is sorted, so an addition is a one-line diff in the right place", () => {
    expect([...ADJECTIVES]).toEqual([...ADJECTIVES].sort());
    expect([...NOUNS]).toEqual([...NOUNS].sort());
  });

  it("is big enough that collisions stay rare", () => {
    expect(TOTAL_COMBINATIONS).toBeGreaterThan(500_000);
  });
});

describe("generateNameParts", () => {
  it("never repeats the adjective", () => {
    for (let i = 0; i < 2000; i += 1) {
      const parts = generateNameParts();
      expect(parts.first).not.toBe(parts.second);
    }
  });

  it("draws every word from the lists", () => {
    for (let i = 0; i < 500; i += 1) {
      const parts = generateNameParts();
      expect(ADJECTIVES).toContain(parts.first);
      expect(ADJECTIVES).toContain(parts.second);
      expect(NOUNS).toContain(parts.noun);
    }
  });

  it("steps over the first adjective rather than redrawing", () => {
    // A picker stuck on 0 would loop forever under a redraw scheme.
    const parts = generateNameParts(() => 0);
    expect(parts.first).toBe(ADJECTIVES[0]);
    expect(parts.second).toBe(ADJECTIVES[1]);
    expect(parts.noun).toBe(NOUNS[0]);
  });

  it("reaches the last adjective, which an off-by-one would strand", () => {
    const last = ADJECTIVES.length - 1;
    const parts = generateNameParts(() => last - 1);
    expect(parts.first).toBe(ADJECTIVES[last - 1]);
    expect(parts.second).toBe(ADJECTIVES[last]);
  });
});

describe("formatting", () => {
  it("title-cases three words", () => {
    expect(
      formatDisplayName({ first: "brisk", second: "copper", noun: "otter" }),
    ).toBe("Brisk Copper Otter");
  });

  it("produces a name the database check constraint accepts", () => {
    expect(generateDisplayName()).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+$/);
  });

  it("slugs to url-safe text, tail and all", () => {
    expect(displayNameSlug("Brisk Copper Otter")).toBe("brisk-copper-otter");
    expect(displayNameSlug("Brisk Copper Otter 412")).toBe(
      "brisk-copper-otter-412",
    );
  });

  it("gives a three-digit tail", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(numericTail()).toMatch(/^[1-9][0-9]{2}$/);
    }
  });
});

describe("randomIndex", () => {
  it("stays inside the bound and covers it", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 5000; i += 1) {
      const n = randomIndex(10);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(10);
      seen.add(n);
    }
    expect(seen.size).toBe(10);
  });

  it("refuses a bound that is not a positive integer", () => {
    expect(() => randomIndex(0)).toThrow();
    expect(() => randomIndex(2.5)).toThrow();
  });
});
