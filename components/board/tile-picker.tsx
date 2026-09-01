"use client";

import type { Side } from "@/lib/events/types";
import { SIDE_MARK } from "./side-label";

/**
 * Picking a reason that is already on the board, by looking at the reasons.
 *
 * Three places on the live board used to ask for a tile through a native
 * `<select>`: move this reason under another one, say one of their reasons
 * back to them, and hang a steelman under something. A dropdown is the wrong
 * instrument for all three. It hides every option until it is opened, it
 * truncates the ones it does show to the width of the control, and it asks the
 * player to match a line of text against a diamond they are looking at three
 * inches away. The board itself had the same problem for tile placement and it
 * was solved by making the board clickable; this is the same answer for the
 * three forms that were left behind, at the scale a sidebar can hold.
 *
 * Every choice is visible at once, as a chip carrying the side glyph and the
 * reason's opening words. Selection is a button press rather than a menu
 * commit, so the same click that reads the option also takes it.
 *
 * Deliberately not a radio group. A radio group's arrow-key roving focus would
 * change the selection on the way past an option, and here changing the
 * selection re-runs a rules check and rewrites the explanation under the form.
 * These are buttons that report which one is pressed.
 */

export type TileChoice = {
  id: string;
  side: Side;
  /** The reason's opening words, already shortened by the caller. */
  label: string;
};

const CHIP =
  "flex max-w-full items-baseline gap-1.5 rounded-md border-2 px-2 py-1 text-left font-secondary text-p-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40";
const CHOSEN = "border-gold bg-sand";
const OPEN = "border-neutral-black/30 hover:border-gold hover:bg-sand/40";

/** Plus is green and minus is orange everywhere else in the game, so here too. */
const MARK_COLOUR: Record<Side, string> = {
  plus: "text-green",
  minus: "text-orange",
};

export function TilePicker({
  legend,
  choices,
  value,
  onChange,
  disabled = false,
  noneLabel,
}: {
  legend: string;
  choices: TileChoice[];
  /** The chosen tile id, or the empty string for the `noneLabel` chip. */
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  /**
   * The wording of the leading "no tile" chip, where not choosing a tile is
   * itself a legal answer. Omitted where it is not.
   */
  noneLabel?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-1" disabled={disabled}>
      <legend className="text-p-sm">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {noneLabel ? (
          <button
            type="button"
            // Also on the fieldset, which is what makes it read as one group
            // to a screen reader. Repeated on each button because a disabled
            // fieldset does not set the button's own `disabled` property, and
            // reading that property is how everything else here asks.
            disabled={disabled}
            aria-pressed={value === ""}
            className={`${CHIP} ${value === "" ? CHOSEN : OPEN}`}
            onClick={() => onChange("")}
          >
            {noneLabel}
          </button>
        ) : null}
        {choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            disabled={disabled}
            aria-pressed={value === choice.id}
            className={`${CHIP} ${value === choice.id ? CHOSEN : OPEN}`}
            onClick={() => onChange(choice.id)}
          >
            <span aria-hidden className={`font-bold ${MARK_COLOUR[choice.side]}`}>
              {SIDE_MARK[choice.side]}
            </span>
            <span className="truncate">{choice.label}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
