import { readPlayerAwards } from "@/lib/db/awards";
import type { PlayerStats } from "@/lib/db/stats";
import type { Uuid } from "@/lib/events/types";
import { SCRIPTED_LEVELS } from "@/lib/gym/levels";
import { AccountShell, Panel, SectionHeading } from "@/components/account/account-shell";
import { CalendarStrip } from "@/components/account/calendar-strip";
import { ProfileHero } from "@/components/account/hero";
import { BadgeStrip } from "@/components/account/progression/badge-strip";
import { CertificateWall } from "@/components/account/progression/certificate-wall";
import { LadderStrip } from "@/components/account/progression/ladder-strip";
import { TokenGlyph, tokenLabel } from "@/components/board/token-glyph";
import { joinedThisWeek, loadAccount } from "./data";

/**
 * The profile: who this player is and what they have done.
 *
 * It lives here rather than in `page.tsx` because two routes render it now.
 * Steve, 2026-09-03: signed in, `/` is the profile, with Gym play and Live play
 * above the stats. `/account` is the same screen, kept because it is the href
 * every existing link and the account hub's own footer already use.
 *
 * Rebuilt 2026-09-02 from Rannie's Profile frame (Figma `1066:216757`, spec
 * BRAIN-T260902-21) on Steve's instruction to make her account flow the base
 * for this area. What comes from her: the four-tab hub this page sits in, the
 * identity row of avatar-plus-name-plus-joined-date with a band of stat blocks
 * beside it, the sticker panels, the "View All" link out of a section that
 * continues on another tab, the two-card promo row at the top, the calendar at
 * the foot, and the type pairing throughout.
 *
 * The widgets her frame also draws, that an earlier ruling had left out (a
 * level ladder, a stat row with a cooperation score and a ladder rank, an
 * active boss challenge, a certificate wall, and a recent-badges strip), are
 * built above the sections listed above. Steve, 2026-09-03: the progression
 * layer behind them waits on Nathan's script, but "design the screen that
 * summarizes what happened, just fake some data," and on these specific
 * widgets, "these are just tiles on a website with db queries behind them. I
 * would rather have more fake ones now as inspiration and remove them later.
 * We will be iterating on them anyway." (BRAIN-T260903-10, BRAIN-T260903-11.)
 *
 * Those widgets were built on invented numbers, because at the time nothing
 * wrote an award anywhere. Since 0014_awards.sql something does: clearing a
 * level appends level_cleared, badge_granted, points_changed and
 * certificate_granted, and every widget above now reads this player's own
 * awards through lib/progression/state.ts. What is left of the invented set is
 * the shape of the ladder above level 4, the display names of the badges, and
 * the calendar at the foot, and only those still carry a "Sample" tag.
 *
 * The archive itself lives at /account/history, which is her own arrangement:
 * History is one of the four tabs.
 *
 * Restyled again 2026-09-04 (BRAIN-T260904-40), this time object by object
 * against the same frame, after Steve asked for the list of what she draws
 * that this page did not and agreed to all twenty items. The order of the
 * page is now hers: identity block and the two play cards as the hero, three
 * stat tiles under them, the notebook ladder with the boss briefing inside it,
 * certificates, badges, and the events list at the foot. What left the page:
 * the identity card's nine-counter grid and the streaks (the hero's three
 * tiles are the numbers that matter at a glance; the rest is History's job),
 * and the four recent matches, since History already lists every game and a
 * profile that repeats the next tab is padding. Components no longer used
 * here (Counter, StreakCounters, MatchList on this page) stay in the tree for
 * the tabs that still use them.
 */

/**
 * Which level "Enter the gym" should open: the first scripted level this
 * player has not cleared, or the first one again once all four are, so the
 * button always has something to start (BRAIN-T260904, ladder as level
 * select).
 */
function currentLevelId(clearedLevels: { levelId: string }[]): string {
  const cleared = new Set(clearedLevels.map((entry) => entry.levelId));
  const next = SCRIPTED_LEVELS.find((level) => !cleared.has(level.id));
  return (next ?? SCRIPTED_LEVELS[0]).id;
}

function Signature({ stats }: { stats: PlayerStats }) {
  const emoji = Object.entries(stats.resolutions_by_emoji);
  if (emoji.length === 0) return null;

  return (
    <Panel>
      <SectionHeading title="How your threads end" />
      <ul className="flex flex-wrap gap-6">
        {emoji.map(([mark, count]) => (
          <li key={mark} className="flex items-center gap-2">
            <TokenGlyph token={mark} size={40} />
            <span className="flex flex-col">
              <span className="font-figure text-ink text-2xl leading-none font-black tabular-nums">
                {count}
              </span>
              <span className="font-label text-ink-soft text-[11px] font-bold tracking-widest uppercase">
                {tokenLabel(mark)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export async function Profile({ playerId }: { playerId: Uuid }) {
  const [{ player, stats, games, playedAt, topics }, awards] = await Promise.all([
    loadAccount(playerId),
    readPlayerAwards(playerId),
  ]);

  // The game to offer going back to. `games` is already newest first, so the
  // first hit is the most recent one. A game underway beats a room still
  // waiting for its second player, because the argument you left in the middle
  // is more urgent than the invitation nobody accepted.
  const inFlight =
    games.find((game) => game.status === "active") ??
    games.find((game) => game.status === "lobby") ??
    null;

  const thisWeek = joinedThisWeek(playedAt);

  return (
    <AccountShell tab="profile">
      <ProfileHero
        player={player}
        playerId={playerId}
        awards={awards}
        stats={stats}
        gamesThisWeek={thisWeek}
        currentLevelId={currentLevelId(awards.clearedLevels)}
        resumeGameId={inFlight?.id ?? null}
        resumeWaiting={inFlight?.status === "lobby"}
        resumeTopic={inFlight ? (topics.get(inFlight.id)?.text ?? null) : null}
      />

      <LadderStrip awards={awards} />
      <CertificateWall awards={awards} />
      <BadgeStrip awards={awards} />

      <div className="mb-8">
        <Signature stats={stats} />
      </div>

      <CalendarStrip />
    </AccountShell>
  );
}
