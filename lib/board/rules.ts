import type { BoardProposal, BoardState, BoardThread } from "./project";
import type { Side, Uuid } from "@/lib/events/types";

/**
 * What the board allows, folded out of the board.
 *
 * Pure and shared: the server actions call this to decide, and the client calls
 * the same functions to grey a button out. The server is still the authority,
 * because the client copy can be bypassed and this file cannot append anything.
 */

/** The tile-length limit the printed game uses. Enforced both sides. */
export const TILE_MAX_CHARS = 100;

/**
 * The two tokens a thread resolves with. 👍 reads as settled, 👀 as seen but
 * still apart. The event-type catalogue records this vocabulary as unsettled
 * (its §7.2), which is why it lives here rather than in the payload type: a
 * change is a change to the rules package, not a schema migration.
 */
export const RESOLUTION_TOKENS = ["👍", "👀"] as const;
export type ResolutionToken = (typeof RESOLUTION_TOKENS)[number];

export function isResolutionToken(value: string): value is ResolutionToken {
  return (RESOLUTION_TOKENS as readonly string[]).includes(value);
}

/**
 * How many threads a game must have resolved before resolving them all ends it.
 * The deployed 2024 server used four, and nothing in the roadmap replaces that
 * number, so four is carried forward rather than invented. Without a floor, one
 * thread resolved on the first exchange would end the game.
 * GAP: Steve has not ratified the number (BRAIN-T260823-10).
 */
export const MIN_THREADS_TO_END = 4;

export const OTHER_SIDE: Record<Side, Side> = { plus: "minus", minus: "plus" };

/** The token both sides have put down, when it is the same token. */
export function agreedToken(thread: BoardThread): string | null {
  const { plus, minus } = thread.pending;
  return plus !== null && plus === minus ? plus : null;
}

export function isResolved(thread: BoardThread): boolean {
  return thread.resolution !== null;
}

/**
 * Whether resolving every thread should end this game now. Threads with no
 * live tiles left do not count: a thread whose tiles were all removed is not
 * an argument anybody resolved.
 */
export function threadsWinReached(board: BoardState): boolean {
  const real = board.threads.filter((thread) => thread.tileCount > 0);
  return (
    real.length >= MIN_THREADS_TO_END && real.every((thread) => isResolved(thread))
  );
}

/** Proposals still waiting on an answer from the given side. */
export function proposalsAwaiting(board: BoardState, side: Side): BoardProposal[] {
  return board.proposals.filter(
    (proposal) => proposal.status === "pending" && proposal.askedBy === OTHER_SIDE[side],
  );
}

export function proposalsFrom(board: BoardState, side: Side): BoardProposal[] {
  return board.proposals.filter(
    (proposal) => proposal.status === "pending" && proposal.askedBy === side,
  );
}

export interface Refusal {
  ok: false;
  error: string;
}
export type Allowed = { ok: true };
export type Verdict = Allowed | Refusal;

const ALLOWED: Allowed = { ok: true };
const no = (error: string): Refusal => ({ ok: false, error });

/** Nothing may be written to a board that is not in play. */
export function boardIsOpen(board: BoardState): Verdict {
  if (board.status === "ended") return no("This game is over.");
  if (board.status === "lobby") return no("This game has not started yet.");
  return ALLOWED;
}

export function canPlaceTile(
  board: BoardState,
  text: string,
  parentTileId: Uuid | null,
): Verdict {
  const open = boardIsOpen(board);
  if (!open.ok) return open;

  const trimmed = text.trim();
  if (trimmed.length === 0) return no("A reason needs some words in it.");
  if (trimmed.length > TILE_MAX_CHARS) {
    return no(`A reason is at most ${TILE_MAX_CHARS} characters.`);
  }

  if (parentTileId !== null) {
    const parent = board.tiles.find((tile) => tile.id === parentTileId);
    if (!parent) return no("That reason is not on this board.");
    if (parent.removed) return no("That reason was taken off the board.");
    const thread = board.threads.find((t) => t.rootId === parent.threadRootId);
    if (thread && isResolved(thread)) return no("That thread is already resolved.");
  }
  return ALLOWED;
}

