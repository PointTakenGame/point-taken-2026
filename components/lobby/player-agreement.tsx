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
/**
 * "Collaborate" is the word all three pledges turn on, and Steve asked for it
 * bold in each of them (2026-09-07). The pledge copy itself lives in
 * `lib/board/setup.ts`, which this lane does not edit, so the emphasis is
 * applied here where the copy is rendered rather than marked up at the source.
 * It matches the stem, so "collaborate", "collaboratively", and any later
 * inflection all take the emphasis without a second rule.
 */
const COLLABORATE = /(collaborat\w*)/gi;
/** Same pattern, anchored and without /g: a global regex keeps `lastIndex`
 *  between calls, so testing with the splitting one would match every other
 *  time. */
const IS_COLLABORATE = /^collaborat\w*$/i;

function emphasise(text: string, key: string) {
  return text.split(COLLABORATE).map((part, i) =>
    IS_COLLABORATE.test(part) ? (
      <strong key={`${key}-${i}`} className="font-bold">
        {part}
      </strong>
    ) : (
      <span key={`${key}-${i}`}>{part}</span>
    ),
  );
}

export function PledgeText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={`flex flex-col gap-1 ${className ?? ""}`}>
      {text.split("\n").map((paragraph, i) => (
        <span key={i}>
          {/*
            This split is for authored pledge copy only (SIGNING_LINES in
            lib/board/setup.ts), never for anything a player types. It does
            not handle nested or tripled asterisks: "***" renders as a single
            italic asterisk rather than three literal characters, and a
            literal asterisk (e.g. "5 * 3") will pair with the next real
            italic marker instead of being left alone. See finding 6,
            2026-09-05_pre-push-review-903fc33-7397fcc.md.
          */}
          {paragraph
            .split(/(\*[^*]+\*)/)
            .map((part, j) =>
              part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
                <em key={j}>{emphasise(part.slice(1, -1), `${i}-${j}`)}</em>
              ) : (
                <span key={j}>{emphasise(part, `${i}-${j}`)}</span>
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
