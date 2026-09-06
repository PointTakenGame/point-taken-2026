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

describe("PLAYER_EMOJIS", () => {
  it("offers exactly the nine emoji Point Taken Heart offers, in that order", () => {
    expect(PLAYER_EMOJIS).toEqual(["👨🏻", "👩🏻", "👱🏻‍♂️", "👩🏻‍🦰", "👩🏽", "👨🏽", "🧑🏼", "👨🏾‍🦲", "👩🏾‍🦱"]);
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
