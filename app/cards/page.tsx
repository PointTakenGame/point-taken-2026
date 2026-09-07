import { coachCardsMatchDeck } from "@/lib/coach/cards";
import { readPlayerAwards } from "@/lib/db/awards";
import { getPlayerStats } from "@/lib/db/stats";
import { currentPlayerId } from "@/lib/supabase/session";
import { BADGES, BOSSES, CARD_WALL, earnedBadges } from "@/lib/progression/sample";
import {
  AccountHeading,
  AccountShell,
  Chip,
  FolderTabs,
  Panel,
  SectionHeading,
} from "@/components/account/account-shell";
import { CardWall } from "@/components/cards/card-wall";
import { BossCollection } from "@/components/cards/boss-collection";
import { BadgeGallery } from "@/components/cards/badge-gallery";
import { StartPlaying } from "../account/start-playing";

/**
 * The deck, and what this player has done with it: rule cards, bosses, and
 * badges, one behind each of three folder tabs.
 *
 * Steve, 2026-09-07: "make the rule cards, bosses, and badges into a tabbed
 * format instead of a scrollable format. You can use the same tab format as
 * you use on the top now for the screen." So the sub-tabs are literally the
 * account bar's `FolderTabs`, one layer down, drawing their own rule because
 * inside the sheet there is no sheet edge to sit on.
 *
 * The tab is a URL, `?show=bosses`, not a piece of client state. Three reasons,
 * all of them the same reason: a page that is `force-dynamic` and entirely
 * server-rendered stays that way, a reload lands where you were, and a link to
 * the badge shelf is a link somebody can send. The three sections lost their
 * own `SectionHeading` in the move, because the tab above them is the heading
 * now; their counts moved to the chip beside the blurb.
 *
 * Rannie draws this surface as CARDS & BADGES. The 2026-09-02 pull splits it
 * into three frames: Rule Cards `790:97607`, Boss Collection `790:111876`, and
 * Badges Gallery `810:61120` (spec BRAIN-T260902-21). Three frames and three
 * tabs is the same split, which is the reading Steve's instruction confirms.
 * The `730:19646` cited here before belongs to a superseded generation.
 *
 * Bosses and badges were left out entirely until 2026-09-03: every one of them
 * hangs off a level ladder, a card set beyond the ratified four, or a badge
 * taxonomy, none of which were built, and inventing thresholds here would have
 * shipped a progression system by accident. Steve's ruling changed that
 * (BRAIN-T260903-10 for the rule-card wall, BRAIN-T260903-11 for bosses and
 * badges): "these are just tiles on a website with db queries behind them. I
 * would rather have more fake ones now as inspiration and remove them later."
 * All three sections are built, and everything past the four ratified cards is
 * invented sample data from lib/progression/sample.ts, flagged with SampleTag
 * rather than presented as fact. That file has a comment at its top naming
 * exactly what is ratified and what is not; it is the source to update, not
 * this one, when a card, boss, or badge moves from invented to real.
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
 * Her Rule Cards frame draws eleven cards in a level-gated grid, each locked
 * until its level. Ours draws four, gated the same way: a card is owned once
 * the level that teaches it is cleared (0014_awards.sql). Cards 5 to 11 are
 * out (Steve, 2026-09-03).
 */

export const dynamic = "force-dynamic";

const SHELVES = ["cards", "bosses", "badges"] as const;
type Shelf = (typeof SHELVES)[number];

function readShelf(raw: string | string[] | undefined): Shelf {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return SHELVES.includes(value as Shelf) ? (value as Shelf) : "cards";
}

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [playerId, params] = await Promise.all([currentPlayerId(), searchParams]);

  if (!playerId) {
    return (
      <AccountShell tab="cards">
        <AccountHeading title="Cards & badges">
          You are not signed in. Starting a game gives you a name and an account, and the
          Gym is where the cards come from.
        </AccountHeading>
        <Panel className="flex max-w-2xl flex-col items-start gap-4">
          <StartPlaying />
        </Panel>
      </AccountShell>
    );
  }

  const shelf = readShelf(params.show);

  const [stats, awards] = await Promise.all([
    getPlayerStats(playerId),
    readPlayerAwards(playerId),
  ]);

  // A card the coach cites but nobody holds would be a rule the player cannot
  // answer. Surfaced rather than swallowed, because the two lists are edited in
  // different files and this page is where the drift would first be visible.
  const decksAgree = coachCardsMatchDeck();

  const held = new Set(awards.cardIds.filter((id) => CARD_WALL.some((c) => c.id === id)));
  const reformed = BOSSES.filter((boss) => boss.status === "reformed").length;

  // Blurb and count, per shelf. The blurb is what used to sit under the page
  // title when all three were one scroll; it was only ever about the cards.
  const SHELF_COPY: Record<Shelf, { label: string; count: string; blurb: string }> = {
    cards: {
      label: "Rule cards",
      count: `${held.size} of ${CARD_WALL.length} in your hand`,
      blurb:
        "You earn these four in the Gym, one level at a time. Throwing one says a reason broke that rule; the other player answers it, or rewrites. In a live game a card is on the table only if both of you hold it, so nobody is ever called on a rule they have not been taught.",
    },
    bosses: {
      label: "Bosses",
      count: `${reformed} of ${BOSSES.length} reformed`,
      blurb:
        "Every Gym level is one opponent with one bad habit. You do not beat them, you reform them: they learn the rule you just learned, and the level ends with both of you arguing better than you started.",
    },
    badges: {
      label: "Badges",
      count: `${earnedBadges().length} of ${BADGES.length} earned`,
      blurb:
        "Small things you did well, grouped by the level that noticed them. None of them rank you against anybody, and none of them are lost by playing badly afterwards.",
    },
  };

  const copy = SHELF_COPY[shelf];

  return (
    <AccountShell tab="cards">
      <AccountHeading title="Cards & badges">
        Three shelves: the rules you can throw, the opponents who taught them to you, and
        what you picked up on the way.
      </AccountHeading>

      {decksAgree ? null : (
        <p className="font-label border-stat-warm text-stat-warm bg-card mb-6 rounded-xl border-[1.5px] p-4 text-sm">
          The coach and the deck have drifted apart. Someone edited one list and not the
          other: see lib/coach/cards.ts and lib/board/setup.ts.
        </p>
      )}

      <FolderTabs
        label="Cards and badges"
        current={shelf}
        rule
        tabs={SHELVES.map((key) => ({
          key,
          href: key === "cards" ? "/cards" : `/cards?show=${key}`,
          label: SHELF_COPY[key].label,
        }))}
      />

      <div className="flex flex-wrap items-center gap-3 pt-6 pb-4">
        <p className="font-secondary text-ink-soft text-p-sm max-w-3xl">{copy.blurb}</p>
        <Chip tone="good">{copy.count}</Chip>
      </div>

      {shelf === "cards" ? (
        <>
          <CardWall
            awards={awards}
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
        </>
      ) : null}

      {shelf === "bosses" ? <BossCollection /> : null}

      {shelf === "badges" ? <BadgeGallery /> : null}
    </AccountShell>
  );
}
