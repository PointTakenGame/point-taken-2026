/**
 * Coverage for the BRAIN-T260903-06 gate: the six "ask the other player"
 * moves are Gym level 5+ and are not offered yet, with three exceptions. A
 * move a Gym level teaches has to be reachable inside the Gym, so relocation
 * (level 2), the reading handback and the definition (both level 4) stay
 * available outside live play. `BoardState` is a large core-owned interface
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
    awards: {
      levelCleared: null,
      badges: [],
      points: 0,
      pointEvents: [],
      certificate: null,
    },
    lastSeq: 0,
    ...overrides,
  };
}

const TAUGHT: readonly ProposalKind[] = [
  "tile_relocation",
  "reading_handback",
  "definition",
];

const NOT_TAUGHT_YET: readonly ProposalKind[] = LATER_MOVE_KINDS.filter(
  (kind) => !TAUGHT.includes(kind),
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

  it("refuses every move no level teaches yet, live or not", () => {
    for (const kind of NOT_TAUGHT_YET) {
      expect(canStartLaterMove(makeBoard({ mode: "live" }), kind)).toBe(false);
      expect(canStartLaterMove(makeBoard({ mode: "gym" }), kind)).toBe(false);
      expect(canStartLaterMove(makeBoard({ mode: null }), kind)).toBe(false);
    }
  });

  it("refuses all three taught moves in live play", () => {
    for (const kind of TAUGHT) {
      expect(canStartLaterMove(makeBoard({ mode: "live" }), kind)).toBe(false);
    }
  });

  // Relocation is level 2 (beat L2.9); the handback and the definition are
  // level 4 (beats L4.4, L4.7 and L4.6). A level cannot teach a move the
  // board will not let the player start.
  it("offers all three taught moves in the Gym", () => {
    for (const kind of TAUGHT) {
      expect(canStartLaterMove(makeBoard({ mode: "gym" }), kind)).toBe(true);
    }
  });

  it("offers them when the board has no mode at all", () => {
    for (const kind of TAUGHT) {
      expect(canStartLaterMove(makeBoard({ mode: null }), kind)).toBe(true);
    }
  });
});
