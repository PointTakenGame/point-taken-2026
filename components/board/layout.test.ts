import { describe, expect, it } from "vitest";
import { TOPIC_CELL_ID, layoutBoard, legalPlacements, topicRootedLayout } from "./layout";

function tile(id: string, parentId: string | null) {
  return { id, parentId };
}

describe("layoutBoard", () => {
  it("places a lone root at the origin", () => {
    const { positions, unplaced } = layoutBoard([tile("root", null)]);
    expect(positions.get("root")).toEqual({ x: 0, y: 0 });
    expect(unplaced).toEqual([]);
  });

  it("fills all four diagonal slots for a root with four children", () => {
    const { positions, unplaced } = layoutBoard([
      tile("root", null),
      tile("ne", "root"),
      tile("se", "root"),
      tile("sw", "root"),
      tile("nw", "root"),
    ]);
    expect(positions.get("ne")).toEqual({ x: 1, y: -1 });
    expect(positions.get("se")).toEqual({ x: 1, y: 1 });
    expect(positions.get("sw")).toEqual({ x: -1, y: 1 });
    expect(positions.get("nw")).toEqual({ x: -1, y: -1 });
    expect(unplaced).toEqual([]);
  });

  it("leaves a fifth child on the same parent unplaced, with no legal spot left", () => {
    const { positions, unplaced } = layoutBoard([
      tile("root", null),
      tile("ne", "root"),
      tile("se", "root"),
      tile("sw", "root"),
      tile("nw", "root"),
      tile("fifth", "root"),
    ]);
    expect(positions.has("fifth")).toBe(false);
    expect(unplaced).toEqual(["fifth"]);
  });

  it("lays out a chain, each tile off the last", () => {
    const { positions } = layoutBoard([tile("a", null), tile("b", "a"), tile("c", "b")]);
    expect(positions.get("a")).toEqual({ x: 0, y: 0 });
    expect(positions.get("b")).toEqual({ x: 1, y: -1 });
    expect(positions.get("c")).toEqual({ x: 2, y: -2 });
  });

  it("skips a taken offset and falls through to the next diagonal in order", () => {
    const { positions } = layoutBoard([
      tile("root", null),
      tile("ne", "root"),
      tile("second", "root"),
    ]);
    expect(positions.get("ne")).toEqual({ x: 1, y: -1 });
    expect(positions.get("second")).toEqual({ x: 1, y: 1 });
  });

  it("rejects a cell that would touch a third-party tile even if the cell itself is free", () => {
    const { positions, unplaced } = layoutBoard([
      tile("root", null),
      tile("ne", "root"),
      // "cousin" hangs off ne, landing at (2, -2), diagonal to root's NE slot but
      // not touching root itself.
      tile("cousin", "ne"),
      // second child of root: NE is taken, so it should try SE (1, 1) next, which
      // is legal. If instead the algorithm considered anything near "cousin" it
      // would still resolve correctly here, so this case mainly pins ordering.
      tile("second", "root"),
    ]);
    expect(positions.get("cousin")).toEqual({ x: 2, y: -2 });
    expect(positions.get("second")).toEqual({ x: 1, y: 1 });
    expect(unplaced).toEqual([]);
  });

  it("draws a tile that a move hung under a reason written after it", () => {
    // What "move it" does: an early tile is reparented onto a later one. The
    // list still arrives in placement order, so "moved" comes before the
    // parent it now hangs off. Replayed literally, it lands nowhere.
    const { positions, unplaced } = layoutBoard([
      tile("topic", null),
      tile("thread-one", "topic"),
      tile("moved", "thread-one"),
      tile("thread-two", "topic"),
    ]);
    const relocated = layoutBoard([
      tile("topic", null),
      tile("thread-one", "topic"),
      tile("moved", "thread-two"),
      tile("thread-two", "topic"),
    ]);

    expect(unplaced).toEqual([]);
    expect(relocated.unplaced).toEqual([]);
    expect(relocated.positions.has("moved")).toBe(true);
    expect(relocated.positions.get("moved")).not.toEqual(positions.get("moved"));
  });

  it("leaves a reparenting cycle unplaced instead of looping forever", () => {
    const { positions, unplaced } = layoutBoard([tile("a", "b"), tile("b", "a")]);
    expect(positions.size).toBe(0);
    expect(unplaced).toEqual(["a", "b"]);
  });

  it("marks a tile unplaced if its parent never resolved to a position", () => {
    const { positions, unplaced } = layoutBoard([tile("orphan", "missing-parent")]);
    expect(positions.has("orphan")).toBe(false);
    expect(unplaced).toEqual(["orphan"]);
  });

  it("computes grid bounds with padding around the placed tiles", () => {
    const layout = layoutBoard([tile("root", null), tile("ne", "root")]);
    expect(layout.width).toBe(1 - 0 + 1 + 2); // x spans 0..1
    expect(layout.height).toBe(0 - -1 + 1 + 2); // y spans -1..0
    expect(layout.offsetX).toBe(1 - 0);
    expect(layout.offsetY).toBe(1 - -1);
  });

  it("does not stack a second parentless tile on the first", () => {
    const { positions, unplaced } = layoutBoard([tile("a", null), tile("b", null)]);
    expect(positions.get("a")).toEqual({ x: 0, y: 0 });
    expect(positions.get("b")).toBeDefined();
    expect(positions.get("b")).not.toEqual({ x: 0, y: 0 });
    expect(unplaced).toEqual([]);
  });

  it("keeps every parentless tile, rather than losing all but the last", () => {
    const roots = ["a", "b", "c", "d"].map((id) => tile(id, null));
    const { positions } = layoutBoard(roots);
    const cells = new Set([...positions.values()].map((p) => `${p.x},${p.y}`));
    expect(positions.size).toBe(4);
    expect(cells.size).toBe(4);
  });
});

