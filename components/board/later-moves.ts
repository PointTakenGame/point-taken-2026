import type { BoardState } from "@/lib/board/project";
import type { ProposalKind } from "@/lib/events/types";

/**
 * The gate for the six "ask the other player for something" moves, held back
 * from the live game for now.
 *
 * Steve, 2026-09-03 (registry row BRAIN-T260903-06): six "ask the other
 * player" moves are Gym level 5 and above and must not appear in the game
 * yet. His words: "Do not delete anything you have built but comment it out
 * for the moment so that it does not appear. We do not need any of that yet,
 * let us get the basics down before we add things like that."
 *
 * The six, by `ProposalKind`:
 *   - tile_relocation   (move a reason somewhere it fits better)
 *   - definition        (pin a word)
 *   - steelman_reading  (say their side back to them)
 *   - steelman_tile     (write a reason for their side you think they missed)
 *   - reading_handback  (hand a reading back)
 *   - topic_revision    (propose a new wording for the topic)
 *
 * Three exceptions, all of them the same exception: a move that a Gym level
 * teaches has to be reachable inside the Gym, so it stays available whenever
 * the board is not in `"live"` mode and is hidden only in live play.
 *
 *   - `tile_relocation`, Gym level 2 (beat L2.9 has the player relocate a tile)
 *   - `reading_handback`, Gym level 4 (beats L4.4 and L4.7, the restatement box)
 *   - `definition`, Gym level 4 (beat L4.6, Define That and the pinned strip)
 *
 * The other three are level 5 and above and are off everywhere.
 *
 * This gate is temporary. It is the one place that decides whether a player
 * may START one of these six moves right now; it does not touch the event
 * log or the projection, and the code behind every one of these moves (the
 * `canPropose*` rules, the server actions, the forms in `live-board.tsx` and
 * `topic-cell.tsx`) is intact and fully reachable, by design, by flipping
 * this one function. Answering a proposal that already exists (accept,
 * reject, or simply rendering one made before this gate existed) is never
 * gated here: only starting a new one is.
 */
const TAUGHT_IN_THE_GYM: readonly ProposalKind[] = [
  "tile_relocation",
  "reading_handback",
  "definition",
];

export function canStartLaterMove(board: BoardState, kind: ProposalKind): boolean {
  if (TAUGHT_IN_THE_GYM.includes(kind)) return board.mode !== "live";
  return false;
}

/** The six moves this gate covers, named once so callers (and tests, and the
 * how-to-play page) can reference the set without re-listing it. */
export const LATER_MOVE_KINDS: readonly ProposalKind[] = [
  "tile_relocation",
  "definition",
  "steelman_reading",
  "steelman_tile",
  "reading_handback",
  "topic_revision",
] as const;
