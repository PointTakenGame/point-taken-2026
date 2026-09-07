import { coachCard } from "@/lib/coach/cards";

/**
 * A rule card, drawn at its own size, as an object the player reads.
 *
 * Ported from Rannie's `game bar` component set (Figma
 * 60wr75TY7I95UnL6jkLz2J, node 875:65982). Every variant of that set is the
 * same tray of small cards with exactly one card blown up in place above the
 * row, which is the answer to "clicking a card should bring up a copy of the
 * card": the copy belongs over the tray, not in a dialog somewhere else.
 *
 * Her measurements, kept: a 180 x 226 card at radius 14, a 166 x 140 art panel
 * at radius 7 with a tiled-diamond watermark behind a single large glyph, the
 * name in Anton over a small Noto Sans line, and a diamond level badge sitting
 * on the top-left corner. Two departures, both deliberate. The card gets the
 * account flow's border and sticker shadow, because hers is a flat white
 * rectangle on a flat white bar and ours has to float above a board. And the
 * badge number comes from `earnedAtLevel`, our ladder, not from the L2/L3/L4
 * printed in her file, which belong to the second level-naming ladder that is
 * still undecided.
 *
 * This is not `rule-card-popup.tsx`. That one is the three signing agreements
 * (Mutual Respect, Honest Thinking, Shared Facts) and is keyed on those; this
 * is the four throwable cards and is keyed on their permanent ids.
 *
 * It takes no class name and places itself nowhere. The card is `relative` for
 * its own sake, so the corner badge has something to hang off, and a caller
 * that passed `absolute` in would silently lose that fight in the cascade and
 * get a card sitting in the flow instead. A caller that wants this somewhere
 * particular positions a wrapper around it.
 */
/**
 * The same card at the size of a token, for laying on a tile.
 *
 * Steve, 2026-09-07, walking back his own earlier "six times as tall": "the
 * same height as the emoji thumb or side eye icons. it should just be a little
 * maybe 50% bigger than it is on the rule card thing on the bottom". Both
 * measurements land in the same place. A settled token badge on a tile is a
 * 56px glyph in a padded box, and the tray's card button is `size-12`, so
 * fifty percent over that is 72. This is 72 square.
 *
 * It is the full card's art panel and nothing else: the same watermark, the
 * same glyph, the same frame. At this size the name and the "throw when" line
 * would be four and two pixels of type, which is worse than absent, so they
 * are absent. The card is still named in the tooltip, in the screen-reader
 * text the caller adds, and in the coach's line about it, and the full card is
 * one click away in the tray.
 *
 * Deliberately shaped like the tray button rather than like a shrunken card:
 * a thrown card should rhyme with the card the player armed to throw it and
 * with the token badge it sits beside, because all three are the same class of
 * object, a mark laid on a reason.
 */
export function RuleCardChip({ cardId }: { cardId: string }) {
  const card = coachCard(cardId);
  if (!card) return null;

  return (
    <div
      data-rule-card-chip={cardId}
      className="border-ink bg-card shadow-sticker-sm relative size-[72px] rounded-xl border-[1.5px] p-[3px]"
    >
      <div className="bg-paper relative flex size-full items-center justify-center overflow-hidden rounded-[8px]">
        <svg
          aria-hidden="true"
          className="text-ink absolute inset-0 size-full opacity-15"
          preserveAspectRatio="none"
        >
          <pattern
            id={`rule-card-chip-weave-${cardId}`}
            width="12"
            height="12"
            patternUnits="userSpaceOnUse"
          >
            <rect
              x="3"
              y="3"
              width="6"
              height="6"
              rx="1"
              transform="rotate(45 6 6)"
              fill="currentColor"
            />
          </pattern>
          <rect
            width="100%"
            height="100%"
            fill={`url(#rule-card-chip-weave-${cardId})`}
          />
        </svg>
        <span aria-hidden="true" className="relative text-[34px] leading-none">
          {card.icon}
        </span>
      </div>
    </div>
  );
}

export function RuleCardFace({ cardId }: { cardId: string }) {
  const card = coachCard(cardId);
  if (!card) return null;

  return (
    <div
      data-rule-card-face={cardId}
      className="border-ink bg-card shadow-sticker-sm relative flex w-[180px] flex-col gap-2 rounded-[14px] border-[1.5px] p-[7px]"
    >
      {/* The art panel: her watermark grid of small diamonds, at the low
          contrast it carries in the render, with the card's glyph over it. */}
      <div className="bg-paper relative flex h-[140px] items-center justify-center overflow-hidden rounded-[7px]">
        <svg
          aria-hidden="true"
          className="text-ink absolute inset-0 size-full opacity-15"
          preserveAspectRatio="none"
        >
          <pattern
            id={`rule-card-weave-${cardId}`}
            width="17"
            height="17"
            patternUnits="userSpaceOnUse"
          >
            <rect
              x="4"
              y="4"
              width="9"
              height="9"
              rx="1"
              transform="rotate(45 8.5 8.5)"
              fill="currentColor"
            />
          </pattern>
          <rect width="100%" height="100%" fill={`url(#rule-card-weave-${cardId})`} />
        </svg>
        <span aria-hidden="true" className="relative text-[64px] leading-none">
          {card.icon}
        </span>
      </div>

      <div className="flex flex-col gap-1 px-1 pb-1">
        <span className="font-primary text-ink text-[17px] leading-tight">
          {card.name}
        </span>
        <span className="font-secondary text-ink text-[10.5px] leading-snug">
          {card.throwWhen}
        </span>
      </div>

      {/* The level badge, a diamond hung off the top-left corner. */}
      <span
        aria-hidden="true"
        className="bg-stat-good absolute -top-3 -left-3 flex size-9 rotate-45 items-center justify-center rounded-[7px]"
      >
        <span className="font-figure -rotate-45 text-[15px] font-black text-white">
          L{card.earnedAtLevel}
        </span>
      </span>
      <span className="sr-only">Earned at level {card.earnedAtLevel}</span>
    </div>
  );
}
