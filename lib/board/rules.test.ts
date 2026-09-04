import { describe, expect, it } from "vitest";
import { projectBoard } from "./project";
import {
  agreedToken,
  boardIsOpen,
  canAnswerProposal,
  canEditTile,
  canPlaceResolutionToken,
  canPlaceTile,
  canProposeDefinition,
  canProposeReadingHandback,
  canProposeRelocation,
  canProposeSteelmanReading,
  canProposeSteelmanTile,
  canProposeTopicRevision,
  canDeclineThrow,
  canRemoveTile,
  canReviseTile,
  canThrowCard,
  cardsInPlay,
  DECLINE_REASON_MAX_CHARS,
  DEFINITION_TERM_MAX_CHARS,
  inRootStage,
  isAbandoned,
  isResolved,
  LIVE_ROOT_TARGET,
  MAX_THREADS,
  proposalsAwaiting,
  proposalsFrom,
  READING_MAX_CHARS,
  threadsWinReached,
  TILE_MAX_CHARS,
  topicAgreementEndsGame,
} from "./rules";
import type { AnyGameEvent, EventPayloads, GameEventType } from "@/lib/events/types";

const GAME = "00000000-0000-4000-8000-000000000000";
const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";

/**
 * Numbers seqs the way the database does, and infers actor_role from which
 * of the two fixture players acted, since rules.ts branches on real sides.
 */
function log() {
  const events: AnyGameEvent[] = [];
  const push = <T extends GameEventType>(
    type: T,
    payload: EventPayloads[T],
    actorId: string | null = null,
  ) => {
    const actor_role = actorId === BOB ? "minus" : "plus";
    events.push({
      id: `e${events.length + 1}`,
      game_id: GAME,
      seq: events.length + 1,
      type,
      schema_version: 1,
      actor_role,
      source: "human",
      actor_id: actorId,
      payload,
      created_at: "2026-08-22T00:00:00Z",
    } as AnyGameEvent);
    return events.length;
  };
  return { events, push };
}

/** Created, both players seated, topic set, started. */
function opened() {
  const l = log();
  l.push("game_created", {
    mode: "live",
    level_id: null,
    boss_id: null,
    join_code: "PTKN22",
  });
  l.push("player_joined", { display_name: "Brisk Copper Otter" }, ALICE);
  l.push("player_joined", { display_name: "Quiet Amber Fjord" }, BOB);
  l.push("role_selected", { role: "plus" }, ALICE);
  l.push("role_selected", { role: "minus" }, BOB);
  l.push("topic_set", {
    text: "Cities should cap rents.",
    origin: "library",
    topic_id: "rent-cap",
  });
  l.push("game_started", {
    card_set: { policy: "intersection", card_ids: [], raised_by: null },
    coach: null,
  });
  return l;
}

const tile = (
  id: string,
  parent: string | null,
  root: string,
  text: string,
  side: "plus" | "minus" = "plus",
) => ({ tile_id: id, parent_tile_id: parent, thread_root_id: root, side, text });

/** A resolved thread rooted at rootId, four of which reach the win floor. */
function pushResolvedThread(l: ReturnType<typeof log>, rootId: string) {
  l.push("tile_placed", tile(rootId, null, rootId, `Root ${rootId}.`), ALICE);
  l.push("thread_resolved", { thread_root_id: rootId, emoji: "👍", note: null }, ALICE);
}

/**
 * Active board with an open root, a removed child, and a resolved thread.
 *
 * Four roots, because the root stage refuses a child until the board has its
 * opening roots down and this fixture exists to test everything else about
 * placement. The root stage itself has its own describe block below.
 */
function boardForPlacement() {
  const l = opened();
  l.push("tile_placed", tile("root", null, "root", "Root."), ALICE);
  l.push("tile_placed", tile("spare1", null, "spare1", "Third root.", "minus"), BOB);
  l.push("tile_placed", tile("spare2", null, "spare2", "Fourth root."), ALICE);
  l.push("tile_placed", tile("removed", "root", "root", "Gone.", "minus"), BOB);
  l.push("tile_removed", { tile_id: "removed" }, BOB);
  l.push(
    "tile_placed",
    tile("resolvedRoot", null, "resolvedRoot", "Other root.", "minus"),
    BOB,
  );
  l.push(
    "thread_resolved",
    { thread_root_id: "resolvedRoot", emoji: "👍", note: null },
    ALICE,
  );
  return projectBoard(l.events);
}

