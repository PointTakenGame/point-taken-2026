import type { Level } from "../script";
import { THROW_POINTS } from "@/lib/progression/sample";

/**
 * Level 4, Clarity: Should AI-generated content be clearly labeled?
 *
 * Beats and lines from Nathan's Revision 2 (inbox/point-taken-levels-1-4.md,
 * "LEVEL 4 Clarity"). The player is Plus (label it), Salma is Minus (don't).
 * Four threads: A and B are the player's, C and D are Salma's. The card is
 * Help Me Understand, and the governing principle, never broken in any line
 * below, is that you never show someone their writing was unclear by saying
 * it was unclear. You hand back how you read it and let them see the gap.
 *
 * Three decisions this file makes, all of them recorded as decision rows:
 *
 * - **Rung 0 is a live board rule, and the beat that teaches it is a pause.**
 *   Nathan has the moderator intercept Salma's question tile at write time.
 *   The rule itself is real and lives in `lib/board/rules.ts`: a tile ending
 *   in a question mark is refused, for either player, with the moderator's
 *   words. The refusal of a boss tile, though, leaves nothing on the board,
 *   so the walker could never see it happen and the level would stall. The
 *   interception is therefore staged in a pause carrying all three voices,
 *   and the boss then places the statement he made her restate.
 * - **The restatement box is the reading handback we already had.** Throwing
 *   the card and handing back a reading are two moves here, not one: the
 *   throw is what scores, the handback is what Salma answers. Accepting a
 *   handback changes nothing on the board by design, so her rewrite is a
 *   revision answering the standing throw.
 * - **Define That is a definition proposal with no target tile.** The player
 *   names the word and writes what they think it has to mean; Salma accepts.
 *   The agreed pair is then pinned to the edge of the board for the rest of
 *   the game by `agreedDefinitions`.
 *
 * Player tiles follow Nathan's Appendix B option 2: suggested on the beats
 * that matter (the roots, the two readings, the definition) and free text on
 * the ordinary answers. L4.7 is deliberately unscaffolded, so its coach line
 * says almost nothing and the nudge is Nathan's one question.
 *
 * Rung ids are `help_me_understand_1..2`. Badges follow lib/progression/sample.
 */

const CARD = "help_me_understand";

