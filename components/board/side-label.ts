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
