"use client";

import type { ReactNode, RefObject } from "react";
import { TilePopover } from "@/components/ui/tile-popover";
import { TileShape } from "@/components/board/tile-shape";

/**
 * A rule card: a reference a player reads, not a transient pop-up with a
 * decision in it. Ported from the retired client's `RuleCard.vue` (164
 * lines), which drew its own tile pair and its own card chrome from
 * scratch. Here the card pair reuses `TileShape`, this codebase's existing
 * tile primitive, and the surrounding chrome is `TilePopover` configured
 * with `body: { kind: "none" }` and the card's own content passed through
 * `footnote`, which is the one region TilePopover renders for a body-less
 * pop-up. No `onConfirm` or `onCancel`: the only action here is closing it.
 *
 * `nuclear waste`, the retired card's example topic, is replaced with the
 * office thermostat throughout, per the political-neutrality rule in this
 * repo's own CLAUDE.md: a politically readable example needs an equally
 * vivid opposite-side counterpart or it should not be the example at all,
 * and a thermostat argument makes the same structural point (a vague or
 * exaggerated claim, a personal jab, a fact nobody has sourced) without
 * reading as a stance on anything.
 */

export type RuleCardType = "mutual-respect" | "honest-thinking" | "shared-facts";

interface RuleCardContent {
  header: string;
  subheader: string;
  agreement: string;
  tile1: string;
  tile2: string;
  /** Tailwind background utility for this card's swatch, from the design system's secondary/warm colours. */
  swatchClass: string;
  notAllowed: ReactNode[];
}

const RULE_CARD_CONTENT: Record<RuleCardType, RuleCardContent> = {
  "mutual-respect": {
    header: "Mutual Respect",
    subheader: "'You' is Taboo",
    agreement: "I won't use 'you' or 'yours'. I'll critique arguments, not people.",
    tile1: "Hmm, why don't you care about the thermostat setting?",
    tile2: "Hmm, that thermostat setting wastes energy",
    swatchClass: "bg-peach",
    notAllowed: [
      <>
        &lsquo;<span className="font-bold">You</span>&rsquo;re only saying that
        because...&rsquo;
      </>,
      <>
        &lsquo;<span className="font-bold">People</span> who believe that are...&rsquo;
      </>,
      <>
        &lsquo;Why don&rsquo;t <span className="font-bold">you</span> care about...&rsquo;
      </>,
    ],
  },
  "honest-thinking": {
    header: "Honest Thinking",
    subheader: "Let's Clarify?",
    agreement: "I'll clarify claims that are vague, oversimplified, or exaggerated.",
    tile1: "Hmm, the thermostat setting isn't so bad",
    tile2: "Hmm, a couple degrees doesn't really affect anyone's comfort",
    swatchClass: "bg-mint",
    notAllowed: [
      <>
        &lsquo;X is important&rsquo; <span className="font-bold">(for what?)</span>
      </>,
      <>
        &lsquo;Y causes issues&rsquo; <span className="font-bold">(what issues?)</span>
      </>,
      <>
        &lsquo;There are many alternatives to Z&rsquo;{" "}
        <span className="font-bold">(for example..?)</span>
      </>,
    ],
  },
  "shared-facts": {
    // Steve, 2026-09-05: the family is now called Shared Evidence; the key
    // and the card ids keep the old spelling.
    header: "Shared Evidence",
    subheader: "Fact Check?",
    agreement:
      "I'm willing to collaboratively track facts down, without bias for 'my side'. A shared source is a good start (at least it has citations).",
    tile1: "Hmm, it's true: the thermostat has been set to 68 since March",
    tile2: "Hmm, it's true: facilities changed it twice in April (shared log)",
    swatchClass: "bg-sand",
    notAllowed: [
      <>
        &lsquo;<span className="font-bold">Everybody</span> knows...&rsquo;
      </>,
      <>
        &lsquo;The outcome is <span className="font-bold">always/never</span>...&rsquo;
      </>,
      <>
        &lsquo;<span className="font-bold">Most people</span> from Group X are...&rsquo;
      </>,
    ],
  },
};

/** The retired card's diagonal-strike overlay, marking the first tile as the disallowed move. */
function NotAllowedStrike() {
  return (
    <div
      className="pointer-events-none absolute inset-6 top-1/2 bottom-1/2"
      aria-hidden="true"
    >
      <div className="absolute inset-0 rotate-45 border-t-2 border-orange" />
      <div className="absolute inset-0 -rotate-45 border-t-2 border-orange" />
    </div>
  );
}

export function RuleCardPopup({
  open,
  onClose,
  anchorRef,
  type,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  type: RuleCardType;
}) {
  const content = RULE_CARD_CONTENT[type];

  return (
    <TilePopover
      open={open}
      onClose={onClose}
      anchorRef={anchorRef}
      heading={content.header}
      subtitle={content.subheader}
      body={{ kind: "none" }}
      footnote={
        <div className="flex flex-col items-center gap-4 text-center">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${content.swatchClass}`}
          >
            Agreement
          </span>
          <p className="text-p-sm">{content.agreement}</p>

          <div className="flex items-center justify-center gap-4">
            <div className="relative">
              <TileShape side="neutral" size={9} watermark="reason">
                <span className="text-xs">{content.tile1}</span>
              </TileShape>
              <NotAllowedStrike />
            </div>
            <TileShape side="neutral" size={9} watermark="reason">
              <span className="text-xs">{content.tile2}</span>
            </TileShape>
          </div>

          <ul className="flex flex-col items-start gap-1 text-left">
            {content.notAllowed.map((example, index) => (
              <li key={index} className="flex items-center gap-2 text-p-sm">
                <span aria-hidden="true" className="text-orange">
                  ⊘
                </span>
                <span>{example}</span>
              </li>
            ))}
          </ul>
        </div>
      }
    />
  );
}