function boardForRelocation() {
  const l = opened();
  l.push("tile_placed", tile("root", null, "root", "Root."), ALICE);
  l.push("tile_placed", tile("child", "root", "root", "Child.", "minus"), BOB);
  l.push("tile_placed", tile("grandchild", "child", "root", "Grandchild."), ALICE);
  l.push("tile_placed", tile("root2", null, "root2", "Other root.", "minus"), BOB);
  return projectBoard(l.events);
}

function boardWithProposal(status: "pending" | "accepted" = "pending") {
  const l = opened();
  l.push(
    "proposal_made",
    {
      proposal_id: "p1",
      kind: "topic_revision",
      target_tile_id: null,
      target_thread_root_id: null,
      content: { text: "Revised topic." },
    },
    ALICE,
  );
  if (status === "accepted") l.push("proposal_accepted", { proposal_id: "p1" }, BOB);
  return projectBoard(l.events);
}

describe("agreedToken", () => {
  it("is null when only one side has placed", () => {
    const l = opened();
    l.push("tile_placed", tile("t1", null, "t1", "Root."), ALICE);
    l.push("resolution_emoji_placed", { thread_root_id: "t1", emoji: "👍" }, ALICE);
    const thread = projectBoard(l.events).threads[0];
    expect(agreedToken(thread)).toBeNull();
  });

  it("is null when the two sides placed different tokens", () => {
    const l = opened();
    l.push("tile_placed", tile("t1", null, "t1", "Root."), ALICE);
    l.push("resolution_emoji_placed", { thread_root_id: "t1", emoji: "👍" }, ALICE);
    l.push("resolution_emoji_placed", { thread_root_id: "t1", emoji: "👀" }, BOB);
    const thread = projectBoard(l.events).threads[0];
    expect(agreedToken(thread)).toBeNull();
  });

  it("is the token when both sides placed the same one", () => {
    const l = opened();
    l.push("tile_placed", tile("t1", null, "t1", "Root."), ALICE);
    l.push("resolution_emoji_placed", { thread_root_id: "t1", emoji: "👍" }, ALICE);
    l.push("resolution_emoji_placed", { thread_root_id: "t1", emoji: "👍" }, BOB);
    const thread = projectBoard(l.events).threads[0];
    expect(agreedToken(thread)).toBe("👍");
  });
});

describe("isResolved", () => {
  it("is false before a resolution and true after", () => {
    const l = opened();
    l.push("tile_placed", tile("t1", null, "t1", "Root."), ALICE);
    expect(isResolved(projectBoard(l.events).threads[0])).toBe(false);
    l.push("thread_resolved", { thread_root_id: "t1", emoji: "👍", note: null }, ALICE);
    expect(isResolved(projectBoard(l.events).threads[0])).toBe(true);
  });
});

describe("threadsWinReached", () => {
  it("is false on a board nobody has argued on yet", () => {
    expect(threadsWinReached(projectBoard(opened().events))).toBe(false);
  });

  it("is false when one thread of several is unresolved", () => {
    const l = opened();
    for (let i = 1; i <= 3; i++) pushResolvedThread(l, `t${i}`);
    l.push("tile_placed", tile("t4", null, "t4", "Unresolved root."), ALICE);
    expect(threadsWinReached(projectBoard(l.events))).toBe(false);
  });

  it("is true when every thread on the board is resolved, however few", () => {
    const l = opened();
    pushResolvedThread(l, "t1");
    expect(threadsWinReached(projectBoard(l.events))).toBe(true);
  });

  it("is true when every thread on a wider board is resolved", () => {
    const l = opened();
    for (let i = 1; i <= 4; i++) pushResolvedThread(l, `t${i}`);
    expect(threadsWinReached(projectBoard(l.events))).toBe(true);
  });

  it("does not count a thread whose tiles were all removed", () => {
    const l = opened();
    for (let i = 1; i <= 4; i++) pushResolvedThread(l, `t${i}`);
    l.push("tile_placed", tile("empty", null, "empty", "Removed root."), BOB);
    l.push("tile_removed", { tile_id: "empty" }, BOB);
    expect(threadsWinReached(projectBoard(l.events))).toBe(true);
  });
});

