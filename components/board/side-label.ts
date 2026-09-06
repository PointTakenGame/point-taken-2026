import type { Side } from "@/lib/events/types";

/**
 * The two sides, in glyph and in words.
 *
 * Setup asks a player to pick "Agree (+)" or "Disagree (-)", so every screen
 * after that has to use the same two phrases. A bare "+" or "-" makes the
 * player work out for themselves that the glyph was the thing they chose, and
 * on the live board it was the only label they got.
 *
 * The glyph is still the right thing where it sits beside the text it belongs
 * to, such as in front of a tile, and both live here so the pair cannot drift.
 */
export const SIDE_MARK: Record<Side, string> = { plus: "+", minus: "-" };

export const SIDE_LABEL: Record<Side, string> = {
  plus: "Agree (+)",
  minus: "Disagree (-)",
};

/**
 * The words a reason opens with, on the tile itself.
 *
 * Ported verbatim from the retired client's `Tile.vue` `tilePrefix`, which is
 * also what Rannie draws on every reason in `1064:214081`. It reads as a
 * sentence continued from whatever the tile is answering:
 *
 * - An opening reason answers the topic, so it says yes or no to it outright.
 * - A reason under one of your own side's reasons is agreeing and adding, so
 *   it just says "Because".
 * - A reason under the other side's is a rebuttal, and gets "Hmm", which is
 *   the game's whole posture in one word: not "wrong", not "actually", just
 *   somebody stopping to think.
 *
 * `parentSide` is null for an opening reason, whose parent is the topic.
 */
export function tileLead(
  side: Side,
  isOpeningReason: boolean,
  parentSide: Side | null,
): string {
  if (isOpeningReason) return side === "plus" ? "Yes, because" : "No, because";
  return parentSide === side ? "Because" : "Hmm";
}

/**
 * Strips a duplicate lead-in from the front of a tile's own body text.
 *
 * `tileLead`, above, already prints "Yes, because" / "No, because" / "Because"
 * / "Hmm" as the tile's own sentence-starter, drawn beside the body rather
 * than inside it. A player who types the same words into the box (typing
 * "Yes, because the budget is too small" into a tile that already reads "Yes,
 * because" before it) ends up with the phrase twice on one tile. This is a
 * display-only cleanup: it never touches what actually got typed, so the
 * event log and anything read back from `tile.text` elsewhere keeps the
 * player's exact words. Only the rendered body, in `TileText`, sees the
 * stripped version.
 *
 * Matches case-insensitively and tolerates the stem with or without its own
 * trailing comma, since a typed lead-in is not guaranteed to be punctuated
 * the way `tileLead` prints it.
 */
const DUPLICATE_LEAD_STEMS: readonly RegExp[] = [
  /^yes,?\s*because,?\s*/i,
  /^no,?\s*because,?\s*/i,
  /^but,?\s*/i,
  /^hmm,?\s*/i,
];

export function stripDuplicateLead(text: string): string {
  for (const stem of DUPLICATE_LEAD_STEMS) {
    if (stem.test(text)) {
      const rest = text.replace(stem, "");
      return rest.length > 0 ? rest.charAt(0).toUpperCase() + rest.slice(1) : rest;
    }
  }
  return text;
}
