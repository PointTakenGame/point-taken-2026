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
    <div className="flex flex-col gap-1 rounded-2xl border-2 border-neutral-black bg-neutral-white p-4 shadow-sm">
      <div className="font-secondary text-p-sm text-gray uppercase tracking-wide">
        {label}
      </div>
      <div className="font-primary text-3xl tracking-wide tabular-nums">
        {value}
        {unit ? (
          <span className="font-secondary ml-1 text-p-md tracking-normal text-gray normal-case">
            {unit}
          </span>
        ) : null}
      </div>
      {note ? <div className="font-secondary text-p-sm text-green">{note}</div> : null}
    </div>
  );
}
