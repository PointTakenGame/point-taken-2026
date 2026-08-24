import { describe, expect, it } from "vitest";

import { projectBoard } from "@/lib/board/project";
import type { AnyGameEvent, EventPayloads, GameEventType } from "@/lib/events/types";
import { COACH_CARDS, coachCard, coachCardsMatchDeck } from "./cards";

const GAME = "00000000-0000-4000-8000-000000000000";
const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";
const TILE = "33333333-3333-4333-8333-333333333333";

function log() {
  const events: AnyGameEvent[] = [];
  const push = <T extends GameEventType>(
    type: T,
    payload: EventPayloads[T],
    actorId: string | null = null,
  ) => {
    events.push({
      id: `e${events.length + 1}`,
      game_id: GAME,
      seq: events.length + 1,
      type,
      schema_version: 1,
      actor_role: "plus",
      source: "human",
      actor_id: actorId,
      payload,
      created_at: "2026-08-23T00:00:00Z",
    } as AnyGameEvent);
    return events.length;
  };
  return { events, push };
}

function reading(forPlayer: string, tileId = TILE) {
  return {
    tile_id: tileId,
    error_types: ["you_is_taboo"],
    feedback: "This aims at the person, not the claim.",
    suggestion: "Say what the policy does instead.",
    model_name: "claude-sonnet-5",
    prompt_versions: { coach: "brain-2026-08-23.1" },
    evaluator_schema_version: "coach-v1",
    latency_ms: 900,
  } satisfies EventPayloads["ai_feedback_returned"];
}

describe("the coach's deck", () => {
  it("never drifts from the rule cards the game deals", () => {
    // Fails loudly rather than letting the coach cite a card nobody holds.
    expect(() => coachCardsMatchDeck()).not.toThrow();
  });

  it("looks a card up by id and shrugs at an unknown one", () => {
    expect(coachCard(COACH_CARDS[0].id)?.name).toBe(COACH_CARDS[0].name);
    expect(coachCard("no_such_card")).toBeUndefined();
  });
});

describe("coach readings in the projection", () => {
  it("carries who each reading was written for", () => {
    const l = log();
    l.push("ai_feedback_returned", reading(ALICE), ALICE);
    l.push("ai_feedback_returned", reading(BOB), BOB);

    const board = projectBoard(l.events);
    expect(board.coachReadings.map((r) => r.forPlayer)).toEqual([ALICE, BOB]);
    // The service role reads past RLS, so both sides land here. The filter the
    // board applies is the one that keeps a player out of the other's notes.
    expect(board.coachReadings.filter((r) => r.forPlayer === ALICE)).toHaveLength(1);
  });

  it("marks a reading shown once it is dismissed", () => {
    const l = log();
    const seq = l.push("ai_feedback_returned", reading(ALICE), ALICE);
    l.push("ai_feedback_shown", { in_response_to_seq: seq }, ALICE);

    const board = projectBoard(l.events);
    expect(board.coachReadings[0].shown).toBe(true);
  });

  it("ignores a dismissal that points at nothing", () => {
    const l = log();
    l.push("ai_feedback_shown", { in_response_to_seq: 99 }, ALICE);
    expect(projectBoard(l.events).coachReadings).toEqual([]);
  });
});
