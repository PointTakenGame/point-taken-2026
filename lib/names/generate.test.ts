import { describe, expect, it } from "vitest";
import { ADJECTIVES, NOUNS } from "./wordlist";
import {
  SHORT_COMBINATIONS,
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

  // The two-word pool is the one a real player draws from first, so it is the
  // one that runs out. Thousands, not hundreds: a few hundred would collide
  // in the first week and every name after that would be three words.
  it("has a two-word pool big enough to hand out for a good while", () => {
    expect(SHORT_COMBINATIONS).toBeGreaterThan(5_000);
  });
});

describe("generateNameParts", () => {
  it("never repeats the adjective", () => {
    for (let i = 0; i < 2000; i += 1) {
      const parts = generateNameParts(undefined, 3);
      expect(parts.first).not.toBe(parts.second);
    }
  });

  it("draws every word from the lists", () => {
    for (let i = 0; i < 500; i += 1) {
      const parts = generateNameParts(undefined, 3);
      expect(ADJECTIVES).toContain(parts.first);
      expect(ADJECTIVES).toContain(parts.second);
      expect(NOUNS).toContain(parts.noun);
    }
  });

  it("steps over the first adjective rather than redrawing", () => {
    // A picker stuck on 0 would loop forever under a redraw scheme.
    const parts = generateNameParts(() => 0, 3);
    expect(parts.first).toBe(ADJECTIVES[0]);
    expect(parts.second).toBe(ADJECTIVES[1]);
    expect(parts.noun).toBe(NOUNS[0]);
  });

  it("reaches the last adjective, which an off-by-one would strand", () => {
    const last = ADJECTIVES.length - 1;
    const parts = generateNameParts(() => last - 1, 3);
    expect(parts.first).toBe(ADJECTIVES[last - 1]);
    expect(parts.second).toBe(ADJECTIVES[last]);
  });

  // Two words is the default because that is what a new player should get
  // (Steve, 2026-09-07); three is what the retry ladder in lib/db/players.ts
  // falls back to once a two-word draw is already taken.
  it("drops the second adjective on a two-word draw, which is the default", () => {
    const parts = generateNameParts(() => 0);
    expect(parts).toEqual({
      first: ADJECTIVES[0],
      second: null,
      noun: NOUNS[0],
    });
  });

  it("burns the same number of picks either way, so a seeded draw lines up", () => {
    const calls: number[] = [];
    const count = (bound: number) => {
      calls.push(bound);
      return 0;
    };
    generateNameParts(count, 2);
    const two = calls.length;
    generateNameParts(count, 3);
    expect(calls.length - two).toBe(two);
  });
});

describe("formatting", () => {
  it("title-cases three words", () => {
    expect(formatDisplayName({ first: "brisk", second: "copper", noun: "otter" })).toBe(
      "Brisk Copper Otter",
    );
  });

  it("leaves no double space where the second adjective would have been", () => {
    expect(formatDisplayName({ first: "brisk", second: null, noun: "otter" })).toBe(
      "Brisk Otter",
    );
  });

  // The database asks only that the name be non-empty and unique on
  // lower(display_name) (migration 0004). The word count is this file's rule,
  // not the database's, which is why it is asserted here.
  it("draws two title-cased words by default", () => {
    expect(generateDisplayName()).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  });

  it("draws three when the ladder asks for three", () => {
    expect(generateDisplayName(undefined, 3)).toMatch(
      /^[A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+$/,
    );
  });

  it("slugs to url-safe text, tail and all", () => {
    expect(displayNameSlug("Brisk Copper Otter")).toBe("brisk-copper-otter");
    expect(displayNameSlug("Brisk Copper Otter 412")).toBe("brisk-copper-otter-412");
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
