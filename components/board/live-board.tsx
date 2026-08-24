"use client";

import { useMemo, useState, useTransition, type ReactElement } from "react";

import type {
  BoardProposal,
  BoardState,
  BoardThread,
  BoardThrow,
  BoardTile,
} from "@/lib/board/project";
import { REDACTED_TEXT, liveThreads } from "@/lib/board/project";
import {
  DECLINE_REASON_MAX_CHARS,
  DEFINITION_TERM_MAX_CHARS,
  OTHER_SIDE,
  READING_MAX_CHARS,
  RESOLUTION_TOKENS,
  TILE_MAX_CHARS,
  canDeclineThrow,
  canEditTile,
  canPlaceResolutionToken,
  canPlaceTile,
  canProposeDefinition,
  canProposeReadingHandback,
  canProposeRelocation,
  canProposeSteelmanReading,
  canProposeSteelmanTile,
  canProposeTopicRevision,
  canRemoveTile,
  canReviseTile,
  canThrowCard,
  cardsInPlay,
  isResolved,
  proposalsAwaiting,
  proposalsFrom,
} from "@/lib/board/rules";
import { coachCard } from "@/lib/coach/cards";
import { useGameFeed } from "./use-game-feed";
import { CoachPanel } from "./coach-panel";
import type { ActionResult } from "@/app/game/[gameId]/actions";
import {
  acceptProposal,
  clearResolutionToken,
  declineThrow,
  editTile,
  giveGenerosityToken,
  leaveGame,
  placeResolutionToken,
  placeTile,
  proposeDefinition,
  proposeReadingHandback,
  proposeRelocation,
  proposeSteelmanReading,
  proposeSteelmanTile,
  proposeTopicRevision,
  rejectProposal,
  removeTile,
  reviseTile,
  throwCard,
} from "@/app/game/[gameId]/actions";
import type { ProposalKind, Side, Uuid } from "@/lib/events/types";

/**
 * The live board: everything a player can see and do while a game is in
 * progress. Ugly on purpose; every action wired, none of it polished.
 */

const SIDE_MARK = { plus: "+", minus: "-" } as const;

export interface LiveBoardProps {
  gameId: string;
  board: BoardState;
  me: { playerId: string; role: Side };
  /** Whether this player has the coach switched on. Off by default. */
  coachEnabled: boolean;
}

/** Every live tile that has no live parent and is not a thread root. */
function flatten(tile: BoardTile): BoardTile[] {
  return [tile, ...tile.children.flatMap(flatten)];
}

function allTargets(board: BoardState): BoardTile[] {
  const fromThreads = liveThreads(board).flatMap((thread) => [
    ...(thread.root ? flatten(thread.root) : []),
    ...thread.orphans.flatMap(flatten),
  ]);
  return fromThreads;
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="text-sm text-red-600">{error}</p>;
}

function TileText({ tile }: { tile: BoardTile }) {
  if (tile.redacted) return <span className="italic opacity-50">{REDACTED_TEXT}</span>;
  return <span>{tile.text}</span>;
}

/** The card's own name, or its id if a game was played with a card we no longer ship. */
function cardLabel(cardId: string): string {
  const card = coachCard(cardId);
  return card ? `${card.icon} ${card.name}` : cardId;
}

/**
 * The hand: the cards this game is being played with, offered against one of
 * the other side's reasons.
 *
 * Every card is always shown, even the ones that cannot be thrown right now.
 * A card you have already played greys out with the reason why, because a hand
 * that silently loses cards is a hand you cannot learn.
 */
function CardHand({
  gameId,
  tile,
  me,
  board,
}: {
  gameId: string;
  tile: BoardTile;
  me: { playerId: string; role: Side };
  board: BoardState;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const deck = cardsInPlay(board);
  if (deck.length === 0) return null;

  const run = (cardId: string) => {
    setError(null);
    startTransition(async () => {
      const result: ActionResult = await throwCard(gameId, {
        tileId: tile.id,
        cardId,
      });
      if (!result.ok) setError(result.error);
      else setOpen(false);
    });
  };

  if (!open) {
    return (
      <div className="ml-6">
        <button
          type="button"
          className="text-xs underline opacity-70"
          onClick={() => setOpen(true)}
        >
          play a card
        </button>
      </div>
    );
  }

  return (
    <div className="ml-6 flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        {deck.map((cardId) => {
          const verdict = canThrowCard(board, tile.id, cardId, me.role, me.playerId);
          return (
            <button
              key={cardId}
              type="button"
              className="border border-current/30 px-2 py-0.5 text-xs disabled:opacity-30"
              disabled={pending || !verdict.ok}
              title={!verdict.ok ? verdict.error : undefined}
              onClick={() => run(cardId)}
            >
              {cardLabel(cardId)}
            </button>
          );
        })}
        <button
          type="button"
          className="text-xs underline opacity-70"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          never mind
        </button>
      </div>
      <ErrorLine error={error} />
    </div>
  );
}