describe("proposalsAwaiting / proposalsFrom", () => {
  it("has a pending proposal await the other side", () => {
    const board = boardWithProposal();
    expect(proposalsAwaiting(board, "minus").map((p) => p.id)).toEqual(["p1"]);
    expect(proposalsAwaiting(board, "plus")).toEqual([]);
    expect(proposalsFrom(board, "plus").map((p) => p.id)).toEqual(["p1"]);
    expect(proposalsFrom(board, "minus")).toEqual([]);
  });

  it("has an answered proposal await nobody", () => {
    const board = boardWithProposal("accepted");
    expect(proposalsAwaiting(board, "minus")).toEqual([]);
    expect(proposalsAwaiting(board, "plus")).toEqual([]);
    expect(proposalsFrom(board, "plus")).toEqual([]);
  });
});

describe("boardIsOpen", () => {
  it("refuses a lobby board", () => {
    expect(boardIsOpen(projectBoard([])).ok).toBe(false);
  });

  it("refuses an ended board", () => {
    const l = opened();
    l.push("game_ended", { win_condition: "abandoned" });
    expect(boardIsOpen(projectBoard(l.events)).ok).toBe(false);
  });

  it("allows an active board", () => {
    expect(boardIsOpen(projectBoard(opened().events))).toEqual({ ok: true });
  });
});

describe("canPlaceTile", () => {
  it("refuses empty or whitespace text", () => {
    const board = boardForPlacement();
    expect(canPlaceTile(board, "", null).ok).toBe(false);
    expect(canPlaceTile(board, "   ", null).ok).toBe(false);
  });

  it("allows exactly TILE_MAX_CHARS and refuses one over", () => {
    const board = boardForPlacement();
    expect(canPlaceTile(board, "a".repeat(TILE_MAX_CHARS), null)).toEqual({ ok: true });
    expect(canPlaceTile(board, "a".repeat(TILE_MAX_CHARS + 1), null).ok).toBe(false);
  });

  it("refuses an unknown parent", () => {
    const board = boardForPlacement();
    expect(canPlaceTile(board, "New reason.", "nope").ok).toBe(false);
  });

  it("refuses a removed parent", () => {
    const board = boardForPlacement();
    expect(canPlaceTile(board, "New reason.", "removed").ok).toBe(false);
  });

  it("refuses a parent whose thread is already resolved", () => {
    const board = boardForPlacement();
    expect(canPlaceTile(board, "New reason.", "resolvedRoot").ok).toBe(false);
  });

  it("allows a reason on an open thread", () => {
    const board = boardForPlacement();
    expect(canPlaceTile(board, "New reason.", "root")).toEqual({ ok: true });
  });
});

/**
 * The root stage: nothing hangs off another reason until the board has its
 * opening roots down. The number comes off game_started, so these build the
 * log directly rather than going through the shared fixtures.
 */
