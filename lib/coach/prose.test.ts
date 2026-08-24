import { describe, expect, it } from "vitest";

import { flattenDashes } from "./evaluate";

/**
 * The house rule is no em dashes in anything a player reads, and the coach is
 * the one writer in this codebase that is not a person, so it is the one that
 * cannot be asked to remember. `checks.test.ts` covers the ported fixed strings;
 * this covers the model's own free text, which is where the rule actually broke.
 */

describe("flattenDashes", () => {
  it("replaces the dash the live coach actually emitted", () => {
    // Verbatim from a reading on 2026-08-24, the run that found this.
    const live =
      'You\'ve made a universal claim without evidence: "nobody has ever thought otherwise" is false on its face—the entire debate exists because people disagree on this.';
    const flat = flattenDashes(live);
    expect(flat).not.toMatch(/[—–]/);
    expect(flat).toContain("is false on its face, the entire debate exists");
  });

  it("takes a spaced dash down to one comma", () => {
    expect(flattenDashes("The claim is broad — broader than the evidence.")).toBe(
      "The claim is broad, broader than the evidence.",
    );
  });

  it("does not double the comma when one is already there", () => {
    expect(flattenDashes("Name the policy, — not the person.")).toBe(
      "Name the policy, not the person.",
    );
  });

  it("leaves a full stop alone rather than putting a comma beside it", () => {
    expect(flattenDashes("That is the whole claim. — Say what it does instead.")).toBe(
      "That is the whole claim. Say what it does instead.",
    );
  });

  it("reads a dash between numbers as a range", () => {
    expect(flattenDashes("Two–three sentences is plenty.")).toBe(
      "Two, three sentences is plenty.",
    );
    expect(flattenDashes("Keep it to 2–3 sentences.")).toBe("Keep it to 2-3 sentences.");
  });

  it("takes a spaced double hyphen as the same mark", () => {
    expect(flattenDashes("Say what it does -- not who wants it.")).toBe(
      "Say what it does, not who wants it.",
    );
  });

  it("does not strip a hyphenated word", () => {
    expect(flattenDashes("A well-made reason stays well-made.")).toBe(
      "A well-made reason stays well-made.",
    );
  });

  it("leaves ordinary prose untouched", () => {
    const plain = "This claims more than it can carry. State your position instead.";
    expect(flattenDashes(plain)).toBe(plain);
  });

  it("does not leave a stray comma when the dash is at an edge", () => {
    expect(flattenDashes("— the whole debate exists")).toBe("the whole debate exists");
    expect(flattenDashes("the whole debate exists —")).toBe("the whole debate exists");
  });
});
