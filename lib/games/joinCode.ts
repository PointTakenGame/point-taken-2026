import { randomIndex, type Picker } from "@/lib/names/generate";

/**
 * Room codes for live games: the string one player reads aloud to another.
 *
 * The alphabet drops the four glyphs that get misread when a code is spoken or
 * handwritten, 0/O and 1/I, a rule carried over from the old stack
 * (BRAIN-T260713-12). Six characters from 32 is about 1.07 billion codes, so
 * collisions are rare rather than impossible, and only among games you could
 * still join: `games_join_code_open_key` is a partial unique index that ignores
 * ended games, so retired codes come back into circulation. `createGame`
 * handles the retry; the unbiased picker lives beside the name generator.
 */

export const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const JOIN_CODE_LENGTH = 6;

export function generateJoinCode(pick: Picker = randomIndex): string {
  let code = "";
  for (let i = 0; i < JOIN_CODE_LENGTH; i += 1) {
    code += JOIN_CODE_ALPHABET[pick(JOIN_CODE_ALPHABET.length)];
  }
  return code;
}
