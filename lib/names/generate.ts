import { ADJECTIVES, NOUNS } from "./wordlist";

// Reddit-style three-word display names: two distinct adjectives and a noun,
// title-cased for the board. No real names ever reach a screen.

export interface NameParts {
  first: string;
  second: string;
  noun: string;
}

/** Distinct adjectives, so the pool is 74 * 73 * 117. */
export const TOTAL_COMBINATIONS =
  ADJECTIVES.length * (ADJECTIVES.length - 1) * NOUNS.length;

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

export function generateNameParts(pick: Picker = randomIndex): NameParts {
  const i = pick(ADJECTIVES.length);
  // Draw the second from a pool of one fewer and step over the first, rather
  // than redrawing on a clash: it stays unbiased and it always terminates.
  let j = pick(ADJECTIVES.length - 1);
  if (j >= i) j += 1;
  return {
    first: ADJECTIVES[i],
    second: ADJECTIVES[j],
    noun: NOUNS[pick(NOUNS.length)],
  };
}

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function formatDisplayName(parts: NameParts): string {
  return [parts.first, parts.second, parts.noun].map(titleCase).join(" ");
}

export function generateDisplayName(pick: Picker = randomIndex): string {
  return formatDisplayName(generateNameParts(pick));
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
