"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { projectBoard, type BoardState } from "@/lib/board/project";
import * as rules from "@/lib/board/rules";
import type { GameEventType, NewEvent, Side, Uuid } from "@/lib/events/types";
import { appendGameEvent, appendGameEvents, readGameEvents } from "@/lib/events/append";
import { runCoach } from "@/lib/coach/run";
import { setCoachEnabled } from "@/lib/db/players";
import { endIfAbandoned } from "@/lib/games/abandon";
import {
  MEMBERSHIP_MESSAGES,
  readMembership,
  type Membership,
} from "@/lib/games/membership";
import { grantLevelAwards } from "@/lib/gym/awards";

/**
 * Every write a player can make to a live board.
 *
 * The shape of each one is the same on purpose: work out who is asking, project
 * the board from the log, ask the rules whether the move is legal, and only then
 * append. A refusal comes back as a value, not an exception, because being told
 * "that thread is already resolved" is an ordinary part of playing.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

const failed = (error: string): ActionResult => ({ ok: false, error });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Session {
  membership: Membership;
  board: BoardState;
}

async function session(gameId: string): Promise<Session | ActionResult> {
  if (!UUID.test(gameId)) return failed("That game id is not a game id.");

  const found = await readMembership(gameId);
  if (!found.ok) return failed(MEMBERSHIP_MESSAGES[found.denial]);

  const board = projectBoard(await readGameEvents(gameId));
  return { membership: found.membership, board };
}

function isDenial(value: Session | ActionResult): value is ActionResult {
  return "ok" in value;
}

/** What a player's own events look like. Server-written events differ. */
function asPlayer(membership: Membership): {
  actorRole: Side;
  source: "human";
  actorId: Uuid;
} {
  return { actorRole: membership.role, source: "human", actorId: membership.playerId };
}

/** Pairs a type with its own payload, then widens, so a batch stays a plain
    array without letting a mismatched type and payload through. */
function newEvent<T extends GameEventType>(event: NewEvent<T>): NewEvent {
  return event as NewEvent;
}

function refresh(gameId: string): void {
  revalidatePath(`/game/${gameId}`);
}

/** The claim a thread hangs off, which is what "on topic" is measured against.
    Null when the root itself is the tile being read. */
function rootText(board: BoardState, threadRootId: Uuid): string | null {
  return board.tiles.find((tile) => tile.id === threadRootId)?.text ?? null;
}

export async function placeTile(
  gameId: string,
  input: { text: string; parentTileId: string | null },
): Promise<ActionResult> {
  const loaded = await session(gameId);
  if (isDenial(loaded)) return loaded;
  const { membership, board } = loaded;

  const parentTileId = input.parentTileId;
  const verdict = rules.canPlaceTile(board, input.text, parentTileId);
  if (!verdict.ok) return failed(verdict.error);

  const tileId = crypto.randomUUID();
  const parent = parentTileId
    ? board.tiles.find((tile) => tile.id === parentTileId)
    : null;

  await appendGameEvent(gameId, {
    type: "tile_placed",
    ...asPlayer(membership),
    payload: {
      tile_id: tileId,
      parent_tile_id: parentTileId,
      thread_root_id: parent ? parent.threadRootId : tileId,
      side: membership.role,
      text: input.text.trim(),
    },
  });

  // The reading happens after the response goes out, so placing a tile never
  // waits on a model call. It lands on the board a second later over realtime,
  // and only for the player whose tile it is.
  after(
    runCoach(gameId, {
      playerId: membership.playerId,
      tileId,
      input: {
        topic: board.currentTopicText ?? "",
        threadRoot: parent ? rootText(board, parent.threadRootId) : null,
        text: input.text.trim(),
      },
    }),
  );

  refresh(gameId);
  return { ok: true };
}

