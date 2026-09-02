"use client";

import { useState } from "react";
import { SIDE_LABEL } from "./side-label";
import type { Side } from "@/lib/events/types";

/**
 * The two-button pick between Plus and Minus.
 *
 * Ported from the retired client's `RoleSelection.vue`: same pair of buttons,
 * same border/text colour swap on hover-or-selected, same horizontal mirror
 * on the Minus icon when it goes active. That component used the literal
 * words "Plus" and "Minus"; this one uses `SIDE_LABEL` instead, because
 * `side-label.ts` asks every post-setup screen to share the same two phrases
 * rather than each inventing its own.
 *
 * Its heading came over as "And choose your stance", which followed on from
 * a sentence in that client and does not follow on from anything here: it
 * sits directly under the section's own "#2 Your stance" and restates it
 * word for word. The line is spent instead on the one thing this screen
 * never said out loud, which is that the pick stops being yours to change
 * the moment somebody presses start.
 *
 * Presentation only, same split as `ResolutionPicker`: this component holds
 * no game rules and calls no server action. The caller decides what is
 * disabled and why, and what happens on a pick.
 */

const SIDES: readonly Side[] = ["plus", "minus"];

// This surface uses the "peer" art for the active state, not the plain
// plus/minus glyphs the tiles use.
const SIDE_ICON: Record<Side, { active: string; inactive: string }> = {
  plus: { active: "/icons/plus-peer.svg", inactive: "/icons/plus-notselected.svg" },
  minus: { active: "/icons/minus-peer.svg", inactive: "/icons/minus-notselected.svg" },
};

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
    <div className="flex flex-col items-center">
      <p className="font-secondary text-p-sm text-gray mb-8 max-w-xs text-center">
        Agree or disagree with the topic above. Once the game starts, your side is fixed.
      </p>
      <div className="flex flex-row items-center gap-24">
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
              className={`grid h-30 w-30 place-items-center gap-1 rounded-xl border-2 transition hover:shadow-md disabled:pointer-events-none disabled:opacity-40 ${
                active ? SIDE_BORDER_ACTIVE[side] : "border-gray"
              }`}
            >
              <img
                src={active ? SIDE_ICON[side].active : SIDE_ICON[side].inactive}
                alt=""
                aria-hidden="true"
                className={`h-18 w-18 object-contain ${
                  side === "minus" && active ? "scale-x-[-1]" : ""
                }`}
              />
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
