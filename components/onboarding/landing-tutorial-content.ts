/**
 * Content for the landing-page tutorial: four short lessons, one per rule
 * card, each ending in a two-option "make the call" check.
 *
 * Every quoted example line below is copied verbatim from this game's own
 * shipped content (a Gym level script or the signing-card popup), not
 * invented for this screen. Sources are cited beside each one so a future
 * edit can re-verify them. Two of the four cards (No Exaggeration, Help Me
 * Understand) get their "right" pair from the boss's own revision of the
 * exact "wrong" tile beside it, which is the strongest version of "same
 * point, said the way the card asks for" this codebase has on file. Content
 * lives inline, next to the component that renders it, same as everywhere
 * else in this repo (see CLAUDE.md, "Content lives inline").
 */

export type Verdict = "breaks" | "fine";

export interface Example {
  text: string;
  verdict: Verdict;
  /** One line of context, since a single sentence out of context can't carry
   *  a thread-placement rule (Stick to the Thread's Root) on its own. */
  note: string;
}

export interface CardLesson {
  cardId: string;
  boss: string;
  bossEmoji: string;
  topic: string;
  /** Narrator lines shown one at a time before the card can be tapped. */
  dialogue: string[];
  examples: readonly [Example, Example, Example, Example];
  practice: {
    /** Index into `examples` reused as the practice prompt, so nothing new
     *  has to be sourced for it. */
    exampleIndex: 0 | 1 | 2 | 3;
    prompt: string;
    explain: string;
  };
  takeaway: string;
}

