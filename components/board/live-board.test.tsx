/** @vitest-environment jsdom */

/**
 * Coverage for the onboarding overlay's board-side wiring, added alongside
 * BRAIN-T260825-06's follow-up: the retired client opened its tutorial
 * automatically on every arrival at a game board (`isTutorialOpen = ref(true)`
 * in `[gameCode].vue`, no seen-it-already memory anywhere) and offered a
 * small "?" button in the header to reopen it. This file checks that
 * LiveBoard reproduces both, without re-testing the overlay's own step
 * navigation, which already lives in
 * components/onboarding/onboarding-overlay.test.tsx.
 *
 * Everything LiveBoard reaches outside of components/board and
 * components/onboarding is mocked: the server actions in
 * app/game/[gameId]/actions.ts (a "use server" file this task may not edit),
 * and the realtime feed's router/supabase dependencies, which jsdom cannot
 * run for real.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/supabase/browser", () => ({
  browserClient: () => ({
    auth: { getSession: async () => ({ data: { session: null } }) },
    realtime: { setAuth: async () => {} },
    channel: () => ({
      on: () => ({
        subscribe: (callback: (status: string) => void) => {
          callback("SUBSCRIBED");
          return {};
        },
      }),
    }),
    removeChannel: async () => {},
  }),
}));

const actionResult = async () => ({ ok: true }) as const;
vi.mock("@/app/game/[gameId]/actions", () => ({
  acceptProposal: actionResult,
  clearResolutionToken: actionResult,
  declineThrow: actionResult,
  dismissCoachReading: actionResult,
  editTile: actionResult,
  giveGenerosityToken: actionResult,
  leaveGame: actionResult,
  placeResolutionToken: actionResult,
  placeTile: actionResult,
  proposeDefinition: actionResult,
  proposeReadingHandback: actionResult,
  proposeRelocation: actionResult,
  proposeSteelmanReading: actionResult,
  proposeSteelmanTile: actionResult,
  proposeTopicRevision: actionResult,
  rejectProposal: actionResult,
  removeTile: actionResult,
  reviseTile: actionResult,
  setCoach: actionResult,
  throwCard: actionResult,
}));

const { LiveBoard } = await import("./live-board");
const { projectBoard } = await import("@/lib/board/project");
type AnyGameEvent = import("@/lib/events/types").AnyGameEvent;

const GAME = "00000000-0000-4000-8000-000000000000";
const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";

/** Same envelope the database returns; only type, actor, and payload matter here. */
function buildEvents(
  parts: { type: string; payload: unknown; actor_id?: string | null }[],
): AnyGameEvent[] {
  return parts.map((part, index) => ({
    id: `e${index + 1}`,
    game_id: GAME,
    seq: index + 1,
    schema_version: 1,
    actor_role: "plus",
    source: "human",
    actor_id: ALICE,
    created_at: "2026-08-22T00:00:00Z",
    ...part,
  })) as AnyGameEvent[];
}

function activeBoard() {
  return projectBoard(
    buildEvents([
      {
        type: "game_created",
        payload: { mode: "live", level_id: null, boss_id: null, join_code: "PTKN22" },
      },
      { type: "player_joined", payload: { display_name: "Alice" }, actor_id: ALICE },
      { type: "role_selected", payload: { role: "plus" }, actor_id: ALICE },
      { type: "player_joined", payload: { display_name: "Bob" }, actor_id: BOB },
      { type: "role_selected", payload: { role: "minus" }, actor_id: BOB },
      {
        type: "topic_set",
        payload: {
          text: "Cities should cap rents.",
          origin: "library",
          topic_id: "rent-cap",
        },
      },
      {
        type: "game_started",
        payload: {
          card_set: { policy: "intersection", card_ids: [], raised_by: null },
          coach: null,
        },
      },
    ]),
  );
}

beforeEach(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LiveBoard: onboarding on arrival", () => {
  it("opens the onboarding overlay automatically, with no way to have already seen it", () => {
    const board = activeBoard();
    render(
      <LiveBoard
        gameId={GAME}
        board={board}
        me={{ playerId: ALICE, role: "plus" }}
        coachEnabled={false}
      />,
    );

    expect(
      screen.getByText(
        "Each player writes two starting reason tiles supporting their opinion.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Step 1 of 4")).toBeTruthy();
  });

  it("passes the player's own side through to the overlay's first step", () => {
    const board = activeBoard();
    const { container } = render(
      <LiveBoard
        gameId={GAME}
        board={board}
        me={{ playerId: BOB, role: "minus" }}
        coachEnabled={false}
      />,
    );

    const source = container.querySelector("video source");
    expect(source?.getAttribute("src")).toBe("/onboarding/step1-minus.mp4");
  });
});

describe("LiveBoard: the header's Instructions button", () => {
  it("matches the retired client's title and aria-label", () => {
    const board = activeBoard();
    render(
      <LiveBoard
        gameId={GAME}
        board={board}
        me={{ playerId: ALICE, role: "plus" }}
        coachEnabled={false}
      />,
    );

    const button = screen.getByRole("button", { name: "Instructions" });
    expect(button.getAttribute("title")).toBe("Instructions");
    expect(button.getAttribute("aria-label")).toBe("Instructions");
  });

  it("reopens the overlay after it has been dismissed", async () => {
    const user = userEvent.setup();
    const board = activeBoard();
    render(
      <LiveBoard
        gameId={GAME}
        board={board}
        me={{ playerId: ALICE, role: "plus" }}
        coachEnabled={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Skip tutorial" }));
    expect(screen.queryByText("Step 1 of 4")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Instructions" }));
    expect(screen.getByText("Step 1 of 4")).toBeTruthy();
  });
});