/**
 * A card that has landed and is still waiting for an answer.
 *
 * Both players see it. Only the person who wrote the reason gets the two ways
 * out, and they are deliberately side by side and equally weighted: neither is
 * the concession, because the game does not record which of them was correct,
 * only which one you chose. The thrower sees the same card with no buttons, so
 * a throw is never a move that vanishes the moment you make it.
 */
function StandingThrow({
  gameId,
  board,
  thrown,
  me,
  answerable,
}: {
  gameId: string;
  board: BoardState;
  thrown: BoardThrow;
  me: { playerId: string; role: Side };
  /** True when this is your own reason, so you are the one who must answer. */
  answerable: boolean;
}) {
  const [mode, setMode] = useState<"idle" | "revise" | "decline">("idle");
  const [draft, setDraft] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reviseVerdict = canReviseTile(
    board,
    thrown.targetTileId,
    thrown.seq,
    me.playerId,
    draft,
  );
  const declineVerdict = canDeclineThrow(board, thrown.seq, me.playerId, reason || null);

  const runRevise = () => {
    setError(null);
    startTransition(async () => {
      const result: ActionResult = await reviseTile(gameId, {
        tileId: thrown.targetTileId,
        throwSeq: thrown.seq,
        text: draft,
      });
      if (!result.ok) setError(result.error);
      else setMode("idle");
    });
  };

  const runDecline = () => {
    setError(null);
    startTransition(async () => {
      const result: ActionResult = await declineThrow(gameId, {
        throwSeq: thrown.seq,
        reason: reason.trim() || null,
      });
      if (!result.ok) setError(result.error);
      else setMode("idle");
    });
  };

  const card = coachCard(thrown.cardId);

  return (
    <div className="ml-6 flex flex-col gap-1 border-l-2 border-amber-500/50 pl-3">
      <p className="text-xs">
        <span className="font-semibold">{cardLabel(thrown.cardId)}</span>
        <span className="ml-2 opacity-60">
          {answerable ? "played on this reason" : "waiting on them"}
        </span>
      </p>
      {card && <p className="text-xs opacity-60">{card.plain}</p>}

      {answerable && mode === "idle" && (
        <div className="flex gap-3">
          <button
            type="button"
            className="text-xs underline opacity-80"
            onClick={() => {
              setDraft(
                board.tiles.find((tile) => tile.id === thrown.targetTileId)?.text ?? "",
              );
              setMode("revise");
            }}
          >
            rewrite it
          </button>
          <button
            type="button"
            className="text-xs underline opacity-80"
            onClick={() => setMode("decline")}
          >
            the card does not fit
          </button>
        </div>
      )}

      {answerable && mode === "revise" && (
        <div className="flex flex-col gap-1">
          <textarea
            className="w-full border border-current/30 p-1 text-sm"
            value={draft}
            maxLength={TILE_MAX_CHARS}
            disabled={pending}
            onChange={(event) => setDraft(event.target.value)}
          />
          <span className="text-xs opacity-60">
            {TILE_MAX_CHARS - draft.length} characters left
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="border border-current/30 px-2 py-0.5 text-xs disabled:opacity-40"
              disabled={pending || !reviseVerdict.ok}
              title={!reviseVerdict.ok ? reviseVerdict.error : undefined}
              onClick={runRevise}
            >
              Save the rewrite
            </button>
            <button
              type="button"
              className="text-xs underline opacity-70"
              disabled={pending}
              onClick={() => setMode("idle")}
            >
              cancel
            </button>
          </div>
        </div>
      )}

      {answerable && mode === "decline" && (
        <div className="flex flex-col gap-1">
          <input
            className="w-full border border-current/30 p-1 text-sm"
            placeholder="why it does not fit (optional)"
            value={reason}
            maxLength={DECLINE_REASON_MAX_CHARS}
            disabled={pending}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="border border-current/30 px-2 py-0.5 text-xs disabled:opacity-40"
              disabled={pending || !declineVerdict.ok}
              title={!declineVerdict.ok ? declineVerdict.error : undefined}
              onClick={runDecline}
            >
              Turn the card down
            </button>
            <button
              type="button"
              className="text-xs underline opacity-70"
              disabled={pending}
              onClick={() => setMode("idle")}
            >
              cancel
            </button>
          </div>
        </div>
      )}

      <ErrorLine error={error} />
    </div>
  );
}

