"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
import {
  SameSideNotice,
  markSameSideNoticeSeen,
  sameSideNoticeSeen,
} from "@/components/board/same-side-notice";
import { WaysToWinCard, type MiniThread } from "@/components/board/ways-to-win-card";
import {
  OnboardingOverlay,
  useOnboarding,
} from "@/components/onboarding/onboarding-overlay";
import { FeedbackPopover } from "@/components/feedback/feedback-popover";
import { AnchoredCard } from "@/components/ui/anchored-card";
import { RuleCardTray } from "@/components/board/rule-card-tray";
import { canStartLaterMove } from "@/components/board/later-moves";
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
  rootTarget,
  topicAgreementEndsGame,
} from "@/lib/board/rules";
import {
  INNER_FRAME_RATIO,
  OUTER_FRAME_REM,
  TILE_BODY_PX,
  TILE_LEAD_PX,
} from "@/components/board/geometry";
import { coachCard } from "@/lib/coach/cards";
import { useGameFeed } from "./use-game-feed";
import { usePeerNotices } from "./peer-notices";
import { CoachPanel } from "./coach-panel";
import { SIDE_LABEL, stripDuplicateLead, tileLead } from "./side-label";
import { TilePicker } from "./tile-picker";
import type { ActionResult } from "@/app/game/[gameId]/actions";
import {
  acceptProposal,
  clearResolutionToken,
  declineThrow,
  editTile,
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
import type { Side, TileCorner, Uuid } from "@/lib/events/types";
import { OnboardingLauncher } from "@/components/onboarding/onboarding-launcher";
import { usePointedSlot } from "@/components/gym/pointed-slot";
import { useSampleAnswers } from "@/components/gym/sample-answers";

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
  /** The Gym boss's emoji, shown on the opponent badge. Only an emoji
   *  crosses this boundary, never the Level object: its beats can carry
   *  functions, which cannot be handed from the server to a client
   *  component. Undefined outside the Gym. */
  opponentEmoji?: string;
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
 *
 * A standing card is somebody's move, and whose it is has to be visible from
 * the board. Playing it without that: a card lands on your reason, the badge
 * appears in the same grey it wears for a card you threw yourself, and the
 * only words anywhere are "waiting for an answer", which does not say waiting
 * on whom. The answer surface exists and is good, inside the tile's own card,
 * but nothing gives you a reason to open the tile, so the game sits there
 * looking finished while it is actually your turn. `TileProposalBadge` two
 * hundred lines down already solved this for asks; this is the same rule in
 * the same colours.
 */
function TileThrowBadges({
  board,
  tileId,
  me,
}: {
  board: BoardState;
  tileId: string;
  me: { playerId: string; role: Side };
}) {
  const here = board.throws.filter((thrown) => thrown.targetTileId === tileId);
  if (here.length === 0) return null;
  return (
    <div
      style={{ bottom: EDGE_INSET }}
      className="absolute left-1/2 z-20 flex -translate-x-1/2 gap-1"
    >
      {here.map((thrown) => {
        const card = coachCard(thrown.cardId);
        const standing = thrown.status === "standing";
        // A card the other side played is yours to answer. A card the coach
        // played is too, which is why this asks who it was not rather than
        // who it was.
        const yours = standing && thrown.thrownByRole !== me.role;
        const name = card ? card.name : thrown.cardId;
        return (
          <span
            key={thrown.seq}
            title={
              standing
                ? yours
                  ? `${name}. ${card ? card.plain : ""} Played on your reason. Click the reason to answer it.`
                  : `${name}. You played this. Waiting for their rewrite.`
                : `${name}. ${card ? card.plain : ""}`
            }
            className={`flex size-6 items-center justify-center rounded-full border text-xs shadow-sm ${
              yours
                ? "border-gold bg-sand"
                : standing
                  ? "border-neutral-black/30 bg-offwhite"
                  : "border-neutral-black/30 bg-offwhite opacity-50"
            }`}
          >
            <span aria-hidden="true">{card ? card.icon : "?"}</span>
            <span className="sr-only">
              {name}
              {standing
                ? yours
                  ? ", waiting for your answer"
                  : ", waiting for their answer"
                : ", settled"}
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
function WhyNot({
  verdict,
  className = "text-xs text-gray",
}: {
  verdict: Verdict | null;
  className?: string;
}) {
  if (!verdict || verdict.ok) return null;
  return <p className={className}>{verdict.error}</p>;
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
  // Display-only: a player who typed the tile's own lead-in ("Yes, because
  // ...") sees it once, not twice. `tile.text` itself is untouched, so the
  // event log keeps their exact words. See stripDuplicateLead in side-label.ts.
  return <span>{stripDuplicateLead(tile.text)}</span>;
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
/**
 * The two buttons every little dialog on this board ends with.
 *
 * `.form-base` and `.btn-primary` came across from the retired client, where
 * `.btn-primary` adds a shadow and nothing else, so the verb and the way out
 * were the same grey box with the same weight and the player had to read both
 * to find the one that does the thing. Everywhere else in this app the primary
 * verb is a gold pill, so it is a gold pill here too, and the way out is the
 * offwhite pill the board's own furniture uses.
 */
const PRIMARY_BUTTON =
  "bg-gold text-neutral-white font-primary text-p-sm cursor-pointer rounded-full px-4 py-1.5 tracking-wide shadow-md disabled:cursor-default disabled:opacity-40";

const SECONDARY_BUTTON =
  "border-gray/40 bg-offwhite text-neutral-black font-primary text-p-sm hover:bg-sand/40 cursor-pointer rounded-full border px-4 py-1.5 tracking-wide disabled:cursor-default disabled:opacity-40";

/**
 * A small pill, for a row of choices rather than a decision.
 *
 * Same shape as the two buttons above so nothing on a card looks like it came
 * from a different program, but sized for a list you scan: picking a rule card
 * out of your hand, loading a suggested opening line. It was a square hairline
 * box before, which is what an unstyled button looks like, and next to a
 * rounded gold pill it reads as an unfinished part of the screen.
 */
const CHIP_BUTTON =
  "border-gray/40 hover:bg-sand/40 cursor-pointer rounded-full border px-3 py-0.5 text-xs text-left disabled:cursor-default disabled:opacity-40";

/**
 * A box you type into, on a card beside a tile.
 *
 * The tile composer's own field (further down, the one with the lead-in words
 * above it) is the full-dress version of this: rounded, white, and it darkens
 * its border while you are in it. Every other field on the board was a square
 * hairline rectangle, so the same act of writing a sentence looked like two
 * different programs depending on which move you were making. This is that
 * field at card size.
 */
const FIELD =
  "border-gray/30 bg-neutral-white text-p-sm focus:border-neutral-black w-full rounded-xl border p-2 outline-none transition-colors";

/**
 * How far the drawn octagon sits inside the box a tile is positioned by.
 *
 * A tile's declared box is the outer ring; the octagon people see is the
 * inner frame, centred in it. So `left-0` is not the tile's left edge, it is
 * a frame's width outside it, and the cell around every tile is clipped to
 * the octagon, so anything placed out there is not drawn dim or half: it is
 * not drawn at all.
 *
 * Every badge below hangs off an edge, and every one of them was pinned to
 * the bounding box and then translated half its own width further out, which
 * put roughly three quarters of each badge outside the silhouette. The gold
 * "they are waiting on you" mark on a reason was a five-pixel crescent. It
 * measured correct in every way a test can measure a colour, because the
 * element is there, the right size, and the right colour; the clip takes it
 * after all of that.
 *
 * So badges sit fully inside the edge now, hugging it, instead of straddling
 * it. `docs/` calls this the clip-path trap and this is the third time it has
 * cost an afternoon.
 */
const EDGE_INSET = `${((1 - INNER_FRAME_RATIO) / 2) * 100}%`;

/**
 * The upper corners of a tile, where a badge can sit without covering words.
 *
 * Inside the edge is necessary but not sufficient: a badge on the middle of
 * the left edge is fully drawn and sits on top of the first letter of the
 * reason, because the text block runs the width of the octagon through its
 * middle. The two upper diagonals are the only real estate a tile does not
 * use. The watermark word runs across the top centre and the move glyphs
 * across the bottom, so 24% in from each upper corner clears all three.
 */
const CORNER_INSET = "24%";

/**
 * One move on a reason, in a card that has room to say what it is.
 *
 * The tile card out on the board used to carry the same row of grey underlines
 * the thread drawer uses: "move  say it back  write one for them", every one of
 * them the same weight, the same colour, and none of them saying what it does.
 * That row is right in a list where every tile has one and wrong in a dialog
 * the player opened on purpose about a single reason, where the whole point is
 * that there is room. So the moves keep their names and get a line each.
 *
 * A refused move says why on its own second line rather than in a `title`, for
 * the reasons WhyNot gives, and it says it instead of the explanation rather
 * than under it: once a move is closed to you, what it would have done is the
 * less useful of the two sentences.
 */
function ActionItem({
  label,
  hint,
  verdict = null,
  disabled = false,
  onClick,
}: {
  label: string;
  hint: string;
  verdict?: Verdict | null;
  disabled?: boolean;
  onClick: () => void;
}) {
  const refusal = verdict && !verdict.ok ? verdict.error : null;
  return (
    <button
      type="button"
      disabled={disabled || refusal !== null}
      onClick={onClick}
      className="hover:bg-sand/40 w-full cursor-pointer rounded-lg px-2 py-1.5 text-left transition-colors disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent"
    >
      <span className="font-primary text-p-sm text-neutral-black block tracking-wide">
        {label}
      </span>
      <span className="font-secondary text-gray block text-xs leading-snug">
        {refusal ?? hint}
      </span>
    </button>
  );
}

function CardHand({
  gameId,
  tile,
  me,
  board,
  onBoard = false,
  onOpenChange,
}: {
  gameId: string;
  tile: BoardTile;
  me: { playerId: string; role: Side };
  board: BoardState;
  /** True beside the reason on the board, where the hand is one menu item. */
  onBoard?: boolean;
  /**
   * Told when the hand opens and closes.
   *
   * The hand keeps its own open state, because the drawer has no use for it,
   * but on the board the tile card needs to know: an open hand is a form like
   * any other form, and the rest of the menu goes away while one is up.
   */
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const show = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  // Steve, 2026-09-04 (playtest): a Gym root tile answers the topic itself,
  // not another reason, so "Play a card" (a rule card rewrites the reason it
  // targets) has nothing to attach to there and confused playtesters. Live
  // play is unaffected: a root tile there keeps its hand. A non-root tile,
  // including level 1's scripted card-throw target A3 (parent "A1"), is
  // unaffected either way. See the matching note on ThreadTokenBadge above,
  // which is why a Gym root tile's bottom edge never has to share a thrown
  // card with a resolution token.
  if (board.mode === "gym" && tile.parentId === null) return null;

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
      else show(false);
    });
  };

  if (!open) {
    return onBoard ? (
      <div className="-mx-2">
        <ActionItem
          label="Play a card"
          hint="Challenge this reason with one of your rule cards. They rewrite it; nobody loses anything."
          onClick={() => show(true)}
        />
      </div>
    ) : (
      <div className="ml-6">
        <button
          type="button"
          className="text-xs underline text-gray"
          onClick={() => show(true)}
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

  // Out on the reason the hand gets the room the drawer cannot spare, so each
  // card says in a line what throwing it asks for. Four names on their own are
  // four things to guess at, and a card is the one move here whose whole point
  // is the sentence underneath the name.
  if (onBoard) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-p-sm font-primary text-gray tracking-wide uppercase">
          Play a card
        </p>
        <div className="-mx-2 flex flex-col">
          {deck.map((cardId, index) => {
            const card = coachCard(cardId);
            return (
              <ActionItem
                key={cardId}
                label={cardLabel(cardId)}
                hint={card?.plain ?? "Challenge this reason."}
                verdict={cardVerdicts[index]}
                disabled={pending}
                onClick={() => run(cardId)}
              />
            );
          })}
        </div>
        <div>
          <button
            type="button"
            className={SECONDARY_BUTTON}
            disabled={pending}
            onClick={() => show(false)}
          >
            Never mind
          </button>
        </div>
        <ErrorLine error={error} />
      </div>
    );
  }

  return (
    <div className="ml-6 flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        {deck.map((cardId, index) => {
          const verdict = cardVerdicts[index];
          return (
            <button
              key={cardId}
              type="button"
              className={CHIP_BUTTON}
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
          onClick={() => show(false)}
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
    // A card on a reason is an ask like any other ask, so it is drawn as one:
    // the same gold-edged card a proposal gets, rather than a rule down the
    // left of some small grey text. It used to be the quietest thing on a
    // board it is holding up.
    <div className="border-gold/60 bg-sand/20 flex flex-col gap-2 rounded-lg border p-2">
      <p className="text-p-sm font-primary text-gray tracking-wide uppercase">
        {answerable ? "They played" : "You played"}
      </p>
      <p className="text-p-sm">
        <span className="font-semibold">{cardLabel(thrown.cardId)}</span>
      </p>
      {card && <p className="text-p-sm text-gray">{card.plain}</p>}
      {!answerable && (
        <p className="text-p-sm text-gray italic">Waiting for them to answer.</p>
      )}

      {answerable && mode === "idle" && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={PRIMARY_BUTTON}
            onClick={() => {
              setDraft(
                board.tiles.find((tile) => tile.id === thrown.targetTileId)?.text ?? "",
              );
              setMode("revise");
            }}
          >
            Rewrite it
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON}
            onClick={() => setMode("decline")}
          >
            It does not fit
          </button>
        </div>
      )}

      {answerable && mode === "revise" && (
        <div className="flex flex-col gap-1">
          <textarea
            className={FIELD}
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
              className={PRIMARY_BUTTON}
              disabled={pending || !reviseVerdict.ok}
              title={!reviseVerdict.ok ? reviseVerdict.error : undefined}
              onClick={runRevise}
            >
              Save the rewrite
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON}
              disabled={pending}
              onClick={() => setMode("idle")}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {answerable && mode === "decline" && (
        <div className="flex flex-col gap-1">
          <input
            className={FIELD}
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
              className={PRIMARY_BUTTON}
              disabled={pending || !declineVerdict.ok}
              title={!declineVerdict.ok ? declineVerdict.error : undefined}
              onClick={runDecline}
            >
              Turn the card down
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON}
              disabled={pending}
              onClick={() => setMode("idle")}
            >
              Cancel
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

/**
 * An ask that has been answered, kept on the reason it was about.
 *
 * Settled throws already stay on the board, because the exchange is the record
 * and not a step on the way to one, and an answered ask is the same kind of
 * thing. It matters more here: a rejection is typed rather than clicked, and
 * that sentence is the most interesting thing either player writes. It was
 * being written into the log and then shown to nobody, the person who asked
 * included, so the two of them said no to each other in private.
 */
function SettledProposal({
  proposal,
  board,
}: {
  proposal: BoardProposal;
  board: BoardState;
}) {
  return (
    <p className="ml-6 text-xs opacity-60">
      {proposalSentence(proposal, board)}
      {proposal.status === "accepted" ? " Yes." : " No."}
      {proposal.status === "rejected" && proposal.reason ? ` "${proposal.reason}"` : ""}
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
    // The same card the other asks are written in. This one was still the
    // prototype's indented box with two hairline buttons, so the one move that
    // asks a player to read four candidate reasons was the one that looked
    // least like the game.
    <div className="border-gold/60 bg-sand/20 flex flex-col gap-2 rounded-lg border p-2">
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
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={PRIMARY_BUTTON}
          disabled={pending || !verdict.ok}
          title={!verdict.ok ? verdict.error : undefined}
          onClick={submit}
        >
          Ask to move it
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON}
          disabled={pending}
          onClick={onDone}
        >
          Cancel
        </button>
      </div>
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
  // Removing a reason takes two presses, the way leaving the game does.
  // It sits one row under Edit in the same list, a misclick away, and there
  // is nothing anywhere that puts a reason back. Every other move on this
  // card either asks the other player first or can be typed over; this one
  // just happens.
  const [removeArmed, setRemoveArmed] = useState(false);
  const [moving, setMoving] = useState(false);
  const [handOpen, setHandOpen] = useState(false);
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
  const openProposals = board.proposals.filter(
    (proposal) => proposal.status === "pending" && proposal.targetTileId === tile.id,
  );
  const settledProposals = board.proposals.filter(
    (proposal) => proposal.status !== "pending" && proposal.targetTileId === tile.id,
  );
  const throwsHere = board.throws.filter((thrown) => thrown.targetTileId === tile.id);
  const standing = throwsHere.filter((thrown) => thrown.status === "standing");
  const settled = throwsHere.filter((thrown) => thrown.status !== "standing");
  // Something on this reason that is waiting on you is the only thing on the
  // card worth reading, so it is the only thing on the card. Under the full
  // menu it opened five rows down and past the fold, which is where a move
  // goes to be missed. A rule card played on a reason of your own counts:
  // it opened below Edit and Remove, which is further down still.
  const awaitingMyAnswer =
    openProposals.some((proposal) => proposal.askedBy !== me.role) ||
    (mine && standing.length > 0);

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
    if (!removeArmed) {
      setRemoveArmed(true);
      return;
    }
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
                  className={PRIMARY_BUTTON}
                  disabled={pending || !editVerdict.ok}
                  title={!editVerdict.ok ? editVerdict.error : undefined}
                  onClick={runEdit}
                >
                  Save
                </button>
                <button
                  type="button"
                  className={SECONDARY_BUTTON}
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
          ) : onBoard ? (
            <>
              <span className="text-p-sm text-gray flex flex-wrap items-center gap-2">
                {tile.edited && <span>(edited)</span>}
                {tile.revised && <span>(rewritten)</span>}
              </span>
              {/* The same moves the drawer offers, at the density a dialog
                  can afford. The two kinds are still two kinds and are still
                  ruled apart: everything above the line puts a question to
                  the other player and waits for them, everything below it is
                  housekeeping on a reason of your own that happens the moment
                  you click.

                  Picking one puts the menu away. The forms open below, and
                  with the list still above them the card was a form under
                  four dead rows of things you could have done instead. */}
              <div
                className={`-mx-2 flex flex-col ${
                  proposing !== null || moving || handOpen || awaitingMyAnswer
                    ? "hidden"
                    : ""
                }`}
              >
                {/* BRAIN-T260903-06: the four moves below are gated by
                    canStartLaterMove. Relocation stays available outside live
                    play (it is load-bearing for Gym level 2); the other three
                    are Gym level 5+ and hidden everywhere for now.

                    Steve, 2026-09-04 (playtest): on top of that gate, a Gym
                    root tile hides "Move it" / "Say it back" / "Write one for
                    them" outright. A root tile answers the topic itself, not
                    another reason, so these three (which are all about a
                    reason's relationship to what it is under) read as
                    non-sequiturs there and were confusing playtesters. Live
                    play is untouched: it never reaches this branch, since
                    canStartLaterMove is already false for board.mode ===
                    "live". A non-root tile, including level 1's scripted
                    card-throw target A3 (parent "A1"), is unaffected. */}
                {(() => {
                  const hideOnGymRoot = board.mode === "gym" && tile.parentId === null;
                  return (
                    <>
                      {!hideOnGymRoot && canStartLaterMove(board, "tile_relocation") && (
                        <ActionItem
                          label="Move it"
                          hint="Ask them to hang this reason under a different one."
                          verdict={moveVerdict}
                          disabled={pending || moving}
                          onClick={() => setMoving(true)}
                        />
                      )}
                      {!hideOnGymRoot &&
                        readingVerdict &&
                        canStartLaterMove(board, "reading_handback") && (
                          <ActionItem
                            label="Say it back"
                            hint="Write what you think they meant. They tell you whether you have it."
                            verdict={readingVerdict}
                            disabled={pending || proposing !== null}
                            onClick={() => setProposing("reading")}
                          />
                        )}
                      {!hideOnGymRoot && canStartLaterMove(board, "steelman_tile") && (
                        <ActionItem
                          label="Write one for them"
                          hint="Put their point better than they did, and offer it as their reason."
                          verdict={steelmanVerdict}
                          disabled={pending || proposing !== null}
                          onClick={() => setProposing("steelman")}
                        />
                      )}
                    </>
                  );
                })()}
                {!(board.mode === "gym" && tile.parentId === null) &&
                  canStartLaterMove(board, "definition") && (
                    <ActionItem
                      label="Pin down a word"
                      hint="Ask what one word in here is doing, and agree on what it means."
                      verdict={definitionVerdict}
                      disabled={pending || proposing !== null}
                      onClick={() => setProposing("definition")}
                    />
                  )}
                {mine && (
                  <>
                    <span
                      aria-hidden="true"
                      className="bg-neutral-black/15 mx-2 my-2 h-px"
                    />
                    <ActionItem
                      label="Edit"
                      hint="Reword your own reason. It keeps its place on the board."
                      verdict={editBlocked}
                      disabled={pending}
                      onClick={() => setEditing(true)}
                    />
                    <ActionItem
                      label={removeArmed ? "Remove it" : "Remove"}
                      hint={
                        removeArmed
                          ? "Click again and it comes off the board. There is no putting it back."
                          : "Take your reason back off the board."
                      }
                      verdict={removeVerdict}
                      disabled={pending}
                      onClick={runRemove}
                    />
                  </>
                )}
              </div>
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
                {/* Anyone may ask to move any reason: the other side answers.
                    BRAIN-T260903-06: relocation is hidden in live play and
                    stays available only outside it (Gym level 2 needs it). */}
                {canStartLaterMove(board, "tile_relocation") && (
                  <button
                    type="button"
                    className="text-p-sm underline text-gray disabled:opacity-30"
                    disabled={pending || moving || !moveVerdict.ok}
                    title={!moveVerdict.ok ? moveVerdict.error : undefined}
                    onClick={() => setMoving(true)}
                  >
                    move
                  </button>
                )}
                {/* The two cooperative moves, on the reason they are about.
                    Steve's call: none of these is writing in a tile, it is
                    writing in a little dialog beside one.
                    BRAIN-T260903-06: Gym level 5+, hidden for now. */}
                {readingVerdict && canStartLaterMove(board, "reading_handback") && (
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
                {canStartLaterMove(board, "steelman_tile") && (
                  <button
                    type="button"
                    className="text-p-sm underline text-gray disabled:opacity-30"
                    disabled={pending || proposing !== null || !steelmanVerdict.ok}
                    title={!steelmanVerdict.ok ? steelmanVerdict.error : undefined}
                    onClick={() => setProposing("steelman")}
                  >
                    write one for them
                  </button>
                )}
                {/* The fourth non-argument move. A word, not a reason: you are
                    not answering this tile, you are asking what one of the
                    words in it is doing. It opens here because a word is
                    always a word in something, and this is the something.
                    BRAIN-T260903-06: Gym level 5+, hidden for now. */}
                {canStartLaterMove(board, "definition") && (
                  <button
                    type="button"
                    className="text-p-sm underline text-gray disabled:opacity-30"
                    disabled={pending || proposing !== null || !definitionVerdict.ok}
                    title={!definitionVerdict.ok ? definitionVerdict.error : undefined}
                    onClick={() => setProposing("definition")}
                  >
                    pin down a word
                  </button>
                )}
              </span>
            </>
          )}
        </div>
      </div>
      <ErrorLine error={error} />
      {/* The links above go dead together and for the same reason, so the
          reason is said once under the reason it belongs to. */}
      {editing || onBoard ? null : (
        <WhyNotAll
          className="text-p-sm text-gray ml-6"
          verdicts={[
            mine ? editBlocked : null,
            mine ? removeVerdict : null,
            // BRAIN-T260903-06: no "why not" line for a move that is not
            // offered in the first place.
            canStartLaterMove(board, "tile_relocation") ? moveVerdict : null,
          ]}
        />
      )}

      {!mine &&
        tile.side !== me.role &&
        !tile.removed &&
        // The hand is another way to act on this reason, so it goes away with
        // the rest of them while one of the forms is open.
        !(onBoard && (proposing !== null || moving || awaitingMyAnswer)) && (
          <CardHand
            gameId={gameId}
            tile={tile}
            me={me}
            board={board}
            onBoard={onBoard}
            onOpenChange={setHandOpen}
          />
        )}

      {/* Open proposals about this reason, on this reason. Both directions:
          the one you are waiting on and the one waiting on you. */}
      {openProposals.map((proposal) => (
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
          only the reason's author gets the two ways to answer. Settled throws
          stay on the board because the exchange is the record, not a step on
          the way to one. */}
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
      {settled.map((thrown) => (
        <SettledThrow key={thrown.seq} thrown={thrown} />
      ))}
      {settledProposals.map((proposal) => (
        <SettledProposal key={proposal.id} proposal={proposal} board={board} />
      ))}

      {!onBoard && tile.children.length > 0 && (
        <ul className="ml-2 flex flex-col gap-2 border-gray/25 border-l pl-4">
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
            className={FIELD}
            value={reason}
            maxLength={300}
            disabled={pending}
            placeholder="Why not? They will see this."
            onChange={(event) => setReason(event.target.value)}
          />
          <span className="flex gap-2">
            <button
              type="button"
              className={PRIMARY_BUTTON}
              disabled={pending}
              onClick={() => answer(false)}
            >
              Send it
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON}
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
              className={PRIMARY_BUTTON}
              disabled={pending || !verdict.ok}
              onClick={() => answer(true)}
            >
              Yes
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON}
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
/**
 * The words the two of you have pinned down, kept in front of you.
 *
 * Define That is only worth making if the answer binds, and an agreement that
 * scrolls away binds nothing. This was one of the four sections of the Match
 * details drawer until 2026-09-03; it comes back as its own card because it is
 * the one of the four that has to stay legible in the middle of an argument,
 * which is exactly when nobody opens a drawer. Gym level 4 teaches the move,
 * so the card is what the level is pointing at when it says the definition is
 * pinned to the edge of the board.
 *
 * Silent until a definition is actually agreed, like every other card in this
 * rail.
 */
function PinnedWords({ board }: { board: BoardState }) {
  const words = agreedDefinitions(board);
  if (words.length === 0) return null;

  return (
    <section className="border-gray/30 bg-offwhite flex w-full flex-col gap-2 rounded-2xl border px-5 py-4 shadow-md">
      <h2 className="font-primary text-neutral-black text-p-lg">Words you pinned down</h2>
      <dl className="flex flex-col gap-2">
        {words.map((word) => (
          <div key={word.term.toLowerCase()} className="flex flex-col">
            <dt className="font-primary text-neutral-black text-p-sm">{word.term}</dt>
            <dd className="font-secondary text-gray text-p-sm">{word.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

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
          className={SECONDARY_BUTTON}
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

function reducedMotionPreferred(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Types a sample answer into the box instead of dropping it in whole: the
 * Gym's coach is suggesting the words, not filling out the player's form,
 * and typing reads as an offer in a way a box that is simply already full
 * does not (Steve, 2026-09-04, live playtest). 25 to 35ms per character
 * with a little jitter, which keeps even a 60-character sample under the
 * 2.5s it takes to start feeling slow. A keypress or click in the box, or a
 * standing prefers-reduced-motion setting, jumps straight to the finished
 * text.
 *
 * `sample` is only ever read at mount. `InTileComposer` is remounted (see
 * its `key` at the call site) whenever the slot it belongs to changes, so
 * there is no case where the text this hook is typing needs to change out
 * from under it mid-animation.
 */
function useTypedSample(sample: string): {
  text: string;
  setText: (value: string) => void;
  typing: boolean;
  finishTyping: () => void;
} {
  const [reduced] = useState(reducedMotionPreferred);
  const [text, setText] = useState(reduced ? sample : "");
  const [typing, setTyping] = useState(!reduced && sample.length > 0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!typing) return;
    let shown = 0;
    const tick = () => {
      shown += 1;
      setText(sample.slice(0, shown));
      if (shown >= sample.length) {
        timerRef.current = null;
        setTyping(false);
        return;
      }
      timerRef.current = setTimeout(tick, 25 + Math.random() * 10);
    };
    timerRef.current = setTimeout(tick, 25 + Math.random() * 10);
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
    // sample is fixed for the life of this hook; see the doc comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typing]);

  const finishTyping = () => {
    if (!typing) return;
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
    setTyping(false);
    setText(sample);
  };

  return { text, setText, typing, finishTyping };
}

function InTileComposer({
  gameId,
  board,
  side,
  parentTileId,
  parentSide,
  initialText = "",
  corner,
  onDone,
}: {
  gameId: string;
  board: BoardState;
  side: Side;
  /** The tile being answered, or null for a new thread off the topic. */
  parentTileId: string | null;
  /** The answered tile's side, for the lead line. Null when answering the topic. */
  parentSide: Side | null;
  /**
   * What the box opens with. The Gym coach's sample answer arrives here, from
   * the slot the player clicked (Steve, 2026-09-03), and it is ordinary
   * editable draft text from the moment it lands: the player can rewrite it,
   * clear it, or place it as it stands, and the tile is theirs either way.
   * Typed in rather than dropped in whole; see `useTypedSample`.
   */
  initialText?: string;
  /** Which diagonal of the parent this box occupies, recorded on the tile. */
  corner: TileCorner;
  onDone: () => void;
}) {
  const { text, setText, typing, finishTyping } = useTypedSample(initialText);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const verdict = canPlaceTile(board, text, parentTileId);
  /**
   * Why Place is dead, on the screen rather than in the button's tooltip.
   *
   * Same shape as the steelman box further down this file: once there are
   * words in the box the line under it judges those words, and until there
   * are, it judges the box's standing situation instead. "A reason needs some
   * words in it" is not news about an empty box.
   *
   * Found by playing level 4 on 2026-09-04. A reason may not end in a question
   * mark, the moderator has a sentence for it, and the level tells the player
   * in so many words to try it themselves and hear the same sentence. What
   * they actually got was a greyed-out Place button and silence, because the
   * moderator's sentence was only in `title`, which WhyNot's own note above
   * says is not an explanation.
   */
  const blocked =
    text.trim().length > 0 ? verdict : canPlaceTile(board, "a reason", parentTileId);

  const submit = () => {
    if (!verdict.ok || typing) return;
    setError(null);
    startTransition(async () => {
      const result = await placeTile(gameId, { text, parentTileId, corner });
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
            // While the sample is still typing itself in, a click or a
            // keypress here means "I've seen enough, give me the rest,"
            // not "let me edit this half-finished word."
            onClick={() => {
              if (typing) finishTyping();
            }}
            onKeyDown={(event) => {
              if (typing) {
                event.preventDefault();
                finishTyping();
                return;
              }
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
        {/*
          Two buttons, drawn as two buttons. They used to sit inside one shared
          pill with the gold one filling its left half, which is the exact
          picture of a two-position switch: it read as one control that could be
          flipped from Place to cancel rather than as a choice between placing
          and not placing. Separate pills with air between them, and the second
          one outlined rather than bare text, so the pair reads as a primary
          action and its way out.
        */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="bg-gold text-neutral-white font-primary cursor-pointer rounded-full px-5 py-1.5 tracking-wide uppercase shadow-lg disabled:cursor-default disabled:opacity-40"
            disabled={pending || !verdict.ok || typing}
            title={
              typing
                ? "Still typing..."
                : !verdict.ok
                  ? verdict.error
                  : "Place it (or press Return)"
            }
            onClick={submit}
          >
            {pending ? "Placing..." : "Place"}
          </button>
          <button
            type="button"
            className="border-gray/40 bg-offwhite text-neutral-black font-primary hover:bg-sand/40 cursor-pointer rounded-full border px-5 py-1.5 tracking-wide uppercase shadow-md disabled:cursor-default disabled:opacity-40"
            disabled={pending}
            title="Discard this reason (or press Escape)"
            onClick={onDone}
          >
            Cancel
          </button>
        </div>
        {/* Its own pill for the same reason the buttons have one: this lands
            on top of a neighbouring octagon as often as not, and grey text on
            a tile is not readable. */}
        <WhyNot
          verdict={blocked}
          className="bg-offwhite text-neutral-black rounded-full px-3 py-1 text-xs shadow-md"
        />
        <ErrorLine error={error} />
      </div>
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
    <div className="flex flex-col gap-2 border-gray/30 bg-offwhite rounded-xl border p-3">
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
    <div className="flex flex-col gap-2 border-gray/25 border-t pt-2">
      <p className="text-p-sm text-gray">In your own words, what are they saying?</p>
      <textarea
        className={FIELD}
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
          className={PRIMARY_BUTTON}
          disabled={pending || !verdict.ok}
          title={!verdict.ok ? verdict.error : undefined}
          onClick={submit}
        >
          Ask if you have it right
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON}
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
        className={FIELD}
        value={text}
        maxLength={READING_MAX_CHARS}
        disabled={pending}
        placeholder="The strongest version of what they think."
        onChange={(event) => setText(event.target.value)}
      />
      <WhyNot verdict={blocked} />
      <button
        type="button"
        className={`${SECONDARY_BUTTON} self-start`}
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
    <div className="flex flex-col gap-2 border-gray/25 border-t pt-2">
      <p className="text-p-sm text-gray">
        A reason for their side that you think they missed, hung under this one.
      </p>
      <textarea
        className={FIELD}
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
          className={PRIMARY_BUTTON}
          disabled={pending || !verdict.ok}
          title={!verdict.ok ? verdict.error : undefined}
          onClick={submit}
        >
          Offer it to them
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON}
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
    <div className="flex flex-col gap-2 border-gray/25 border-t pt-2">
      <p className="text-p-sm text-gray">
        A word in this reason that the two of you may be hearing differently.
      </p>
      <p className="text-p-sm font-tiles text-gray">&ldquo;{tile.text}&rdquo;</p>
      <input
        className={FIELD}
        value={term}
        maxLength={DEFINITION_TERM_MAX_CHARS}
        disabled={pending}
        placeholder="The word"
        onChange={(event) => setTerm(event.target.value)}
      />
      <textarea
        className={FIELD}
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
          className={PRIMARY_BUTTON}
          disabled={pending || !verdict.ok}
          title={!verdict.ok ? verdict.error : undefined}
          onClick={submit}
        >
          Ask them to agree
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON}
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
      style={{ left: CORNER_INSET, top: CORNER_INSET }}
      className={`font-primary text-p-md absolute z-20 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm ${
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
  // A token they have put down and you have not matched is your move, and it
  // is the move that ends a thread, so it gets the same gold a thrown card
  // and an unanswered ask get. Before this the badge looked identical whether
  // you were the one waiting or the one being waited on, and the only words
  // anywhere were in a `title`, which needs a mouse held still long enough to
  // trust and says nothing at all to a screen reader.
  const yours = !settled && theirs !== null && mine === null;
  const words = settled
    ? `Thread resolved: ${tokenLabel(settled)}`
    : yours
      ? `They suggested: ${tokenLabel(token)}. Click the reason to say whether you agree.`
      : `You suggested: ${tokenLabel(token)}. Waiting for them.`;
  // A settled thread and a thread waiting on somebody are two different
  // announcements, and they are drawn differently.
  //
  // Steve, 2026-09-04, live playtest: the 2026-09-03 corner stamp (24px,
  // tucked in the lower right, matching the retired `Tile.vue`) read as too
  // small to notice mid-game. His reference was the onboarding video's own
  // resolve-a-thread ping (`public/onboarding/step3.mp4`): a large
  // rounded-square badge with a real border and shadow, sitting bottom
  // centre and overlapping the tile's own edge rather than tucked inside a
  // corner. This replaces the corner placement with that one. Settled is
  // still the calmer of the two, a plain stamp; pending keeps a dashed ring
  // and a pulse, because a token one side has merely suggested is a live
  // question addressed to the other player, and it is the loudest thing on
  // that tile for exactly as long as it is unanswered.
  //
  // Shares the bottom edge with TileThrowBadges above. A root tile in a live
  // (non-gym) game can carry both a thrown card and a thread token at once;
  // gym mode never can, because a root tile cannot take a card there
  // (see the CardHand root+gym gate further down this file).
  if (settled) {
    return (
      <span
        style={{ left: "50%", bottom: 0 }}
        className="border-gray/40 absolute z-30 flex -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-2xl border-2 bg-white p-1.5 shadow-md"
        title={words}
      >
        <TokenGlyph token={settled} size={56} />
        <span className="sr-only">{words}</span>
      </span>
    );
  }

  return (
    <span
      style={{ left: "50%", bottom: 0 }}
      className={`absolute z-20 flex -translate-x-1/2 translate-y-1/2 animate-pulse items-center justify-center rounded-2xl border-2 border-dashed p-1.5 shadow-md ${
        yours ? "border-gold bg-sand" : "border-gray/40 bg-offwhite opacity-70"
      }`}
      title={words}
    >
      <TokenGlyph token={token} size={64} />
      <span className="sr-only">{words}</span>
    </span>
  );
}

export function LiveBoard({
  gameId,
  board,
  me,
  coachEnabled,
  buildStamp = null,
  joinCode = null,
  opponentEmoji,
}: LiveBoardProps): ReactElement {
  const threads = liveThreads(board);

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
  const onboarding = useOnboarding({ auto: board.mode !== "gym" });
  // The topic editor opens from two places (the tile itself and the Ways to
  // win pencil), so the board owns whether it is open, not the tile.
  const [topicEditing, setTopicEditing] = useState(false);
  const topicPending = pendingTopicRevision(board) !== null;
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
    /** The coach's sample answer, when the slot clicked was carrying one. */
    sample?: string | null;
    /** Which diagonal of the parent this slot is, for the placement event. */
    corner: TileCorner;
  } | null>(null);
  // A same-side answer the player has asked for but not yet been let into,
  // because this is the first one this match and the notice is in front of
  // them. Dismissing the notice opens it; there is no way to say no, because
  // clicking the slot already said yes (Steve, 2026-09-02).
  const [sameSideHold, setSameSideHold] = useState<{
    parentId: string;
    pos: { x: number; y: number };
    sample?: string | null;
    corner: TileCorner;
  } | null>(null);
  // What the Gym coach has offered to write for the next tile, published by
  // GymDirector (components/gym/sample-answers.ts). Empty in a live game.
  const sampleAnswers = useSampleAnswers();
  const pointedSlot = usePointedSlot();
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
    // Ends above the dev hot seat bar when there is one. The bar publishes its
    // measured height as `--dev-bar-h` (components/dev/hotseat-bar.tsx); with no
    // bar the variable is unset and the fallback puts the board back on the
    // floor, so nothing about the real game changes.
    <div className="bg-offwhite fixed inset-x-0 top-0 bottom-[var(--dev-bar-h,0px)] overflow-hidden">
      <SpatialBoard
        // A rewrite of the topic is a negotiation about the whole board,
        // so the board stops offering places to put a new reason while one
        // is open or waiting for an answer.
        placementEnabled={placementEnabled && !topicEditing && !topicPending}
        canPlaceOn={canPlaceUnder}
        placeSide={me.role}
        // How many opening reasons this game wants before replies open:
        // four normally, two in gym level 1. The board draws a placeholder
        // for every corner still in play (Steve, 2026-09-04).
        rootTarget={rootTarget(board)}
        // The rail is `right-8 w-[15rem]`, so 15 plus its 2rem gutter. Keep
        // this in step with the rail wrapper's classes below.
        reserveRight={17}
        // The bottom cluster is `bottom-8` plus the Place a reason pill, the
        // gap, and the rule-card tray with its tab and its hint line. Keep
        // this in step with that column's classes below; the composer is
        // taller than the pill it replaces, and that is allowed to overlap,
        // because a player who opened the composer is typing in it rather
        // than reading the tile behind it.
        reserveBottom={13}
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
              initialText={draft.sample ?? ""}
              corner={draft.corner}
              // A fresh box per slot, so the coach's words load into the one
              // that was clicked rather than being ignored because the
              // component was already mounted with an empty draft in it.
              key={`${draft.parentId}:${draft.pos.x},${draft.pos.y}`}
              onDone={() => setDraft(null)}
            />
          )
        }
        slotSamples={sampleAnswers}
        pointedSlot={pointedSlot}
        onPlace={(parentId, pos, sample, corner) => {
          setSelectedTileId(null);
          setArmedCardId(null);
          // Answering your own reason is legal and gets one word about it,
          // once per match. The topic belongs to neither side, so starting a
          // thread off it is never a same-side answer.
          const answering = parentId === TOPIC_CELL_ID ? null : sideOf.get(parentId);
          // The composer prints the stem as a chip in front of the text, so
          // a coach sample that opens with the same words is trimmed before
          // it becomes the draft, or it typed out "Hmm But a bun...".
          const seed = sample ? stripDuplicateLead(sample) : null;
          if (answering && answering === me.role && !sameSideNoticeSeen(gameId)) {
            setSameSideHold({ parentId, pos, sample: seed, corner });
            return;
          }
          setDraft({ parentId, pos, sample: seed, corner });
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
              did not land. A card waiting on you is gold, a card waiting on
              them is plain, and a settled one fades back to a record. */}
            <TileThrowBadges board={board} tileId={tile.id} me={me} />
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
        {/* The How to play page is gone (Steve, 2026-09-03) and this is what
            replaced it on the board: a "?" that opens the same four-step
            overlay in place. A player who is stuck mid-argument will not
            leave the game to go and read a page, and the retired client's
            help was a corner button for the same reason. */}
        <OnboardingLauncher
          label="How to play"
          className="border-gray/30 bg-offwhite text-neutral-black hover:bg-sand font-primary flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border text-lg shadow-md"
        >
          <span aria-hidden>?</span>
        </OnboardingLauncher>
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
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
              <SideAvatar side={opponentSide} className="h-12 w-12" />
              {opponentEmoji ? (
                <span
                  aria-hidden="true"
                  className="border-ink bg-orange absolute -right-1.5 -bottom-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 text-base leading-none shadow-md"
                >
                  {opponentEmoji}
                </span>
              ) : null}
            </div>
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
            onClick={onboarding.show}
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
          // BRAIN-T260903-06: proposing a topic revision is a Gym level 5+
          // move. The pencil already knows how to go quiet when this game's
          // rules do not allow a revision at all (`endsOnTopic`); reusing
          // that same "no hint, no handler" shape is how it stays quiet
          // while the move is held back from the live game too.
          onRevise={
            canStartLaterMove(board, "topic_revision")
              ? () => setTopicEditing(true)
              : undefined
          }
          reviseHint={
            endsOnTopic && canStartLaterMove(board, "topic_revision")
              ? "Write the version you would both sign."
              : null
          }
          ceilingNote={ceilingNote}
          showRevise={canStartLaterMove(board, "topic_revision")}
          // BRAIN-T260903-06: the footer names the topic-revision ending as
          // something you can go do right now, so it is gated the same way
          // the pencil is, rather than describing a door the card itself has
          // just closed.
          footer={
            endsOnTopic && canStartLaterMove(board, "topic_revision")
              ? "Either ending is a win, and it is the same win for both of you."
              : null
          }
        />

        {/* The coach is a card in this rail in Rannie's frame, under Ways to
            win. It spent a while as a wide bar across the top centre, where
            it was the first thing on the screen and sat directly over the
            tiles the moment anyone opened it, and then a while folded inside
            a FloatingPanel, which hid its switch behind a click. It draws its
            own card now, so there is no wrapper here.

            Never in the Gym: GymDirector already runs a scripted coach at
            the top of the board, and the player's own coach preference is
            not a Gym setting, so this panel (and any toggle for it) simply
            does not exist while board.mode is "gym", regardless of
            coachEnabled. */}
        {board.mode !== "gym" ? (
          <CoachPanel gameId={gameId} board={board} me={me} enabled={coachEnabled} />
        ) : null}

        <PendingAsks gameId={gameId} board={board} me={me} />

        <PinnedWords board={board} />

        {/*
          The Match details drawer is gone (Steve, 2026-09-03), and so are all
          four of its sections: the per-thread tile lists, Generosity, the
          words the two of you have pinned down, and Who is here.

          It was a page-long list of the board rendered beside the board, kept
          alive because the per-tile actions in it had nowhere else to go.
          They have somewhere else to go now. Nothing here was the only copy of
          anything: the threads are the board, the roster is the header, and
          the pinned words come back as their own strip on the board itself
          rather than folded inside a drawer nobody opens mid-argument.
        */}
      </div>

      {/* Bottom left: the small print, stacked the way Rannie stacks it. A
          row here ran into the composer in the middle of the screen the
          moment the window got narrow, and this corner is the one part of
          the board with vertical room to spare. */}
      {/* `fixed`, so it is measured against the viewport and not against the
          board root, which means raising the board off the dev hot seat bar
          does not raise this with it. It has to carry the same offset itself. */}
      <div className="fixed bottom-[calc(2rem+var(--dev-bar-h,0px))] left-8 z-30 flex flex-col items-start gap-2">
        <FeedbackPopover variant="inline" />
        {buildStamp}
        {/* `Your games` used to sit here as a quiet way off the board. It
            read as a button on the game rather than a link off it, and
            clicking it looked like it removed you from the match, so it is
            gone (Steve, 2026-09-02). Leave game in the top left is the only
            door out, and it says what it does. */}
        <span className="flex items-center gap-3 pl-1">{statusDot}</span>
      </div>

      {/* Bottom centre: the hand you hold.

          Clicking an open diagonal writes the reason directly on the board,
          in the cell it will occupy, which is the retired client's whole
          gesture (Steve, 2026-09-04: a separate "Place a reason" pill here
          was a second, redundant way in and is gone; the board itself is now
          the only place a reason gets started).

          Not dead-centred on the viewport: the zoom and pan cluster lives at
          the board's bottom right (spatial-board.tsx, `right-8 bottom-8`),
          and a full-width centre reliably drifted this tray on top of it at
          ordinary desktop widths. The right inset below reserves that
          cluster's own footprint plus its gutter, so this column centres
          itself in what is left rather than in the whole screen. */}
      <div
        className="fixed bottom-[calc(2rem+var(--dev-bar-h,0px))] left-8 z-40 flex flex-col items-center"
        style={{ right: "23rem" }}
      >
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
          {/* The card said nothing about which reason it belonged to. Out on
              the board that is usually survivable, because the card is drawn
              beside its tile, and it stops being survivable the moment the
              card flips to the tile's other side or the board pans under it.
              So it opens with the reason, in the reason's own hand and its
              own side colour, reading as the sentence the tile reads as. */}
          <header className="border-neutral-black/15 mb-3 flex flex-col gap-0.5 border-b pr-6 pb-3">
            <span
              className={`font-primary text-xs tracking-wide uppercase ${
                selectedTile.side === "plus" ? "text-green" : "text-orange"
              }`}
            >
              {tileLead(
                selectedTile.side,
                selectedTile.isOpeningReason || selectedTile.parentId === null,
                selectedTile.parentId
                  ? (sideOf.get(selectedTile.parentId) ?? null)
                  : null,
              )}
            </span>
            <p className="font-tiles text-p-sm text-neutral-black leading-snug">
              <TileText tile={selectedTile} />
            </p>
          </header>
          <ul className="flex flex-col gap-2">
            {/* Keyed by the reason, so clicking a second tile builds a second
                card rather than handing this one a new `tile` prop. React
                would otherwise reuse the instance and every piece of state in
                it: the half-typed edit, the open form, which move you were
                part-way through. Found by playing it. Clicking one reason,
                then another, then Edit put the first reason's text inside the
                second reason's octagon, one Save away from overwriting it. */}
            <TileNode
              key={selectedTile.id}
              tile={selectedTile}
              gameId={gameId}
              me={me}
              board={board}
              onBoard
            />
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

      {sameSideHold && (
        <SameSideNotice
          onDismiss={() => {
            markSameSideNoticeSeen(gameId);
            setDraft(sameSideHold);
            setSameSideHold(null);
          }}
        />
      )}

      <OnboardingOverlay
        open={onboarding.open}
        onClose={onboarding.close}
        myRole={me.role}
      />
    </div>
  );
}
