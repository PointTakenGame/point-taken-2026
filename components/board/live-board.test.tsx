/** @vitest-environment jsdom */

/**
 * Coverage for the onboarding overlay's board-side wiring, added alongside
 * BRAIN-T260825-06's follow-up: the retired client opened its tutorial
 * automatically on every arrival at a game board (`isTutorialOpen = ref(true)`
 * in `[gameCode].vue`) and offered a small "?" button in the header to
 * reopen it. This file checks that LiveBoard reproduces both, and that it
 * departs from the retired client on the one point where the retired client
 * was wrong: it remembers that the walkthrough has been read, without re-testing the overlay's own step
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
  // The header now also mounts the inline FeedbackPopover
  // (components/feedback/feedback-popover.tsx), which reads the current
  // route via usePathname.
  usePathname: () => "/game/00000000-0000-4000-8000-000000000000",
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
  proposeSteelmanReading: actionResult,
  proposeSteelmanTile: actionResult,
  proposeTopicRevision: actionResult,
  rejectProposal: actionResult,
  relocateTile: actionResult,
  removeTile: vi.fn(actionResult),
  reviseTile: actionResult,
  setCoach: actionResult,
  throwCard: actionResult,
}));

const { removeTile } = await import("@/app/game/[gameId]/actions");
const { LiveBoard } = await import("./live-board");
const { projectBoard } = await import("@/lib/board/project");
type AnyGameEvent = import("@/lib/events/types").AnyGameEvent;

const GAME = "00000000-0000-4000-8000-000000000000";
const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";

/** Same envelope the database returns; only type, actor, and payload matter here. */
function buildEvents(
  parts: {
    type: string;
    payload: unknown;
    actor_id?: string | null;
    actor_role?: string;
  }[],
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

/** The events every board here starts from: two seated players and a topic. */
function startedGame() {
  return [
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
        // One root, deliberately. Every board in this file is a single-thread
        // board built to test one piece of the surface, and the root stage
        // (lib/board/rules.ts) would otherwise refuse every child slot on it.
        // The stage itself is tested in lib/board/rules.test.ts.
        root_target: 1,
      },
    },
  ];
}

function activeBoard() {
  return projectBoard(buildEvents(startedGame()));
}

const TILE = "33333333-3333-4333-8333-333333333333";

/** Alice's reason, with Bob's card sitting on it, unanswered. */
function boardWithStandingThrow() {
  return projectBoard(
    buildEvents([
      ...startedGame(),
      {
        type: "tile_placed",
        payload: {
          tile_id: TILE,
          parent_tile_id: null,
          thread_root_id: TILE,
          side: "plus",
          text: "You are ignoring how much rent has risen.",
          is_opening_reason: true,
        },
        actor_id: ALICE,
      },
      {
        type: "card_thrown",
        payload: { card_id: "you_is_taboo", rung_id: null, target_tile_id: TILE },
        actor_id: BOB,
        actor_role: "minus",
      },
    ]),
  );
}

/** Alice's reason, with only Bob's resolution token on its thread. */
function boardWithOneToken() {
  return projectBoard(
    buildEvents([
      ...startedGame(),
      {
        type: "tile_placed",
        payload: {
          tile_id: TILE,
          parent_tile_id: null,
          thread_root_id: TILE,
          side: "plus",
          text: "Rents have risen faster than wages.",
          is_opening_reason: true,
        },
        actor_id: ALICE,
      },
      {
        type: "resolution_emoji_placed",
        payload: { thread_root_id: TILE, emoji: "\u{1F440}" },
        actor_id: BOB,
        actor_role: "minus",
      },
    ]),
  );
}

const CHILD = "44444444-4444-4444-8444-444444444444";

/**
 * Alice's reason, with a live reply of Bob's hanging under it: not terminal,
 * so it is not the last tile in its thread.
 */
function boardWithLiveReply() {
  return projectBoard(
    buildEvents([
      ...startedGame(),
      {
        type: "tile_placed",
        payload: {
          tile_id: TILE,
          parent_tile_id: null,
          thread_root_id: TILE,
          side: "plus",
          text: "Rents have risen faster than wages.",
          is_opening_reason: true,
        },
        actor_id: ALICE,
      },
      {
        type: "tile_placed",
        payload: {
          tile_id: CHILD,
          parent_tile_id: TILE,
          thread_root_id: TILE,
          side: "minus",
          text: "Wages have risen too.",
          is_opening_reason: false,
        },
        actor_id: BOB,
        actor_role: "minus",
      },
    ]),
  );
}