describe("the root stage", () => {
  function boardWithRoots(count: number, rootTarget?: number) {
    const l = log();
    l.push("game_created", {
      mode: "live",
      level_id: null,
      boss_id: null,
      join_code: "PTKN22",
    });
    l.push("player_joined", { display_name: "Brisk Copper Otter" }, ALICE);
    l.push("player_joined", { display_name: "Quiet Amber Fjord" }, BOB);
    l.push("role_selected", { role: "plus" }, ALICE);
    l.push("role_selected", { role: "minus" }, BOB);
    l.push("topic_set", {
      text: "Cities should cap rents.",
      origin: "library",
      topic_id: "rent-cap",
    });
    l.push("game_started", {
      card_set: { policy: "intersection", card_ids: [], raised_by: null },
      coach: null,
      ...(rootTarget === undefined ? {} : { root_target: rootTarget }),
    });
    for (let i = 0; i < count; i += 1) {
      const id = `r${i}`;
      l.push("tile_placed", tile(id, null, id, `Root ${i}.`, i % 2 ? "minus" : "plus"));
    }
    return projectBoard(l.events);
  }

  it("defaults to the live target when the payload predates the field", () => {
    expect(boardWithRoots(0).settings?.rootTarget).toBe(LIVE_ROOT_TARGET);
  });

  it("refuses a child while roots are still missing", () => {
    const verdict = canPlaceTile(boardWithRoots(2), "But no.", "r0");
    expect(verdict.ok).toBe(false);
    expect(verdict.ok ? "" : verdict.error).toMatch(/2 more reasons/);
  });

  it("says it in the singular when one root is missing", () => {
    const verdict = canPlaceTile(boardWithRoots(3), "But no.", "r0");
    expect(verdict.ok ? "" : verdict.error).toMatch(/^One more reason/);
  });

  it("never blocks a root, which is how the stage is left", () => {
    expect(canPlaceTile(boardWithRoots(1), "Another reason.", null)).toEqual({
      ok: true,
    });
  });

  it("allows a child once the roots are down", () => {
    expect(canPlaceTile(boardWithRoots(4), "But no.", "r0")).toEqual({ ok: true });
  });

  it("takes the target off the game, so gym level 1 opens after two", () => {
    const board = boardWithRoots(2, 2);
    expect(board.settings?.rootTarget).toBe(2);
    expect(canPlaceTile(board, "But no.", "r0")).toEqual({ ok: true });
  });

  it("reports the stage the same way the composer asks it", () => {
    expect(inRootStage(boardWithRoots(3))).toBe(true);
    expect(inRootStage(boardWithRoots(4))).toBe(false);
    expect(inRootStage(boardWithRoots(2, 2))).toBe(false);
  });
});

describe("canEditTile", () => {
  it("only lets the author edit", () => {
    const board = boardForPlacement();
    expect(canEditTile(board, "root", BOB, "Changed.").ok).toBe(false);
    expect(canEditTile(board, "root", ALICE, "Changed.")).toEqual({ ok: true });
  });

  it("refuses a removed tile", () => {
    const board = boardForPlacement();
    expect(canEditTile(board, "removed", BOB, "Changed.").ok).toBe(false);
  });

  it("applies the same length rules as placement", () => {
    const board = boardForPlacement();
    expect(canEditTile(board, "root", ALICE, "   ").ok).toBe(false);
    expect(canEditTile(board, "root", ALICE, "a".repeat(TILE_MAX_CHARS))).toEqual({
      ok: true,
    });
    expect(canEditTile(board, "root", ALICE, "a".repeat(TILE_MAX_CHARS + 1)).ok).toBe(
      false,
    );
  });
});

describe("canRemoveTile", () => {
  it("only lets the author remove", () => {
    const board = boardForPlacement();
    expect(canRemoveTile(board, "root", BOB).ok).toBe(false);
    expect(canRemoveTile(board, "root", ALICE)).toEqual({ ok: true });
  });

  it("refuses an already-removed tile", () => {
    const board = boardForPlacement();
    expect(canRemoveTile(board, "removed", BOB).ok).toBe(false);
  });
});

describe("canPlaceResolutionToken", () => {
  it("refuses a non-token string", () => {
    const board = boardForPlacement();
    expect(canPlaceResolutionToken(board, "root", "🧭").ok).toBe(false);
  });

  it("refuses an unknown thread", () => {
    const board = boardForPlacement();
    expect(canPlaceResolutionToken(board, "nope", "👍").ok).toBe(false);
  });

  it("refuses an already-resolved thread", () => {
    const board = boardForPlacement();
    expect(canPlaceResolutionToken(board, "resolvedRoot", "👍").ok).toBe(false);
  });

  it("allows a valid token on an open thread", () => {
    const board = boardForPlacement();
    expect(canPlaceResolutionToken(board, "root", "👍")).toEqual({ ok: true });
  });
});

