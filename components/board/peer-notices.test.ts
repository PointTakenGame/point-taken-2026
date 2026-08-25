/**
 * Tests for the peer-notice diff. The interesting claim in
 * `peer-notices.ts` is that you can tell who moved without the projection
 * recording an actor, so most of these are about attribution: the same
 * resolution has to read as "the other player did that" or as "that
 * worked" depending only on what the previous board looked like.
 *
 * `BoardState` is a large core-owned interface (`lib/board/project.ts`,
 * read-only for this task), so these build minimal boards with local
 * helpers and override only the fields under test.
 */

import { describe, expect, it } from "vitest";
import type {
  BoardProposal,
  BoardState,
  BoardThread,
  BoardTile,
} from "@/lib/board/project";
import type { ProposalKind, Side } from "@/lib/events/types";
import { diffSnapshots, snapshotBoard } from "./peer-notices";

function makeBoard(overrides: Partial<BoardState> = {}): BoardState {
  const generosity: Record<Side, number> = { plus: 0, minus: 0 };
  return {
    mode: null,
    levelId: null,
    bossId: null,
    status: "active",
    winCondition: null,
    topic: null,
    currentTopicText: null,
    players: [],
    threads: [],
    tiles: [],
    proposals: [],
    throws: [],
    coachReadings: [],
    nudges: [],
    skipped: [],
    settings: null,
    generosity,
    lastSeq: 0,
    ...overrides,
  };
}

function makeTile(id: string, text: string): BoardTile {
  return {
    id,
    text,
    side: "plus",
    parentId: null,
    threadRootId: id,
    placedBy: null,
    placedAtSeq: 1,
    isOpeningReason: true,
    edited: false,
    revised: false,
    removed: false,
    redacted: false,
    cardsThrown: 0,
    children: [],
  };
}

function makeThread(
  rootId: string,
  pending: Record<Side, string | null>,
  resolvedWith: string | null,
  text = "school lunches should be free",
): BoardThread {
  return {
    rootId,
    root: makeTile(rootId, text),
    orphans: [],
    tileCount: 1,
    pending,
    resolution: resolvedWith ? { emoji: resolvedWith, note: null, seq: 9 } : null,
  };
}

function makeProposal(
  id: string,
  kind: ProposalKind,
  askedBy: Side,
  status: "pending" | "accepted" | "rejected",
): BoardProposal {
  return {
    id,
    kind,
    content: { text: "some proposed wording" },
    targetTileId: null,
    targetThreadRootId: null,
    askedBy,
    askedByPlayer: null,
    askedAtSeq: 4,
    status,
    reason: null,
    answeredAtSeq: status === "pending" ? null : 5,
  };
}

/** Diffs two boards as the player on `me`'s side would see them. */
function noticesBetween(before: BoardState, after: BoardState, me: Side) {
  return diffSnapshots(snapshotBoard(before, me), snapshotBoard(after, me), me);
}

describe("peer notices: who closed the thread", () => {
  it("credits the other player when my token was already down", () => {
    const before = makeBoard({
      threads: [makeThread("t1", { plus: "👍", minus: null }, null)],
    });
    const after = makeBoard({
      threads: [makeThread("t1", { plus: "👍", minus: "👍" }, "👍")],
    });
    const notices = noticesBetween(before, after, "plus");
    expect(notices).toHaveLength(1);
    expect(notices[0].message).toContain("Other player resolved the thread");
    expect(notices[0].message).toContain("school lunches should be free");
    expect(notices[0].variant).toBe("info");
  });

  it("reads as my own move when their token was already down", () => {
    const before = makeBoard({
      threads: [makeThread("t1", { plus: null, minus: "👍" }, null)],
    });
    const after = makeBoard({
      threads: [makeThread("t1", { plus: "👍", minus: "👍" }, "👍")],
    });
    const notices = noticesBetween(before, after, "plus");
    expect(notices).toHaveLength(1);
    expect(notices[0].message).toBe("Token placed, thread resolved.");
    expect(notices[0].variant).toBe("success");
  });

  it("falls back to actor-free wording when neither token was down before", () => {
    const before = makeBoard({
      threads: [makeThread("t1", { plus: null, minus: null }, null)],
    });
    const after = makeBoard({
      threads: [makeThread("t1", { plus: "⚖️", minus: "⚖️" }, "⚖️")],
    });
    const notices = noticesBetween(before, after, "plus");
    expect(notices).toHaveLength(1);
    expect(notices[0].message).toContain("Thread resolved on");
    expect(notices[0].message).not.toContain("Other player");
  });

  it("says who took a token back when a resolved thread reopens", () => {
    const before = makeBoard({
      threads: [makeThread("t1", { plus: "👍", minus: "👍" }, "👍")],
    });
    const after = makeBoard({
      threads: [makeThread("t1", { plus: "👍", minus: null }, null)],
    });
    expect(noticesBetween(before, after, "plus")[0].message).toContain(
      "Other player took their token back",
    );
    expect(noticesBetween(before, after, "minus")[0].message).toBe(
      "Token removed, thread unresolved.",
    );
  });

  it("says nothing about a thread that did not change", () => {
    const board = makeBoard({
      threads: [makeThread("t1", { plus: "👍", minus: null }, null)],
    });
    expect(noticesBetween(board, board, "plus")).toEqual([]);
  });

  it("says nothing about a thread that was not there before", () => {
    const before = makeBoard({ threads: [] });
    const after = makeBoard({
      threads: [makeThread("t1", { plus: "👍", minus: "👍" }, "👍")],
    });
    expect(noticesBetween(before, after, "plus")).toEqual([]);
  });

  it("ignores a thread with no tiles on it", () => {
    const empty: BoardThread = {
      rootId: "t1",
      root: null,
      orphans: [],
      tileCount: 0,
      pending: { plus: null, minus: null },
      resolution: { emoji: "👍", note: null, seq: 9 },
    };
    const before = makeBoard({
      threads: [{ ...empty, resolution: null }],
    });
    const after = makeBoard({ threads: [empty] });
    expect(noticesBetween(before, after, "plus")).toEqual([]);
  });
});

