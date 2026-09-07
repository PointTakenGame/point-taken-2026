"use client";

import { RuleCardFace } from "@/components/board/rule-card-face";
import { coachCard } from "@/lib/coach/cards";

/**
 * The hand, along the bottom of the board.
 *
 * Rannie's `1064:214081` puts the cards you hold under the board as a row of
 * round buttons, which is the retired client's hand moved out of the tile list
 * and onto the screen. Throwing one is two clicks and always in this order:
 * arm the card here, then click the reason it answers. The board is where the
 * reasons are, so the target is picked on the board.
 *
 * The badge is a record, not a supply. Nothing in `canThrowCard` limits how
 * many times a card may be played across a game; what it forbids is playing
 * the same card twice on the same reason. So the number says how often you
 * have reached for this card, which is the thing worth knowing about your own
 * play, and no card ever runs out.
 *
 * Every card in the deck is shown whether or not it can be thrown at this
 * instant, for the reason CardHand gives: a hand that quietly loses cards is a
 * hand you cannot learn.
 *
 * Arming a card also brings up a full-size copy of it, standing on the tray
 * above the button (Steve, 2026-09-06: "clicking 'you is taboo' card should
 * bring up a copy of the card"). One click does both, which is not a
 * compromise between two features: every variant of Rannie's `game bar`
 * (875:65982) is this tray with exactly one card expanded in place, so the
 * expanded card IS how the tray shows what is armed. It also puts the card's
 * own instructions in front of the player at the one moment they are about to
 * act on them, and clicking the same card again puts it away and disarms.
 */
export function RuleCardTray({
  deck,
  counts,
  armedCardId,
  onArm,
  hint,
}: {
  /** Card ids in play in this game, from `cardsInPlay(board)`. */
  deck: readonly string[];
  /** How many times this player has played each card, by card id. */
  counts: Readonly<Record<string, number>>;
  armedCardId: string | null;
  onArm: (cardId: string | null) => void;
  /** What to say under the row: the prompt to pick a target, or a refusal. */
  hint: string | null;
}) {
  if (deck.length === 0) return null;

  return (
    <div data-ui="card-tray" className="w-[34rem]">
      {/* The label is a tab on the bar's top edge, not a line inside it,
          which is how Rannie draws it: the tray reads as a thing pulled up
          from the bottom of the screen rather than as another card floating
          over the board. */}
      <span className="border-gray/30 bg-neutral-black text-offwhite font-primary text-p-sm relative z-10 ml-4 inline-block rounded-t-lg border border-b-0 px-4 pt-1 pb-1 tracking-wide uppercase">
        My rule cards
      </span>
      <div className="border-gray/30 bg-offwhite -mt-px flex flex-col items-center gap-2 rounded-2xl rounded-tl-none border px-5 py-3 shadow-lg">
        <div className="flex items-center gap-3">
          {deck.map((cardId) => {
            const card = coachCard(cardId);
            const armed = armedCardId === cardId;
            const count = counts[cardId] ?? 0;
            return (
              <div key={cardId} className="relative">
                {armed && (
                  <div className="absolute bottom-full left-1/2 z-20 mb-3 -translate-x-1/2">
                    <RuleCardFace cardId={cardId} />
                  </div>
                )}
                <button
                  type="button"
                  aria-pressed={armed}
                  title={card ? `${card.name}. ${card.plain}` : cardId}
                  onClick={() => onArm(armed ? null : cardId)}
                  className={`relative flex size-12 cursor-pointer items-center justify-center rounded-xl border-2 text-2xl transition-colors ${
                    armed
                      ? "border-neutral-black bg-sand"
                      : "border-gray/30 bg-offwhite hover:bg-sand/40"
                  }`}
                >
                  <span aria-hidden="true">{card ? card.icon : "?"}</span>
                  <span className="sr-only">{card ? card.name : cardId}</span>
                  {count > 0 && (
                    <span className="bg-neutral-black text-offwhite absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full text-[11px] font-semibold">
                      {count}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
        {hint && <span className="text-p-sm text-gray text-center">{hint}</span>}
      </div>
    </div>
  );
}
