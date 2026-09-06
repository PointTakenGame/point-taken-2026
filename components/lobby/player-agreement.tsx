"use client";

import { Glyph } from "@/components/brand/art";

export interface AgreementLine {
  id: string;
  family: string;
  text: string;
  /** The full pledge sentence. Shown under the family name; `text` is the
   * short label only and would repeat the heading. */
  pledge?: string;
}

const GLYPH_FOR: Record<string, "monacle" | "heart" | "glasses" | "book" | "party"> = {
  mutual_respect: "heart",
  honest_thinking: "glasses",
  shared_facts: "book",
};

/**
 * Renders a pledge string: newlines become short paragraphs and a word
 * wrapped in single asterisks is italic. Steve wrote the pledges this way on
 * 2026-09-05 ("They *might* even change my mind"), and both the lobby and
 * the Gym's agreement screen read the same strings from `SIGNING_LINES`.
 */
export function PledgeText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={`flex flex-col gap-1 ${className ?? ""}`}>
      {text.split("\n").map((paragraph, i) => (
        <span key={i}>
          {paragraph
            .split(/(\*[^*]+\*)/)
            .map((part, j) =>
              part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
                <em key={j}>{part.slice(1, -1)}</em>
              ) : (
                <span key={j}>{part}</span>
              ),
            )}
        </span>
      ))}
    </span>
  );
}

interface PlayerAgreementProps {
  lines: readonly AgreementLine[];
  signed: boolean;
  peerSigned: boolean;
  disabled?: boolean;
  reason?: string;
  onSign: () => void;
}

/**
 * The retired client's PlayerAgreement.vue checked each line independently.
 * This game signs all lines in one action, so every row reflects the same
 * `signed` flag instead of its own checkbox state.
 */
export function PlayerAgreement({
  lines,
  signed,
  peerSigned,
  disabled = false,
  reason,
  onSign,
}: PlayerAgreementProps) {
  return (
    /*
      No bg/border/padding of its own: BRAIN-T260831-76 nests this inside a
      white card in game-setup.tsx, and doubling the box here just draws a
      second border around the first for no reason.
    */
    <div className="mx-auto flex w-full max-w-[700px] flex-col gap-1">
      {lines.map((line) => (
        <div key={line.id} className="flex items-center gap-3 py-1.5">
          <span
            className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border-2 transition ${
              signed ? "border-gold" : "border-neutral-black"
            }`}
          >
            {signed ? <span className="bg-neutral-black h-3 w-3 rounded-full" /> : null}
          </span>
          <Glyph name={GLYPH_FOR[line.id] ?? "monacle"} size={32} className="flex-none" />
          <span className="flex flex-col gap-0.5">
            <h3 className="font-secondary text-p-sm text-neutral-black font-bold">
              {line.family}
            </h3>
            <PledgeText
              text={line.pledge ?? line.text}
              className="font-secondary text-p-sm text-gray"
            />
          </span>
        </div>
      ))}
      <button
        type="button"
        disabled={disabled}
        title={reason}
        onClick={onSign}
        className="font-secondary text-p-sm border-neutral-black mt-2 self-start rounded-full border-2 px-4 py-1 font-bold disabled:opacity-40"
      >
        {signed ? "Signed" : "I stand behind all three"}
      </button>
      <p className="font-secondary text-p-sm text-gray">
        {peerSigned ? "Your peer has signed." : "Your peer has not signed yet."}
      </p>
    </div>
  );
}
