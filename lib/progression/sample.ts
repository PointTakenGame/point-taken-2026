import { COACH_CARDS, type CoachCard } from "@/lib/coach/cards";

/**
 * SAMPLE progression data. Every number, date and streak in this file is
 * invented.
 *
 * Steve, 2026-09-03: the Gym and the progression layer behind it wait on
 * Nathan's script, but that must not stop the screens. "Design the screen that
 * summarizes what happened, just fake some data, let me know what blockers I
 * am not thinking of." And on the widgets Rannie drew that we had ruled out:
 * "these are just tiles on a website with db queries behind them. I would
 * rather have more fake ones now as inspiration and remove them later. We will
 * be iterating on them anyway." (BRAIN-T260903-10, BRAIN-T260903-11.)
 *
 * So this file is the single source every progression widget reads from, and
 * the single file to delete when the real engine lands. No event type in the
 * catalogue awards anything yet (`card_granted`, `badge_granted`,
 * `certificate_granted`, `points_adjusted` are spec, not schema), so nothing
 * here is derived from the event log, and nothing here should be persisted.
 *
 * What is ratified and what is not, so the widgets do not launder invention
 * into fact:
 *
 * - Card ids are snake_case, everything else (badge, boss, topic, coach, level)
 *   is kebab-case (BIZ-T260823-66). The four ratified cards come from
 *   lib/coach/cards.ts, never re-typed.
 * - Levels 1 to 4, their topics, cards and bosses are ratified
 *   (docs/reference/materials/spec/2026-08-22_gym-levels-1-4-implementation-guide.md).
 *   Rungs 5 and up exist only as locked slots: Steve, 2026-09-03, "8 is rough,
 *   on the newest planning with Nathan we may even have 10 rungs." Widgets take
 *   the rung count from LADDER.length, never from a literal.
 * - Badge ids for levels 1 to 4 are the guide's. Their display names are
 *   invented here and are the first thing a content pass should replace.
 * - A throw is worth THROW_POINTS (BIZ-T260823-65). There is no failure state
 *   and no point loss anywhere in the Gym (BIZ-T260823-67).
 * - The coach is picked once per account, not per level (BIZ-T260823-68). The
 *   three personas are Rannie's; the second was drawn as "Drill-Sergeant Dev"
 *   and is renamed here because a drill sergeant is the opposite of what the
 *   coach is for. The replacement name is a placeholder pending Steve.
 * - Cooperation score, global percentile, ladder rank and division are
 *   Rannie's inventions with no formula behind them. Built as tiles on purpose
 *   (BRAIN-T260903-11); the numbers are hers from the Figma.
 * - The five later cards carry Rannie's names from the Figma and nothing else.
 *   They are not ratified rules and have no `breaks` text; they exist so the
 *   card wall shows what a fuller deck looks like.
 * - No opponent comparison anywhere: no per-match versus scores, no WIN or
 *   LOSS, no head-to-head. That half of BIZ-T260822-05 still stands.
 */

/** Points for a clean throw of a rule card (BIZ-T260823-65). */
export const THROW_POINTS = 10;

// ---------------------------------------------------------------------------
// The ladder
// ---------------------------------------------------------------------------

export type RungStatus = "cleared" | "current" | "open" | "locked";

export interface Rung {
  /** 1-based. */
  level: number;
  /** Level id as used by app/gym/page.tsx; null for an unnamed later rung. */
  id: string | null;
  /** Null for a rung that has not been designed yet. */
  title: string | null;
  cardId: string | null;
  bossId: string | null;
  status: RungStatus;
  /** ISO date the certificate was issued, if cleared. */
  clearedOn: string | null;
}

/**
 * Levels 1 to 4 are ratified; 5 to 8 are locked slots so the ladder shows its
 * shape. Extending it is adding rows, and nothing that renders it may assume
 * eight.
 */
