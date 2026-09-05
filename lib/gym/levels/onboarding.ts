import type { Level } from "../script";

/**
 * Level 1, Onboarding: Should a hot dog be called a sandwich?
 *
 * Structure ruled by Steve, 2026-09-05, replacing every earlier ordering of
 * this level: two thread starters, one for each side, Bob's root first.
 *
 * Thread A is Bob's own root. The player answers it once, and Bob agrees
 * outright rather than arguing back, demonstrating Agree to agree before the
 * player ever has to use it themselves. Two tiles, both tokens, done.
 *
 * Thread B is the player's own root. Bob's first reply breaks "You" is
 * Taboo, which is where the card is taught and thrown. Bob rewrites the
 * tile, the player answers the rewrite, and Bob replies once more without
 * conceding. Neither of them moved, so it closes on Agree to disagree, four
 * tiles total.
 *
 * The level ends there: two threads, both closed, one of each token shown
 * once. Bob is Plus, the player is Minus.
 */

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
  // Both roots go down before anything hangs off either (lib/board/rules.ts,
  // canPlaceTile's root stage): Bob's root and the player's root are both
  // beats 2 and 4 below, and nothing replies to either until both are on the
  // board. Two, not one, since 2026-09-05: the level now opens with a root
  // from each side rather than playing the player's own thread out alone
  // first.
  rootTarget: 2,
  playerSide: "minus",
  bossSide: "plus",
  banner: "Two threads. Place a tile, close a thread, throw one card.",
  // Echoes bashful-bob's habit in lib/progression/sample.ts. His whole
  // behaviour is one nervous deflection: he answers a reason with a comment
  // about the player instead of about the hot dog.
  bossHabit: "talks about you instead of the question",
  bossTip:
    "when a reason turns into a comment about you instead of about the topic, throw the card at that tile",
  awards: { badges: ["finish-one-game"], cardId: "you_is_taboo" },
  beats: [
    {
      kind: "pause",
      id: "p1-board",
      title: "The board",
      body: "You're Minus: a hot dog is not a sandwich. Bob's Plus, he thinks it is. He goes first.",
      button: "Got it",
    },
    {
      kind: "boss",
      id: "bob-root-a",
      act: {
        kind: "tile",
        key: "A",
        parent: null,
        text: "Yes, because a hot dog is a filling served inside bread, and that's what a sandwich is.",
      },
    },
    {
      kind: "pause",
      id: "p2-reason-tile",
      title: "What a reason tile is",
      body: "That's a reason tile. A short claim supporting one side, and it starts a thread. One idea per tile. If you've got two, that's two tiles. Your turn.",
      button: "Got it",
      anchor: { tile: "A" },
    },
    {
      kind: "player",
      id: "player-root-b",
      // Level 1 only has the two bottom spots under the topic tile, so the
      // instruction is just "start your own thread", not a description of
      // where the spot is. The sample is typed into the box after the click,
      // never drawn in the slot beforehand, so there is nothing to "pick"
      // here.
      coach:
        "Start your first thread: why a hot dog isn't a sandwich. I wrote you a sample, change any of it.",
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
      id: "p2b-second-thread",
      title: "Your own thread",
      body: "That's your own reason, a second thread under the topic, next to Bob's. Two threads now, and both have to close before the game ends.",
      button: "My turn",
      anchor: { tile: "B" },
    },
    {
      kind: "player",
      id: "player-answers-a",
      coach: "Answer Bob's reason, at the top of his thread.",
      nudge: "Here, under Bob's tile, the one at the top of his thread.",
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
      kind: "pause",
      id: "p3-tiles-answer-tiles",
      title: "Tiles answer tiles",
      body: "You answered Bob. A 'Hmm...' tile goes directly under the tile it argues with. That column is a thread. Everything in a thread has to be about the tile at the top of it. That's the one rule about threads, and it's most of the game.",
      button: "Got it",
      anchor: { tile: "A1" },
    },
    {
      kind: "boss",
      id: "bob-token-a",
      // Bob agrees outright rather than writing another tile. This is what
      // demonstrates Agree to agree: he changed his mind, so the thread
      // closes at two tiles instead of growing another rung.
      bossSays: "You're right, I hadn't thought of that.",
      act: { kind: "token", thread: "A", emoji: "👍" },
    },
    {
      kind: "pause",
      id: "p4-agree-to-agree",
      title: "Agree to agree",
      body: "A thread closes when you both put the same token on it. 👍 Agree to agree: he changed his mind. Bob's put his down, put yours next to it.",
      button: "Got it",
      anchor: { tile: "A" },
    },
    {
      kind: "player",
      id: "player-token-a",
      coach: "Put your 👍 down and the thread closes.",
      nudge: "Bob's 👍 is on this thread, waiting for yours.",
      badges: ["resolve-first-thread"],
      expect: { kind: "token", thread: "A", emoji: "👍" },
      anchor: { tile: "A" },
    },
    {
      kind: "boss",
      id: "bob-violation",
      act: {
        kind: "tile",
        key: "B1",
        parent: "B",
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
      anchor: { tile: "B1" },
    },
    {
      kind: "player",
      id: "player-throws",
      coach: "Throw it.",
      nudge: "Hang on. Read Bob's last tile again. Is it about the hot dog?",
      // No points at level 1. The badge is the whole reward, and a first
      // throw that scores would teach the opposite of what the card is for.
      badges: ["call-broken-rule"],
      expect: { kind: "throw", tile: "B1", cardId: "you_is_taboo", rungId: null },
    },
    {
      kind: "boss",
      id: "bob-revises",
      act: {
        kind: "revise",
        tile: "B1",
        text: "But the ballpark version of this argument is about memory, not about what the food is.",
      },
    },
    {
      kind: "pause",
      id: "p6-what-a-card-does",
      title: "What a card actually does",
      body: "The card didn't delete anything. Bob rewrote the tile without the 'you' in it and the argument survived. That's the whole point. His reason was fine. The way he aimed it wasn't.",
      button: "Got it",
      anchor: { tile: "B1" },
    },
    {
      kind: "player",
      id: "player-answers-b1",
      coach: "Answer Bob back, right under his tile.",
      nudge: "Under Bob's tile, right there.",
      expect: {
        kind: "tile",
        key: "B2",
        parent: "B1",
        suggestions: [
          "Fine, forget memory: it's still one piece of bread, not two.",
          "It's not about memory. Nobody doubts a hoagie is a sandwich either.",
        ],
      },
    },
    {
      kind: "boss",
      id: "bob-replies-again",
      // His one violation already happened at bob-violation. This tile
      // restates his side without conceding and without "you" anywhere in
      // it: neither of them is moving, which is what makes the thread end
      // on Agree to disagree rather than Agree to agree.
      act: {
        kind: "tile",
        key: "B3",
        parent: "B2",
        text: "Maybe, but a name can outlast its own history. I still think it's a sandwich.",
      },
    },
    {
      kind: "player",
      id: "player-token-b",
      coach:
        "You're not going to agree on this one. 👀 Agree to disagree: neither of you has to move, and it still closes the thread.",
      nudge:
        "Propose 👀 on your own thread. Neither of you has to change your mind for it to close.",
      expect: { kind: "token", thread: "B", emoji: "👀" },
      anchor: { tile: "B" },
    },
    {
      kind: "pause",
      id: "p7-ask-for-confirm",
      title: "Ask for the confirm",
      bossSays: "...sorry. I don't like to assume.",
      body: "He won't place his until you ask. Agreement gets asked for, not assumed.",
      button: "Ask Bob to confirm",
      anchor: { tile: "B" },
    },
    {
      kind: "boss",
      id: "bob-token-b",
      act: { kind: "token", thread: "B", emoji: "👀" },
    },
    { kind: "win", id: "win", badges: ["finish-one-game"] },
  ],
};
