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
