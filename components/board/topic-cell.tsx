"use client";

/**
 * The topic tile as it behaves on the board: the centre cell you click to
 * propose a rewrite, and the cell the other player answers on.
 *
 * Ported from the retired client's `TopicTile.vue`, which is deliberately
 * NOT the anchored-popover pattern the emoji resolution and the AI coach box
 * use. Revising the topic edits the tile itself: the topic text is swapped
 * for a textarea in the same place inside the same octagon, and the buttons
 * sit at the tile's own bottom. Nothing floats. The one thing that does pop
 * up is the confirmation step, because proposing a rewrite is one of the two
 * ways the game ends and Steve asked (2026-07-13, quoted in TopicTile.vue:70)
 * for an explicit "this is what you are about to do" gate before it goes.
 *
 * Four states, matching the retired client one for one:
 *   idle      the topic, clickable if a rewrite is currently allowed
 *   editing   textarea in place of the text, Cancel / Propose under it
 *   waiting   you proposed; the words you sent, and who they are with
 *   answering they proposed; their words in gold, Reject / Accept under them
 *
 * Both proposal states carry a label saying whose proposal it is, and the
 * answering one also keeps the wording it would replace on screen. See
 * `TILE_EYEBROW` for why.
 *
 * A fifth thing is drawn beside the tile rather than in it: a note saying the
 * last rewrite was rejected, and why. That is not a state of the tile, which
 * has correctly gone back to showing the topic; see `lastRejectedTopicRevision`
 * for what was wrong without it.
 *
 * Two deliberate departures from the retired client, both noted for Steve:
 *   1. The proposer keeps seeing their own proposal. In the retired client
 *      `topicProposal` skips your own echo, so the proposer's tile snapped
 *      back to the old topic and a toast was the only trace. Our proposals
 *      live in the event log, so the tile can stay honest about what is out.
 *   2. Rejecting asks why. The retired topic flow never did, and an earlier
 *      draft of this file did not either. Steve overruled that on 2026-09-01:
 *      "Whenever you agree or disagree to something, you should have a chance
 *      to say why. That's great data to capture." The box is offered, not
 *      required, so a no still only costs one more click.
 *
 * Accepting does NOT yet ask why, and the asymmetry is not a design choice.
 * `ProposalAcceptedPayload` carries `proposal_id` and nothing else, while
 * `ProposalRejectedPayload` already carries `reason`, so the yes has nowhere
 * to put the words. Widening that payload is a core change under the repo's
 * own rule and is waiting on Steve (BRAIN-T260901-08). Do not add the box to
 * Accept before the field exists: it would throw the player's answer away.
 */

import { useEffect, useRef, useState, useTransition } from "react";

import { TILE_BODY_RATIO } from "@/components/board/geometry";
import { TOPIC_CELL_ID } from "@/components/board/layout";
import { TileShape } from "@/components/board/tile-shape";
import { AnchoredCard } from "@/components/ui/anchored-card";
import { TilePopover } from "@/components/ui/tile-popover";
import { canProposeTopicRevision } from "@/lib/board/rules";
import { canStartLaterMove } from "@/components/board/later-moves";
import { useTaughtMoves } from "@/components/gym/taught-moves";
import type { BoardProposal, BoardState } from "@/lib/board/project";
import type { Side } from "@/lib/events/types";
import {
  acceptProposal,
  proposeTopicRevision,
  rejectProposal,
} from "@/app/game/[gameId]/actions";

/** Small pill buttons sized for the inside of a tile, where a full
 * `.form-base` control would not fit between the octagon's cut corners. */
const TILE_BTN =
  "border-gray/50 bg-offwhite text-neutral-black rounded-full border px-3 py-0.5 text-xs font-semibold disabled:opacity-40";
const TILE_BTN_PRIMARY =
  "border-gold bg-gold/15 text-neutral-black rounded-full border px-3 py-0.5 text-xs font-semibold disabled:opacity-40";

/**
 * The line that says a proposal is a proposal.
 *
 * Without it the tile is a lie in both proposal states: the octagon is
 * watermarked TOPIC, it is the only neutral tile on the board, and it is
 * showing a sentence nobody has agreed to. Playing it through, the recipient
 * gets the new wording with Reject and Accept under it and no statement
 * anywhere that this is not already the topic. Gold text is the only signal,
 * and gold is a colour, not a sentence.
 */
const TILE_EYEBROW =
  "font-secondary text-gray text-[0.6rem] tracking-widest uppercase text-center";

