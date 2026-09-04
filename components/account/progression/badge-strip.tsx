import Link from "next/link";

import type { PlayerAwards } from "@/lib/db/awards";
import { BADGES } from "@/lib/progression/sample";
import { badgesFor } from "@/lib/progression/state";
import { LocalDay } from "@/components/local-day";
import { Panel, SectionHeading } from "@/components/account/account-shell";
import { SampleTag } from "./sample-tag";

/** How many of the earned badges show here before the wall takes over. */
const RECENT = 4;

/**
 * The most recently earned badges, newest first, with a link out to the full
 * wall at /cards. That page's own badge half is still off per its header
 * (BRAIN-T260817-02).
 *
 * Which badges this player holds is real, off their badge_granted events. The
 * names and icons beside them are not: BADGES in lib/progression/sample.ts is
 * Rannie's placeholder set and the taxonomy is still open, which is what the
 * tag on this panel now says. A badge whose id has no entry there prints its
 * id, because inventing a name for it here would be a second placeholder set.
 */
export function BadgeStrip({ awards }: { awards: PlayerAwards }) {
  const held = badgesFor(awards);
  const recent = held.slice(0, RECENT);

  return (
    <Panel className="mb-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <SectionHeading
          title="Recent badges"
          note={`${held.length} / ${BADGES.length} earned`}
          noteTone="good"
        />
        <SampleTag label="Sample names" />
      </div>
      {recent.length === 0 ? (
        <p className="font-secondary text-ink-soft text-p-sm">
          None yet. The first one shows up here the moment it is earned.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-4">
          {recent.map((badge) => (
            <li
              key={badge.badgeId}
              className="sticker flex w-44 shrink-0 flex-col gap-1 p-4"
            >
              <span aria-hidden className="text-2xl leading-none">
                {badge.display?.icon ?? "🏅"}
              </span>
              <span className="font-figure text-ink text-base leading-tight font-black uppercase">
                {badge.display?.name ?? badge.badgeId}
              </span>
              <span className="font-label text-ink-soft text-xs">
                <LocalDay iso={badge.earnedOn} />
                {badge.times > 1 ? ` · ${badge.times}x` : ""}
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