/**
 * Alice's reason, whose only reply Bob has since taken back: terminal again,
 * because a removed child does not count as a reply for this rule.
 */
function boardWithOnlyRemovedReply() {
  return projectBoard(
    buildEvents([
      ...startedGame(),
      {
        type: "tile_placed",
        payload: {
          tile_id: TILE,
          parent_tile_id: null,
          thread_root_id: TILE,
          side: "plus",
          text: "Rents have risen faster than wages.",
          is_opening_reason: true,
        },
        actor_id: ALICE,
      },
      {
        type: "tile_placed",
        payload: {
          tile_id: CHILD,
          parent_tile_id: TILE,
          thread_root_id: TILE,
          side: "minus",
          text: "Wages have risen too.",
          is_opening_reason: false,
        },
        actor_id: BOB,
        actor_role: "minus",
      },
      {
        type: "tile_removed",
        payload: { tile_id: CHILD },
        actor_id: BOB,
        actor_role: "minus",
      },
    ]),
  );
}

beforeEach(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
});

/**
 * A browser that can remember things.
 *
 * This project's jsdom has no `localStorage` at all, so without a stub the
 * walkthrough's memory is exercised only through its own catch: every test
 * would see a first-time player and the one that checks otherwise could not
 * be written. Cleared between tests because the store outlives a render the
 * way a real browser's does, and one test dismissing the walkthrough would
 * otherwise keep it off screen for every test after it.
 */