export async function editTile(
  gameId: string,
  input: { tileId: string; text: string },
): Promise<ActionResult> {
  const loaded = await session(gameId);
  if (isDenial(loaded)) return loaded;
  const { membership, board } = loaded;

  const verdict = rules.canEditTile(board, input.tileId, membership.playerId, input.text);
  if (!verdict.ok) return failed(verdict.error);

  await appendGameEvent(gameId, {
    type: "tile_edited",
    ...asPlayer(membership),
    payload: { tile_id: input.tileId, text: input.text.trim() },
  });

  refresh(gameId);
  return { ok: true };
}

export async function removeTile(
  gameId: string,
  input: { tileId: string },
): Promise<ActionResult> {
  const loaded = await session(gameId);
  if (isDenial(loaded)) return loaded;
  const { membership, board } = loaded;

  const verdict = rules.canRemoveTile(board, input.tileId, membership.playerId);
  if (!verdict.ok) return failed(verdict.error);

  await appendGameEvent(gameId, {
    type: "tile_removed",
    ...asPlayer(membership),
    payload: { tile_id: input.tileId },
  });

  refresh(gameId);
  return { ok: true };
}

/**
 * Throw a card at one of the other side's reasons.
 *
 * What the throw *means* is settled later, not here: the log records that a
 * card landed, and scoring reads whether the reason was rewritten or the card
 * was turned down. Nothing in this action decides who was right.
 */
export async function throwCard(
  gameId: string,
  input: { tileId: string; cardId: string },
): Promise<ActionResult> {
  const loaded = await session(gameId);
  if (isDenial(loaded)) return loaded;
  const { membership, board } = loaded;

  const verdict = rules.canThrowCard(
    board,
    input.tileId,
    input.cardId,
    membership.role,
    membership.playerId,
  );
  if (!verdict.ok) return failed(verdict.error);

  await appendGameEvent(gameId, {
    type: "card_thrown",
    ...asPlayer(membership),
    payload: {
      card_id: input.cardId,
      // Gym rungs are not built, so every throw so far is a card throw.
      rung_id: null,
      target_tile_id: input.tileId,
    },
  });

  refresh(gameId);
  return { ok: true };
}

/**
 * The first of the two answers to a throw: rewrite the reason.
 *
 * The rewrite names the throw it answers, and the coach reads the new words,
 * because a reason that just changed is exactly the one worth reading again.
 */
export async function reviseTile(
  gameId: string,
  input: { tileId: string; throwSeq: number; text: string },
): Promise<ActionResult> {
  const loaded = await session(gameId);
  if (isDenial(loaded)) return loaded;
  const { membership, board } = loaded;

  const verdict = rules.canReviseTile(
    board,
    input.tileId,
    input.throwSeq,
    membership.playerId,
    input.text,
  );
  if (!verdict.ok) return failed(verdict.error);

  const text = input.text.trim();
  await appendGameEvent(gameId, {
    type: "tile_revised",
    ...asPlayer(membership),
    payload: {
      tile_id: input.tileId,
      text,
      in_response_to_seq: input.throwSeq,
    },
  });

  const tile = board.tiles.find((candidate) => candidate.id === input.tileId);
  after(
    runCoach(gameId, {
      playerId: membership.playerId,
      tileId: input.tileId,
      input: {
        topic: board.currentTopicText ?? "",
        threadRoot: tile ? rootText(board, tile.threadRootId) : null,
        text,
      },
    }),
  );

  refresh(gameId);
  return { ok: true };
}

/**
 * The other answer: say the card does not fit.
 *
 * Only the reason's author may say it, and saying it is a move rather than an
 * absence, which is why it is an event and gets counted.
 */
export async function declineThrow(
  gameId: string,
  input: { throwSeq: number; reason: string | null },
): Promise<ActionResult> {
  const loaded = await session(gameId);
  if (isDenial(loaded)) return loaded;
  const { membership, board } = loaded;

  const reason = input.reason?.trim() ? input.reason.trim() : null;
  const verdict = rules.canDeclineThrow(
    board,
    input.throwSeq,
    membership.playerId,
    reason,
  );
  if (!verdict.ok) return failed(verdict.error);

  await appendGameEvent(gameId, {
    type: "card_throw_declined",
    ...asPlayer(membership),
    payload: { in_response_to_seq: input.throwSeq, reason },
  });

  refresh(gameId);
  return { ok: true };
}

