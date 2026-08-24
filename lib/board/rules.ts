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
 * The two tokens a thread resolves with. 👍 reads as settled, 👀 as "I can see
 * why we disagree here."
 *
 * SETTLED 2026-08-23 (Steve), which retires the catalogue's §7.2 open question.
 * Two ship. Later, behind progression, 👀 graduates into three more nuanced
 * versions of itself: we disagree about a fact, about priorities, or about
 * taste. That is Steve's 2026-07-09 wording, restated unprompted today, so it
 * is the intent rather than a reading of it. The frontend's old `wine` and
 * `scale` values were an earlier attempt at those three and are dead.
 *
 * Adding the three later costs nothing at the log: `emoji` is a string, so a
 * new token is a new value, not a migration, and every game already recorded
 * keeps meaning what it meant.
 */
export const RESOLUTION_TOKENS = ["👍", "👀"] as const;
export type ResolutionToken = (typeof RESOLUTION_TOKENS)[number];

/**
 * The three 👀 becomes, once there is a level system to gate them. Named here
 * so the split is a planned widening rather than a rediscovery. Not accepted
 * by `isResolutionToken`, so nothing can place one yet.
 */
export const DEFERRED_RESOLUTION_TOKENS = ["🔍", "⚖️", "🍷"] as const;

export function isResolutionToken(value: string): value is ResolutionToken {
  return (RESOLUTION_TOKENS as readonly string[]).includes(value);
}

/**
 * How many threads a game must have resolved before resolving them all ends it.
 * Without a floor, one thread resolved on the first exchange ends the game.
 * GAP: Steve ruled the ceiling on 2026-08-23 and did not restate this number,
 * so four is still carried forward from the deployed 2024 server rather than
 * ratified (BRAIN-T260823-10).
 */
export const MIN_THREADS_TO_END = 4;

/**
 * The most threads a game may hold. Steve, 2026-08-23: games end by resolving
 * every thread, up to six. The cap is what makes that ending reachable, since
 * a board people can keep widening never runs out of threads to resolve.
 * Enforced on placement: a tile that would open a seventh thread is refused.
 */
export const MAX_THREADS = 6;

/**
 * Whether agreeing on a rewritten topic ends this game.
 *
 * Steve, 2026-08-23: yes, but only in live play or in a baked gym game. Free
 * gym practice is somewhere to try a rewrite and keep going, so there the topic
 * changes and the board stays open. A gym run carrying a level or a boss is a
 * written scenario with an intended ending, so it counts.
 */
export function topicAgreementEndsGame(board: BoardState): boolean {
  if (board.mode === "live") return true;
  return board.levelId !== null || board.bossId !== null;
}

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
  return real.length >= MIN_THREADS_TO_END && real.every((thread) => isResolved(thread));
}

/**
 * Whether nobody is left to play this game, so it should close itself.
 *
 * A live board needs both sides, so one deliberate walk-out ends it. A lobby can
 * wait for somebody else to use the code, unless the last person left. A
 * disconnect never ends anything: reloading puts them back in the same seat.
 */
