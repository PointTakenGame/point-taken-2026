/**
 * One number on the profile, with the word for what it counts.
 *
 * Shared rather than local to the account page because the streak counters are
 * a client component and have to look like their neighbours. All of these
 * numbers are personal and non-comparative by decision (BIZ-T260822-05): there
 * is no rank here, and nothing on this page is anybody else's number.
 */
export function Counter({
  label,
  value,
  unit,
  note,
}: {
  label: string;
  value: number;
  /** A word after the number, when the number is not self-describing. */
  unit?: string;
  /** A smaller second line, for a rate or a recent change. */
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-current/15 p-4">
      <div className="text-2xl font-semibold tabular-nums">
        {value}
        {unit ? (
          <span className="ml-1 text-base font-normal opacity-70">{unit}</span>
        ) : null}
      </div>
      <div className="text-sm opacity-70">{label}</div>
      {note ? <div className="text-sm opacity-50">{note}</div> : null}
    </div>
  );
}
