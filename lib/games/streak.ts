/**
 * How many days in a row somebody has argued with another person.
 *
 * The account entity list (BIZ-T260823-04) calls this "the one genuinely
 * motivating personal number we have", which is also why it is the one number
 * most easily made dishonest. Two rules keep it honest:
 *
 * A day counts because a game was *joined* on it, not because a game was won,
 * finished, or scored. Playing is the habit worth building, and the streak is
 * the only stat here that rewards a habit rather than an outcome.
 *
 * The day boundary is the reader's own, not the server's. A game played on a
 * Sunday evening in Chicago is a Monday in UTC, and a streak that breaks
 * because of a timezone is worse than no streak at all. That is why the fold
 * takes day keys rather than timestamps: turning an instant into a day is the
 * caller's job, done in the browser, exactly as `LocalDay` does it.
 *
 * The definition of "current" was not handed down (BIZ-T260823-04 lists the
 * streak as an addition with no wording), so this file chooses: a streak is
 * live while it could still be extended today. Yesterday's play still counts,
 * because a day is not over until it is over, and a counter that resets at
 * midnight would punish somebody who plays every evening.
 */

/** A local calendar day, ISO-8601 and sortable: `2026-08-24`. */
export type DayKey = string;

export interface Streaks {
  /** Days in the run that is still live, or 0 if the last one has lapsed. */
  current: number;
  /** The longest run ever, which may be the current one. */
  longest: number;
}

const MS_PER_DAY = 86_400_000;

/**
 * The calendar day an instant fell on, somewhere.
 *
 * `en-CA` is the shortest route to `YYYY-MM-DD` out of Intl. Passing no
 * timezone means the reader's own, which is what the browser should do; the
 * server passes "UTC" so that the markup it sends is at least deterministic.
 */
export function localDayKey(iso: string, timeZone?: string): DayKey | null {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(at);
}

/**
 * A day key as a whole number of days, so that "consecutive" is subtraction.
 *
 * Safe against daylight saving precisely because the key has already been
 * resolved to a calendar day: this is arithmetic on a date, not on an instant.
 */
function dayNumber(day: DayKey): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  const [, year, month, date] = match;
  const ms = Date.UTC(Number(year), Number(month) - 1, Number(date));
  if (Number.isNaN(ms)) return null;
  return ms / MS_PER_DAY;
}

/**
 * Fold play days into the two numbers the profile shows.
 *
 * Input may arrive in any order, may repeat a day, and may contain days after
 * `today` if a clock somewhere is wrong; all three are tolerated rather than
 * trusted. A future day is dropped, because a streak the reader has not lived
 * through yet is a bug being displayed as an achievement.
 */
export function foldStreaks(days: DayKey[], today: DayKey): Streaks {
  const now = dayNumber(today);
  if (now === null) return { current: 0, longest: 0 };

  const numbers = [...new Set(days)]
    .map(dayNumber)
    .filter((n): n is number => n !== null && n <= now)
    .sort((a, b) => a - b);

  if (numbers.length === 0) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < numbers.length; i += 1) {
    run = numbers[i] - numbers[i - 1] === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  // `run` now describes the run the last play day sits in, which is the
  // current streak only while that day is today or yesterday.
  const lapse = now - numbers[numbers.length - 1];
  return { current: lapse <= 1 ? run : 0, longest };
}