/** Throws that are over, kept visible because the exchange is the record. */
function SettledThrow({ thrown }: { thrown: BoardThrow }) {
  return (
    <p className="ml-6 text-xs opacity-50">
      {cardLabel(thrown.cardId)}
      {thrown.status === "answered" ? ", answered by a rewrite" : ", turned down"}
      {thrown.status === "declined" && thrown.declineReason
        ? `: ${thrown.declineReason}`
        : ""}
    </p>
  );
}

/** A tile's text, short enough for a menu or a one-line summary. */
function shortText(board: BoardState, tileId: Uuid | null): string {
  if (!tileId) return "a reason";
  const tile = board.tiles.find((candidate) => candidate.id === tileId);
  if (!tile) return "a reason";
  if (tile.redacted) return REDACTED_TEXT;
  return tile.text.length > 40 ? `${tile.text.slice(0, 40)}...` : tile.text;
}

/**
 * Ask the other side to move a reason somewhere else on the board.
 *
 * Moving is a proposal rather than an edit because where a reason hangs is
 * itself a claim about what answers what. One player quietly rearranging the
 * shape of the argument is the move the game exists to prevent, so either
 * player may ask about either player's reason and the other side answers.
 */
function MoveForm({
  gameId,
  tile,
  board,
  onDone,
}: {
  gameId: string;
  tile: BoardTile;
  board: BoardState;
  onDone: () => void;
}) {
  const [target, setTarget] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // The same rule builds the menu and gates the button, so a destination is
  // never offered and then refused.
  const destinations = useMemo(
    () =>
      allTargets(board).filter(
        (candidate) =>
          canProposeRelocation(board, tile.id, candidate.id, candidate.threadRootId).ok,
      ),
    [board, tile.id],
  );

  const parentTileId = target.length > 0 ? target : null;
  const parent = destinations.find((candidate) => candidate.id === parentTileId) ?? null;
  // With no parent the reason heads its own thread; under one it joins whatever
  // thread that parent already belongs to.
  const threadRootId = parent ? parent.threadRootId : tile.id;
  const verdict = canProposeRelocation(board, tile.id, parentTileId, threadRootId);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result: ActionResult = await proposeRelocation(gameId, {
        tileId: tile.id,
        newParentTileId: parentTileId,
        newThreadRootId: threadRootId,
        // A move changes where a reason sits, not whose reason it is.
        newSide: tile.side,
      });
      if (!result.ok) setError(result.error);
      else onDone();
    });
  };

  return (
    <div className="ml-6 flex flex-col gap-1 border border-current/20 p-2">
      <label className="flex flex-col gap-1 text-xs">
        Move it under
        <select
          className="border border-current/30 p-1 text-sm"
          value={target}
          disabled={pending}
          onChange={(event) => setTarget(event.target.value)}
        >
          <option value="">Nothing: start its own thread</option>
          {destinations.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {SIDE_MARK[candidate.side]} {shortText(board, candidate.id)}
            </option>
          ))}
        </select>
      </label>
      <span className="flex gap-2">
        <button
          type="button"
          className="border border-current/30 px-2 py-0.5 text-xs disabled:opacity-40"
          disabled={pending || !verdict.ok}
          title={!verdict.ok ? verdict.error : undefined}
          onClick={submit}
        >
          Ask to move it
        </button>
        <button
          type="button"
          className="border border-current/30 px-2 py-0.5 text-xs"
          disabled={pending}
          onClick={onDone}
        >
          Cancel
        </button>
      </span>
      <ErrorLine error={error} />
    </div>
  );
}

