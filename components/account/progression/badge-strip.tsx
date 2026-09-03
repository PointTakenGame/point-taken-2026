import Link from "next/link";

import { BADGES, earnedBadges } from "@/lib/progression/sample";
import { LocalDay } from "@/components/local-day";
import { Panel, SectionHeading } from "@/components/account/account-shell";
import { SampleTag } from "./sample-tag";

/** How many of the earned badges show here before the wall takes over. */
const RECENT = 4;

/**
 * The most recently earned badges, newest first, with a link out to the full
 * wall at /cards. That page's own badge half is still off per its header
 * (BRAIN-T260817-02); this strip is the profile's own small taste of the same
 * sample data, not a promise that /cards has caught up.
 */
export function BadgeStrip() {
  const earned = earnedBadges();
  const recent = [...earned]
    .sort((a, b) => (b.earnedOn ?? "").localeCompare(a.earnedOn ?? ""))
    .slice(0, RECENT);

  return (
    <Panel className="mb-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <SectionHeading
          title="Recent badges"
          note={`${earned.length} / ${BADGES.length} earned`}
          noteTone="good"
        />
        <SampleTag />
      </div>
      {recent.length === 0 ? (
        <p className="font-secondary text-ink-soft text-p-sm">
          None yet. The first one shows up here the moment it is earned.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-4">
          {recent.map((badge) => (
            <li key={badge.id} className="sticker flex w-44 shrink-0 flex-col gap-1 p-4">
              <span aria-hidden className="text-2xl leading-none">
                {badge.icon}
              </span>
              <span className="font-figure text-ink text-base leading-tight font-black uppercase">
                {badge.name}
              </span>
              <span className="font-label text-ink-soft text-xs">
                <LocalDay iso={badge.earnedOn ?? ""} />
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="pt-4">
        <Link
          href="/cards"
          className="font-label text-ink hover:text-stat-warm text-sm font-bold transition-colors"
        >
          All badges &rarr;
        </Link>
      </div>
    </Panel>
  );
}
