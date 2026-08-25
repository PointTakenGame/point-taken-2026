/** @vitest-environment jsdom */

/**
 * Interaction tests for the composed FeedbackPopover, layered on top of the
 * TilePopover primitive (already covered on its own in
 * components/ui/tile-popover.test.tsx). These focus on what this component
 * adds: the trigger buttons, the fixed severity, stage derivation via the
 * current route, the unconfigured-destination path, and the success state
 * with its auto-close.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockUsePathname = vi.fn<() => string>();
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

const mockSubmitFeedback = vi.fn();
vi.mock("@/lib/feedback/submit", () => ({
  submitFeedback: (...args: unknown[]) => mockSubmitFeedback(...args),
}));

const mockGetFeedbackShareMoreUrl = vi.fn<() => string | null>(() => null);
vi.mock("@/lib/feedback/config", () => ({
  getFeedbackShareMoreUrl: () => mockGetFeedbackShareMoreUrl(),
}));

const { FeedbackPopover } = await import("./feedback-popover");

function isDisabled(element: HTMLElement): boolean {
  return (element as HTMLButtonElement).disabled === true;
}

beforeEach(() => {
  mockUsePathname.mockReturnValue("/game/some-uuid");
  mockGetFeedbackShareMoreUrl.mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("FeedbackPopover: trigger variants", () => {
  it("renders the floating trigger with the Share feedback label", async () => {
    render(<FeedbackPopover variant="floating" />);
    expect(screen.getByLabelText("Share feedback")).toBeTruthy();
  });

  it("renders the inline trigger reading Report a bug", () => {
    render(<FeedbackPopover variant="inline" />);
    expect(screen.getByRole("button", { name: "Report a bug" })).toBeTruthy();
  });
});

describe("FeedbackPopover: category chips", () => {
  it("selects and deselects a category chip without gating the send button", async () => {
    const user = userEvent.setup();
    render(<FeedbackPopover variant="floating" />);
    await user.click(screen.getByLabelText("Share feedback"));

    const bugChip = screen.getByRole("button", { name: "Bug" });
    expect(bugChip.getAttribute("aria-pressed")).toBe("false");

    await user.click(bugChip);
    expect(bugChip.getAttribute("aria-pressed")).toBe("true");

    await user.click(bugChip);
    expect(bugChip.getAttribute("aria-pressed")).toBe("false");
  });
});

describe("FeedbackPopover: send button", () => {
  it("stays disabled until the description field has text", async () => {
    const user = userEvent.setup();
    render(<FeedbackPopover variant="floating" />);
    await user.click(screen.getByLabelText("Share feedback"));

    const sendButton = screen.getByRole("button", { name: "Send" });
    expect(isDisabled(sendButton)).toBe(true);

    await user.type(
      screen.getByPlaceholderText("Tell us about a bug, a reaction, or an idea..."),
      "the board froze on my turn",
    );
    expect(isDisabled(sendButton)).toBe(false);
  });
});

describe("FeedbackPopover: stage hint", () => {
  it("shows the derived stage for the current route", async () => {
    mockUsePathname.mockReturnValue("/join/ABC123");
    const user = userEvent.setup();
    render(<FeedbackPopover variant="floating" />);
    await user.click(screen.getByLabelText("Share feedback"));

    expect(screen.getByText("From: Joining a room")).toBeTruthy();
  });

  it("hides the share-more link when it is not configured", async () => {
    const user = userEvent.setup();
    render(<FeedbackPopover variant="floating" />);
    await user.click(screen.getByLabelText("Share feedback"));

    expect(screen.queryByText(/full form/)).toBeNull();
  });

  it("shows the share-more link when configured", async () => {
    mockGetFeedbackShareMoreUrl.mockReturnValue("https://example.com/full-form");
    const user = userEvent.setup();
    render(<FeedbackPopover variant="floating" />);
    await user.click(screen.getByLabelText("Share feedback"));

    const link = screen.getByRole("link", { name: /full form/ });
    expect(link.getAttribute("href")).toBe("https://example.com/full-form");
  });
});

describe("FeedbackPopover: submit path", () => {
  it("submits the five expected values, with severity fixed at 3", async () => {
    mockUsePathname.mockReturnValue("/cards");
    const user = userEvent.setup();
    render(<FeedbackPopover variant="floating" />);
    await user.click(screen.getByLabelText("Share feedback"));

    await user.click(screen.getByRole("button", { name: "AI issue" }));
    await user.type(
      screen.getByPlaceholderText("Tell us about a bug, a reaction, or an idea..."),
      "the coach repeated itself",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(mockSubmitFeedback).toHaveBeenCalledTimes(1);
    const submitted = mockSubmitFeedback.mock.calls[0][0];
    expect(submitted.stage).toBe("Cards");
    expect(submitted.description).toBe("the coach repeated itself");
    expect(submitted.severity).toBe("3");
    expect(submitted.category).toBe("ai");
    expect(typeof submitted.userAgent).toBe("string");
  });

  it("shows the success acknowledgement immediately after sending, then auto-closes", async () => {
    // Real timers here: mixing userEvent's own internal timers with fake
    // timers is unreliable, and the auto-close delay is short enough
    // (1.8s) that waiting it out for real keeps this test simple.
    const user = userEvent.setup();
    render(<FeedbackPopover variant="floating" />);
    await user.click(screen.getByLabelText("Share feedback"));
    await user.type(
      screen.getByPlaceholderText("Tell us about a bug, a reaction, or an idea..."),
      "found a bug",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(screen.getByText("Thanks!")).toBeTruthy();
    expect(screen.getByText("Your report is on its way.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Send" })).toBeNull();

    await waitFor(
      () => {
        expect(screen.queryByText("Thanks!")).toBeNull();
      },
      { timeout: 3000 },
    );
  }, 10000);
});
