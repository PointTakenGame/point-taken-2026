import { describe, expect, it } from "vitest";
import { projectBoard } from "./project";
import {
  FIRST_RELEASE_CARD_IDS,
  MAX_PLAYERS,
  SIGNING_LINE_IDS,
  TOPIC_LIBRARY,
  TOPIC_MAX_CHARS,
  boardIsLobby,
  canChooseSide,
  canJoin,
  canSetTopic,
  canSign,
  canStartGame,
  hasLeft,
  startingCardSet,
} from "./setup";
import type { AnyGameEvent, EventPayloads, GameEventType } from "@/lib/events/types";

const GAME = "00000000-0000-4000-8000-000000000000";
const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";
const CAROL = "33333333-3333-4333-8333-333333333333";

/** Same shaping as rules.test.ts: seqs numbered the way the database does. */
function log() {
  const events: AnyGameEvent[] = [];
  const push = <T extends GameEventType>(
    type: T,
    payload: EventPayloads[T],
    actorId: string | null = null,
    role: "plus" | "minus" | "server" = "server",
  ) => {
    events.push({
      id: `e${events.length + 1}`,
      game_id: GAME,
      seq: events.length + 1,
      type,
      schema_version: 1,
      actor_role: role,
      source: "human",
      actor_id: actorId,
      payload,
      created_at: "2026-08-23T00:00:00Z",
    } as AnyGameEvent);
  };
  return { events, push };
}

/** A live room that has been created and nothing more. */
function fresh() {
  const l = log();
  l.push("game_created", {
    mode: "live",
    level_id: null,
    boss_id: null,
    join_code: "PTKN23",
  });
  return l;
}

/** Both seated, sides picked, topic set. Everything but the signatures. */
function nearlyReady() {
  const l = fresh();
  l.push("player_joined", { display_name: "Brisk Copper Otter" }, ALICE);
  l.push("player_joined", { display_name: "Quiet Amber Fjord" }, BOB);
  l.push("role_selected", { role: "plus" }, ALICE, "plus");
  l.push("role_selected", { role: "minus" }, BOB, "minus");
  l.push("topic_set", {
    text: TOPIC_LIBRARY[0].text,
    origin: "library",
    topic_id: TOPIC_LIBRARY[0].id,
  });
  return l;
}

const sign = (l: ReturnType<typeof log>, who: string, role: "plus" | "minus") =>
  l.push("agreement_signed", { items: [...SIGNING_LINE_IDS] }, who, role);

describe("content", () => {
  it("signs three lines, the count the 2026-08-22 ruling settled on", () => {
    expect(SIGNING_LINE_IDS).toHaveLength(3);
    expect(new Set(SIGNING_LINE_IDS).size).toBe(3);
  });

  it("ships four rule cards, and startingCardSet hands out exactly those", () => {
    expect(FIRST_RELEASE_CARD_IDS).toHaveLength(4);
    expect(startingCardSet()).toEqual({
      policy: "intersection",
      card_ids: [...FIRST_RELEASE_CARD_IDS],
      raised_by: null,
    });
  });

  it("keeps library topic ids unique and their text inside the ceiling", () => {
    const ids = TOPIC_LIBRARY.map((topic) => topic.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const topic of TOPIC_LIBRARY) {
      expect(topic.text.length).toBeGreaterThan(0);
      expect(topic.text.length).toBeLessThanOrEqual(TOPIC_MAX_CHARS);
    }
  });
});

describe("boardIsLobby", () => {
  it("opens a fresh room", () => {
    expect(boardIsLobby(projectBoard(fresh().events)).ok).toBe(true);
  });

  it("refuses a game already under way", () => {
    const l = nearlyReady();
    sign(l, ALICE, "plus");
    sign(l, BOB, "minus");
    l.push("game_started", {
      card_set: { policy: "intersection", card_ids: [], raised_by: null },
      coach: null,
    });
    expect(boardIsLobby(projectBoard(l.events))).toMatchObject({
      ok: false,
      error: "That game has already started.",
    });
  });

  it("refuses a game that has ended", () => {
    const l = fresh();
    l.push("game_ended", { win_condition: "abandoned" });
    expect(boardIsLobby(projectBoard(l.events))).toMatchObject({ ok: false });
  });
});

describe("canJoin", () => {
  it("lets a stranger into an empty room", () => {
    expect(canJoin(projectBoard(fresh().events), CAROL).ok).toBe(true);
  });

  it("turns away a third player", () => {
    const l = nearlyReady();
    expect(canJoin(projectBoard(l.events), CAROL)).toMatchObject({
      ok: false,
      error: "That room is full.",
    });
  });

  it("lets someone who is already seated back in", () => {
    const l = nearlyReady();
    expect(canJoin(projectBoard(l.events), ALICE).ok).toBe(true);
  });

  // The database decides this one. The trigger in 0004 counts every
  // game_players row, departed or not, and raises on a third, so a seat that
  // reads as free here would be a promise the insert refuses.
  it("keeps the seat of a player who quit", () => {
    const l = nearlyReady();
    l.push("player_left", { reason: "quit" }, BOB, "minus");
    expect(canJoin(projectBoard(l.events), CAROL)).toMatchObject({
      ok: false,
      error: "That room is full.",
    });
  });

  it("lets the player who quit walk back in", () => {
    const l = nearlyReady();
    l.push("player_left", { reason: "quit" }, BOB, "minus");
    expect(canJoin(projectBoard(l.events), BOB).ok).toBe(true);
  });
});