function TileNode({
  tile,
  gameId,
  me,
  board,
}: {
  tile: BoardTile;
  gameId: string;
  me: { playerId: string; role: Side };
  board: BoardState;
}) {
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [draft, setDraft] = useState(tile.text);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const mine = tile.placedBy === me.playerId;
  const editVerdict = canEditTile(board, tile.id, me.playerId, draft);
  const removeVerdict = canRemoveTile(board, tile.id, me.playerId);
  const moveVerdict = canProposeRelocation(
    board,
    tile.id,
    tile.parentId,
    tile.threadRootId,
  );
  const throwsHere = board.throws.filter((thrown) => thrown.targetTileId === tile.id);
  const standing = throwsHere.filter((thrown) => thrown.status === "standing");
  const settled = throwsHere.filter((thrown) => thrown.status !== "standing");

  const runEdit = () => {
    setError(null);
    startTransition(async () => {
      const result: ActionResult = await editTile(gameId, {
        tileId: tile.id,
        text: draft,
      });
      if (!result.ok) setError(result.error);
      else setEditing(false);
    });
  };

  const runRemove = () => {
    setError(null);
    startTransition(async () => {
      const result: ActionResult = await removeTile(gameId, { tileId: tile.id });
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <span className="w-4 shrink-0 text-center font-semibold tabular-nums opacity-60">
          {SIDE_MARK[tile.side]}
        </span>
        {editing ? (
          <span className="flex flex-1 flex-col gap-1">
            <textarea
              className="w-full border border-current/30 p-1 text-sm"
              value={draft}
              maxLength={TILE_MAX_CHARS}
              disabled={pending}
              onChange={(event) => setDraft(event.target.value)}
            />
            <span className="text-xs opacity-60">
              {TILE_MAX_CHARS - draft.length} characters left
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                className="border border-current/30 px-2 py-0.5 text-xs disabled:opacity-40"
                disabled={pending || !editVerdict.ok}
                title={!editVerdict.ok ? editVerdict.error : undefined}
                onClick={runEdit}
              >
                Save
              </button>
              <button
                type="button"
                className="border border-current/30 px-2 py-0.5 text-xs"
                disabled={pending}
                onClick={() => {
                  setDraft(tile.text);
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            </span>
          </span>
        ) : (
          <span className="flex-1">
            <TileText tile={tile} />
            {tile.edited && <span className="ml-2 text-xs opacity-50">(edited)</span>}
            {tile.revised && <span className="ml-2 text-xs opacity-50">(rewritten)</span>}
            {mine && (
              <span className="ml-2 inline-flex gap-2">
                <button
                  type="button"
                  className="text-xs underline opacity-70 disabled:opacity-30"
                  disabled={pending || !editVerdict.ok}
                  onClick={() => setEditing(true)}
                >
                  edit
                </button>
                <button
                  type="button"
                  className="text-xs underline opacity-70 disabled:opacity-30"
                  disabled={pending || !removeVerdict.ok}
                  title={!removeVerdict.ok ? removeVerdict.error : undefined}
                  onClick={runRemove}
                >
                  remove
                </button>
              </span>
            )}
            {/* Anyone may ask to move any reason: the other side answers. */}
            <button
              type="button"
              className="ml-2 text-xs underline opacity-70 disabled:opacity-30"
              disabled={pending || moving || !moveVerdict.ok}
              title={!moveVerdict.ok ? moveVerdict.error : undefined}
              onClick={() => setMoving(true)}
            >
              move
            </button>
            {mine && <span className="ml-2 text-xs opacity-50">(yours)</span>}
          </span>
        )}
      </div>
      <ErrorLine error={error} />

      {moving && (
        <MoveForm
          gameId={gameId}
          tile={tile}
          board={board}
          onDone={() => setMoving(false)}
        />
      )}

      {/* The throw, from both ends. Standing cards show to both players, but
          only the reason's author gets the two ways to answer; the other side's
          reasons also show the hand. Settled throws stay on the board because
          the exchange is the record, not a step on the way to one. */}
      {standing.map((thrown) => (
        <StandingThrow
          key={thrown.seq}
          gameId={gameId}
          board={board}
          thrown={thrown}
          me={me}
          answerable={mine}
        />
      ))}
      {!mine && tile.side !== me.role && !tile.removed && (
        <CardHand gameId={gameId} tile={tile} me={me} board={board} />
      )}
      {settled.map((thrown) => (
        <SettledThrow key={thrown.seq} thrown={thrown} />
      ))}

      {tile.children.length > 0 && (
        <ul className="ml-2 flex flex-col gap-2 border-l border-current/15 pl-4">
          {tile.children.map((child) => (
            <TileNode key={child.id} tile={child} gameId={gameId} me={me} board={board} />
          ))}
        </ul>
      )}
    </li>
  );
}

function ResolutionRow({
  gameId,
  thread,
  me,
  board,
}: {
  gameId: string;
  thread: BoardThread;
  me: { playerId: string; role: Side };
  board: BoardState;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (isResolved(thread)) {
    return (
      <p className="text-sm">
        <span className="mr-1 text-lg align-middle">{thread.resolution!.emoji}</span>
        {thread.resolution!.note && (
          <span className="opacity-70">{thread.resolution!.note}</span>
        )}
      </p>
    );
  }

  const myToken = thread.pending[me.role];
  const otherToken = thread.pending[OTHER_SIDE[me.role]];

  const place = (emoji: string) => {
    setError(null);
    startTransition(async () => {
      const result = await placeResolutionToken(gameId, {
        threadRootId: thread.rootId,
        emoji,
      });
      if (!result.ok) setError(result.error);
    });
  };

  const clear = () => {
    setError(null);
    startTransition(async () => {
      const result = await clearResolutionToken(gameId, { threadRootId: thread.rootId });
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="opacity-60">You: {myToken ?? "no token"}</span>
        <span className="opacity-60">Them: {otherToken ?? "no token"}</span>
        {myToken ? (
          <button
            type="button"
            className="border border-current/30 px-2 py-0.5 text-xs"
            disabled={pending}
            onClick={clear}
          >
            take back your token
          </button>
        ) : (
          RESOLUTION_TOKENS.map((token) => {
            const verdict = canPlaceResolutionToken(board, thread.rootId, token);
            return (
              <button
                key={token}
                type="button"
                className="border border-current/30 px-2 py-0.5 text-xs disabled:opacity-40"
                disabled={pending || !verdict.ok}
                title={!verdict.ok ? verdict.error : undefined}
                onClick={() => place(token)}
              >
                {token}
              </button>
            );
          })
        )}
      </div>
      <ErrorLine error={error} />
    </div>
  );
}

/**
 * What each proposal kind is called out loud.
 *
 * The log's own names are snake_case identifiers and were leaking straight onto
 * the board, so a player was being asked to accept or reject a "topic_revision".
 * An unknown kind falls back to the identifier with its underscores opened up,
 * which is ugly but readable, and never blank.
 */
const PROPOSAL_KIND_LABEL: Record<ProposalKind, string> = {
  topic_revision: "A new wording for the topic",
  tile_relocation: "Move a reason",
  reading_handback: "Hand the reading back",
  steelman_reading: "Say their side for them",
  steelman_tile: "A reason for their side",
  definition: "Pin down a word",
};

function proposalKindLabel(kind: string): string {
  return PROPOSAL_KIND_LABEL[kind as ProposalKind] ?? kind.replaceAll("_", " ");
}

function proposalSummary(proposal: BoardProposal, board: BoardState): string {
  const content = proposal.content;
  if (proposal.kind === "topic_revision" && "text" in content) {
    return `New topic: "${content.text}"`;
  }
  if (proposal.kind === "tile_relocation" && "new_thread_root_id" in content) {
    // Named in words, not in ids: the player answering this has to be able to
    // picture the move without looking anything up.
    const moved = shortText(board, proposal.targetTileId);
    const under = content.new_parent_tile_id
      ? `under "${shortText(board, content.new_parent_tile_id)}"`
      : "into a thread of its own";
    return `Move "${moved}" ${under}`;
  }
  if (
    (proposal.kind === "steelman_tile" || proposal.kind === "steelman_reading") &&
    "text" in content
  ) {
    return `"${content.text}"`;
  }
  if (proposal.kind === "reading_handback" && "text" in content) {
    // Both halves, because judging a handback means comparing the words offered
    // against the reason they claim to say back. One of the two is not enough.
    return `Reads "${shortText(board, proposal.targetTileId)}" as: "${content.text}"`;
  }
  if (proposal.kind === "definition" && "term" in content) {
    return `Define "${content.term}": ${content.text}`;
  }
  return proposalKindLabel(proposal.kind);
}

function ProposalRow({
  gameId,
  proposal,
  board,
  awaitingMe,
}: {
  gameId: string;
  proposal: BoardProposal;
  board: BoardState;
  awaitingMe: boolean;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const accept = () => {
    setError(null);
    startTransition(async () => {
      const result = await acceptProposal(gameId, { proposalId: proposal.id });
      if (!result.ok) setError(result.error);
    });
  };

  const reject = () => {
    setError(null);
    startTransition(async () => {
      const result = await rejectProposal(gameId, {
        proposalId: proposal.id,
        reason: reason.trim().length > 0 ? reason.trim() : null,
      });
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <li className="flex flex-col gap-1 border border-current/15 p-2 text-sm">
      <span className="opacity-60">{proposalKindLabel(proposal.kind)}</span>
      <span>{proposalSummary(proposal, board)}</span>
      {awaitingMe ? (
        <span className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="border border-current/30 px-2 py-0.5 text-xs"
            disabled={pending}
            onClick={accept}
          >
            Accept
          </button>
          <input
            className="border border-current/30 px-1 py-0.5 text-xs"
            placeholder="reason (optional)"
            value={reason}
            disabled={pending}
            onChange={(event) => setReason(event.target.value)}
          />
          <button
            type="button"
            className="border border-current/30 px-2 py-0.5 text-xs"
            disabled={pending}
            onClick={reject}
          >
            Reject
          </button>
        </span>
      ) : (
        <span className="text-xs opacity-50">waiting on the other side</span>
      )}
      <ErrorLine error={error} />
    </li>
  );
}

function Composer({ gameId, board }: { gameId: string; board: BoardState }) {
  const [text, setText] = useState("");
  const [target, setTarget] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const targets = useMemo(() => allTargets(board), [board]);
  const parentTileId = target.length > 0 ? target : null;
  const verdict = canPlaceTile(board, text, parentTileId);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await placeTile(gameId, { text, parentTileId });
      if (!result.ok) setError(result.error);
      else setText("");
    });
  };

  return (
    <div className="flex flex-col gap-2 border border-current/20 p-3">
      <label className="flex flex-col gap-1 text-sm">
        Reply to
        <select
          className="border border-current/30 p-1"
          value={target}
          disabled={pending}
          onChange={(event) => setTarget(event.target.value)}
        >
          <option value="">Start a new thread</option>
          {targets.map((tile) => (
            <option key={tile.id} value={tile.id}>
              {SIDE_MARK[tile.side]}{" "}
              {tile.redacted ? REDACTED_TEXT : tile.text.slice(0, 40)}
            </option>
          ))}
        </select>
      </label>
      <textarea
        className="w-full border border-current/30 p-1 text-sm"
        value={text}
        maxLength={TILE_MAX_CHARS}
        disabled={pending}
        placeholder="A reason for your side."
        onChange={(event) => setText(event.target.value)}
      />
      <span className="text-xs opacity-60">
        {TILE_MAX_CHARS - text.length} characters left
      </span>
      <button
        type="button"
        className="self-start border border-current/30 px-3 py-1 text-sm disabled:opacity-40"
        disabled={pending || !verdict.ok}
        title={!verdict.ok ? verdict.error : undefined}
        onClick={submit}
      >
        Place tile
      </button>
      <ErrorLine error={error} />
    </div>
  );
}

function TopicRevisionForm({ gameId, board }: { gameId: string; board: BoardState }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const verdict = canProposeTopicRevision(board, text);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await proposeTopicRevision(gameId, { text });
      if (!result.ok) setError(result.error);
      else setText("");
    });
  };

  return (
    <div className="flex flex-col gap-2 border border-current/20 p-3">
      <label className="flex flex-col gap-1 text-sm">
        Propose a revised topic
        <textarea
          className="w-full border border-current/30 p-1 text-sm"
          value={text}
          maxLength={300}
          disabled={pending}
          placeholder="A statement both sides could sign."
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <button
        type="button"
        className="self-start border border-current/30 px-3 py-1 text-sm disabled:opacity-40"
        disabled={pending || !verdict.ok}
        title={!verdict.ok ? verdict.error : undefined}
        onClick={submit}
      >
        Propose
      </button>
      <ErrorLine error={error} />
    </div>
  );
}

/**
 * Reading their reason back in your own words, for them to judge.
 *
 * The picker only lists their reasons. Yours are not offered rather than
 * offered and refused, because a menu that contains a move you cannot make is a
 * menu you have to learn twice.
 */
function ReadingHandbackForm({
  gameId,
  board,
  me,
}: {
  gameId: string;
  board: BoardState;
  me: { playerId: string; role: Side };
}) {
  const [tileId, setTileId] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const theirs = useMemo(
    () => allTargets(board).filter((tile) => tile.side !== me.role),
    [board, me.role],
  );

  const verdict = canProposeReadingHandback(board, tileId, me.role, text);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await proposeReadingHandback(gameId, { tileId, text });
      if (!result.ok) setError(result.error);
      else setText("");
    });
  };

  if (theirs.length === 0) {
    return (
      <p className="text-sm opacity-50">
        Once they have placed a reason, you can try saying it back to them.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 border border-current/20 p-3">
      <label className="flex flex-col gap-1 text-sm">
        Say one of their reasons back
        <select
          className="border border-current/30 p-1 text-sm"
          value={tileId}
          disabled={pending}
          onChange={(event) => setTileId(event.target.value)}
        >
          <option value="">Pick one of their reasons</option>
          {theirs.map((tile) => (
            <option key={tile.id} value={tile.id}>
              {SIDE_MARK[tile.side]} {shortText(board, tile.id)}
            </option>
          ))}
        </select>
      </label>
      <textarea
        className="w-full border border-current/30 p-1 text-sm"
        value={text}
        maxLength={READING_MAX_CHARS}
        disabled={pending}
        placeholder="In your own words, what are they saying?"
        onChange={(event) => setText(event.target.value)}
      />
      <button
        type="button"
        className="self-start border border-current/30 px-3 py-1 text-sm disabled:opacity-40"
        disabled={pending || !verdict.ok}
        title={!verdict.ok ? verdict.error : undefined}
        onClick={submit}
      >
        Ask if you have it right
      </button>
      <ErrorLine error={error} />
    </div>
  );
}

/** Their whole side, said for them. Aimed at nothing on the board, so it can be
    offered before either of you has placed much. */
function SteelmanReadingForm({ gameId, board }: { gameId: string; board: BoardState }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const verdict = canProposeSteelmanReading(board, text);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await proposeSteelmanReading(gameId, { text });
      if (!result.ok) setError(result.error);
      else setText("");
    });
  };

  return (
    <div className="flex flex-col gap-2 border border-current/20 p-3">
      <label className="flex flex-col gap-1 text-sm">
        Say their side for them
        <textarea
          className="w-full border border-current/30 p-1 text-sm"
          value={text}
          maxLength={READING_MAX_CHARS}
          disabled={pending}
          placeholder="The strongest version of what they think."
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <button
        type="button"
        className="self-start border border-current/30 px-3 py-1 text-sm disabled:opacity-40"
        disabled={pending || !verdict.ok}
        title={!verdict.ok ? verdict.error : undefined}
        onClick={submit}
      >
        Ask if you have it right
      </button>
      <ErrorLine error={error} />
    </div>
  );
}

