import { beforeEach, describe, expect, it, vi } from "vitest";

const from = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ serviceClient: () => ({ from }) }));

const stats = vi.fn();
vi.mock("./stats", () => ({ getPlayerStats: (id: string) => stats(id) }));

const { readLeaderboard } = await import("./leaderboard");

const ALICE = "11111111-1111-4111-8111-111111111111";
const BRUNO = "22222222-2222-4222-8222-222222222222";
const BOSS = "b055b055-0000-4000-8000-000000000001";

/**
 * A PostgREST builder is thenable, so the calls under test await the chain
 * itself rather than a terminal method. Every filter is a no-op here: the
 * three queries arrive in a fixed order and the queue answers by position.
 */
function builder(result: unknown) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    then: (resolve: (value: unknown) => void) => resolve(result),
  };
  return chain;
}

/** In call order: the roster, the bosses, then the names of the leaders. */
function queue(...results: unknown[]) {
  let i = 0;
  from.mockImplementation(() => {
    const result = results[i];
    i += 1;
    if (result === undefined) throw new Error(`unexpected query ${i}`);
    return builder(result);
  });
}

function statsFor(playerId: string, threadsResolved: number) {
  return {
    player_id: playerId,
    games_played: 2,
    games_by_win_condition: { threads_resolved: 1 },
    threads_resolved: threadsResolved,
    tiles_placed: 9,
  };
}

beforeEach(() => {
  from.mockReset();
  stats.mockReset();
});

describe("readLeaderboard", () => {
  it("leaves the Gym bosses off it", async () => {
    queue(
      {
        data: [
          { player_id: ALICE },
          { player_id: BOSS },
          { player_id: BOSS },
          { player_id: BOSS },
          { player_id: BRUNO },
        ],
        error: null,
      },
      { data: [{ id: BOSS }], error: null },
      {
        data: [
          { id: ALICE, display_name: "Alice" },
          { id: BRUNO, display_name: "Bruno" },
        ],
        error: null,
      },
    );
    stats.mockImplementation(async (id: string) => statsFor(id, id === ALICE ? 5 : 3));

    const rows = await readLeaderboard("cooperation");

    expect(rows.map((row) => row.playerId)).toEqual([ALICE, BRUNO]);
    // The boss was seated in the most games and is still not asked for stats.
    expect(stats.mock.calls.map(([id]) => id)).not.toContain(BOSS);
    expect(rows[0].cooperation).toBe(5);
  });

  it("reads cooperation as threads agreed, the same number the profile shows", async () => {
    queue(
      { data: [{ player_id: ALICE }], error: null },
      { data: [], error: null },
      { data: [{ id: ALICE, display_name: "Alice" }], error: null },
    );
    stats.mockImplementation(async (id: string) => statsFor(id, 7));

    const [row] = await readLeaderboard("cooperation");
    expect(row.cooperation).toBe(7);
  });
});
