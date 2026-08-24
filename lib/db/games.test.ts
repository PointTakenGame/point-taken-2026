import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ serviceClient: () => ({ rpc }) }));

const { createGame, foldTopics, JOIN_CODE_ATTEMPTS } = await import("./games");

const PLAYER = "11111111-1111-4111-8111-111111111111";
const COLLISION = { data: null, error: { code: "23505", message: "duplicate key" } };
const game = (join_code: string | null) => ({
  data: { id: "g", join_code },
  error: null,
});

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

// A history row says which argument it was, and the topic is the only thing on
// a game that a player will recognise. These pin the fold against the same
// cases `projectBoard` handles, since the rule is now written in two places
// and only one of them runs on the account page.
describe("foldTopics", () => {
  const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const set = (game_id: string, seq: number, text: string) => ({
    game_id,
    seq,
    type: "topic_set" as const,
    payload: { text, origin: "custom", topic_id: null },
  });
  const revised = (game_id: string, seq: number, text: string) => ({
    game_id,
    seq,
    type: "topic_revised" as const,
    payload: { text, via_proposal_id: "p" },
  });
  const redact = (game_id: string, seq: number, target_seq: number, path = "text") => ({
    game_id,
    seq,
    type: "content_redacted" as const,
    payload: { target_seq, target_path: path, reason: "author_request" },
  });

  it("takes the last accepted revision over the original", () => {
    const topics = foldTopics([set(A, 2, "first"), revised(A, 9, "second")]);
    expect(topics.get(A)?.text).toBe("second");
  });

  it("lets a later topic_set outrank an earlier revision", () => {
    const topics = foldTopics([
      set(A, 2, "first"),
      revised(A, 9, "second"),
      set(A, 14, "third"),
    ]);
    expect(topics.get(A)?.text).toBe("third");
  });

  it("keeps games apart", () => {
    const topics = foldTopics([set(A, 2, "mine"), set(B, 2, "theirs")]);
    expect(topics.get(A)?.text).toBe("mine");
    expect(topics.get(B)?.text).toBe("theirs");
  });

  it("does not care what order the rows arrive in", () => {
    const topics = foldTopics([revised(A, 9, "second"), set(A, 2, "first")]);
    expect(topics.get(A)?.text).toBe("second");
  });

  it("redacts a topic whose text was taken back, even out of order", () => {
    const topics = foldTopics([redact(A, 30, 2), set(A, 2, "regretted")]);
    expect(topics.get(A)).toEqual({ text: "[redacted]", redacted: true });
  });

  it("ignores a redaction aimed at some other field of the same event", () => {
    const topics = foldTopics([set(A, 2, "kept"), redact(A, 30, 2, "note")]);
    expect(topics.get(A)?.redacted).toBe(false);
  });

  it("leaves a game with no topic out of the map rather than inventing one", () => {
    expect(foldTopics([]).has(A)).toBe(false);
  });
});
