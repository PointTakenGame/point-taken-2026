/** @vitest-environment jsdom */

/**
 * Interaction tests for the four-step onboarding overlay. Covers step
 * sequencing (Next/Back/dots), the role-conditional step-one clip, the
 * step-three token legend, step five's two images, and the three ways to
 * dismiss it (Finish, Skip, Close, Escape).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { OnboardingOverlay } from "./onboarding-overlay";

beforeEach(() => {
  // jsdom does not implement real playback; the component only calls play()
  // from a video's "ended" handler, which these tests do not fire, but a
  // stub keeps the console quiet if that ever changes.
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("OnboardingOverlay: visibility", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<OnboardingOverlay open={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the first step when open", () => {
    render(<OnboardingOverlay open onClose={vi.fn()} />);
    expect(
      screen.getByText(
        "Each player writes two starting reason tiles supporting their opinion.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Step 1 of 5")).toBeTruthy();
  });
});

describe("OnboardingOverlay: step one video picks the player's side", () => {
  it("plays the plus clip by default", () => {
    const { container } = render(<OnboardingOverlay open onClose={vi.fn()} />);
    const source = container.querySelector("video source");
    expect(source?.getAttribute("src")).toBe("/onboarding/step1-plus.mp4");
  });

  it("plays the minus clip for a minus player", () => {
    const { container } = render(
      <OnboardingOverlay open onClose={vi.fn()} myRole="minus" />,
    );
    const source = container.querySelector("video source");
    expect(source?.getAttribute("src")).toBe("/onboarding/step1-minus.mp4");
  });
});

describe("OnboardingOverlay: navigation", () => {
  it("advances with Next and returns with Back", async () => {
    const user = userEvent.setup();
    render(<OnboardingOverlay open onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Step 2 of 5")).toBeTruthy();
    expect(screen.getByText("Hover to add a tile.")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Step 1 of 5")).toBeTruthy();
  });

  it("jumps straight to a step from its dot", async () => {
    const user = userEvent.setup();
    render(<OnboardingOverlay open onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Go to step 5" }));
    expect(screen.getByText("Step 5 of 5")).toBeTruthy();
    expect(screen.getByText("Two ways to win.")).toBeTruthy();
  });

  it("hides the Back control on the first step and swaps Next for Finish on the last", async () => {
    const user = userEvent.setup();
    render(<OnboardingOverlay open onClose={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Back" })).toHaveProperty("disabled", true);

    await user.click(screen.getByRole("button", { name: "Go to step 5" }));
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(screen.getByRole("button", { name: "Finish" })).toBeTruthy();
  });
});

describe("OnboardingOverlay: step three token legend", () => {
  it("lists what each resolution token means", async () => {
    const user = userEvent.setup();
    render(<OnboardingOverlay open onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Go to step 3" }));
    expect(screen.getByText("Agree to agree")).toBeTruthy();
    expect(screen.getByText("Agree to disagree")).toBeTruthy();
  });
});

describe("OnboardingOverlay: step five media", () => {
  it("shows both images with an OR between them", async () => {
    const user = userEvent.setup();
    render(<OnboardingOverlay open onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Go to step 5" }));
    expect(screen.getByText("OR")).toBeTruthy();
  });
});

describe("OnboardingOverlay: step four, the explainer", () => {
  // Ported late (BRAIN-T260902-17): the first port stopped at four steps and
  // dropped this one, which is the video the live game has been showing all
  // along. The assertion is the embed url, because the step is the video.
  it("embeds the explainer and links out to it", async () => {
    const user = userEvent.setup();
    const { container } = render(<OnboardingOverlay open onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Go to step 4" }));
    const frame = container.querySelector("iframe");
    expect(frame?.getAttribute("src")).toBe(
      "https://www.youtube-nocookie.com/embed/bqh1aegbaU8",
    );
    const link = screen.getByRole("link", {
      name: "You can also watch this video on YouTube",
    });
    expect(link.getAttribute("href")).toBe("https://www.youtube.com/watch?v=bqh1aegbaU8");
  });
});

describe("OnboardingOverlay: dismissal", () => {
  it("calls onClose from the close button", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<OnboardingOverlay open onClose={onClose} />);

    await user.click(screen.getByLabelText("Close tutorial"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose from Skip tutorial", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<OnboardingOverlay open onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Skip tutorial" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose from Finish on the last step", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<OnboardingOverlay open onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Go to step 5" }));
    await user.click(screen.getByRole("button", { name: "Finish" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose on Escape", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<OnboardingOverlay open onClose={onClose} />);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("OnboardingOverlay: onFinish", () => {
  it("calls onFinish instead of onClose from Finish on the last step, when given", async () => {
    const onClose = vi.fn();
    const onFinish = vi.fn();
    const user = userEvent.setup();
    render(<OnboardingOverlay open onClose={onClose} onFinish={onFinish} />);

    await user.click(screen.getByRole("button", { name: "Go to step 5" }));
    await user.click(screen.getByRole("button", { name: "Finish" }));

    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("still calls onClose from the close button and Skip when onFinish is given", async () => {
    const onClose = vi.fn();
    const onFinish = vi.fn();
    const user = userEvent.setup();
    render(<OnboardingOverlay open onClose={onClose} onFinish={onFinish} />);

    await user.click(screen.getByLabelText("Close tutorial"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onFinish).not.toHaveBeenCalled();
  });
});

describe("OnboardingOverlay: reopening", () => {
  it("resets to step one the next time it opens", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<OnboardingOverlay open onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Go to step 3" }));
    expect(screen.getByText("Step 3 of 5")).toBeTruthy();

    rerender(<OnboardingOverlay open={false} onClose={vi.fn()} />);
    rerender(<OnboardingOverlay open onClose={vi.fn()} />);
    expect(screen.getByText("Step 1 of 5")).toBeTruthy();
  });
});