describe("canAnswerProposal", () => {
  it("refuses answering your own proposal", () => {
    const board = boardWithProposal();
    expect(canAnswerProposal(board, "p1", "plus").ok).toBe(false);
  });

  it("refuses an already-answered proposal", () => {
    const board = boardWithProposal("accepted");
    expect(canAnswerProposal(board, "p1", "minus").ok).toBe(false);
  });

  it("allows the other side to answer", () => {
    const board = boardWithProposal();
    expect(canAnswerProposal(board, "p1", "minus")).toEqual({ ok: true });
  });
});

describe("canProposeRelocation", () => {
  it("refuses a tile hanging from itself", () => {
    const board = boardForRelocation();
    expect(canProposeRelocation(board, "child", "child", "root").ok).toBe(false);
  });

  it("refuses moving a tile underneath its own descendant", () => {
    const board = boardForRelocation();
    expect(canProposeRelocation(board, "child", "grandchild", "root").ok).toBe(false);
  });

  it("refuses a null new parent whose newThreadRootId is not the tile itself", () => {
    const board = boardForRelocation();
    expect(canProposeRelocation(board, "child", null, "root").ok).toBe(false);
  });

  it("allows a legitimate move", () => {
    const board = boardForRelocation();
    expect(canProposeRelocation(board, "child", "root2", "root2")).toEqual({ ok: true });
  });
});

describe("canProposeTopicRevision", () => {
  it("refuses empty text", () => {
    const board = projectBoard(opened().events);
    expect(canProposeTopicRevision(board, "   ").ok).toBe(false);
  });

  it("refuses text identical to the current topic", () => {
    const board = projectBoard(opened().events);
    expect(canProposeTopicRevision(board, "Cities should cap rents.").ok).toBe(false);
  });

  it("allows a genuinely different topic", () => {
    const board = projectBoard(opened().events);
    expect(canProposeTopicRevision(board, "Cities should cap rent increases.")).toEqual({
      ok: true,
    });
  });
});

/**
 * The four asks that are only words.
 *
 * Each of these can be refused for a reason of its own, and each one lands in
 * front of a player as a different sentence, so the interesting assertions here
 * are the refusals rather than the acceptances.
 */
