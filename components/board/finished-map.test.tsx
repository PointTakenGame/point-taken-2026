import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FinishedMap } from "./finished-map";
import { projectBoard } from "@/lib/board/project";
import type { AnyGameEvent } from "@/lib/events/types";

const GAME = "00000000-0000-4000-8000-000000000000";
const ALICE = "11111111-1111-4111-8111-111111111111";

/** Same envelope the database returns; only type and payload matter here. */
const events = (
  parts: { type: string; payload: unknown }[],
): AnyGameEvent[] =>
  parts.map((part, index) => ({
    id: `e${index + 1}`,
    game_id: GAME,
    seq: index + 1,
    schema_version: 1,
    actor_role: "plus",
    source: "human",
    actor_id: ALICE,
    created_at: "2026-08-22T00:00:00Z",
    ...part,
  })) as AnyGameEvent[];

describe("FinishedMap", () => {
  it("draws the topic, the tree, and how the thread ended", () => {
    const board = projectBoard(
      events([
        { type: "game_created", payload: { mode: "live", level_id: null, boss_id: null, join_code: "PTKN22" } },
        { type: "player_joined", payload: { display_name: "Brisk Copper Otter" } },
        { type: "role_selected", payload: { role: "plus" } },
        { type: "topic_set", payload: { text: "Cities should cap rents.", origin: "library", topic_id: "rent-cap" } },
        { type: "tile_placed", payload: { tile_id: "t1", parent_tile_id: null, thread_root_id: "t1", side: "plus", text: "Rents outpace wages." } },
        { type: "tile_placed", payload: { tile_id: "t2", parent_tile_id: "t1", thread_root_id: "t1", side: "minus", text: "Caps cut new supply." } },
        { type: "thread_resolved", payload: { thread_root_id: "t1", emoji: "⚖️", note: "We weigh it differently." } },
        { type: "game_ended", payload: { win_condition: "threads_resolved" } },
      ]),
    );

    const html = renderToStaticMarkup(<FinishedMap board={board} endedAt="2026-08-22T00:00:00Z" />);
    expect(html).toContain("Cities should cap rents.");
    expect(html).toContain("Rents outpace wages.");
    expect(html).toContain("Caps cut new supply.");
    expect(html).toContain("Brisk Copper Otter");
    expect(html).toContain("Every thread resolved");
    expect(html).toContain("We weigh it differently.");
  });

  it("prints nothing of a redacted reason", () => {
    const board = projectBoard(
      events([
        { type: "topic_set", payload: { text: "A topic.", origin: "custom", topic_id: null } },
        { type: "tile_placed", payload: { tile_id: "t1", parent_tile_id: null, thread_root_id: "t1", side: "plus", text: "Something regrettable." } },
        { type: "content_redacted", payload: { target_seq: 2, target_path: "text", reason: "moderation", requested_by: null } },
      ]),
    );

    const html = renderToStaticMarkup(<FinishedMap board={board} />);
    expect(html).not.toContain("regrettable");
    expect(html).toContain("[redacted]");
  });

  it("says so plainly when a game has no reasons on it", () => {
    const board = projectBoard(
      events([{ type: "topic_set", payload: { text: "A topic.", origin: "custom", topic_id: null } }]),
    );
    expect(renderToStaticMarkup(<FinishedMap board={board} />)).toContain(
      "there is no map to draw",
    );
  });
});