describe("hasLeft", () => {
  it("is false for somebody still in the room", () => {
    expect(hasLeft(projectBoard(nearlyReady().events), BOB)).toBe(false);
  });

  it("is false for somebody who was never in it", () => {
    expect(hasLeft(projectBoard(nearlyReady().events), CAROL)).toBe(false);
  });

  it("is true once they quit", () => {
    const l = nearlyReady();
    l.push("player_left", { reason: "quit" }, BOB, "minus");
    expect(hasLeft(projectBoard(l.events), BOB)).toBe(true);
  });

  // Matches isAbandoned and canStartGame, which both count a dropped
  // connection as still present.
  it("is false for a dropped connection", () => {
    const l = nearlyReady();
    l.push("player_left", { reason: "disconnect" }, BOB, "minus");
    expect(hasLeft(projectBoard(l.events), BOB)).toBe(false);
  });
});

describe("canChooseSide", () => {
  it("refuses a player who is not in the room", () => {
    expect(canChooseSide(projectBoard(fresh().events), CAROL, "plus").ok).toBe(false);
  });

  it("takes a free side", () => {
    const l = fresh();
    l.push("player_joined", { display_name: "Brisk Copper Otter" }, ALICE);
    expect(canChooseSide(projectBoard(l.events), ALICE, "plus").ok).toBe(true);
  });

  it("refuses the side the other player is on", () => {
    const l = nearlyReady();
    expect(canChooseSide(projectBoard(l.events), ALICE, "minus")).toMatchObject({
      ok: false,
      error: "The other player is already on that side.",
    });
  });

  it("lets a player re-affirm the side they already hold", () => {
    const l = nearlyReady();
    expect(canChooseSide(projectBoard(l.events), ALICE, "plus").ok).toBe(true);
  });
});

describe("canSetTopic", () => {
  const board = () => projectBoard(nearlyReady().events);

  it("accepts a plain statement", () => {
    expect(canSetTopic(board(), "Cities should cap rents.").ok).toBe(true);
  });

  it("refuses whitespace", () => {
    expect(canSetTopic(board(), "   ").ok).toBe(false);
  });

  it("refuses a statement past the ceiling", () => {
    expect(canSetTopic(board(), "x".repeat(TOPIC_MAX_CHARS + 1)).ok).toBe(false);
  });
});

describe("canSign", () => {
  it("requires every line", () => {
    const l = nearlyReady();
    expect(canSign(projectBoard(l.events), ALICE, [SIGNING_LINE_IDS[0]])).toMatchObject({
      ok: false,
      error: "Signing means standing behind every line.",
    });
  });

  it("accepts the complete set", () => {
    const l = nearlyReady();
    expect(canSign(projectBoard(l.events), ALICE, [...SIGNING_LINE_IDS]).ok).toBe(true);
  });

  it("refuses a second signature", () => {
    const l = nearlyReady();
    sign(l, ALICE, "plus");
    expect(canSign(projectBoard(l.events), ALICE, [...SIGNING_LINE_IDS]).ok).toBe(false);
  });
});

describe("canStartGame", () => {
  it("waits for the second player", () => {
    const l = fresh();
    l.push("player_joined", { display_name: "Brisk Copper Otter" }, ALICE);
    expect(canStartGame(projectBoard(l.events))).toMatchObject({
      ok: false,
      error: "Waiting for the other player.",
    });
  });

  it("waits for both sides to be picked", () => {
    const l = fresh();
    l.push("player_joined", { display_name: "Brisk Copper Otter" }, ALICE);
    l.push("player_joined", { display_name: "Quiet Amber Fjord" }, BOB);
    expect(canStartGame(projectBoard(l.events))).toMatchObject({
      ok: false,
      error: "Both players need to pick a side.",
    });
  });

  it("refuses two players on the same side", () => {
    const l = fresh();
    l.push("player_joined", { display_name: "Brisk Copper Otter" }, ALICE);
    l.push("player_joined", { display_name: "Quiet Amber Fjord" }, BOB);
    l.push("role_selected", { role: "plus" }, ALICE, "plus");
    // Only reachable if the projection ever let it through; the rule is the
    // backstop, so it is asserted here rather than assumed.
    l.push("role_selected", { role: "plus" }, BOB, "plus");
    expect(canStartGame(projectBoard(l.events))).toMatchObject({
      ok: false,
      error: "Somebody has to argue the other way.",
    });
  });

  it("waits for the topic", () => {
    const l = fresh();
    l.push("player_joined", { display_name: "Brisk Copper Otter" }, ALICE);
    l.push("player_joined", { display_name: "Quiet Amber Fjord" }, BOB);
    l.push("role_selected", { role: "plus" }, ALICE, "plus");
    l.push("role_selected", { role: "minus" }, BOB, "minus");
    expect(canStartGame(projectBoard(l.events))).toMatchObject({
      ok: false,
      error: "Pick a topic first.",
    });
  });

  it("waits for both signatures", () => {
    const l = nearlyReady();
    sign(l, ALICE, "plus");
    expect(canStartGame(projectBoard(l.events))).toMatchObject({
      ok: false,
      error: "Both players still have to sign.",
    });
  });

  it("starts once everything is settled", () => {
    const l = nearlyReady();
    sign(l, ALICE, "plus");
    sign(l, BOB, "minus");
    const board = projectBoard(l.events);
    expect(board.players).toHaveLength(MAX_PLAYERS);
    expect(canStartGame(board).ok).toBe(true);
  });
});