describe("the readings", () => {
  /** An ended board, to prove all four close with the game. */
  function ended() {
    const l = opened();
    l.push("game_ended", { win_condition: "abandoned" });
    return projectBoard(l.events);
  }

  describe("canProposeReadingHandback", () => {
    it("allows reading one of their reasons back", () => {
      const board = boardForRelocation();
      expect(canProposeReadingHandback(board, "child", "plus", "You mean X.")).toEqual({
        ok: true,
      });
    });

    it("refuses reading your own reason back, which asks nobody anything", () => {
      const board = boardForRelocation();
      expect(canProposeReadingHandback(board, "root", "plus", "I mean X.").ok).toBe(
        false,
      );
    });

    it("refuses a reason that is not there, or was taken off the board", () => {
      const board = boardForPlacement();
      expect(canProposeReadingHandback(board, "nope", "plus", "You mean X.").ok).toBe(
        false,
      );
      expect(canProposeReadingHandback(board, "removed", "plus", "You mean X.").ok).toBe(
        false,
      );
    });

    it("allows exactly READING_MAX_CHARS and refuses one over, or none", () => {
      const board = boardForRelocation();
      const at = "a".repeat(READING_MAX_CHARS);
      expect(canProposeReadingHandback(board, "child", "plus", at)).toEqual({ ok: true });
      expect(canProposeReadingHandback(board, "child", "plus", at + "a").ok).toBe(false);
      expect(canProposeReadingHandback(board, "child", "plus", "   ").ok).toBe(false);
    });

    it("closes when the game does", () => {
      expect(canProposeReadingHandback(ended(), "child", "plus", "You mean X.").ok).toBe(
        false,
      );
    });
  });

  describe("canProposeSteelmanReading", () => {
    it("allows a reading that points at nothing on the board", () => {
      expect(
        canProposeSteelmanReading(projectBoard(opened().events), "Your side holds X."),
      ).toEqual({ ok: true });
    });

    it("refuses empty words or more than READING_MAX_CHARS", () => {
      const board = projectBoard(opened().events);
      expect(canProposeSteelmanReading(board, "  ").ok).toBe(false);
      expect(canProposeSteelmanReading(board, "a".repeat(READING_MAX_CHARS + 1)).ok).toBe(
        false,
      );
    });

    it("closes when the game does", () => {
      expect(canProposeSteelmanReading(ended(), "Your side holds X.").ok).toBe(false);
    });
  });

  describe("canProposeSteelmanTile", () => {
    it("holds a reason offered to them to the tile rules exactly", () => {
      const board = boardForPlacement();
      expect(canProposeSteelmanTile(board, "root", "A reason you missed.")).toEqual(
        canPlaceTile(board, "A reason you missed.", "root"),
      );
      expect(canProposeSteelmanTile(board, "nope", "A reason you missed.")).toEqual(
        canPlaceTile(board, "A reason you missed.", "nope"),
      );
      expect(canProposeSteelmanTile(board, null, "a".repeat(TILE_MAX_CHARS + 1))).toEqual(
        canPlaceTile(board, "a".repeat(TILE_MAX_CHARS + 1), null),
      );
    });

    it("is bounded by the tile limit, not the reading limit", () => {
      const board = boardForPlacement();
      expect(canProposeSteelmanTile(board, null, "a".repeat(TILE_MAX_CHARS))).toEqual({
        ok: true,
      });
      expect(canProposeSteelmanTile(board, null, "a".repeat(TILE_MAX_CHARS + 1)).ok).toBe(
        false,
      );
    });
  });

  describe("canProposeDefinition", () => {
    it("allows a word and a meaning for it", () => {
      expect(
        canProposeDefinition(
          projectBoard(opened().events),
          "rent",
          "What a tenant pays.",
        ),
      ).toEqual({ ok: true });
    });

    it("refuses a missing word, an overlong word, or a missing meaning", () => {
      const board = projectBoard(opened().events);
      expect(canProposeDefinition(board, "  ", "What a tenant pays.").ok).toBe(false);
      expect(
        canProposeDefinition(
          board,
          "a".repeat(DEFINITION_TERM_MAX_CHARS + 1),
          "What a tenant pays.",
        ).ok,
      ).toBe(false);
      expect(canProposeDefinition(board, "rent", "   ").ok).toBe(false);
    });

    it("closes when the game does", () => {
      expect(canProposeDefinition(ended(), "rent", "What a tenant pays.").ok).toBe(false);
    });
  });
});

describe("isAbandoned", () => {
  /** Created and both seated, but never started. */
  function waiting() {
    const l = log();
    l.push("game_created", {
      mode: "live",
      level_id: null,
      boss_id: null,
      join_code: "PTKN23",
    });
    l.push("player_joined", { display_name: "Brisk Copper Otter" }, ALICE);
    l.push("player_joined", { display_name: "Quiet Amber Fjord" }, BOB);
    return l;
  }

  it("is true once somebody quits a live board, because it needs both sides", () => {
    const l = opened();
    expect(isAbandoned(projectBoard(l.events))).toBe(false);
    l.push("player_left", { reason: "quit" }, BOB);
    expect(isAbandoned(projectBoard(l.events))).toBe(true);
  });

  it("is false for a disconnect, since reloading returns them to the same seat", () => {
    const l = opened();
    l.push("player_left", { reason: "disconnect" }, BOB);
    expect(isAbandoned(projectBoard(l.events))).toBe(false);
  });

  it("waits for the last person to leave a lobby, since the code can still be used", () => {
    const l = waiting();
    l.push("player_left", { reason: "quit" }, BOB);
    expect(isAbandoned(projectBoard(l.events))).toBe(false);
    l.push("player_left", { reason: "quit" }, ALICE);
    expect(isAbandoned(projectBoard(l.events))).toBe(true);
  });

  it("is false once the game has ended, so a late leave cannot end it twice", () => {
    const l = opened();
    l.push("game_ended", { win_condition: "threads_resolved" });
    l.push("player_left", { reason: "quit" }, BOB);
    expect(isAbandoned(projectBoard(l.events))).toBe(false);
  });
});