/**
 * Put a token down on a thread root. When it turns out both sides are showing
 * the same token, the server closes the thread, and if that was the last one it
 * ends the game. Those two are server-written because they are a consequence of
 * the position, not something either player did.
 */
export async function placeResolutionToken(
  gameId: string,
  input: { threadRootId: string; emoji: string },
): Promise<ActionResult> {
  const loaded = await session(gameId);
  if (isDenial(loaded)) return loaded;
  const { membership, board } = loaded;

  const verdict = rules.canPlaceResolutionToken(board, input.threadRootId, input.emoji);
  if (!verdict.ok) return failed(verdict.error);

  await appendGameEvent(gameId, {
    type: "resolution_emoji_placed",
    ...asPlayer(membership),
    payload: { thread_root_id: input.threadRootId, emoji: input.emoji },
  });

  await settleIfAgreed(gameId, input.threadRootId);
  refresh(gameId);
  return { ok: true };
}

export async function clearResolutionToken(
  gameId: string,
  input: { threadRootId: string },
): Promise<ActionResult> {
  const loaded = await session(gameId);
  if (isDenial(loaded)) return loaded;
  const { membership, board } = loaded;

  const open = rules.boardIsOpen(board);
  if (!open.ok) return failed(open.error);

  const thread = board.threads.find((t) => t.rootId === input.threadRootId);
  if (!thread) return failed("That thread is not on this board.");
  if (rules.isResolved(thread)) return failed("That thread is already resolved.");
  if (thread.pending[membership.role] === null) {
    return failed("You have not put a token down there.");
  }

  await appendGameEvent(gameId, {
    type: "resolution_emoji_removed",
    ...asPlayer(membership),
    payload: { thread_root_id: input.threadRootId },
  });

  refresh(gameId);
  return { ok: true };
}

/**
 * Re-reads the log so the decision is made on what actually landed, including
 * a token the other player placed a moment ago. The guards make a duplicate
 * close or a duplicate ending harmless if both clients get here at once.
 */
async function settleIfAgreed(gameId: string, threadRootId: string): Promise<void> {
  const board = projectBoard(await readGameEvents(gameId));
  const thread = board.threads.find((candidate) => candidate.rootId === threadRootId);
  if (!thread || rules.isResolved(thread)) return;

  const agreed = rules.agreedToken(thread);
  if (!agreed) return;

  await appendGameEvent(gameId, {
    type: "thread_resolved",
    actorRole: "server",
    source: "system",
    payload: { thread_root_id: threadRootId, emoji: agreed, note: null },
  });

  const settled = projectBoard(await readGameEvents(gameId));
  if (settled.status === "ended" || !rules.threadsWinReached(settled)) return;

  await appendGameEvent(gameId, {
    type: "game_ended",
    actorRole: "server",
    source: "system",
    payload: { win_condition: "threads_resolved" },
  });

  // A gym level ends the same way a live game does, through this same function
  // when it is the player's own token that closed the last thread. Writing down
  // what was earned belongs with the ending, not with whoever happened to move.
  await grantLevelAwards(gameId);
}

export async function proposeTopicRevision(
  gameId: string,
  input: { text: string },
): Promise<ActionResult> {
  const loaded = await session(gameId);
  if (isDenial(loaded)) return loaded;
  const { membership, board } = loaded;

  const verdict = rules.canProposeTopicRevision(board, input.text);
  if (!verdict.ok) return failed(verdict.error);

  await appendGameEvent(gameId, {
    type: "proposal_made",
    ...asPlayer(membership),
    payload: {
      proposal_id: crypto.randomUUID(),
      kind: "topic_revision",
      target_tile_id: null,
      target_thread_root_id: null,
      content: { text: input.text.trim() },
    },
  });

  refresh(gameId);
  return { ok: true };
}

/**
 * A tile only ever moves with its author's say-so (BRAIN-T260816-12), so a move
 * is asked for rather than done. The author asking still goes through a proposal
 * the other side answers; who may initiate is settled, who may approve is not.
 */
