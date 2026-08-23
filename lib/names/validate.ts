/**
 * What a player is allowed to call themselves.
 *
 * Generated names are three words and always fine. This is for the chosen ones,
 * and it is deliberately permissive: a display name is shown to exactly one
 * opponent in a two-player game, so a bad one is awkward rather than dangerous.
 * The rules here are about the name still working as a label, not about taste.
 */

export const MIN_NAME_LENGTH = 2;
export const MAX_NAME_LENGTH = 40;

/**
 * Characters that would let a name lie about the interface rather than merely
 * be ugly. Written as code point ranges rather than a character class, because
 * a regex full of invisible characters is a regex nobody can review.
 *
 * Tabs and newlines are in the first range but never reach this check: the
 * whitespace collapse below turns them into ordinary spaces first.
 */
const DECEPTIVE_RANGES: readonly (readonly [number, number])[] = [
  [0x0000, 0x001f], // C0 controls
  [0x007f, 0x009f], // delete, and the C1 controls
  [0x200b, 0x200f], // zero-width space through the right-to-left mark
  [0x202a, 0x202e], // the bidirectional embedding and override run
  [0x2066, 0x2069], // the bidirectional isolates
  // Not here: U+FEFF, the byte order mark. JavaScript counts it as whitespace,
  // so the collapse below has already turned it into an ordinary space by the
  // time this runs. Listing it would be a range that can never match.
];

function deceptive(name: string): boolean {
  // Iterating the string yields whole code points, so an astral character is
  // one item rather than two halves of a surrogate pair.
  for (const character of name) {
    const point = character.codePointAt(0) ?? 0;
    for (const [low, high] of DECEPTIVE_RANGES) {
      if (point >= low && point <= high) return true;
    }
  }
  return false;
}

export type NameVerdict =
  | { ok: true; name: string }
  | { ok: false; error: string };

/**
 * Trims, collapses runs of whitespace, and rules on the result. Returns the
 * cleaned name so callers store what was judged rather than what was typed.
 */
export function validateDisplayName(raw: string): NameVerdict {
  const name = raw.replace(/\s+/gu, " ").trim();
  const length = [...name].length;

  if (length < MIN_NAME_LENGTH) {
    return { ok: false, error: "A name needs at least two characters." };
  }
  if (length > MAX_NAME_LENGTH) {
    return {
      ok: false,
      error: `A name can be at most ${MAX_NAME_LENGTH} characters.`,
    };
  }
  if (deceptive(name)) {
    return { ok: false, error: "That name contains characters we cannot show." };
  }
  return { ok: true, name };
}
