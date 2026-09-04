import Link from "next/link";

import { Panel, SectionHeading } from "@/components/account/account-shell";

/**
 * The scheduled-events calendar at the foot of the profile.
 *
 * Rannie draws one on her Profile frame: dated events with sign-ups and a
 * countdown. Nothing in this codebase schedules anything, so every row here is
 * invented, and the panel says so twice: the heading is tagged SAMPLE and each
 * sign-up is visibly dead rather than a button that does nothing when pressed.
 * Steve, 2026-09-03, on exactly this class of widget: "I would rather have more
 * fake ones now as inspiration and remove them later."
 *
 * The leaderboard is linked from here because that is the one real page these
 * invented events point at, and the ladder night is the reason somebody would
 * go and look at it.
 *
 * The event names are deliberately about who is playing rather than what they
 * would argue about. A calendar of sample topics would be a politically
 * readable set nobody reviewed, and the calendar does not need one to make its
 * point.
 */

interface SampleEvent {
  when: string;
  day: string;
  title: string;
  blurb: string;
}

const EVENTS: SampleEvent[] = [
  {
    when: "Sat",
    day: "13",
    title: "Kitchen table night",
    blurb: "Bring somebody you live with and disagree with.",
  },
  {
    when: "Wed",
    day: "17",
    title: "Classroom round",
    blurb: "Two classes, paired off, one lesson period.",
  },
  {
    when: "Sat",
    day: "27",
    title: "Ladder night",
    blurb: "Open play, and the standings move afterwards.",
  },
];

export function CalendarStrip() {
  return (
    <Panel className="mb-8">
      <SectionHeading title="What is coming up" note="Sample" />
      <ul className="flex flex-col gap-3">
        {EVENTS.map((event) => (
          <li
            key={event.title}
            className="border-ink/25 bg-paper flex flex-wrap items-center gap-4 rounded-xl border p-4"
          >
            <span
              aria-hidden
              className="border-ink/25 flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border"
            >
              <span className="font-label text-ink-soft text-[10px] tracking-widest uppercase">
                {event.when}
              </span>
              <span className="font-figure text-ink text-xl leading-none font-black tabular-nums">
                {event.day}
              </span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-primary text-ink tracking-wide">{event.title}</span>
              <span className="font-secondary text-p-sm text-ink-soft">
                {event.blurb}
              </span>
            </span>
            <span className="font-label text-ink-soft border-ink/25 rounded-full border px-4 py-1.5 text-[10px] tracking-widest uppercase">
              Sign-ups not built
            </span>
          </li>
        ))}
      </ul>
      <p className="font-secondary text-p-sm text-ink-soft pt-4">
        Standings after a ladder night show up on the{" "}
        <Link href="/leaderboard" className="text-ink decoration-gold underline">
          leaderboard
        </Link>
        , which is real and counts the games actually played.
      </p>
    </Panel>
  );
}
