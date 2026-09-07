import type { Level } from "../script";
import { THROW_POINTS } from "@/lib/progression/sample";

/**
 * Level 3, Claim size: Should tipping be replaced by higher base wages?
 *
 * Beats and lines from Nathan's Revision 2 (inbox/point-taken-levels-1-4.md,
 * "LEVEL 3 Claim size"). The player is Plus (replace it), Bogdan is Minus
 * (keep it). Four threads: A and B are the player's, C and D are Bogdan's.
 * The card is No Exaggeration, and its three rungs are the tell word, the
 * quiet inflation, and the one the player commits themselves.
 *
 * Three decisions this file makes, all of them recorded as decision rows:
 *
 * - **Rung 3 is the dare, not the self-catch.** Nathan branches here: PATH A
 *   catches an oversized claim the player already wrote, PATH B dares them to
 *   write one. PATH A needs a silent scan of the player's own tiles for
 *   unqualified quantifiers, and Nathan's own Appendix C lists that detection
 *   threshold as still open. Steve's ruling names the dare. So the dare is
 *   what is built and the self-catch is deferred; the baited root suggestions
 *   below are kept anyway, because they are what PATH A will read when it
 *   arrives.
 * - **The rung-1 target is the tile the coach already pointed at.** Nathan
 *   holds the L3.2 tile ("every restaurant that's tried going no-tip has gone
 *   back to it") as the rung-1 target and gives Bogdan a spare in case the
 *   player throws early. The walker has no branches, so the spare is dropped
 *   and the coach's line at PAUSE 2 points at the tile that is already there.
 * - **The dock and the refund are script-derived while the level runs.**
 *   `lib/gym/awards.ts` banks points once, at game end, so a mid-game write
 *   would be a second source of truth. The score the player watches move is
 *   `levelPoints`, and the same deltas reach the log afterwards carrying
 *   `pointsReason`, which is why the two beats below name one.
 *
 * Player tiles follow Nathan's Appendix B option 2: suggested on the beats
 * that matter (the roots, the dare, the repair) and free text on the ordinary
 * answers. The roots keep their suggestions whatever else changes, because
 * the quantifier baited into the first of each pair is what the deferred
 * PATH A will have to find.
 *
 * Rung ids are `no_exaggeration_1..3`. Badges follow lib/progression/sample.
 */

const CARD = "no_exaggeration";

