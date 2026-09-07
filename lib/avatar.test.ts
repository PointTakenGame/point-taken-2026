import { describe, expect, it } from "vitest";

import { avatarMark, initialsOf, isPlayerEmoji, PLAYER_EMOJIS } from "./avatar";

describe("initialsOf", () => {
  it("takes one letter per word", () => {
    expect(initialsOf("Copper Humble Compass")).toBe("CHC");
  });

  it("stops at three, so a long name does not run off the disc", () => {
    expect(initialsOf("one two three four five")).toBe("OTT");
  });

  it("gives one letter for a one-word name rather than inventing more", () => {
    expect(initialsOf("Sam")).toBe("S");
  });

  it("has nothing to show for a player who has not been named yet", () => {
    expect(initialsOf(null)).toBe("");
    expect(initialsOf("   ")).toBe("");
  });

  it("survives the spacing a person actually types", () => {
    expect(initialsOf("  copper   humble  ")).toBe("CH");
  });
});

describe("avatarMark", () => {
  it("keeps a player's colour through a rename", () => {
    const before = avatarMark("player-1", "Copper Humble Compass");
    const after = avatarMark("player-1", "Something Else");
    expect(after.background).toBe(before.background);
    expect(after.initials).not.toBe(before.initials);
  });

  it("gives different players different colours", () => {
    const a = avatarMark("11111111-1111-4111-8111-111111111111", "A B");
    const b = avatarMark("22222222-2222-4222-8222-222222222222", "A B");
    expect(a.background).not.toBe(b.background);
  });

  it("stays dark enough for white text at every hue", () => {
    for (const id of ["a", "bb", "ccc", "dddd", "eeeee", "ffffff"]) {
      expect(avatarMark(id, "X")).toMatchObject({
        background: expect.stringContaining("55% 38%"),
      });
    }
  });
});

// How each of the nine reads, for the grid checks below. Written out here
// rather than exported from lib/avatar.ts because nothing in the app needs to
// know: it is only the test that has an opinion about how the picker looks.
// "person" is the one gender-neutral face, and it counts as neither a man nor
// a woman, so its row and column have to be carried by their other two cells.
const READS = {
  "👨🏻": { who: "man", tone: "lighter" },
  "👩🏻": { who: "woman", tone: "lighter" },
  "👱🏻‍♂️": { who: "man", tone: "lighter" },
  "👩🏻‍🦰": { who: "woman", tone: "lighter" },
  "🧑🏼": { who: "person", tone: "lighter" },
  "👩🏽": { who: "woman", tone: "darker" },
  "👨🏽": { who: "man", tone: "darker" },
  "👨🏾‍🦲": { who: "man", tone: "darker" },
  "👩🏾‍🦱": { who: "woman", tone: "darker" },
} as const;

/** The nine as the picker actually lays them out: three across, three down. */
function rowsAndColumns(): { label: string; cells: readonly string[] }[] {
  const rows = [0, 1, 2].map((r) => ({
    label: `row ${r + 1}`,
    cells: PLAYER_EMOJIS.slice(r * 3, r * 3 + 3),
  }));
  const columns = [0, 1, 2].map((c) => ({
    label: `column ${c + 1}`,
    cells: [PLAYER_EMOJIS[c], PLAYER_EMOJIS[c + 3], PLAYER_EMOJIS[c + 6]],
  }));
  return [...rows, ...columns];
}

describe("PLAYER_EMOJIS", () => {
  it("offers exactly the nine emoji Point Taken Heart offers", () => {
    // The set is mirrored in supabase/migrations/0015_player_avatar.sql's
    // check constraint. Order is deliberately not asserted here: the grid
    // properties below are what the arrangement has to satisfy.
    expect([...PLAYER_EMOJIS].sort()).toEqual(
      ["👨🏻", "👩🏻", "👱🏻‍♂️", "👩🏻‍🦰", "👩🏽", "👨🏽", "🧑🏼", "👨🏾‍🦲", "👩🏾‍🦱"].sort(),
    );
  });

  it("opens the grid on the medium-tone woman", () => {
    expect(PLAYER_EMOJIS[0]).toBe("👩🏽");
  });

  it("gives every row and column a man and a woman", () => {
    for (const { label, cells } of rowsAndColumns()) {
      const who = cells.map((cell) => READS[cell as keyof typeof READS].who);
      expect(who, `${label} has no man`).toContain("man");
      expect(who, `${label} has no woman`).toContain("woman");
    }
  });

  it("gives every row and column a darker and a lighter skin tone", () => {
    // The complaint this answers (Steve, 2026-09-07): sorted by tone, the
    // grid put both darker faces together in one corner, which reads as a
    // sorting rather than a choice.
    for (const { label, cells } of rowsAndColumns()) {
      const tone = cells.map((cell) => READS[cell as keyof typeof READS].tone);
      expect(tone, `${label} is all lighter`).toContain("darker");
      expect(tone, `${label} is all darker`).toContain("lighter");
    }
  });
});

describe("isPlayerEmoji", () => {
  it("accepts every emoji on offer", () => {
    for (const emoji of PLAYER_EMOJIS) {
      expect(isPlayerEmoji(emoji)).toBe(true);
    }
  });

  it("rejects anything not on the list, including a close lookalike", () => {
    expect(isPlayerEmoji("🙂")).toBe(false);
    expect(isPlayerEmoji("👨")).toBe(false);
    expect(isPlayerEmoji("")).toBe(false);
    expect(isPlayerEmoji("not an emoji")).toBe(false);
  });
});
