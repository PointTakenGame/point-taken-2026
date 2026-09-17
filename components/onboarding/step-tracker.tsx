/**
 * A 3-node progress tracker: numbered circles joined by dashed connectors,
 * the current node highlighted, a pill underneath naming the current phase.
 *
 * New, purpose-built for the landing tutorial. Nothing in this codebase
 * already draws a tracker in circles: the level ladder
 * (components/account/progression/ladder-strip.tsx) draws the same idea in
 * clipped octagons, matching the board's tile shape, which is the right call
 * for a screen about Gym levels but not for a screen about phases within one
 * card's lesson.
 */

export interface StepTrackerPhase {
  label: string;
}

export function StepTracker({
  phases,
  current,
}: {
  phases: readonly StepTrackerPhase[];
  /** Index into `phases`, 0-based. */
  current: number;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <ol className="flex items-center">
        {phases.map((phase, index) => (
          <li key={phase.label} className="flex items-center">
            {index > 0 ? (
              <span
                aria-hidden="true"
                className={`mx-1.5 h-0 w-8 border-t-2 border-dashed ${
                  index <= current ? "border-green" : "border-gray/40"
                }`}
              />
            ) : null}
            <span
              aria-hidden="true"
              className={`font-primary flex size-7 items-center justify-center rounded-full border-2 text-p-sm ${
                index < current
                  ? "border-green bg-green text-neutral-black"
                  : index === current
                    ? "border-green bg-neutral-black text-green"
                    : "border-gray/40 bg-neutral-black text-gray/70"
              }`}
            >
              {index < current ? "✓" : index + 1}
            </span>
          </li>
        ))}
      </ol>
      <span className="font-label text-green text-xs font-bold tracking-widest uppercase">
        {phases[current]?.label}
      </span>
      <span className="sr-only" role="status">
        Step {current + 1} of {phases.length}: {phases[current]?.label}
      </span>
    </div>
  );
}
