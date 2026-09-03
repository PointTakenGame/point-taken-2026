import { COACH_CARDS, coachCardsMatchDeck } from "@/lib/coach/cards";
import { getPlayerStats } from "@/lib/db/stats";
import { currentPlayerId } from "@/lib/supabase/session";
import {
  AccountHeading,
  AccountShell,
  Panel,
  SectionHeading,
} from "@/components/account/account-shell";
import { StartPlaying } from "../account/start-playing";

/**
 * The deck, and what this player has done with it.
 *
 * Rannie draws this surface as CARDS & BADGES. The 2026-09-02 pull splits it
 * into three frames: Rule Cards `790:97607`, Boss Collection `790:111876`, and
 * Badges Gallery `810:61120` (spec BRAIN-T260902-21). The `730:19646` cited
 * here before belongs to a superseded generation of the file.
 *
 * Only the cards half is built, and the omission is deliberate rather than
 * pending: every badge in those frames hangs off a level ladder, a ranked
 * division or a cooperation score, none of which are decided
 * (BRAIN-T260817-02). Inventing thresholds here would ship a progression system
 * by accident, and a badge is much harder to take away than to add. The Boss
 * Collection is the same story one step further on: there are no bosses.
 *
 * What is here is counted, not scored. Each card carries three numbers, and
 * they are three different relationships to the same rule:
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
 * in a level-gated grid, each locked until its level; ours is four cards, all
 * held by everyone from the first game, which is a decided difference and not a
 * gap: the deck is deliberately small and ungated in the first release.
 */

export const dynamic = "force-dynamic";

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex w-20 flex-col gap-0.5">
      <span className="font-figure text-ink text-3xl leading-none font-black tabular-nums">
        {value}
      </span>
      <span className="font-label text-ink-soft text-[11px] font-bold tracking-widest uppercase">
        {label}
      </span>
    </div>
  );
}

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

      <SectionHeading
        title="Rule cards"
        note={`${COACH_CARDS.length} held`}
        noteTone="good"
      />
      <ul className="mb-8 flex flex-col gap-4">
        {COACH_CARDS.map((card) => (
          <li
            key={card.id}
            className="sticker flex flex-wrap items-start justify-between gap-6 p-5"
          >
            <div className="flex min-w-56 flex-1 flex-col gap-1">
              <h2 className="font-figure text-ink flex items-center gap-2 text-xl font-black tracking-wide uppercase">
                <span aria-hidden className="text-xl">
                  {card.icon}
                </span>
                {card.name}
              </h2>
              <p className="font-secondary text-ink-soft text-p-sm">{card.plain}</p>
            </div>
            <div className="flex gap-6">
              <Count label="thrown" value={stats.cards_thrown_by_id[card.id] ?? 0} />
              <Count label="coached" value={stats.coach_flags_by_id[card.id] ?? 0} />
            </div>
          </li>
        ))}
      </ul>

      <Panel>
        <SectionHeading title="Cards you turned down" />
        <p className="font-secondary text-ink-soft text-p-sm">
          {stats.card_throws_declined === 0
            ? "None yet. When someone throws a card at one of your reasons you can rewrite the reason, or you can say the card does not fit. Saying it does not fit is a move, and it gets counted here."
            : `${stats.card_throws_declined}. Each one is a card thrown at a reason of yours that you answered by disputing the card rather than by rewriting.`}
        </p>
      </Panel>
    </AccountShell>
  );
}
