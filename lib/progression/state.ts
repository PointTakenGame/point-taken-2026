import type { PlayerAwards } from "@/lib/db/awards";
import { BADGES, LADDER, type Badge, type Rung } from "./sample";

/**
 * What one account has earned, in the shapes the profile widgets already draw.
 *
 * The widgets were built against lib/progression/sample.ts while nothing wrote
 * an award anywhere. Now something does (0014_awards.sql, lib/gym/awards.ts),
 * so this is the seam between the two: it takes the real `PlayerAwards` read
 * off the log and returns the same `Rung`, `Badge` and certificate shapes the
 * widgets take, with the invented parts of `sample.ts` reduced to the parts
 * that are still genuinely undecided.
 *
 * What is real after this file: which levels a player has cleared, when, which
 * cards that granted them, which badges they hold and how many times, their
 * points, and their certificates.
 *
 * What is still invented, and still carries a Sample tag on screen:
 *
 * - Rungs 5 and up. They have no level, no boss and no card, because nobody has
 *   designed them. They render locked, which is true.
 * - Every badge's display name and icon. The ids in the log are real; the words
 *   beside them are Rannie's placeholders and the taxonomy is open (this repo's
 *   CLAUDE.md, "still moving").
 * - The cooperation score, percentile, rank and division tiles, which have no
 *   formula behind them at all and are not touched here.
 *
 * Pure: no imports from the database layer, so it is testable and safe in a
 * client component. The caller does the reading.
 */

/** A badge as the strip and the gallery want it: the id is real, the words are not. */
export interface HeldBadge {
  badgeId: string;
  /** The sample entry for its name and icon, or null for an id with no entry yet. */
  display: Badge | null;
  /** How many times earned, across every game. At least 1. */
  times: number;
  /** ISO timestamp of the first time. */
  earnedOn: string;
}

export interface EarnedCertificate {
  /** 1-based level number, from the ladder. */
  level: number;
  levelId: string;
  title: string | null;
  cardId: string | null;
  bossId: string | null;
  issuedOn: string;
}

/**
 * The ladder, with each rung's status taken from what the player actually
 * cleared rather than from a hand-written status field.
 *
 * "Current" is the first designed rung that has not been cleared, so a player
 * who skipped ahead and cleared level 2 without level 1 is pointed back at
 * level 1, which is the honest answer: the ladder is what is left to do, not a
 * high-water mark.
 */
export function ladderFor(awards: PlayerAwards): Rung[] {
  const clearedAt = new Map(
    awards.clearedLevels.map((cleared) => [cleared.levelId, cleared.at]),
  );
  let currentTaken = false;

  return LADDER.map((rung) => {
    if (rung.id === null) return { ...rung, status: "locked" as const, clearedOn: null };

    const at = clearedAt.get(rung.id);
    if (at) return { ...rung, status: "cleared" as const, clearedOn: at };

    if (!currentTaken) {
      currentTaken = true;
      return { ...rung, status: "current" as const, clearedOn: null };
    }
    return { ...rung, status: "open" as const, clearedOn: null };
  });
}

/** Held badges, newest first, with sample display words attached where there are any. */
export function badgesFor(awards: PlayerAwards): HeldBadge[] {
  return [...awards.badges]
    .sort((a, b) => b.firstAt.localeCompare(a.firstAt))
    .map((badge) => ({
      badgeId: badge.badgeId,
      display: BADGES.find((entry) => entry.id === badge.badgeId) ?? null,
      times: badge.times,
      earnedOn: badge.firstAt,
    }));
}

/**
 * One certificate per level actually cleared, in level order.
 *
 * A certificate for a level that is not on the ladder is dropped rather than
 * guessed at, because a wall laid out by level number has nowhere to put it.
 */
export function certificatesFor(awards: PlayerAwards): EarnedCertificate[] {
  const rungs = new Map(LADDER.filter((rung) => rung.id).map((rung) => [rung.id, rung]));

  return awards.certificates
    .map((cert) => {
      const rung = rungs.get(cert.levelId);
      if (!rung) return null;
      return {
        level: rung.level,
        levelId: cert.levelId,
        title: rung.title,
        cardId: rung.cardId,
        bossId: rung.bossId,
        issuedOn: cert.issuedAt,
      };
    })
    .filter((cert): cert is EarnedCertificate => cert !== null)
    .sort((a, b) => a.level - b.level);
}

/** How many designed rungs exist at all, which is the denominator on the strip. */
export function designedRungs(): number {
  return LADDER.filter((rung) => rung.id !== null).length;
}
