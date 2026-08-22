import { beforeEach, describe, expect, it, vi } from "vitest";

const from = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ serviceClient: () => ({ from }) }));

const { ensureDisplayName, NAME_ATTEMPTS } = await import("./players");

const PLAYER = "11111111-1111-4111-8111-111111111111";

/** One `from("players")` call: either the read or the guarded update. */
function stub(result: { data: unknown; error: unknown }) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    update: () => chain,
    maybeSingle: async () => result,
  };
  return chain;
}

function queue(...results: { data: unknown; error: unknown }[]) {
  const calls: string[] = [];
  let i = 0;
  from.mockImplementation((table: string) => {
    calls.push(table);
    const result = results[i];
    i += 1;
    if (!result) throw new Error(`unexpected call ${i} to ${table}`);
    return stub(result);
  });
  return { calls, taken: () => i };
}

const row = (name: string | null) => ({
  id: PLAYER,
  display_name: name,
  claimed_at: null,
  created_at: "2026-08-22T00:00:00Z",
});

// Braces matter: mockReset returns the mock, and a function returned from
// beforeEach is treated as a teardown hook and called with no arguments.
beforeEach(() => {
  from.mockReset();
});

describe("ensureDisplayName", () => {
  it("leaves an already-named player alone", async () => {
    const q = queue({ data: row("Brisk Copper Otter"), error: null });
    const result = await ensureDisplayName(PLAYER);
    expect(result.display_name).toBe("Brisk Copper Otter");
    expect(q.taken()).toBe(1);
  });

  it("names an unnamed player on the first try", async () => {
    queue(
      { data: row(null), error: null },
      { data: row("Merry Teal Heron"), error: null },
    );
    const result = await ensureDisplayName(PLAYER);
    expect(result.display_name).toBe("Merry Teal Heron");
  });

  it("redraws when the name is taken", async () => {
    const q = queue(
      { data: row(null), error: null },
      { data: null, error: { code: "23505", message: "duplicate key" } },
      { data: null, error: { code: "23505", message: "duplicate key" } },
      { data: row("Sunny Olive Kayak"), error: null },
    );
    const result = await ensureDisplayName(PLAYER);
    expect(result.display_name).toBe("Sunny Olive Kayak");
    expect(q.taken()).toBe(4);
  });

  it("takes the winner's name when another caller got there first", async () => {
    // The guarded update matches no row, so the row is re-read.
    queue(
      { data: row(null), error: null },
      { data: null, error: null },
      { data: row("Quiet Amber Fjord"), error: null },
    );
    const result = await ensureDisplayName(PLAYER);
    expect(result.display_name).toBe("Quiet Amber Fjord");
  });

  it("rethrows anything that is not a collision", async () => {
    queue(
      { data: row(null), error: null },
      { data: null, error: { code: "42501", message: "permission denied" } },
    );
    await expect(ensureDisplayName(PLAYER)).rejects.toThrow(/permission denied/);
  });

  it("gives up after the attempt budget instead of looping", async () => {
    const collision = { data: null, error: { code: "23505", message: "dup" } };
    queue(
      { data: row(null), error: null },
      ...Array.from({ length: NAME_ATTEMPTS }, () => collision),
    );
    await expect(ensureDisplayName(PLAYER)).rejects.toThrow(/could not find/);
  });

  it("refuses a player with no row", async () => {
    queue({ data: null, error: null });
    await expect(ensureDisplayName(PLAYER)).rejects.toThrow(/no players row/);
  });
});