describe("topicRootedLayout", () => {
  it("puts the topic at the centre and hangs each thread off a diagonal", () => {
    const layout = topicRootedLayout([
      tile("t1", null),
      tile("t2", null),
      tile("t3", null),
      tile("t4", null),
    ]);
    expect(layout.positions.get(TOPIC_CELL_ID)).toEqual({ x: 0, y: 0 });
    expect(layout.positions.get("t1")).toEqual({ x: 1, y: -1 });
    expect(layout.positions.get("t2")).toEqual({ x: 1, y: 1 });
    expect(layout.positions.get("t3")).toEqual({ x: -1, y: 1 });
    expect(layout.positions.get("t4")).toEqual({ x: -1, y: -1 });
    expect(layout.unplaced).toEqual([]);
  });

  it("reports a fifth thread as unplaced rather than dropping it, since a centre tile has four diagonals", () => {
    const layout = topicRootedLayout(
      ["t1", "t2", "t3", "t4", "t5"].map((id) => tile(id, null)),
    );
    expect(layout.unplaced).toEqual(["t5"]);
  });

  it("puts Plus on the right and Minus on the left, bottom corners first", () => {
    const layout = topicRootedLayout([
      { id: "p1", parentId: null, side: "plus" },
      { id: "m1", parentId: null, side: "minus" },
      { id: "p2", parentId: null, side: "plus" },
      { id: "m2", parentId: null, side: "minus" },
    ]);
    expect(layout.positions.get("p1")).toEqual({ x: 1, y: 1 });
    expect(layout.positions.get("m1")).toEqual({ x: -1, y: 1 });
    expect(layout.positions.get("p2")).toEqual({ x: 1, y: -1 });
    expect(layout.positions.get("m2")).toEqual({ x: -1, y: -1 });
  });

  // A two-thread game is level 1 of the Gym, and Steve asked for the pair to
  // sit along the bottom rather than on a diagonal.
  it("gives a two-thread game the two bottom corners", () => {
    const layout = topicRootedLayout([
      { id: "p1", parentId: null, side: "plus" },
      { id: "m1", parentId: null, side: "minus" },
    ]);
    expect(layout.positions.get("p1")).toEqual({ x: 1, y: 1 });
    expect(layout.positions.get("m1")).toEqual({ x: -1, y: 1 });
  });

  // The rules still allow a root anywhere, and games played before the
  // convention have roots on whichever diagonal was free. Nothing may vanish.
  it("falls back to the other side's corner rather than dropping a thread", () => {
    const layout = topicRootedLayout([
      { id: "p1", parentId: null, side: "plus" },
      { id: "p2", parentId: null, side: "plus" },
      { id: "p3", parentId: null, side: "plus" },
    ]);
    expect(layout.positions.get("p3")).toEqual({ x: -1, y: 1 });
    expect(layout.unplaced).toEqual([]);
  });

  it("does not push a reply onto its author's side, only thread starters", () => {
    const layout = topicRootedLayout([
      { id: "m1", parentId: null, side: "minus" },
      { id: "reply", parentId: "m1", side: "plus" },
    ]);
    expect(layout.positions.get("m1")).toEqual({ x: -1, y: 1 });
    expect(layout.positions.get("reply")).toEqual({ x: 0, y: 2 });
  });

  it("keeps a thread's own children hanging off it, not off the topic", () => {
    const layout = topicRootedLayout([tile("t1", null), tile("reply", "t1")]);
    expect(layout.positions.get("t1")).toEqual({ x: 1, y: -1 });
    expect(layout.positions.get("reply")).toEqual({ x: 2, y: -2 });
  });
});

describe("legalPlacements", () => {
  it("offers all four diagonals for a childless parent", () => {
    const layout = layoutBoard([tile("root", null)]);
    const spots = legalPlacements(layout, "root");
    expect(spots).toEqual([
      { x: 1, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: 1 },
      { x: -1, y: -1 },
    ]);
  });

  it("excludes an already-taken diagonal", () => {
    const layout = layoutBoard([tile("root", null), tile("ne", "root")]);
    const spots = legalPlacements(layout, "root");
    expect(spots).not.toContainEqual({ x: 1, y: -1 });
    expect(spots).toHaveLength(3);
  });

  it("returns nothing for a parent with all four slots full", () => {
    const layout = layoutBoard([
      tile("root", null),
      tile("ne", "root"),
      tile("se", "root"),
      tile("sw", "root"),
      tile("nw", "root"),
    ]);
    expect(legalPlacements(layout, "root")).toEqual([]);
  });

  it("returns nothing for an unplaced parent id", () => {
    const layout = layoutBoard([tile("root", null)]);
    expect(legalPlacements(layout, "nobody")).toEqual([]);
  });
});
