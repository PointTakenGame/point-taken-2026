import { describe, expect, it } from "vitest";

import { COACH_CARDS, coachCardsMatchDeck } from "@/lib/coach/cards";
import { SCRIPTED_LEVELS } from "@/lib/gym/levels";

describe("coach cards", () => {
  it("holds exactly the deck the game deals", () => {
    expect(coachCardsMatchDeck()).toBe(true);
  });

  /**
   * `earnedAtLevel` is printed on the badge in the corner of every rule card
   * face, so it is a claim to the player about when they got the card. The
   * ladder that actually hands cards out is `SCRIPTED_LEVELS`, and the number
   * on the card has to be that one rather than the L2/L3/L4 in Rannie's Figma,
   * which belong to a second level-naming ladder nobody has ruled on.
   */
  it("prints the level that actually awards the card", () => {
    for (const card of COACH_CARDS) {
      const level = SCRIPTED_LEVELS.find((each) => each.awards.cardId === card.id);
      expect(level, `no level awards ${card.id}`).toBeDefined();
      expect(card.earnedAtLevel, card.id).toBe(level?.number);
    }
  });

  it("gives every card a line for its own face", () => {
    for (const card of COACH_CARDS) {
      expect(card.throwWhen.length, card.id).toBeGreaterThan(20);
      expect(card.throwWhen, card.id).not.toBe(card.plain);
    }
  });
});