describe("peer notices: proposals", () => {
  it("announces a proposal the other side just made", () => {
    const before = makeBoard({ proposals: [] });
    const after = makeBoard({
      proposals: [makeProposal("p1", "definition", "minus", "pending")],
    });
    const notices = noticesBetween(before, after, "plus");
    expect(notices).toHaveLength(1);
    expect(notices[0].message).toBe("The other player proposed pinning down a word.");
  });

  it("stays quiet about a proposal I made myself", () => {
    const before = makeBoard({ proposals: [] });
    const after = makeBoard({
      proposals: [makeProposal("p1", "definition", "plus", "pending")],
    });
    expect(noticesBetween(before, after, "plus")).toEqual([]);
  });

  it("reports an answer to a proposal I asked for", () => {
    const before = makeBoard({
      proposals: [makeProposal("p1", "topic_revision", "plus", "pending")],
    });
    const accepted = makeBoard({
      proposals: [makeProposal("p1", "topic_revision", "plus", "accepted")],
    });
    const rejected = makeBoard({
      proposals: [makeProposal("p1", "topic_revision", "plus", "rejected")],
    });

    const yes = noticesBetween(before, accepted, "plus");
    expect(yes[0].message).toBe("The other player accepted your rewritten topic.");
    expect(yes[0].variant).toBe("success");

    const no = noticesBetween(before, rejected, "plus");
    expect(no[0].message).toBe("The other player turned down your rewritten topic.");
    expect(no[0].variant).toBe("info");
  });

  it("stays quiet when I answer a proposal the other side asked for", () => {
    const before = makeBoard({
      proposals: [makeProposal("p1", "topic_revision", "minus", "pending")],
    });
    const after = makeBoard({
      proposals: [makeProposal("p1", "topic_revision", "minus", "accepted")],
    });
    expect(noticesBetween(before, after, "plus")).toEqual([]);
  });

  it("has wording for every proposal kind", () => {
    const kinds: ProposalKind[] = [
      "topic_revision",
      "tile_relocation",
      "reading_handback",
      "steelman_reading",
      "steelman_tile",
      "definition",
    ];
    for (const kind of kinds) {
      const made = noticesBetween(
        makeBoard({ proposals: [] }),
        makeBoard({ proposals: [makeProposal("p1", kind, "minus", "pending")] }),
        "plus",
      );
      expect(made[0].message.length).toBeGreaterThan(0);
      expect(made[0].message).not.toContain("undefined");

      const answered = noticesBetween(
        makeBoard({ proposals: [makeProposal("p2", kind, "plus", "pending")] }),
        makeBoard({ proposals: [makeProposal("p2", kind, "plus", "accepted")] }),
        "plus",
      );
      expect(answered[0].message).not.toContain("undefined");
    }
  });
});

describe("peer notices: the other player leaving", () => {
  function withPeer(left: "disconnect" | "quit" | null): BoardState {
    return makeBoard({
      players: [
        { id: "a", displayName: "Me", role: "plus", signed: null, left: null },
        { id: "b", displayName: "Them", role: "minus", signed: null, left },
      ],
    });
  }

  it("reports a disconnect and a deliberate exit differently", () => {
    expect(
      noticesBetween(withPeer(null), withPeer("disconnect"), "plus")[0].message,
    ).toBe("The other player disconnected.");
    expect(noticesBetween(withPeer(null), withPeer("quit"), "plus")[0].message).toBe(
      "The other player left the game.",
    );
  });

  it("says nothing when it is my own seat that left", () => {
    expect(noticesBetween(withPeer(null), withPeer("quit"), "minus")).toEqual([]);
  });
});

describe("peer notices: long thread text", () => {
  it("shortens a long root into an excerpt", () => {
    const long = "a".repeat(200);
    const before = makeBoard({
      threads: [makeThread("t1", { plus: "👍", minus: null }, null, long)],
    });
    const after = makeBoard({
      threads: [makeThread("t1", { plus: "👍", minus: "👍" }, "👍", long)],
    });
    const message = noticesBetween(before, after, "plus")[0].message;
    expect(message.length).toBeLessThan(120);
    expect(message).toContain("…");
  });
});