/** The topic rewrite still waiting on an answer, if there is one. */
export function pendingTopicRevision(board: BoardState): BoardProposal | null {
  return (
    board.proposals.find(
      (proposal) => proposal.kind === "topic_revision" && proposal.status === "pending",
    ) ?? null
  );
}

/**
 * The most recently rejected topic rewrite, if one was the last thing to
 * happen to the topic.
 *
 * Without this the rejection is invisible. Playing it through: the proposer's
 * tile silently reverts to the old wording, with no toast, no note, and no
 * sign their rewrite was ever answered. They are left to work out from a tile
 * that changed back that somebody said no. Worse, the rejecter is asked for a
 * reason on Steve's own instruction, types one, and it goes into the event log
 * and nowhere else, which turns "you get a chance to say why" into a box that
 * eats what you wrote.
 *
 * Only the latest one, and only while nothing newer is pending: a rejection
 * from three rewrites ago is history, not news, and the tile is not a log.
 */
export function lastRejectedTopicRevision(board: BoardState): BoardProposal | null {
  let latest: BoardProposal | null = null;
  for (const proposal of board.proposals) {
    if (proposal.kind !== "topic_revision") continue;
    if (proposal.status === "pending") return null;
    if (proposal.status !== "rejected") continue;
    if (latest === null || (proposal.answeredAtSeq ?? 0) > (latest.answeredAtSeq ?? 0)) {
      latest = proposal;
    }
  }
  return latest;
}

function proposedText(proposal: BoardProposal): string {
  const content = proposal.content;
  return "text" in content ? content.text : "";
}

/**
 * The tile size the board draws its cells at. Passed in rather than fixed so
 * the cell cannot drift out of step with the reasons around it.
 */
