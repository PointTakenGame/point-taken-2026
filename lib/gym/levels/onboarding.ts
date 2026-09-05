import type { Level } from "../script";

/**
 * Level 1, Onboarding: Should a hot dog be called a sandwich?
 *
 * Rewritten by Steve, 2026-09-05, from his own level 1 playthrough. Two
 * thread starters, one for each side, Bob's root first (unchanged from the
 * earlier ordering). What changed is everything downstream of that: the
 * second-thread pause is gone, a rule-card-vocabulary pause used to speak
 * before the player had ever seen the board move, and two new pauses teach
 * the board's own chrome (moving around, ways to win) at the moments that
 * chrome actually turns useful instead of all at once up front.
 *
 * `hiddenSurfaces` keeps the ways-to-win card and the rule-card tray out of
 * sight until this script itself reveals them (`p4b-ways-to-win`,
 * `p5-first-card`): a level 1 player has not earned either idea yet, and
 * showing the chrome before the concept invites the "why is that there"
 * question the level answers a few beats later anyway. `cooked: true` locks
 * the tutorial down further (see the field's doc in ../script.ts): the
 * player only ever places the one suggestion this script hands them.
 *
 * Thread A is Bob's own root. The player answers it once, and Bob agrees
 * outright rather than arguing back, demonstrating Agree to agree before the
 * player ever has to use it themselves. Two tiles, both tokens, done.
 *
 * Thread B is the player's own root. Bob's first reply breaks "You" is
 * Taboo, which is where the card is taught and thrown. Bob rewrites the
 * tile, the player answers the rewrite, and Bob replies once more without
 * conceding. Neither of them moved, so it closes on Agree to disagree, four
 * tiles total. Every reply on this thread argues the same point the
 * player's own root opened with (nobody ordering a sandwich expects a hot
 * dog): a 2026-09 playtest note flagged an earlier draft's reply drifting
 * off its thread's root, which is the one rule threads have.
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
  // Steve, 2026-09-05: keep the ways-to-win card and the rule-card tray out
  // of sight until the beats that explain them reveal them.
  hiddenSurfaces: ["ways-to-win", "card-tray"],
  cooked: true,
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
      title: "Reason tiles",
      body: "When the game starts, each player gives their best reason for their side. Bob says yes to the topic question, so he put his best reason here. Your turn.",
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
        "Start your first thread by putting your best reason why a hot dog isn't a sandwich.\n\nOnce you click here, I'll write one for you to get you started. Just hit Place.",
      nudge: "That one goes here, under the topic.",
      expect: {
        kind: "tile",
        key: "B",
        parent: null,
        suggestions: [
          "No, because nobody who orders a sandwich would ever be handed a hot dog.",
        ],
      },
      anchor: { slot: { parent: "topic", corner: "sw" } },
    },
    {
      kind: "player",
      id: "player-answers-a",
      coach:
        "Once each player has their main reasons on the board, they reply to each other's reasons. Give a reply to Bob's reason in the highlighted spot connected to his first tile. Just click and I'll give you some text to start you out.",
      nudge: "Here, under Bob's tile, the one at the top of his thread.",
      expect: {
        kind: "tile",
        key: "A1",
        parent: "A",
        suggestions: [
          "But a bun is one hinged piece of bread, and a sandwich needs two.",
        ],
      },
      // Forced bottom-right rather than left to the board's own layout: at
      // this point in the level a corner still reads as "the spot", not yet
      // as one of several a thread could grow into. Steve, 2026-09-05:
      // "let's not introduce the idea that threads can vary in their
      // spatial location yet."
      anchor: { slot: { parent: "A", corner: "se" } },
    },
    {
      kind: "pause",
      id: "p3-tiles-answer-tiles",
      title: "Tiles answer tiles",
      body: "You answered Bob. We're making a threaded discussion.",
      button: "Got it",
      anchor: { tile: "A1" },
    },
    {
      // Placed here, right after the player's first reply, rather than after
      // Bob's second tile as Steve suggested when he asked for this hint: a
      // player who has just placed one tile still has both hands free to
      // explore the board, where placing it after bob-violation would land
      // the same beat over the "you" attack, the level's actual tension
      // point. Noted here as a deliberate placement choice, not a stray beat.
      kind: "pause",
      id: "p3b-move-the-board",
      title: "Moving around",
      body: "Grab anywhere on the board to move it. Or use these controls: the arrows move the board, the magnifiers zoom, and the last button fits the whole board on screen.",
      button: "Got it",
      anchor: { ui: "nav-controls" },
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
      body: "Wow, congrats. You convinced Bashful Bob that he can agree to agree on this reason. That's generous of him. Putting a 👍 on a root reason tile shows that while you may not agree on the topic in general, you can agree that you've reached a consensus on this one thread.",
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
      kind: "pause",
      id: "p4b-ways-to-win",
      title: "Ways to win",
      body: "Look: your 👍 just landed on this board. Close the other thread too and you and Bob win the game together.",
      button: "Got it",
      reveal: ["ways-to-win"],
      anchor: { ui: "ways-to-win" },
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
      id: "p5-hold-up",
      title: "Hold up",
      body: "Stop. Bob just made this about you, not about the hot dog. There's something you can do about it.",
      button: "Next",
      // Held back so the coach visibly reads Bob's violation before
      // speaking, rather than jumping on it the instant the tile lands.
      delayMs: 2500,
      anchor: { tile: "B1" },
    },
    {
      kind: "pause",
      id: "p5-first-card",
      cardId: "you_is_taboo",
      title: "Your first rule card",
      body: "This is a rule card: 'You' is taboo. Click the card, then click Bob's tile that broke it.",
      button: "Got it",
      reveal: ["card-tray"],
      anchor: { ui: "card-tray" },
    },
    {
      kind: "player",
      id: "player-throws",
      coach: "Click the card, then click the tile.",
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
      title: "Rule cards keep your discussion calm and rational",
      body: "After you flagged this rule card violation, Bob rewrote his tile to remove the personal attack. I think you'll agree that this way of discussing a topic is far more productive.",
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
        // Stays on B's own root point (nobody ordering a sandwich expects a
        // hot dog), the same claim player-root-b's suggestion opened with,
        // rather than drifting onto a new argument about memory.
        suggestions: [
          "Still, nobody ordering a sandwich expects to be handed a hot dog either way.",
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
        "I think you two just see the world differently, and it's time to wrap this thread up and agree to disagree. Click this root tile and choose the 👀 side-eye.",
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