export const CARD_LESSONS: readonly CardLesson[] = [
  {
    cardId: "you_is_taboo",
    boss: "Bashful Bob",
    bossEmoji: "🧑🏻‍💼",
    topic: "Should a hot dog be called a sandwich?",
    dialogue: [
      "Bashful Bob thinks a hot dog is a sandwich. You don't. That's the whole disagreement, until Bob makes it about you instead of the hot dog.",
      "“You” is Taboo: argue the point, not the person. “You said” is fine. What kind of person holds that view is not.",
      "Tap the card to see it broken, and see it fixed.",
    ],
    examples: [
      {
        text: "But you only think that because you grew up eating them at ballparks. That's nostalgia, not a rule.",
        verdict: "breaks",
        note: "Bashful Bob, Gym level 1",
      },
      {
        text: "Hmm, why don't you care about the thermostat setting?",
        verdict: "breaks",
        note: "the Mutual Respect signing card",
      },
      {
        text: "But the ballpark version of this argument is about memory, not about what the food is.",
        verdict: "fine",
        note: "Bob's own rewrite of the line above",
      },
      {
        text: "Hmm, that thermostat setting wastes energy",
        verdict: "fine",
        note: "the Mutual Respect signing card",
      },
    ],
    practice: {
      exampleIndex: 1,
      prompt: "Hmm, why don't you care about the thermostat setting?",
      explain:
        "It asks about the other player, not the thermostat. Swap in “that thermostat setting wastes energy” and the same disagreement survives the card.",
    },
    takeaway:
      "Same claim, aimed at the argument instead of the arguer, gets through every time.",
  },
  {
    cardId: "stick_to_root",
    boss: "Rambling Rosa",
    bossEmoji: "🧑🏽‍🔧",
    topic: "Should we stop changing the clocks twice a year?",
    dialogue: [
      "Rambling Rosa always has a reason. The trouble is where she hangs it.",
      "Stick to the Thread's Root: every reply has to answer the tile at the top of its own thread. A good point in the wrong thread still breaks the rule.",
      "Tap the card to watch a good reason get moved, not thrown out.",
    ],
    examples: [
      {
        text: "But year-round summer hours would mean the sun coming up after nine all winter.",
        verdict: "breaks",
        note: "hung under a thread about crash rates — never mentions crashes",
      },
      {
        text: "But the fuel saving this was invented for stopped being real decades ago.",
        verdict: "breaks",
        note: "hung under a thread about renegotiating schedules abroad — never mentions either",
      },
      {
        text: "But we could keep summer hours all year round and stop switching, and the evenings stay.",
        verdict: "fine",
        note: "answers the evenings root it's replying to",
      },
      {
        text: "No, because long summer evenings are what make after-work life possible for most people.",
        verdict: "fine",
        note: "a thread's own root — the standard every reply under it has to meet",
      },
    ],
    practice: {
      exampleIndex: 0,
      prompt:
        "But year-round summer hours would mean the sun coming up after nine all winter.",
      explain:
        "Nothing wrong with the words. It's a real point, just not an answer to the crash-rate thread it landed in. Move it, don't bin it.",
    },
    takeaway:
      "A good reason in the wrong thread still breaks the rule. Move it; don't throw it out.",
  },
  {
    cardId: "no_exaggeration",
    boss: "Braggy Bogdan",
    bossEmoji: "🧑🏼‍🔬",
    topic: "Should tipping be replaced by higher base wages?",
    dialogue: [
      "Braggy Bogdan isn't lying to you. He just says everything one size too big, cheerfully, and he won't catch himself doing it.",
      "No Exaggeration: make a claim you can actually back up. “Every,” “never,” and “the only reason” are usually the tell.",
      "Tap the card to watch him size a claim back down.",
    ],
    examples: [
      {
        text: "But every restaurant that's tried going no-tip has gone back to it.",
        verdict: "breaks",
        note: "Braggy Bogdan, Gym level 3",
      },
      {
        text: "But tipping is the only reason service in this country is as fast as it is.",
        verdict: "breaks",
        note: "Braggy Bogdan, Gym level 3",
      },
      {
        text: "But several well-known restaurants that went no-tip went back to tipping within about two years.",
        verdict: "fine",
        note: "Bogdan's own rewrite of the “every” line",
      },
      {
        text: "But tipping is one of the things that keeps servers turning tables quickly.",
        verdict: "fine",
        note: "Bogdan's own rewrite of the “only reason” line",
      },
    ],
    practice: {
      exampleIndex: 0,
      prompt: "But every restaurant that's tried going no-tip has gone back to it.",
      explain:
        "“Every” is the tell. The smaller version, several well-known restaurants went back within about two years, is harder to argue with, not weaker.",
    },
    takeaway:
      "The smaller version is usually the stronger one. You can't knock it down by finding one exception.",
  },
  {
    cardId: "help_me_understand",
    boss: "Sloppy Salma",
    bossEmoji: "🧑🏾‍🍳",
    topic: "Should AI-generated content be clearly labeled?",
    dialogue: [
      "Sloppy Salma writes fast and leaves gaps. Nothing she says is a lie. Some of it just doesn't quite land.",
      "Help Me Understand: don't tell them it was unclear. Hand back how you read it, and let the gap do the talking.",
      "Tap the card to see a reading handed back.",
    ],
    examples: [
      {
        text: "But nobody wants their work labeled by a machine.",
        verdict: "breaks",
        note: "Sloppy Salma, Gym level 4 — reads two different ways",
      },
      {
        text: "But labels that people ignore them anyway doesn't help who it's for.",
        verdict: "breaks",
        note: "Sloppy Salma, Gym level 4 — the sentence doesn't parse",
      },
      {
        text: "But creators don't want a badge stamped on work they made themselves.",
        verdict: "fine",
        note: "Salma's own rewrite, after a reading was handed back",
      },
      {
        text: "But a label only helps if the person it was meant to protect actually reads it.",
        verdict: "fine",
        note: "Salma's own rewrite, after a reading was handed back",
      },
    ],
    practice: {
      exampleIndex: 0,
      prompt: "But nobody wants their work labeled by a machine.",
      explain:
        "It reads two ways: a machine deciding what gets flagged, or a badge saying a machine made the work. Hand back your reading and let her pick.",
    },
    takeaway:
      "You never call it unclear. You show them where you landed, and they fix it themselves.",
  },
];
