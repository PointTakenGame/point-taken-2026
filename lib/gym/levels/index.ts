import type { Level } from "../script";
import { ONBOARDING } from "./onboarding";
import { GROUND_RULES } from "./ground-rules";

/** The scripted levels. Levels 3 and 4 have a door on /gym and no script yet. */
export const SCRIPTED_LEVELS: readonly Level[] = [ONBOARDING, GROUND_RULES];

export function levelById(id: string | null | undefined): Level | undefined {
  return id ? SCRIPTED_LEVELS.find((level) => level.id === id) : undefined;
}

export function nextLevel(id: string): Level | undefined {
  const index = SCRIPTED_LEVELS.findIndex((level) => level.id === id);
  return index >= 0 ? SCRIPTED_LEVELS[index + 1] : undefined;
}
