"use client";

/**
 * Telling you what the other player just did.
 *
 * The retired client raised these over its socket: it received an event,
 * read who sent it, and toasted. This app has no client-side event reader
 * and deliberately should not grow one. `components/board/use-game-feed.ts`
 * hears that *something* landed and asks the server to re-project; the
 * board that comes back is the only client-side description of the game,
 * and one projection on the server is the point.
 *
 * So a peer notice here is a difference between two successive server
 * projections, not a reading of an event payload. Everything below works
 * off `BoardState` alone. That keeps the whole feature in the presentation
 * lane: no event type is named here, and nothing breaks if the event
 * vocabulary changes shape underneath it.
 *
 * Who moved is recovered rather than transmitted, because the projection
 * does not record an actor on a resolution. A thread closes when both
 * sides show the same token, so whoever had *already* shown it is not the
 * one who just moved. That reading is exact whenever the previous
 * projection is known, and falls back to actor-free wording when it is not.
 */

import { useEffect, useRef } from "react";
import { alertActions } from "@/components/alerts/alert-store";
import type { BoardState } from "@/lib/board/project";
import { liveThreads } from "@/lib/board/project";
import { OTHER_SIDE } from "@/lib/board/rules";
import type { ProposalKind, Side } from "@/lib/events/types";

export type PeerNotice = { message: string; variant: "info" | "success" };

type ThreadSnapshot = {
  label: string;
  resolvedWith: string | null;
  pending: Record<Side, string | null>;
};

type ProposalSnapshot = {
  kind: ProposalKind;
  askedBy: Side | null;
  status: "pending" | "accepted" | "rejected";
};

export type BoardSnapshot = {
  threads: Map<string, ThreadSnapshot>;
  proposals: Map<string, ProposalSnapshot>;
  peerLeft: "disconnect" | "quit" | null;
};

/** What the other player is proposing, said in this game's own words. */
const PROPOSAL_MADE: Record<ProposalKind, string> = {
  topic_revision: "The other player proposed a rewriting of the topic.",
  tile_relocation: "The other player proposed moving one of the reasons.",
  reading_handback: "The other player said one of your reasons back to you.",
  steelman_reading: "The other player offered to say your whole side for you.",
  steelman_tile: "The other player offered you a reason for your own side.",
  definition: "The other player proposed pinning down a word.",
};

/** The same six, as a noun that fits after "accepted your" or "turned down your". */
const PROPOSAL_NOUN: Record<ProposalKind, string> = {
  topic_revision: "rewritten topic",
  tile_relocation: "move",
  reading_handback: "reading back",
  steelman_reading: "reading of their side",
  steelman_tile: "offered reason",
  definition: "definition",
};

const EXCERPT_LIMIT = 44;

function excerpt(text: string | null | undefined): string {
  if (!text) return "an untitled thread";
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length <= EXCERPT_LIMIT
    ? `"${clean}"`
    : `"${clean.slice(0, EXCERPT_LIMIT - 1)}…"`;
}

export function snapshotBoard(board: BoardState, me: Side): BoardSnapshot {
  const threads = new Map<string, ThreadSnapshot>();
  for (const thread of liveThreads(board)) {
    threads.set(thread.rootId, {
      label: excerpt(thread.root?.text ?? thread.orphans[0]?.text ?? null),
      resolvedWith: thread.resolution?.emoji ?? null,
      pending: { plus: thread.pending.plus, minus: thread.pending.minus },
    });
  }

  const proposals = new Map<string, ProposalSnapshot>();
  for (const proposal of board.proposals) {
    proposals.set(proposal.id, {
      kind: proposal.kind,
      askedBy: proposal.askedBy,
      status: proposal.status,
    });
  }

  // Looks the peer up by side rather than by "the other element", because
  // a seat can be empty mid-game and there is no guarantee of exactly two
  // rows here.
  const peer = board.players.find((player) => player.role === OTHER_SIDE[me]);

  return { threads, proposals, peerLeft: peer?.left ?? null };
}

/**
 * The differences worth interrupting somebody over.
 *
 * Deliberately quiet about anything you did yourself that the page already
 * shows you: a tile you placed appears on the board, and saying so in a
 * toast as well is the duplication this codebase's own notes warn about.
 * What is here is what happened while you were looking somewhere else.
 */
export function diffSnapshots(
  prev: BoardSnapshot,
  next: BoardSnapshot,
  me: Side,
): PeerNotice[] {
  const peer = OTHER_SIDE[me];
  const notices: PeerNotice[] = [];

  for (const [rootId, now] of next.threads) {
    const before = prev.threads.get(rootId);
    if (!before) continue;

    if (before.resolvedWith === null && now.resolvedWith !== null) {
      // Whoever had already shown this token is not the one who just moved.
      if (before.pending[me] === now.resolvedWith) {
        notices.push({
          message: `Other player resolved the thread on ${now.label}`,
          variant: "info",
        });
      } else if (before.pending[peer] === now.resolvedWith) {
        notices.push({ message: "Token placed, thread resolved.", variant: "success" });
      } else {
        notices.push({
          message: `Thread resolved on ${now.label}`,
          variant: "success",
        });
      }
      continue;
    }

    if (before.resolvedWith !== null && now.resolvedWith === null) {
      // The side no longer showing the token is the one who took it back.
      const peerTookItBack = now.pending[peer] !== before.resolvedWith;
      notices.push({
        message: peerTookItBack
          ? "Other player took their token back, thread unresolved."
          : "Token removed, thread unresolved.",
        variant: "info",
      });
    }
  }

  for (const [id, now] of next.proposals) {
    const before = prev.proposals.get(id);

    if (!before) {
      if (now.askedBy === peer && now.status === "pending") {
        notices.push({ message: PROPOSAL_MADE[now.kind], variant: "info" });
      }
      continue;
    }

    if (before.status === "pending" && now.status !== "pending" && now.askedBy === me) {
      notices.push(
        now.status === "accepted"
          ? {
              message: `The other player accepted your ${PROPOSAL_NOUN[now.kind]}.`,
              variant: "success",
            }
          : {
              message: `The other player turned down your ${PROPOSAL_NOUN[now.kind]}.`,
              variant: "info",
            },
      );
    }
  }

  if (prev.peerLeft === null && next.peerLeft !== null) {
    notices.push({
      message:
        next.peerLeft === "disconnect"
          ? "The other player disconnected."
          : "The other player left the game.",
      variant: "info",
    });
  }

  return notices;
}

/**
 * Raises a toast for each difference between this projection and the last
 * one this browser saw. Silent on first render: arriving at a board in
 * progress is not news about anything that just happened.
 */
export function usePeerNotices(board: BoardState, me: Side): void {
  const previous = useRef<BoardSnapshot | null>(null);

  useEffect(() => {
    const next = snapshotBoard(board, me);
    const prev = previous.current;
    previous.current = next;
    if (!prev) return;
    for (const notice of diffSnapshots(prev, next, me)) {
      alertActions[notice.variant](notice.message);
    }
  }, [board, me]);
}
