import type { Level } from "../script";
import { THROW_POINTS } from "@/lib/progression/sample";

/**
 * Level 2, Ground rules: Should we stop changing the clocks twice a year?
 *
 * The player is Plus (stop), Rosa is Minus (keep it). Four threads: A and B
 * are the player's, on the right, C and D are Rosa's, on the left. The card
 * is Stick to the Thread's Root.
 *
 * Rewritten by Steve, 2026-09-07, from his own playthrough. The old script
 * put nine tiles on the board before the card appeared and then ran the
 * card's three rungs back to back, which is where he stopped reading. His
 * instruction was to reach the card faster, to keep the card out of sight
 * until it is relevant, and to introduce it exactly the way level 1
 * introduces "You" is Taboo: the offending tile lands first, a pause names
 * what went wrong, and only then does the tray open.
 *
 * So the card now arrives with six tiles on the board: four roots, one
 * player reply, and Rosa's sixth tile. It is taught once in each direction.
 *
 * - Rosa answers the player's tile on her own side, but hangs her answer in
 *   the player's crash thread, where it says nothing about crashes. The
 *   player throws the card and moves it under the tile it was actually
 *   arguing with.
 * - Then the coach hands the player a reason for Rosa's schedules thread
 *   that is really about their own energy thread, and Rosa says so. The
 *   player moves their own tile. Getting caught is the point of this half;
 *   the sample text is off-root deliberately.
 *
 * Nothing is deleted in either direction, which is the whole lesson: a good
 * reason in the wrong thread is moved, not thrown away.
 *
 * Rung id `stick_to_root_1` is the one throw. Two badges, not three:
 * `stick-to-root-2` ("caught a restatement dressed as a new reason") was
 * earned by a rung this rewrite cut, so it is no longer awarded here. It
 * still exists in lib/progression/sample.ts and is free for a later level.
 *
 * Departure from Nathan's Revision 2 (inbox/point-taken-levels-1-4.md),
 * carried over from the previous draft: L2.3 asks the player to fold a
 * thread, the board has no fold gesture yet (compact mode is P1, Steve
 * 2026-09-03), so there is no fold beat and the `compression` badge is not
 * awarded. It comes back when compact mode ships. The three-rung structure
 * his script describes is the larger departure, and it is Steve's call
 * above, made against a played build.
 */

const CARD = "stick_to_root";

