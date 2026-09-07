import Image from "next/image";

import { badgeArt } from "@/lib/progression/art";
import { BADGES, type Badge } from "@/lib/progression/sample";
import { SampleTag } from "./sample-tag";

/**
 * The badge gallery: BADGES from lib/progression/sample.ts, grouped by the
 * level that awards them.
 *
 * Sample data throughout (BRAIN-T260903-11): no badge event type exists in
 * the catalogue yet, so nothing here is earned by anything you actually did.
 * A level with no badges (none past level 4 yet) simply has no group.
 *
 * The chip is Rannie's artwork from Badges Gallery `810:61120` (Steve,
 * 2026-09-07): a dark octagonal chip ringed in the good green, honeycombed,
 * with her own drawn glyph and the badge's name inside it (the glyphs are her
 * line art, keyed to our badge ids in lib/progression/art.ts). Deliberately not the boss
 * plaque and deliberately not a rule card, because on her three frames each
 * shelf is a different kind of object. Her chips carry no sentence, so the
 * condition sits under the chip as a caption.
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
  const art = badgeArt(badge.id);

  return (
    <li className="flex flex-col items-center gap-2">
      <div
        className={`badge-chip octagon w-full ${earned ? "" : "opacity-45 grayscale"}`}
      >
        <div className="badge-chip-face octagon honeycomb">
          {art ? (
            <Image
              src={art}
              alt=""
              width={120}
              height={120}
              className="h-8 w-8 object-contain"
            />
          ) : (
            <span aria-hidden className="text-2xl leading-none">
              {badge.icon}
            </span>
          )}
          <h4 className="font-figure text-center text-xs leading-tight font-black tracking-wide uppercase">
            {badge.name}
          </h4>
        </div>
      </div>
      <p className="font-secondary text-ink-soft text-center text-xs">
        {badge.earnedFor}
      </p>
      <p
        className={`font-label -mt-1 text-[10px] font-bold tracking-widest uppercase ${
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
  const levels = [...new Set(BADGES.map((badge) => badge.level))].sort((a, b) => a - b);

  return (
    <section className="mb-8">
      <div className="pb-4">
        <SampleTag />
      </div>
      <div className="flex flex-col gap-6">
        {levels.map((level) => (
          <div key={level}>
            <h3 className="font-label text-ink-soft border-ink-soft/25 border-b border-dashed pb-2 text-xs font-bold tracking-widest uppercase">
              Level {level}
            </h3>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-5 pt-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
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