describe("the six-thread ceiling", () => {
  /** An active board carrying `count` open threads, each with a root tile. */
  function boardWithThreads(count: number) {
    const l = opened();
    for (let i = 1; i <= count; i++) {
      l.push("tile_placed", tile(`t${i}`, null, `t${i}`, `Root ${i}.`), ALICE);
    }
    return { l, board: projectBoard(l.events) };
  }

  it("allows the sixth new thread", () => {
    const { board } = boardWithThreads(MAX_THREADS - 1);
    expect(canPlaceTile(board, "One more reason.", null)).toEqual({ ok: true });
  });

  it("refuses the seventh, and says where to put it instead", () => {
    const { board } = boardWithThreads(MAX_THREADS);
    const verdict = canPlaceTile(board, "One more reason.", null);
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.error).toContain(String(MAX_THREADS));
  });

  it("still lets a full board grow, as long as it grows downward", () => {
    const { board } = boardWithThreads(MAX_THREADS);
    expect(canPlaceTile(board, "A reply to the first one.", "t1")).toEqual({ ok: true });
  });

  it("frees a slot when every tile in a thread is removed", () => {
    const { l } = boardWithThreads(MAX_THREADS);
    expect(canPlaceTile(projectBoard(l.events), "New thread.", null).ok).toBe(false);
    l.push("tile_removed", { tile_id: "t1" }, ALICE);
    // An emptied thread is not an argument anybody is having, so it does not
    // hold a slot. Same rule threadsWinReached uses at the other end.
    expect(canPlaceTile(projectBoard(l.events), "New thread.", null)).toEqual({
      ok: true,
    });
  });
});

describe("topicAgreementEndsGame", () => {
  function created(
    mode: "live" | "gym",
    level: string | null = null,
    boss: string | null = null,
  ) {
    const l = log();
    l.push("game_created", {
      mode,
      level_id: level,
      boss_id: boss,
      join_code: "PTKN24",
    });
    return projectBoard(l.events);
  }

  it("ends a live game", () => {
    expect(topicAgreementEndsGame(created("live"))).toBe(true);
  });

  it("does not end free gym practice, where a rewrite is the point of being there", () => {
    expect(topicAgreementEndsGame(created("gym"))).toBe(false);
  });

  it("ends a gym game running a written level", () => {
    expect(topicAgreementEndsGame(created("gym", "level-opening-moves"))).toBe(true);
  });

  it("ends a gym game running a boss", () => {
    expect(topicAgreementEndsGame(created("gym", null, "boss-the-whataboutist"))).toBe(
      true,
    );
  });
});

