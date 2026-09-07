import { ADJECTIVES, NOUNS } from "./wordlist";

// Reddit-style display names, title-cased for the board. No real names ever
// reach a screen.
//
// Two words by default and three when the short pool starts colliding, Steve
// 2026-09-07: "we could stick to two for now ... and if we run out of names,
// then the people that started first get to have their cool two-word name and
// everybody else gets a three-word name". The ladder that does the falling
// back is `ensureDisplayName` in lib/db/players.ts, because only the database
// knows which names are already taken. Nothing here is aware of the other
// players; it just draws.
//
// A two-word name is one adjective and a noun. A three-word name inserts a
// second, different adjective in front of the noun, so the same draw reads as
// a longer version of the same idea rather than a different scheme.

export interface NameParts {
  first: string;
  /** Null on a two-word name. */
  second: string | null;
  noun: string;
}

/** Distinct adjectives, so the three-word pool is 74 * 73 * 117. */
export const TOTAL_COMBINATIONS =
  ADJECTIVES.length * (ADJECTIVES.length - 1) * NOUNS.length;

/** The two-word pool, which is the one that runs out first: 74 * 117. */
export const SHORT_COMBINATIONS = ADJECTIVES.length * NOUNS.length;

/** Index picker: unbiased by rejection, Web Crypto so it runs either side. */
export function randomIndex(bound: number): number {
  if (!Number.isInteger(bound) || bound < 1) {
    throw new Error(`randomIndex needs a positive bound, got ${bound}`);
  }
  const range = 2 ** 32;
  const limit = range - (range % bound);
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % bound;
  }
}

export type Picker = (bound: number) => number;

export function generateNameParts(
  pick: Picker = randomIndex,
  words: 2 | 3 = 2,
): NameParts {
  const i = pick(ADJECTIVES.length);
  // Draw the second from a pool of one fewer and step over the first, rather
  // than redrawing on a clash: it stays unbiased and it always terminates.
  // The draw happens either way so that a two-word and a three-word name
  // consume the same number of picks, which keeps a seeded picker in a test
  // predictable across both shapes.
  let j = pick(ADJECTIVES.length - 1);
  if (j >= i) j += 1;
  return {
    first: ADJECTIVES[i],
    second: words === 3 ? ADJECTIVES[j] : null,
    noun: NOUNS[pick(NOUNS.length)],
  };
}

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function formatDisplayName(parts: NameParts): string {
  return [parts.first, parts.second, parts.noun]
    .filter((word): word is string => word !== null)
    .map(titleCase)
    .join(" ");
}

export function generateDisplayName(
  pick: Picker = randomIndex,
  words: 2 | 3 = 2,
): string {
  return formatDisplayName(generateNameParts(pick, words));
}

/** A numeric tail for the last attempts, once the word space is crowded. */
export function numericTail(pick: Picker = randomIndex): string {
  return String(100 + pick(900));
}

/** URL-safe form. Derived on demand; the stored name keeps its spaces. */
export function displayNameSlug(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
