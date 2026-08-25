"use client";

import { useState } from "react";
import { SideGlyph } from "@/components/board/tile-shape";
import { SIDE_LABEL } from "./side-label";
import type { Side } from "@/lib/events/types";

/**
 * "And choose your stance": the two-button pick between Plus and Minus.
 * Ported from the retired client's `RoleSelection.vue`: same heading, same
 * pair of buttons, same border/text colour swap on hover-or-selected, same
 * horizontal mirror on the Minus icon when it goes active. That component
 * used the literal words "Plus" and "Minus"; this one uses `SIDE_LABEL`
 * instead, because `side-label.ts` asks every post-setup screen to share
 * the same two phrases rather than each inventing its own.
 *
 * Presentation only, same split as `ResolutionPicker`: this component holds
 * no game rules and calls no server action. The caller decides what is
 * disabled and why, and what happens on a pick.
 */

const SIDES: readonly Side[] = ["plus", "minus"];

const SIDE_BORDER_ACTIVE: Record<Side, string> = {
  plus: "border-green",
  minus: "border-orange",
};

const SIDE_TEXT_ACTIVE: Record<Side, string> = {
  plus: "text-green",
  minus: "text-orange",
};

export function StancePicker({
  value,
  onPick,
  disabled = false,
  disabledSides = [],
  reasons = {},
}: {
  /** The side already chosen, if any. Drawn active even without a hover. */
  value: Side | null;
  onPick: (side: Side) => void;
  /** Disables both buttons, e.g. while a pick is in flight. */
  disabled?: boolean;
  /** Individually disabled sides, e.g. a side already taken by the other player. */
  disabledSides?: readonly Side[];
  /** Tooltip text for a disabled side, keyed by side. */
  reasons?: Partial<Record<Side, string>>;
}) {
  const [hovered, setHovered] = useState<Side | null>(null);

  return (
    <div className="flex flex-col items-center gap-3">
      <h3 className="font-secondary text-p-sm text-neutral-black text-center font-semibold">
        And choose your stance
      </h3>
      <div className="flex flex-row items-center gap-10">
        {SIDES.map((side) => {
          const isDisabled = disabled || disabledSides.includes(side);
          const active = value === side || hovered === side;
          return (
            <button
              key={side}
              type="button"
              aria-pressed={value === side}
              disabled={isDisabled}
              title={reasons[side]}
              onMouseEnter={() => setHovered(side)}
              onMouseLeave={() =>
                setHovered((current) => (current === side ? null : current))
              }
              onClick={() => onPick(side)}
              className={`grid h-24 w-24 place-items-center gap-1 rounded-xl border-2 transition hover:shadow-md focus:outline-none disabled:pointer-events-none disabled:opacity-40 ${
                active ? SIDE_BORDER_ACTIVE[side] : "border-gray"
              }`}
            >
              <SideGlyph side={side} active={active} className="size-12" />
              <span
                className={`font-primary text-p-sm ${active ? SIDE_TEXT_ACTIVE[side] : "text-gray"}`}
              >
                {SIDE_LABEL[side]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