export async function proposeRelocation(
  gameId: string,
  input: {
    tileId: string;
    newParentTileId: string | null;
    newThreadRootId: string;
    newSide: Side;
  },
): Promise<ActionResult> {
  const loaded = await session(gameId);
  if (isDenial(loaded)) return loaded;
  const { membership, board } = loaded;

  const verdict = rules.canProposeRelocation(
    board,
    input.tileId,
    input.newParentTileId,
    input.newThreadRootId,
  );
  if (!verdict.ok) return failed(verdict.error);

  await appendGameEvent(gameId, {
    type: "proposal_made",
    ...asPlayer(membership),
    payload: {
      proposal_id: crypto.randomUUID(),
      kind: "tile_relocation",
      target_tile_id: input.tileId,
      target_thread_root_id: input.newThreadRootId,
      content: {
        new_parent_tile_id: input.newParentTileId,
        new_thread_root_id: input.newThreadRootId,
        new_side: input.newSide,
      },
    },
  });

  refresh(gameId);
  return { ok: true };
}

/**
 * Help Me Understand: their reason, in your words, handed back for them to
 * judge.
 *
 * Nothing happens to the board when they accept, which is the whole mechanic.
 * The reading is worth something because getting it right is worth something,
 * and the log keeps both the attempt and their verdict on it.
 */
export async function proposeReadingHandback(
  gameId: string,
  input: { tileId: string; text: string },
): Promise<ActionResult> {
  const loaded = await session(gameId);
  if (isDenial(loaded)) return loaded;
  const { membership, board } = loaded;

  const verdict = rules.canProposeReadingHandback(
    board,
    input.tileId,
    membership.role,
    input.text,
  );
  if (!verdict.ok) return failed(verdict.error);

  const tile = board.tiles.find((candidate) => candidate.id === input.tileId);

  await appendGameEvent(gameId, {
    type: "proposal_made",
    ...asPlayer(membership),
    payload: {
      proposal_id: crypto.randomUUID(),
      kind: "reading_handback",
      target_tile_id: input.tileId,
      target_thread_root_id: tile ? tile.threadRootId : null,
      content: { text: input.text.trim() },
    },
  });

  refresh(gameId);
  return { ok: true };
}

/** Their side, said for them, aimed at the whole argument rather than at one
    reason. Accepting is them saying you have it; nothing moves. */
export async function proposeSteelmanReading(
  gameId: string,
  input: { text: string },
): Promise<ActionResult> {
  const loaded = await session(gameId);
  if (isDenial(loaded)) return loaded;
  const { membership, board } = loaded;

  const verdict = rules.canProposeSteelmanReading(board, input.text);
  if (!verdict.ok) return failed(verdict.error);

  await appendGameEvent(gameId, {
    type: "proposal_made",
    ...asPlayer(membership),
    payload: {
      proposal_id: crypto.randomUUID(),
      kind: "steelman_reading",
      target_tile_id: null,
      target_thread_root_id: null,
      content: { text: input.text.trim() },
    },
  });

  refresh(gameId);
  return { ok: true };
}

/**
 * A reason written for the other side, which becomes one of their tiles if they
 * take it.
 *
 * The side is derived here and never accepted from the caller. A client that
 * could name the side could put a tile on its own half of the board through the
 * one path that places a tile its author did not write.
 */
export async function proposeSteelmanTile(
  gameId: string,
  input: { text: string; parentTileId: string | null },
): Promise<ActionResult> {
  const loaded = await session(gameId);
  if (isDenial(loaded)) return loaded;
  const { membership, board } = loaded;

  const verdict = rules.canProposeSteelmanTile(board, input.parentTileId, input.text);
  if (!verdict.ok) return failed(verdict.error);

  const parent = input.parentTileId
    ? board.tiles.find((candidate) => candidate.id === input.parentTileId)
    : null;

  await appendGameEvent(gameId, {
    type: "proposal_made",
    ...asPlayer(membership),
    payload: {
      proposal_id: crypto.randomUUID(),
      kind: "steelman_tile",
      target_tile_id: input.parentTileId,
      target_thread_root_id: parent ? parent.threadRootId : null,
      content: {
        text: input.text.trim(),
        parent_tile_id: input.parentTileId,
        side: rules.OTHER_SIDE[membership.role],
      },
    },
  });

  refresh(gameId);
  return { ok: true };
}

