import { describe, expect, it } from "vitest";

import { COACH_CARD_IDS } from "@/lib/coach/cards";
import {
  CARD_PRECEDENCE,
  CHECK_TO_CARD,
  NINE_CHECK_KEYS,
  RESEARCH_ONLY_CHECK_KEYS,
  UI_CHECK_KEYS,
  cardFor,
  fallbackFeedback,
  firstWaveCategories,
  isValidShortClaim,
  suppressFalsePositiveClarify,
  withinTileLimit,
  type CheckFindings,
} from "@/lib/coach/checks";

function findings(over: Partial<CheckFindings> = {}): CheckFindings {
  return {
    relation: "supports",
    violations: [],
    offRoot: false,
    clarificationNeeded: false,
    ...over,
  };
}

describe("the ported vocabulary", () => {
  it("splits the nine checks into surfaced and research-only with nothing left over", () => {
    expect([...UI_CHECK_KEYS, ...RESEARCH_ONLY_CHECK_KEYS].sort()).toEqual(
      [...NINE_CHECK_KEYS].sort(),
    );
    for (const key of UI_CHECK_KEYS) {
      expect(RESEARCH_ONLY_CHECK_KEYS).not.toContain(key);
    }
  });

  it("maps every check to a card the deck actually has, or to nothing", () => {
    for (const key of NINE_CHECK_KEYS) {
      const card = CHECK_TO_CARD[key];
      if (card !== null) expect(COACH_CARD_IDS).toContain(card);
    }
  });

  it("gives every card a place in the precedence order", () => {
    const mapped = new Set(
      Object.values(CHECK_TO_CARD).filter((card): card is string => card !== null),
    );
    mapped.add("help_me_understand");
    for (const card of mapped) expect(CARD_PRECEDENCE).toContain(card);
  });
});

describe("cardFor", () => {
  it("says nothing about a clean reason", () => {
    expect(cardFor(findings())).toBeNull();
  });

  it("says nothing when only research-only checks fire", () => {
    for (const key of RESEARCH_ONLY_CHECK_KEYS) {
      if (CHECK_TO_CARD[key] !== null) continue;
      expect(cardFor(findings({ violations: [key] }))).toBeNull();
    }
  });

  it("never turns an irrelevant reading into a card on its own", () => {
    expect(cardFor(findings({ relation: "irrelevant" }))).toBeNull();
  });

  it("withholds false causation, which the deck has no card for", () => {
    expect(cardFor(findings({ violations: ["false_causation"] }))).toBeNull();
  });

  it("surfaces whataboutism as staying off the root", () => {
    expect(cardFor(findings({ violations: ["whataboutism_red_herring"] }))).toBe(
      "stick_to_root",
    );
  });

  it("prefers the person over the argument when both fire", () => {
    expect(
      cardFor(
        findings({
          violations: ["personal_attack", "overgeneralization"],
          clarificationNeeded: true,
        }),
      ),
    ).toBe("you_is_taboo");
  });

  it("lets a calibrated check outrank our own off-root heuristic", () => {
    expect(cardFor(findings({ violations: ["overgeneralization"], offRoot: true }))).toBe(
      "no_exaggeration",
    );
  });

  it("still uses off-root when none of his nine found anything", () => {
    expect(cardFor(findings({ offRoot: true, clarificationNeeded: true }))).toBe(
      "stick_to_root",
    );
  });

  it("falls to asking for clarity only when nothing else fired", () => {
    expect(cardFor(findings({ clarificationNeeded: true }))).toBe("help_me_understand");
  });
});

describe("the short-claim suppressor", () => {
  it("keeps a short claim that carries a marker from being called vague", () => {
    const before = findings({ clarificationNeeded: true });
    expect(isValidShortClaim("It helps small landlords", before)).toBe(true);
    expect(
      suppressFalsePositiveClarify("It helps small landlords", before)
        .clarificationNeeded,
    ).toBe(false);
  });

  it("leaves a short claim with no marker alone", () => {
    const before = findings({ clarificationNeeded: true });
    expect(
      suppressFalsePositiveClarify("Coercion is coercion.", before).clarificationNeeded,
    ).toBe(true);
  });

  it("does not rescue a claim that broke something", () => {
    const before = findings({ clarificationNeeded: true, violations: ["exaggeration"] });
    expect(
      suppressFalsePositiveClarify("It helps because of that", before)
        .clarificationNeeded,
    ).toBe(true);
  });

  it("does not rescue a long claim", () => {
    const long =
      "It helps in a way that the other side has never once been willing to admit anywhere";
    const before = findings({ clarificationNeeded: true });
    expect(suppressFalsePositiveClarify(long, before).clarificationNeeded).toBe(true);
  });
});

describe("what gets logged and said", () => {
  it("names his first-wave categories for a surfaced violation", () => {
    expect(
      firstWaveCategories(findings({ violations: ["overgeneralization"] })),
    ).toContain("too_broad");
  });

  it("always has a sentence ready for anything that produces a card", () => {
    for (const key of NINE_CHECK_KEYS) {
      const line = fallbackFeedback(findings({ violations: [key] }));
      if (CHECK_TO_CARD[key] !== null) expect(line).toBeTruthy();
    }
    expect(fallbackFeedback(findings({ offRoot: true }))).toBeTruthy();
    expect(fallbackFeedback(findings({ clarificationNeeded: true }))).toBeTruthy();
    expect(fallbackFeedback(findings())).toBeNull();
  });

  it("never speaks in em dashes", () => {
    for (const key of NINE_CHECK_KEYS) {
      expect(fallbackFeedback(findings({ violations: [key] })) ?? "").not.toContain("—");
    }
  });
});

describe("withinTileLimit", () => {
  it("refuses a rewrite that would not fit on a tile", () => {
    expect(withinTileLimit("x".repeat(101), 100)).toBeNull();
    expect(withinTileLimit("  fits  ", 100)).toBe("fits");
    expect(withinTileLimit("   ", 100)).toBeNull();
    expect(withinTileLimit(null, 100)).toBeNull();
  });
});
