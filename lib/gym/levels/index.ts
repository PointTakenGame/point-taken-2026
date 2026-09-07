import type { Level } from "../script";
import { ONBOARDING } from "./onboarding";
import { GROUND_RULES } from "./ground-rules";
import { CLAIM_SIZE } from "./claim-size";
import { CLARITY } from "./clarity";

/** The scripted levels, in ladder order. All four are playable. */
export const SCRIPTED_LEVELS: readonly Level[] = [
  ONBOARDING,
  GROUND_RULES,
  CLAIM_SIZE,
  CLARITY,
];

export function levelById(id: string | null | undefined): Level | undefined {
  return id ? SCRIPTED_LEVELS.find((level) => level.id === id) : undefined;
}

export function nextLevel(id: string): Level | undefined {
  const index = SCRIPTED_LEVELS.findIndex((level) => level.id === id);
  return index >= 0 ? SCRIPTED_LEVELS[index + 1] : undefined;
}

/**
 * The rule cards a scripted level is allowed to put in the player's hand: the
 * ones taught at or before it, in ladder order.
 *
 * Steve, 2026-09-07, replaying level 1 after clearing level 2: "I'm on level
 * one and I'm getting introduced to the Us Taboo rule card, but the stick to
 * the threads root is also here. That should not appear until it becomes
 * relevant in round two."
 *
 * The game's card set (`cardSetFor`, app/game/[gameId]/setup-actions.ts) is
 * the human's earned cards plus the one this level teaches, which is right for
 * a first run down the ladder and wrong for a replay: a level 1 script has no
 * beat that uses a level 2 card, so the card sits in the tray as an offer the
 * level cannot honour. This filters the tray back to what the level itself
 * knows about. It is a display rule, not a rules-lane one: the card set on the
 * event log is untouched, so a card thrown outside the script is still legal,
 * it is simply not held out to a player being taught something else.
 */
export function cardsThroughLevel(id: string | null | undefined): readonly string[] {
  const index = SCRIPTED_LEVELS.findIndex((level) => level.id === id);
  if (index < 0) return [];
  return SCRIPTED_LEVELS.slice(0, index + 1).map((level) => level.awards.cardId);
}
