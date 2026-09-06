/**
 * A small chip marking sample data: invented numbers, dates and tiles standing
 * in ahead of the real progression engine, which waits on Nathan's script
 * (BRAIN-T260903-10, BRAIN-T260903-11). Every value the chip sits near comes
 * from lib/progression/sample.ts, never from the event log.
 *
 * A twin of this exact chip lives at
 * components/account/progression/sample-tag.tsx, built by another agent
 * working this same page area at the same time. The duplication is
 * deliberate for today, so the two of us do not collide on one shared file;
 * folding them into a single export is a fine later cleanup, not a now one.
 */
export function SampleTag() {
  return (
    <span className="font-label border-ink-soft/40 text-ink-soft inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase">
      Sample data
    </span>
  );
}