export const CLARITY: Level = {
  id: "clarity",
  number: 4,
  title: "Clarity",
  topic: "Should AI-generated content be clearly labeled?",
  topicId: "ai-content-labels",
  bossId: "sloppy-salma",
  bossName: "Sloppy Salma",
  bossEmoji: "🧑🏾‍🍳",
  cardId: CARD,
  rootTarget: 4,
  playerSide: "plus",
  bossSide: "minus",
  banner:
    "Salma argues fast and leaves you guessing. Today you learn to ask, not to complain.",
  // Echoes sloppy-salma's habit in lib/progression/sample.ts. Fast and
  // careless rather than hostile (Nathan's script, "Salma's whole
  // behaviour"): a sentence that reads two ways, a word she never pins down,
  // one that simply does not parse, and she takes every correction well.
  bossHabit: "leaves you to guess what she meant",
  bossTip:
    "throw the card and hand back how you read the tile, instead of telling her it was unclear",
  learningGoals: [
    "You'll face Sloppy Salma, who leaves you guessing what she meant and then argues as if you had agreed to it.",
    "You'll learn why you cannot answer a reason you have not understood, and why asking is a move rather than a delay.",
    "And you'll earn the card that makes her say plainly what a word is doing before the two of you argue about it.",
  ],
  awards: {
    badges: ["help-me-understand-1", "help-me-understand-2"],
    cardId: CARD,
  },
  beats: [
    {
      kind: "pause",
      id: "p0-clarity",
      title: "Salma, and the words in between",
      body: "Salma is quick and careless rather than hostile, and she takes every correction well. Nothing on this board is going to be a lie. The trouble is going to be sentences you cannot quite pin down, which is a harder thing to notice than a false one.",
      button: "Let's go",
    },
    {
      kind: "boss",
      id: "salma-root-c",
      act: {
        kind: "tile",
        key: "C",
        parent: null,
        text: "No, because nearly every tool has AI in it somewhere now, so the label stops separating anything.",
      },
    },
    {
      kind: "boss",
      id: "salma-root-d",
      act: {
        kind: "tile",
        key: "D",
        parent: null,
        text: "No, because a label gets read as a warning, and the work gets judged before anyone looks at it.",
      },
    },
    {
      kind: "player",
      id: "player-root-a",
      coach:
        "Salma is against labeling. You are for it. Your first reason, off the topic.",
      nudge: "Off the topic. This one starts a thread of your own.",
      expect: {
        kind: "tile",
        key: "A",
        parent: null,
        suggestions: [
          "Yes, because people decide how much to trust something partly by knowing who made it.",
          "Yes, because a reader who knows how something was made can weigh it for themselves.",
        ],
      },
    },
    {
      kind: "player",
      id: "player-root-b",
      coach: "And your second. A different reason, its own thread.",
      nudge: "Off the topic again: your second thread, not an answer to your first.",
      expect: {
        kind: "tile",
        key: "B",
        parent: null,
        suggestions: [
          "Yes, because without labels the only people who pay a price are the ones who disclose honestly.",
          "Yes, because honesty shouldn't be the thing that costs you readers.",
        ],
      },
    },
    {
      kind: "boss",
      id: "salma-answers-a",
      act: {
        kind: "tile",
        key: "A1",
        parent: "A",
        text: "But people already judge trust by the source, and a label doesn't change who's publishing it.",
      },
    },
    {
      kind: "boss",
      id: "salma-answers-b",
      act: {
        kind: "tile",
        key: "B1",
        parent: "B",
        text: "But the ones who disclose are also the ones whose work is easiest to check.",
      },
    },
    {
      kind: "player",
      id: "player-answers-a1",
      coach: "Salma answered your first thread. Answer her, under her tile.",
      nudge: "Under Salma's tile in your first thread.",
      expect: { kind: "tile", key: "A2", parent: "A1", suggestions: [] },
    },
    {
      kind: "pause",
      id: "p1-a-question-is-not-a-move",
      title: "You can't argue with a question",
      bossSays: "Hmm, how would anyone even verify a label like that?",
      moderator:
        "That's a question, Salma. Your side of the board is for statements. What's the claim behind it?",
      bossReplies: "Fine. That there's no way to check one.",
      body: "That is a rule of the board, not a card. It applies to both of you and the moderator enforces it every time, so try it yourself and you will hear the same sentence. A question does not hand the other player anything to answer: there is no claim in it to agree or disagree with, so there is nothing for a tile to be. Which leaves a real problem. What do you do when their tile genuinely does not land? That is the card you are about to get.",
      button: "Got it",
    },
    {
      kind: "boss",
      id: "salma-restates-the-question",
      act: {
        kind: "tile",
        key: "A3",
        parent: "A2",
        text: "But there's no way to check whether a label is honest, so it's just a promise.",
      },
    },
    {
      kind: "pause",
      id: "p2-card-rung-1",
      title: "Help Me Understand",
      cardId: CARD,
      body: "The agreement: if I can't tell what a tile means, I won't say that it was unclear. I'll write out how I read it and hand it back. Throw the card, then type their tile back to them in your own words. They see your reading next to what they actually wrote, and that gap is the whole message. It tells them what to fix, which that was vague never does.",
      button: "Show me",
    },
    {
      kind: "player",
      id: "player-answers-d",
      coach:
        "Salma's warning-label thread has nothing from you in it yet. Answer her root.",
      nudge: "Under Salma's root about a label reading as a warning.",
      expect: { kind: "tile", key: "D1", parent: "D", suggestions: [] },
    },
    {
      kind: "boss",
      id: "salma-two-ways",
      act: {
        kind: "tile",
        key: "D2",
        parent: "D1",
        text: "But nobody wants their work labeled by a machine.",
      },
    },
    {
      kind: "player",
      id: "player-throws-1",
      coach:
        "Read that one twice. Does it mean a machine decides what gets flagged, or that the badge says a machine made it? Throw the card at it.",
      nudge: "It reads two ways, and she cannot see it. Throw the card.",
      badges: ["help-me-understand-1"],
      points: THROW_POINTS,
      expect: { kind: "throw", tile: "D2", cardId: CARD, rungId: "help_me_understand_1" },
      anchor: { tile: "D2" },
    },
    {
      kind: "player",
      id: "player-hands-back-a-reading",
      coach:
        "Now the other half. Type her tile back to her the way you read it, and hand it over. Do not tell her it was unclear, just show her where you landed.",
      nudge: "Open her tile and hand back a reading in your own words.",
      expect: {
        kind: "propose",
        proposal: "reading_handback",
        tile: "D2",
        suggestions: [
          "I read that as: creators don't want some automated system deciding what gets flagged.",
          "I read that as: creators don't want a stamp on work they made themselves.",
        ],
      },
      anchor: { tile: "D2" },
    },
    {
      kind: "boss",
      id: "salma-accepts-the-reading",
      bossSays:
        "Oh. That's not it at all, and that's on me. Reading mine back, it says both, doesn't it.",
      act: { kind: "accept", proposal: "reading_handback", tile: "D2" },
    },
    {
      kind: "boss",
      id: "salma-rewrites",
      act: {
        kind: "revise",
        tile: "D2",
        text: "But creators don't want a badge stamped on work they made themselves.",
      },
    },
    {
      kind: "pause",
      id: "p3-why-this-works",
      title: "Why that worked",
      body: "You never told her the sentence was bad. You showed her where a careful reader landed, and she fixed it herself in about four seconds. Try that was unclear on a real person some time and see how long it takes.",
      button: "Next",
      anchor: { tile: "D2" },
    },
    {
      kind: "pause",
      id: "p4-card-rung-2",
      title: "Define that",
      cardId: CARD,
      body: "Sometimes the sentence is built perfectly well and one word inside it was never pinned down. You do not hand back a reading for that. You stop at the word and ask what it has to mean.",
      button: "Show me",
    },
    {
      kind: "boss",
      id: "salma-authentic",
      act: {
        kind: "tile",
        key: "B2",
        parent: "B1",
        text: "But a label is worthless unless what's underneath it is actually authentic.",
      },
    },
    {
      kind: "player",
      id: "player-throws-2",
      coach:
        "That sentence is fine. One word in it is carrying the whole tile and neither of you has said what it means. Throw the card.",
      nudge: "Authentic. Everything in that tile depends on it. Throw the card.",
      badges: ["help-me-understand-2"],
      points: THROW_POINTS,
      expect: { kind: "throw", tile: "B2", cardId: CARD, rungId: "help_me_understand_2" },
      anchor: { tile: "B2" },
    },
    {
      kind: "player",
      id: "player-asks-for-a-definition",
      coach:
        "Now pin the word down. Name it, write what you think it has to mean here, and let her answer.",
      nudge: "Pin down a word: authentic, and what it would have to mean for this game.",
      expect: {
        kind: "propose",
        proposal: "definition",
        tile: null,
        suggestions: [
          "authentic: a person made the substantive choices, whatever tools they used to carry them out",
          "authentic: nobody used a generating tool at any point",
        ],
      },
    },
    {
      kind: "boss",
      id: "salma-accepts-the-definition",
      bossSays:
        "Fair. A person made the substantive choices, whatever tools they used to carry them out. That's what I meant.",
      act: { kind: "accept", proposal: "definition", tile: null },
    },
    {
      kind: "pause",
      id: "p5-it-binds-now",
      title: "It binds now",
      body: "That definition is pinned to the edge of the board, and it stays there. Neither of you gets to quietly switch it later, which is what makes asking worth doing rather than just polite.",
      button: "Next",
    },
    {
      kind: "boss",
      id: "salma-mangled",
      act: {
        kind: "tile",
        key: "C1",
        parent: "C",
        text: "But labels that people ignore them anyway doesn't help who it's for.",
      },
    },
    {
      kind: "player",
      id: "player-throws-3",
      coach: "Salma's turn in her own thread.",
      nudge: "Did that one land for you? Be honest.",
      points: THROW_POINTS,
      expect: { kind: "throw", tile: "C1", cardId: CARD, rungId: "help_me_understand_1" },
      anchor: { tile: "C1" },
    },
    {
      kind: "player",
      id: "player-hands-back-a-reading-again",
      coach: "Same move. Hand her back what you think she was reaching for.",
      nudge: "A reading, in your words, handed back.",
      expect: {
        kind: "propose",
        proposal: "reading_handback",
        tile: "C1",
        suggestions: [
          "I read that as: a label that people scroll past doesn't help the person it was meant to protect.",
          "I think you mean the label only helps if someone actually reads it.",
        ],
      },
      anchor: { tile: "C1" },
    },
    {
      kind: "boss",
      id: "salma-accepts-the-second-reading",
      bossSays: "Yes, that's exactly what I meant, and you wrote it better than I did.",
      act: { kind: "accept", proposal: "reading_handback", tile: "C1" },
    },
    {
      kind: "boss",
      id: "salma-rewrites-again",
      act: {
        kind: "revise",
        tile: "C1",
        text: "But a label only helps if the person it was meant to protect actually reads it.",
      },
    },
    {
      kind: "pause",
      id: "p6-same-card-different-failure",
      title: "Same card, different failure",
      body: "That one was not ambiguous, it was just broken. Same card, same move, hand back a reading. You did not need me to tell you which rung it was, and you will not in a real game either.",
      button: "Play it out",
      anchor: { tile: "C1" },
    },
    {
      kind: "player",
      id: "player-answers-c1",
      coach: "Answer the tile she just fixed, in her own thread.",
      nudge: "Under Salma's rewritten tile about labels people scroll past.",
      expect: { kind: "tile", key: "C2", parent: "C1", suggestions: [] },
    },
    {
      kind: "boss",
      id: "salma-token-a",
      bossSays: "All right. Knowing who made a thing does change how I read it.",
      act: { kind: "token", thread: "A", emoji: "👍" },
    },
    {
      kind: "player",
      id: "player-token-a",
      coach: "Salma has conceded your first thread. Put your 👍 down to match.",
      nudge: "👍 on your first thread, the one about trust.",
      expect: { kind: "token", thread: "A", emoji: "👍" },
      anchor: { tile: "A" },
    },
    {
      kind: "player",
      id: "player-token-b",
      coach:
        "Your second thread now runs on the word you two pinned down, and you still weigh the cost of disclosing differently. Propose 👀 there.",
      nudge: "👀 on your second thread, the one about honest disclosers.",
      expect: { kind: "token", thread: "B", emoji: "👀" },
      anchor: { tile: "B" },
    },
    {
      kind: "boss",
      id: "salma-token-b",
      act: { kind: "token", thread: "B", emoji: "👀" },
    },
    {
      kind: "player",
      id: "player-token-c",
      coach:
        "Her thread about labels nobody reads. You two ended up agreeing. Propose 👍.",
      nudge: "👍 on Salma's thread about labels people scroll past.",
      expect: { kind: "token", thread: "C", emoji: "👍" },
      anchor: { tile: "C" },
    },
    {
      kind: "boss",
      id: "salma-token-c",
      act: { kind: "token", thread: "C", emoji: "👍" },
    },
    {
      kind: "boss",
      id: "salma-token-d",
      bossSays: "We just want different things from a badge. That's not a fact question.",
      act: { kind: "token", thread: "D", emoji: "👀" },
    },
    {
      kind: "player",
      id: "player-token-d",
      coach: "Last one. Match her 👀 and the board is done.",
      nudge: "👀 on Salma's warning-label thread.",
      expect: { kind: "token", thread: "D", emoji: "👀" },
      anchor: { tile: "D" },
    },
    { kind: "win", id: "win" },
  ],
};
