"use client";

import Link from "next/link";

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
import { TileShape, SideAvatar, SideGlyph } from "@/components/board/tile-shape";
import { ResolutionPicker } from "@/components/board/resolution-picker";
import { TopicCell, pendingTopicRevision } from "@/components/board/topic-cell";
import { SpatialBoard } from "@/components/board/spatial-board";
import { TOPIC_CELL_ID } from "@/components/board/layout";
import { CollapsedThread } from "@/components/board/collapsed-thread";
import { WaysToWinCard, type MiniThread } from "@/components/board/ways-to-win-card";
import { OnboardingOverlay } from "@/components/onboarding/onboarding-overlay";
import { FeedbackPopover } from "@/components/feedback/feedback-popover";
import { FloatingPanel } from "@/components/ui/floating-panel";
import { AnchoredCard } from "@/components/ui/anchored-card";
import { RuleCardTray } from "@/components/board/rule-card-tray";
import {
  DECLINE_REASON_MAX_CHARS,
  DEFINITION_TERM_MAX_CHARS,
  MAX_THREADS,
  OTHER_SIDE,
  READING_MAX_CHARS,
  RESOLUTION_TOKENS,
  TILE_MAX_CHARS,
  type Verdict,
  canAnswerProposal,
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
  topicAgreementEndsGame,
} from "@/lib/board/rules";
import {
  INNER_FRAME_RATIO,
  OUTER_FRAME_REM,
  TILE_BODY_PX,
  TILE_LEAD_PX,
} from "@/components/board/geometry";
import { coachCard } from "@/lib/coach/cards";
import { CLAIM_SIZE_ROOT_SUGGESTIONS } from "@/lib/gym/root-suggestions";
import { useGameFeed } from "./use-game-feed";
import { usePeerNotices } from "./peer-notices";
import { CoachPanel } from "./coach-panel";
import { SIDE_LABEL, SIDE_MARK, tileLead } from "./side-label";
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
import type { Side, Uuid } from "@/lib/events/types";

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
  /** The build id line, rendered on the server and handed down. See the note
   *  at the call site in `app/game/[gameId]/page.tsx`. */
  buildStamp?: ReactNode;
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

/**
 * Quote a tile id for use inside an attribute selector.
 *
 * Ids are uuids today, so nothing here needs escaping, and that is exactly why
 * it is worth doing: the day an id carries a quote or a backslash, the selector
 * should stop matching nothing rather than start matching something else.
 */
