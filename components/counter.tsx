/**
 * One number on the profile, with the word for what it counts.
 *
 * Shared rather than local to the account page because the streak counters are
 * a client component and have to look like their neighbours. All of these
 * numbers are personal and non-comparative by decision (BIZ-T260822-05): there
 * is no rank here, and nothing on this page is anybody else's number.
 *
 * Restyled 2026-09-02 to Rannie's stat block (Figma `1066:216757`, spec
 * BRAIN-T260902-21): a small wide-tracked label in DM Sans over a large
 * condensed figure, on a sticker card. The size gap between the two is what
 * makes a row of these read as a dashboard rather than as a list of sentences,
 * so neither size is a per-call-site choice.
 */
export function Counter({
  label,
  value,
  unit,
  note,
  noteTone = "warm",
}: {
  label: string;
  value: number;
  /** A word after the number, when the number is not self-describing. */
  unit?: string;
  /** A smaller second line, for a rate or a recent change. */
  note?: string;
  /** Warm for something still moving, green for something settled. */
  noteTone?: "warm" | "good";
}) {
  return (
    <div className="sticker flex flex-col gap-1 p-4">
      {/*
        Two lines' worth of room whether or not the label needs it. "Threads
        resolved" wraps where "Games played" does not, and without a floor the
        numbers in one row of tiles sit at different heights.
      */}
      <div className="font-label text-ink-soft min-h-[2lh] text-[11px] font-bold tracking-widest uppercase">
        {label}
      </div>
      <div className="font-figure text-ink text-4xl leading-none font-black tabular-nums">
        {value}
        {unit ? (
          <span className="font-label text-ink-soft ml-1.5 text-sm font-medium tracking-normal normal-case">
            {unit}
          </span>
        ) : null}
      </div>
      {note ? (
        <div
          className={`font-label text-xs font-semibold ${
            noteTone === "good" ? "text-stat-good" : "text-stat-warm"
          }`}
        >
          {note}
        </div>
      ) : null}
    </div>
  );
}
