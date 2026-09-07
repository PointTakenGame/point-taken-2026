"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
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
import { SpatialBoard, cornerFromOffset } from "@/components/board/spatial-board";
import { TOPIC_CELL_ID, topicRootedLayout } from "@/components/board/layout";
import {
  SameSideNotice,
  markSameSideNoticeSeen,
  sameSideNoticeSeen,
} from "@/components/board/same-side-notice";
import {
  WaysToWinCard,
  type MiniCorner,
  type MiniThread,
} from "@/components/board/ways-to-win-card";
import {
  OnboardingOverlay,
  useOnboarding,
} from "@/components/onboarding/onboarding-overlay";
import { FeedbackPopover } from "@/components/feedback/feedback-popover";
import { AnchoredCard } from "@/components/ui/anchored-card";
import { PencilGlyph } from "@/components/ui/pencil-glyph";
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
  proposeSteelmanReading,
  proposeSteelmanTile,
  rejectProposal,
  relocateTile,
  removeTile,
  reviseTile,
  throwCard,
} from "@/app/game/[gameId]/actions";
import type { Side, TileCorner, Uuid } from "@/lib/events/types";
import { useBossDraft } from "@/components/gym/boss-draft";
import { useCookedPlacement } from "@/components/gym/cooked-placement";
import { useHiddenSurfaces } from "@/components/gym/hidden-surfaces";
import { useTaughtMoves } from "@/components/gym/taught-moves";
import { taughtToken } from "@/lib/gym/taught";
import { publishMovingTile } from "@/components/gym/moving-tile";
import { usePointedSlot } from "@/components/gym/pointed-slot";
import { usePointedTile } from "@/components/gym/pointed-tile";
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
  /** This player's own avatar emoji, shown on their seat badge. Same rule as
   *  `opponentEmoji`: only the emoji crosses the boundary. */
  myEmoji?: string;
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

/** The board's geometric corners (`TileCorner`, ne/se/sw/nw) named the way
 *  the "Ways to win" minimap names its own four quadrants (`MiniCorner`,
 *  tr/br/bl/tl). Has to agree with `SLOTS` in ways-to-win-card.tsx. */
const CORNER_TO_MINI: Record<TileCorner, MiniCorner> = {
  ne: "tr",
  se: "br",
  sw: "bl",
  nw: "tl",
};

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
 * A move in the tile card's menu (play a card, ask for a reading, close a
 * thread's other moves), styled to read as a real control.
 *
 * Steve, 2026-09-05, ruling on the tile card: "There's a bunch of
 * options... edit, remove, close this thread, and they don't feel like
 * buttons. They look like a list of unclickable text."
 * `ActionItem` used to be a hover-highlight row (`hover:bg-sand/40
 * rounded-lg`), the same treatment a disabled row and a live one shared. This
 * borrows `.sticker`'s hard-edge card border and shadow, the same vocabulary
 * `PILL_DARK` (components/gym/level-intro.tsx) and `.btn-icon` already use
 * elsewhere on this board, so a menu row reads as a pressable card rather
 * than a line in a list.
 */
const REPLY_STICKER_BUTTON =
  "sticker block w-full cursor-pointer rounded-lg px-3 py-2 text-left transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0";

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
      className={REPLY_STICKER_BUTTON}
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
  const hiddenSurfaces = useHiddenSurfaces();

  const show = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  // Steve, 2026-09-06: the player may not reach for a move the level has not
  // taught. A level that hides the rule-card tray has not taught rule cards,
  // so "Play a card" on a tile is the same affordance by another door and
  // goes away with it. Level 1 reveals both at `p5-first-card`.
  if (hiddenSurfaces.includes("card-tray")) return null;

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
        <div className="flex flex-col gap-2">
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
 * The four arrows on the Move it control.
 *
 * Steve, 2026-09-05 (BRAIN-T260905-64): Move it sits in the tile card's upper
 * right "with an icon that reads as moving". Same reasoning as PencilGlyph
 * above: no icon package is installed here, so it is a small inline glyph.
 */
function MoveGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M10 2.5v15M2.5 10h15M10 2.5L7.5 5M10 2.5L12.5 5M10 17.5L7.5 15M10 17.5l2.5-2.5M2.5 10L5 7.5M2.5 10L5 12.5M17.5 10L15 7.5M17.5 10L15 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TileNode({
  tile,
  gameId,
  me,
  board,
  onBoard = false,
  startEditing,
  onMove,
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
  /**
   * Opens this card already typing, seeded by the pencil icon on the tile
   * itself out on the board (LiveBoard's `renderTile`). Read once, as a lazy
   * initializer: the card is mounted fresh every time it opens (it lives
   * inside `{selectedTile && <AnchoredCard>...}`, which fully unmounts on
   * close), so there is exactly one edit entry point, `setEditing`, whether
   * it is reached from the on-tile pencil or (were it still offered inline)
   * a click inside the card.
   */
  startEditing?: boolean;
  /**
   * Arms the move. Move it is two clicks (Steve, BRAIN-T260905-64): this one
   * hands the reason to the board, which then waits for the empty spot the
   * player clicks. The board owns the second half, so the card only says which
   * reason is going somewhere and gets out of the way.
   */
  onMove?: () => void;
}) {
  const [editing, setEditing] = useState(() => startEditing ?? false);
  // Removing a reason takes two presses, the way leaving the game does.
  // It sits one row under Edit in the same list, a misclick away, and there
  // is nothing anywhere that puts a reason back. Every other move on this
  // card either asks the other player first or can be typed over; this one
  // just happens.
  const [removeArmed, setRemoveArmed] = useState(false);
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
  // On a scripted Gym level the words on the board are the script's, not the
  // player's (`lockedText` in components/gym/cooked-placement.ts). Edit and
  // remove both close: a rule about the root cannot be taught on a board
  // where the root can be rewritten or taken away mid-lesson. Unrestricted
  // in a live game, where no Director is mounted.
  const scriptOwnsText = useCookedPlacement().lockedText;
  const editVerdict = canEditTile(board, tile.id, me.playerId, draft);
  const removeVerdict = canRemoveTile(board, tile.id, me.playerId);
  // lib/board/rules.ts's canRemoveTile has no children check (core lane, not
  // editable from here); gate the terminal-tile rule in the presentation
  // layer instead. Steve, 2026-09-05: remove is offered only for a terminal
  // tile, the last tile in its thread nobody has replied under. Core
  // follow-up to move this into canRemoveTile itself is filed.
  const isTerminal = tile.children.filter((child) => !child.removed).length === 0;
  const removeBlocked: Verdict = !removeVerdict.ok
    ? removeVerdict
    : isTerminal
      ? removeVerdict
      : { ok: false, error: "Once someone has replied under it, it can't be removed." };
  const moveVerdict = canProposeRelocation(
    board,
    tile.id,
    tile.parentId,
    tile.threadRootId,
  );
  // BRAIN-T260903-06: the four later moves are gated by canStartLaterMove.
  // Relocation stays available outside live play (it is load-bearing for Gym
  // level 2); the other three are Gym level 5+ and hidden everywhere for now.
  //
  // Steve, 2026-09-04 (playtest): on top of that gate, a Gym root tile hides
  // "Move it" / "Say it back" / "Write one for them" outright. A root tile
  // answers the topic itself, not another reason, so these three (which are all
  // about a reason's relationship to what it is under) read as non-sequiturs
  // there and were confusing playtesters. Live play is untouched: it never
  // reaches this branch, since canStartLaterMove is already false for
  // board.mode === "live". A non-root tile, including level 1's scripted
  // card-throw target A3 (parent "A1"), is unaffected.
  const hideOnGymRoot = board.mode === "gym" && tile.parentId === null;
  // What the level has taught by this beat (components/gym/taught-moves.ts).
  // Null off the ladder, which withholds nothing.
  const taught = useTaughtMoves();
  const moveOffered =
    onMove !== undefined &&
    !tile.removed &&
    !hideOnGymRoot &&
    canStartLaterMove(board, "tile_relocation", taught);
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
      {/* The two corners of the opened card (Steve, 2026-09-05,
          BRAIN-T260905-64). Upper left takes the reason off the board, upper
          right sends it somewhere else, and the middle of the card is the
          reason itself. They sit above everything rather than inside the menu
          because they are not asks: neither one waits on the other player, and
          both stay reachable while a form below is open.

          Remove shows only on a reason of your own that is the last one in its
          thread. Move it shows on any reason, yours or theirs, because where a
          reason hangs is a claim about what answers what and either player may
          be the one who spots that it is hanging in the wrong place. */}
      {onBoard && !editing && (mine || moveOffered) && (
        <div className="flex items-start justify-between gap-2">
          {mine && isTerminal ? (
            <span className="flex flex-col gap-1">
              <button
                type="button"
                className="text-p-sm text-gray self-start underline disabled:opacity-30"
                disabled={pending || !removeBlocked.ok}
                title={!removeBlocked.ok ? removeBlocked.error : undefined}
                onClick={runRemove}
              >
                {removeArmed ? "Remove it" : "Remove"}
              </button>
              {/* The warning the old menu row carried as its hint. Nothing in
                  the game puts a reason back, so the second press keeps its
                  sentence even though the corner is otherwise a bare word. */}
              {removeArmed && (
                <span className="text-p-sm text-gray">
                  Click again and it comes off the board. There is no putting it back.
                </span>
              )}
            </span>
          ) : (
            <span aria-hidden="true" />
          )}
          {moveOffered && (
            <button
              type="button"
              aria-label="Move it"
              title={
                moveVerdict.ok
                  ? "Move it: then click the empty spot it should hang in."
                  : moveVerdict.error
              }
              className="text-gray hover:text-neutral-black disabled:opacity-30"
              disabled={pending || !moveVerdict.ok}
              onClick={onMove}
            >
              <MoveGlyph className="size-5" />
            </button>
          )}
        </div>
      )}
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
                className={`flex flex-col gap-2 ${
                  proposing !== null || handOpen || awaitingMyAnswer ? "hidden" : ""
                }`}
              >
                {/* Steve, 2026-09-05, ruling on the tile card
                    (BRAIN-T260905-64): Edit is the pencil on the tile itself
                    (see LiveBoard's renderTile), and Remove and Move it are
                    the two corners above. What is left here is the three asks
                    that put a question to the other player and wait for an
                    answer, all of them Gym level 5+ and hidden for now by
                    canStartLaterMove (BRAIN-T260903-06). */}
                {!hideOnGymRoot &&
                  readingVerdict &&
                  canStartLaterMove(board, "reading_handback", taught) && (
                    <ActionItem
                      label="Say it back"
                      hint="Write what you think they meant. They tell you whether you have it."
                      verdict={readingVerdict}
                      disabled={pending || proposing !== null}
                      onClick={() => setProposing("reading")}
                    />
                  )}
                {!hideOnGymRoot && canStartLaterMove(board, "steelman_tile", taught) && (
                  <ActionItem
                    label="Write one for them"
                    hint="Put their point better than they did, and offer it as their reason."
                    verdict={steelmanVerdict}
                    disabled={pending || proposing !== null}
                    onClick={() => setProposing("steelman")}
                  />
                )}
                {!hideOnGymRoot && canStartLaterMove(board, "definition", taught) && (
                  <ActionItem
                    label="Pin down a word"
                    hint="Ask what one word in here is doing, and agree on what it means."
                    verdict={definitionVerdict}
                    disabled={pending || proposing !== null}
                    onClick={() => setProposing("definition")}
                  />
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
                {mine && !scriptOwnsText && (
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
                {/* Anyone may move any reason: where it hangs is a claim about
                    what answers what, and either player may be the one who
                    spots that it is hanging in the wrong place.
                    BRAIN-T260903-06: relocation is hidden in live play and
                    stays available only outside it (Gym level 2 needs it).
                    Picking the new spot happens out on the board, so this link
                    is offered only where a board is listening (`onMove`). */}
                {moveOffered && (
                  <button
                    type="button"
                    className="text-p-sm underline text-gray disabled:opacity-30"
                    disabled={pending || !moveVerdict.ok}
                    title={!moveVerdict.ok ? moveVerdict.error : undefined}
                    onClick={onMove}
                  >
                    move
                  </button>
                )}
                {/* The two cooperative moves, on the reason they are about.
                    Steve's call: none of these is writing in a tile, it is
                    writing in a little dialog beside one.
                    BRAIN-T260903-06: Gym level 5+, hidden for now. */}
                {readingVerdict &&
                  canStartLaterMove(board, "reading_handback", taught) && (
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
                {canStartLaterMove(board, "steelman_tile", taught) && (
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
                {canStartLaterMove(board, "definition", taught) && (
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
            moveOffered ? moveVerdict : null,
          ]}
        />
      )}

      {!mine &&
        tile.side !== me.role &&
        !tile.removed &&
        // The hand is another way to act on this reason, so it goes away with
        // the rest of them while one of the forms is open.
        !(onBoard && (proposing !== null || awaitingMyAnswer)) && (
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
  const taught = useTaughtMoves();

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
  // Steve, 2026-09-06, from his level 1 playthrough: "I'm only halfway through
  // the level with Bob and I'm allowed to propose a side-eye on the left
  // thread that shouldn't be available to me right now because it doesn't make
  // any sense." A token the ladder has not reached yet is not offered, and
  // when it has reached none of them there is nothing here to show at all: no
  // picker, and no "You: no token" line explaining a mechanic that has not
  // been introduced. Level 1 teaches 👍 at `player-token-a` and 👀 at
  // `player-token-b`, so the row arrives in two pieces, each as its own beat
  // asks for it. Off the ladder `taught` is null and both are offered, which
  // is live play and free play unchanged.
  const offeredTokens = RESOLUTION_TOKENS.filter((token) => taughtToken(taught, token));
  if (offeredTokens.length === 0 && !myToken) return null;

  const tokenVerdicts = offeredTokens.map((token) =>
    canPlaceResolutionToken(board, thread.rootId, token),
  );

  const disabledTokens = offeredTokens.filter((_, index) => !tokenVerdicts[index].ok);

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
          tokens={offeredTokens}
          disabledTokens={disabledTokens}
          theirs={otherToken}
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
 * 2.5s it takes to start feeling slow.
 *
 * A click or focus in the box is a read action: it jumps straight to the
 * finished text, the same as letting it finish on its own, and either way
 * the textarea then selects the whole line so a player who wants to edit
 * can just start typing over it. Actually typing while the sample is still
 * revealing itself is a write action instead: it stops the reveal in place
 * and leaves the text exactly as that keystroke produced it, never jumping
 * to the full sample first. See `stopTyping` vs `finishTyping` below.
 *
 * The reveal itself is elapsed-time based, not counted one tick at a time
 * (Steve, 2026-09-05 playtest: a background tab's timers get clamped by the
 * browser to roughly 1Hz, and a fixed one-char-per-tick loop then takes as
 * long as the sample has characters, which is exactly the 60+ second stall
 * on Place that was seen). Same fix as the boss's own typing in
 * `components/gym/director.tsx` (commit 427bc9b): `shown` is worked out from
 * how much real time has elapsed since the reveal started, so a single
 * clamped tick catches straight up instead of costing one full tick's worth
 * of delay per character, and a React Strict Mode remount starts a fresh,
 * correct timeline rather than resuming a stale one.
 *
 * `sample` is only ever read at mount. `InTileComposer` is remounted (see
 * its `key` at the call site) whenever the slot it belongs to changes, so
 * there is no case where the text this hook is typing needs to change out
 * from under it mid-animation.
 */
const SAMPLE_TYPE_MIN_MS = 25;
const SAMPLE_TYPE_MAX_MS = 35;

function useTypedSample(sample: string): {
  text: string;
  setText: (value: string) => void;
  typing: boolean;
  finishTyping: () => void;
  stopTyping: () => void;
  /** Bumps once each time the reveal finishes, on its own or via a click. */
  finishedAt: number;
} {
  const [reduced] = useState(reducedMotionPreferred);
  const [text, setText] = useState(reduced ? sample : "");
  const [typing, setTyping] = useState(!reduced && sample.length > 0);
  const [finishedAt, setFinishedAt] = useState(0);
  const stoppedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!typing) return;
    stoppedRef.current = false;
    const avgMsPerChar = (SAMPLE_TYPE_MIN_MS + SAMPLE_TYPE_MAX_MS) / 2;
    const startedAt = performance.now();
    const nextDelay = () =>
      SAMPLE_TYPE_MIN_MS + Math.random() * (SAMPLE_TYPE_MAX_MS - SAMPLE_TYPE_MIN_MS);
    const tick = () => {
      if (stoppedRef.current) return;
      const elapsed = performance.now() - startedAt;
      const shown = Math.min(sample.length, Math.floor(elapsed / avgMsPerChar) + 1);
      setText(sample.slice(0, shown));
      if (shown >= sample.length) {
        timerRef.current = null;
        setTyping(false);
        setFinishedAt(Date.now());
        return;
      }
      timerRef.current = setTimeout(tick, nextDelay());
    };
    timerRef.current = setTimeout(tick, nextDelay());
    return () => {
      stoppedRef.current = true;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
    // sample is fixed for the life of this hook; see the doc comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typing]);

  const finishTyping = () => {
    if (!typing) return;
    stoppedRef.current = true;
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
    setTyping(false);
    setText(sample);
    setFinishedAt(Date.now());
  };

  // Called the instant the player's own keystroke lands while the sample is
  // still revealing: stop the reveal where it is and leave `text` exactly as
  // that keystroke's onChange already produced it. Unlike finishTyping, this
  // never writes `sample` into `text` and never counts as "finished" (no
  // select-all follows it), because the player did not ask to see the rest.
  const stopTyping = () => {
    if (!typing) return;
    stoppedRef.current = true;
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
    setTyping(false);
  };

  return { text, setText, typing, finishTyping, stopTyping, finishedAt };
}

function InTileComposer({
  gameId,
  board,
  side,
  parentTileId,
  parentSide,
  initialText = "",
  locked = false,
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
  /**
   * Steve, 2026-09-05: a cooked level's draft is the script's suggestion and
   * nothing else. The textarea stops taking keystrokes once the sample has
   * finished typing itself in; Place and Cancel are the only moves left.
   */
  locked?: boolean;
  /** Which diagonal of the parent this box occupies, recorded on the tile. */
  corner: TileCorner;
  onDone: () => void;
}) {
  const { text, setText, typing, finishTyping, stopTyping, finishedAt } =
    useTypedSample(initialText);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const verdict = canPlaceTile(board, text, parentTileId);

  // Runs after the sample finishes, whether it ran out on its own or a click
  // or arrow key jumped it there: select the whole line so a player who
  // wants to keep it can leave it, and a player who wants their own words
  // can just start typing over the selection in one motion. `finishedAt` is
  // 0 until the first finish, so the mount render is a no-op here.
  useEffect(() => {
    if (finishedAt === 0) return;
    textareaRef.current?.select();
  }, [finishedAt]);

  /**
   * The box is exactly as tall as what is in it, so it never scrolls.
   *
   * A textarea with a fixed `rows` scrolls the moment the text needs one more
   * line than it was given, and it was given three: the coach's own level 1
   * sample is sixty characters, which wraps to three lines and overflows by
   * two pixels, so a scrollbar appeared inside the octagon on the very first
   * tile a new player ever writes (Steve, 2026-09-06: "there is a scroll bar
   * on tile, that shouldn't be needed"). Raising `rows` would only move the
   * threshold; measuring removes it. TILE_MAX_CHARS is 100, which is about
   * five lines at this width, and the octagon holds that with room to spare.
   *
   * Layout effect, not a plain one: the sample types itself in a character at
   * a time, and a height applied after paint would show one frame of the old
   * height on every tick.
   */
  useLayoutEffect(() => {
    const box = textareaRef.current;
    if (!box) return;
    // Collapse first: scrollHeight of an already-tall box is its own height,
    // so without this the box could only ever grow.
    box.style.height = "auto";
    box.style.height = `${box.scrollHeight}px`;
  }, [text]);
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
    if (!verdict.ok) return;
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
            ref={textareaRef}
            className="mt-1 block w-full resize-none bg-transparent text-center leading-snug outline-none"
            style={{ fontSize: `${TILE_BODY_PX}px` }}
            rows={3}
            value={text}
            maxLength={TILE_MAX_CHARS}
            disabled={pending}
            readOnly={locked}
            aria-readonly={locked}
            placeholder="A reason for your side."
            onChange={(event) => {
              // Cooked mode: the sample is the reason, and Place is the only
              // move. `readOnly` already stops the browser from firing this
              // for a real keystroke; this guard is only for a locked box
              // remounting with a shorter `initialText`, which would
              // otherwise read as an edit that never happened.
              if (locked) return;
              // The player's own keystroke just landed; it wins outright.
              // Stop the reveal where it is rather than letting the next
              // tick overwrite what they just produced, and never jump to
              // the full sample first (that would replace their words with
              // the coach's, which is the bug this fixes).
              if (typing) stopTyping();
              setText(event.target.value);
            }}
            // A click or focus is a read action, not a write: it may finish
            // the sample, but it never touches what the player has typed.
            onClick={() => {
              if (typing) finishTyping();
            }}
            onFocus={() => {
              if (typing) finishTyping();
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onDone();
                return;
              }
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
                return;
              }
              // A navigation key while the sample is still revealing is a
              // read action too, the same as a click: finish the line so
              // the player can move the caret through it and edit, rather
              // than typing over half of it.
              if (
                typing &&
                (event.key === "ArrowLeft" ||
                  event.key === "ArrowRight" ||
                  event.key === "ArrowUp" ||
                  event.key === "ArrowDown" ||
                  event.key === "Home" ||
                  event.key === "End")
              ) {
                finishTyping();
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
            disabled={pending || !verdict.ok}
            title={!verdict.ok ? verdict.error : "Place it (or press Return)"}
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
        {/* Live count against the same limit the Place button's own verdict
            enforces (`canPlaceTile`, `TILE_MAX_CHARS`), so a player closing in
            on the limit sees it coming rather than discovering it only when
            typing just stops working. */}
        <span
          className={`bg-offwhite rounded-full px-3 py-1 text-xs shadow-md ${
            text.length >= TILE_MAX_CHARS
              ? "text-red-600"
              : "text-neutral-black opacity-60"
          }`}
        >
          {text.length} / {TILE_MAX_CHARS}
        </span>
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

/** One person's seat on the board: their face, their side, and their name.
 *
 *  Steve, 2026-09-07. Both players are drawn the same way now, and the corner
 *  a badge sits in is decided by side, never by who is reading: Minus hangs
 *  top left and Plus top right, matching the colour that side's tiles carry on
 *  the board. Before this, your own side was a bare 36px octagon in the top
 *  left cluster and the opponent was a 48px face in the right rail, so the two
 *  people in the game were drawn at two sizes in two idioms in two places.
 *
 *  The face is the badge and the side octagon is a corner mark on it, the way
 *  Steve ruled on 2026-09-05. Both are three times the area they were, because
 *  at 48px "they're barely noticeable right now".
 */
function SeatBadge({
  seat,
  align,
}: {
  seat: { side: Side; emoji?: string; name: string; you: boolean };
  align: "left" | "right";
}) {
  const colour = seat.side === "plus" ? "var(--color-green)" : "var(--color-orange)";
  return (
    <div
      className={`pointer-events-none fixed top-20 z-30 flex max-w-[16rem] items-center gap-3 ${
        align === "left" ? "left-8 flex-row" : "right-8 flex-row-reverse"
      }`}
    >
      {/* The emoji hugs the outer edge on both sides, so the two faces sit at
          the far corners of the screen and the names read inward. */}
      <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
        {seat.emoji ? (
          <span
            aria-hidden="true"
            className="border-ink bg-offwhite flex h-20 w-20 items-center justify-center rounded-full border-2 text-5xl leading-none shadow-md"
          >
            {seat.emoji}
          </span>
        ) : (
          <SideAvatar side={seat.side} className="h-20 w-20" />
        )}
        {seat.emoji ? (
          <span className="absolute -right-1 -bottom-1">
            <SideAvatar side={seat.side} className="h-10 w-10" />
          </span>
        ) : null}
      </div>
      <div className={`flex flex-col ${align === "left" ? "items-start" : "items-end"}`}>
        <h3
          className="font-primary text-p-md tracking-wide uppercase"
          style={{
            color: colour,
            textShadow:
              "-3px -3px 0 var(--color-offwhite), 3px -3px 0 var(--color-offwhite), -3px 3px 0 var(--color-offwhite), 3px 3px 0 var(--color-offwhite)",
          }}
        >
          {seat.name}
        </h3>
        {seat.you ? (
          <span className="font-label text-ink-soft text-[10px] font-bold tracking-widest uppercase">
            You
          </span>
        ) : null}
      </div>
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
  onOpen,
  onAgree,
}: {
  thread: BoardThread | null;
  me: { playerId: string; role: Side };
  /** Opens this thread's root tile card. Only the pending badge uses this; a
   *  settled thread has nothing left to do. */
  onOpen?: () => void;
  /**
   * Matches the token they put down, closing the thread, without opening
   * anything first. Passed only when that is legal right now, so when it is
   * absent the badge falls back to opening the card.
   *
   * Steve, 2026-09-06, from his level 1 playthrough: "there should not be a
   * modal after this, remove that. you either click the thumb to agree, or
   * give it a little X". Clicking the token used to open the tile's card and
   * ask the same question again with a picker in it, which is a dialog
   * between the player and a decision they had already made. The other half
   * of his note, the X that retracts a token, is BRAIN-T260906-08: until that
   * is settled, taking a token back is still "take back your token" inside
   * the card, which is what the badge opens while you are the one waiting.
   */
  onAgree?: () => void;
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
      ? onAgree
        ? `They suggested: ${tokenLabel(token)}. Click it to agree and close the thread.`
        : `They suggested: ${tokenLabel(token)}. Click the reason to say whether you agree.`
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
        data-token-badge={thread.rootId}
        style={{ left: "50%", bottom: 0 }}
        className="border-gray/40 absolute z-30 flex -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-2xl border-2 bg-white p-1.5 shadow-md"
        title={words}
      >
        <TokenGlyph token={settled} size={56} />
        <span className="sr-only">{words}</span>
      </span>
    );
  }

  // Unlike the settled stamp, a pending token is unfinished business: it is
  // your move (or theirs) to close the thread, and clicking it opens the
  // same tile card the reason itself opens, which is where the picker to
  // close it lives. The overlay row that draws this badge is
  // `pointer-events-none` (spatial-board.tsx), so the button opts itself
  // back in.
  return (
    <button
      type="button"
      // The gym's `{ token }` beat anchor points its arrow here rather than at
      // the tile this hangs off (lib/gym/script.ts).
      data-token-badge={thread.rootId}
      onClick={onAgree ?? onOpen}
      style={{ left: "50%", bottom: 0 }}
      className={`pointer-events-auto absolute z-20 flex -translate-x-1/2 translate-y-1/2 animate-pulse cursor-pointer flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-dashed p-1.5 shadow-md ${
        yours ? "border-gold bg-sand" : "border-gray/40 bg-offwhite opacity-70"
      }`}
      title={words}
    >
      <TokenGlyph token={token} size={64} />
      <span className="font-secondary text-p-sm text-neutral-black">
        {yours ? (onAgree ? "Click to agree" : "Your move") : "Waiting on them"}
      </span>
      <span className="sr-only">{words}</span>
    </button>
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
  myEmoji,
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

  // The minimap wants the corner each thread's root actually sits on, read
  // off the same layout the board itself draws from, not dealt out in
  // thread order: the 2026-09-04 playtest found level 1's two threads (both
  // hung off the bottom corners) lighting the top two on the stamp instead,
  // "which are not even available", because the old code picked a corner by
  // side rather than by where the tile really landed. See the `corner` note
  // in ways-to-win-card.tsx.
  const miniLayout = useMemo(
    () =>
      topicRootedLayout(
        allTargets(board).map((t) => ({
          id: t.id,
          parentId: t.parentId,
          side: t.side ?? null,
          // Same inputs the board itself lays out from (SpatialBoard), corner
          // included: the minimap reads a thread's corner off this layout, so
          // dropping the field here would let the stamp light a different
          // quadrant than the board draws.
          corner: t.corner ?? null,
        })),
      ),
    [board],
  );
  // Moved above `miniThreads` (was declared after it, further down this
  // function): the mini icons' `onOpen` (BRAIN-T260905, "ways to win icons
  // are inert") opens a tile the same way `ThreadTokenBadge` does, and a
  // `const` declared later in the same render is not visible yet when
  // `useMemo` calls its function body immediately.
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  // Which tile the on-tile pencil was clicked on, if it was: read exactly
  // once, by TileNode's lazy initializer, the moment its card mounts (see
  // `startEditing` on TileNode). State rather than a ref, because the value
  // that seeds `startEditing` is read during render (React's rules disallow
  // reading a ref's current value there). Every other way a tile card opens
  // or closes clears it in its own click handler below (not an effect --
  // setting state synchronously inside one just to mirror another piece of
  // state is the cascading-render pattern React's lint now flags), so it is
  // never stale by the time a later, ordinary click reads it again.
  const [pencilEditTileId, setPencilEditTileId] = useState<string | null>(null);
  const miniThreads = useMemo<MiniThread[]>(
    () =>
      threads.map((thread) => {
        const topicPos = miniLayout.positions.get(TOPIC_CELL_ID);
        const rootPos = miniLayout.positions.get(thread.rootId);
        const corner: MiniCorner | null =
          topicPos && rootPos
            ? CORNER_TO_MINI[
                cornerFromOffset(rootPos.x - topicPos.x, rootPos.y - topicPos.y)
              ]
            : null;
        const mine = thread.pending[me.role];
        const theirs = thread.pending[OTHER_SIDE[me.role]];
        const pending: MiniThread["pending"] =
          thread.resolution === null && mine !== null && theirs === null
            ? { emoji: mine, mine: true }
            : thread.resolution === null && theirs !== null && mine === null
              ? { emoji: theirs, mine: false }
              : null;
        return {
          tileId: thread.rootId,
          side: thread.root?.side ?? thread.orphans[0]?.side ?? "plus",
          parentEdge: null,
          corner,
          resolved: thread.resolution !== null,
          token: thread.resolution?.emoji ?? null,
          pending,
          // Same pattern as `ThreadTokenBadge`'s `onOpen` below: opens the
          // same tile card the reason itself opens. Only when the root has
          // actually landed (`thread.root`, not just `thread.rootId`, which
          // survives even for an orphaned thread whose root is gone): a mini
          // icon for a thread with nothing to open stays inert on purpose.
          onOpen: thread.root
            ? () => {
                setPencilEditTileId(null);
                setSelectedTileId(thread.rootId);
              }
            : undefined,
        };
      }),
    [threads, miniLayout, me.role],
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
  const mySeatPlayer = board.players.find((player) => player.id === me.playerId) ?? null;
  // Steve, 2026-09-07: the two seat badges are placed by side, not by who is
  // reading. Minus hangs top left and Plus top right, so the badge is always
  // on the same side of the screen as that player's colour is on the board,
  // whichever seat you happen to be sitting in.
  const seatOf = (side: Side) =>
    side === me.role
      ? {
          side,
          emoji: myEmoji,
          name: mySeatPlayer?.displayName ?? SIDE_LABEL[side],
          you: true,
        }
      : {
          side,
          emoji: opponentEmoji,
          name: opponent?.displayName ?? SIDE_LABEL[side],
          you: false,
        };
  const minusSeat = seatOf("minus");
  const plusSeat = seatOf("plus");

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
  const pointedTileId = usePointedTile();
  const bossDraft = useBossDraft();
  // Board chrome level 1 keeps off screen until the Director's script says
  // otherwise (components/gym/hidden-surfaces.ts). Empty in a live game.
  const hiddenSurfaces = useHiddenSurfaces();
  // What the level has taught by this beat (components/gym/taught-moves.ts).
  // Null in a live game, which withholds nothing.
  const taught = useTaughtMoves();
  // How tightly a cooked level narrows placement down to one choice
  // (components/gym/cooked-placement.ts). Unrestricted in a live game.
  const cookedPlacement = useCookedPlacement();
  // Throwing a card is arm-then-target: pick the card in the tray, then click
  // the reason it answers. While a card is armed a click on a tile plays it
  // instead of opening that tile's actions, so the two never fire at once.
  const [armedCardId, setArmedCardId] = useState<string | null>(null);
  const [throwError, setThrowError] = useState<string | null>(null);
  const [throwPending, startThrow] = useTransition();
  // Moving a reason is the same two clicks as throwing a card (Steve,
  // 2026-09-05, BRAIN-T260905-64): Move it on the tile's card arms the board,
  // then the empty spot clicked is where the reason goes. Nobody is asked
  // first. The difference from a card throw is what the second click lands on:
  // a card wants an existing reason, a move wants an empty one.
  const [movingTileId, setMovingTileId] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [movePending, startMove] = useTransition();
  // Matching a token the other side put down, straight off the badge on the
  // board. Steve, 2026-09-06: "you either click the thumb to agree". The card
  // that used to open first asked the same question the badge had already
  // asked, with the answer sitting in a picker behind one more click.
  //
  // Only ever the token already on the thread: this closes an agreement, it
  // never opens one. Choosing a token nobody has proposed yet is still the
  // picker's job, inside the tile's own card.
  const [, startAgree] = useTransition();
  const agreeToToken = useCallback(
    (threadRootId: string, emoji: string) => {
      startAgree(async () => {
        const result = await placeResolutionToken(gameId, { threadRootId, emoji });
        // The badge only offers this click when the rules already say yes, so
        // a refusal here means the board moved under the player between the
        // render and the click. Open the thread's card, which is where the
        // refusal is written out in words.
        if (!result.ok) {
          setPencilEditTileId(null);
          setSelectedTileId(threadRootId);
        }
      });
    },
    [gameId],
  );
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
  const movingTile = useMemo(
    () => allTargets(board).find((tile) => tile.id === movingTileId) ?? null,
    [board, movingTileId],
  );
  // While a reason is in the air the empty spots answer a different question.
  // Not "may a new reason go here" but "may this one", and the rule that
  // answers it is the relocation rule, the same one the server will run.
  // TOPIC_CELL_ID is not a tile: clicking it means the reason heads its own
  // thread, so the parent is null and the thread root is the reason itself.
  const canMoveUnder = useCallback(
    (parentId: string) => {
      if (!movingTile) return false;
      const parent =
        parentId === TOPIC_CELL_ID
          ? null
          : (allTargets(board).find((tile) => tile.id === parentId) ?? null);
      if (parentId !== TOPIC_CELL_ID && !parent) return false;
      return canProposeRelocation(
        board,
        movingTile.id,
        parent ? parent.id : null,
        parent ? parent.threadRootId : movingTile.id,
      ).ok;
    },
    [board, movingTile],
  );

  // Puts the reason back down where it was and takes the board out of pick
  // mode. Every exit from the move goes through here, including the one the
  // move itself takes when it lands, so the Gym coach (moving-tile.ts) never
  // hears about a move that is over.
  const cancelMove = useCallback(() => {
    setMovingTileId(null);
    setMoveError(null);
    publishMovingTile(null);
  }, []);

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
        // While a reason is in the air the empty spots are still the thing to
        // click, but they are answering the relocation rule instead of the
        // placement rule, and they wear the moving reason's side rather than
        // yours: a move changes where a reason sits, not whose it is.
        placementEnabled={
          movingTile ? true : placementEnabled && !topicEditing && !topicPending
        }
        canPlaceOn={movingTile ? canMoveUnder : canPlaceUnder}
        placeSide={movingTile ? movingTile.side : me.role}
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
        // The coach persona pill (`CoachPersona`, components/gym/director.tsx)
        // is `top-4` plus its own padded height, and is the one piece of coach
        // furniture with a fixed, knowable position: its speech bubble already
        // tracks the target it is talking about, so only this strip needs
        // reserving. A live game runs no coach and passes 0.
        reserveTop={board.mode === "gym" ? 5 : 0}
        draftAt={draft?.pos ?? null}
        // The open composer wears the slot's own coordinates, so the coach's
        // bubble keeps pointing at the cell after the click that opened it.
        draftSlot={draft ? { parentId: draft.parentId, corner: draft.corner } : null}
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
              locked={cookedPlacement.lockedText}
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
        pointedTileId={pointedTileId}
        bossDraft={bossDraft}
        placement={cookedPlacement}
        onPlace={(parentId, pos, sample, corner) => {
          // An empty spot means two different things depending on whether a
          // reason is in the air. With one in the air it is the destination,
          // and the move is written on this click; there is no box to type in,
          // because the words already exist.
          if (movingTile) {
            const parent =
              parentId === TOPIC_CELL_ID
                ? null
                : (allTargets(board).find((tile) => tile.id === parentId) ?? null);
            if (parentId !== TOPIC_CELL_ID && !parent) {
              setMoveError("That spot is not on the board any more.");
              return;
            }
            const tileId = movingTile.id;
            const newParentTileId = parent ? parent.id : null;
            const newThreadRootId = parent ? parent.threadRootId : tileId;
            const verdict = canProposeRelocation(
              board,
              tileId,
              newParentTileId,
              newThreadRootId,
            );
            if (!verdict.ok) {
              setMoveError(verdict.error);
              return;
            }
            setMoveError(null);
            startMove(async () => {
              const result: ActionResult = await relocateTile(gameId, {
                tileId,
                newParentTileId,
                newThreadRootId,
                // A move changes where a reason sits, not whose reason it is.
                newSide: movingTile.side,
              });
              if (!result.ok) setMoveError(result.error);
              else cancelMove();
            });
            return;
          }
          setPencilEditTileId(null);
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
          // A reason in the air is looking for a place to land, and an
          // existing reason is not one. Say so rather than quietly opening
          // that tile's card and losing the move the player was halfway
          // through.
          if (movingTile) {
            setMoveError(
              tileId === movingTile.id
                ? "That is the reason you are moving. Click the empty spot it should go to."
                : "Click an empty spot, not a reason.",
            );
            return;
          }
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
          setPencilEditTileId(null);
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
        renderTile={(tile) => {
          const mine = tile.placedBy === me.playerId;
          const editVerdict = mine
            ? canEditTile(board, tile.id, me.playerId, tile.text)
            : null;
          return (
            <div className="relative size-full">
              <TileShape
                side={tile.side}
                size={OUTER_FRAME_REM}
                // Steve, 2026-09-05: the topic tile and the root reason tiles
                // are special, so they wear the thick border.
                weight={
                  tile.isOpeningReason || tile.parentId === null ? "root" : "normal"
                }
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
              <TileProposalBadge board={board} tileId={tile.id} me={me} />
              {/* Steve, 2026-09-05, ruling on the tile card: edit becomes "a
                standard pencil icon on top of the tile", shown only on your
                own tiles and only when the card's own edit rule would allow
                it (same canEditTile verdict the card checks, not a second
                rule). Opposite corner from TileProposalBadge, which already
                takes CORNER_INSET's top-left. Clicking it opens the same card
                a tile click opens, already in edit mode, via pencilEditRef:
                one edit entry point (TileNode's setEditing), reached from
                either the tile or (still, for now) the card that opens under
                it.

                Steve, 2026-09-07: and not at all on a scripted Gym level,
                where the words belong to the script. Same flag the card's own
                edit and remove links read. */}
              {mine && editVerdict?.ok && !cookedPlacement.lockedText && (
                <button
                  type="button"
                  aria-label="Edit this reason"
                  title="Edit this reason"
                  // Matches TileProposalBadge's corner vocabulary (the board's
                  // own neutral-black/offwhite, not the account flow's
                  // ink/card tokens -- see the note on --color-ink in
                  // globals.css), mirrored to the opposite corner and centred
                  // on the inset point the same way that badge is.
                  className="border-gray/30 bg-offwhite text-neutral-black absolute z-20 flex size-7 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border p-1.5 shadow-sm transition-transform hover:-translate-y-1 active:translate-y-0"
                  style={{ right: CORNER_INSET, top: CORNER_INSET }}
                  onClick={(event) => {
                    event.stopPropagation();
                    setPencilEditTileId(tile.id);
                    setSelectedTileId(tile.id);
                  }}
                >
                  <PencilGlyph className="size-full" />
                </button>
              )}
            </div>
          );
        }}
        // A settled thread says so on the reason it started from, on the
        // bottom edge, the same edge TileThrowBadges uses above. Half
        // strength while only one side has laid a token down, because a
        // thread with one token on it is a question, not an answer. Drawn
        // through renderOverlay rather than inside renderTile: the badge is
        // meant to hang half off the tile's own bottom edge (matching the
        // onboarding video), and the tile wrapper above is clipped to the
        // octagon for hit-testing, which would cut the hanging half away.
        renderOverlay={(tile) => {
          const thread = threadByRoot.get(tile.id) ?? null;
          // The one token the badge may place with a single click: the one
          // they proposed and you have not answered, and only while the rules
          // still allow you to match it. Anything else (no proposal, your own
          // token already down, a thread that cannot take one) leaves the
          // badge opening the card as before.
          const theirs = thread ? thread.pending[OTHER_SIDE[me.role]] : null;
          const matchable =
            thread &&
            !thread.resolution?.emoji &&
            theirs !== null &&
            thread.pending[me.role] === null &&
            canPlaceResolutionToken(board, thread.rootId, theirs).ok
              ? theirs
              : null;
          return (
            <ThreadTokenBadge
              thread={thread}
              me={me}
              onOpen={() => {
                setPencilEditTileId(null);
                setSelectedTileId(tile.id);
              }}
              onAgree={
                thread && matchable
                  ? () => agreeToToken(thread.rootId, matchable)
                  : undefined
              }
            />
          );
        }}
      />

      {/* The top strip, reordered by Steve on 2026-09-07.
          Row one is the game's own furniture: the way out, help beside it,
          then which room and which level. It sits at `top-4` so it runs level
          with the coach pill, which is `fixed top-4` and centred, and the
          three read as one line across the top of the screen.
          Row two, lower and clearly separate, is the two people playing. */}
      <div className="fixed top-4 left-8 z-30 flex h-10 items-center gap-4">
        <LeaveButton gameId={gameId} />
        {/* The How to play page is gone (Steve, 2026-09-03) and this is what
            replaced it on the board: a "?" that opens the same four-step
            overlay in place. A player who is stuck mid-argument will not
            leave the game to go and read a page, and the retired client's
            help was a corner button for the same reason.
            There used to be two of these, and they were not even the same
            button: this one opened a second private copy of the overlay,
            while the one in the top right rail drove the board's own
            onboarding state, the copy that opens by itself on a first live
            game and stays shut once it has been read. Steve, 2026-09-07: "we
            don't need two of those. Keep the help button only on the upper
            left to the right of leave game." So the survivor sits where he
            asked and is wired to the real overlay. */}
        <button
          type="button"
          title="Instructions"
          aria-label="Instructions"
          onClick={onboarding.show}
          className="border-gray/30 bg-offwhite text-neutral-black hover:bg-sand font-primary flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border text-lg font-bold shadow-md"
        >
          ?
        </button>
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

      {/* Row two: the two seats, Minus left and Plus right, on the same line
          as each other and lower than the furniture above them. These used to
          be a 36px octagon on the left saying which side you were and a 48px
          badge in the right rail saying who the other person was, which meant
          the two players were drawn at different sizes, in different places,
          in different ways. Steve, 2026-09-07: "those emojis need to be much
          bigger, like three times as big because they're barely noticeable
          right now." */}
      <SeatBadge seat={minusSeat} align="left" />
      <SeatBadge seat={plusSeat} align="right" />

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

      {/* Top right: the two ways this ends. Same 13rem column width as the
          retired client. It used to open with the opponent's name badge and a
          second help button; the badge moved up to the seat row so both
          players are drawn the same way, and the help button is gone because
          one is enough (Steve, 2026-09-07). The rail starts lower now to
          clear the seat row above it. */}
      <div className="fixed top-44 right-8 z-30 flex max-h-[calc(100vh-12rem)] w-[15rem] flex-col gap-3 overflow-y-auto pb-2">
        {/* One card, not two. "Ways to win" and a "How this ends" panel under
            it said the same two things in the same rail, one as a diagram and
            one as a paragraph, and Rannie draws a single card. The three lines
            the paragraph had that the diagram did not are now lines on the
            diagram's card. */}
        {/* Held back until the Director reveals it (level 1's script), a
            live game never hides this: `hiddenSurfaces` is always empty
            there. */}
        {hiddenSurfaces.includes("ways-to-win") ? null : (
          <WaysToWinCard
            threads={miniThreads}
            resolvedCount={resolvedCount}
            // BRAIN-T260903-06: proposing a topic revision is a Gym level 5+
            // move. The pencil already knows how to go quiet when this game's
            // rules do not allow a revision at all (`endsOnTopic`); reusing
            // that same "no hint, no handler" shape is how it stays quiet
            // while the move is held back from the live game too.
            onRevise={
              canStartLaterMove(board, "topic_revision", taught)
                ? () => setTopicEditing(true)
                : undefined
            }
            reviseHint={
              endsOnTopic && canStartLaterMove(board, "topic_revision", taught)
                ? "Write the version you would both sign."
                : null
            }
            ceilingNote={ceilingNote}
            showRevise={canStartLaterMove(board, "topic_revision", taught)}
            // BRAIN-T260903-06: the footer names the topic-revision ending as
            // something you can go do right now, so it is gated the same way
            // the pencil is, rather than describing a door the card itself has
            // just closed.
            footer={
              endsOnTopic && canStartLaterMove(board, "topic_revision", taught)
                ? "Either ending is a win, and it is the same win for both of you."
                : null
            }
          />
        )}

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
      {/* Held back until the Director reveals it (level 1's script), a live
          game never hides this: `hiddenSurfaces` is always empty there. */}
      {/* The tray stands down while a reason is in the air. Both surfaces want
          the next click, and a card armed mid-move would be two things waiting
          on one click. The move banner below takes the same spot. */}
      {hiddenSurfaces.includes("card-tray") || movingTile ? null : (
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
                setPencilEditTileId(null);
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
                  : // First-use nudge: shown until this player has thrown any
                    // card at all, then it steps aside for the refusal/arm
                    // hints above. A tester dragged a card onto a tile and
                    // nothing happened, because throwing one is click-then-
                    // click, not drag-and-drop, and nothing on the tray said so.
                    deck.length > 0 && Object.keys(cardCounts).length === 0
                    ? "Click a card, then click the reason it applies to."
                    : null)
            }
          />
        </div>
      )}

      {/* The board says out loud that it is holding a reason, because the
          board itself changed underneath the player: the empty spots are
          suddenly answering a different question and are wearing somebody
          else's colour. Same spot and same voice as the rule-card tray's hint,
          since it is the same gesture (Steve, 2026-09-05, BRAIN-T260905-64).
          A way out is always offered: nothing has been written yet, so cancel
          really does put it back. */}
      {movingTile && (
        <div
          className="fixed bottom-[calc(2rem+var(--dev-bar-h,0px))] left-8 z-40 flex flex-col items-center"
          style={{ right: "23rem" }}
        >
          <div className="border-gold bg-sand flex max-w-lg flex-col items-center gap-2 rounded-lg border-2 p-3 shadow-md">
            <span className="font-secondary text-p-sm text-neutral-black text-center">
              {moveError ??
                (movePending
                  ? "Moving it..."
                  : "Now click the empty spot this reason should hang in.")}
            </span>
            <button type="button" className={SECONDARY_BUTTON} onClick={cancelMove}>
              Leave it where it is
            </button>
          </div>
        </div>
      )}

      {/* Click a reason, act on that reason, right where it sits. The card
          follows its tile through pan and zoom, so the two never drift apart.
          What it holds is TileNode unchanged, the same edit / remove / ask to
          move / card-throw surface the thread list uses, so there is one
          implementation of a move and not two that can disagree. */}
      {selectedTile && (
        <AnchoredCard
          anchorSelector={`[data-tile-id="${cssEscape(selectedTile.id)}"]`}
          onClose={() => {
            setPencilEditTileId(null);
            setSelectedTileId(null);
          }}
          // The right rail is 15rem wide sitting 2rem in from the edge, and
          // the canvas runs underneath it, so a tile near the middle of the
          // board has "room to the right" that is actually Ways to win. One
          // rem of air on top of the rail's own footprint, so the card flips
          // to the tile's left instead of landing on the panel.
          reserveRight={18}
        >
          {/* Steve, 2026-09-05, ruling on the tile card: the popup no longer
              restates the tile's text at the top. The octagon is right there
              on the board, a few pixels away, reading the reason in its own
              hand and colour already; repeating it here was the header this
              card used to open with. See the on-tile pencil (LiveBoard's
              renderTile, and TileShape's wrapper below) for where "which
              reason is this" now lives instead: on the tile, not the card. */}
          <ul className="flex flex-col gap-2 pr-6">
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
              startEditing={pencilEditTileId === selectedTile.id}
              // Move it hands the reason to the board and closes this card,
              // the same way arming a rule card does: the next click belongs
              // to an empty spot out there, and a card sitting over the board
              // is in the way of it.
              onMove={() => {
                const tileId = selectedTile.id;
                setPencilEditTileId(null);
                setSelectedTileId(null);
                setArmedCardId(null);
                setDraft(null);
                setMoveError(null);
                setMovingTileId(tileId);
                // The Gym coach cannot read this off the log, because between
                // the two clicks nothing has been appended yet. See
                // components/gym/moving-tile.ts.
                publishMovingTile(tileId);
              }}
            />
          </ul>
          {/* Resolving belongs to the reason a thread started from, so it is
              offered on that tile and nowhere else. It used to live only in
              the folded thread drawer, which meant the game's first win
              condition was two clicks and a scroll away from the board it is
              played on. */}
          {threadByRoot.has(selectedTile.id) && (
            <div className="border-neutral-black/15 mt-3 flex flex-col gap-2 border-t pt-3">
              {/* An action heading, not a question. "Where do you two
                  disagree?" read as a prompt with no action attached to it;
                  the tokens below it are the action, so the heading now
                  names the thing pressing them does. */}
              <h4 className="font-primary text-p-md text-neutral-black">
                Close this thread
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