function cssEscape(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

/**
 * The cards sitting on one reason, drawn on its bottom edge.
 *
 * Icon only, because at board scale there is no room for a name and the name
 * is one click away in the tile's own card. The tooltip carries it for a
 * mouse, and the screen-reader text carries it for everyone else.
 */
function TileThrowBadges({ board, tileId }: { board: BoardState; tileId: string }) {
  const here = board.throws.filter((thrown) => thrown.targetTileId === tileId);
  if (here.length === 0) return null;
  return (
    <div className="absolute bottom-0 left-1/2 z-20 flex -translate-x-1/2 translate-y-1/2 gap-1">
      {here.map((thrown) => {
        const card = coachCard(thrown.cardId);
        const standing = thrown.status === "standing";
        return (
          <span
            key={thrown.seq}
            title={card ? `${card.name}. ${card.plain}` : thrown.cardId}
            className={`border-neutral-black/30 bg-offwhite flex size-6 items-center justify-center rounded-full border text-xs shadow-sm ${
              standing ? "" : "opacity-50"
            }`}
          >
            <span aria-hidden="true">{card ? card.icon : "?"}</span>
            <span className="sr-only">
              {card ? card.name : thrown.cardId}
              {standing ? ", waiting for an answer" : ", settled"}
            </span>
          </span>
        );
      })}
    </div>
  );
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
  onBoard = false,
}: {
  tile: BoardTile;
  gameId: string;
  me: { playerId: string; role: Side };
  board: BoardState;
  /**
   * True when this node is opened beside the reason it acts on, out on the
   * board. The octagon and the replies are already drawn there, so drawing
   * them again inside the card would be saying the same thing twice; the card
   * carries only what you cannot do by looking.
   */
  onBoard?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  // The two cooperative moves that are about one particular reason. They open
  // one at a time, because both of them are you writing something in the other
  // player's voice and a card offering to do that twice at once is a card
  // nobody reads.
  const [proposing, setProposing] = useState<
    "reading" | "steelman" | "definition" | null
  >(null);
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
  // Saying a reason back only makes sense for a reason that is not yours to
  // begin with; the rules say so too, and this keeps the card from offering a
  // move it would then refuse.
  const readingVerdict =
    tile.side === me.role
      ? null
      : canProposeReadingHandback(board, tile.id, me.role, "a reading");
  const steelmanVerdict = canProposeSteelmanTile(board, tile.id, "a reason");
  const definitionVerdict = canProposeDefinition(board, "a word", "a meaning");
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
        {/* The octagon is redundant on the board, where the real one is a
            few pixels away. It comes back while editing, because then it is
            not a picture of the reason, it is the box you type in. */}
        <div className={`relative shrink-0 ${onBoard && !editing ? "hidden" : ""}`}>
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
              </span>
              {/* Two kinds of link sat in one undifferentiated row of grey
                  underlines: housekeeping on a reason you wrote, and moves
                  that put a question to the other player. "remove" reading
                  the same as "pin down a word" is the bad half of that: one
                  of them takes your own tile off the board and the other
                  opens a dialog. The label and the rule say which is which,
                  and the stray "(yours)" tag above is gone, because a row
                  headed "yours" has already said it. */}
              <span className="flex flex-wrap items-center gap-3">
                {mine && (
                  <>
                    <span className="text-p-sm text-gray">yours:</span>
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
                    <span aria-hidden="true" className="bg-gray/30 h-3.5 w-px" />
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
                {/* The two cooperative moves, on the reason they are about.
                    Steve's call: none of these is writing in a tile, it is
                    writing in a little dialog beside one. */}
                {readingVerdict && (
                  <button
                    type="button"
                    className="text-p-sm underline text-gray disabled:opacity-30"
                    disabled={pending || proposing !== null || !readingVerdict.ok}
                    title={!readingVerdict.ok ? readingVerdict.error : undefined}
                    onClick={() => setProposing("reading")}
                  >
                    say it back
                  </button>
                )}
                <button
                  type="button"
                  className="text-p-sm underline text-gray disabled:opacity-30"
                  disabled={pending || proposing !== null || !steelmanVerdict.ok}
                  title={!steelmanVerdict.ok ? steelmanVerdict.error : undefined}
                  onClick={() => setProposing("steelman")}
                >
                  write one for them
                </button>
                {/* The fourth non-argument move. A word, not a reason: you are
                    not answering this tile, you are asking what one of the
                    words in it is doing. It opens here because a word is
                    always a word in something, and this is the something. */}
                <button
                  type="button"
                  className="text-p-sm underline text-gray disabled:opacity-30"
                  disabled={pending || proposing !== null || !definitionVerdict.ok}
                  title={!definitionVerdict.ok ? definitionVerdict.error : undefined}
                  onClick={() => setProposing("definition")}
                >
                  pin down a word
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

      {/* Open proposals about this reason, on this reason. Both directions:
          the one you are waiting on and the one waiting on you. */}
      {board.proposals
        .filter(
          (proposal) =>
            proposal.status === "pending" && proposal.targetTileId === tile.id,
        )
        .map((proposal) => (
          <ProposalCard
            key={proposal.id}
            gameId={gameId}
            proposal={proposal}
            board={board}
            me={me}
          />
        ))}

      {proposing === "reading" && (
        <ReadingHandbackForm
          gameId={gameId}
          board={board}
          tile={tile}
          me={me}
          onDone={() => setProposing(null)}
        />
      )}

      {proposing === "steelman" && (
        <SteelmanTileForm
          gameId={gameId}
          board={board}
          tile={tile}
          onDone={() => setProposing(null)}
        />
      )}

      {proposing === "definition" && (
        <DefinitionForm
          gameId={gameId}
          board={board}
          tile={tile}
          onDone={() => setProposing(null)}
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

      {!onBoard && tile.children.length > 0 && (
        <ul className="ml-2 flex flex-col gap-2 border-l border-current/15 pl-4">
          {tile.children.map((child) => (
            <TileNode key={child.id} tile={child} gameId={gameId} me={me} board={board} />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * A proposal, said in plain English, with the two answers.
 *
 * Drawn beside the reason it is about wherever it has one, and in the rail
 * when it does not. Only the definition ask lands in the rail today, because
 * it is the one proposal the engine stores with a null target tile.
 *
 * Everything cooperative in this game is a proposal: you ask, they answer, and
 * nothing moves until they do. Until now they could be made and never seen,
 * because nothing outside the topic-revision path rendered an open one. A
 * proposal nobody can answer is a move that does not exist.
 *
 * Rejecting takes a typed reason rather than a second button. Steve's call, and
 * the right one: whenever you say no to something, you should get to say why,
 * and that sentence is the most interesting thing either of you writes.
 */
function ProposalCard({
  gameId,
  proposal,
  board,
  me,
}: {
  gameId: string;
  proposal: BoardProposal;
  board: BoardState;
  me: { playerId: string; role: Side };
}) {
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const mine = proposal.askedBy === me.role;
  const verdict = canAnswerProposal(board, proposal.id, me.role);

  const answer = (accept: boolean) => {
    setError(null);
    startTransition(async () => {
      const result: ActionResult = accept
        ? await acceptProposal(gameId, { proposalId: proposal.id })
        : await rejectProposal(gameId, {
            proposalId: proposal.id,
            reason: reason.trim().length > 0 ? reason : null,
          });
      if (!result.ok) setError(result.error);
      else setRejecting(false);
    });
  };

  return (
    <div className="border-gold/60 bg-sand/20 flex flex-col gap-2 rounded-lg border p-2">
      <p className="text-p-sm font-primary text-gray tracking-wide uppercase">
        {mine ? "You asked" : "They asked"}
      </p>
      <p className="text-p-sm">{proposalSentence(proposal, board)}</p>
      {mine ? (
        <p className="text-p-sm text-gray italic">Waiting for them to answer.</p>
      ) : rejecting ? (
        <>
          <textarea
            className="w-full border border-current/30 p-1 text-p-sm"
            value={reason}
            maxLength={300}
            disabled={pending}
            placeholder="Why not? They will see this."
            onChange={(event) => setReason(event.target.value)}
          />
          <span className="flex gap-2">
            <button
              type="button"
              className="form-base btn-primary px-3 py-1 text-xs disabled:opacity-40"
              disabled={pending}
              onClick={() => answer(false)}
            >
              Send it
            </button>
            <button
              type="button"
              className="form-base px-3 py-1 text-xs"
              disabled={pending}
              onClick={() => setRejecting(false)}
            >
              Back
            </button>
          </span>
        </>
      ) : (
        <>
          <WhyNot verdict={verdict.ok ? null : verdict} />
          <span className="flex gap-2">
            <button
              type="button"
              className="form-base btn-primary px-3 py-1 text-xs disabled:opacity-40"
              disabled={pending || !verdict.ok}
              onClick={() => answer(true)}
            >
              Yes
            </button>
            <button
              type="button"
              className="form-base px-3 py-1 text-xs disabled:opacity-40"
              disabled={pending || !verdict.ok}
              onClick={() => setRejecting(true)}
            >
              No, because...
            </button>
          </span>
        </>
      )}
      <ErrorLine error={error} />
    </div>
  );
}

/**
 * The asks that have no reason to sit beside.
 *
 * Every other proposal is drawn on its target tile, which is where an ask
 * belongs: you answer it looking at the thing it is about. A definition ask
 * has no target tile in the engine, so without this card it could be sent and
 * never seen, and a move nobody can answer is a move that does not exist.
 *
 * Renders nothing at all when there is nothing pending, so the rail does not
 * carry an empty box through the 95% of a game where this is quiet.
 */
function PendingAsks({
  gameId,
  board,
  me,
}: {
  gameId: string;
  board: BoardState;
  me: { playerId: string; role: Side };
}) {
  const asks = board.proposals.filter(
    (proposal) =>
      proposal.status === "pending" &&
      proposal.targetTileId === null &&
      // The topic rewrite is the other null-target proposal, and it already
      // has a home: the centre tile answers it in place. Listing it here too
      // would put the same two buttons in two places on one screen.
      proposal.kind !== "topic_revision",
  );
  if (asks.length === 0) return null;

  return (
    <section className="border-gray/30 bg-offwhite flex w-full flex-col gap-2 rounded-2xl border px-5 py-4 shadow-md">
      <h2 className="font-primary text-neutral-black text-p-lg">Open asks</h2>
      {asks.map((proposal) => (
        <ProposalCard
          key={proposal.id}
          gameId={gameId}
          proposal={proposal}
          board={board}
          me={me}
        />
      ))}
    </section>
  );
}

/**
 * What a proposal is asking, as a sentence.
 *
 * One primitive carries six mechanics, so the raw content is a union of four
 * shapes and reads as nothing at all. Every kind gets its own sentence here
 * rather than a label plus a JSON dump.
 */
function proposalSentence(proposal: BoardProposal, board: BoardState): string {
  const content = proposal.content;
  switch (proposal.kind) {
    case "reading_handback":
      return "text" in content
        ? `Have I got this right? "${content.text}"`
        : "Have I got this right?";
    case "steelman_tile":
      return "text" in content
        ? `A reason for your side, written by them: "${content.text}"`
        : "A reason for your side, written by them.";
    case "steelman_reading":
      return "text" in content
        ? `Is this your side? "${content.text}"`
        : "Is this your side?";
    case "definition":
      return "term" in content
        ? `Can we agree "${content.term}" means: ${content.text}`
        : "Can we agree what a word means.";
    case "topic_revision":
      return "text" in content
        ? `A rewritten topic: "${content.text}"`
        : "A rewritten topic.";
    case "tile_relocation":
      return "new_parent_tile_id" in content
        ? content.new_parent_tile_id === null
          ? "Move this reason out to start its own thread."
          : `Move this reason under: ${shortText(board, content.new_parent_tile_id)}`
        : "Move this reason.";
  }
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
    // Question, then the answer to give, then who has answered. The standing
    // line used to come first, so a card that had just asked "where do you two
    // disagree?" answered itself with "You: no token. Them: no token" before
    // offering anything to press.
    <div className="flex flex-col items-center gap-2 text-p-sm">
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
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Placed who="You" token={myToken} />
        <Placed who="Them" token={otherToken} />
      </div>
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
 * Writing the reason on the board, in the cell it will occupy.
 *
 * This is the retired client's signature gesture and the one Rannie draws in
 * `1064:214081`: you hover a tile, click one of its open diagonals, and the
 * new tile is already there with a cursor in it. Nothing about the move has
 * to be explained, because the shape of the thing you are making is the box
 * you are typing into.
 *
 * It answers one parent and nothing else, so it carries none of the target
 * picking the bottom composer needs. Enter places, Escape backs out, and
 * Shift+Enter is a newline, which is the convention every chat box in the
 * world has already taught.
 */
function InTileComposer({
  gameId,
  board,
  side,
  parentTileId,
  parentSide,
  onDone,
}: {
  gameId: string;
  board: BoardState;
  side: Side;
  /** The tile being answered, or null for a new thread off the topic. */
  parentTileId: string | null;
  /** The answered tile's side, for the lead line. Null when answering the topic. */
  parentSide: Side | null;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const verdict = canPlaceTile(board, text, parentTileId);

  const submit = () => {
    if (!verdict.ok) return;
    setError(null);
    startTransition(async () => {
      const result = await placeTile(gameId, { text, parentTileId });
      if (!result.ok) setError(result.error);
      else onDone();
    });
  };

  return (
    <div className="relative size-full">
      <TileShape side={side} size={OUTER_FRAME_REM} watermark="reason" selected>
        <p className="font-tiles w-full text-center">
          <span className="block leading-tight" style={{ fontSize: `${TILE_LEAD_PX}px` }}>
            {tileLead(side, parentTileId === null, parentSide)}
          </span>
          {/*
            No border and no background: the octagon is the box. A visible
            field inside it would draw a second, smaller tile inside the
            first one and undo the whole point of writing on the board.
          */}
          <textarea
            // The click that opened this cell was the request for a cursor
            // in it; the whole gesture is one motion.
            autoFocus
            className="mt-1 block w-full resize-none bg-transparent text-center leading-snug outline-none"
            style={{ fontSize: `${TILE_BODY_PX}px` }}
            rows={3}
            value={text}
            maxLength={TILE_MAX_CHARS}
            disabled={pending}
            placeholder="A reason for your side."
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onDone();
              }
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
          />
        </p>
      </TileShape>
      {/* Under the tile rather than in it: the octagon holds the reason, and
          only the reason. Given its own solid pill because the cells below a
          tile are where its diagonal neighbours sit, so this lands on top of
          another octagon as often as not. */}
      <div className="text-p-sm absolute top-full left-1/2 z-20 flex w-64 -translate-x-1/2 -translate-y-4 flex-col items-center gap-1 text-center">
        <div className="border-gray/30 bg-offwhite flex items-center gap-3 rounded-full border py-1 pr-4 pl-1 shadow-lg">
          <button
            type="button"
            className="bg-gold text-neutral-white font-primary cursor-pointer rounded-full px-4 py-1 tracking-wide uppercase shadow-md disabled:cursor-default disabled:opacity-40"
            disabled={pending || !verdict.ok}
            title={!verdict.ok ? verdict.error : undefined}
            onClick={submit}
          >
            {pending ? "Placing..." : "Place"}
          </button>
          <button
            type="button"
            className="text-gray hover:text-neutral-black cursor-pointer"
            disabled={pending}
            onClick={onDone}
          >
            cancel
          </button>
        </div>
        <ErrorLine error={error} />
      </div>
    </div>
  );
}

function Composer({
  gameId,
  board,
  side,
  target,
  onTargetChange,
}: {
  gameId: string;
  board: BoardState;
  /** The composing player's side, for the lead line above the box. */
  side: Side;
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
    <div className="flex flex-col gap-3">
      {/*
        This used to be a dropdown of every tile on the board, which asked a
        player to find the reason they were answering in a list of truncated
        strings. The board above is where that choice belongs now: hover a
        tile, click one of its open diagonals. All this has to do is say
        which one you picked and let you back out of it.
      */}
      <div className="text-p-sm text-gray flex flex-wrap items-baseline gap-2">
        {answering === null ? (
          <span>
            Starting a new thread. Click an open slot around a reason on the board to
            answer it instead.
          </span>
        ) : (
          <>
            <span>Answering</span>
            <span className="text-neutral-black">
              {SIDE_MARK[answering.side]}{" "}
              {answering.redacted ? REDACTED_TEXT : answering.text.slice(0, 60)}
            </span>
            <button
              type="button"
              className="border-gray/40 hover:bg-sand/40 cursor-pointer rounded-full border px-3 py-0.5 text-xs disabled:opacity-40"
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
      {/* The words the tile will open with, shown before it is placed rather
          than discovered after. `CellComposer`, the one you get by clicking an
          open diagonal, writes them straight into the octagon; this card is
          the same move made from the bottom of the screen, so it says the same
          thing. Which lead you get is the game telling you what this reason is
          for: answering the topic outright, adding to your own side, or
          stopping to think at somebody else's. */}
      <div className="border-gray/30 bg-neutral-white focus-within:border-neutral-black flex flex-col rounded-xl border p-3 transition-colors">
        <span className="font-tiles text-p-lg text-neutral-black leading-tight">
          {tileLead(side, parentTileId === null, answering?.side ?? null)}
        </span>
        <textarea
          className="font-tiles text-p-md text-neutral-black placeholder:text-gray mt-1 w-full resize-none bg-transparent leading-snug outline-none"
          rows={2}
          value={text}
          maxLength={TILE_MAX_CHARS}
          disabled={pending}
          placeholder="A reason for your side."
          onChange={(event) => setText(event.target.value)}
        />
      </div>
      <span className="text-xs text-gray">
        {TILE_MAX_CHARS - text.length} characters left
      </span>
      <WhyNot verdict={blocked} />
      <button
        type="button"
        className="bg-gold text-neutral-white font-primary cursor-pointer self-start rounded-full px-6 py-2 tracking-wide shadow-md disabled:cursor-default disabled:opacity-40"
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

/**
 * Saying one of their reasons back to them, in your own words, on that reason.
 *
 * It used to carry a dropdown of every reason the other side had placed, which
 * asked a player to find a tile they were already looking at in a list of
 * truncated strings. Opened from the tile itself, the question it is asking is
 * the tile it is attached to, and there is nothing left to pick.
 */
function ReadingHandbackForm({
  gameId,
  board,
  tile,
  me,
  onDone,
}: {
  gameId: string;
  board: BoardState;
  tile: BoardTile;
  me: { playerId: string; role: Side };
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const verdict = canProposeReadingHandback(board, tile.id, me.role, text);
  const blocked =
    text.trim().length > 0
      ? verdict
      : canProposeReadingHandback(board, tile.id, me.role, "a reading");

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await proposeReadingHandback(gameId, { tileId: tile.id, text });
      if (!result.ok) setError(result.error);
      else onDone();
    });
  };

  return (
    <div className="flex flex-col gap-2 border-t border-current/15 pt-2">
      <p className="text-p-sm text-gray">In your own words, what are they saying?</p>
      <textarea
        className="w-full border border-current/30 p-1 text-p-sm"
        value={text}
        maxLength={READING_MAX_CHARS}
        disabled={pending}
        placeholder="You think that..."
        onChange={(event) => setText(event.target.value)}
      />
      <WhyNot verdict={blocked} />
      <span className="flex gap-2">
        <button
          type="button"
          className="form-base btn-primary px-3 py-1 text-xs disabled:opacity-40"
          disabled={pending || !verdict.ok}
          title={!verdict.ok ? verdict.error : undefined}
          onClick={submit}
        >
          Ask if you have it right
        </button>
        <button
          type="button"
          className="form-base px-3 py-1 text-xs"
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
 * A reason written for the other side, hung under the reason you are looking
 * at, which lands on their half of the board if they take it.
 *
 * Which side it goes on is never sent from here. The server derives it, so this
 * form has no field for it and no way to be wrong about it. The destination is
 * not sent either any more: it is the tile this opened from.
 */
function SteelmanTileForm({
  gameId,
  board,
  tile,
  onDone,
}: {
  gameId: string;
  board: BoardState;
  tile: BoardTile;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const verdict = canProposeSteelmanTile(board, tile.id, text);
  const blocked =
    text.trim().length > 0 ? verdict : canProposeSteelmanTile(board, tile.id, "a reason");

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await proposeSteelmanTile(gameId, { text, parentTileId: tile.id });
      if (!result.ok) setError(result.error);
      else onDone();
    });
  };

  return (
    <div className="flex flex-col gap-2 border-t border-current/15 pt-2">
      <p className="text-p-sm text-gray">
        A reason for their side that you think they missed, hung under this one.
      </p>
      <textarea
        className="w-full border border-current/30 p-1 text-p-sm"
        value={text}
        maxLength={TILE_MAX_CHARS}
        disabled={pending}
        placeholder="Something their side could say here."
        onChange={(event) => setText(event.target.value)}
      />
      <WhyNot verdict={blocked} />
      <span className="flex gap-2">
        <button
          type="button"
          className="form-base btn-primary px-3 py-1 text-xs disabled:opacity-40"
          disabled={pending || !verdict.ok}
          title={!verdict.ok ? verdict.error : undefined}
          onClick={submit}
        >
          Offer it to them
        </button>
        <button
          type="button"
          className="form-base px-3 py-1 text-xs"
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

/**
 * A word one of you keeps using and the other keeps hearing differently.
 *
 * Opened from the reason the word appears in, which is the only place a word
 * is ever confusing: nobody asks what "fair" means in the abstract, they ask
 * what it meant in the sentence they just read. The tile's own words are shown
 * above the box for exactly that reason, so the word can be copied out of it.
 *
 * The proposal itself is NOT anchored to that tile, and this is the one place
 * the move does not fully match Steve's "a little dialog beside a tile" rule.
 * `proposeDefinition` writes `target_tile_id: null`, so the pending ask has no
 * tile to be drawn on and is answered from the rail instead (`PendingAsks`).
 * Widening that is a server-action change, outside this lane. Filed rather
 * than worked around: the ask is about the word for the rest of the game, so
 * a null target is arguably right and only the answering surface is wrong.
 */
function DefinitionForm({
  gameId,
  board,
  tile,
  onDone,
}: {
  gameId: string;
  board: BoardState;
  tile: BoardTile;
  onDone: () => void;
}) {
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
      else onDone();
    });
  };

  return (
    <div className="flex flex-col gap-2 border-t border-current/15 pt-2">
      <p className="text-p-sm text-gray">
        A word in this reason that the two of you may be hearing differently.
      </p>
      <p className="text-p-sm font-tiles text-gray">&ldquo;{tile.text}&rdquo;</p>
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
      <span className="flex gap-2">
        <button
          type="button"
          className="form-base btn-primary px-3 py-1 text-xs disabled:opacity-40"
          disabled={pending || !verdict.ok}
          title={!verdict.ok ? verdict.error : undefined}
          onClick={submit}
        >
          Ask them to agree
        </button>
        <button
          type="button"
          className="form-base px-3 py-1 text-xs"
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
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        className="border-gray/30 bg-offwhite text-p-sm text-neutral-black hover:bg-sand cursor-pointer rounded-full border px-4 py-2 font-semibold shadow-md disabled:opacity-40"
        disabled={pending}
        onClick={leave}
        title="Leave this game and go back to the home screen"
      >
        {sure ? "Yes, end it for both of us" : "\u2190 Leave game"}
      </button>
      {sure ? (
        <p className="text-p-sm bg-offwhite border-gray/30 max-w-[16rem] rounded-xl border px-3 py-2 opacity-80 shadow-md">
          A live board needs both sides, so this ends the game for the other player too.
          The map stays in both histories, marked unfinished.
        </p>
      ) : null}
      <ErrorLine error={error} />
    </div>
  );
}

/**
 * A thread's resolution, drawn on the reason the thread started from.
 *
 * The whole first win condition is "name where you two actually disagree", and
 * until this existed nothing on the board said whether that had happened. The
 * drawer knew; the board, which is what a player is looking at, did not.
 */
/**
 * An unanswered proposal about this reason, on the left edge of it.
 *
 * A proposal is a question somebody is standing there waiting on an answer to,
 * and the answer lives inside the tile's card. Without a mark on the tile there
 * is nothing on the board that would ever make a player open it.
 */
function TileProposalBadge({
  board,
  tileId,
  me,
}: {
  board: BoardState;
  tileId: string;
  me: { playerId: string; role: Side };
}) {
  const open = board.proposals.filter(
    (proposal) => proposal.status === "pending" && proposal.targetTileId === tileId,
  );
  if (open.length === 0) return null;
  const yours = open.some((proposal) => proposal.askedBy !== me.role);
  return (
    <span
      className={`font-primary text-p-md absolute top-1/2 left-0 z-20 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm ${
        yours
          ? "border-gold bg-sand text-neutral-black"
          : "border-gray/30 bg-offwhite text-gray"
      }`}
      title={
        yours
          ? "They asked you something about this reason. Click it."
          : "You asked them something about this reason."
      }
    >
      ?
    </span>
  );
}

function ThreadTokenBadge({
  thread,
  me,
}: {
  thread: BoardThread | null;
  me: { playerId: string; role: Side };
}) {
  if (!thread) return null;
  const settled = thread.resolution?.emoji ?? null;
  const mine = thread.pending[me.role];
  const theirs = thread.pending[OTHER_SIDE[me.role]];
  const token = settled ?? mine ?? theirs ?? null;
  if (!token) return null;
  // Straddling the tile's right-hand flat edge, not the top of its bounding
  // box. The box is the outer ring and the drawn octagon sits a frame inside
  // it, so a badge pinned to `top-0` floated a clear dozen pixels off the
  // tile and read as a stray marker rather than as this thread's token. The
  // right edge is the one flat side with nothing on it: the watermark word
  // is along the top and the three side glyphs are along the bottom.
  const edgeInset = `${((1 - INNER_FRAME_RATIO) / 2) * 100}%`;
  return (
    <span
      style={{ right: edgeInset }}
      className={`border-gray/30 bg-offwhite absolute top-1/2 z-20 flex -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border p-1 shadow-sm ${settled ? "" : "opacity-60"}`}
      title={
        settled
          ? `Thread resolved: ${tokenLabel(settled)}`
          : `${mine ? "You" : "They"} suggested: ${tokenLabel(token)}`
      }
    >
      <TokenGlyph token={token} size={22} />
    </span>
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

export function LiveBoard({
  gameId,
  board,
  me,
  coachEnabled,
  buildStamp = null,
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

  // The two lines the Ways to win card cannot draw. Both come from the same
  // functions the rules enforce, so the card cannot describe a different game
  // than the one being played.
  const endsOnTopic = topicAgreementEndsGame(board);
  // Quiet until the ceiling is close enough to matter. A board with two
  // threads on it does not need to hear about the sixth.
  const ceilingNote =
    threads.length >= MAX_THREADS
      ? `There are ${MAX_THREADS} threads here, which is the most a board holds. A new reason has to hang off one that is already here.`
      : threads.length === MAX_THREADS - 1
        ? "One more new thread and the board is full."
        : null;
  // A thread is named by the reason it started from, so the tile the player
  // clicked is enough to find the thread it heads, if it heads one.
  // The other seat. `role` is nullable on a BoardPlayer because a player
  // exists from the moment they join and picks a side afterwards, so the
  // opposite of mine is the safe fallback: there are only two sides, and by
  // the time a board is live the other one is taken.
  const opponent = board.players.find((player) => player.id !== me.playerId) ?? null;
  const opponentSide: Side = opponent?.role ?? (me.role === "plus" ? "minus" : "plus");

  const threadByRoot = useMemo(
    () => new Map(threads.map((thread) => [thread.rootId, thread])),
    [threads],
  );
  // Matches the retired client's isTutorialOpen: true on every arrival at the
  // board, no "seen it already" memory anywhere. See
  // components/onboarding/onboarding-overlay.tsx for why that is deliberate.
  const [onboardingOpen, setOnboardingOpen] = useState(true);
  // The topic editor opens from two places (the tile itself and the Ways to
  // win pencil), so the board owns whether it is open, not the tile.
  const [topicEditing, setTopicEditing] = useState(false);
  const topicPending = pendingTopicRevision(board) !== null;
  // The composer is a floating card now, not a section of a page, so it has
  // an open state. Clicking an open slot on the board opens it, because the
  // click has to lead somewhere or it looks like it did nothing.
  const [composerOpen, setComposerOpen] = useState(false);
  // What a reason can do belongs on the reason. Clicking one opens its actions
  // beside it rather than sending the player to a list somewhere else on the
  // screen to find the same tile a second time.
  // Where a reason is being written on the board, if anywhere: the parent it
  // answers and the cell it will occupy. The board reports both from the
  // clicked slot, because it is the board that knows where its open cells
  // are; this only remembers which one was picked.
  const [draft, setDraft] = useState<{
    parentId: string;
    pos: { x: number; y: number };
  } | null>(null);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  // Throwing a card is arm-then-target: pick the card in the tray, then click
  // the reason it answers. While a card is armed a click on a tile plays it
  // instead of opening that tile's actions, so the two never fire at once.
  const [armedCardId, setArmedCardId] = useState<string | null>(null);
  const [throwError, setThrowError] = useState<string | null>(null);
  const [throwPending, startThrow] = useTransition();
  const deck = cardsInPlay(board);
  const cardCounts = useMemo(() => {
    const tally: Record<string, number> = {};
    for (const thrown of board.throws) {
      if (thrown.thrownBy !== me.playerId) continue;
      tally[thrown.cardId] = (tally[thrown.cardId] ?? 0) + 1;
    }
    return tally;
  }, [board.throws, me.playerId]);
  // A reason's lead line depends on whose reason it hangs under, so the board
  // needs one lookup from tile id to side.
  const sideOf = useMemo(
    () => new Map(allTargets(board).map((tile) => [tile.id, tile.side])),
    [board],
  );
  /*
    Connection as a dot rather than a sentence. "In progress, updating live"
    is true of almost every second of every game, so it was a line of text
    that never said anything; what a player needs to see is the moment it
    stops being true.
  */
  const statusDot = (
    <span
      className="flex items-center gap-2"
      title={`${STATUS_LABEL[board.status]}. ${connected ? "Updating live." : "Reconnecting."}`}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${connected ? "bg-green" : "bg-orange"}`}
      />
      <span className="sr-only">
        {STATUS_LABEL[board.status]}, {connected ? "updating live" : "reconnecting"}
      </span>
    </span>
  );
  const selectedTile = useMemo(
    () => allTargets(board).find((tile) => tile.id === selectedTileId) ?? null,
    [board, selectedTileId],
  );

  return (
    /*
      The board is the screen.

      Ported from the retired client's `pages/game/[gameCode].vue`, which is
      also what Rannie's `1064:214081` draws: a pan-and-zoom board filling the
      viewport, with four floating clusters over its corners and nothing else
      competing with it. What used to be here was a 3600px scrolling column of
      headings, of which the board was one section among ten.

      Everything that column held is still reachable and still wired; it moved
      into the clusters. The pieces that ought to answer on the tile itself
      (per-tile actions, thread resolution) are in the right-hand drawer until
      they get their tile popovers, which is BRAIN-T260901-09, not this pass.
    */
    <div className="bg-offwhite fixed inset-0 overflow-hidden">
      <SpatialBoard
        // A rewrite of the topic is a negotiation about the whole board,
        // so the board stops offering places to put a new reason while one
        // is open or waiting for an answer.
        placementEnabled={placementEnabled && !topicEditing && !topicPending}
        canPlaceOn={canPlaceUnder}
        placeSide={me.role}
        // The rail is `right-8 w-[15rem]`, so 15 plus its 2rem gutter. Keep
        // this in step with the rail wrapper's classes below.
        reserveRight={17}
        draftAt={draft?.pos ?? null}
        draft={
          draft && (
            <InTileComposer
              gameId={gameId}
              board={board}
              side={me.role}
              parentTileId={draft.parentId === TOPIC_CELL_ID ? null : draft.parentId}
              parentSide={
                draft.parentId === TOPIC_CELL_ID
                  ? null
                  : (sideOf.get(draft.parentId) ?? null)
              }
              onDone={() => setDraft(null)}
            />
          )
        }
        onPlace={(parentId, pos) => {
          // The board is where the reason gets written now, so the card
          // parked under the board closes rather than competing with it.
          setDraft({ parentId, pos });
          setComposerOpen(false);
          setSelectedTileId(null);
          setArmedCardId(null);
        }}
        onSelect={(tileId) => {
          if (armedCardId) {
            const verdict = canThrowCard(
              board,
              tileId,
              armedCardId,
              me.role,
              me.playerId,
            );
            if (!verdict.ok) {
              setThrowError(verdict.error);
              return;
            }
            setThrowError(null);
            const cardId = armedCardId;
            startThrow(async () => {
              const result: ActionResult = await throwCard(gameId, {
                tileId,
                cardId,
              });
              if (!result.ok) setThrowError(result.error);
              else setArmedCardId(null);
            });
            return;
          }
          setSelectedTileId((current) => (current === tileId ? null : tileId));
        }}
        tiles={allTargets(board)}
        topic={
          <TopicCell
            gameId={gameId}
            board={board}
            me={me}
            size={OUTER_FRAME_REM}
            editing={topicEditing}
            onEdit={() => setTopicEditing(true)}
            onEditEnd={() => setTopicEditing(false)}
          />
        }
        renderTile={(tile) => (
          <div className="relative size-full">
            <TileShape
              side={tile.side}
              size={OUTER_FRAME_REM}
              // Every tile on the board says "reason", opening tiles
              // included: that is what Rannie stamps on all four of them in
              // `1064:214081`. A thread is a shape on the board, not a
              // different kind of tile, and calling the first one something
              // else was a word the player had to learn for no gain.
              watermark="reason"
              // Everything else fades while the topic is being rewritten,
              // the same move the retired client makes for an emoji
              // resolution (GameBoard.vue:110-134, `resolvingThreadRoot`):
              // a negotiation on one tile should not look like it belongs
              // to the whole board.
              dimmed={tile.removed || topicEditing || topicPending}
              selected={tile.id === selectedTileId}
            >
              <p className="font-tiles text-center">
                {/* The lead line, ported from the retired Tile.vue's
                    `tilePrefix` and drawn the way Rannie draws it: a larger
                    line above the reason, so a tile reads as a sentence
                    rather than as a text box. Both lines are sized against
                    the octagon rather than against the page, because Rannie's
                    tiles carry text at roughly 8% of the tile's width and the
                    shared page body size left a 17rem octagon looking empty. */}
                <span
                  className="block leading-tight"
                  style={{ fontSize: `${TILE_LEAD_PX}px` }}
                >
                  {tileLead(
                    tile.side,
                    // A reason with no parent hangs off the topic, which is
                    // what an opening reason is. The flag is the engine's
                    // word for the same thing and is trusted first, but it
                    // defaults to false on older rows, and a tile answering
                    // the topic must never come out as a rebuttal.
                    tile.isOpeningReason || tile.parentId === null,
                    tile.parentId ? (sideOf.get(tile.parentId) ?? null) : null,
                  )}
                </span>
                <span
                  className="block leading-snug"
                  style={{ fontSize: `${TILE_BODY_PX}px` }}
                >
                  <TileText tile={tile} />
                </span>
              </p>
            </TileShape>
            {/* A card thrown at a reason leaves a mark on the reason, on its
              bottom edge, which is where Rannie draws it and where the
              retired client put it too. Without this the throw is invisible
              until you open the tile, and a card nobody sees is a card that
              did not land. Standing throws are full strength because they are
              waiting on somebody; settled ones fade back to a record. */}
            <TileThrowBadges board={board} tileId={tile.id} />
            {/* A settled thread says so on the reason it started from, on the
              top edge, opposite the thrown cards. Half strength while only
              one side has laid a token down, because a thread with one token
              on it is a question, not an answer. */}
            <ThreadTokenBadge thread={threadByRoot.get(tile.id) ?? null} me={me} />
            <TileProposalBadge board={board} tileId={tile.id} me={me} />
          </div>
        )}
      />

      {/* Top left: the way out, and which game this is. Ported from the
          retired client, where the browser Back button is trapped and this
          button is the only exit. */}
      <div className="fixed top-14 left-8 z-30 flex items-center gap-4">
        <LeaveButton gameId={gameId} />
        {/* Which side you are, in the corner Rannie puts it in. Your colour is
            on every tile you have placed, but only once you have placed one,
            and the first move of the game is the one where knowing matters. */}
        <SideAvatar side={me.role} className="h-9 w-9" />
        {/* Rannie writes the room code up here as plain small print, not as a
            chip: `#Room: 83083` in `1096:252192`. It used to sit in the
            bottom-left stack with the bug reporter, which is where you look
            for site furniture rather than for the thing you read aloud to the
            person you are about to argue with. */}
        {joinCode ? (
          <span className="font-primary text-p-md text-gray tracking-wide">
            #Room: <span className="text-neutral-black">{joinCode}</span>
          </span>
        ) : null}
        {board.mode === "gym" && board.levelId ? (
          <span className="bg-orange text-neutral-black text-p-sm font-primary rounded-full px-4 py-2 tracking-wide uppercase shadow-md">
            {board.levelId.replace(/_/g, " ")}
          </span>
        ) : null}
      </div>

      {/* A soft fade under the right rail.
          The cards float over a canvas that pans, so a tile can end up behind
          them, and the 12 px gaps between the cards then show a two-word
          sliver of somebody's reason. On screen that reads as a rendering
          fault rather than as a tile passing behind: "Whoever decides this"
          hanging in a gap belongs to no card. The fade puts the canvas back
          to the ground colour Rannie draws the rail on, without making the
          rail an opaque panel, which it is not. Nothing to click, so nothing
          is caught: the board still pans and the tiles under here still
          answer the mouse exactly as before. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-y-0 right-0 z-20 w-[26rem]"
        style={{
          background:
            "linear-gradient(to left, var(--color-board-ground) 66%, color-mix(in srgb, var(--color-board-ground) 55%, transparent) 85%, transparent)",
        }}
      />

      {/* Top right: who you are, help, and the two ways this ends. Same stack
          and the same 13rem column width as the retired client. */}
      <div className="fixed top-8 right-8 z-30 flex max-h-[calc(100vh-4rem)] w-[15rem] flex-col gap-3 overflow-y-auto pb-2">
        {/* The person on the other side of the argument, named and coloured,
            which is what Rannie hangs in this corner. It used to say who
            *you* are, and you already know: your own side is written on
            every tile you have placed and on the card in the bottom centre
            that only offers your colour. Theirs is the thing worth a
            permanent corner. */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-end gap-2">
            <SideAvatar side={opponentSide} className="h-12 w-12" />
            <h3
              className="font-primary text-p-md tracking-wide uppercase"
              style={{
                color:
                  opponentSide === "plus" ? "var(--color-green)" : "var(--color-orange)",
                textShadow:
                  "-3px -3px 0 var(--color-offwhite), 3px -3px 0 var(--color-offwhite), -3px 3px 0 var(--color-offwhite), 3px 3px 0 var(--color-offwhite)",
              }}
            >
              {opponent?.displayName ?? SIDE_LABEL[opponentSide]}
            </h3>
          </div>
          <button
            type="button"
            title="Instructions"
            aria-label="Instructions"
            onClick={() => setOnboardingOpen(true)}
            className="btn-icon border-gray/30 bg-offwhite text-p-md text-neutral-black h-10 w-10 shrink-0 cursor-pointer rounded-full border font-bold shadow-md"
          >
            ?
          </button>
        </div>

        {/* One card, not two. "Ways to win" and a "How this ends" panel under
            it said the same two things in the same rail, one as a diagram and
            one as a paragraph, and Rannie draws a single card. The three lines
            the paragraph had that the diagram did not are now lines on the
            diagram's card. */}
        <WaysToWinCard
          threads={miniThreads}
          resolvedCount={resolvedCount}
          onRevise={() => setTopicEditing(true)}
          reviseHint={endsOnTopic ? "Write the version you would both sign." : null}
          ceilingNote={ceilingNote}
          footer={
            endsOnTopic
              ? "Either ending is a win, and it is the same win for both of you."
              : null
          }
        />

        {/* The coach is a card in this rail in Rannie's frame, under Ways to
            win. It spent a while as a wide bar across the top centre, where
            it was the first thing on the screen and sat directly over the
            tiles the moment anyone opened it, and then a while folded inside
            a FloatingPanel, which hid its switch behind a click. It draws its
            own card now, so there is no wrapper here. */}
        <CoachPanel gameId={gameId} board={board} me={me} enabled={coachEnabled} />

        <PendingAsks gameId={gameId} board={board} me={me} />

        {/*
          The threads drawer. Every thread's tiles and every per-tile action
          used to be a page-long list below the board; the actions belong on
          the tile and will move there with the tile popovers. Until then they
          live here, folded away, rather than being dropped on the floor.
        */}
        <FloatingPanel
          title={
            threads.length === 0
              ? "Threads"
              : `Threads (${resolvedCount}/${threads.length})`
          }
          defaultOpen={false}
        >
          <div className="flex flex-col gap-4">
            {threads.length === 0 ? (
              <p className="text-p-sm text-gray">
                Nothing on the board yet. Click one of the open slots around the topic to
                start the first thread.
              </p>
            ) : (
              threads.map((thread, index) => (
                <ThreadBlock
                  key={thread.rootId}
                  gameId={gameId}
                  thread={thread}
                  index={index}
                  me={me}
                  board={board}
                />
              ))
            )}

            <section className="border-neutral-black/15 flex flex-col gap-2 border-t pt-3">
              <h3 className="text-p-sm font-semibold tracking-wide uppercase opacity-60">
                Generosity
              </h3>
              <p className="text-p-sm text-gray">
                Thanks, on the record. It always goes to them, and it counts toward
                nothing: this game is won together or not at all.
              </p>
              <p className="text-p-sm">
                {SIDE_LABEL.plus} {board.generosity.plus} · {SIDE_LABEL.minus}{" "}
                {board.generosity.minus}
              </p>
              <GenerosityButton gameId={gameId} />
            </section>

            {definitions.length > 0 && (
              <section className="border-neutral-black/15 flex flex-col gap-2 border-t pt-3">
                <h3 className="text-p-sm font-semibold tracking-wide uppercase opacity-60">
                  Words you have pinned down
                </h3>
                <dl className="text-p-sm flex flex-col gap-2">
                  {definitions.map((entry) => (
                    <div key={entry.proposalId} className="flex flex-col">
                      <dt className="font-semibold">{entry.term}</dt>
                      <dd className="opacity-80">{entry.text}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            <section className="border-neutral-black/15 flex flex-col gap-2 border-t pt-3">
              <h3 className="text-p-sm font-semibold tracking-wide uppercase opacity-60">
                Who is here
              </h3>
              <ul className="text-p-sm flex flex-col gap-1">
                {board.players.map((player) => (
                  <li key={player.id}>
                    {player.displayName ?? "Someone"}
                    {player.id === me.playerId ? " (you)" : ""}
                    {": "}
                    {player.role ? SIDE_LABEL[player.role] : "no side yet"}
                    {player.left ? `, left: ${player.left}` : ""}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </FloatingPanel>
      </div>

      {/* Bottom left: the small print, stacked the way Rannie stacks it. A
          row here ran into the composer in the middle of the screen the
          moment the window got narrow, and this corner is the one part of
          the board with vertical room to spare. */}
      <div className="fixed bottom-8 left-8 z-30 flex flex-col items-start gap-2">
        <FeedbackPopover variant="inline" />
        {buildStamp}
        {/*
          The quiet way off a live board, which is not the same door as Leave
          game in the top left: walking away leaves the argument exactly where
          it is, and the board is a projection of the log, so it is all still
          here when you come back to it. This replaces `LeaveLinks`, which the
          page still renders around the setup room but which would sit under a
          full-screen board and be unreachable.
        */}
        <span className="flex items-center gap-3 pl-1">
          <Link
            href="/account"
            className="text-p-sm text-gray decoration-gold underline underline-offset-2"
          >
            Your games
          </Link>
          {statusDot}
        </span>
      </div>

      {/* Bottom centre, one column: what you write, and what you hold.

          Clicking an open diagonal now writes the reason on the board, in the
          cell it will occupy, which is the retired client's whole gesture. So
          this card is no longer the main way in: it is the way to start a
          thread without hunting for a slot, and the only place that still
          offers a target picker. The hand sits below it, where Rannie draws
          it. */}
      <div className="fixed bottom-8 left-1/2 z-40 flex -translate-x-1/2 flex-col items-center gap-3">
        {composerOpen ? (
          <div className="w-[34rem]">
            <div className="border-gray/30 bg-offwhite rounded-2xl border p-4 shadow-lg">
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="font-primary text-p-md tracking-wide uppercase">
                  Place a reason
                </h3>
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  className="text-p-sm text-gray hover:text-neutral-black cursor-pointer"
                >
                  close
                </button>
              </div>
              <Composer
                gameId={gameId}
                board={board}
                side={me.role}
                target={replyTarget}
                onTargetChange={setReplyTarget}
              />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            disabled={!placementEnabled}
            // Offwhite, like every other piece of furniture on this board.
            // It was a heavy black pill floating over whichever tile happened
            // to be under it, and it is not the main way in any more: since
            // clicking an open diagonal writes the reason in the cell it will
            // occupy, this is the shortcut, not the door.
            className="border-gray/40 bg-offwhite text-neutral-black text-p-md font-primary hover:bg-sand/40 cursor-pointer rounded-full border px-6 py-3 tracking-wide uppercase shadow-md disabled:cursor-default disabled:opacity-40"
          >
            Place a reason
          </button>
        )}
        <RuleCardTray
          deck={deck}
          counts={cardCounts}
          armedCardId={armedCardId}
          onArm={(cardId) => {
            setArmedCardId(cardId);
            setThrowError(null);
            // A card and a tile's action card both want the click on a tile,
            // so arming one closes the other, and closes an open draft with it.
            if (cardId) {
              setSelectedTileId(null);
              setDraft(null);
            }
          }}
          hint={
            throwError ??
            (throwPending
              ? "Playing that card..."
              : armedCardId
                ? "Now click the reason you want to play it on."
                : null)
          }
        />
      </div>

      {/* Click a reason, act on that reason, right where it sits. The card
          follows its tile through pan and zoom, so the two never drift apart.
          What it holds is TileNode unchanged, the same edit / remove / ask to
          move / card-throw surface the thread list uses, so there is one
          implementation of a move and not two that can disagree. */}
      {selectedTile && (
        <AnchoredCard
          anchorSelector={`[data-tile-id="${cssEscape(selectedTile.id)}"]`}
          onClose={() => setSelectedTileId(null)}
          // The right rail is 15rem wide sitting 2rem in from the edge, and
          // the canvas runs underneath it, so a tile near the middle of the
          // board has "room to the right" that is actually Ways to win. One
          // rem of air on top of the rail's own footprint, so the card flips
          // to the tile's left instead of landing on the panel.
          reserveRight={18}
        >
          <ul className="flex flex-col gap-2">
            <TileNode tile={selectedTile} gameId={gameId} me={me} board={board} onBoard />
          </ul>
          {/* Resolving belongs to the reason a thread started from, so it is
              offered on that tile and nowhere else. It used to live only in
              the folded thread drawer, which meant the game's first win
              condition was two clicks and a scroll away from the board it is
              played on. */}
          {threadByRoot.has(selectedTile.id) && (
            <div className="border-neutral-black/15 mt-3 flex flex-col gap-2 border-t pt-3">
              {/* The card's question, so it is set like one. It used to be a
                  small grey all-caps rule sitting above a bolder, larger line
                  of instruction, which put the emphasis on how to work the
                  control rather than on what it is asking. */}
              <h4 className="font-primary text-p-md text-neutral-black">
                Where do you two disagree?
              </h4>
              <ResolutionRow
                gameId={gameId}
                thread={threadByRoot.get(selectedTile.id)!}
                me={me}
                board={board}
              />
            </div>
          )}
        </AnchoredCard>
      )}

      <OnboardingOverlay
        open={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        myRole={me.role}
      />
    </div>
  );
}
