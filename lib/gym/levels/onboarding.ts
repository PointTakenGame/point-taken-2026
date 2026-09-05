import type { Level } from "../script";

/**
 * Level 1, Onboarding: Should a hot dog be called a sandwich?
 *
 * Beats and lines are the implementation guide's, section 4
 * (docs/reference/materials/spec/2026-08-22_gym-levels-1-4-implementation-guide.md),
 * with the coach and avatar pick (L1.0) and the agreement (L1.1) handled by
 * the lobby before the board exists, and the topic (L1.2) placed by
 * startLevel. Bob is Plus, the player is Minus. Two threads, both must
 * resolve; the win floor is per game and this one is two (BIZ-T260824-11).
 *
 * Order, since the 2026-09-04 reorder (Steve's playtest: the player opens,
 * then answers Bob): the player's root B, Bob's reply B1, the player's B2,
 * then Bob's own root A, the player's A1, Bob's 👍 on B, the player's match,
 * Bob's violation A3 under A1, the throw, his revision, 👀 on A. Nathan's
 * beat sheet has Bob open and a second Bob reply in thread A; both went
 * with the reorder, and nothing else of his moved.
 *
 * Bob never volunteers a token and commits one violation, at A3. That is
 * the whole level: place a tile, close a thread, throw one card, finish.
 */

/**
 * Nathan's Revision 2 of the level script (inbox/point-taken-levels-1-4.md)
 * writes the hoagie reason twice; since 2026-09-04 only the first use
 * survives, the structural branch of Bob's answer in the player's thread.
 * His second, shorter one lived in a Bob reply that the reorder removed.
 *
 * The line lost its tail on 2026-09-04. As he wrote it ("nobody has ever
 * doubted a hoagie is a sandwich") it came to 101 characters, one over
 * TILE_MAX_CHARS, and a boss tile that long only reaches the board because
 * bossAct never asks canPlaceTile. Shortened to "nobody doubts", which is the
 * same sentence. See placeable.test.ts, which now fails on any line that will
 * not fit the box it goes in.
 */
const HOAGIE_EXACTLY =
  "But a hoagie roll is hinged exactly the same way, and nobody doubts a hoagie is a sandwich.";
const MENUS =
  "But menus list burgers apart from sandwiches too, and a burger is a sandwich. Menus aren't the test.";

/** The player went structural (bread, bun, hinge) rather than social (menus, orders). */
function structural(text: string | null): boolean {
  return /\b(bun|bread|slice|hinge|hinged|cut)\b/i.test(text ?? "");
}

