/** @vitest-environment jsdom */

/**
 * Interaction tests for the three-stage landing popup: intro, then the
 * unmodified five-step walkthrough (already covered in its own right by
 * onboarding-overlay.test.tsx), then the end screen. Focuses on what this
 * wrapper adds: showing once to a just-set-up account and to nobody else, moving between
 * stages, Skip/close working from every stage, and the end screen's two
 * paths.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

/** Both end-screen buttons call a server action through `useRoom`. The actions
 *  themselves are covered where they live; what matters here is that the right
 *  one is called and that the board it returns is where the visitor lands. */
const startCurrentLevel = vi.fn(async () => ({ ok: true as const, gameId: "gym-1" }));
vi.mock("@/app/gym/actions", () => ({
  startCurrentLevel: () => startCurrentLevel(),
}));

const createRoom = vi.fn(async () => ({ ok: true as const, gameId: "room-1" }));
vi.mock("@/app/join/actions", () => ({
  createRoom: () => createRoom(),
  joinRoom: vi.fn(),
}));

const { LandingOnboarding } = await import("./landing-onboarding");
const { markOnboardingPending, clearOnboardingPending } =
  await import("./onboarding-pending");

beforeEach(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  document.cookie = "pt-terms-agreed=; path=/; max-age=0";
  clearOnboardingPending();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

/** The popup is owed to an account just set up, which leaves this marker. */
function mount(signedIn = false) {
  markOnboardingPending();
  return render(<LandingOnboarding signedIn={signedIn} />);
}

/** From a fresh render, gets from stage 1 to the end screen. */
async function reachEndScreen(
  user: ReturnType<typeof userEvent.setup>,
  signedIn = false,
) {
  mount(signedIn);
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.click(screen.getByRole("button", { name: "Go to step 5" }));
  await user.click(screen.getByRole("button", { name: "Finish" }));
}

describe("LandingOnboarding: who sees it", () => {
  it("shows the intro to an account that was just set up", () => {
    mount();
    expect(
      screen.getByText("Point Taken is a game about disagreeing well."),
    ).toBeTruthy();
  });

  it("shows nothing to a returning player, who has no marker", () => {
    render(<LandingOnboarding signedIn />);
    expect(
      screen.queryByText("Point Taken is a game about disagreeing well."),
    ).toBeNull();
  });

  it("consumes the marker on first sight, so a remount does not replay it", () => {
    const first = mount(true);
    expect(window.localStorage.getItem("pt.onboarding.pending")).toBeNull();
    first.unmount();

    render(<LandingOnboarding signedIn />);
    expect(
      screen.queryByText("Point Taken is a game about disagreeing well."),
    ).toBeNull();
  });

  it("opens over the page when the marker is set after it mounted", () => {
    render(<LandingOnboarding signedIn />);
    expect(
      screen.queryByText("Point Taken is a game about disagreeing well."),
    ).toBeNull();

    act(() => markOnboardingPending());
    expect(
      screen.getByText("Point Taken is a game about disagreeing well."),
    ).toBeTruthy();
  });
});

describe("LandingOnboarding: stage 1, the intro", () => {
  it("Skip closes the whole popup", async () => {
    const user = userEvent.setup();
    mount();

    await user.click(screen.getByRole("button", { name: "Skip tutorial" }));
    expect(
      screen.queryByText("Point Taken is a game about disagreeing well."),
    ).toBeNull();
  });

  it("the close button closes the whole popup", async () => {
    const user = userEvent.setup();
    mount();

    await user.click(screen.getByLabelText("Close tutorial"));
    expect(
      screen.queryByText("Point Taken is a game about disagreeing well."),
    ).toBeNull();
  });

  it("Next moves to stage 2, the five-step walkthrough", async () => {
    const user = userEvent.setup();
    mount();

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
    mount();

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
    mount();

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

describe("LandingOnboarding: stage 3, Go to the Gym when signed out", () => {
  it("is disabled until the tick, then opens the level the player is due", async () => {
    const user = userEvent.setup();
    await reachEndScreen(user, false);

    const gymButton = screen.getByRole("button", { name: "Go to the Gym" });
    expect(gymButton).toHaveProperty("disabled", true);

    await user.click(screen.getByRole("checkbox"));
    expect(gymButton).toHaveProperty("disabled", false);

    await user.click(gymButton);
    expect(startCurrentLevel).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/game/gym-1");
  });

  it("mints a guest account and retries when the action asks for one", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    startCurrentLevel
      .mockResolvedValueOnce({ ok: false, error: "no name", signIn: true } as never)
      .mockResolvedValueOnce({ ok: true, gameId: "gym-1" });
    const user = userEvent.setup();
    await reachEndScreen(user, false);

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Go to the Gym" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/anonymous", { method: "POST" });
    expect(startCurrentLevel).toHaveBeenCalledTimes(2);
    expect(push).toHaveBeenCalledWith("/game/gym-1");
  });
});

describe("LandingOnboarding: stage 3, Go to the Gym when already signed in", () => {
  it("is enabled without the tick and goes straight to the board", async () => {
    const user = userEvent.setup();
    await reachEndScreen(user, true);

    const gymButton = screen.getByRole("button", { name: "Go to the Gym" });
    expect(gymButton).toHaveProperty("disabled", false);

    await user.click(gymButton);
    expect(push).toHaveBeenCalledWith("/game/gym-1");
  });
});

describe("LandingOnboarding: stage 3, Play a game from the beginning", () => {
  it("opens a fresh live room and goes to its board", async () => {
    const user = userEvent.setup();
    await reachEndScreen(user, true);

    await user.click(
      screen.getByRole("button", { name: "Play a game from the beginning" }),
    );

    expect(createRoom).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/game/room-1");
  });
});
