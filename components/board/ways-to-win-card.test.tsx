/** @vitest-environment jsdom */

/**
 * Tests for WaysToWinCard: the resolved-count readout, hovering a corner or
 * the center pencil reporting through onHover, and clicking the pencil
 * reporting through onRevise. This is plain presentational board chrome,
 * not a TilePopover configuration, so there is no anchor/open plumbing to
 * set up here.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MIN_THREADS_TO_END } from "@/lib/board/rules";
import { WaysToWinCard, type MiniThread } from "./ways-to-win-card";

afterEach(cleanup);

const THREADS: MiniThread[] = [
  { tileId: "t1", side: "plus", parentEdge: 1, resolved: true, token: "👍" },
  { tileId: "t2", side: "minus", parentEdge: 3, resolved: false, token: null },
  { tileId: "t3", side: "plus", parentEdge: 5, resolved: false, token: null },
  { tileId: "t4", side: "minus", parentEdge: 7, resolved: false, token: null },
];

describe("WaysToWinCard: reading the win conditions", () => {
  it("shows the resolve-threads condition with the live threshold", () => {
    render(<WaysToWinCard threads={THREADS} resolvedCount={1} />);

    expect(screen.getByText("Ways to win")).toBeTruthy();
    expect(screen.getByText("Revise the topic")).toBeTruthy();
  });

  it("shows how many of the required threads are resolved", () => {
    render(<WaysToWinCard threads={THREADS} resolvedCount={1} />);

    const resolvedLine = screen.getByText(
      (_, element) =>
        element?.tagName.toLowerCase() === "p" &&
        element.textContent === `1 of ${MIN_THREADS_TO_END} resolved`,
    );
    expect(resolvedLine).toBeTruthy();
  });
});

describe("WaysToWinCard: hovering", () => {
  it("reports a resolved thread on hover and clears on leave", async () => {
    const onHover = vi.fn();
    const user = userEvent.setup();
    render(<WaysToWinCard threads={THREADS} resolvedCount={1} onHover={onHover} />);

    await user.hover(screen.getByLabelText("Thread resolved"));
    expect(onHover).toHaveBeenCalledWith({ tileId: "t1", kind: "resolved" });

    await user.unhover(screen.getByLabelText("Thread resolved"));
    expect(onHover).toHaveBeenLastCalledWith(null);
  });

  it("reports an open thread on hover", async () => {
    const onHover = vi.fn();
    const user = userEvent.setup();
    render(<WaysToWinCard threads={THREADS} resolvedCount={1} onHover={onHover} />);

    const openThreads = screen.getAllByLabelText("Thread not yet resolved");
    await user.hover(openThreads[0]);
    expect(onHover).toHaveBeenCalledWith(expect.objectContaining({ kind: "open" }));
  });

  it("reports the topic pencil on hover", async () => {
    const onHover = vi.fn();
    const user = userEvent.setup();
    render(<WaysToWinCard threads={THREADS} resolvedCount={1} onHover={onHover} />);

    await user.hover(screen.getByLabelText("Revise the topic"));
    expect(onHover).toHaveBeenCalledWith({ tileId: "0", kind: "topic" });
  });
});

describe("WaysToWinCard: revising the topic", () => {
  it("calls onRevise when the pencil is clicked", async () => {
    const onRevise = vi.fn();
    const user = userEvent.setup();
    render(<WaysToWinCard threads={THREADS} resolvedCount={1} onRevise={onRevise} />);

    await user.click(screen.getByLabelText("Revise the topic"));
    expect(onRevise).toHaveBeenCalledTimes(1);
  });
});

describe("WaysToWinCard: fewer than four threads", () => {
  it("renders without error when there are no threads yet", () => {
    render(<WaysToWinCard threads={[]} resolvedCount={0} />);

    expect(screen.getByText("Ways to win")).toBeTruthy();
    expect(screen.getByLabelText("Revise the topic")).toBeTruthy();
  });
});
