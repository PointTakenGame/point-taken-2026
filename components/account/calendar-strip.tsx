import Link from "next/link";

import { Chip } from "@/components/account/account-shell";

/**
 * The scheduled-events calendar at the foot of the profile.
 *
 * Rannie draws one on her Profile frame: dated events with sign-ups and a
 * countdown. Nothing in this codebase schedules anything, so every row here is
 * invented, and the panel says so twice: the header is tagged SAMPLE and each
 * sign-up is visibly dead rather than a button that does nothing when pressed.
 * Steve, 2026-09-03, on exactly this class of widget: "I would rather have more
 * fake ones now as inspiration and remove them later."
 *
 * Restyled 2026-09-04 to her list-card anatomy (BRAIN-T260904-40): a teal band
 * header on the card, and per row a date block, the title, a coloured category
 * chip, one line of detail, and a state button on the right. Her SIGN UP /
 * SIGNED toggle becomes real when sign-ups do; until then the slot holds the
 * "not built" pill. Her countdown-and-join detail card is not adopted: a
 * scheduled-events system is one of the undecided ones (BRAIN-T260817-02) and
 * a countdown to nothing is worse than no countdown.
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
  category: string;
  blurb: string;
}

const EVENTS: SampleEvent[] = [
  {
    when: "Sat",
    day: "13",
    title: "Kitchen table night",
    category: "Casual",
    blurb: "Bring somebody you live with and disagree with.",
  },
  {
    when: "Wed",
    day: "17",
    title: "Classroom round",
    category: "Class",
    blurb: "Two classes, paired off, one lesson period.",
  },
  {
    when: "Sat",
    day: "27",
    title: "Ladder night",
    category: "Ladder",
    blurb: "Open play, and the standings move afterwards.",
  },
];

export function CalendarStrip() {
  return (
    <section className="border-ink bg-card mb-8 overflow-hidden rounded-2xl border-[1.5px]">
      <header className="bg-stat-good text-card flex flex-wrap items-center gap-3 px-6 py-4">
        <h2 className="font-figure text-2xl font-black tracking-wide uppercase">
          Upcoming events
        </h2>
        <Chip className="bg-card/20 text-card">Sample</Chip>
        <Link
          href="/leaderboard"
          className="font-label border-card text-card hover:bg-card hover:text-stat-good ml-auto rounded-lg border-[1.5px] px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-colors"
        >
          Leaderboard
        </Link>
      </header>
      <ul className="divide-ink/15 flex flex-col divide-y">
        {EVENTS.map((event) => (
          <li key={event.title} className="flex flex-wrap items-center gap-4 px-6 py-4">
            <span
              aria-hidden
              className="border-ink flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border-[1.5px]"
            >
              <span className="font-label text-ink-soft text-[10px] tracking-widest uppercase">
                {event.when}
              </span>
              <span className="font-figure text-ink text-xl leading-none font-black tabular-nums">
                {event.day}
              </span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-primary text-ink tracking-wide">{event.title}</span>
                <Chip tone="category">{event.category}</Chip>
              </span>
              <span className="font-secondary text-p-sm text-ink-soft">
                {event.blurb}
              </span>
            </span>
            <span className="font-label text-ink-soft border-ink/30 rounded-lg border-[1.5px] px-4 py-2 text-[10px] font-bold tracking-widest uppercase">
              Sign-ups not built
            </span>
          </li>
        ))}
      </ul>
      <p className="font-secondary text-p-sm text-ink-soft px-6 pt-2 pb-5">
        Standings after a ladder night show up on the{" "}
        <Link href="/leaderboard" className="text-ink decoration-gold underline">
          leaderboard
        </Link>
        , which is real and counts the games actually played.
      </p>
    </section>
  );
}