/**
 * A reason written for the other side, which lands on their half of the board
 * if they take it.
 *
 * Which side it goes on is never sent from here. The server derives it, so this
 * form has no field for it and no way to be wrong about it.
 */
function SteelmanTileForm({ gameId, board }: { gameId: string; board: BoardState }) {
  const [parent, setParent] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const destinations = useMemo(() => allTargets(board), [board]);
  const parentTileId = parent.length > 0 ? parent : null;
  const verdict = canProposeSteelmanTile(board, parentTileId, text);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await proposeSteelmanTile(gameId, { text, parentTileId });
      if (!result.ok) setError(result.error);
      else setText("");
    });
  };

  return (
    <div className="flex flex-col gap-2 border border-current/20 p-3">
      <label className="flex flex-col gap-1 text-sm">
        Offer them a reason
        <textarea
          className="w-full border border-current/30 p-1 text-sm"
          value={text}
          maxLength={TILE_MAX_CHARS}
          disabled={pending}
          placeholder="A reason for their side that you think they missed."
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        Hang it under
        <select
          className="border border-current/30 p-1 text-sm"
          value={parent}
          disabled={pending}
          onChange={(event) => setParent(event.target.value)}
        >
          <option value="">Nothing: start its own thread</option>
          {destinations.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {SIDE_MARK[candidate.side]} {shortText(board, candidate.id)}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="self-start border border-current/30 px-3 py-1 text-sm disabled:opacity-40"
        disabled={pending || !verdict.ok}
        title={!verdict.ok ? verdict.error : undefined}
        onClick={submit}
      >
        Offer it to them
      </button>
      <ErrorLine error={error} />
    </div>
  );
}

