import { describe, expect, it } from "vitest";

import { SCRIPTED_LEVELS } from "./levels";
import { taughtMoves } from "./taught";

/**
 * These pin the ladder, not the walk. `taughtMoves` reads the beats, so a
 * rewritten script changes its answers by design; what must not change
 * silently is the order in which a player meets these four things, which is
 * the whole of Steve's 2026-09-06 note. If a case here fails, read the script
 * that moved and decide whether the new order is the one you meant.
 */

const [L1, L2, L3, L4] = SCRIPTED_LEVELS;

const beat = (level: (typeof SCRIPTED_LEVELS)[number], id: string): number => {
  const index = level.beats.findIndex((b) => b.id === id);
  expect(index, `no beat "${id}" in level ${level.number}`).toBeGreaterThanOrEqual(0);
  return index;
};

describe("taughtMoves, level 1", () => {
  it("teaches nothing at all on the first beat", () => {
    expect(taughtMoves(L1, 0)).toEqual({ proposals: [], tokens: [] });
  });

  it("teaches 👍 when Bob places his, and still withholds 👀", () => {
    const taught = taughtMoves(L1, beat(L1, "bob-token-a"));
    expect(taught.tokens).toEqual(["👍"]);
    expect(taught.proposals).toEqual([]);
  });

  it("teaches 👀 at the beat that asks for it", () => {
    const before = beat(L1, "player-token-b") - 1;
    expect(taughtMoves(L1, before).tokens).not.toContain("👀");
    expect(taughtMoves(L1, beat(L1, "player-token-b")).tokens).toContain("👀");
  });

  it("never teaches a later move", () => {
    expect(taughtMoves(L1, L1.beats.length).proposals).toEqual([]);
  });
});

describe("taughtMoves, the levels above", () => {
  it("carries both tokens into level 2 from the first beat", () => {
    expect(taughtMoves(L2, 0).tokens).toEqual(expect.arrayContaining(["👍", "👀"]));
  });

  it("teaches relocation inside level 2, not before it", () => {
    expect(taughtMoves(L2, 0).proposals).not.toContain("tile_relocation");
    expect(taughtMoves(L2, L2.beats.length).proposals).toContain("tile_relocation");
    expect(taughtMoves(L3, 0).proposals).toContain("tile_relocation");
  });

  it("holds the handback and the definition back until level 4", () => {
    for (const level of [L1, L2, L3]) {
      const taught = taughtMoves(level, level.beats.length);
      expect(taught.proposals).not.toContain("reading_handback");
      expect(taught.proposals).not.toContain("definition");
    }
    const four = taughtMoves(L4, L4.beats.length);
    expect(four.proposals).toContain("reading_handback");
    expect(four.proposals).toContain("definition");
  });
});
