import type { Level } from "../script";
import { THROW_POINTS } from "@/lib/progression/sample";

/**
 * Level 2, Ground rules: Should we stop changing the clocks twice a year?
 *
 * Beats and lines from the implementation guide, section 4 (Level 2). The
 * player is Plus (stop), Rosa is Minus (keep it). Four threads: A and B are
 * the player's, C and D are Rosa's. The card is Stick to the Thread's Root,
 * and its three rungs each get a tile that misses the root a different way:
 * not about it at all (removed), on topic but already said (sharpened), and
 * right reason in the wrong thread (moved, to C's root).
 *
 * Two departures from the script, both deliberate and both re-confirmed
 * against Nathan's Revision 2 (inbox/point-taken-levels-1-4.md) on 2026-09-03:
 * - L2.3 asks the player to fold a thread. The board has no fold gesture yet
 *   (compact mode is P1, Steve 2026-09-03), so it is a pause that says the
 *   board is growing and moves on, and the `compression` badge is not awarded.
 *   It comes back when compact mode ships, not before.
 * - L2.10 plays out with one player tile each in C and D (the C1 and D1
 *   beats below). His resolution table has both threads ending in a token but
 *   never gives the player a tile in either, so they would be resolved without
 *   ever being argued. The two tiles fill that gap; they are ours, and if he
 *   would rather the threads resolve bare, these two beats are what to cut.
 *
 * Rung ids are `stick_to_root_1..3`. No canonical list of rung ids exists in
 * the code yet (the throw payload carries `rung_id` as a free string), so
 * these are the first ones written down. Badges follow lib/progression/sample.
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
  bossEmoji: "🧑🏿‍🔧",
  cardId: CARD,
  // The standard four, which is what the opening pause tells the player a
  // normal game looks like. Rosa opens C and D, the player opens A and B.
  rootTarget: 4,
  playerSide: "plus",
  bossSide: "minus",
  banner: "Four threads this time, two reasons from each of you. That's a standard game.",
  // Echoes rambling-rosa's habit in lib/progression/sample.ts. Her three
  // scripted tiles (Nathan's script, L2.5/L2.7/L2.9) are all off-root in
  // ascending difficulty: not about the root, on-topic but already said, and
  // right reason in the wrong thread.
  bossHabit: "wanders off the thread's root",
  bossTip:
    "check every tile against the root at the top of its thread, and throw the card the moment one stops answering it",
  awards: {
    badges: ["stick-to-root-1", "stick-to-root-2", "stick-to-root-3"],
    cardId: CARD,
  },
  beats: [
    {
      kind: "pause",
      id: "p1-four-threads",
      title: "Four threads, and points",
      body: "Two reasons from each of you this time, four threads is the normal game. And there's a score now. You'll get points for catching Rosa with a card, and only for that. Nothing you write scores; catching does.",
      button: "Got it",
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
        "Rosa has put two reasons down. Your first: one reason to stop changing the clocks.",
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
      kind: "boss",
      id: "rosa-answers-a",
      act: {
        kind: "tile",
        key: "A1",
        parent: "A",
        text: "But it's one week a year, and the effect washes out by the following Monday.",
      },
    },
    {
      kind: "player",
      id: "player-answers-a1",
      coach: "Rosa answered your first thread. Answer her, under her tile.",
      nudge: "Under Rosa's 'Hmm' in your first thread.",
      expect: {
        kind: "tile",
        key: "A2",
        parent: "A1",
        suggestions: [
          "But a week of extra crashes every year is still a week of extra crashes every year.",
          "But 'it washes out' is a statement about averages, not about the people in the crashes.",
        ],
      },
    },
    {
      kind: "boss",
      id: "rosa-answers-b",
      act: {
        kind: "tile",
        key: "B1",
        parent: "B",
        text: "But nobody kept it for the energy math after 1975, it stayed because people liked the evenings.",
      },
    },
    {
      kind: "player",
      id: "player-answers-b1",
      coach: "Now your second thread. Rosa's answer is waiting under your root.",
      nudge: "Under Rosa's tile in your second thread.",
      expect: {
        kind: "tile",
        key: "B2",
        parent: "B1",
        suggestions: [
          "But if the reason it stayed is the evenings, then the energy reason is gone and we should say so.",
          "But 'people liked it' is a reason to keep summer hours, not a reason to keep switching.",
        ],
      },
    },
    {
      kind: "pause",
      id: "p2-board-grows",
      title: "The board is growing",
      body: "Four threads, nine tiles. This is what a standard game looks like at the halfway mark. Keep the shape in your head: four columns, each about the tile at its top.",
      button: "Got it",
    },
    {
      kind: "pause",
      id: "p3-rung-1",
      title: "Stick to the Thread's Root",
      cardId: CARD,
      body: "Three ways a tile can miss its root. Here's the first, and it's the obvious one.",
      button: "Show me",
    },
    {
      kind: "boss",
      id: "rosa-rung-1",
      act: {
        kind: "tile",
        key: "A3",
        parent: "A2",
        text: "But whoever put that tiny recessed clock-set button on my microwave should be prosecuted.",
      },
    },
    {
      kind: "player",
      id: "player-throws-1",
      coach:
        "Rosa's new tile. Is it about the tile at the top of that thread? Throw the card at it.",
      nudge: "...that one isn't doing anything for the thread it's in, is it.",
      badges: ["stick-to-root-1"],
      points: THROW_POINTS,
      expect: { kind: "throw", tile: "A3", cardId: CARD, rungId: "stick_to_root_1" },
      anchor: { tile: "A3" },
    },
    {
      kind: "boss",
      id: "rosa-removes",
      // Rosa says nothing here. She had a line in an earlier draft of this
      // file; Nathan's Revision 2 does not give her one, and an invented line
      // in a scripted boss's mouth is the kind of thing that reads as canon a
      // week later.
      act: { kind: "remove", tile: "A3" },
    },
    {
      kind: "pause",
      id: "p4-rung-1-done",
      title: "Rung one",
      body: "Rung one, it isn't about the root at all. Nothing to salvage, it just comes off.",
      button: "Next",
    },
    {
      kind: "pause",
      id: "p5-rung-2",
      title: "On topic, already said",
      cardId: CARD,
      body: "Harder. This one is true, and it is about the root. It just doesn't add anything the thread doesn't already have.",
      button: "Show me",
    },
    {
      kind: "boss",
      id: "rosa-rung-2",
      act: {
        kind: "tile",
        key: "A4",
        parent: "A2",
        text: "But we're talking about a handful of days out of three hundred and sixty-five.",
      },
    },
    {
      kind: "player",
      id: "player-throws-2",
      coach:
        "Read Rosa's new tile against her first one in that thread. Anything new? Throw the card.",
      nudge:
        "She already said it was one week a year. This is the same tile in different words.",
      badges: ["stick-to-root-2"],
      points: THROW_POINTS,
      expect: { kind: "throw", tile: "A4", cardId: CARD, rungId: "stick_to_root_2" },
      anchor: { tile: "A4" },
    },
    {
      kind: "boss",
      id: "rosa-sharpens",
      act: {
        kind: "revise",
        tile: "A4",
        text: "But the autumn change runs the other way in the same studies, so the annual net is close to zero.",
      },
    },
    {
      kind: "pause",
      id: "p6-rung-2-done",
      title: "Rung two",
      body: "Relevant and true, and still worth catching. Relevance isn't the test; adding something is.",
      button: "Next",
      anchor: { tile: "A4" },
    },
    {
      kind: "pause",
      id: "p7-rung-3",
      title: "Right reason, wrong home",
      cardId: CARD,
      body: "The last one is why this card exists. The tile is good. It's in the wrong place, and the repair isn't a delete, it's a move.",
      button: "Show me",
    },
    {
      kind: "boss",
      id: "rosa-rung-3",
      act: {
        kind: "tile",
        key: "B3",
        parent: "B2",
        text: "But evening light is when people leave the house, and that's worth more than the kilowatt-hours.",
      },
    },
    {
      kind: "player",
      id: "player-throws-3",
      coach:
        "A good tile. Is it answering the root of that thread, the one about energy savings? Throw the card.",
      nudge:
        "It's a real argument. It's just not an answer to 'the energy savings disappeared'.",
      badges: ["stick-to-root-3"],
      points: THROW_POINTS,
      expect: { kind: "throw", tile: "B3", cardId: CARD, rungId: "stick_to_root_3" },
      anchor: { tile: "B3" },
    },
    {
      kind: "player",
      id: "player-relocates",
      coach:
        "Nothing wrong with that tile, it's just in the wrong thread. Click it, hit Move it, then click the empty spot under Rosa's root about evenings, the one it was actually arguing for.",
      nudge:
        "Click that tile, hit Move it, then click the empty spot under Rosa's evenings root. Don't answer it where it sits.",
      expect: { kind: "relocate", tile: "B3", to: "C" },
      anchor: { tile: "B3" },
    },
    {
      kind: "pause",
      id: "p8-moving-not-deleting",
      title: "Moving, not deleting",
      body: "Nothing was wrong with that tile. It was answering a question nobody in that thread had asked. Now it's under the root it was actually arguing with, and it's strong there. You just made Rosa's case better, which is allowed.",
      button: "Play it out",
      anchor: { tile: "B3" },
    },
    {
      kind: "boss",
      id: "rosa-token-a",
      bossSays: "We're not going to agree about how much a week matters. I'll say why.",
      act: { kind: "token", thread: "A", emoji: "👀" },
    },
    {
      kind: "player",
      id: "player-token-a",
      coach:
        "Rosa's put 👀 on your first thread. If you see it the same way, put yours down.",
      nudge: "Same token, same thread: 👀 on your first thread.",
      expect: { kind: "token", thread: "A", emoji: "👀" },
      anchor: { tile: "A" },
    },
    {
      kind: "player",
      id: "player-token-b",
      coach: "Your second thread, propose 👍 there.",
      nudge: "👍 on your second thread, the one about energy savings.",
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
      kind: "player",
      id: "player-answers-c",
      coach: "Rosa's evenings thread now has the tile you moved. Answer it there.",
      nudge: "Under the tile you moved, in Rosa's evenings thread.",
      expect: {
        kind: "tile",
        key: "C1",
        parent: "B3",
        suggestions: [
          "But we could keep summer hours all year and still stop switching.",
          "But that's an argument for evening light, not for changing the clocks twice.",
        ],
      },
    },
    {
      kind: "player",
      id: "player-token-c",
      coach:
        "You two value the evenings differently, and now you both know it. Propose 👀 on that thread.",
      nudge: "👀 on Rosa's evenings thread.",
      expect: { kind: "token", thread: "C", emoji: "👀" },
      anchor: { tile: "C" },
    },
    {
      kind: "boss",
      id: "rosa-token-c",
      act: { kind: "token", thread: "C", emoji: "👀" },
    },
    {
      kind: "player",
      id: "player-answers-d",
      coach: "One thread left: Rosa's schedules. Answer her root.",
      nudge: "Under Rosa's last root, the one about renegotiating schedules.",
      expect: {
        kind: "tile",
        key: "D1",
        parent: "D",
        suggestions: [
          "But those schedules already get renegotiated twice a year; stopping means doing it once.",
          "But a region that stopped would need one fix, not a fix every spring and autumn.",
        ],
      },
    },
    {
      kind: "boss",
      id: "rosa-token-d",
      bossSays: "Once instead of twice. All right, that's better than what I had.",
      act: { kind: "token", thread: "D", emoji: "👍" },
    },
    {
      kind: "player",
      id: "player-token-d",
      coach: "Rosa's conceded the last thread. Put your 👍 down and the board is done.",
      nudge: "👍 on Rosa's schedules thread.",
      expect: { kind: "token", thread: "D", emoji: "👍" },
      anchor: { tile: "D" },
    },
    { kind: "win", id: "win" },
  ],
};