/** Define That: one word, one meaning, agreed rather than assumed. Accepting
    settles what the word means for the rest of the game and moves nothing. */
export async function proposeDefinition(
  gameId: string,
  input: { term: string; text: string },
): Promise<ActionResult> {
  const loaded = await session(gameId);
  if (isDenial(loaded)) return loaded;
  const { membership, board } = loaded;

  const verdict = rules.canProposeDefinition(board, input.term, input.text);
  if (!verdict.ok) return failed(verdict.error);

  await appendGameEvent(gameId, {
    type: "proposal_made",
    ...asPlayer(membership),
    payload: {
      proposal_id: crypto.randomUUID(),
      kind: "definition",
      target_tile_id: null,
      target_thread_root_id: null,
      content: { term: input.term.trim(), text: input.text.trim() },
    },
  });

  refresh(gameId);
  return { ok: true };
}

/**
 * Accepting is where a proposal turns into a move on the board. The acceptance
 * and its consequence go in one batch so the log can never show a proposal
 * accepted without the thing it asked for.
 */
export async function acceptProposal(
  gameId: string,
  input: { proposalId: string },
): Promise<ActionResult> {
  const loaded = await session(gameId);
  if (isDenial(loaded)) return loaded;
  const { membership, board } = loaded;

  const verdict = rules.canAnswerProposal(board, input.proposalId, membership.role);
  if (!verdict.ok) return failed(verdict.error);

  const proposal = board.proposals.find((p) => p.id === input.proposalId);
  if (!proposal) return failed("That proposal is not on this board.");

  const me = asPlayer(membership);
  const batch: NewEvent[] = [
    newEvent({ type: "proposal_accepted", ...me, payload: { proposal_id: proposal.id } }),
  ];

  if (proposal.kind === "topic_revision" && "text" in proposal.content) {
    batch.push(
      newEvent({
        type: "topic_revised",
        ...me,
        payload: { text: proposal.content.text, via_proposal_id: proposal.id },
      }),
    );
    // Both sides now stand behind one statement, which is the second win,
    // everywhere except free gym practice. See rules.topicAgreementEndsGame.
    if (rules.topicAgreementEndsGame(board)) {
      batch.push(
        newEvent({
          type: "game_ended",
          actorRole: "server",
          source: "system",
          payload: { win_condition: "topic_agreed" },
        }),
      );
    }
  }

  if (
    proposal.kind === "tile_relocation" &&
    proposal.targetTileId &&
    "new_thread_root_id" in proposal.content
  ) {
    batch.push(
      newEvent({
        type: "tile_relocated",
        ...me,
        payload: {
          tile_id: proposal.targetTileId,
          new_parent_tile_id: proposal.content.new_parent_tile_id,
          new_thread_root_id: proposal.content.new_thread_root_id,
          new_side: proposal.content.new_side,
          via_proposal_id: proposal.id,
        },
      }),
    );
  }

  // Only the tile kind lands on the board. A steelman reading, a handback, and
  // a definition are all complete at proposal_accepted: agreeing that somebody
  // read you right moves nothing. See the event-type catalogue spec.
  if (
    proposal.kind === "steelman_tile" &&
    "text" in proposal.content &&
    "side" in proposal.content
  ) {
    const tileId = crypto.randomUUID();
    const parentTileId = proposal.content.parent_tile_id;
    const parent = parentTileId
      ? board.tiles.find((tile) => tile.id === parentTileId)
      : null;
    batch.push(
      newEvent({
        type: "tile_placed",
        ...me,
        payload: {
          tile_id: tileId,
          parent_tile_id: parentTileId,
          thread_root_id: parent ? parent.threadRootId : tileId,
          side: proposal.content.side,
          text: proposal.content.text,
          via_proposal_id: proposal.id,
        },
      }),
    );
  }

  await appendGameEvents(gameId, batch);
  // The other ending: both sides standing behind one revised statement. Awards
  // are a no-op unless that batch actually carried game_ended.
  await grantLevelAwards(gameId);
  refresh(gameId);
  return { ok: true };
}