export function isAbandoned(board: BoardState): boolean {
  if (board.status === "ended") return false;
  const here = board.players.filter((player) => player.left !== "quit");
  return board.status === "active" ? here.length < 2 : here.length === 0;
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

  if (parentTileId === null) {
    // A tile with no parent opens a new thread, and six is all a game gets.
    const live = board.threads.filter((thread) => thread.tileCount > 0).length;
    if (live >= MAX_THREADS) {
      return no(
        `A game holds at most ${MAX_THREADS} threads. Add this to one of them instead.`,
      );
    }
  } else {
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
  if (tile.placedBy !== playerId)
    return no("Only the person who wrote it can change it.");

  const trimmed = text.trim();
  if (trimmed.length === 0) return no("A reason needs some words in it.");
  if (trimmed.length > TILE_MAX_CHARS) {
    return no(`A reason is at most ${TILE_MAX_CHARS} characters.`);
  }
  return ALLOWED;
}

export function canRemoveTile(board: BoardState, tileId: Uuid, playerId: Uuid): Verdict {
  const open = boardIsOpen(board);
  if (!open.ok) return open;

  const tile = board.tiles.find((candidate) => candidate.id === tileId);
  if (!tile) return no("That reason is not on this board.");
  if (tile.removed) return no("That reason is already off the board.");
  if (tile.placedBy !== playerId)
    return no("Only the person who wrote it can remove it.");
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
  if (trimmed === board.currentTopicText)
    return no("That is the topic you already have.");
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

/**
 * How long a "that card does not fit" note may be.
 *
 * Short on purpose. The decline is a move, not a rebuttal: the rebuttal is the
 * thread. The event's payload cap is 512 bytes, so this leaves room for the
 * seq and the envelope without a multibyte reason ever pushing past it.
 */
export const DECLINE_REASON_MAX_CHARS = 200;

/** The cards this game is being played with, or the empty set before it starts. */
export function cardsInPlay(board: BoardState): readonly string[] {
  return board.settings?.cardSet.cardIds ?? [];
}

/**
 * Throwing a card at one of the other side's reasons.
 *
 * The board does not decide whether the throw is *right*. That is read later
 * from what follows it, a rewrite or a decline, which is why nothing here
 * inspects the reason's text. What it does decide is whether the throw is a
 * legal move at all.
 */
export function canThrowCard(
  board: BoardState,
  tileId: Uuid,
  cardId: string,
  side: Side,
  playerId: Uuid,
): Verdict {
  const open = boardIsOpen(board);
  if (!open.ok) return open;

  const deck = cardsInPlay(board);
  if (!deck.includes(cardId)) return no("That card is not in play in this game.");

  const tile = board.tiles.find((candidate) => candidate.id === tileId);
  if (!tile) return no("That reason is not on this board.");
  if (tile.removed) return no("That reason was taken off the board.");
  if (tile.side === side)
    return no("Cards go to the other side's reasons, not your own.");

  const thread = board.threads.find(
    (candidate) => candidate.rootId === tile.threadRootId,
  );
  if (thread && isResolved(thread)) return no("That thread is already resolved.");

  // One card lands on one reason once. A second copy adds no information, and
  // a declined throw stays declined rather than being re-thrown until it sticks.
  const already = board.throws.some(
    (thrown) =>
      thrown.targetTileId === tileId &&
      thrown.cardId === cardId &&
      thrown.thrownBy === playerId,
  );
  if (already) return no("You already played that card on this reason.");

  return ALLOWED;
}

/**
 * Saying a card thrown at your own reason does not fit.
 *
 * Only the reason's author may decline, and only while the throw still stands.
 * Declining is the alternative to rewriting, not a way out of both: it puts the
 * disagreement about the card itself on the record.
 */
export function canDeclineThrow(
  board: BoardState,
  throwSeq: number,
  playerId: Uuid,
  reason: string | null,
): Verdict {
  const open = boardIsOpen(board);
  if (!open.ok) return open;

  const thrown = board.throws.find((candidate) => candidate.seq === throwSeq);
  if (!thrown) return no("That card play is not on this board.");
  if (thrown.status === "answered") {
    return no("You already answered that card by rewriting the reason.");
  }
  if (thrown.status === "declined") return no("You already turned that card down.");

  const tile = board.tiles.find((candidate) => candidate.id === thrown.targetTileId);
  if (!tile) return no("That reason is not on this board.");
  if (tile.placedBy !== playerId) {
    return no("Only the person who wrote the reason can turn a card down.");
  }

  if (reason !== null && reason.trim().length > DECLINE_REASON_MAX_CHARS) {
    return no(`A note is at most ${DECLINE_REASON_MAX_CHARS} characters.`);
  }
  return ALLOWED;
}

/**
 * Rewriting your own reason to answer a card thrown at it.
 *
 * The other answer to a throw. Distinct from an ordinary edit because it names
 * the throw it is answering, which is what makes the exchange readable later:
 * a card landed, and the reason changed because of it.
 */
export function canReviseTile(
  board: BoardState,
  tileId: Uuid,
  throwSeq: number,
  playerId: Uuid,
  text: string,
): Verdict {
  const open = boardIsOpen(board);
  if (!open.ok) return open;

  const tile = board.tiles.find((candidate) => candidate.id === tileId);
  if (!tile) return no("That reason is not on this board.");
  if (tile.removed) return no("That reason was taken off the board.");
  if (tile.placedBy !== playerId) {
    return no("Only the person who wrote the reason can rewrite it.");
  }

  const thrown = board.throws.find((candidate) => candidate.seq === throwSeq);
  if (!thrown) return no("That card play is not on this board.");
  if (thrown.targetTileId !== tileId)
    return no("That card was played on another reason.");
  if (thrown.status !== "standing") return no("That card has already been answered.");

  const trimmed = text.trim();
  if (trimmed.length === 0) return no("A reason needs some words in it.");
  if (trimmed.length > TILE_MAX_CHARS) {
    return no(`A reason is at most ${TILE_MAX_CHARS} characters.`);
  }
  if (trimmed === tile.text) return no("That is the same words you had before.");
  return ALLOWED;
}
