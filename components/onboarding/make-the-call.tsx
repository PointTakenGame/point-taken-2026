"use client";

/**
 * The practice step: a real quoted line, and a binary call — does it
 * break the card, or not. Two large tappable options, icon and label each,
 * not a multiple-choice list.
 *
 * The button styling is lifted from `ThreadTokenChoices`
 * (components/board/live-board.tsx, `CHOICE_BUTTON` / `CHOICE_LABEL`), the
 * newest of this codebase's two existing two-option icon+label pickers, so
 * a "make the call" tap reads as the same kind of decision as picking a
 * resolution token on a real board.
 */

import { useState } from "react";
import type { Verdict } from "@/components/onboarding/landing-tutorial-content";

const CHOICE_BUTTON =
  "border-gray/40 bg-offwhite flex flex-1 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 p-4 shadow-md transition-transform hover:-translate-y-0.5 disabled:cursor-default disabled:opacity-60 disabled:hover:translate-y-0";

const CHOICE_LABEL =
  "font-secondary text-p-sm text-neutral-black text-center leading-tight";

export function MakeTheCall({
  prompt,
  correctVerdict,
  explain,
  onContinue,
}: {
  prompt: string;
  correctVerdict: Verdict;
  explain: string;
  onContinue: () => void;
}) {
  const [picked, setPicked] = useState<Verdict | null>(null);
  const correct = picked === correctVerdict;

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="font-label text-gray text-xs font-bold tracking-widest uppercase">
        Make the call
      </p>
      <p className="font-secondary text-neutral-black text-p-md max-w-md leading-snug">
        &ldquo;{prompt}&rdquo;
      </p>

      <div className="flex w-full max-w-xs gap-3">
        <button
          type="button"
          disabled={picked !== null}
          onClick={() => setPicked("breaks")}
          aria-pressed={picked === "breaks"}
          className={CHOICE_BUTTON}
        >
          <span aria-hidden="true" className="text-3xl leading-none">
            {"\u{1F6AB}"}
          </span>
          <span className={CHOICE_LABEL}>Breaks it</span>
        </button>
        <button
          type="button"
          disabled={picked !== null}
          onClick={() => setPicked("fine")}
          aria-pressed={picked === "fine"}
          className={CHOICE_BUTTON}
        >
          <span aria-hidden="true" className="text-3xl leading-none">
            {"✅"}
          </span>
          <span className={CHOICE_LABEL}>Fine as is</span>
        </button>
      </div>

      {picked ? (
        <div className="flex flex-col items-center gap-3" role="status">
          <p
            className={`font-label text-xs font-bold tracking-widest uppercase ${
              correct ? "text-stat-good" : "text-orange"
            }`}
          >
            {correct ? "Right call" : "Not quite"}
          </p>
          <p className="font-secondary text-gray text-p-sm max-w-md">{explain}</p>
          <button
            type="button"
            className="form-base btn-primary bg-green border-green text-neutral-black"
            onClick={onContinue}
          >
            Continue
          </button>
        </div>
      ) : null}
    </div>
  );
}