/** A word one of you keeps using and the other keeps hearing differently. */
function DefinitionForm({ gameId, board }: { gameId: string; board: BoardState }) {
  const [term, setTerm] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const verdict = canProposeDefinition(board, term, text);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await proposeDefinition(gameId, { term, text });
      if (!result.ok) setError(result.error);
      else {
        setTerm("");
        setText("");
      }
    });
  };

  return (
    <div className="flex flex-col gap-2 border border-current/20 p-3">
      <label className="flex flex-col gap-1 text-sm">
        Pin down a word
        <input
          className="w-full border border-current/30 p-1 text-sm"
          value={term}
          maxLength={DEFINITION_TERM_MAX_CHARS}
          disabled={pending}
          placeholder="The word"
          onChange={(event) => setTerm(event.target.value)}
        />
      </label>
      <textarea
        className="w-full border border-current/30 p-1 text-sm"
        value={text}
        maxLength={READING_MAX_CHARS}
        disabled={pending}
        placeholder="What it should mean for the rest of this game."
        onChange={(event) => setText(event.target.value)}
      />
      <button
        type="button"
        className="self-start border border-current/30 px-3 py-1 text-sm disabled:opacity-40"
        disabled={pending || !verdict.ok}
        title={!verdict.ok ? verdict.error : undefined}
        onClick={submit}
      >
        Ask them to agree
      </button>
      <ErrorLine error={error} />
    </div>
  );
}

