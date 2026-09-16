/** @vitest-environment jsdom */

/**
 * Covers what this wrapper adds on top of the already-tested
 * `OnboardingOverlay` (onboarding-overlay.test.tsx): that it opens with no
 * flag to check, and that finishing the five steps lands on the two-path end
 * screen rather than just closing.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
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

describe("LandingOnboarding: opens unconditionally", () => {
  it("shows step one on mount with nothing stored", () => {
    render(<LandingOnboarding />);
    expect(screen.getByText("Step 1 of 5")).toBeTruthy();
  });
});

describe("LandingOnboarding: end screen", () => {
  async function finishAllSteps(user: ReturnType<typeof userEvent.setup>) {
    render(<LandingOnboarding />);
    await user.click(screen.getByRole("button", { name: "Go to step 5" }));
    await user.click(screen.getByRole("button", { name: "Finish" }));
  }

  it("offers both starting a live game and training in the Gym, both gated on one tick", async () => {
    const user = userEvent.setup();
    await finishAllSteps(user);

    const startButton = screen.getByRole("button", { name: "Start playing now" });
    const gymButton = screen.getByRole("button", { name: "Go train in the Gym" });
    expect(startButton).toHaveProperty("disabled", true);
    expect(gymButton).toHaveProperty("disabled", true);

    await user.click(screen.getByRole("checkbox"));
    expect(startButton).toHaveProperty("disabled", false);
    expect(gymButton).toHaveProperty("disabled", false);
  });

  it("names all four cards and the empty-hand consequence of skipping the Gym", async () => {
    const user = userEvent.setup();
    await finishAllSteps(user);

    expect(screen.getByText(/"You" is Taboo/)).toBeTruthy();
    expect(screen.getByText("Stick to the Thread's Root")).toBeTruthy();
    expect(screen.getByText("No Exaggeration")).toBeTruthy();
    expect(screen.getByText("Help Me Understand")).toBeTruthy();
    expect(screen.getByText(/start with an empty hand/)).toBeTruthy();
  });

  it("Skip tutorial closes the overlay entirely, bypassing the end screen", async () => {
    const user = userEvent.setup();
    render(<LandingOnboarding />);

    await user.click(screen.getByRole("button", { name: "Skip tutorial" }));
    expect(screen.queryByText("Step 1 of 5")).toBeNull();
    expect(screen.queryByRole("button", { name: "Start playing now" })).toBeNull();
  });
});