export function TopicCell({
  gameId,
  board,
  me,
  size,
  editing,
  onEdit,
  onEditEnd,
}: {
  gameId: string;
  board: BoardState;
  me: { playerId: string; role: Side };
  size: number;
  /** Whether the editor is open. Owned by the board, so the board can also
   * open it from the Ways to win card's pencil. */
  editing: boolean;
  onEdit: () => void;
  onEditEnd: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState(false);
  /** The rejection is a two-step: press Reject, then say why (or do not) and
   * press it again. Held here rather than in the popover so pressing Reject
   * twice cannot send twice. */
  const [rejecting, setRejecting] = useState(false);
  const [why, setWhy] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** The `answeredAtSeq` of a rejection the player has read and closed. Kept
   *  as the sequence number rather than a boolean so a later rejection shows
   *  again instead of being swallowed by an earlier dismissal. */
  const [dismissedRejection, setDismissedRejection] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  // What the level has taught by this beat. Null in a live game, which
  // withholds nothing; topic revision is a level 5+ move either way today.
  const taught = useTaughtMoves();
  const anchorRef = useRef<HTMLDivElement>(null);

  const proposal = pendingTopicRevision(board);
  const rejected = lastRejectedTopicRevision(board);
  /**
   * The two sides need different things from a rejection, so they keep it for
   * different lengths of time.
   *
   * The proposer keeps it until they close it. This card is the only place the
   * reason exists: there is no history panel, and nothing else on the board
   * ever says a rewrite was answered. Letting it expire on a timer or on the
   * next tile would put us back where we started, with the reason captured and
   * shown to nobody.
   *
   * The rejecter wrote it, so they need confirmation and nothing more. Theirs
   * shows while the rejection is still the last thing that happened and then
   * gets out of the way, because a card that sits beside the topic for the
   * rest of the match telling you what you already did is furniture.
   */
  const showRejection =
    rejected !== null &&
    rejected.answeredAtSeq !== dismissedRejection &&
    (rejected.askedBy === me.role || rejected.answeredAtSeq === board.lastSeq);
  const mine = proposal !== null && proposal.askedBy === me.role;
  const verdict = canProposeTopicRevision(board, draft);
  // BRAIN-T260903-06: proposing a topic revision is a Gym level 5+ move,
  // held back from the live game for now. The rule itself
  // (canProposeTopicRevision) is untouched; this only decides whether the
  // tile offers itself as a way to start one right now.
  const canOpen =
    proposal === null &&
    canProposeTopicRevision(board, "a revised topic").ok &&
    canStartLaterMove(board, "topic_revision", taught);

  const close = () => {
    setDraft("");
    setConfirming(false);
    setError(null);
    onEditEnd();
  };

  const closeReject = () => {
    setRejecting(false);
    setWhy("");
  };

  // Escape is Cancel, same as the retired client's window listener: the
  // confirmation closes first if it is up, otherwise the editor does.
  useEffect(() => {
    if (!editing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (confirming) setConfirming(false);
      else close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, confirming]);

  const propose = () => {
    setError(null);
    setConfirming(false);
    startTransition(async () => {
      const result = await proposeTopicRevision(gameId, { text: draft });
      if (!result.ok) setError(result.error);
      else close();
    });
  };

  const accept = () => {
    if (!proposal) return;
    setError(null);
    startTransition(async () => {
      const result = await acceptProposal(gameId, { proposalId: proposal.id });
      if (!result.ok) setError(result.error);
    });
  };

  const reject = () => {
    if (!proposal) return;
    setError(null);
    const said = why.trim();
    startTransition(async () => {
      const result = await rejectProposal(gameId, {
        proposalId: proposal.id,
        reason: said.length > 0 ? said : null,
      });
      if (!result.ok) setError(result.error);
      else closeReject();
    });
  };

  const body = () => {
    if (proposal && !mine) {
      return (
        <>
          <p className={TILE_EYEBROW}>They want the topic to say</p>
          <p className="font-tiles text-p-sm text-gold mt-1 px-2 text-center">
            {proposedText(proposal)}
          </p>
          {/* The wording it would replace, kept on screen. Judging a rewrite
              means comparing it with what is there now, and the proposal has
              taken over the one tile that used to show that. Clamped rather
              than sized down further: two lines of the old topic is enough to
              recognise it, and the octagon has to hold the buttons too. */}
          {board.currentTopicText ? (
            <p className="font-secondary text-gray mt-1 line-clamp-2 px-3 text-center text-[0.65rem] italic">
              instead of &ldquo;{board.currentTopicText}&rdquo;
            </p>
          ) : null}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className={TILE_BTN}
              disabled={pending}
              onClick={() => setRejecting(true)}
            >
              Reject
            </button>
            <button
              type="button"
              className={TILE_BTN_PRIMARY}
              disabled={pending}
              onClick={accept}
            >
              Accept
            </button>
          </div>
        </>
      );
    }

    if (proposal && mine) {
      return (
        <>
          <p className={TILE_EYEBROW}>You proposed</p>
          <p className="font-tiles text-p-sm text-gold mt-1 px-2 text-center">
            {proposedText(proposal)}
          </p>
          <p className="text-gray mt-2 text-center text-xs">
            Sent. Waiting for them to answer.
          </p>
        </>
      );
    }

    if (editing) {
      return (
        <>
          <textarea
            autoFocus
            className="border-gray/40 bg-offwhite font-tiles text-p-sm w-[78%] resize-none border p-1 text-center"
            rows={4}
            maxLength={300}
            value={draft}
            placeholder={board.currentTopicText ?? "A statement both sides could sign."}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (verdict.ok) setConfirming(true);
              }
            }}
          />
          <div className="mt-2 flex gap-2">
            <button type="button" className={TILE_BTN} disabled={pending} onClick={close}>
              Cancel
            </button>
            <button
              type="button"
              className={TILE_BTN_PRIMARY}
              disabled={pending || !verdict.ok}
              title={verdict.ok ? undefined : verdict.error}
              onClick={() => setConfirming(true)}
            >
              Propose
            </button>
          </div>
        </>
      );
    }

    return (
      // Same size as the reasons around it, which is how Rannie draws the
      // centre tile. It is the sentence the whole board is arguing about; it
      // should not be the smallest thing on screen.
      <p
        className={`font-tiles px-2 text-center ${canOpen ? "group-hover:text-gold" : ""}`}
        style={{ fontSize: `${size * 16 * TILE_BODY_RATIO}px` }}
      >
        {board.currentTopicText ?? "No topic was set."}
      </p>
    );
  };

  return (
    <div ref={anchorRef} className="relative">
      <TileShape
        side="neutral"
        size={size}
        weight="root"
        watermark="TOPIC"
        selected={editing || proposal !== null}
      >
        {body()}
      </TileShape>

      {/* The whole tile is the affordance, the retired client's own
          `clickable` computed. It is a sibling overlay rather than a wrapper
          because once the editor is open the tile holds its own buttons, and
          a button inside a button is not a thing. */}
      {canOpen && !editing ? (
        <button
          type="button"
          className="absolute inset-0 z-20 cursor-pointer border-none bg-transparent p-0"
          title="Propose a revised topic"
          aria-label="Propose a revised topic"
          onClick={onEdit}
        />
      ) : null}

      {error ? (
        <p className="text-orange absolute -bottom-6 left-0 w-full text-center text-xs">
          {error}
        </p>
      ) : null}

      {/* What happened to the last rewrite, beside the tile rather than in it.
          The octagon has gone back to showing the topic, which is correct: the
          rewrite was refused, so the topic is what it was. But that revert is
          the ONLY thing either player currently sees, and a tile quietly
          changing back is not a message. This is the message, and it carries
          the reason the rejecter was asked for.

          It has to leave the tile's own subtree to be seen at all. The board
          cell around a tile is clipped to the octagon silhouette
          (`clip-path: polygon(...)`), so a note positioned under the tile is
          not merely behind something, it is cut away: painted nowhere, absent
          from `elementsFromPoint`, while `getBoundingClientRect` still reports
          a perfectly sensible box on screen. `AnchoredCard` portals to the
          body and follows the tile through pan and zoom, which is the same
          reason every other card on this board uses it. `reserveRight` keeps
          it off Ways to win the way the tile-action card does. */}
      {showRejection && rejected !== null ? (
        <AnchoredCard
          anchorSelector={`[data-tile-id="${TOPIC_CELL_ID}"]`}
          onClose={() => setDismissedRejection(rejected.answeredAtSeq)}
          width={20}
          reserveRight={18}
        >
          <p className={TILE_EYEBROW}>
            {rejected.askedBy === me.role
              ? "They turned down your wording"
              : "You turned down their wording"}
          </p>
          <p className="font-tiles text-p-sm mt-1 text-center line-through opacity-60">
            {proposedText(rejected)}
          </p>
          {/* An empty reason is not a bug: the box is optional on purpose, so
              a no still costs one click. Saying so beats leaving a gap that
              reads as something failing to load. */}
          <p className="font-secondary text-gray mt-1 text-center text-[0.7rem] italic">
            {rejected.reason
              ? `\u201c${rejected.reason}\u201d`
              : rejected.askedBy === me.role
                ? "They did not say why."
                : "You did not give a reason."}
          </p>
          {rejected.askedBy === me.role && canOpen ? (
            <div className="mt-2 flex justify-center">
              <button
                type="button"
                className={TILE_BTN}
                onClick={() => {
                  setDismissedRejection(rejected.answeredAtSeq);
                  onEdit();
                }}
              >
                Try another wording
              </button>
            </div>
          ) : null}
        </AnchoredCard>
      ) : null}

      <TilePopover
        open={confirming}
        onClose={() => setConfirming(false)}
        anchorRef={anchorRef}
        heading="Propose this topic?"
        subtitle="If they accept it, the game ends there and you both win."
        body={{ kind: "none" }}
        footnote={<span className="font-tiles text-p-sm">&ldquo;{draft}&rdquo;</span>}
        confirmLabel="PROPOSE IT"
        cancelLabel="BACK"
        onCancel={() => setConfirming(false)}
        onConfirm={propose}
        accent="neutral"
      />

      {/* Saying no to a rewrite is the one answer the other player cannot
          read anything into, so it gets a box for the reason. Optional:
          `minLength: 0` turns off the popover's own filled-in gate, and the
          action takes `null` for an empty one. */}
      <TilePopover
        open={rejecting}
        onClose={closeReject}
        anchorRef={anchorRef}
        heading="Not this wording?"
        subtitle="Tell them what is wrong with it, so their next try is closer."
        body={{
          kind: "text",
          fields: [
            {
              id: "why",
              placeholder: "Optional. What would you not sign?",
              ariaLabel: "Why you are rejecting this topic",
              minLength: 0,
              maxLength: 300,
              rows: 3,
              autoFocus: true,
            },
          ],
          value: { why },
          onChange: (next) => setWhy(next.why ?? ""),
        }}
        footnote={
          <span className="font-tiles text-p-sm">
            &ldquo;{proposal ? proposedText(proposal) : ""}&rdquo;
          </span>
        }
        confirmLabel="REJECT IT"
        cancelLabel="BACK"
        confirmDisabled={pending}
        onCancel={closeReject}
        onConfirm={reject}
        accent="neutral"
      />
    </div>
  );
}