export const LADDER: readonly Rung[] = [
  {
    level: 1,
    id: "onboarding",
    title: "Onboarding",
    cardId: "you_is_taboo",
    bossId: "bashful-bob",
    status: "cleared",
    clearedOn: "2026-08-19",
  },
  {
    level: 2,
    id: "ground_rules",
    title: "Ground rules",
    cardId: "stick_to_root",
    bossId: "rambling-rosa",
    status: "cleared",
    clearedOn: "2026-08-26",
  },
  {
    level: 3,
    id: "claim_size",
    title: "Claim size",
    cardId: "no_exaggeration",
    bossId: "braggy-brenda",
    status: "current",
    clearedOn: null,
  },
  {
    level: 4,
    id: "clarity",
    title: "Clarity",
    cardId: "help_me_understand",
    bossId: "sloppy-salma",
    status: "open",
    clearedOn: null,
  },
  {
    level: 5,
    id: null,
    title: null,
    cardId: null,
    bossId: null,
    status: "locked",
    clearedOn: null,
  },
  {
    level: 6,
    id: null,
    title: null,
    cardId: null,
    bossId: null,
    status: "locked",
    clearedOn: null,
  },
  {
    level: 7,
    id: null,
    title: null,
    cardId: null,
    bossId: null,
    status: "locked",
    clearedOn: null,
  },
  {
    level: 8,
    id: null,
    title: null,
    cardId: null,
    bossId: null,
    status: "locked",
    clearedOn: null,
  },
];

export function currentRung(): Rung {
  return LADDER.find((rung) => rung.status === "current") ?? LADDER[0];
}

export function clearedRungs(): Rung[] {
  return LADDER.filter((rung) => rung.status === "cleared");
}

// ---------------------------------------------------------------------------
// Bosses
// ---------------------------------------------------------------------------

export type BossStatus = "reformed" | "met" | "locked";

export interface Boss {
  id: string;
  name: string;
  emoji: string;
  level: number;
  /** One line on the habit the boss embodies, which is the rule the level teaches. */
  habit: string;
  status: BossStatus;
}

/**
 * Our four, one per ratified level, plus locked slots up to the ladder's
 * length. "Reformed" is Rannie's word for a boss you have beaten: the boss
 * does not lose, they learn the rule, which is the only ending this game has.
 */
export const BOSSES: readonly Boss[] = [
  {
    id: "bashful-bob",
    name: "Bashful Bob",
    emoji: "🧑🏻‍💼",
    level: 1,
    habit: "Talks about you instead of the question.",
    status: "reformed",
  },
  {
    id: "rambling-rosa",
    name: "Rambling Rosa",
    emoji: "🧑🏿‍🔧",
    level: 2,
    habit: "Wanders off the thread's root.",
    status: "reformed",
  },
  {
    id: "braggy-brenda",
    name: "Braggy Brenda",
    emoji: "🧑🏼‍🔬",
    level: 3,
    habit: "Claims more than the evidence carries.",
    status: "met",
  },
  {
    id: "sloppy-salma",
    name: "Sloppy Salma",
    emoji: "🧑🏾‍🍳",
    level: 4,
    habit: "Leaves the reader to guess what she meant.",
    status: "locked",
  },
  ...LADDER.filter((rung) => rung.bossId === null).map((rung): Boss => ({
    id: `boss-${rung.level}`,
    name: "Not yet met",
    emoji: "❔",
    level: rung.level,
    habit: "",
    status: "locked",
  })),
];