export function canEditTile(
  board: BoardState,
  tileId: Uuid,
  playerId: Uuid,
  text: string,
): Verdict {
  const open = boardIsOpen(board);
  if (!open.ok) return open;

  const tile = board.tiles.find((candidate) => candidate.id === tileId);
  if (!tile) return no("That reason is not on this board.");
  if (tile.removed) return no("That reason was taken off the board.");
  if (tile.placedBy !== playerId) return no("Only the person who wrote it can change it.");

  const trimmed = text.trim();
  if (trimmed.length === 0) return no("A reason needs some words in it.");
  if (trimmed.length > TILE_MAX_CHARS) {
    return no(`A reason is at most ${TILE_MAX_CHARS} characters.`);
  }
  return ALLOWED;
}

export function canRemoveTile(
  board: BoardState,
  tileId: Uuid,
  playerId: Uuid,
): Verdict {
  const open = boardIsOpen(board);
  if (!open.ok) return open;

  const tile = board.tiles.find((candidate) => candidate.id === tileId);
  if (!tile) return no("That reason is not on this board.");
  if (tile.removed) return no("That reason is already off the board.");
  if (tile.placedBy !== playerId) return no("Only the person who wrote it can remove it.");
  return ALLOWED;
}

export function canPlaceResolutionToken(
  board: BoardState,
  threadRootId: Uuid,
  emoji: string,
): Verdict {
  const open = boardIsOpen(board);
  if (!open.ok) return open;
  if (!isResolutionToken(emoji)) return no("That is not a resolution token.");

  const thread = board.threads.find((candidate) => candidate.rootId === threadRootId);
  if (!thread) return no("That thread is not on this board.");
  if (isResolved(thread)) return no("That thread is already resolved.");
  if (thread.tileCount === 0) return no("That thread has nothing left in it.");
  return ALLOWED;
}

/** Only the side that did not ask may answer, and only once. */
export function canAnswerProposal(
  board: BoardState,
  proposalId: Uuid,
  side: Side,
): Verdict {
  const open = boardIsOpen(board);
  if (!open.ok) return open;

  const proposal = board.proposals.find((candidate) => candidate.id === proposalId);
  if (!proposal) return no("That proposal is not on this board.");
  if (proposal.status !== "pending") return no("That proposal was already answered.");
  if (proposal.askedBy === side) return no("You cannot answer your own proposal.");
  return ALLOWED;
}

export function canProposeTopicRevision(board: BoardState, text: string): Verdict {
  const open = boardIsOpen(board);
  if (!open.ok) return open;

  const trimmed = text.trim();
  if (trimmed.length === 0) return no("A revised topic needs some words in it.");
  if (trimmed.length > 300) return no("A revised topic is at most 300 characters.");
  if (trimmed === board.currentTopicText) return no("That is the topic you already have.");
  return ALLOWED;
}

export function canProposeRelocation(
  board: BoardState,
  tileId: Uuid,
  newParentTileId: Uuid | null,
  newThreadRootId: Uuid,
): Verdict {
  const open = boardIsOpen(board);
  if (!open.ok) return open;

  const tile = board.tiles.find((candidate) => candidate.id === tileId);
  if (!tile) return no("That reason is not on this board.");
  if (tile.removed) return no("That reason was taken off the board.");
  if (tileId === newParentTileId) return no("A reason cannot hang from itself.");

  if (newParentTileId !== null) {
    const parent = board.tiles.find((candidate) => candidate.id === newParentTileId);
    if (!parent || parent.removed) return no("That destination is not on the board.");
    if (descendants(board, tileId).has(newParentTileId)) {
      return no("That would put a reason underneath its own reply.");
    }
  } else if (newThreadRootId !== tileId) {
    return no("A reason with no parent starts its own thread.");
  }
  return ALLOWED;
}

/** Every tile below this one, so a move cannot make a loop. */
function descendants(board: BoardState, tileId: Uuid): Set<Uuid> {
  const found = new Set<Uuid>();
  let frontier = [tileId];
  while (frontier.length > 0) {
    const next: Uuid[] = [];
    for (const parentId of frontier) {
      for (const tile of board.tiles) {
        if (tile.parentId === parentId && !found.has(tile.id)) {
          found.add(tile.id);
          next.push(tile.id);
        }
      }
    }
    frontier = next;
  }
  return found;
}