export const CLAIM_SIZE: Level = {
  id: "claim_size",
  number: 3,
  title: "Claim size",
  topic: "Should tipping be replaced by higher base wages?",
  topicId: "tipping-base-wages",
  bossId: "braggy-bogdan",
  bossName: "Braggy Bogdan",
  bossEmoji: "🧑🏼‍🔬",
  cardId: CARD,
  rootTarget: 4,
  playerSide: "plus",
  bossSide: "minus",
  banner:
    "Bogdan claims more than he can carry. Today you learn to ask him for the size.",
  // Echoes braggy-bogdan's habit in lib/progression/sample.ts. He inflates
  // cheerfully rather than attacking (Nathan's script, "Bogdan's whole
  // behaviour"): a tell word first, then a true point stated too large, and
  // by rung three the level turns the same catch on the player's own tile.
  bossHabit: "claims more than the evidence underneath it can carry",
  bossTip:
    "listen for words like every, never, and only, then throw the card and ask for a size he will actually defend",
  learningGoals: [
    "You'll take on Braggy Bogdan, who says everyone, always and never when he means quite a lot of people, sometimes.",
    "You'll learn to read the size of a claim, which is the difference between a reason you can back and a reason you just like the sound of.",
    "And you'll earn the card that makes him cut a claim down to what he can actually hold up.",
  ],
  awards: {
    badges: ["no-exaggeration-1", "no-exaggeration-2", "no-exaggeration-3"],
    cardId: CARD,
  },
  beats: [
    {
      kind: "pause",
      id: "p0-claim-size",
      title: "Bogdan, and the size of a claim",
      body: "Bogdan is not lying to you. He just says everything one size too big, cheerfully, and he will not catch himself doing it. Today's card is about the size of a claim, which turns out to have nothing to do with whether it is true.",
      button: "Let's go",
    },
    {
      kind: "boss",
      id: "bogdan-root-c",
      act: {
        kind: "tile",
        key: "C",
        parent: null,
        text: "No, because the best servers out-earn any flat wage a restaurant would actually offer.",
      },
    },
    {
      kind: "boss",
      id: "bogdan-root-d",
      act: {
        kind: "tile",
        key: "D",
        parent: null,
        text: "No, because the money comes out of the same pocket either way, menu prices just go up instead.",
      },
    },
    {
      kind: "player",
      id: "player-root-a",
      coach:
        "Bogdan wants to keep tipping. You want to replace it with a wage. Your first reason, hung off the topic.",
      nudge: "Off the topic. This one starts a thread of your own.",
      expect: {
        kind: "tile",
        key: "A",
        parent: null,
        suggestions: [
          "Yes, because tipping means every server's pay is decided by strangers who have never done the job.",
          "Yes, because a server's income shouldn't depend on how charming a stranger finds them.",
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
          "Yes, because tip income swings with the weather and the shift, so nobody can budget on it.",
          "Yes, because tip income swings with the weather and the shift, which makes it hard to plan around.",
        ],
      },
    },
    {
      kind: "boss",
      id: "bogdan-answers-a",
      act: {
        kind: "tile",
        key: "A1",
        parent: "A",
        text: "But a flat wage doesn't reward the difference between a server paying attention and one who isn't.",
      },
    },
    {
      kind: "boss",
      id: "bogdan-answers-b",
      act: {
        kind: "tile",
        key: "B1",
        parent: "B",
        text: "But plenty of jobs have variable pay and people manage it fine.",
      },
    },
    {
      kind: "player",
      id: "player-answers-a1",
      coach: "Bogdan answered your first thread. Answer him, under his tile.",
      nudge: "Under Bogdan's tile in your first thread.",
      expect: {
        kind: "tile",
        key: "A2",
        parent: "A1",
        suggestions: [
          "But restaurants already sort out who is good at the job when they hand out shifts and raises.",
          "But a tip tracks how busy the section was as much as how well anyone worked it.",
        ],
      },
    },
    {
      kind: "boss",
      id: "bogdan-every-restaurant",
      act: {
        kind: "tile",
        key: "B2",
        parent: "B1",
        text: "But every restaurant that's tried going no-tip has gone back to it.",
      },
    },
    {
      kind: "pause",
      id: "p1-size-is-not-strength",
      title: "Size is not strength",
      bossSays: "Every restaurant that's tried going no-tip has gone back to it.",
      body: "Watch that one. He said every. If that were my tile I'd have written that several well-known ones went back within two years. The smaller version is harder to argue with. You can't knock it down by finding one exception. Keep that in your head.",
      button: "Got it",
      anchor: { tile: "B2" },
    },
    {
      kind: "pause",
      id: "p2-card-rung-1",
      title: "No Exaggeration",
      cardId: CARD,
      body: "The agreement: I'll make claims at a size I can actually defend. Throw this card at a claim bigger than the reason underneath it, and the author restates it at a size they will stand behind. Rung one has a tell. The word gives it away, and there is one sitting on the board right now.",
      button: "Show me",
      anchor: { tile: "B2" },
    },
    {
      kind: "player",
      id: "player-throws-1",
      coach: "You just heard the word. Throw the card at the tile carrying it.",
      nudge: "Every. That is the whole tell. Throw it at that tile.",
      badges: ["no-exaggeration-1"],
      points: THROW_POINTS,
      expect: { kind: "throw", tile: "B2", cardId: CARD, rungId: "no_exaggeration_1" },
      anchor: { tile: "B2" },
    },
    {
      kind: "boss",
      id: "bogdan-narrows-1",
      bossSays: "Which is harder to argue with. Fine.",
      act: {
        kind: "revise",
        tile: "B2",
        text: "But several well-known restaurants that went no-tip went back to tipping within about two years.",
      },
    },
    {
      kind: "pause",
      id: "p3-card-rung-2",
      title: "A true point, inflated",
      cardId: CARD,
      body: "No tell word this time. The point underneath is real. The size is not.",
      button: "Show me",
    },
    {
      kind: "boss",
      id: "bogdan-only-reason",
      act: {
        kind: "tile",
        key: "B3",
        parent: "B2",
        text: "But tipping is the only reason service in this country is as fast as it is.",
      },
    },
    {
      kind: "player",
      id: "player-throws-2",
      coach:
        "There is a real argument in that tile. Is it the size he wrote it at? Throw the card.",
      nudge: "The only reason. Nothing is the only reason for anything.",
      badges: ["no-exaggeration-2"],
      points: THROW_POINTS,
      expect: { kind: "throw", tile: "B3", cardId: CARD, rungId: "no_exaggeration_2" },
      anchor: { tile: "B3" },
    },
    {
      kind: "boss",
      id: "bogdan-narrows-2",
      act: {
        kind: "revise",
        tile: "B3",
        text: "But tipping is one of the things that keeps servers turning tables quickly.",
      },
    },
    {
      kind: "pause",
      id: "p4-card-rung-3",
      title: "You inflate your own",
      cardId: CARD,
      body: "Last rung, and it is the only one that is not about Bogdan. Catching an oversized claim is easy when someone else wrote it. Everything you have written is the right size, which is my problem: I cannot teach you this by waiting. So I have typed something into your box. It is your argument, two sizes too big. It is going to cost you points to send it. Send it anyway.",
      button: "Send it anyway",
    },
    {
      kind: "player",
      id: "player-takes-the-dare",
      coach:
        "Aimed at Bogdan's thread about the best servers. Take the tile I wrote and send it.",
      nudge: "Under Bogdan's root about the best servers out-earning a flat wage.",
      points: -THROW_POINTS,
      pointsReason: "dare_staked",
      pointsLabel: "oversized claim",
      expect: {
        kind: "tile",
        key: "C1",
        parent: "C",
        suggestions: [
          "But tipping makes a server's pay completely disconnected from how hard they work.",
        ],
      },
    },
    {
      kind: "boss",
      id: "bogdan-shows-the-cost",
      bossSays: "Completely disconnected? Come on.",
      act: {
        kind: "tile",
        key: "C2",
        parent: "C1",
        text: "But a packed steakhouse pays nothing like a dead diner, and 'completely' is doing your arguing.",
      },
    },
    {
      kind: "pause",
      id: "p5-pull-it-back",
      title: "Pull it back",
      body: "You had a real argument and you oversized it, and he went after the size instead of the argument. That is what it costs. Now restate it at something you would defend, and the points come straight back.",
      button: "Fix it",
      anchor: { tile: "C1" },
    },
    {
      kind: "player",
      id: "player-repairs-own-tile",
      coach:
        "Your tile, your edit. Same move you have thrown at Bogdan twice. Pull it back to something you would defend.",
      nudge: "Open your own tile and rewrite it. Smaller, and harder to argue with.",
      badges: ["no-exaggeration-3"],
      points: THROW_POINTS,
      pointsReason: "dare_repaired",
      pointsLabel: "brought back to size",
      expect: {
        kind: "edit",
        tile: "C1",
        suggestions: [
          "But tip income tracks how busy the restaurant is more than it tracks the server's effort.",
          "But a server can do everything right on a slow Tuesday and take home nothing.",
        ],
      },
      anchor: { tile: "C1" },
    },
    {
      kind: "boss",
      id: "bogdan-nobody-ever",
      act: {
        kind: "tile",
        key: "D1",
        parent: "D",
        text: "But nobody has ever made a no-tipping restaurant work.",
      },
    },
    {
      kind: "player",
      id: "player-throws-3",
      coach: "Bogdan again, in his own thread. You know this shape by now.",
      nudge: "Nobody, ever. Same tell as the first one.",
      points: THROW_POINTS,
      expect: { kind: "throw", tile: "D1", cardId: CARD, rungId: "no_exaggeration_1" },
      anchor: { tile: "D1" },
    },
    {
      kind: "boss",
      id: "bogdan-narrows-3",
      act: {
        kind: "revise",
        tile: "D1",
        text: "But the no-tipping restaurants I know of have had a hard time holding staff.",
      },
    },
    {
      kind: "player",
      id: "player-answers-d1",
      coach:
        "Bait, catch, throw, three times now, and once in the other direction on your own tile. Answer him under the tile he just narrowed.",
      nudge: "Under Bogdan's narrowed tile, in his same-pocket thread.",
      expect: {
        kind: "tile",
        key: "D2",
        parent: "D1",
        suggestions: [
          "The ones that lasted paid above the old tipped average, which is a pay problem, not a tipping one.",
          "Holding staff has been hard across the whole industry lately, tipped restaurants included.",
        ],
      },
    },
    {
      kind: "player",
      id: "player-token-a",
      coach:
        "Time to close threads. You two want different things from a server's pay, and neither of you is wrong about what you want. Propose 👀 on your first thread.",
      nudge: "👀 on your first thread, the one about strangers deciding the pay.",
      expect: { kind: "token", thread: "A", emoji: "👀" },
      anchor: { tile: "A" },
    },
    {
      kind: "boss",
      id: "bogdan-token-a",
      bossSays: "Different tastes, then. I can live with that.",
      act: { kind: "token", thread: "A", emoji: "👀" },
    },
    {
      kind: "boss",
      id: "bogdan-token-b",
      bossSays:
        "Point taken. Once I had to say it at a size I could defend, you were right.",
      act: { kind: "token", thread: "B", emoji: "👍" },
    },
    {
      kind: "player",
      id: "player-token-b",
      coach: "Bogdan has conceded your predictability thread. Put your 👍 down to match.",
      nudge: "👍 on your second thread, the one about budgeting.",
      expect: { kind: "token", thread: "B", emoji: "👍" },
      anchor: { tile: "B" },
    },
    {
      kind: "boss",
      id: "bogdan-token-c",
      act: { kind: "token", thread: "C", emoji: "👀" },
    },
    {
      kind: "player",
      id: "player-token-c",
      coach:
        "His thread about the best servers. You value the floor, he values the ceiling. Match his 👀.",
      nudge: "👀 on Bogdan's thread about the best servers.",
      expect: { kind: "token", thread: "C", emoji: "👀" },
      anchor: { tile: "C" },
    },
    {
      kind: "player",
      id: "player-token-d",
      coach: "One left. Propose 👍 on his same-pocket thread and the board is done.",
      nudge: "👍 on Bogdan's last thread.",
      expect: { kind: "token", thread: "D", emoji: "👍" },
      anchor: { tile: "D" },
    },
    {
      kind: "boss",
      id: "bogdan-token-d",
      bossSays: "Agreed. Same pocket, different certainty about who ends up paying.",
      act: { kind: "token", thread: "D", emoji: "👍" },
    },
    { kind: "win", id: "win" },
  ],
};
