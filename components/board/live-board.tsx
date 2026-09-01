"use client";

import {
  useCallback,
  useMemo,
  useState,
  useTransition,
  type ReactElement,
  type ReactNode,
} from "react";

import type {
  BoardProposal,
  BoardState,
  BoardThread,
  BoardThrow,
  BoardTile,
} from "@/lib/board/project";
import { REDACTED_TEXT, agreedDefinitions, liveThreads } from "@/lib/board/project";
import { TokenGlyph, tokenLabel } from "@/components/board/token-glyph";
import { TileShape, SideGlyph } from "@/components/board/tile-shape";
import { ResolutionPicker } from "@/components/board/resolution-picker";
import { TopicTile } from "@/components/board/topic-tile";
import { TopicCell, pendingTopicRevision } from "@/components/board/topic-cell";
import { SpatialBoard } from "@/components/board/spatial-board";
import { TOPIC_CELL_ID } from "@/components/board/layout";
import { CollapsedThread } from "@/components/board/collapsed-thread";
import { WaysToWinCard, type MiniThread } from "@/components/board/ways-to-win-card";
import { OnboardingOverlay } from "@/components/onboarding/onboarding-overlay";
import { FeedbackPopover } from "@/components/feedback/feedback-popover";
import {
  DECLINE_REASON_MAX_CHARS,
  DEFINITION_TERM_MAX_CHARS,
  MAX_THREADS,
  MIN_THREADS_TO_END,
  OTHER_SIDE,
  READING_MAX_CHARS,
  RESOLUTION_TOKENS,
  TILE_MAX_CHARS,
  type Verdict,
  canDeclineThrow,
  canEditTile,
  canPlaceResolutionToken,
  canPlaceTile,
  canProposeDefinition,
  canProposeReadingHandback,
  canProposeRelocation,
  canProposeSteelmanReading,
  canProposeSteelmanTile,
  canRemoveTile,
  canReviseTile,
  canThrowCard,
  cardsInPlay,
  isResolved,
  proposalsAwaiting,
  proposalsFrom,
  topicAgreementEndsGame,
} from "@/lib/board/rules";
import { coachCard } from "@/lib/coach/cards";
import { CLAIM_SIZE_ROOT_SUGGESTIONS } from "@/lib/gym/root-suggestions";
import { useGameFeed } from "./use-game-feed";
import { usePeerNotices } from "./peer-notices";
import { CoachPanel } from "./coach-panel";
import { SIDE_LABEL, SIDE_MARK } from "./side-label";
import { TilePicker } from "./tile-picker";
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

const STATUS_LABEL: Record<BoardState["status"], string> = {
  lobby: "Not started",
  active: "In progress",
  ended: "Finished",
};

export interface LiveBoardProps {
  gameId: string;
  board: BoardState;
  me: { playerId: string; role: Side };
  /** Whether this player has the coach switched on. Off by default. */
  coachEnabled: boolean;
  /** Room code, small print during play. Display only: no link, no share
   *  token, until Steve decides there should be (BRAIN-T260822-14). */
  joinCode?: string | null;
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
  return <p className="text-p-sm text-orange">{error}</p>;
}

/**
 * Why the control beside this line is dead, in words rather than in a tooltip.
 *
 * A `title` is not an explanation. It needs a mouse, it needs a hover held long
 * enough to trust, and on a touch screen it never appears at all. A player who
 * clicks a greyed-out control and gets nothing concludes the game is broken,
 * and the game is almost never broken: it is full, or that thread is already
 * resolved, or the move belongs to the other person.
 *
 * Grey rather than red, because none of this is an error. Red is ErrorLine, and
 * it means the server turned a move down after you made it.
 *
 * Callers pass null when there is nothing worth saying yet, which is the normal
 * state of a form nobody has filled in.
 */
function WhyNot({ verdict }: { verdict: Verdict | null }) {
  if (!verdict || verdict.ok) return null;
  return <p className="text-xs text-gray">{verdict.error}</p>;
}

/**
 * The same, for a row of buttons: every distinct reason, each said once.
 *
 * A hand of cards or a row of resolution tokens is usually refused for one
 * reason that covers all of them. Printed per button that is the same sentence
 * over and over; printed nowhere it is a row of dead controls giving no account
 * of themselves.
 */
