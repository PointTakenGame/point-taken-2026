import Link from "next/link";

import { StartLevelButton } from "@/components/gym/start-level-button";
import type { BoardState } from "@/lib/board/project";
import { coachCard } from "@/lib/coach/cards";
import { nextLevel } from "@/lib/gym/levels";
import {
  ALL_PAUSES_DISMISSED,
  levelBadges,
  levelPoints,
  levelProgress,
  type Level,
} from "@/lib/gym/script";
import { BADGES } from "@/lib/progression/sample";

/**
 * The Certificate of Agreeable Disagreement, shown where a live game shows
 * its ending. Tokens are counted from the board.
 *
 * The card, the badges and the points now come off the log too: clearing a
 * level appends level_cleared, badge_granted, points_changed and
 * certificate_granted (0014_awards.sql), and the projection folds them into
 * `board.awards`. So this screen prints what was actually saved, and the
 * certificate carries the date it was issued rather than the date it is read.
 *
 * The script fallback below is for the games that ended before those events
 * existed, where the log genuinely has nothing to print. It says so on the
 * screen rather than passing script output off as a record.
 *
 * Badge names are still sample data: BADGES in lib/progression/sample.ts is a
 * list of invented display names, and the taxonomy is open (this repo's
 * CLAUDE.md, "still moving"). The badge ids in the log are real; the words
 * beside them are not yet.
 */

const PILL =
  "font-primary rounded-full border-[1.5px] border-ink bg-orange px-5 py-2 tracking-wide uppercase text-ink transition-transform hover:-translate-y-0.5 active:translate-y-0";

const QUIET =
  "font-primary rounded-full border-[1.5px] border-ink bg-card px-5 py-2 tracking-wide uppercase text-ink transition-transform hover:-translate-y-0.5 active:translate-y-0";

export function Certificate({ level, board }: { level: Level; board: BoardState }) {
  const resolutions = board.threads.map((thread) => thread.resolution?.emoji ?? null);
  const thumbs = resolutions.filter((emoji) => emoji === "👍").length;
  const eyes = resolutions.filter((emoji) => emoji === "👀").length;
  const cleared = board.awards.levelCleared;
  const saved = cleared !== null;
  const progress = levelProgress(level, board, ALL_PAUSES_DISMISSED);

  const card = coachCard((cleared ? cleared.cardId : level.awards.cardId) ?? "");
  const points = saved ? board.awards.points : levelPoints(level, progress);
  const badgeIds = saved
    ? board.awards.badges.map((badge) => badge.badgeId)
    : levelBadges(level);
  const badges = badgeIds.map((id) => BADGES.find((badge) => badge.id === id) ?? null);
  const issued = board.awards.certificate
    ? new Date(board.awards.certificate.issuedAt).toLocaleDateString()
    : null;
  const next = nextLevel(level.id);

  return (
    <div className="dot-ground w-full">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
        <section className="sticker flex flex-col gap-5 p-8">
          <span className="font-label text-ink-soft">
            Gym · Level {level.number} cleared
          </span>
          <h1 className="font-primary text-ink text-4xl tracking-wide uppercase">
            Certificate of Agreeable Disagreement
          </h1>
          <p className="font-figure text-ink text-2xl font-black">{level.topic}</p>

          <dl className="font-secondary text-ink grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <div className="flex flex-col">
              <dt className="font-label text-ink-soft">Point taken</dt>
              <dd className="font-figure text-3xl font-black">👍 {thumbs}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="font-label text-ink-soft">Now I see why</dt>
              <dd className="font-figure text-3xl font-black">👀 {eyes}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="font-label text-ink-soft">Points</dt>
              <dd className="font-figure text-3xl font-black">{points}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="font-label text-ink-soft">Reformed</dt>
              <dd className="font-figure text-3xl font-black">
                {level.bossEmoji} {level.bossName}
              </dd>
            </div>
          </dl>

          {card ? (
            <div className="border-ink bg-card flex items-start gap-3 rounded-2xl border-[1.5px] p-4">
              <span aria-hidden className="text-3xl leading-none">
                {card.icon}
              </span>
              <div className="flex flex-col gap-1">
                <span className="font-label text-ink-soft">Card granted</span>
                <span className="font-primary text-ink tracking-wide uppercase">
                  {card.name}
                </span>
                <span className="font-secondary text-p-sm text-ink-soft">
                  {card.plain}
                </span>
              </div>
            </div>
          ) : null}

          {badges.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="font-label text-ink-soft">Badges</span>
              <ul className="flex flex-wrap gap-2">
                {badges.map((badge, index) =>
                  badge ? (
                    <li
                      key={badge.id}
                      className="border-ink bg-card font-secondary text-p-sm text-ink flex items-center gap-2 rounded-full border-[1.5px] px-3 py-1"
                    >
                      <span aria-hidden>{badge.icon}</span>
                      {badge.name}
                    </li>
                  ) : (
                    <li key={index} className="font-secondary text-p-sm text-ink-soft">
                      (unknown badge)
                    </li>
                  ),
                )}
              </ul>
            </div>
          ) : null}

          <p className="font-label text-ink-soft">
            {saved ? (
              <>
                Saved to your account{issued ? ` on ${issued}` : ""}. Badge names are
                still placeholders.
              </>
            ) : (
              <>
                Shown from the level script. This game ended before awards were recorded,
                so nothing here is saved to your account.
              </>
            )}
          </p>

          <nav className="flex flex-wrap items-center gap-3">
            {next ? (
              <StartLevelButton levelId={next.id} className={PILL}>
                Next: Level {next.number}
              </StartLevelButton>
            ) : null}
            <Link href="/gym" className={QUIET}>
              Back to the Gym
            </Link>
            <Link
              href="/account"
              className="font-secondary text-p-sm text-ink-soft underline"
            >
              Your games
            </Link>
          </nav>
        </section>
      </main>
    </div>
  );
}
