"use client";

import { Glyph } from "@/components/brand/art";

export interface AgreementLine {
  id: string;
  family: string;
  text: string;
}

const GLYPH_FOR: Record<string, "monacle" | "heart" | "glasses" | "book" | "party"> = {
  mutual_respect: "heart",
  honest_thinking: "glasses",
  shared_facts: "book",
};

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
    <div className="bg-offwhite mx-auto flex max-w-[700px] flex-col gap-1 rounded-xl px-8 py-2">
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
            <p className="font-secondary text-p-sm text-gray">{line.text}</p>
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
