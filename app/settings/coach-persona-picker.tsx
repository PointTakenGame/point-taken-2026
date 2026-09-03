"use client";

import { useState } from "react";

import { COACH_PERSONAS, DEFAULT_COACH_PERSONA_ID } from "@/lib/progression/sample";

/**
 * Which coach a player wants, picked once per account rather than per level
 * (BIZ-T260823-68). Rannie's Settings frame draws this row of three; this is
 * the first place in the app that reads lib/progression/sample.ts's
 * COACH_PERSONAS, so read that file's header before touching either.
 *
 * This picker does not save anything, on purpose. There is no column on the
 * players table for a chosen persona and adding one is a migration, which is
 * a core change outside this task. Selection lives in useState only, so a
 * refresh forgets it; the caption under the tiles says so in words rather
 * than letting the state quietly reset and look like a bug. Wiring it to a
 * real column is the progression layer's to add once that schema exists.
 *
 * Locked personas are shown, not hidden, so a player can see what is coming.
 * They are not clickable and carry aria-disabled rather than aria-checked
 * on a live control, and the group is a real radiogroup for the two states
 * that matter: the one persona a player can actually pick, and the one that
 * is picked.
 */
export function CoachPersonaPicker() {
  const [selectedId, setSelectedId] = useState(DEFAULT_COACH_PERSONA_ID);

  return (
    <div className="flex flex-col gap-3">
      <div
        role="radiogroup"
        aria-label="Coach persona"
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        {COACH_PERSONAS.map((persona) => {
          if (persona.locked) {
            return (
              <div
                key={persona.id}
                role="radio"
                aria-checked={false}
                aria-disabled="true"
                className="sticker flex flex-col items-center gap-1 p-4 text-center opacity-40"
              >
                <span aria-hidden className="text-3xl">
                  {persona.emoji}
                </span>
                <span className="font-figure text-ink text-lg font-black tracking-wide uppercase">
                  {persona.name}
                </span>
                <p className="font-secondary text-ink-soft text-p-sm">{persona.manner}</p>
                <span className="font-label text-ink-soft mt-1 flex items-center gap-1 text-[11px] font-bold tracking-widest uppercase">
                  <span aria-hidden>{"\u{1F512}"}</span>
                  Unlocks later
                </span>
              </div>
            );
          }

          const checked = persona.id === selectedId;

          return (
            <button
              key={persona.id}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => setSelectedId(persona.id)}
              className={`sticker flex flex-col items-center gap-1 p-4 text-center transition-transform hover:-translate-y-0.5 ${
                checked ? "border-gold ring-gold/60 ring-2" : ""
              }`}
            >
              <span aria-hidden className="text-3xl">
                {persona.emoji}
              </span>
              <span className="font-figure text-ink text-lg font-black tracking-wide uppercase">
                {persona.name}
              </span>
              <p className="font-secondary text-ink-soft text-p-sm">{persona.manner}</p>
              <span
                className={`font-label mt-1 text-[11px] font-bold tracking-widest uppercase ${
                  checked ? "text-stat-good" : "text-transparent"
                }`}
              >
                Selected
              </span>
            </button>
          );
        })}
      </div>
      <p className="font-label text-ink-soft text-[11px] font-bold tracking-widest uppercase">
        Sample data. Your choice is not saved yet.
      </p>
    </div>
  );
}