export const GROUND_RULES: Level = {
  id: "ground_rules",
  number: 2,
  title: "Ground rules",
  topic: "Should we stop changing the clocks twice a year?",
  topicId: "clock-changes",
  bossId: "rambling-rosa",
  bossName: "Rambling Rosa",
  bossEmoji: "🧑🏽‍🔧",
  cardId: CARD,
  // The standard four, which is what the opening pause tells the player a
  // normal game looks like. Rosa opens C and D, the player opens A and B.
  rootTarget: 4,
  playerSide: "plus",
  bossSide: "minus",
  banner: "Four threads this time, two reasons from each of you. That's a standard game.",
  // Echoes rambling-rosa's habit in lib/progression/sample.ts.
  bossHabit: "wanders off the thread's root",
  bossTip:
    "check every tile against the root at the top of its thread, and throw the card the moment one stops answering it",
  learningGoals: [
    "You'll play a proper four-thread game against Rambling Rosa, which is what a normal match looks like.",
    "Rosa answers whatever she feels like answering, wherever she feels like putting it, and this is the level where you stop letting her.",
    "You'll earn the card that keeps every reason under the point it is actually arguing with, and you'll get caught by it once yourself.",
  ],
  // Same reason as level 1: the tray stays out of sight until the beat that
  // explains the card reveals it. Ways to Win is not hidden here, level 1
  // already taught it.
  hiddenSurfaces: ["card-tray"],
  awards: {
    badges: ["stick-to-root-1", "stick-to-root-3"],
    cardId: CARD,
  },
  beats: [
    {
      kind: "pause",
      id: "p1-four-threads",
      title: "Four threads, and points",
      body: "Two reasons from each of you this time, four threads is the normal game.\n\nAnd there's a score now. You'll get points for catching Rosa with a card, and only for that. Nothing you write scores; catching does.",
      button: "Got it",
      anchor: { tile: "topic" },
    },
    {
      kind: "boss",
      id: "rosa-root-c",
      act: {
        kind: "tile",
        key: "C",
        parent: null,
        text: "No, because long summer evenings are what make after-work life possible for most people.",
      },
    },
    {
      kind: "boss",
      id: "rosa-root-d",
      act: {
        kind: "tile",
        key: "D",
        parent: null,
        text: "No, because we'd have to renegotiate every schedule we share with countries that keep it.",
      },
    },
    {
      kind: "player",
      id: "player-root-a",
      coach:
        "Rosa has put two reasons down on her side. Your first: one reason to stop changing the clocks.",
      nudge: "Hang it off the topic. This one starts a thread of your own.",
      expect: {
        kind: "tile",
        key: "A",
        parent: null,
        suggestions: [
          "Yes, because the spring change brings a real spike in car crashes and heart attacks right after.",
          "Yes, because the week after the change, everyone I know is useless.",
        ],
      },
    },
    {
      kind: "player",
      id: "player-root-b",
      coach: "And your second. A different reason, its own thread.",
      nudge:
        "Off the topic again: this is your second thread, not an answer to your first.",
      expect: {
        kind: "tile",
        key: "B",
        parent: null,
        suggestions: [
          "Yes, because the energy savings it was invented for have basically disappeared.",
          "Yes, because we're keeping a wartime measure for reasons nobody can state.",
        ],
      },
    },
    {
      kind: "player",
      id: "player-answers-c",
      coach: "Now answer one of Rosa's. Her evenings reason is the one to take on.",
      nudge: "Under Rosa's evenings root, on her side of the board.",
      expect: {
        kind: "tile",
        key: "C1",
        parent: "C",
        suggestions: [
          "But we could keep summer hours all year round and stop switching, and the evenings stay.",
          "But that's an argument for light in the evening, not for moving the clocks twice.",
        ],
      },
    },
    {
      kind: "boss",
      id: "rosa-off-root",
      // Rosa's answer to C1, hung in the player's crash thread instead. It is
      // a fair reply to what the player just wrote and says nothing at all
      // about crashes, which is the whole case this card is for.
      act: {
        kind: "tile",
        key: "A1",
        parent: "A",
        text: "But year-round summer hours would mean the sun coming up after nine all winter.",
      },
    },
    {
      kind: "pause",
      id: "p2-hold-up",
      title: "Hold up",
      body: "Rosa just answered the tile you wrote over on her side. She put her answer in your crash thread.\n\nRead it against the tile at the top of that thread. It says nothing about crashes.",
      button: "Next",
      anchor: { tile: "A1" },
    },
    {
      kind: "pause",
      id: "p3-first-card",
      cardId: CARD,
      title: "Your second rule card",
      body: "This is a rule card: Stick to the Thread's Root. Every tile in a thread has to answer the tile at the top of it.\n\nClick the card, then click Rosa's tile.",
      button: "Got it",
      reveal: ["card-tray"],
      anchor: { ui: "card-tray" },
    },
    {
      kind: "player",
      id: "player-throws",
      coach: "Click the card, then click Rosa's tile.",
      nudge:
        "Hang on. Read the tile at the top of that thread again. Is Rosa's tile answering it?",
      badges: ["stick-to-root-1"],
      points: THROW_POINTS,
      expect: { kind: "throw", tile: "A1", cardId: CARD, rungId: "stick_to_root_1" },
      anchor: { tile: "A1" },
    },
    {
      kind: "player",
      id: "player-relocates",
      coach:
        "Nothing's wrong with what she wrote. It's in the wrong thread. Click it, hit Move it, then click the empty spot under your own tile on Rosa's side, the one she was actually answering.",
      nudge:
        "Click Rosa's tile, hit Move it, then click the empty spot under your tile in her evenings thread. Don't answer it where it sits.",
      badges: ["stick-to-root-3"],
      expect: { kind: "relocate", tile: "A1", to: "C1" },
      anchor: { tile: "A1" },
    },
    {
      kind: "pause",
      id: "p4-moving-not-deleting",
      title: "Moving, not deleting",
      body: "It was a fair answer to a question nobody in that thread had asked. Now it sits under the tile it was arguing with, and it's strong there.\n\nYou just made Rosa's point better. That's allowed.",
      button: "Next",
      anchor: { tile: "A1" },
    },
    {
      kind: "player",
      id: "player-answers-d",
      // The sample here is deliberately off-root: it answers the player's own
      // energy thread, not Rosa's schedules root. Rosa catches it in the next
      // beat, which is how the player learns the card from the other end.
      coach: "Rosa's other thread is still bare. Put a reason under it.",
      nudge: "Under Rosa's second root, the one about renegotiating schedules.",
      expect: {
        kind: "tile",
        key: "D1",
        parent: "D",
        suggestions: [
          "But the fuel saving this was invented for stopped being real decades ago.",
          "But the studies that found a saving were measuring 1970s houses and 1970s televisions.",
        ],
      },
    },
    {
      kind: "pause",
      id: "p5-rosa-catches-you",
      title: "Rosa says the same thing back",
      bossSays:
        "Hold on. My reason there was about renegotiating schedules. That isn't what you've answered.",
      body: "She's right, and it's the same rule.\n\nWhat you wrote is a good reason. It just belongs under your own energy thread, not under hers.",
      button: "Move it",
      anchor: { tile: "D1" },
    },
    {
      kind: "player",
      id: "player-relocates-own",
      coach:
        "Move it yourself. Click your tile, hit Move it, then click the empty spot under your energy thread.",
      nudge: "Your tile, Move it, then the empty spot under your own energy root.",
      expect: { kind: "relocate", tile: "D1", to: "B" },
      anchor: { tile: "D1" },
    },
    {
      kind: "pause",
      id: "p6-both-ways",
      title: "That's the card",
      body: "You caught Rosa once and she caught you once, and neither tile went in the bin.\n\nA reason in the wrong thread is a reason in the wrong thread, whoever wrote it.",
      button: "Play it out",
    },
    {
      kind: "boss",
      id: "rosa-token-c",
      bossSays: "We're not going to agree about the evenings. I'd rather have them.",
      act: { kind: "token", thread: "C", emoji: "👀" },
    },
    {
      kind: "player",
      id: "player-token-c",
      coach:
        "Rosa's put 👀 on the evenings thread. If you see it the same way, put yours down.",
      nudge: "Same token, same thread: 👀 on Rosa's evenings thread.",
      expect: { kind: "token", thread: "C", emoji: "👀" },
      anchor: { tile: "C" },
    },
    {
      kind: "player",
      id: "player-token-b",
      coach: "Your energy thread now has two reasons in it and no answer. Propose 👍.",
      nudge: "👍 on your own energy thread.",
      expect: { kind: "token", thread: "B", emoji: "👍" },
      anchor: { tile: "B" },
    },
    {
      kind: "boss",
      id: "rosa-token-b",
      bossSays: "Point taken. The energy reason is gone.",
      act: { kind: "token", thread: "B", emoji: "👍" },
    },
    {
      kind: "boss",
      id: "rosa-token-a",
      bossSays:
        "One bad week a year. We're not going to agree about how much that weighs.",
      act: { kind: "token", thread: "A", emoji: "👀" },
    },
    {
      kind: "player",
      id: "player-token-a",
      coach: "Your crash thread. Same again: 👀 if you read it the way she does.",
      nudge: "👀 on your first thread.",
      expect: { kind: "token", thread: "A", emoji: "👀" },
      anchor: { tile: "A" },
    },
    {
      kind: "boss",
      id: "rosa-token-d",
      bossSays: "And schedules. Neither of us has put anything new in there.",
      act: { kind: "token", thread: "D", emoji: "👀" },
    },
    {
      kind: "player",
      id: "player-token-d",
      coach: "Last one. Put your 👀 down and the board is done.",
      nudge: "👀 on Rosa's schedules thread.",
      expect: { kind: "token", thread: "D", emoji: "👀" },
      anchor: { tile: "D" },
    },
    { kind: "win", id: "win" },
  ],
};
