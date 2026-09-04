import { describe, expect, it } from "vitest";

import { stripDuplicateLead } from "@/components/board/side-label";

describe("stripDuplicateLead", () => {
  it("strips a duplicated 'Yes, because' stem and recapitalizes", () => {
    expect(stripDuplicateLead("Yes, because the budget is too small")).toBe(
      "The budget is too small",
    );
  });

  it("strips a duplicated 'No, because' stem, case-insensitively", () => {
    expect(stripDuplicateLead("no, because it never passed a vote")).toBe(
      "It never passed a vote",
    );
  });

  it("strips a duplicated 'But' stem", () => {
    expect(stripDuplicateLead("But that ignores the counterexample")).toBe(
      "That ignores the counterexample",
    );
  });

  it("strips a duplicated 'Hmm' stem", () => {
    expect(stripDuplicateLead("hmm, is that actually true")).toBe(
      "Is that actually true",
    );
  });

  it("tolerates the stem without its own trailing comma", () => {
    expect(stripDuplicateLead("yes because it works")).toBe("It works");
  });

  it("leaves text with no duplicated stem untouched", () => {
    expect(stripDuplicateLead("The budget is too small")).toBe("The budget is too small");
  });

  it("leaves an empty string untouched", () => {
    expect(stripDuplicateLead("")).toBe("");
  });

  it("does not strip a stem that only appears mid-sentence", () => {
    expect(stripDuplicateLead("It works, but not always")).toBe(
      "It works, but not always",
    );
  });
});
