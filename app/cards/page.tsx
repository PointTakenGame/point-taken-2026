import { COACH_CARDS, coachCardsMatchDeck } from "@/lib/coach/cards";
import { getPlayerStats } from "@/lib/db/stats";
import { currentPlayerId } from "@/lib/supabase/session";
import { SiteNav } from "@/components/site-nav";
import { StartPlaying } from "../account/start-playing";

/**
 * The deck, and what this player has done with it.
 *
 * Rannie's frame for this surface is called CARDS & BADGES (730:19646). Only
 * the cards half is built, and the omission is deliberate rather than pending:
 * every badge in that frame hangs off a level ladder, a ranked division or a
 * cooperation score, none of which are decided (BRAIN-T260817-02). Inventing
 * thresholds here would ship a progression system by accident, and a badge is
 * much harder to take away than to add.
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
 */

export const dynamic = "force-dynamic";

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-xl font-semibold tabular-nums">{value}</span>
      <span className="text-xs uppercase tracking-wide opacity-60">{label}</span>
    </div>
  );
}

export default async function CardsPage() {
  const playerId = await currentPlayerId();

  if (!playerId) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
        <h1 className="text-2xl font-semibold">Your cards</h1>
        <p className="opacity-70">
          You are not signed in. Starting a game gives you a name, an account, and the
          same four cards everyone gets.
        </p>
        <StartPlaying />
      </main>
    );
  }

  const stats = await getPlayerStats(playerId);

  // A card the coach cites but nobody holds would be a rule the player cannot
  // answer. Surfaced rather than swallowed, because the two lists are edited in
  // different files and this page is where the drift would first be visible.
  const decksAgree = coachCardsMatchDeck();

  return (
    <>
      <SiteNav here="cards" />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Your cards</h1>
          <p className="opacity-70">
            Everyone holds these four. Throwing one says a reason broke that rule; the
            other player answers it, or rewrites. Your coach reads from the same four, so
            there is never a rule raised at you that you do not already hold.
          </p>
        </header>

        {decksAgree ? null : (
          <p className="rounded-md border border-orange/40 p-3 text-sm text-orange">
            The coach and the deck have drifted apart. Someone edited one list and not the
            other: see lib/coach/cards.ts and lib/board/setup.ts.
          </p>
        )}

        <ul className="flex flex-col gap-4">
          {COACH_CARDS.map((card) => (
            <li
              key={card.id}
              className="flex flex-wrap items-start justify-between gap-6 rounded-lg border border-current/15 p-5"
            >
              <div className="flex min-w-56 flex-1 flex-col gap-1">
                <h2 className="flex items-center gap-2 font-semibold">
                  <span aria-hidden className="text-xl">
                    {card.icon}
                  </span>
                  {card.name}
                </h2>
                <p className="text-sm opacity-70">{card.plain}</p>
              </div>
              <div className="flex gap-8">
                <Count label="thrown" value={stats.cards_thrown_by_id[card.id] ?? 0} />
                <Count label="coached" value={stats.coach_flags_by_id[card.id] ?? 0} />
              </div>
            </li>
          ))}
        </ul>

        <section className="flex flex-col gap-2 border-t border-current/10 pt-6">
          <h2 className="font-semibold">Cards you turned down</h2>
          <p className="text-sm opacity-70">
            {stats.card_throws_declined === 0
              ? "None yet. When someone throws a card at one of your reasons you can rewrite the reason, or you can say the card does not fit. Saying it does not fit is a move, and it gets counted here."
              : `${stats.card_throws_declined}. Each one is a card thrown at a reason of yours that you answered by disputing the card rather than by rewriting.`}
          </p>
        </section>
      </main>
    </>
  );
}
