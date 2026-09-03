/**
 * A tiny chip marking a widget's figures as invented sample data.
 *
 * Steve, 2026-09-03: build the progression widgets now, on fake numbers, so
 * the screens do not wait on Nathan's script (BRAIN-T260903-10,
 * BRAIN-T260903-11). Every number behind these widgets lives in
 * lib/progression/sample.ts. This chip is how a tester looking at the Profile
 * tab is told the same thing without reading that file, so nobody files a bug
 * against an invented figure. One component, one place to delete once the
 * real engine lands and the tag comes off every widget at once.
 */
export function SampleTag() {
  return (
    <span className="font-label border-ink/30 text-ink-soft shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase">
      Sample data
    </span>
  );
}
