import { describe, expect, it } from "vitest";

import {
  ABSOLUTE_PHRASES,
  absolutesSentence,
  findAbsolutes,
  type AbsoluteGroup,
} from "./language";

describe("the absolutes list", () => {
  it("has no duplicate phrases, since two entries would double-count one word", () => {
    const seen = ABSOLUTE_PHRASES.map((entry) => entry.phrase);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("is written in lower case, because lookups normalise to it", () => {
    for (const entry of ABSOLUTE_PHRASES) {
      expect(entry.phrase).toBe(entry.phrase.toLowerCase());
    }
  });

  it("has no leading or trailing space, which would never match", () => {
    for (const entry of ABSOLUTE_PHRASES) {
      expect(entry.phrase.trim()).toBe(entry.phrase);
    }
  });
});

describe("findAbsolutes", () => {
  it("says nothing about a sentence that claims only what it can carry", () => {
    expect(
      findAbsolutes("Most of the districts that tried this saw costs fall a little."),
    ).toEqual([]);
  });

  it("finds a plain universal and reports where it sits", () => {
    const [hit, ...rest] = findAbsolutes("Everyone benefits from that rule.");
    expect(rest).toEqual([]);
    expect(hit.phrase).toBe("everyone");
    expect(hit.group).toBe("quantifier");
    expect(hit.start).toBe(0);
    expect(hit.end).toBe("Everyone".length);
  });

  it("quotes the player's own casing back, not the canonical spelling", () => {
    expect(findAbsolutes("This ALWAYS happens.")[0].text).toBe("ALWAYS");
  });

  it("keeps the longer phrase when two entries start in the same place", () => {
    const hits = findAbsolutes("Every single case went the same way.");
    expect(hits.map((hit) => hit.phrase)).toEqual(["every single"]);
  });

  it("does not fire inside a longer word", () => {
    // "every" inside "everyone" and "all" inside "allowed" are the two that
    // would make the check look broken to a player.
    expect(findAbsolutes("Everyone allowed it.").map((hit) => hit.phrase)).toEqual([
      "everyone",
    ]);
    expect(findAbsolutes("Nonetheless, alliances shifted.")).toEqual([]);
  });

  it("matches a phrase split across a line break", () => {
    const hits = findAbsolutes("There was\nno one\nleft.");
    expect(hits.map((hit) => hit.phrase)).toEqual(["no one"]);
    expect(hits[0].text).toBe("no one");
  });

  it("handles the one entry that ends in punctuation", () => {
    expect(findAbsolutes("It is 100% settled.").map((hit) => hit.phrase)).toEqual([
      "100%",
    ]);
    expect(findAbsolutes("The 100 people who showed up disagreed.")).toEqual([]);
  });

  it("returns hits in written order", () => {
    const hits = findAbsolutes("Nobody argues that, and it obviously never happened.");
    expect(hits.map((hit) => hit.phrase)).toEqual(["nobody", "obviously", "never"]);
  });

  it("can be narrowed to one group, which is what the no-model check wants", () => {
    const text = "Clearly everyone agrees.";
    expect(findAbsolutes(text, ["quantifier"]).map((hit) => hit.phrase)).toEqual([
      "everyone",
    ]);
    expect(findAbsolutes(text, ["certainty"]).map((hit) => hit.phrase)).toEqual([
      "clearly",
    ]);
    expect(findAbsolutes(text, [])).toEqual([]);
  });

  it("is not fooled by repeated calls sharing one regex", () => {
    // A global RegExp carries lastIndex between calls. If that leaked, the
    // second call here would start halfway through the string and find nothing.
    const text = "Always.";
    expect(findAbsolutes(text)).toHaveLength(1);
    expect(findAbsolutes(text)).toHaveLength(1);
  });

  it("covers every phrase on the list", () => {
    // Cheap insurance against an entry that can never match: a stray capital, a
    // double space, a character the pattern builder mangles.
    for (const entry of ABSOLUTE_PHRASES) {
      const hits = findAbsolutes(`Some words ${entry.phrase} and then some more.`);
      expect(
        hits.map((hit) => hit.phrase),
        entry.phrase,
      ).toContain(entry.phrase);
    }
  });
});

describe("absolutesSentence", () => {
  it("names every phrase in the groups asked for", () => {
    const groups: AbsoluteGroup[] = ["quantifier"];
    const sentence = absolutesSentence(groups);
    for (const entry of ABSOLUTE_PHRASES.filter((e) => groups.includes(e.group))) {
      expect(sentence).toContain(`"${entry.phrase}"`);
    }
    expect(sentence).not.toContain('"obviously"');
  });
});
