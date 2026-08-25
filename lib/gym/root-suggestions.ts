/**
 * Pre-loaded root-tile text for Gym level 3, "Claim size" (level id
 * `claim_size`, topic "Should tipping be replaced by higher wages?").
 *
 * Level 3 teaches No Exaggeration (lib/coach/cards.ts, id `no_exaggeration`):
 * spotting a claim that overstates. Each pair below is one player-authored
 * root thread told two ways, a baited version that overstates and a safe
 * version that says the same thing without doing so. A player composing a
 * brand new thread on this topic can load either half into the textbox as a
 * starting point; it stays fully editable and goes through the same
 * placeTile flow as anything typed from scratch.
 *
 * There is no way to tell in advance which of the two threads an upcoming
 * root placement is "for", since both are just open slots a player can fill
 * in either order, so the composer offers both pairs together.
 *
 * This file is content, not core: like lib/coach/cards.ts, it sits beside the
 * levels it describes rather than under lib/board/ or lib/events/. Level 1,
 * 2, and 4 have no equivalent yet and are out of scope here; see this repo's
 * CLAUDE.md and app/gym/page.tsx for why the Gym has no scripted opponent to
 * hang word-list detection or a dare mechanic off of.
 */

export interface RootSuggestionPair {
  id: string;
  /** Overstates the claim; what No Exaggeration would flag. */
  baited: string;
  /** Says the same thing without the overstatement. */
  safe: string;
}

export const CLAIM_SIZE_ROOT_SUGGESTIONS: readonly RootSuggestionPair[] = [
  {
    id: "claim_size_thread_a",
    baited: "every server's pay is decided by strangers",
    safe: "shouldn't depend on how charming a stranger finds them",
  },
  {
    id: "claim_size_thread_b",
    baited: "swings with the weather... nobody can budget",
    safe: "hard to plan around",
  },
];