function GenerosityButton({ gameId }: { gameId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const give = () => {
    setError(null);
    startTransition(async () => {
      const result = await giveGenerosityToken(gameId, {});
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        className="self-start border border-current/30 px-3 py-1 text-sm disabled:opacity-40"
        disabled={pending}
        onClick={give}
      >
        Give a generosity token
      </button>
      <ErrorLine error={error} />
    </div>
  );
}

/**
 * Walking out. A live board needs both sides, so this ends the game for the
 * other player too, which is why it takes a second press.
 */
function LeaveButton({ gameId }: { gameId: string }) {
  const [sure, setSure] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const leave = () => {
    if (!sure) {
      setSure(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await leaveGame(gameId, { reason: "quit" });
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        className="self-start border border-current/30 px-3 py-1 text-sm disabled:opacity-40"
        disabled={pending}
        onClick={leave}
      >
        {sure ? "Yes, end it for both of us" : "Leave this game"}
      </button>
      <p className="text-sm opacity-60">
        The map stays in your history either way, marked unfinished.
      </p>
      <ErrorLine error={error} />
    </div>
  );
}

function ThreadBlock({
  gameId,
  thread,
  index,
  me,
  board,
}: {
  gameId: string;
  thread: BoardThread;
  index: number;
  me: { playerId: string; role: Side };
  board: BoardState;
}) {
  return (
    <section className="flex flex-col gap-3 border-t border-current/15 pt-4">
      <header className="flex items-baseline justify-between gap-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          Thread {index + 1}
        </h3>
        <ResolutionRow gameId={gameId} thread={thread} me={me} board={board} />
      </header>

      <ul className="flex flex-col gap-2">
        {thread.root ? (
          <TileNode tile={thread.root} gameId={gameId} me={me} board={board} />
        ) : (
          <li className="opacity-50">The reason this thread started from is gone.</li>
        )}
      </ul>

      {thread.orphans.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-wide opacity-50">
            Replies to a removed reason
          </p>
          <ul className="flex flex-col gap-2">
            {thread.orphans.map((tile) => (
              <TileNode key={tile.id} tile={tile} gameId={gameId} me={me} board={board} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function LiveBoard({
  gameId,
  board,
  me,
  coachEnabled,
}: LiveBoardProps): ReactElement {
  const threads = liveThreads(board);
  const awaiting = proposalsAwaiting(board, me.role);
  const asked = proposalsFrom(board, me.role);
  // Refetches the server projection when the other player appends.
  const { connected } = useGameFeed(gameId);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
      <header className="flex flex-col gap-1 border-b border-current/15 pb-4">
        <p className="text-sm uppercase tracking-wide opacity-60">
          {board.status} · you are {SIDE_MARK[me.role]} ·{" "}
          {connected ? "live" : "reconnecting"}
        </p>
        <h1 className="text-xl font-semibold text-balance">
          {board.currentTopicText ?? "No topic was set."}
        </h1>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          Players
        </h2>
        <ul className="flex flex-col gap-1 text-sm">
          {board.players.map((player) => (
            <li key={player.id}>
              {player.role ? SIDE_MARK[player.role] : "?"}{" "}
              {player.displayName ?? "Someone"}
              {player.signed && player.signed.length > 0 ? " (signed)" : " (not signed)"}
              {player.left && ` (left: ${player.left})`}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          Generosity
        </h2>
        <p className="text-sm">
          {SIDE_MARK.plus} {board.generosity.plus} · {SIDE_MARK.minus}{" "}
          {board.generosity.minus}
        </p>
        <GenerosityButton gameId={gameId} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          Place a tile
        </h2>
        <Composer gameId={gameId} board={board} />
      </section>

      <CoachPanel gameId={gameId} board={board} me={me} enabled={coachEnabled} />

      {threads.length === 0 ? (
        <p className="opacity-70">No threads yet. Place the first tile above.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {threads.map((thread, index) => (
            <ThreadBlock
              key={thread.rootId}
              gameId={gameId}
              thread={thread}
              index={index}
              me={me}
              board={board}
            />
          ))}
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          Proposals waiting on you
        </h2>
        {awaiting.length === 0 ? (
          <p className="text-sm opacity-50">None right now.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {awaiting.map((proposal) => (
              <ProposalRow
                key={proposal.id}
                gameId={gameId}
                proposal={proposal}
                board={board}
                awaitingMe
              />
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          Proposals you asked
        </h2>
        {asked.length === 0 ? (
          <p className="text-sm opacity-50">None right now.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {asked.map((proposal) => (
              <ProposalRow
                key={proposal.id}
                gameId={gameId}
                proposal={proposal}
                board={board}
                awaitingMe={false}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          Understanding each other
        </h2>
        <ReadingHandbackForm gameId={gameId} board={board} me={me} />
        <SteelmanReadingForm gameId={gameId} board={board} />
        <SteelmanTileForm gameId={gameId} board={board} />
        <DefinitionForm gameId={gameId} board={board} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          Topic
        </h2>
        <TopicRevisionForm gameId={gameId} board={board} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          Leaving
        </h2>
        <LeaveButton gameId={gameId} />
      </section>
    </div>
  );
}
