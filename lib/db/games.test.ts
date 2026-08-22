import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ serviceClient: () => ({ rpc }) }));

const { createGame, JOIN_CODE_ATTEMPTS } = await import("./games");

const PLAYER = "11111111-1111-4111-8111-111111111111";
const COLLISION = { data: null, error: { code: "23505", message: "duplicate key" } };
const game = (join_code: string | null) => ({ data: { id: "g", join_code }, error: null });

const codes = () => rpc.mock.calls.map((c) => c[1].p_join_code);

// Braces matter: mockReset returns the mock, and a function returned from
// beforeEach is treated as a teardown hook and called with no arguments.
beforeEach(() => {
  rpc.mockReset();
});

describe("createGame", () => {
  it("draws a join code for a live game", async () => {
    rpc.mockResolvedValueOnce(game("ABC234"));
    await createGame({ mode: "live", createdBy: PLAYER });
    expect(codes()[0]).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it("redraws when the code it chose is taken", async () => {
    rpc
      .mockResolvedValueOnce(COLLISION)
      .mockResolvedValueOnce(COLLISION)
      .mockResolvedValueOnce(game("XYZ789"));
    await createGame({ mode: "live", createdBy: PLAYER });
    const drawn = codes();
    expect(drawn).toHaveLength(3);
    expect(new Set(drawn).size).toBe(3);
  });

  it("gives up after the attempt budget instead of looping", async () => {
    rpc.mockResolvedValue(COLLISION);
    await expect(createGame({ mode: "live", createdBy: PLAYER })).rejects.toThrow(
      /free join code/,
    );
    expect(rpc).toHaveBeenCalledTimes(JOIN_CODE_ATTEMPTS);
  });

  it("tells a caller who named a code that it is taken, rather than swapping it", async () => {
    rpc.mockResolvedValue(COLLISION);
    await expect(
      createGame({ mode: "live", createdBy: PLAYER, joinCode: "MINE12" }),
    ).rejects.toThrow(/duplicate key/);
    expect(codes()).toEqual(["MINE12"]);
  });

  it("draws no code for a gym run", async () => {
    rpc.mockResolvedValueOnce(game(null));
    await createGame({ mode: "gym", createdBy: PLAYER });
    expect(codes()).toEqual([null]);
  });

  it("refuses a gym run that was handed a code", async () => {
    await expect(
      createGame({ mode: "gym", createdBy: PLAYER, joinCode: "ABC234" }),
    ).rejects.toThrow(/nobody to invite/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rethrows anything that is not a collision", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    await expect(createGame({ mode: "live", createdBy: PLAYER })).rejects.toThrow(
      /permission denied/,
    );
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
