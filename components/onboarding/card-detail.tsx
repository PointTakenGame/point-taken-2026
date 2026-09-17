"use client";

/**
 * The expanded view of a tapped rule card: a colored header (icon, name,
 * close), a 2x2 Examples grid (two that break the card, two that don't,
 * each a real line quoted from this game's own content), a one-line
 * takeaway, and a primary CTA onward.
 *
 * New, purpose-built for the landing tutorial. `RuleCardFace`
 * (components/board/rule-card-face.tsx) is reused for the collapsed,
 * tappable card that opens this; this detail view itself has no existing
 * counterpart to adapt (see the header comment on RuleCardFace: "clicking a
 * card should bring up a copy of the card... over the tray", which is a
 * different layout problem than a standalone landing page with no tray).
 */

import { coachCard } from "@/lib/coach/cards";
import type { Example } from "@/components/onboarding/landing-tutorial-content";

const HEADER_TONE: Record<number, string> = {
  0: "bg-peach",
  1: "bg-mint",
  2: "bg-sand",
  3: "bg-tile-plus-wash",
};

function ExampleCell({ example }: { example: Example }) {
  const breaks = example.verdict === "breaks";
  return (
    <div
      className={`flex flex-col gap-1.5 rounded-xl border p-3 ${
        breaks ? "border-orange/50 bg-orange/10" : "border-green/50 bg-green/10"
      }`}
    >
      <span
        aria-hidden="true"
        className={`text-lg leading-none ${breaks ? "text-orange" : "text-stat-good"}`}
      >
        {breaks ? "\u{1F6AB}" : "✅"}
      </span>
      <p className="font-secondary text-p-sm text-neutral-black leading-snug">
        &ldquo;{example.text}&rdquo;
      </p>
      <span className="font-secondary text-gray text-xs">{example.note}</span>
    </div>
  );
}

export function CardDetail({
  cardId,
  cardIndex,
  examples,
  takeaway,
  onClose,
  onContinue,
}: {
  cardId: string;
  /** Which of the four cards this is, 0-based: picks the header tint. */
  cardIndex: number;
  examples: readonly [Example, Example, Example, Example];
  takeaway: string;
  onClose: () => void;
  onContinue: () => void;
}) {
  const card = coachCard(cardId);
  if (!card) return null;

  return (
    <div className="border-gray/30 bg-offwhite overflow-hidden rounded-2xl border shadow-lg">
      <header
        className={`flex items-center gap-3 px-5 py-4 ${HEADER_TONE[cardIndex % 4]}`}
      >
        <span aria-hidden="true" className="text-3xl leading-none">
          {card.icon}
        </span>
        <h3 className="font-primary text-p-lg text-neutral-black flex-1">{card.name}</h3>
        <button
          type="button"
          className="btn-icon text-neutral-black/70 hover:text-neutral-black"
          aria-label="Collapse card"
          onClick={onClose}
        >
          {"×"}
        </button>
      </header>

      <div className="flex flex-col gap-4 p-5">
        <p className="font-secondary text-gray text-p-sm">{card.throwWhen}</p>

        <div>
          <p className="font-label text-gray mb-2 text-xs font-bold tracking-widest uppercase">
            Examples
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {examples.map((example, index) => (
              <ExampleCell key={index} example={example} />
            ))}
          </div>
        </div>

        <p className="font-secondary text-neutral-black text-p-sm italic">{takeaway}</p>

        <button
          type="button"
          className="form-base btn-primary bg-green border-green text-neutral-black self-start"
          onClick={onContinue}
        >
          Try it yourself
        </button>
      </div>
    </div>
  );
}
