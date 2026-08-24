import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { TOPIC_LIBRARY, TOPIC_MAX_CHARS } from "./setup";

/**
 * The starter shelf is content with a standing political obligation on it, and
 * that obligation is the kind a test cannot evaluate.
 *
 * BIZ-T260426-39 requires the shelf to stay roughly even across the whole set,
 * reviewed quarterly. It is deliberately aggregate rather than paired: no topic
 * owes a mirror image, so there is no counterpart id to check and no way to
 * assign a lean mechanically without making the content call that biz owns.
 *
 * What is checkable is that nobody changes the shelf without noticing that the
 * obligation exists. So the set is pinned. Adding, removing, or rewording a
 * topic fails this test, and the failure is the prompt to get the review rather
 * than a claim that the new shelf is unbalanced. Update the hash in the same
 * commit that carries the review, never on its own.
 *
 * Ids are separately load-bearing: a topic id is written into `topic_set`
 * payloads, so past games name their topic by it forever. Reword a topic in
 * place and old games silently acquire the new wording; that is a decision, not
 * an accident, and it should be a visible one.
 */

/** Exactly what a reviewer would read: the id and the words, in order. */
function shelfFingerprint(): string {
  const canonical = TOPIC_LIBRARY.map((topic) => `${topic.id}\t${topic.text}`).join("\n");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

const PINNED = "1f3213f99fa7e4ff";

const REVIEW =
  "The topic shelf changed. Its political balance is an aggregate obligation " +
  "(BIZ-T260426-39, roughly even across the whole shelf, reviewed quarterly) and " +
  "biz owns that call. Get the review, then update PINNED in the same commit.";

describe("the topic shelf", () => {
  it("has not changed without a balance review", () => {
    expect(shelfFingerprint(), REVIEW).toBe(PINNED);
  });

  it("still has seventeen topics across three tiers", () => {
    expect(TOPIC_LIBRARY, REVIEW).toHaveLength(17);
    expect(new Set(TOPIC_LIBRARY.map((topic) => topic.tier))).toEqual(
      new Set(["Practice", "Serious Stuff", "Tough"]),
    );
  });

  it("keeps every topic inside the ceiling a player could type themselves", () => {
    // A library topic and a typed one land in the same payload field, so the
    // shelf may not carry text the custom box would refuse.
    for (const topic of TOPIC_LIBRARY) {
      expect(topic.text.length, topic.id).toBeGreaterThan(0);
      expect(topic.text.length, topic.id).toBeLessThanOrEqual(TOPIC_MAX_CHARS);
    }
  });
});
