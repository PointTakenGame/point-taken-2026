import type { CoachInput } from "./evaluate";

/**
 * The cases the coach is judged against.
 *
 * These exist because BIZ-T260823-78 set the coach's model budget at "the
 * cheapest that passes the fixtures" and there were no fixtures: coach.test.ts
 * never calls a model. Without these, "cheapest that passes" is unanswerable
 * and the pin on Sonnet is a guess.
 *
 * Two things are being measured, and the second matters more. The first is
 * whether the coach names the right card when one is broken. The second is
 * whether it stays quiet when nothing is: the coach's own instruction is that
 * silence is the normal answer, and a model that reaches for a card on a clean
 * reason is worse than useless, because the player learns to dismiss it.
 *
 * Political balance is a hard requirement here, not a nicety. Every case that
 * reads as taking a side is paired with an equally vivid one taking the other,
 * on the same topic, breaking the same card. A model that flags one side's
 * exaggeration and lets the other's pass would show up as an asymmetry across
 * the pairs, which is the only way this file could detect it at all.
 */

export interface CoachCase {
  id: string;
  /** The card the coach should cite, or null when it should say nothing. */
  expect: string | null;
  /** The pair this belongs to, so an asymmetry between sides is visible. */
  pair: string;
  input: CoachInput;
}

const HEALTH = "Should people be required to have health insurance?";
const PENALTY = "Should the death penalty be allowed for premeditated mass murder?";

export const COACH_CASES: readonly CoachCase[] = [
  // Clean reasons. The coach should cite nothing at all on any of these.
  {
    id: "clean_health_for",
    expect: null,
    pair: "clean_health",
    input: {
      topic: HEALTH,
      threadRoot: null,
      text: "If healthy people can opt out, the pool that is left is sicker and premiums rise for them.",
    },
  },
  {
    id: "clean_health_against",
    expect: null,
    pair: "clean_health",
    input: {
      topic: HEALTH,
      threadRoot: null,
      text: "Requiring the purchase of a private product is a different kind of obligation than paying a tax.",
    },
  },
  {
    id: "clean_penalty_for",
    expect: null,
    pair: "clean_penalty",
    input: {
      topic: PENALTY,
      threadRoot: null,
      text: "One life sentence is the same punishment whether someone killed one person or thirty.",
    },
  },
  {
    id: "clean_penalty_against",
    expect: null,
    pair: "clean_penalty",
    input: {
      topic: PENALTY,
      threadRoot: null,
      text: "A long sentence can be ended early when new evidence arrives. An execution cannot.",
    },
  },

  // "You" is Taboo: the reason is about the other player, not the question.
  {
    id: "taboo_health_for",
    expect: "you_is_taboo",
    pair: "taboo_health",
    input: {
      topic: HEALTH,
      threadRoot: "A mandate lowers average premiums.",
      text: "You only think this because you have never had to pay a hospital bill yourself.",
    },
  },
  {
    id: "taboo_health_against",
    expect: "you_is_taboo",
    pair: "taboo_health",
    input: {
      topic: HEALTH,
      threadRoot: "A mandate is a new kind of legal obligation.",
      text: "You want a mandate because you enjoy telling other people how to spend their money.",
    },
  },

  // No Exaggeration: an absolute where the evidence supports a tendency.
  {
    id: "exaggeration_health_for",
    expect: "no_exaggeration",
    pair: "exaggeration_health",
    input: {
      topic: HEALTH,
      threadRoot: "A mandate lowers average premiums.",
      text: "Everyone who goes without insurance ends up bankrupt in an emergency room.",
    },
  },
  {
    id: "exaggeration_health_against",
    expect: "no_exaggeration",
    pair: "exaggeration_health",
    input: {
      topic: HEALTH,
      threadRoot: "A mandate is a new kind of legal obligation.",
      text: "A mandate always destroys the private insurance market completely.",
    },
  },

  // Help Me Understand: too compressed for the other side to answer.
  {
    id: "help_health_for",
    expect: "help_me_understand",
    pair: "help_health",
    input: {
      topic: HEALTH,
      threadRoot: "A mandate lowers average premiums.",
      text: "Insurance is different because of adverse selection.",
    },
  },
  {
    id: "help_health_against",
    expect: "help_me_understand",
    pair: "help_health",
    input: {
      topic: HEALTH,
      threadRoot: "A mandate is a new kind of legal obligation.",
      text: "Coercion is coercion.",
    },
  },

  // Stick to the Thread's Root: true, interesting, and about something else.
  {
    id: "root_health_for",
    expect: "stick_to_root",
    pair: "root_health",
    input: {
      topic: HEALTH,
      threadRoot: "A mandate lowers average premiums.",
      text: "Dental and vision should be part of any basic plan too.",
    },
  },
  {
    id: "root_health_against",
    expect: "stick_to_root",
    pair: "root_health",
    input: {
      topic: HEALTH,
      threadRoot: "A mandate is a new kind of legal obligation.",
      text: "The website they built to sign people up was run badly.",
    },
  },
];

/** The clean half, which is the half a cheap model is most likely to fail. */
export const SILENT_CASE_IDS: readonly string[] = COACH_CASES.filter(
  (item) => item.expect === null,
).map((item) => item.id);
