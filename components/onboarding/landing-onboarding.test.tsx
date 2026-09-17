/** @vitest-environment jsdom */

/**
 * Interaction tests for the three-stage landing popup: intro, then the
 * unmodified five-step walkthrough (already covered in its own right by
 * onboarding-overlay.test.tsx), then the end screen. Focuses on what this
 * wrapper adds: opening on stage 1 with nothing stored, moving between
 * stages, Skip/close working from every stage, and the end screen's two
 * paths.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const { LandingOnboarding } = await import("./landing-onboarding");

beforeEach(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  document.cookie = "pt-terms-agreed=; path=/; max-age=0";
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** From a fresh render, gets from stage 1 to the end screen. */
async function reachEndScreen(user: ReturnType<typeof userEvent.setup>) {
  render(<LandingOnboarding />);
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.click(screen.getByRole("button", { name: "Go to step 5" }));
  await user.click(screen.getByRole("button", { name: "Finish" }));
}

describe("LandingOnboarding: opens unconditionally on stage 1", () => {
  it("shows the intro on mount with nothing stored", () => {
    render(<LandingOnboarding />);
    expect(
      screen.getByText("Point Taken is a game about disagreeing well."),
    ).toBeTruthy();
  });
});

describe("LandingOnboarding: stage 1, the intro", () => {
  it("Skip closes the whole popup", async () => {
    const user = userEvent.setup();
    render(<LandingOnboarding />);

    await user.click(screen.getByRole("button", { name: "Skip tutorial" }));
    expect(
      screen.queryByText("Point Taken is a game about disagreeing well."),
    ).toBeNull();
  });

  it("the close button closes the whole popup", async () => {
    const user = userEvent.setup();
    render(<LandingOnboarding />);

    await user.click(screen.getByLabelText("Close tutorial"));
    expect(
      screen.queryByText("Point Taken is a game about disagreeing well."),
    ).toBeNull();
  });

  it("Next moves to stage 2, the five-step walkthrough", async () => {
    const user = userEvent.setup();
    render(<LandingOnboarding />);

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Step 1 of 5")).toBeTruthy();
    expect(
      screen.getByText(
        "Each player writes two starting reason tiles supporting their opinion.",
      ),
    ).toBeTruthy();
  });
});

describe("LandingOnboarding: stage 2, the walkthrough", () => {
  it("Skip tutorial from the walkthrough closes the whole popup", async () => {
    const user = userEvent.setup();
    render(<LandingOnboarding />);

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Step 1 of 5")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Skip tutorial" }));
    expect(screen.queryByText("Step 1 of 5")).toBeNull();
    expect(
      screen.queryByText("Point Taken is a game about disagreeing well."),
    ).toBeNull();
  });

  it("finishing the last step moves to stage 3, not straight to closed", async () => {
    const user = userEvent.setup();
    render(<LandingOnboarding />);

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Go to step 5" }));
    await user.click(screen.getByRole("button", { name: "Finish" }));

    expect(screen.queryByText("Step 5 of 5")).toBeNull();
    expect(screen.getByText("One thing before you jump in.")).toBeTruthy();
  });
});

describe("LandingOnboarding: stage 3, the end screen", () => {
  it("offers both paths, gated on one agreement tick", async () => {
    const user = userEvent.setup();
    await reachEndScreen(user);

    const gymButton = screen.getByRole("button", { name: "Go to the Gym" });
    const startButton = screen.getByRole("button", {
      name: "Play a game from the beginning",
    });
    expect(gymButton).toHaveProperty("disabled", true);
    expect(startButton).toHaveProperty("disabled", true);

    await user.click(screen.getByRole("checkbox"));
    expect(gymButton).toHaveProperty("disabled", false);
    expect(startButton).toHaveProperty("disabled", false);
  });

  it("names all four cards and the empty-hand mechanic", async () => {
    const user = userEvent.setup();
    await reachEndScreen(user);

    expect(screen.getByText(/"You" is Taboo/)).toBeTruthy();
    expect(screen.getByText("Stick to the Thread's Root")).toBeTruthy();
    expect(screen.getByText("No Exaggeration")).toBeTruthy();
    expect(screen.getByText("Help Me Understand")).toBeTruthy();
    expect(screen.getByText(/one per Gym level/)).toBeTruthy();
  });

  it("close button closes the whole popup from the end screen too", async () => {
    const user = userEvent.setup();
    await reachEndScreen(user);

    await user.click(screen.getByLabelText("Close tutorial"));
    expect(screen.queryByText("One thing before you jump in.")).toBeNull();
  });
});
