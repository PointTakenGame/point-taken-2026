import { BADGES, earnedBadges, type Badge } from "@/lib/progression/sample";
import { SectionHeading } from "@/components/account/account-shell";
import { SampleTag } from "./sample-tag";

/**
 * The badge gallery: BADGES from lib/progression/sample.ts, grouped by the
 * level that awards them.
 *
 * Sample data throughout (BRAIN-T260903-11): no badge event type exists in
 * the catalogue yet, so nothing here is earned by anything you actually did.
 * A level with no badges (none past level 4 yet) simply has no group.
 *
 * Fixed locale so a server render and a client hydration agree; this
 * component renders once server-side and does not need the reader's own
 * timezone the way a live game date would.
 */

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function BadgeTile({ badge }: { badge: Badge }) {
  const earned = badge.earnedOn !== null;

  return (
    <li
      className={`sticker flex flex-col items-center gap-1 p-4 text-center ${
        earned ? "" : "opacity-50 grayscale"
      }`}
    >
      <span aria-hidden className="text-2xl">
        {badge.icon}
      </span>
      <h4 className="font-figure text-ink text-sm font-black tracking-wide uppercase">
        {badge.name}
      </h4>
      <p className="font-secondary text-ink-soft text-xs">{badge.earnedFor}</p>
      <p
        className={`font-label text-[10px] font-bold tracking-widest uppercase ${
          earned ? "text-stat-good" : "text-ink-soft"
        }`}
      >
        {earned
          ? DATE_FORMAT.format(new Date(badge.earnedOn as string))
          : "Not yet earned"}
      </p>
    </li>
  );
}

export function BadgeGallery() {
  const earned = earnedBadges().length;
  const levels = [...new Set(BADGES.map((badge) => badge.level))].sort((a, b) => a - b);

  return (
    <section className="mb-8">
      <SectionHeading
        title="Badges"
        note={`${earned} of ${BADGES.length} earned`}
        noteTone="good"
      />
      <div className="pb-4">
        <SampleTag />
      </div>
      <div className="flex flex-col gap-6">
        {levels.map((level) => (
          <div key={level}>
            <h3 className="font-label text-ink-soft pb-3 text-xs font-bold tracking-widest uppercase">
              Level {level}
            </h3>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {BADGES.filter((badge) => badge.level === level).map((badge) => (
                <BadgeTile key={badge.id} badge={badge} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
