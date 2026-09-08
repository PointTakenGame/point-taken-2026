/** @vitest-environment jsdom */

/**
 * Interaction tests for the win pop-up. `BoardState` is a large core-owned
 * interface (`lib/board/project.ts`, read-only for this task), so tests
 * build a minimal board with `makeBoard`, an unexported-shape helper local
 * to this file, overriding only the fields a given test cares about.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BoardState } from "@/lib/board/project";
import type { Side } from "@/lib/events/types";
import { WinOverlay } from "./win-overlay";

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

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("WinOverlay: visibility", () => {
  it("renders nothing when there is no win condition", () => {
    const { container } = render(<WinOverlay board={makeBoard()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the card for a threads_resolved win", () => {
    render(<WinOverlay board={makeBoard({ winCondition: "threads_resolved" })} />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("You both won.")).toBeTruthy();
    expect(screen.getByText("Every thread got a token:")).toBeTruthy();
  });

  it("renders the revised topic for a topic_agreed win", () => {
    render(
      <WinOverlay
        board={makeBoard({
          winCondition: "topic_agreed",
          currentTopicText: "Cats are better.",
        })}
      />,
    );
    expect(screen.getByText("You agreed on a wording you would both sign:")).toBeTruthy();
    expect(screen.getByText("Cats are better.")).toBeTruthy();
  });

  it("does not render a card for abandoned or timeout wins", () => {
    const { container: abandoned } = render(
      <WinOverlay board={makeBoard({ winCondition: "abandoned" })} />,
    );
    expect(abandoned.firstChild).toBeNull();

    cleanup();

    const { container: timeout } = render(
      <WinOverlay board={makeBoard({ winCondition: "timeout" })} />,
    );
    expect(timeout.firstChild).toBeNull();
  });
});

describe("WinOverlay: dismissal and reopening", () => {
  it("shows the reopen pill after the close button is clicked, and reopens on click", async () => {
    const user = userEvent.setup();
    render(<WinOverlay board={makeBoard({ winCondition: "threads_resolved" })} />);

    await user.click(screen.getByLabelText("Close and review the board"));
    expect(screen.queryByRole("dialog")).toBeNull();

    const pill = screen.getByText("🎉 You both won. Show results");
    expect(pill).toBeTruthy();

    await user.click(pill);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("dismisses when the backdrop is clicked but not when the card itself is clicked", async () => {
    const user = userEvent.setup();
    render(<WinOverlay board={makeBoard({ winCondition: "threads_resolved" })} />);

    await user.click(screen.getByText("You both won."));
    expect(screen.getByRole("dialog")).toBeTruthy();

    await user.click(screen.getByRole("dialog").parentElement!);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("force-reopens automatically for a new, different win", () => {
    const { rerender } = render(
      <WinOverlay
        board={makeBoard({
          winCondition: "topic_agreed",
          currentTopicText: "First revision.",
        })}
      />,
    );
    screen.getByRole("dialog");

    rerender(
      <WinOverlay
        board={makeBoard({
          winCondition: "topic_agreed",
          currentTopicText: "Second revision.",
        })}
      />,
    );
    expect(screen.getByText("Second revision.")).toBeTruthy();
  });
});

describe("WinOverlay: buttons", () => {
  it("always renders Share to LinkedIn as a same-URL, personal-data-free new-tab link", () => {
    render(<WinOverlay board={makeBoard({ winCondition: "threads_resolved" })} />);
    const link = screen.getByText("Share to LinkedIn") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe(
      "https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fplay.pointtaken.social",
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("hides the Leave feedback link when no share-more URL is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_FEEDBACK_SHARE_MORE_URL", "");
    render(<WinOverlay board={makeBoard({ winCondition: "threads_resolved" })} />);
    expect(screen.queryByText("Leave feedback")).toBeNull();
  });

  it("renders a Play Again link back to home", () => {
    render(<WinOverlay board={makeBoard({ winCondition: "threads_resolved" })} />);
    const link = screen.getByText("Play Again") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/");
  });

  /**
   * The finished page under this overlay is drawn in pills, and these three
   * were drawn in the ported `form-base` chrome: a 6px-radius grey rectangle
   * beside a gold pill, in one composited view, at the end of the game.
   */
  it("draws its buttons in the board's pill vocabulary", () => {
    render(<WinOverlay board={makeBoard({ winCondition: "threads_resolved" })} />);
    for (const label of ["Play Again", "Share to LinkedIn"]) {
      const link = screen.getByText(label);
      expect(link.className).toContain("rounded-full");
      expect(link.className).not.toContain("form-base");
    }
    // Only one of them is the gold one: going out to LinkedIn is not the
    // thing a player most wants next.
    expect(screen.getByText("Play Again").className).toContain("bg-gold");
    expect(screen.getByText("Share to LinkedIn").className).not.toContain("bg-gold");
  });

  it("renders the exact sidenote copy", () => {
    render(<WinOverlay board={makeBoard({ winCondition: "threads_resolved" })} />);
    expect(
      screen.getByText(
        "Stay as long as you like. The game is finished, and the whole board is still here underneath, to read back as often as you want.",
      ),
    ).toBeTruthy();
  });

  it("with exitHref null, dismisses in place instead of linking anywhere", async () => {
    const user = userEvent.setup();
    render(
      <WinOverlay
        board={makeBoard({ winCondition: "threads_resolved" })}
        exitLabel="Go to game wrapup"
        exitHref={null}
      />,
    );

    const exit = screen.getByText("Go to game wrapup");
    expect(exit.tagName).toBe("BUTTON");

    await user.click(exit);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("🎉 You both won. Show results")).toBeTruthy();
  });
});