export function boss(id: string): Boss | undefined {
  return BOSSES.find((b) => b.id === id);
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export interface Badge {
  id: string;
  name: string;
  icon: string;
  /** Plain-English condition, the sentence under the badge. */
  earnedFor: string;
  /** Which level awards it. */
  level: number;
  /** ISO date, or null if not yet earned. */
  earnedOn: string | null;
}

/**
 * Every badge the ratified guide awards across levels 1 to 4, with the ids it
 * uses. Levels 1 and 2 are marked earned to match the ladder above. Names are
 * invented; the guide gives ids and emoji only.
 */
export const BADGES: readonly Badge[] = [
  {
    id: "mutual-respect",
    name: "Mutual respect",
    icon: "✍️",
    earnedFor: "Signed the first line of the agreement.",
    level: 1,
    earnedOn: "2026-08-19",
  },
  {
    id: "honest-thinking",
    name: "Honest thinking",
    icon: "✍️",
    earnedFor: "Signed the second line of the agreement.",
    level: 1,
    earnedOn: "2026-08-19",
  },
  {
    id: "shared-facts",
    name: "Shared facts",
    icon: "✍️",
    earnedFor: "Signed the third line of the agreement.",
    level: 1,
    earnedOn: "2026-08-19",
  },
  {
    id: "resolve-first-thread",
    name: "First resolution",
    icon: "🤝",
    earnedFor: "Resolved a thread for the first time.",
    level: 1,
    earnedOn: "2026-08-19",
  },
  {
    id: "call-broken-rule",
    name: "Called it",
    icon: "🃏",
    earnedFor: "Threw a rule card at a reason that broke it.",
    level: 1,
    earnedOn: "2026-08-19",
  },
  {
    id: "finish-one-game",
    name: "Finished one",
    icon: "🎬",
    earnedFor: "Played a game to the end.",
    level: 1,
    earnedOn: "2026-08-19",
  },
  {
    id: "compression",
    name: "Folded a thread",
    icon: "🗜️",
    earnedFor: "Collapsed a thread and opened it again.",
    level: 2,
    earnedOn: "2026-08-26",
  },
  {
    id: "stick-to-root-1",
    name: "On topic I",
    icon: "🎯",
    earnedFor: "Caught a reason that left the thread's root.",
    level: 2,
    earnedOn: "2026-08-26",
  },
  {
    id: "stick-to-root-2",
    name: "On topic II",
    icon: "🎯",
    earnedFor: "Caught a restatement dressed as a new reason.",
    level: 2,
    earnedOn: "2026-08-26",
  },
  {
    id: "stick-to-root-3",
    name: "On topic III",
    icon: "🎯",
    earnedFor: "Moved a good reason to the thread it belongs in.",
    level: 2,
    earnedOn: "2026-08-26",
  },
  {
    id: "no-exaggeration-1",
    name: "Right-sized I",
    icon: "📏",
    earnedFor: "Caught an absolute where the evidence supports a tendency.",
    level: 3,
    earnedOn: null,
  },
  {
    id: "no-exaggeration-2",
    name: "Right-sized II",
    icon: "📏",
    earnedFor: "Caught a worst case presented as the expected case.",
    level: 3,
    earnedOn: null,
  },
  {
    id: "no-exaggeration-3",
    name: "Right-sized III",
    icon: "📏",
    earnedFor: "Repaired an overstatement of your own before it was thrown at.",
    level: 3,
    earnedOn: null,
  },
  {
    id: "help-me-understand-1",
    name: "Plain speaking I",
    icon: "💬",
    earnedFor: "Asked for a term to be defined before answering it.",
    level: 4,
    earnedOn: null,
  },
  {
    id: "help-me-understand-2",
    name: "Plain speaking II",
    icon: "💬",
    earnedFor: "Asked for the missing step between evidence and conclusion.",
    level: 4,
    earnedOn: null,
  },
];

export function earnedBadges(): Badge[] {
  return BADGES.filter((b) => b.earnedOn !== null);
}

// ---------------------------------------------------------------------------
// Rule cards: the ratified four, plus Rannie's later five as locked
// ---------------------------------------------------------------------------

export type CardOwnership = "owned" | "next" | "later";

export interface CardWallEntry {
  id: string;
  name: string;
  icon: string;
  /** One line for the wall. `plain` from the coach card where one exists. */
  plain: string;
  ownership: CardOwnership;
  /** Level that grants it, null for cards with no level yet. */
  level: number | null;
  /** Times this player has thrown it. Invented. */
  thrown: number;
  /** Null for the five later cards: they are Rannie's names, not ratified rules. */
  card: CoachCard | null;
}

function ratified(card: CoachCard): CardWallEntry {
  const rung = LADDER.find((r) => r.cardId === card.id);
  const owned = rung?.status === "cleared";
  const thrownBy: Record<string, number> = {
    you_is_taboo: 4,
    stick_to_root: 7,
  };
  return {
    id: card.id,
    name: card.name,
    icon: card.icon,
    plain: card.plain,
    ownership: owned ? "owned" : rung?.status === "current" ? "next" : "later",
    level: rung?.level ?? null,
    thrown: thrownBy[card.id] ?? 0,
    card,
  };
}

/** Rannie's five later cards, names from the Figma card wall, nothing ratified. */
const LATER_CARDS: readonly CardWallEntry[] = [
  {
    id: "fact_check",
    name: "Fact Check",
    icon: "🔎",
    plain: "A claim of fact that neither of you has checked.",
    ownership: "later",
    level: null,
    thrown: 0,
    card: null,
  },
  {
    id: "divide_and_conquer",
    name: "Divide and Conquer",
    icon: "✂️",
    plain: "Two arguments in one reason. Split them.",
    ownership: "later",
    level: null,
    thrown: 0,
    card: null,
  },
  {
    id: "who_would_know",
    name: "Who Would Know?",
    icon: "🧭",
    plain: "Name who could settle this, then ask whether they have.",
    ownership: "later",
    level: null,
    thrown: 0,
    card: null,
  },
  {
    id: "cherry_picking",
    name: "Cherry Picking",
    icon: "🍒",
    plain: "The one example that fits, out of many that do not.",
    ownership: "later",
    level: null,
    thrown: 0,
    card: null,
  },
  {
    id: "steelman_not_strawman",
    name: "Steelman, Not Strawman",
    icon: "🛡️",
    plain: "Answer the strongest version of their reason, not the weakest.",
    ownership: "later",
    level: null,
    thrown: 0,
    card: null,
  },
];

export const CARD_WALL: readonly CardWallEntry[] = [
  ...COACH_CARDS.map(ratified),
  ...LATER_CARDS,
];

export function ownedCards(): CardWallEntry[] {
  return CARD_WALL.filter((c) => c.ownership === "owned");
}

// ---------------------------------------------------------------------------
// Coach personas (per account, BIZ-T260823-68)
// ---------------------------------------------------------------------------

export interface CoachPersona {
  id: string;
  name: string;
  emoji: string;
  /** How this coach talks, one line. */
  manner: string;
  /** Locked personas unlock later; the rule is not designed. */
  locked: boolean;
}

export const COACH_PERSONAS: readonly CoachPersona[] = [
  {
    id: "patient-pia",
    name: "Patient Pia",
    emoji: "🧑🏽‍🏫",
    manner: "Waits, then asks one question. Never tells you the answer first.",
    locked: false,
  },
  {
    // Drawn as "Drill-Sergeant Dev" in the Figma. Renamed: see the header.
    id: "firm-fikri",
    name: "Firm Fikri",
    emoji: "🧑🏾‍⚖️",
    manner: "Short and direct. Names the card, points at the words, moves on.",
    locked: true,
  },
  {
    id: "peppy-paz",
    name: "Peppy Paz",
    emoji: "🧑🏻‍🎤",
    manner: "Cheers the good reasons as loudly as the missed ones.",
    locked: true,
  },
];

export const DEFAULT_COACH_PERSONA_ID = "patient-pia";

// ---------------------------------------------------------------------------
// Profile stats
// ---------------------------------------------------------------------------

export interface ProfileStats {
  gamesPlayed: number;
  gamesThisWeek: number;
  /** Total points from throws. Invented; see THROW_POINTS. */
  points: number;
  /** Rannie's number, out of 10. No formula exists. */
  cooperationScore: number;
  /** "Top N% globally". Rannie's number. */
  cooperationPercentile: number;
  /** Rannie's number. */
  ladderRank: number;
  /** Rannie's division label. */
  division: string;
  /** Current streak of finished games, days. Invented. */
  streakDays: number;
}

export const PROFILE_STATS: ProfileStats = {
  gamesPlayed: 47,
  gamesThisWeek: 3,
  points: 13 * THROW_POINTS,
  cooperationScore: 8.4,
  cooperationPercentile: 12,
  ladderRank: 31,
  division: "Silver",
  streakDays: 5,
};

// ---------------------------------------------------------------------------
// Certificates
// ---------------------------------------------------------------------------

export interface Certificate {
  levelId: string;
  level: number;
  title: string;
  issuedOn: string;
  cardId: string;
  bossId: string;
}

/** One per cleared rung. A fast-forwarded level leaves a gap here on purpose (guide §1.4). */
export const CERTIFICATES: readonly Certificate[] = clearedRungs().map((rung) => ({
  levelId: rung.id!,
  level: rung.level,
  title: rung.title!,
  issuedOn: rung.clearedOn!,
  cardId: rung.cardId!,
  bossId: rung.bossId!,
}));

// ---------------------------------------------------------------------------
// A finished game, for the post-game summary
// ---------------------------------------------------------------------------

export interface GameSummarySample {
  /** What happened in this game, for the summary screen. Invented. */
  threadsResolved: number;
  threadsTotal: number;
  tilesPlaced: number;
  cardsThrown: { cardId: string; count: number }[];
  pointsEarned: number;
  badgesEarned: string[];
  /** Whether this game moved the ladder. */
  rungCleared: number | null;
}

export const GAME_SUMMARY_SAMPLE: GameSummarySample = {
  threadsResolved: 4,
  threadsTotal: 4,
  tilesPlaced: 9,
  cardsThrown: [{ cardId: "stick_to_root", count: 3 }],
  pointsEarned: 3 * THROW_POINTS,
  badgesEarned: ["compression", "stick-to-root-1", "stick-to-root-2", "stick-to-root-3"],
  rungCleared: 2,
};
