/** @vitest-environment jsdom */

/**
 * Interaction tests for the landing-page tutorial: that it opens with
 * nothing stored, that Skip exits from any point, that one card's
 * dialogue / tap / detail / practice / confirmed sequence advances the
 * tracker correctly, and that all four cards lead to the end screen with
 * both of its paths present and gated on one agreement tick.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { coachCard } from "@/lib/coach/cards";
import { CARD_LESSONS } from "@/components/onboarding/landing-tutorial-content";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const { LandingOnboarding } = await import("./landing-onboarding");

beforeEach(() => {
  document.cookie = "pt-terms-agreed=; path=/; max-age=0";
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** Walks one card's full dialogue -> tap -> detail -> practice -> confirmed
 *  sequence, picking whichever verdict the practice step calls for. */
async function clearOneCard(
  user: ReturnType<typeof userEvent.setup>,
  lesson: (typeof CARD_LESSONS)[number],
  isLastCard: boolean,
) {
  const card = coachCard(lesson.cardId);
  if (!card) throw new Error(`no coach card for ${lesson.cardId}`);

  for (const line of lesson.dialogue) {
    const isLastLine = line === lesson.dialogue[lesson.dialogue.length - 1];
    await user.click(
      screen.getByRole("button", { name: isLastLine ? "Continue" : "Next" }),
    );
  }
  await user.click(screen.getByRole("button", { name: `Tap the ${card.name} card` }));
  await user.click(screen.getByRole("button", { name: "Try it yourself" }));

  const verdict = lesson.examples[lesson.practice.exampleIndex].verdict;
  await user.click(
    screen.getByRole("button", {
      name: verdict === "breaks" ? "Breaks it" : "Fine as is",
    }),
  );
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(
    screen.getByRole("button", { name: isLastCard ? "See what's next" : "Next card" }),
  );
}

describe("LandingOnboarding: opens unconditionally", () => {
  it("shows the first card's dialogue on mount with nothing stored", () => {
    render(<LandingOnboarding />);
    expect(screen.getByText(CARD_LESSONS[0].dialogue[0])).toBeTruthy();
    expect(screen.getByText("Learn the card")).toBeTruthy();
  });
});

describe("LandingOnboarding: Skip", () => {
  it("closes the overlay from the dialogue step", async () => {
    const user = userEvent.setup();
    render(<LandingOnboarding />);

    await user.click(screen.getByLabelText("Skip tutorial"));
    expect(screen.queryByText(CARD_LESSONS[0].dialogue[0])).toBeNull();
  });
});

describe("LandingOnboarding: one card's lesson", () => {
  it("advances dialogue, reveals the card, expands it, and runs the practice call", async () => {
    const user = userEvent.setup();
    render(<LandingOnboarding />);
    const lesson = CARD_LESSONS[0];
    const card = coachCard(lesson.cardId)!;

    for (const line of lesson.dialogue.slice(0, -1)) {
      expect(screen.getByText(line)).toBeTruthy();
      await user.click(screen.getByRole("button", { name: "Next" }));
    }
    expect(screen.getByText(lesson.dialogue[lesson.dialogue.length - 1])).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByText("Tap the card.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: `Tap the ${card.name} card` }));

    expect(screen.getByText("Examples")).toBeTruthy();
    expect(screen.getByText(`“${lesson.examples[0].text}”`)).toBeTruthy();
    expect(screen.getByText(`“${lesson.examples[2].text}”`)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Try it yourself" }));

    expect(screen.getByText("Make the call")).toBeTruthy();
    expect(screen.getByText("Practice the call")).toBeTruthy();
    const verdict = lesson.examples[lesson.practice.exampleIndex].verdict;
    await user.click(
      screen.getByRole("button", {
        name: verdict === "breaks" ? "Breaks it" : "Fine as is",
      }),
    );
    expect(screen.getByText("Right call")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByText("Card earned")).toBeTruthy();
    expect(screen.getByText(`${card.name} is yours.`)).toBeTruthy();
  });
});

describe("LandingOnboarding: all four cards to the end screen", () => {
  it("offers both starting a live game and training in the Gym, both gated on one tick", async () => {
    const user = userEvent.setup();
    render(<LandingOnboarding />);

    for (let i = 0; i < CARD_LESSONS.length; i += 1) {
      await clearOneCard(user, CARD_LESSONS[i], i === CARD_LESSONS.length - 1);
    }

    const startButton = screen.getByRole("button", { name: "Start playing now" });
    const gymButton = screen.getByRole("button", { name: "Go train in the Gym" });
    expect(startButton).toHaveProperty("disabled", true);
    expect(gymButton).toHaveProperty("disabled", true);

    await user.click(screen.getByRole("checkbox"));
    expect(startButton).toHaveProperty("disabled", false);
    expect(gymButton).toHaveProperty("disabled", false);

    for (const lesson of CARD_LESSONS) {
      const card = coachCard(lesson.cardId)!;
      expect(screen.getByText(card.name)).toBeTruthy();
    }
  });
});
