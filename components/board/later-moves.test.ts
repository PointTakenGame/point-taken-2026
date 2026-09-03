/**
 * Coverage for the BRAIN-T260903-06 gate: the six "ask the other player"
 * moves are Gym level 5+ and are not offered yet, with one exception
 * (`tile_relocation`, load-bearing for Gym level 2, stays available outside
 * live play). `BoardState` is a large core-owned interface
 * (`lib/board/project.ts`, read-only for this task), so `makeBoard` builds a
 * minimal one, overriding only the field this gate reads.
 */

import { describe, expect, it } from "vitest";
import type { BoardState } from "@/lib/board/project";
import type { ProposalKind, Side } from "@/lib/events/types";
import { canStartLaterMove, LATER_MOVE_KINDS } from "./later-moves";

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

const NON_RELOCATION_KINDS: readonly ProposalKind[] = LATER_MOVE_KINDS.filter(
  (kind) => kind !== "tile_relocation",
);

describe("canStartLaterMove", () => {
  it("lists all six later moves in LATER_MOVE_KINDS", () => {
    expect(LATER_MOVE_KINDS).toEqual([
      "tile_relocation",
      "definition",
      "steelman_reading",
      "steelman_tile",
      "reading_handback",
      "topic_revision",
    ]);
  });

  it("refuses every one of the five non-relocation moves, live or not", () => {
    for (const kind of NON_RELOCATION_KINDS) {
      expect(canStartLaterMove(makeBoard({ mode: "live" }), kind)).toBe(false);
      expect(canStartLaterMove(makeBoard({ mode: "gym" }), kind)).toBe(false);
      expect(canStartLaterMove(makeBoard({ mode: null }), kind)).toBe(false);
    }
  });

  it("refuses to start a relocation in live play", () => {
    expect(canStartLaterMove(makeBoard({ mode: "live" }), "tile_relocation")).toBe(false);
  });

  // Gym level 2 (beat L2.9 of the ratified guide) has the player relocate a
  // tile, so relocation is the one later move still offered outside live play.
  it("still offers a relocation in the Gym, where level 2 needs it", () => {
    expect(canStartLaterMove(makeBoard({ mode: "gym" }), "tile_relocation")).toBe(true);
  });

  it("offers a relocation when the board has no mode at all", () => {
    expect(canStartLaterMove(makeBoard({ mode: null }), "tile_relocation")).toBe(true);
  });
});