function WhyNotAll({
  verdicts,
  className = "text-xs text-gray",
}: {
  verdicts: readonly (Verdict | null)[];
  className?: string;
}) {
  const reasons = Array.from(
    new Set(
      verdicts.flatMap((verdict) => (verdict && !verdict.ok ? [verdict.error] : [])),
    ),
  );
  return (
    <>
      {reasons.map((reason) => (
        <p key={reason} className={className}>
          {reason}
        </p>
      ))}
    </>
  );
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
          className="text-xs underline text-gray"
          onClick={() => setOpen(true)}
        >
          play a card
        </button>
      </div>
    );
  }

  // This component's doc comment promises that a card says why it cannot be
  // thrown. A tooltip does not keep that promise, and eleven copies of "cards
  // go to the other side's reasons" would not either, so the reasons go under
  // the row, deduped.
  const cardVerdicts = deck.map((cardId) =>
    canThrowCard(board, tile.id, cardId, me.role, me.playerId),
  );

  return (
    <div className="ml-6 flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        {deck.map((cardId, index) => {
          const verdict = cardVerdicts[index];
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
          className="text-xs underline text-gray"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          never mind
        </button>
      </div>
      <WhyNotAll verdicts={cardVerdicts} />
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

  // The real verdict once there is something in the box, a stand-in before it.
  // "A reason needs some words in it" is not news about an empty box; a thread
  // that has already resolved is.
  const reviseBlocked =
    draft.trim().length > 0
      ? reviseVerdict
      : canReviseTile(
          board,
          thrown.targetTileId,
          thrown.seq,
          me.playerId,
          "a rewritten reason",
        );

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
    <div className="ml-6 flex flex-col gap-1 border-l-2 border-gold/50 pl-3">
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
            className="w-full border border-current/30 p-1 text-p-sm"
            value={draft}
            maxLength={TILE_MAX_CHARS}
            disabled={pending}
            onChange={(event) => setDraft(event.target.value)}
          />
          <span className="text-xs opacity-60">
            {TILE_MAX_CHARS - draft.length} characters left
          </span>
          <WhyNot verdict={reviseBlocked} />
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
              className="text-xs underline text-gray"
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
            className="w-full border border-current/30 p-1 text-p-sm"
            placeholder="why it does not fit (optional)"
            value={reason}
            maxLength={DECLINE_REASON_MAX_CHARS}
            disabled={pending}
            onChange={(event) => setReason(event.target.value)}
          />
          <WhyNot verdict={declineVerdict} />
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
              className="text-xs underline text-gray"
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
      <TilePicker
        legend="Move it under"
        value={target}
        disabled={pending}
        noneLabel="Nothing: start its own thread"
        onChange={setTarget}
        choices={destinations.map((candidate) => ({
          id: candidate.id,
          side: candidate.side,
          label: shortText(board, candidate.id),
        }))}
      />
      <WhyNot verdict={verdict} />
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
  // Once the box is open the draft is what gets judged. Before that there is no
  // draft, and "a reason needs some words in it" is not why the link is dead.
  const editBlocked =
    draft.trim().length > 0
      ? editVerdict
      : canEditTile(board, tile.id, me.playerId, "a reason");
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
    <li className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <TileShape
            side={tile.side}
            size={11}
            watermark={tile.removed ? undefined : "reason"}
            className={tile.removed ? "opacity-40" : undefined}
          >
            {editing ? (
              <textarea
                className="font-tiles text-p-sm h-16 w-full resize-none bg-transparent text-center focus:outline-none"
                value={draft}
                maxLength={TILE_MAX_CHARS}
                disabled={pending}
                onChange={(event) => setDraft(event.target.value)}
              />
            ) : (
              <TileText tile={tile} />
            )}
          </TileShape>
          <SideGlyph
            side={tile.side === "plus" ? "plus" : "minus"}
            className="absolute top-0 left-0 z-20 size-5"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1 pt-1">
          {editing ? (
            <>
              <span className="text-p-sm text-gray">
                {TILE_MAX_CHARS - draft.length} characters left
              </span>
              <WhyNot verdict={editBlocked} />
              <span className="flex gap-2">
                <button
                  type="button"
                  className="form-base btn-primary px-3 py-1 text-xs disabled:opacity-40"
                  disabled={pending || !editVerdict.ok}
                  title={!editVerdict.ok ? editVerdict.error : undefined}
                  onClick={runEdit}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="form-base px-3 py-1 text-xs"
                  disabled={pending}
                  onClick={() => {
                    setDraft(tile.text);
                    setEditing(false);
                  }}
                >
                  Cancel
                </button>
              </span>
            </>
          ) : (
            <>
              <span className="text-p-sm text-gray flex flex-wrap items-center gap-2">
                {tile.edited && <span>(edited)</span>}
                {tile.revised && <span>(rewritten)</span>}
                {mine && <span>(yours)</span>}
              </span>
              <span className="flex flex-wrap gap-3">
                {mine && (
                  <>
                    <button
                      type="button"
                      className="text-p-sm underline text-gray disabled:opacity-30"
                      disabled={pending || !editBlocked.ok}
                      title={!editBlocked.ok ? editBlocked.error : undefined}
                      onClick={() => setEditing(true)}
                    >
                      edit
                    </button>
                    <button
                      type="button"
                      className="text-p-sm underline text-gray disabled:opacity-30"
                      disabled={pending || !removeVerdict.ok}
                      title={!removeVerdict.ok ? removeVerdict.error : undefined}
                      onClick={runRemove}
                    >
                      remove
                    </button>
                  </>
                )}
                {/* Anyone may ask to move any reason: the other side answers. */}
                <button
                  type="button"
                  className="text-p-sm underline text-gray disabled:opacity-30"
                  disabled={pending || moving || !moveVerdict.ok}
                  title={!moveVerdict.ok ? moveVerdict.error : undefined}
                  onClick={() => setMoving(true)}
                >
                  move
                </button>
              </span>
            </>
          )}
        </div>
      </div>
      <ErrorLine error={error} />
      {/* The links above go dead together and for the same reason, so the
          reason is said once under the reason it belongs to. */}
      {editing ? null : (
        <WhyNotAll
          className="text-p-sm text-gray ml-6"
          verdicts={[mine ? editBlocked : null, mine ? removeVerdict : null, moveVerdict]}
        />
      )}

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
      <p className="text-p-sm flex items-center gap-2">
        <TokenGlyph token={thread.resolution!.emoji} size={22} />
        <span className="text-gray">{tokenLabel(thread.resolution!.emoji)}</span>
        {thread.resolution!.note && (
          <span className="text-gray italic">{thread.resolution!.note}</span>
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

  // Every token in the row is refused for the same reason when it is refused at
  // all, so the reason goes under the row once rather than into six tooltips.
  const tokenVerdicts = RESOLUTION_TOKENS.map((token) =>
    canPlaceResolutionToken(board, thread.rootId, token),
  );

  const disabledTokens = RESOLUTION_TOKENS.filter((_, index) => !tokenVerdicts[index].ok);

  return (
    <div className="flex flex-col items-center gap-2 text-p-sm">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Placed who="You" token={myToken} />
        <Placed who="Them" token={otherToken} />
      </div>
      {myToken ? (
        <button
          type="button"
          className="form-base px-3 py-1 text-xs"
          disabled={pending}
          onClick={clear}
        >
          take back your token
        </button>
      ) : (
        <ResolutionPicker
          tokens={RESOLUTION_TOKENS}
          disabledTokens={disabledTokens}
          onPick={place}
        />
      )}
      {myToken ? null : <WhyNotAll verdicts={tokenVerdicts} />}
      <ErrorLine error={error} />
    </div>
  );
}

/**
 * One side's token on a thread, or the fact that they have not placed one.
 *
 * The token reads as art plus its meaning in words, because a drawing of a pair
 * of eyes does not say "agree to disagree" to anyone who has not been told.
 */
function Placed({ who, token }: { who: string; token: string | null | undefined }) {
  if (!token) {
    return <span className="opacity-60">{who}: no token</span>;
  }
  return (
    <span className="flex items-center gap-1.5 opacity-80">
      <span className="opacity-60">{who}:</span>
      <TokenGlyph token={token} size={20} />
      <span>{tokenLabel(token)}</span>
    </span>
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
    <li className="flex flex-col gap-1 border border-current/15 p-2 text-p-sm">
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

/**
 * The anchor the board's ghost slots scroll to. Clicking an open diagonal
 * picks the parent, and the box you then type in is somewhere further down
 * the page, so the click has to take you there or it looks like it did
 * nothing.
 */
const COMPOSER_SECTION_ID = "place-a-tile";

function Composer({
  gameId,
  board,
  target,
  onTargetChange,
}: {
  gameId: string;
  board: BoardState;
  /** Id of the tile being answered, or "" for a new thread. Owned by LiveBoard
   * because the board above picks it by click and the composer only reports
   * it back. */
  target: string;
  onTargetChange: (next: string) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const targets = useMemo(() => allTargets(board), [board]);
  const parentTileId = target.length > 0 ? target : null;
  // A tile the board no longer shows (removed, or a stale id after a
  // relocation) must not leave the composer claiming to answer it.
  const answering = useMemo(
    () => targets.find((tile) => tile.id === parentTileId) ?? null,
    [targets, parentTileId],
  );
  const verdict = canPlaceTile(board, text, parentTileId);

  // Gym level 3 ("Claim size") teaches No Exaggeration. Two pre-written root
  // threads about the level's tipping topic are offered as optional
  // starting points, but only while the tile being composed is a root tile
  // (no reply target picked): a suggestion for a brand new thread has
  // nothing to say about a reply to something already on the board.
  const showRootSuggestions =
    board.mode === "gym" && board.levelId === "claim_size" && parentTileId === null;

  // Computed against a placeholder instead of the real text on purpose. An
  // empty box is the normal state of a composer and "a reason needs some
  // words in it" is not news. What is news is a block that no amount of
  // typing clears: the thread cap, a resolved thread, a game that has ended.
  // WhyNot, above, is where the rest of that argument is written down.
  const blocked = canPlaceTile(board, "a reason", parentTileId);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await placeTile(gameId, { text, parentTileId });
      if (!result.ok) setError(result.error);
      else {
        setText("");
        onTargetChange("");
      }
    });
  };

  return (
    <div className="flex flex-col gap-2 border border-current/20 p-3">
      {/*
        This used to be a dropdown of every tile on the board, which asked a
        player to find the reason they were answering in a list of truncated
        strings. The board above is where that choice belongs now: hover a
        tile, click one of its open diagonals. All this has to do is say
        which one you picked and let you back out of it.
      */}
      <div className="text-p-sm flex flex-wrap items-baseline gap-2">
        {answering === null ? (
          <span>
            Starting a new thread. Click an open slot around a reason on the board to
            answer it instead.
          </span>
        ) : (
          <>
            <span className="opacity-60">Answering</span>
            <span>
              {SIDE_MARK[answering.side]}{" "}
              {answering.redacted ? REDACTED_TEXT : answering.text.slice(0, 60)}
            </span>
            <button
              type="button"
              className="border border-current/30 px-2 py-0.5 text-xs disabled:opacity-40"
              disabled={pending}
              onClick={() => onTargetChange("")}
            >
              start a new thread instead
            </button>
          </>
        )}
      </div>
      {showRootSuggestions && (
        <div className="flex flex-col gap-2 border border-current/20 p-2 text-xs">
          <p className="opacity-60">
            Optional starting points for a new thread on this topic. Click one to load it
            into the box below, then edit it however you like before placing it.
          </p>
          {CLAIM_SIZE_ROOT_SUGGESTIONS.map((pair) => (
            <div key={pair.id} className="flex flex-wrap gap-2">
              <button
                type="button"
                className="border border-current/30 px-2 py-0.5 text-left disabled:opacity-40"
                disabled={pending}
                onClick={() => setText(pair.baited)}
              >
                {pair.baited}
              </button>
              <button
                type="button"
                className="border border-current/30 px-2 py-0.5 text-left disabled:opacity-40"
                disabled={pending}
                onClick={() => setText(pair.safe)}
              >
                {pair.safe}
              </button>
            </div>
          ))}
        </div>
      )}
      <textarea
        className="w-full border border-current/30 p-1 text-p-sm"
        value={text}
        maxLength={TILE_MAX_CHARS}
        disabled={pending}
        placeholder="A reason for your side."
        onChange={(event) => setText(event.target.value)}
      />
      <span className="text-xs opacity-60">
        {TILE_MAX_CHARS - text.length} characters left
      </span>
      <WhyNot verdict={blocked} />
      <button
        type="button"
        className="self-start border border-current/30 px-3 py-1 text-p-sm disabled:opacity-40"
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

/**
 * The anchor the Ways-to-win pencil scrolls to. The two ways to win are drawn
 * at the top of the page, above the board, and rewriting the topic now happens
 * on the topic tile itself, so the pencil opens that editor and then brings the
 * board into view rather than sending you to a form somewhere else.
 */
const BOARD_SECTION_ID = "the-board";

/**
 * Reading their reason back in your own words, for them to judge.
 *
 * The picker only lists their reasons. Yours are not offered rather than
 * offered and refused, because a menu that contains a move you cannot make is a
 * menu you have to learn twice.
 */
/**
 * One of the cooperative moves, with a heading and a line saying what it is for.
 *
 * Rendered flat, the four forms below are eight controls in a row: a player
 * cannot tell which control belongs to which move, that two of them are about
 * saying the other side back, or that every one of them is a proposal the other
 * player has to accept before anything happens.
 */
// Unrendered on purpose: rule-card machinery waiting for a hand to be played
// from. See the note where "Understanding each other" used to be rendered.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Move({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border border-current/20 p-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-p-sm font-semibold">{title}</h3>
        <p className="text-xs opacity-60">{hint}</p>
      </div>
      {children}
    </div>
  );
}

// Unrendered on purpose: rule-card machinery waiting for a hand to be played
// from. See the note where "Understanding each other" used to be rendered.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  // Nothing worth saying until a reason is picked: "that reason is not on this
  // board" is true of the empty selection and is not what the player needs.
  const blocked =
    tileId.length === 0
      ? null
      : text.trim().length > 0
        ? verdict
        : canProposeReadingHandback(board, tileId, me.role, "a reading");

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
      <p className="text-p-sm opacity-50">
        Once they have placed a reason, you can try saying it back to them.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <TilePicker
        legend="Which of their reasons"
        value={tileId}
        disabled={pending}
        onChange={setTileId}
        choices={theirs.map((tile) => ({
          id: tile.id,
          side: tile.side,
          label: shortText(board, tile.id),
        }))}
      />
      <textarea
        className="w-full border border-current/30 p-1 text-p-sm"
        value={text}
        maxLength={READING_MAX_CHARS}
        disabled={pending}
        placeholder="In your own words, what are they saying?"
        onChange={(event) => setText(event.target.value)}
      />
      <WhyNot verdict={blocked} />
      <button
        type="button"
        className="self-start border border-current/30 px-3 py-1 text-p-sm disabled:opacity-40"
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
// Unrendered on purpose: rule-card machinery waiting for a hand to be played
// from. See the note where "Understanding each other" used to be rendered.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SteelmanReadingForm({ gameId, board }: { gameId: string; board: BoardState }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const verdict = canProposeSteelmanReading(board, text);
  const blocked =
    text.trim().length > 0 ? verdict : canProposeSteelmanReading(board, "a reading");

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await proposeSteelmanReading(gameId, { text });
      if (!result.ok) setError(result.error);
      else setText("");
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        className="w-full border border-current/30 p-1 text-p-sm"
        value={text}
        maxLength={READING_MAX_CHARS}
        disabled={pending}
        placeholder="The strongest version of what they think."
        onChange={(event) => setText(event.target.value)}
      />
      <WhyNot verdict={blocked} />
      <button
        type="button"
        className="self-start border border-current/30 px-3 py-1 text-p-sm disabled:opacity-40"
        disabled={pending || !verdict.ok}
        title={!verdict.ok ? verdict.error : undefined}
        onClick={submit}
      >
        Ask if that is their side
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
// Unrendered on purpose: rule-card machinery waiting for a hand to be played
// from. See the note where "Understanding each other" used to be rendered.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SteelmanTileForm({ gameId, board }: { gameId: string; board: BoardState }) {
  const [parent, setParent] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const destinations = useMemo(() => allTargets(board), [board]);
  const parentTileId = parent.length > 0 ? parent : null;
  const verdict = canProposeSteelmanTile(board, parentTileId, text);
  // Against a stand-in this surfaces the six-thread ceiling, which is the block
  // no amount of typing clears and the one a player hits without warning.
  const blocked =
    text.trim().length > 0
      ? verdict
      : canProposeSteelmanTile(board, parentTileId, "a reason");

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await proposeSteelmanTile(gameId, { text, parentTileId });
      if (!result.ok) setError(result.error);
      else setText("");
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        className="w-full border border-current/30 p-1 text-p-sm"
        value={text}
        maxLength={TILE_MAX_CHARS}
        disabled={pending}
        placeholder="A reason for their side that you think they missed."
        onChange={(event) => setText(event.target.value)}
      />
      <TilePicker
        legend="Hang it under"
        value={parent}
        disabled={pending}
        noneLabel="Nothing: start its own thread"
        onChange={setParent}
        choices={destinations.map((candidate) => ({
          id: candidate.id,
          side: candidate.side,
          label: shortText(board, candidate.id),
        }))}
      />
      <WhyNot verdict={blocked} />
      <button
        type="button"
        className="self-start border border-current/30 px-3 py-1 text-p-sm disabled:opacity-40"
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
// Unrendered on purpose: rule-card machinery waiting for a hand to be played
// from. See the note where "Understanding each other" used to be rendered.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function DefinitionForm({ gameId, board }: { gameId: string; board: BoardState }) {
  const [term, setTerm] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const verdict = canProposeDefinition(board, term, text);
  const blocked =
    term.trim().length > 0 && text.trim().length > 0
      ? verdict
      : canProposeDefinition(board, "a word", "a meaning");

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
    <div className="flex flex-col gap-2">
      <input
        className="w-full border border-current/30 p-1 text-p-sm"
        value={term}
        maxLength={DEFINITION_TERM_MAX_CHARS}
        disabled={pending}
        placeholder="The word"
        onChange={(event) => setTerm(event.target.value)}
      />
      <textarea
        className="w-full border border-current/30 p-1 text-p-sm"
        value={text}
        maxLength={READING_MAX_CHARS}
        disabled={pending}
        placeholder="What it should mean for the rest of this game."
        onChange={(event) => setText(event.target.value)}
      />
      <WhyNot verdict={blocked} />
      <button
        type="button"
        className="self-start border border-current/30 px-3 py-1 text-p-sm disabled:opacity-40"
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
        className="self-start border border-current/30 px-3 py-1 text-p-sm disabled:opacity-40"
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
        className="self-start border border-current/30 px-3 py-1 text-p-sm disabled:opacity-40"
        disabled={pending}
        onClick={leave}
      >
        {sure ? "Yes, end it for both of us" : "Leave this game"}
      </button>
      <p className="text-p-sm opacity-60">
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
  const resolved = isResolved(thread);

  return (
    <section className="border-neutral-black/15 flex flex-col gap-3 border-t pt-4">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <h3 className="font-primary text-p-sm text-gray tracking-wide uppercase">
          Thread {index + 1}
        </h3>
        <ResolutionRow gameId={gameId} thread={thread} me={me} board={board} />
      </header>

      {resolved && thread.root ? (
        // A resolved thread collapses into a fanned stack, the way the
        // retired client's CollapsedThread.vue did, rather than staying open
        // as a full tree once the disagreement has been named.
        <CollapsedThread root={thread.root} />
      ) : (
        <ul className="flex flex-col gap-2">
          {thread.root ? (
            <TileNode tile={thread.root} gameId={gameId} me={me} board={board} />
          ) : (
            <li className="text-gray">The reason this thread started from is gone.</li>
          )}
        </ul>
      )}

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

/**
 * How close this game is to ending, in both of the ways it can end.
 *
 * Both win conditions are cooperative and both were invisible here. The topic
 * route was described in prose far below the board; the thread route was
 * described nowhere at all, and its two numbers were enforced silently. A
 * player could resolve every thread on the board and have nothing happen,
 * because the floor is four and they had three, with nothing on the screen that
 * would ever tell them so.
 *
 * The counts come from the same functions the rules enforce, so this cannot
 * describe a different game than the one being played.
 */
function HowThisEnds({ board }: { board: BoardState }) {
  const threads = liveThreads(board);
  const resolved = threads.filter(isResolved).length;
  const unresolved = threads.length - resolved;
  const shortBy = Math.max(0, MIN_THREADS_TO_END - threads.length);
  // Same denominator the Ways to win card uses: the threads that actually
  // exist. Winning is resolving all of them, not reaching a number (Steve,
  // 2026-09-01). MIN_THREADS_TO_END still gates the ending in the engine, so
  // this panel is where that floor gets explained, in the sentence below.

  const threadRoute =
    shortBy > 0
      ? unresolved === 0 && threads.length > 0
        ? `Every thread here is resolved, and that on its own does not end it: a game needs at least ${MIN_THREADS_TO_END} threads. ${
            shortBy === 1
              ? "One more argument to have."
              : `${shortBy} more arguments to have.`
          }`
        : `Resolving every thread ends the game, once there are at least ${MIN_THREADS_TO_END} of them.`
      : unresolved === 0
        ? null
        : unresolved === 1
          ? "Settle the last one and the game is over."
          : "Settle them all and the game is over.";

  // Quiet until the ceiling is close enough to matter. A board with two threads
  // on it does not need to hear about the sixth.
  const ceiling =
    threads.length >= MAX_THREADS
      ? `There are ${MAX_THREADS} threads here, which is the most a board holds. A new reason has to hang off one that is already here.`
      : threads.length === MAX_THREADS - 1
        ? "One more new thread and the board is full."
        : null;

  return (
    <section className="flex flex-col gap-2 border border-current/15 p-3">
      <h2 className="text-p-sm font-semibold uppercase tracking-wide opacity-60">
        How this game ends
      </h2>
      <p className="text-p-sm">
        {threads.length === 0
          ? "No threads yet."
          : `${resolved} of ${threads.length} threads resolved.`}
        {threadRoute ? ` ${threadRoute}` : null}
      </p>
      {ceiling ? <p className="text-p-sm text-gray">{ceiling}</p> : null}
      {topicAgreementEndsGame(board) ? (
        <p className="text-p-sm text-gray">
          The other way out is agreeing on a rewritten topic. Click the topic in the
          middle of the board and write the version you would both sign. Either ending is
          a win, and it is the same win for both of you.
        </p>
      ) : null}
    </section>
  );
}

export function LiveBoard({
  gameId,
  board,
  me,
  coachEnabled,
  joinCode = null,
}: LiveBoardProps): ReactElement {
  const threads = liveThreads(board);
  const definitions = agreedDefinitions(board);

  // Which tile the next one will hang off. It lives up here rather than in
  // the composer because the board picks it: a player hovers a tile and
  // clicks one of its open diagonals, and the composer only reports back
  // what that click chose. "" means a new thread, which is what the four
  // slots around the topic tile mean.
  const [replyTarget, setReplyTarget] = useState("");

  // Placement is offered per parent, because the rules answer per parent: a
  // resolved thread takes no more replies, and the topic stops offering new
  // threads at the cap. TOPIC_CELL_ID is not a tile, so it asks the
  // new-thread question instead.
  const canPlaceUnder = useCallback(
    (parentId: string) =>
      canPlaceTile(board, "a reason", parentId === TOPIC_CELL_ID ? null : parentId).ok,
    [board],
  );
  const placementEnabled =
    canPlaceUnder(TOPIC_CELL_ID) || allTargets(board).some((t) => canPlaceUnder(t.id));
  const awaiting = proposalsAwaiting(board, me.role);
  const asked = proposalsFrom(board, me.role);
  // Refetches the server projection when the other player appends.
  const { connected } = useGameFeed(gameId);
  // Toasts what the other player did between one projection and the next.
  usePeerNotices(board, me.role);

  // The minimap wants an edge per thread so a thread keeps its corner as the
  // board grows. Nothing in the projection records where a tile sits, so
  // there is no edge to give it and the corners fill in thread order
  // instead: stable for a given board, because thread order is placement
  // order. See the parentEdge note in ways-to-win-card.tsx.
  const miniThreads = useMemo<MiniThread[]>(
    () =>
      threads.map((thread) => ({
        tileId: thread.rootId,
        side: thread.root?.side ?? thread.orphans[0]?.side ?? "plus",
        parentEdge: null,
        resolved: thread.resolution !== null,
        token: thread.resolution?.emoji ?? null,
      })),
    [threads],
  );
  const resolvedCount = miniThreads.filter((thread) => thread.resolved).length;
  // Matches the retired client's isTutorialOpen: true on every arrival at the
  // board, no "seen it already" memory anywhere. See
  // components/onboarding/onboarding-overlay.tsx for why that is deliberate.
  const [onboardingOpen, setOnboardingOpen] = useState(true);
  // The topic editor opens from two places (the tile itself and the Ways to
  // win pencil), so the board owns whether it is open, not the tile.
  const [topicEditing, setTopicEditing] = useState(false);
  const topicPending = pendingTopicRevision(board) !== null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
      <header className="border-neutral-black/15 relative flex flex-col items-center gap-3 border-b pb-4">
        {/*
          The board's utility row: small controls that are not part of play
          itself. The floating feedback button (app/layout.tsx) hides itself
          on /game routes so it never floats over the board; this inline pill
          is the replacement entry point while a game is in view.
        */}
        <div className="absolute right-0 top-0 flex items-center gap-2">
          <FeedbackPopover variant="inline" />
          <button
            type="button"
            title="Instructions"
            aria-label="Instructions"
            onClick={() => setOnboardingOpen(true)}
            className="btn-icon h-9 w-9 rounded-full border-2 border-gray bg-offwhite text-p-md font-bold text-neutral-black shadow-md"
          >
            ?
          </button>
        </div>
        <p className="text-p-sm text-gray">
          {joinCode ? (
            <>
              Room{" "}
              <span className="text-neutral-black font-mono font-semibold">
                {joinCode}
              </span>{" "}
              ·{" "}
            </>
          ) : null}
          {STATUS_LABEL[board.status]} · you are {SIDE_LABEL[me.role]} ·{" "}
          {connected ? "updating live" : "reconnecting"}
        </p>
        <TopicTile text={board.currentTopicText} />
      </header>

      <OnboardingOverlay
        open={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        myRole={me.role}
      />

      <section className="flex flex-col gap-2">
        <h2 className="text-p-sm font-semibold uppercase tracking-wide opacity-60">
          Players
        </h2>
        <ul className="flex flex-col gap-1 text-p-sm">
          {board.players.map((player) => (
            <li key={player.id}>
              {player.displayName ?? "Someone"}
              {player.id === me.playerId ? " (you)" : ""}
              {": "}
              {player.role ? SIDE_LABEL[player.role] : "no side yet"}
              {player.signed && player.signed.length > 0
                ? ", signed"
                : ", has not signed"}
              {player.left && `, left: ${player.left}`}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-p-sm font-semibold uppercase tracking-wide opacity-60">
          Generosity
        </h2>
        <p className="text-p-sm text-gray">
          Thanks, on the record. When the other player takes a challenge well, or rewrites
          a reason to meet you halfway, give them a token. It always goes to them, and it
          counts toward nothing: this game is won together or not at all.
        </p>
        <p className="text-p-sm">
          {SIDE_LABEL.plus} has been given {board.generosity.plus} · {SIDE_LABEL.minus}{" "}
          has been given {board.generosity.minus}
        </p>
        <GenerosityButton gameId={gameId} />
      </section>

      <section id={COMPOSER_SECTION_ID} className="flex flex-col gap-2">
        <h2 className="text-p-sm font-semibold uppercase tracking-wide opacity-60">
          Place a tile
        </h2>
        <Composer
          gameId={gameId}
          board={board}
          target={replyTarget}
          onTargetChange={setReplyTarget}
        />
      </section>

      <CoachPanel gameId={gameId} board={board} me={me} enabled={coachEnabled} />

      {definitions.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-p-sm font-semibold uppercase tracking-wide opacity-60">
            Words you have pinned down
          </h2>
          <dl className="flex flex-col gap-2 text-p-sm">
            {definitions.map((entry) => (
              <div key={entry.proposalId} className="flex flex-col">
                <dt className="font-semibold">{entry.term}</dt>
                <dd className="opacity-80">{entry.text}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="flex flex-col items-start gap-4 sm:flex-row">
        <div className="w-full max-w-[13rem] shrink-0">
          <WaysToWinCard
            threads={miniThreads}
            resolvedCount={resolvedCount}
            onRevise={() => {
              setTopicEditing(true);
              document
                .getElementById(BOARD_SECTION_ID)
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          />
        </div>
        <div className="w-full">
          <HowThisEnds board={board} />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/*
          The board is drawn from the first moment, before anybody has placed
          anything, because the empty board is how the first tile gets placed:
          the topic tile sits alone in the middle with four open slots
          around it, and clicking one starts a thread.
        */}
        <section id={BOARD_SECTION_ID} className="flex flex-col gap-2 scroll-mt-4">
          <h2 className="text-p-sm font-semibold uppercase tracking-wide opacity-60">
            The board
          </h2>
          <p className="text-p-sm text-gray">
            {threads.length === 0
              ? "Click one of the open slots around the topic to start your first thread."
              : "Every reason in play, hung off the one it answers. Hover a reason to see where a new one can go. Drag the background to move around."}
          </p>
          <SpatialBoard
            // A rewrite of the topic is a negotiation about the whole board,
            // so the board stops offering places to put a new reason while one
            // is open or waiting for an answer.
            placementEnabled={placementEnabled && !topicEditing && !topicPending}
            canPlaceOn={canPlaceUnder}
            onPlace={(parentId) => {
              setReplyTarget(parentId === TOPIC_CELL_ID ? "" : parentId);
              document
                .getElementById(COMPOSER_SECTION_ID)
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
            tiles={allTargets(board)}
            topic={
              <TopicCell
                gameId={gameId}
                board={board}
                me={me}
                size={14}
                editing={topicEditing}
                onEdit={() => setTopicEditing(true)}
                onEditEnd={() => setTopicEditing(false)}
              />
            }
            renderTile={(tile) => (
              <TileShape
                side={tile.side}
                size={14}
                watermark={tile.isOpeningReason ? "thread" : "reason"}
                // Everything else fades while the topic is being rewritten,
                // the same move the retired client makes for an emoji
                // resolution (GameBoard.vue:110-134, `resolvingThreadRoot`):
                // a negotiation on one tile should not look like it belongs
                // to the whole board.
                dimmed={tile.removed || topicEditing || topicPending}
              >
                <p className="font-tiles text-p-sm px-2 text-center">
                  <TileText tile={tile} />
                </p>
              </TileShape>
            )}
          />
        </section>

        {threads.length === 0 ? null : (
          <>
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
          </>
        )}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-p-sm font-semibold uppercase tracking-wide opacity-60">
          Proposals waiting on you
        </h2>
        {awaiting.length === 0 ? (
          <p className="text-p-sm opacity-50">None right now.</p>
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
        <h2 className="text-p-sm font-semibold uppercase tracking-wide opacity-60">
          Proposals you asked
        </h2>
        {asked.length === 0 ? (
          <p className="text-p-sm opacity-50">None right now.</p>
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

      {/*
        "Understanding each other" stood here: four labelled forms, one per
        non-argument move, in a scrolling column of prose. Removed 2026-09-01
        on Steve's call.

        The mechanics behind them are real and stay in the event log. They are
        rule cards, and they were built before there was a hand to put them in.
        `roadmap.md:54` rules that tile relocation, the Help Me Understand
        handback, all three Steel Man rungs and revise-topic are one
        propose-and-approve interaction, so the primitive got built once and
        every kind of it got a form. The forms were the wrong doorway: a card
        is played off the hand onto a tile, not chosen from a list of headings.

        Where each one lands when the hand exists: "say a reason back" is 💬
        Help Me Understand, "pin down a word" is rung 2 of that same card
        (`roadmap.md:174`, 📖 Define That is explicitly not its own card), and
        the two Steel Man moves are track F, which is deferred past the first
        release. The components are still in this file, unrendered, so the
        card work has something to move rather than something to rewrite.
      */}

      <section className="flex flex-col gap-2">
        <h2 className="text-p-sm font-semibold uppercase tracking-wide opacity-60">
          Leaving
        </h2>
        <LeaveButton gameId={gameId} />
      </section>
    </div>
  );
}