const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("LiveBoard: onboarding on arrival", () => {
  it("opens the onboarding overlay automatically for a first-time player", () => {
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
    expect(screen.getByText("Step 1 of 5")).toBeTruthy();
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

  it("stays shut on a later arrival, once it has been read", async () => {
    const user = userEvent.setup();
    render(
      <LiveBoard
        gameId={GAME}
        board={activeBoard()}
        me={{ playerId: ALICE, role: "plus" }}
        coachEnabled={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Skip tutorial" }));
    cleanup();

    // The same person, opening the board again. It used to cover the board
    // on every mount, which meant every reload of a game in progress.
    render(
      <LiveBoard
        gameId={GAME}
        board={activeBoard()}
        me={{ playerId: ALICE, role: "plus" }}
        coachEnabled={false}
      />,
    );

    expect(screen.queryByText("Step 1 of 5")).toBeNull();
    expect(screen.getByRole("button", { name: "Instructions" })).toBeTruthy();
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
    expect(screen.queryByText("Step 1 of 5")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Instructions" }));
    expect(screen.getByText("Step 1 of 5")).toBeTruthy();
  });
});

describe("LiveBoard: the room code during play", () => {
  it("shows the code as small print when the game has one", () => {
    render(
      <LiveBoard
        gameId={GAME}
        board={activeBoard()}
        me={{ playerId: ALICE, role: "plus" }}
        coachEnabled={false}
        joinCode="PTKN22"
      />,
    );

    expect(screen.getByText("PTKN22")).toBeTruthy();
  });

  it("omits the code entirely when the game has none", () => {
    render(
      <LiveBoard
        gameId={GAME}
        board={activeBoard()}
        me={{ playerId: ALICE, role: "plus" }}
        coachEnabled={false}
      />,
    );

    expect(screen.queryByText(/^Room/)).toBeNull();
  });

  // BRAIN-T260822-14: there is no public link and no share token yet, so the
  // code is display only.
  it("offers no copy or share affordance beside it", () => {
    render(
      <LiveBoard
        gameId={GAME}
        board={activeBoard()}
        me={{ playerId: ALICE, role: "plus" }}
        coachEnabled={false}
        joinCode="PTKN22"
      />,
    );

    expect(screen.queryByRole("button", { name: /copy|share|invite|link/i })).toBeNull();
  });
});

describe("LiveBoard: whose move a thrown card is", () => {
  /**
   * The answer surface for a thrown card is inside the target tile's own card,
   * and it is fine. What was missing was any reason to open the tile. Both
   * seats saw the same grey badge saying the same "waiting for an answer",
   * which does not say waiting on whom, so the player who owed a rewrite had
   * nothing telling them the turn was theirs.
   */
  it("tells the reason's author the card is theirs to answer", async () => {
    const user = userEvent.setup();
    render(
      <LiveBoard
        gameId={GAME}
        board={boardWithStandingThrow()}
        me={{ playerId: ALICE, role: "plus" }}
        coachEnabled={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Skip tutorial" }));

    expect(screen.getByText(/waiting for your answer/)).toBeTruthy();
    expect(screen.queryByText(/waiting for their answer/)).toBeNull();
  });

  it("tells the player who threw it that they are the one waiting", async () => {
    const user = userEvent.setup();
    render(
      <LiveBoard
        gameId={GAME}
        board={boardWithStandingThrow()}
        me={{ playerId: BOB, role: "minus" }}
        coachEnabled={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Skip tutorial" }));

    expect(screen.getByText(/waiting for their answer/)).toBeTruthy();
    expect(screen.queryByText(/waiting for your answer/)).toBeNull();
  });

  // The colour is the whole point of the change, so it is worth pinning: a
  // sentence only a screen reader hears would leave the sighted player exactly
  // where they were.
  it("marks only the owed answer, in the same colours an unanswered ask uses", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <LiveBoard
        gameId={GAME}
        board={boardWithStandingThrow()}
        me={{ playerId: ALICE, role: "plus" }}
        coachEnabled={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Skip tutorial" }));

    const badge = screen.getByText(/waiting for your answer/).parentElement;
    expect(badge?.className).toContain("border-gold");
    expect(badge?.className).toContain("bg-sand");
    expect(container.querySelectorAll(".border-gold").length).toBe(1);
  });
});

describe("LiveBoard: whose move a resolution token is", () => {
  /**
   * Ending a thread is the first win condition, and it takes both sides
   * putting the same token down. One side had done it and the other side's
   * board said so only in a `title`, in the same grey the badge wears when
   * you are the one waiting. Nothing distinguished "they have moved, it is
   * your turn" from "you have moved, sit tight".
   */
  it("marks the token as yours to answer when only they have put one down", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <LiveBoard
        gameId={GAME}
        board={boardWithOneToken()}
        me={{ playerId: ALICE, role: "plus" }}
        coachEnabled={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Skip tutorial" }));

    const badge = screen.getByText(/They suggested/).parentElement;
    expect(badge?.className).toContain("border-gold");
    expect(screen.getByText(/Click the reason to say whether you agree/)).toBeTruthy();
    expect(container.querySelectorAll(".border-gold").length).toBe(1);
  });

  it("leaves the player who put it down waiting, not prompted", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <LiveBoard
        gameId={GAME}
        board={boardWithOneToken()}
        me={{ playerId: BOB, role: "minus" }}
        coachEnabled={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Skip tutorial" }));

    expect(screen.getByText(/You suggested.*Waiting for them/)).toBeTruthy();
    expect(container.querySelectorAll(".border-gold").length).toBe(0);
  });
});

describe("LiveBoard: taking your own reason back off the board", () => {
  /**
   * Remove sits one row under Edit in the same list of moves, and nothing in
   * the game puts a reason back. Every other move on that card either asks
   * the other player first or can be typed over. This one used to fire on
   * the first press.
   */
  const openOwnTile = async () => {
    const user = userEvent.setup();
    const { container } = render(
      <LiveBoard
        gameId={GAME}
        board={boardWithStandingThrow()}
        me={{ playerId: ALICE, role: "plus" }}
        coachEnabled={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Skip tutorial" }));
    // The list of moves lives on a card beside the tile, and the tile is a
    // plain positioned div rather than a button, so it is reached the way the
    // board reaches it: by its id.
    await user.click(container.querySelector(`[data-tile-id="${TILE}"]`)!);
    return user;
  };

  it("arms on the first press instead of removing", async () => {
    const user = await openOwnTile();

    await user.click(screen.getByRole("button", { name: /^Remove/ }));

    expect(removeTile).not.toHaveBeenCalled();
    expect(screen.getByText(/There is no putting it back/)).toBeTruthy();
  });

  it("removes on the second press", async () => {
    const user = await openOwnTile();

    await user.click(screen.getByRole("button", { name: /^Remove/ }));
    await user.click(screen.getByRole("button", { name: /^Remove it/ }));

    expect(removeTile).toHaveBeenCalledTimes(1);
  });

  /**
   * Steve, 2026-09-05: Remove is offered only for a terminal tile, the last
   * tile in its thread nobody has replied under. `canRemoveTile`
   * (lib/board/rules.ts) has no children check of its own, so this is
   * gated in LiveBoard itself, off `BoardTile.children`.
   */
  it("offers no Remove once someone has replied under it", async () => {
    const user = userEvent.setup();
    render(
      <LiveBoard
        gameId={GAME}
        board={boardWithLiveReply()}
        me={{ playerId: ALICE, role: "plus" }}
        coachEnabled={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Skip tutorial" }));
    await user.click(document.querySelector(`[data-tile-id="${TILE}"]`)!);

    expect(screen.queryByRole("button", { name: /^Remove/ })).toBeNull();
  });

  it("still offers Remove once the only reply has itself been taken back", async () => {
    const user = userEvent.setup();
    render(
      <LiveBoard
        gameId={GAME}
        board={boardWithOnlyRemovedReply()}
        me={{ playerId: ALICE, role: "plus" }}
        coachEnabled={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Skip tutorial" }));
    await user.click(document.querySelector(`[data-tile-id="${TILE}"]`)!);

    expect(screen.getByRole("button", { name: /^Remove/ })).toBeTruthy();
  });
});

describe("LiveBoard: the pencil on your own tile", () => {
  /**
   * Steve, 2026-09-05, ruling on the tile card: "edit" is a standard pencil
   * icon on top of the tile, not a row in the card's menu, and clicking it
   * opens the card already typing rather than one click short of it.
   */
  it("opens the card already editing, with no separate Edit row to click first", async () => {
    const user = userEvent.setup();
    render(
      <LiveBoard
        gameId={GAME}
        board={boardWithStandingThrow()}
        me={{ playerId: ALICE, role: "plus" }}
        coachEnabled={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Skip tutorial" }));

    await user.click(screen.getByRole("button", { name: "Edit this reason" }));

    expect(
      screen.getByDisplayValue("You are ignoring how much rent has risen."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("does not offer the pencil on the other player's tile", async () => {
    const user = userEvent.setup();
    render(
      <LiveBoard
        gameId={GAME}
        board={boardWithStandingThrow()}
        me={{ playerId: BOB, role: "minus" }}
        coachEnabled={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Skip tutorial" }));

    expect(screen.queryByRole("button", { name: "Edit this reason" })).toBeNull();
  });
});

describe("LiveBoard: the tile card no longer repeats the reason's text", () => {
  /**
   * Steve, 2026-09-05, ruling on the tile card: the popup no longer restates
   * the tile's text at the top. That heading was the only `<header>` this
   * component ever rendered, so its absence is the signal: TileNode's own
   * octagon (kept, but CSS-`hidden`, to swap back in for the editing
   * textarea) still repeats the tile's text under the hood, so counting
   * every occurrence of the text would not isolate the header that was
   * deleted.
   */
  it("opens the card with no header restating the tile's text", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <LiveBoard
        gameId={GAME}
        board={boardWithStandingThrow()}
        me={{ playerId: ALICE, role: "plus" }}
        coachEnabled={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Skip tutorial" }));
    await user.click(document.querySelector(`[data-tile-id="${TILE}"]`)!);

    // Remove in the card's upper left is the proof the card opened at all.
    expect(screen.getByRole("button", { name: /^Remove$/ })).toBeTruthy();
    expect(container.querySelector("header")).toBeNull();
  });
});

describe("LiveBoard: the empty slot a reason can go in", () => {
  /**
   * The slot is drawn as a stroked polygon now. It used to be a dashed CSS
   * border on a box clipped to the octagon, and a clip cuts the corners away,
   * so the four straight sides were drawn and the diagonals were not: an
   * invitation to place a reason came out as a broken rectangle.
   */
  it("outlines the whole octagon rather than four straight sides", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <LiveBoard
        gameId={GAME}
        board={boardWithStandingThrow()}
        me={{ playerId: ALICE, role: "plus" }}
        coachEnabled={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Skip tutorial" }));
    await user.hover(container.querySelector(`[data-tile-id="${TILE}"]`)!);

    const outlines = container.querySelectorAll("polygon[stroke-dasharray]");
    expect(outlines.length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".border-dashed").length).toBe(0);
  });
});