describe("the throw", () => {
  const DECK = ["you_is_taboo", "no_exaggeration"];

  /** Opened with a real card set, and one reason from each side. */
  function thrown() {
    const l = log();
    l.push("game_created", {
      mode: "live",
      level_id: null,
      boss_id: null,
      join_code: "PTKN22",
    });
    l.push("player_joined", { display_name: "Brisk Copper Otter" }, ALICE);
    l.push("player_joined", { display_name: "Quiet Amber Fjord" }, BOB);
    l.push("role_selected", { role: "plus" }, ALICE);
    l.push("role_selected", { role: "minus" }, BOB);
    l.push("topic_set", {
      text: "Cities should cap rents.",
      origin: "library",
      topic_id: "rent-cap",
    });
    l.push("game_started", {
      card_set: { policy: "intersection", card_ids: DECK, raised_by: null },
      coach: null,
    });
    l.push(
      "tile_placed",
      tile("hers", null, "hers", "You always overstate this."),
      ALICE,
    );
    l.push("tile_placed", tile("his", "hers", "hers", "Caps cut supply.", "minus"), BOB);
    return l;
  }

  it("reads the deck off the game, since the hand is shared", () => {
    expect(cardsInPlay(projectBoard(thrown().events))).toEqual(DECK);
    // No deck before the game starts, rather than a crash.
    expect(cardsInPlay(projectBoard(log().events))).toEqual([]);
  });

  it("lets a player throw a card in play at the other side's reason", () => {
    const board = projectBoard(thrown().events);
    expect(canThrowCard(board, "hers", "you_is_taboo", "minus", BOB).ok).toBe(true);
  });

  it("refuses a card this game is not being played with", () => {
    const board = projectBoard(thrown().events);
    const verdict = canThrowCard(board, "hers", "stick_to_root", "minus", BOB);
    expect(verdict).toMatchObject({ ok: false });
  });

  it("refuses a throw at your own reason", () => {
    const board = projectBoard(thrown().events);
    expect(canThrowCard(board, "hers", "you_is_taboo", "plus", ALICE).ok).toBe(false);
  });

  it("refuses the same card twice on the same reason", () => {
    const l = thrown();
    l.push(
      "card_thrown",
      { card_id: "you_is_taboo", rung_id: null, target_tile_id: "hers" },
      BOB,
    );
    const board = projectBoard(l.events);
    expect(canThrowCard(board, "hers", "you_is_taboo", "minus", BOB).ok).toBe(false);
    // A different card is still fair game.
    expect(canThrowCard(board, "hers", "no_exaggeration", "minus", BOB).ok).toBe(true);
  });

  it("lets only the reason's author answer, either way", () => {
    const l = thrown();
    const seq = l.push(
      "card_thrown",
      { card_id: "you_is_taboo", rung_id: null, target_tile_id: "hers" },
      BOB,
    );
    const board = projectBoard(l.events);

    expect(canDeclineThrow(board, seq, ALICE, null).ok).toBe(true);
    expect(canDeclineThrow(board, seq, BOB, null).ok).toBe(false);

    expect(
      canReviseTile(board, "hers", seq, ALICE, "I think you overstate this.").ok,
    ).toBe(true);
    expect(canReviseTile(board, "hers", seq, BOB, "I think you overstate this.").ok).toBe(
      false,
    );
  });

  it("caps the note on a decline", () => {
    const l = thrown();
    const seq = l.push(
      "card_thrown",
      { card_id: "you_is_taboo", rung_id: null, target_tile_id: "hers" },
      BOB,
    );
    const board = projectBoard(l.events);
    const long = "n".repeat(DECLINE_REASON_MAX_CHARS + 1);
    expect(canDeclineThrow(board, seq, ALICE, long).ok).toBe(false);
    expect(canDeclineThrow(board, seq, ALICE, long.slice(1)).ok).toBe(true);
  });

  it("closes both answers once the throw has been answered", () => {
    const l = thrown();
    const seq = l.push(
      "card_thrown",
      { card_id: "you_is_taboo", rung_id: null, target_tile_id: "hers" },
      BOB,
    );
    l.push("card_throw_declined", { in_response_to_seq: seq, reason: null }, ALICE);
    const board = projectBoard(l.events);
    expect(canDeclineThrow(board, seq, ALICE, null).ok).toBe(false);
    expect(canReviseTile(board, "hers", seq, ALICE, "Different words entirely.").ok).toBe(
      false,
    );
  });

  it("refuses a rewrite that is not a rewrite, or that answers another reason's card", () => {
    const l = thrown();
    const seq = l.push(
      "card_thrown",
      { card_id: "you_is_taboo", rung_id: null, target_tile_id: "hers" },
      BOB,
    );
    const board = projectBoard(l.events);
    expect(
      canReviseTile(board, "hers", seq, ALICE, "You always overstate this.").ok,
    ).toBe(false);
    expect(canReviseTile(board, "hers", seq, ALICE, "  ").ok).toBe(false);
    expect(
      canReviseTile(board, "hers", seq, ALICE, "x".repeat(TILE_MAX_CHARS + 1)).ok,
    ).toBe(false);
    // The throw landed on her reason, so it cannot be answered by rewriting his.
    expect(canReviseTile(board, "his", seq, BOB, "Caps cut new supply.").ok).toBe(false);
  });
});
