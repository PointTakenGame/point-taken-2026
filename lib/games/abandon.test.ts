import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnyGameEvent, EventPayloads, GameEventType } from "@/lib/events/types";

const GAME = "00000000-0000-4000-8000-000000000000";
const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";

/**
 * `inFlightGame` is a pure lookup with no db call, so it is kept real; only
 * the async `listGamesForPlayer` is stubbed.
 */
const listGamesForPlayer = vi.fn();
vi.mock("@/lib/db/games", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db/games")>("@/lib/db/games");
  return { ...actual, listGamesForPlayer };
});

const appendGameEvent = vi.fn();
const readGameEvents = vi.fn();
vi.mock("@/lib/events/append", () => ({ appendGameEvent, readGameEvents }));

const { endInFlightGame } = await import("./abandon");

/** Numbers seqs the way the database does, mirroring lib/board/rules.test.ts. */
function makeLog(events: AnyGameEvent[]) {
  return function push<T extends GameEventType>(
    type: T,
    payload: EventPayloads[T],
    actorId: string | null,
    source: "human" | "system" = "human",
  ) {
    events.push({
      id: `e${events.length + 1}`,
      game_id: GAME,
      seq: events.length + 1,
      type,
      schema_version: 1,
      actor_role: actorId === BOB ? "minus" : "plus",
      source,
      actor_id: actorId,
      payload,
      created_at: "2026-08-22T00:00:00Z",
    } as AnyGameEvent);
  };
}

/** A live lobby, both seated, waiting to start: an in-flight game to leave. */
function seededEvents(): AnyGameEvent[] {
  const events: AnyGameEvent[] = [];
  const push = makeLog(events);
  push(
    "game_created",
    { mode: "live", level_id: null, boss_id: null, join_code: "PTKN99" },
    null,
  );
  push("player_joined", { display_name: "Brisk Copper Otter" }, ALICE);
  push("player_joined", { display_name: "Quiet Amber Fjord" }, BOB);
  return events;
}

/** A live, in-progress `games` row shape: only the fields `inFlightGame` reads. */
const LOBBY_ROW = { id: GAME, status: "lobby" as const };

beforeEach(() => {
  listGamesForPlayer.mockReset();
  appendGameEvent.mockReset();
  readGameEvents.mockReset();
});

describe("endInFlightGame", () => {
  it("appends player_left once for a single call", async () => {
    const events = seededEvents();
    listGamesForPlayer.mockResolvedValue([LOBBY_ROW]);
    readGameEvents.mockImplementation(async () => events);
    appendGameEvent.mockImplementation(
      async (gameId: string, event: Record<string, unknown>) => {
        makeLog(events)(
          event.type as GameEventType,
          event.payload as EventPayloads[GameEventType],
          (event.actorId as string | null) ?? null,
          event.source as "human" | "system",
        );
        return { id: "row", game_id: gameId };
      },
    );

    await endInFlightGame(ALICE);

    const leaves = appendGameEvent.mock.calls.filter(
      ([, event]) => event.type === "player_left",
    );
    expect(leaves).toHaveLength(1);
  });

  it("appends player_left exactly once when two calls race for the same player", async () => {
    // Finding 2 (2026-09-05 pre-push review): endInFlightGame reads the board,
    // decides the player has not left yet, and only then appends player_left.
    // Two calls racing on that read both used to see the same "not left yet"
    // state and both append, producing a duplicate event on the log. This
    // proves the fix: firing endInFlightGame(ALICE) twice at once for the same
    // player must still land at most one player_left, because the second call
    // is queued behind the first (lib/games/abandon.ts's withGameLock) and so
    // reads the first call's write before deciding anything.
    const events = seededEvents();
    listGamesForPlayer.mockResolvedValue([LOBBY_ROW]);
    readGameEvents.mockImplementation(async () => events);
    appendGameEvent.mockImplementation(
      async (gameId: string, event: Record<string, unknown>) => {
        makeLog(events)(
          event.type as GameEventType,
          event.payload as EventPayloads[GameEventType],
          (event.actorId as string | null) ?? null,
          event.source as "human" | "system",
        );
        return { id: "row", game_id: gameId };
      },
    );

    await Promise.all([endInFlightGame(ALICE), endInFlightGame(ALICE)]);

    const leaves = appendGameEvent.mock.calls.filter(
      ([, event]) => event.type === "player_left",
    );
    expect(leaves).toHaveLength(1);
  });

  it("does nothing when there is no unfinished game", async () => {
    listGamesForPlayer.mockResolvedValue([]);

    await endInFlightGame(ALICE);

    expect(readGameEvents).not.toHaveBeenCalled();
    expect(appendGameEvent).not.toHaveBeenCalled();
  });
});
