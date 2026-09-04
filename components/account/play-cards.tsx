import Link from "next/link";

import { Panel, SectionHeading } from "@/components/account/account-shell";
import { ResumeOrStart } from "@/components/resume-or-start";
import { JoinByCode } from "@/components/rooms/room-entry";
import { StartLevelButton } from "@/components/gym/start-level-button";

/**
 * The two cards the profile opens with: Gym play and Live play.
 *
 * Rannie draws a two-card promo row across the top of her Profile frame, and
 * Steve ruled on 2026-09-03 that the signed-in home page is the profile with
 * these two above the stats. They sit above the ladder and the stat tiles
 * because a profile is a place you look at what you did, and the first thing
 * on it should be how to do it again.
 *
 * Live play carries the room code field, because the home page used to be
 * where that lived and this is the home page now. It is the join half only:
 * the orange button beside it already opens a room, and two ways to do the
 * same thing in one card is a puzzle rather than a choice.
 *
 * "Enter the gym" used to be a link to the /gym page. As of 2026-09-04
 * (Steve) that page is gone, so this starts `currentLevelId` directly, the
 * same way a rung on the ladder does, and a quiet second link offers the
 * ladder itself for a player who wants to pick a different level.
 */

const PILL =
  "font-primary border-ink text-ink hover:bg-sand rounded-full border px-6 py-2 tracking-wide uppercase transition-colors";

export function PlayCards({
  currentLevelId,
  resumeGameId,
  resumeWaiting,
  resumeTopic,
}: {
  currentLevelId: string;
  resumeGameId: string | null;
  resumeWaiting: boolean;
  resumeTopic: string | null;
}) {
  return (
    <div className="mb-8 grid gap-6 md:grid-cols-2">
      <Panel className="flex flex-col gap-4">
        <SectionHeading title="Gym play" />
        <p className="text-ink-soft font-secondary flex-1">
          Practise on your own against an opponent who argues badly on purpose. Four
          levels, one rule card each, and a certificate at the end of every one.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <StartLevelButton levelId={currentLevelId} className={PILL}>
            Enter the gym
          </StartLevelButton>
          <Link
            href="/#ladder"
            className="font-label text-ink-soft hover:text-ink text-xs font-bold tracking-widest uppercase transition-colors"
          >
            or pick a level
          </Link>
        </div>
      </Panel>

      <Panel className="flex flex-col gap-4">
        <SectionHeading title="Live play" />
        <p className="text-ink-soft font-secondary">
          Invite somebody you actually disagree with. One of you opens a room and reads
          out the code; the other types it in here.
        </p>
        <ResumeOrStart
          gameId={resumeGameId}
          waiting={resumeWaiting}
          topic={resumeTopic}
        />
        <JoinByCode signedIn />
      </Panel>
    </div>
  );
}