export async function rejectProposal(
  gameId: string,
  input: { proposalId: string; reason: string | null },
): Promise<ActionResult> {
  const loaded = await session(gameId);
  if (isDenial(loaded)) return loaded;
  const { membership, board } = loaded;

  const verdict = rules.canAnswerProposal(board, input.proposalId, membership.role);
  if (!verdict.ok) return failed(verdict.error);

  const reason = input.reason?.trim();
  await appendGameEvent(gameId, {
    type: "proposal_rejected",
    ...asPlayer(membership),
    payload: {
      proposal_id: input.proposalId,
      reason: reason && reason.length > 0 ? reason : null,
    },
  });

  refresh(gameId);
  return { ok: true };
}

/** Hand the other side credit for a good move. Costs nothing, ends nothing. */
export async function giveGenerosityToken(
  gameId: string,
  input: { targetTileId?: string },
): Promise<ActionResult> {
  const loaded = await session(gameId);
  if (isDenial(loaded)) return loaded;
  const { membership, board } = loaded;

  const open = rules.boardIsOpen(board);
  if (!open.ok) return failed(open.error);

  if (input.targetTileId) {
    const tile = board.tiles.find((candidate) => candidate.id === input.targetTileId);
    if (!tile || tile.removed) return failed("That reason is not on this board.");
    if (tile.placedBy === membership.playerId) {
      return failed("Generosity goes to the other player.");
    }
  }

  await appendGameEvent(gameId, {
    type: "generosity_token_given",
    ...asPlayer(membership),
    payload: {
      to_role: rules.OTHER_SIDE[membership.role],
      ...(input.targetTileId ? { target_tile_id: input.targetTileId } : {}),
    },
  });

  refresh(gameId);
  return { ok: true };
}

export async function leaveGame(
  gameId: string,
  input: { reason: "disconnect" | "quit" } = { reason: "quit" },
): Promise<ActionResult> {
  const loaded = await session(gameId);
  if (isDenial(loaded)) return loaded;
  const { membership, board } = loaded;

  if (board.status === "ended") return { ok: true };

  await appendGameEvent(gameId, {
    type: "player_left",
    ...asPlayer(membership),
    payload: { reason: input.reason },
  });
  await endIfAbandoned(gameId);

  refresh(gameId);
  return { ok: true };
}

/**
 * Turn the coach on or off. A preference, not a move, so it never reaches the
 * log; what does reach the log is anything the coach actually says.
 */
export async function setCoach(gameId: string, enabled: boolean): Promise<ActionResult> {
  const loaded = await session(gameId);
  if (isDenial(loaded)) return loaded;

  await setCoachEnabled(loaded.membership.playerId, enabled);
  refresh(gameId);
  return { ok: true };
}

/**
 * Dismiss a coach reading. It is an event rather than local state because a
 * reload should not hand the player the same note again, and because the study
 * cares about the difference between advice given and advice read.
 */
export async function dismissCoachReading(
  gameId: string,
  seq: number,
): Promise<ActionResult> {
  const loaded = await session(gameId);
  if (isDenial(loaded)) return loaded;
  const { membership, board } = loaded;

  const reading = board.coachReadings.find((item) => item.seq === seq);
  if (!reading) return failed("There is no such note.");
  // Only the player it was written for. The projection holds both sides'.
  if (reading.forPlayer !== membership.playerId) {
    return failed("That note is not yours.");
  }
  if (reading.shown) return { ok: true };

  await appendGameEvent(gameId, {
    type: "ai_feedback_shown",
    ...asPlayer(membership),
    payload: { in_response_to_seq: seq },
  });

  refresh(gameId);
  return { ok: true };
}
