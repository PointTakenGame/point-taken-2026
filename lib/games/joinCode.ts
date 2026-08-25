import { randomIndex, type Picker } from "@/lib/names/generate";

/**
 * Room codes for live games: the string one player reads aloud to another.
 *
 * The alphabet drops the four glyphs that get misread when a code is spoken or
 * handwritten, 0/O and 1/I, a rule carried over from the old stack
 * (BRAIN-T260713-12). Five characters from 32 is about 33.5 million codes,
 * far more than a game with this many players will ever hold open at once, and
 * short enough to stay memorable. Collisions are rare rather than impossible,
 * and possible only among games you could still join: `games_join_code_open_key` is a partial unique index that ignores
 * ended games, so retired codes come back into circulation. `createGame`
 * handles the retry; the unbiased picker lives beside the name generator.
 */

export const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const JOIN_CODE_LENGTH = 5;

export function generateJoinCode(pick: Picker = randomIndex): string {
  let code = "";
  for (let i = 0; i < JOIN_CODE_LENGTH; i += 1) {
    code += JOIN_CODE_ALPHABET[pick(JOIN_CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * The typed-in form of a code, cleaned up, or null if it cannot be one.
 *
 * Players type these off a text message, so lowercase, stray spaces and a
 * hyphen in the middle all mean the code they were sent.
 */
export function normalizeJoinCode(raw: string): string | null {
  const code = raw.trim().toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== JOIN_CODE_LENGTH) return null;
  return [...code].every((ch) => JOIN_CODE_ALPHABET.includes(ch)) ? code : null;
}
