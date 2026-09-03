import { coachCardsMatchDeck } from "@/lib/coach/cards";
import { getPlayerStats } from "@/lib/db/stats";
import { currentPlayerId } from "@/lib/supabase/session";
import {
  AccountHeading,
  AccountShell,
  Panel,
  SectionHeading,
} from "@/components/account/account-shell";
import { CardWall } from "@/components/cards/card-wall";
import { BossCollection } from "@/components/cards/boss-collection";
import { BadgeGallery } from "@/components/cards/badge-gallery";
import { StartPlaying } from "../account/start-playing";

/**
 * The deck, and what this player has done with it: rule cards, bosses, and
 * badges, in that order.
 *
 * Rannie draws this surface as CARDS & BADGES. The 2026-09-02 pull splits it
 * into three frames: Rule Cards `790:97607`, Boss Collection `790:111876`, and
 * Badges Gallery `810:61120` (spec BRAIN-T260902-21). The `730:19646` cited
 * here before belongs to a superseded generation of the file.
 *
 * Bosses and badges were left out entirely until now: every one of them hangs
 * off a level ladder, a card set beyond the ratified four, or a badge taxonomy,
 * none of which were built, and inventing thresholds here would have shipped
 * a progression system by accident. Steve's 2026-09-03 ruling changed that
 * (BRAIN-T260903-10 for the rule-card wall, BRAIN-T260903-11 for bosses and
 * badges): "these are just tiles on a website with db queries behind them. I
 * would rather have more fake ones now as inspiration and remove them later."
 * All three sections below are built, and everything past the four ratified
 * cards is invented sample data from lib/progression/sample.ts, flagged with
 * SampleTag rather than presented as fact. The file has a comment at its top
 * naming exactly what is ratified and what is not; that comment is the source
 * to update, not this one, when a card, boss, or badge moves from invented to
 * real.
 *
 * The rule-card counts are the one thing here that were never sample: three
 * numbers, and they are three different relationships to the same rule:
 *
 *   thrown   you called this on the other player's reason.
 *   coached  your own coach raised it about yours. Only you ever see this.
 *   held     nothing yet. The deck is the same four for everyone in the first
 *            release, so "held" would be a column of identical ticks.
 *
 * There is no total, no ranking of the four, and no best card. A player who
 * throws "No Exaggeration" nine times is not winning at anything, and a layout
 * that sorted by count would quietly say they were.
 *
 * Rebuilt 2026-09-02 into the account hub as its Cards & Badges tab, so the
 * four account pages share one chrome. Her Rule Cards frame draws eleven cards
 * in a level-gated grid, each locked until its level; ours now does the same,
 * with the four ratified cards owned by everyone from the first game (a
 * decided difference, not a gap: the deck is deliberately small and ungated in
 * the first release) and five later cards shown locked, as sample inspiration
 * for what a fuller deck looks like.
 */

export const dynamic = "force-dynamic";

export default async function CardsPage() {
  const playerId = await currentPlayerId();

  if (!playerId) {
    return (
      <AccountShell tab="cards">
        <AccountHeading title="Cards & badges">
          You are not signed in. Starting a game gives you a name, an account, and the
          same four cards everyone gets.
        </AccountHeading>
        <Panel className="flex max-w-2xl flex-col items-start gap-4">
          <StartPlaying />
        </Panel>
      </AccountShell>
    );
  }

  const stats = await getPlayerStats(playerId);

  // A card the coach cites but nobody holds would be a rule the player cannot
  // answer. Surfaced rather than swallowed, because the two lists are edited in
  // different files and this page is where the drift would first be visible.
  const decksAgree = coachCardsMatchDeck();

  return (
    <AccountShell tab="cards">
      <AccountHeading title="Cards & badges">
        Everyone holds these four. Throwing one says a reason broke that rule; the other
        player answers it, or rewrites. Your coach reads from the same four, so there is
        never a rule raised at you that you do not already hold.
      </AccountHeading>

      {decksAgree ? null : (
        <p className="font-label border-stat-warm text-stat-warm bg-card mb-6 rounded-xl border-[1.5px] p-4 text-sm">
          The coach and the deck have drifted apart. Someone edited one list and not the
          other: see lib/coach/cards.ts and lib/board/setup.ts.
        </p>
      )}

      <CardWall
        thrownById={stats.cards_thrown_by_id}
        coachedById={stats.coach_flags_by_id}
      />

      <Panel className="mb-8">
        <SectionHeading title="Cards you turned down" />
        <p className="font-secondary text-ink-soft text-p-sm">
          {stats.card_throws_declined === 0
            ? "None yet. When someone throws a card at one of your reasons you can rewrite the reason, or you can say the card does not fit. Saying it does not fit is a move, and it gets counted here."
            : `${stats.card_throws_declined}. Each one is a card thrown at a reason of yours that you answered by disputing the card rather than by rewriting.`}
        </p>
      </Panel>

      <BossCollection />

      <BadgeGallery />
    </AccountShell>
  );
}