export const ONBOARDING: Level = {
  id: "onboarding",
  number: 1,
  title: "Onboarding",
  topic: "Should a hot dog be called a sandwich?",
  topicId: "hot-dog-sandwich",
  bossId: "bashful-bob",
  bossName: "Bashful Bob",
  bossEmoji: "🧑🏻‍💼",
  cardId: "you_is_taboo",
  // One root before anything may hang off another (lib/board/rules.ts,
  // canPlaceTile's root stage). The level still has two threads: the player's
  // B gets a whole exchange before Bob opens A, and a second root is always
  // allowed once the stage is over. Two here would refuse Bob's first reply.
  rootTarget: 1,
  playerSide: "minus",
  bossSide: "plus",
  banner: "Two threads. Place a tile, close a thread, throw one card.",
  // Echoes bashful-bob's habit in lib/progression/sample.ts. His whole
  // behaviour per Nathan's script (inbox/point-taken-levels-1-4.md, L1.11) is
  // one nervous deflection: he answers a reason with a comment about the
  // player instead of about the hot dog.
  bossHabit: "talks about you instead of the question",
  bossTip:
    "when a reason turns into a comment about you instead of about the topic, throw the card at that tile",
  awards: { badges: ["finish-one-game"], cardId: "you_is_taboo" },
  beats: [
    {
      kind: "pause",
      id: "p1-board",
      title: "The board",
      body: "Topic sits in the middle, everything else hangs off it. You're the Minus side, you think a hot dog is not a sandwich. That's Bob over there. He thinks it is. You go first.",
      button: "Got it",
    },
    {
      kind: "player",
      id: "player-root-b",
      // The player opens the board, not Bob (Steve, 2026-09-04 playtest: "have
      // the player put their first tile down before Bashful Bob does"). Level
      // 1 only has the two bottom spots under the topic tile, so the
      // instruction is just "click here", not a description of where the
      // spot is. The sample is typed into the box after the click, never
      // drawn in the slot beforehand, so there is nothing to "pick" here.
      coach:
        "Click here, under the topic, and start the first thread: why a hot dog is not a sandwich. I'll write you a sample. Change any of it.",
      nudge: "That one goes here, under the topic.",
      expect: {
        kind: "tile",
        key: "B",
        parent: null,
        suggestions: [
          "No, because nobody who orders a sandwich would ever be handed a hot dog.",
          "No, because a bun is one piece of bread that's been cut, not two slices.",
        ],
      },
      anchor: { slot: { parent: "topic", corner: "sw" } },
    },
    {
      kind: "pause",
      id: "p2-reason-tile",
      title: "What a reason tile is",
      body: "That's a reason tile. A short claim supporting one side, and it starts a thread. One idea per tile. If you've got two, that's two tiles. Bob's turn.",
      button: "Got it",
      anchor: { tile: "B" },
    },
    {
      kind: "boss",
      id: "bob-answers-b",
      act: {
        kind: "tile",
        key: "B1",
        parent: "B",
        text: (ctx) => (structural(ctx.textOf("B")) ? HOAGIE_EXACTLY : MENUS),
      },
    },
    {
      kind: "pause",
      id: "p3-tiles-answer-tiles",
      title: "Tiles answer tiles",
      body: "Bob answered you. A 'Hmm...' tile goes directly under the tile it argues with. That column is a thread. Everything in a thread has to be about the tile at the top of it. That's the one rule about threads, and it's most of the game.",
      button: "My turn",
      anchor: { tile: "B1" },
    },
    {
      kind: "player",
      id: "player-answers-b1",
      // The player's second move answers Bob's reply, in their own thread
      // (Steve, 2026-09-04: "then have them reply to Bob next").
      coach:
        "Click here and answer Bob back. Your 'Hmm...' goes directly under his tile, in your thread.",
      nudge: "Here, under Bob's tile in your thread, the one that starts with 'Hmm'.",
      expect: {
        kind: "tile",
        key: "B2",
        parent: "B1",
        suggestions: [
          "But a burger has its own name for the same reason: a specific enough food earns its own name.",
          "But food categories are about how people use the word, not about geometry.",
        ],
      },
    },
    {
      kind: "boss",
      id: "bob-root-a",
      // Bob's own thread opens only now, once the player has a whole exchange
      // behind them. It has to exist before thread B closes: the engine ends
      // a game the moment every live thread is resolved (lib/board/rules.ts,
      // threadsWinReached), so a one-thread board that resolved would be a
      // finished level with half its script unplayed.
      bossSays: "...I should put my own reason down too.",
      act: {
        kind: "tile",
        key: "A",
        parent: null,
        text: "Yes, because a hot dog is a filling served inside bread, and that's what a sandwich is.",
      },
    },
    {
      kind: "pause",
      id: "p2b-bobs-thread",
      title: "Bob's thread",
      body: "That's Bob's own reason, not a reply to yours, so it starts a second thread under the topic. Two threads on the board now, and both have to close before the game ends.",
      button: "My turn",
      anchor: { tile: "A" },
    },
    {
      kind: "player",
      id: "player-answers-a",
      coach:
        "Click here and answer Bob's reason. Your 'Hmm...' goes directly under his tile, at the top of his thread.",
      nudge: "Hang it here, under Bob's tile, the one at the top of his thread.",
      expect: {
        kind: "tile",
        key: "A1",
        parent: "A",
        suggestions: [
          "But a bun is hinged, that's one piece of bread, not two.",
          "But a sandwich has to still work when you lay it flat, and a hot dog doesn't.",
        ],
      },
      // No hand-written anchor: the director points at whichever of A's
      // diagonals the board's own layout offers next, which is the same cell
      // the click will land in. A corner written here by hand went stale the
      // first time the placement order changed.
    },
    {
      kind: "boss",
      id: "bob-token-b",
      bossSays:
        "...oh. That one you put in your own thread actually got me. The specific name winning is better than what I had.",
      act: { kind: "token", thread: "B", emoji: "👍" },
    },
    {
      kind: "pause",
      id: "p4-two-tokens",
      title: "The two tokens",
      // "the same token on the same thread" is not a slip for "on the same
      // tile". A token in this codebase is proposed on a thread, never on a
      // tile (lib/board/rules.ts), so the thread is the thing both players are
      // putting a mark on. Nathan's script says the same; left as written.
      body: "Two ways a thread can end. 👍 Point taken: the other person actually changed your mind. 👀 Now I see why we disagree: neither of you moved, but you found the reason underneath it. A thread closes when you both put the same token on the same thread. Bob's put the first 👍 down on your thread. Put yours next to it.",
      button: "Got it",
      anchor: { tile: "B" },
    },
    {
      kind: "player",
      id: "player-token-b",
      coach:
        "Bob's 👍 is down on your thread, waiting for yours. Put yours next to it and the thread closes.",
      nudge:
        "Not there yet. Bob's 👍 is sitting on YOUR thread, the left one, waiting for a match. Put a 👍 on that thread and it closes. Bob's own thread comes after.",
      badges: ["resolve-first-thread"],
      expect: { kind: "token", thread: "B", emoji: "👍" },
      anchor: { tile: "B" },
    },
    {
      kind: "boss",
      id: "bob-violation",
      act: {
        kind: "tile",
        key: "A3",
        parent: "A1",
        text: "But you only think that because you grew up eating them at ballparks. That's nostalgia, not a rule.",
      },
    },
    {
      kind: "pause",
      id: "p5-first-card",
      title: "Your first rule card",
      cardId: "you_is_taboo",
      body: "That card is yours now. Something on the board breaks it. Throw the card at that tile.",
      button: "Show me",
      anchor: { tile: "A3" },
    },
    {
      kind: "player",
      id: "player-throws",
      coach: "Something on the board breaks the rule on that card. Throw it at the tile.",
      nudge: "Hang on. Read Bob's last tile again. Is it about the hot dog?",
      // No points at level 1. Nathan's Revision 2 awards the badge and
      // nothing else here, and a first throw that scores would teach the
      // opposite of what the card is for.
      badges: ["call-broken-rule"],
      expect: { kind: "throw", tile: "A3", cardId: "you_is_taboo", rungId: null },
    },
    {
      kind: "boss",
      id: "bob-revises",
      act: {
        kind: "revise",
        tile: "A3",
        text: "But the ballpark version of this argument is about memory, not about what the food is.",
      },
    },
    {
      kind: "pause",
      id: "p6-what-a-card-does",
      title: "What a card actually does",
      body: "The card didn't delete anything. Bob rewrote the tile without the 'you' in it and the argument survived. That's the whole point. His reason was fine. The way he aimed it wasn't.",
      button: "Got it",
      anchor: { tile: "A3" },
    },
    {
      kind: "player",
      id: "player-token-a",
      coach:
        "You two are not going to agree about what the word 'sandwich' means. Close it out: 👀 on Bob's thread, the one that explains the disagreement.",
      nudge: "That thread isn't going to move either of you. 👀 on Bob's thread.",
      expect: { kind: "token", thread: "A", emoji: "👀" },
      anchor: { tile: "A" },
    },
    {
      kind: "pause",
      id: "p7-ask-for-confirm",
      title: "Ask for the confirm",
      bossSays: "...sorry. I don't like to assume.",
      body: "He won't place his until you ask him to. Agreement gets asked for, not assumed. True here, and very true with a real person.",
      button: "Ask Bob to confirm",
      anchor: { tile: "A" },
    },
    {
      kind: "boss",
      id: "bob-token-a",
      act: { kind: "token", thread: "A", emoji: "👀" },
    },
    { kind: "win", id: "win", badges: ["finish-one-game"] },
  ],
};
