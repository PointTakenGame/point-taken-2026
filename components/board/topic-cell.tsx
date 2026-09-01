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
 * Two deliberate departures from the retired client, both noted for Steve:
 *   1. The proposer keeps seeing their own proposal. In the retired client
 *      `topicProposal` skips your own echo, so the proposer's tile snapped
 *      back to the old topic and a toast was the only trace. Our proposals
 *      live in the event log, so the tile can stay honest about what is out.
 *   2. Rejecting is a plain no. The engine accepts a reason string and the
 *      old proposals list offered one; the retired topic flow never did, and
 *      a tile is not the place to type an explanation.
 */

import { useEffect, useRef, useState, useTransition } from "react";

import { TileShape } from "@/components/board/tile-shape";
import { TilePopover } from "@/components/ui/tile-popover";
import { canProposeTopicRevision } from "@/lib/board/rules";
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

/** The topic rewrite still waiting on an answer, if there is one. */
export function pendingTopicRevision(board: BoardState): BoardProposal | null {
  return (
    board.proposals.find(
      (proposal) => proposal.kind === "topic_revision" && proposal.status === "pending",
    ) ?? null
  );
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
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const anchorRef = useRef<HTMLDivElement>(null);

  const proposal = pendingTopicRevision(board);
  const mine = proposal !== null && proposal.askedBy === me.role;
  const verdict = canProposeTopicRevision(board, draft);
  const canOpen =
    proposal === null && canProposeTopicRevision(board, "a revised topic").ok;

  const close = () => {
    setDraft("");
    setConfirming(false);
    setError(null);
    onEditEnd();
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

  const answer = (accept: boolean) => {
    if (!proposal) return;
    setError(null);
    startTransition(async () => {
      const result = accept
        ? await acceptProposal(gameId, { proposalId: proposal.id })
        : await rejectProposal(gameId, { proposalId: proposal.id, reason: null });
      if (!result.ok) setError(result.error);
    });
  };

  const body = () => {
    if (proposal && !mine) {
      return (
        <>
          <p className="font-tiles text-p-sm text-gold px-2 text-center">
            {proposedText(proposal)}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className={TILE_BTN}
              disabled={pending}
              onClick={() => answer(false)}
            >
              Reject
            </button>
            <button
              type="button"
              className={TILE_BTN_PRIMARY}
              disabled={pending}
              onClick={() => answer(true)}
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
          <p className="font-tiles text-p-sm text-gold px-2 text-center">
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
      <p
        className={`font-tiles text-p-sm px-2 text-center ${
          canOpen ? "group-hover:text-gold" : ""
        }`}
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
        watermark="topic"
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
    </div>
  );
}
