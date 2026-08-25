/** @vitest-environment jsdom */

/**
 * Interaction tests for the persistent "paths to winning" card. `BoardState`
 * is a large core-owned interface (`lib/board/project.ts`, read-only for
 * this task), so tests build a minimal board with `makeBoard`, overriding
 * only the fields a given test cares about, and a minimal `BoardThread`
 * with `makeThread`. `revisions` entries only need to satisfy
 * `BoardTopic["revisions"]`'s shape, so tests use the smallest values that
 * type-check rather than realistic ones.
 */

import { describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach } from "vitest";
import type { BoardState, BoardThread } from "@/lib/board/project";
import type { Side } from "@/lib/events/types";
import { PathsToWinningCard } from "./paths-to-winning-card";

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

let nextThreadId = 0;

function makeThread(overrides: Partial<BoardThread> = {}): BoardThread {
  nextThreadId += 1;
  return {
    rootId: `root-${nextThreadId}`,
    root: null,
    orphans: [],
    tileCount: 1,
    pending: { plus: null, minus: null },
    resolution: null,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("PathsToWinningCard: static shape", () => {
  it("renders the header and no Instructions button", () => {
    render(<PathsToWinningCard board={makeBoard()} onRevise={() => {}} />);
    expect(screen.getByText("PATHS TO WINNING")).toBeTruthy();
    expect(screen.queryByText("Instructions")).toBeNull();
  });
});

describe("PathsToWinningCard: resolved-threads progress", () => {
  it("shows 0/0 when the board has no live threads", () => {
    render(<PathsToWinningCard board={makeBoard()} onRevise={() => {}} />);
    expect(screen.getByText("0/0")).toBeTruthy();
  });

  it("counts only resolved threads in the numerator, over all live threads in the denominator", () => {
    const threads = [
      makeThread({ resolution: { emoji: "👍", note: null, seq: 1 } }),
      makeThread({ resolution: { emoji: "👀", note: null, seq: 2 } }),
      makeThread({ resolution: null }),
    ];
    render(<PathsToWinningCard board={makeBoard({ threads })} onRevise={() => {}} />);
    expect(screen.getByText("2/3")).toBeTruthy();
  });

  it("does not hardcode a denominator of four", () => {
    const threads = [makeThread({ resolution: { emoji: "👍", note: null, seq: 1 } })];
    render(<PathsToWinningCard board={makeBoard({ threads })} onRevise={() => {}} />);
    expect(screen.getByText("1/1")).toBeTruthy();
    expect(screen.queryByText(/\/4$/)).toBeNull();
  });
});

describe("PathsToWinningCard: revised-topic indicator", () => {
  it("reads Not yet when the topic has no revisions", () => {
    render(
      <PathsToWinningCard
        board={makeBoard({
          topic: {
            text: "Cats.",
            origin: "custom",
            topicId: null,
            redacted: false,
            revisions: [],
          },
        })}
        onRevise={() => {}}
      />,
    );
    expect(screen.getByText("Not yet")).toBeTruthy();
  });

  it("reads Revised once the topic has at least one revision", () => {
    render(
      <PathsToWinningCard
        board={makeBoard({
          topic: {
            text: "Cats.",
            origin: "custom",
            topicId: null,
            redacted: false,
            revisions: [{ text: "Cats are better.", seq: 1, redacted: false }],
          },
        })}
        onRevise={() => {}}
      />,
    );
    expect(screen.getByText("Revised")).toBeTruthy();
  });

  it("reads Not yet when there is no topic at all", () => {
    render(<PathsToWinningCard board={makeBoard({ topic: null })} onRevise={() => {}} />);
    expect(screen.getByText("Not yet")).toBeTruthy();
  });
});

describe("PathsToWinningCard: Revise button", () => {
  it("calls onRevise when clicked", async () => {
    const user = userEvent.setup();
    const onRevise = vi.fn();
    render(<PathsToWinningCard board={makeBoard()} onRevise={onRevise} />);

    await user.click(screen.getByText("Revise"));
    expect(onRevise).toHaveBeenCalledTimes(1);
  });
});
