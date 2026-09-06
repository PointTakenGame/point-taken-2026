import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ serviceClient: () => ({ rpc }) }));

const {
  createGame,
  foldCardThrows,
  foldOpponents,
  foldResolutions,
  foldTopics,
  inFlightGame,
  JOIN_CODE_ATTEMPTS,
} = await import("./games");

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
    expect(codes()[0]).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
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
      createGame({ mode: "live", createdBy: PLAYER, joinCode: "MINE1" }),
    ).rejects.toThrow(/duplicate key/);
    expect(codes()).toEqual(["MINE1"]);
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

// The other half of a history row: who it was against, and how contested it
// got. Both folds run over rows the account page cannot afford to project.
describe("foldOpponents", () => {
  const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const ME = "11111111-1111-4111-8111-111111111111";
  const YOU = "22222222-2222-4222-8222-222222222222";
  const THEM = "33333333-3333-4333-8333-333333333333";
  const seat = (game_id: string, player_id: string) => ({ game_id, player_id });

  it("names the seat that is not mine", () => {
    const seats = foldOpponents([seat(A, ME), seat(A, YOU)], ME);
    expect(seats.get(A)).toBe(YOU);
  });

  it("says nothing about a game nobody has joined yet", () => {
    expect(foldOpponents([seat(A, ME)], ME).has(A)).toBe(false);
  });

  it("keeps each game's opponent to itself", () => {
    const seats = foldOpponents(
      [seat(A, ME), seat(A, YOU), seat(B, ME), seat(B, THEM)],
      ME,
    );
    expect([seats.get(A), seats.get(B)]).toEqual([YOU, THEM]);
  });

  it("takes the first to sit when a seat was refilled", () => {
    const seats = foldOpponents([seat(A, YOU), seat(A, THEM)], ME);
    expect(seats.get(A)).toBe(YOU);
  });

  it("returns nothing for no rows", () => {
    expect(foldOpponents([], ME).size).toBe(0);
  });
});

describe("foldCardThrows", () => {
  const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const thrown = (game_id: string, seq: number) => ({
    game_id,
    seq,
    type: "card_thrown" as const,
    payload: { card_id: "you_is_taboo", target_tile_id: "t", rung_id: null },
  });
  const declined = (game_id: string, seq: number, answering: number) => ({
    game_id,
    seq,
    type: "card_throw_declined" as const,
    payload: { in_response_to_seq: answering, reason: null },
  });

  it("counts the throws that stuck", () => {
    expect(foldCardThrows([thrown(A, 5), thrown(A, 9)]).get(A)).toBe(2);
  });

  it("stops counting a throw the author declined", () => {
    expect(foldCardThrows([thrown(A, 5), thrown(A, 9), declined(A, 11, 5)]).get(A)).toBe(
      1,
    );
  });

  it("does not double-subtract a throw declined twice", () => {
    const rows = [thrown(A, 5), declined(A, 11, 5), declined(A, 12, 5)];
    expect(foldCardThrows(rows).get(A)).toBe(0);
  });

  it("ignores a decline pointing at nothing", () => {
    expect(foldCardThrows([thrown(A, 5), declined(A, 11, 99)]).get(A)).toBe(1);
  });

  it("keeps each game's count to itself", () => {
    const counts = foldCardThrows([thrown(A, 5), thrown(B, 5), thrown(B, 7)]);
    expect([counts.get(A), counts.get(B)]).toEqual([1, 2]);
  });

  it("returns nothing for no rows", () => {
    expect(foldCardThrows([]).size).toBe(0);
  });
});

describe("foldResolutions", () => {
  const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const resolved = (game_id: string, emoji: unknown) => ({
    game_id,
    payload: { thread_root_id: "t", emoji, note: null },
  });

  it("counts each token", () => {
    const counts = foldResolutions([
      resolved(A, "\u{1F44D}"),
      resolved(A, "\u{1F44D}"),
      resolved(A, "\u{1F440}"),
    ]);
    expect([...(counts.get(A) ?? [])]).toEqual([
      ["\u{1F44D}", 2],
      ["\u{1F440}", 1],
    ]);
  });

  it("keeps each game's tokens to itself", () => {
    const counts = foldResolutions([resolved(A, "\u{1F44D}"), resolved(B, "\u{1F440}")]);
    expect([counts.get(A)?.size, counts.get(B)?.size]).toEqual([1, 1]);
  });

  it("skips a row whose token is missing or not a string", () => {
    expect(
      foldResolutions([resolved(A, undefined), resolved(A, 7), resolved(A, "")]).size,
    ).toBe(0);
  });

  it("returns nothing for no rows", () => {
    expect(foldResolutions([]).size).toBe(0);
  });
});

describe("inFlightGame", () => {
  const row = (
    id: string,
    status: "lobby" | "active" | "ended",
    mode: "gym" | "live" = "live",
  ) => ({
    id,
    mode,
    level_id: null,
    boss_id: null,
    join_code: null,
    status,
    created_by: null,
    created_at: "2026-09-05T00:00:00Z",
    started_at: null,
    ended_at: null,
    win_condition: null,
  });

  it("picks an active game over a lobby, even listed second", () => {
    const games = [row("lobby-game", "lobby"), row("active-game", "active")];
    expect(inFlightGame(games)?.id).toBe("active-game");
  });

  it("falls back to a lobby when nothing is active", () => {
    const games = [row("ended-game", "ended"), row("lobby-game", "lobby")];
    expect(inFlightGame(games)?.id).toBe("lobby-game");
  });

  it("is mode-blind: a Gym run in progress counts as much as a live game", () => {
    const games = [row("gym-game", "active", "gym")];
    expect(inFlightGame(games)?.id).toBe("gym-game");
  });

  it("returns null when every game is ended", () => {
    expect(inFlightGame([row("a", "ended"), row("b", "ended")])).toBeNull();
  });

  it("returns null for no games", () => {
    expect(inFlightGame([])).toBeNull();
  });

  it("takes the first active game when this player somehow has two", () => {
    const games = [row("first", "active"), row("second", "active")];
    expect(inFlightGame(games)?.id).toBe("first");
  });
});
