import { describe, expect, it } from "vitest";
import { projectBoard, REDACTED_TEXT } from "./project";
import type {
  AnyGameEvent,
  EventPayloads,
  GameEventType,
} from "@/lib/events/types";

const GAME = "00000000-0000-4000-8000-000000000000";
const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";

/** Numbers seqs the way the database does, so tests never hand-count. */
function log() {
  const events: AnyGameEvent[] = [];
  const push = <T extends GameEventType>(
    type: T,
    payload: EventPayloads[T],
    actorId: string | null = null,
  ) => {
    events.push({
      id: `e${events.length + 1}`,
      game_id: GAME,
      seq: events.length + 1,
      type,
      schema_version: 1,
      actor_role: "plus",
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

describe("projectBoard", () => {
  it("reads an empty log as a lobby with nothing in it", () => {
    const board = projectBoard([]);
    expect(board.status).toBe("lobby");
    expect(board.topic).toBeNull();
    expect(board.tiles).toEqual([]);
    expect(board.threads).toEqual([]);
    expect(board.lastSeq).toBe(0);
  });

  it("seats players, sets the topic, and opens the game", () => {
    const board = projectBoard(opened().events);
    expect(board.mode).toBe("live");
    expect(board.status).toBe("active");
    expect(board.topic?.text).toBe("Cities should cap rents.");
    expect(board.currentTopicText).toBe("Cities should cap rents.");
    expect(board.players.map((p) => [p.id, p.role])).toEqual([
      [ALICE, "plus"],
      [BOB, "minus"],
    ]);
  });

  it("builds the thread tree from parent links", () => {
    const l = opened();
    l.push("tile_placed", { ...tile("t1", null, "t1", "Rents are unaffordable."), is_opening_reason: true }, ALICE);
    l.push("tile_placed", tile("t2", "t1", "t1", "Caps cut supply.", "minus"), BOB);
    l.push("tile_placed", tile("t3", "t2", "t1", "Only in the long run.", "plus"), ALICE);
    l.push("tile_placed", tile("t4", null, "t4", "Landlords need certainty.", "minus"), BOB);

    const board = projectBoard(l.events);
    expect(board.threads.map((t) => t.rootId)).toEqual(["t1", "t4"]);

    const first = board.threads[0];
    expect(first.root?.text).toBe("Rents are unaffordable.");
    expect(first.root?.isOpeningReason).toBe(true);
    expect(first.tileCount).toBe(3);
    expect(first.orphans).toEqual([]);
    expect(first.root?.children.map((c) => c.id)).toEqual(["t2"]);
    expect(first.root?.children[0].children.map((c) => c.id)).toEqual(["t3"]);
    expect(board.threads[1].tileCount).toBe(1);
  });

  it("keeps the original topic and tracks every revision", () => {
    const l = opened();
    l.push("topic_revised", { text: "Cities should cap rent increases.", via_proposal_id: "p1" }, BOB);
    const board = projectBoard(l.events);
    expect(board.topic?.text).toBe("Cities should cap rents.");
    expect(board.currentTopicText).toBe("Cities should cap rent increases.");
    expect(board.topic?.revisions).toHaveLength(1);
  });

  it("applies edits and card-answering revisions to a tile's text", () => {
    const l = opened();
    l.push("tile_placed", tile("t1", null, "t1", "Rents are to high."), ALICE);
    l.push("tile_edited", { tile_id: "t1", text: "Rents are too high." }, ALICE);
    const thrown = l.push("card_thrown", { card_id: "vague", rung_id: null, target_tile_id: "t1" }, BOB);
    l.push("tile_revised", { tile_id: "t1", text: "Median rent exceeds a third of income.", in_response_to_seq: thrown }, ALICE);

    const [t1] = projectBoard(l.events).tiles;
    expect(t1.text).toBe("Median rent exceeds a third of income.");
    expect(t1.edited).toBe(true);
    expect(t1.revised).toBe(true);
    expect(t1.cardsThrown).toBe(1);
  });

  it("takes a removed tile out of the tree and surfaces its live child", () => {
    const l = opened();
    l.push("tile_placed", tile("t1", null, "t1", "Root."), ALICE);
    l.push("tile_placed", tile("t2", "t1", "t1", "Child.", "minus"), BOB);
    l.push("tile_placed", tile("t3", "t2", "t1", "Grandchild."), ALICE);
    l.push("tile_removed", { tile_id: "t2" }, BOB);

    const board = projectBoard(l.events);
    const thread = board.threads[0];
    expect(thread.tileCount).toBe(2);
    expect(thread.root?.children).toEqual([]);
    expect(thread.orphans.map((t) => t.id)).toEqual(["t3"]);
    expect(board.tiles.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
    expect(board.tiles[1].removed).toBe(true);
  });

  it("moves a relocated tile to its new thread, parent, and side", () => {
    const l = opened();
    l.push("tile_placed", tile("t1", null, "t1", "Root one."), ALICE);
    l.push("tile_placed", tile("t2", null, "t2", "Root two.", "minus"), BOB);
    l.push("tile_placed", tile("t3", "t1", "t1", "Moves."), ALICE);
    l.push("tile_relocated", { tile_id: "t3", new_parent_tile_id: "t2", new_thread_root_id: "t2", new_side: "minus" }, BOB);

    const board = projectBoard(l.events);
    expect(board.threads[0].tileCount).toBe(1);
    expect(board.threads[1].root?.children.map((t) => t.id)).toEqual(["t3"]);
    expect(board.tiles[2].side).toBe("minus");
  });

  it("commits a resolution and clears the emoji that preceded it", () => {
    const l = opened();
    l.push("tile_placed", tile("t1", null, "t1", "Root."), ALICE);
    l.push("resolution_emoji_placed", { thread_root_id: "t1", emoji: "🧭" }, ALICE);
    l.push("resolution_emoji_removed", { thread_root_id: "t1" }, ALICE);
    l.push("resolution_emoji_placed", { thread_root_id: "t1", emoji: "⚖️" }, BOB);
    l.push("thread_resolved", { thread_root_id: "t1", emoji: "⚖️", note: "We weigh it differently." }, BOB);

    const thread = projectBoard(l.events).threads[0];
    expect(thread.pendingEmoji).toBeNull();
    expect(thread.resolution?.emoji).toBe("⚖️");
    expect(thread.resolution?.note).toBe("We weigh it differently.");
  });

  it("leaves an uncommitted emoji pending", () => {
    const l = opened();
    l.push("tile_placed", tile("t1", null, "t1", "Root."), ALICE);
    l.push("resolution_emoji_placed", { thread_root_id: "t1", emoji: "🧭" }, ALICE);
    const thread = projectBoard(l.events).threads[0];
    expect(thread.pendingEmoji).toBe("🧭");
    expect(thread.resolution).toBeNull();
  });

  it("records how the game ended", () => {
    const l = opened();
    l.push("game_ended", { win_condition: "topic_agreed" });
    const board = projectBoard(l.events);
    expect(board.status).toBe("ended");
    expect(board.winCondition).toBe("topic_agreed");
  });

  it("replaces redacted text and never leaks the original", () => {
    const l = opened();
    const placed = l.push("tile_placed", tile("t1", null, "t1", "Something regrettable."), ALICE);
    l.push("content_redacted", {
      target_seq: placed,
      target_path: "text",
      reason: "author_request",
      requested_by: ALICE,
    });

    const board = projectBoard(l.events);
    expect(board.tiles[0].text).toBe(REDACTED_TEXT);
    expect(board.tiles[0].redacted).toBe(true);
    expect(JSON.stringify(board)).not.toContain("regrettable");
  });

  it("redacts a resolution note without touching its emoji", () => {
    const l = opened();
    l.push("tile_placed", tile("t1", null, "t1", "Root."), ALICE);
    const resolved = l.push("thread_resolved", { thread_root_id: "t1", emoji: "⚖️", note: "Regrettable aside." }, BOB);
    l.push("content_redacted", { target_seq: resolved, target_path: "note", reason: "moderation", requested_by: null });

    const thread = projectBoard(l.events).threads[0];
    expect(thread.resolution?.emoji).toBe("⚖️");
    expect(thread.resolution?.note).toBe(REDACTED_TEXT);
  });

  it("counts generosity tokens by side", () => {
    const l = opened();
    l.push("generosity_token_given", { to_role: "minus" }, ALICE);
    l.push("generosity_token_given", { to_role: "minus" }, ALICE);
    l.push("generosity_token_given", { to_role: "plus" }, BOB);
    expect(projectBoard(l.events).generosity).toEqual({ plus: 1, minus: 2 });
  });

  it("sorts by seq rather than trusting the order it was handed", () => {
    const l = opened();
    l.push("tile_placed", tile("t1", null, "t1", "Root."), ALICE);
    l.push("tile_edited", { tile_id: "t1", text: "Root, edited." }, ALICE);
    const shuffled = [...l.events].reverse();
    expect(projectBoard(shuffled).tiles[0].text).toBe("Root, edited.");
  });

  it("clears a left player's stamp when they rejoin", () => {
    const l = opened();
    l.push("player_left", { reason: "disconnect" }, BOB);
    expect(projectBoard(l.events).players[1].left).toBe("disconnect");
    l.push("player_joined", { display_name: "Quiet Amber Fjord" }, BOB);
    const board = projectBoard(l.events);
    expect(board.players).toHaveLength(2);
    expect(board.players[1].left).toBeNull();
  });
});
