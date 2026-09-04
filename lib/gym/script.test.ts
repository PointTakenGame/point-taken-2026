import { describe, expect, it } from "vitest";

import { projectBoard } from "@/lib/board/project";
import {
  type AnyGameEvent,
  type EventPayloads,
  type GameEventType,
} from "@/lib/events/types";
import { ONBOARDING } from "@/lib/gym/levels/onboarding";
import { ALL_PAUSES_DISMISSED, currentBeat, levelProgress } from "@/lib/gym/script";

const GAME = "00000000-0000-4000-8000-000000000000";
/** Level 1 seats the player on minus and Bashful Bob on plus. */
const PLAYER = "11111111-1111-4111-8111-111111111111";
const BOB = "b055b055-0000-4000-8000-000000000001";
const ROLE: Record<string, "plus" | "minus"> = { [PLAYER]: "minus", [BOB]: "plus" };

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
      actor_role: actorId ? (ROLE[actorId] ?? "server") : "server",
      source: actorId === BOB ? "system" : "human",
      actor_id: actorId,
      payload,
      created_at: "2026-09-03T00:00:00Z",
    } as AnyGameEvent);
    return events.length;
  };
  let n = 0;
  const tile = (by: string, parent: string | null, root: string | null, text: string) => {
    n += 1;
    const id = `t${n}`;
    push(
      "tile_placed",
      {
        tile_id: id,
        parent_tile_id: parent,
        thread_root_id: root ?? id,
        side: ROLE[by],
        text,
      },
      by,
    );
    return id;
  };
  const board = () => projectBoard(events);
  return { events, push, tile, board };
}

/** Level 1's cooked room: two seats, Bob signed, topic set, started. */
function opened() {
  const l = log();
  l.push("game_created", {
    mode: "gym",
    level_id: ONBOARDING.id,
    boss_id: ONBOARDING.bossId,
    join_code: null,
  });
  l.push("player_joined", { display_name: "Brisk Copper Otter" }, PLAYER);
  l.push("player_joined", { display_name: ONBOARDING.bossName }, BOB);
  l.push("role_selected", { role: "minus" }, PLAYER);
  l.push("role_selected", { role: "plus" }, BOB);
  l.push("topic_set", {
    text: ONBOARDING.topic,
    origin: "custom",
    topic_id: ONBOARDING.topicId,
  });
  l.push("agreement_signed", { items: ["mutual_respect"] }, BOB);
  l.push("agreement_signed", { items: ["mutual_respect"] }, PLAYER);
  l.push("game_started", {
    card_set: { policy: "intersection", card_ids: [], raised_by: null },
    coach: null,
  });
  return l;
}

const beatAt = (l: ReturnType<typeof log>, dismissed?: ReadonlySet<string>) =>
  currentBeat(ONBOARDING, levelProgress(ONBOARDING, l.board(), dismissed))?.id;

describe("levelProgress on level 1", () => {
  it("opens on the first pause, and the boss's beat once it is read", () => {
    const l = opened();
    expect(beatAt(l)).toBe("p1-board");
    expect(beatAt(l, new Set(["p1-board"]))).toBe("bob-root-a");
    expect(beatAt(l, ALL_PAUSES_DISMISSED)).toBe("bob-root-a");
  });

  it("binds the boss's root tile to key A and stops on the next pause", () => {
    const l = opened();
    const a = l.tile(BOB, null, null, "A hot dog is meat in bread.");
    const progress = levelProgress(ONBOARDING, l.board());
    expect(progress.keys.A).toBe(a);
    expect(progress.done).toEqual(["p1-board", "bob-root-a"]);
    expect(currentBeat(ONBOARDING, progress)?.id).toBe("p2-reason-tile");
  });

  it("treats a pause as read once the player has moved past it", () => {
    const l = opened();
    l.tile(BOB, null, null, "A hot dog is meat in bread.");
    const b = l.tile(PLAYER, null, null, "A sandwich needs two separate slices.");
    // Nothing dismissed, yet p2 is done: the player's tile is the evidence.
    const progress = levelProgress(ONBOARDING, l.board());
    expect(progress.keys.B).toBe(b);
    expect(progress.done).toContain("p2-reason-tile");
    expect(currentBeat(ONBOARDING, progress)?.id).toBe("bob-answers-b");
    expect(progress.cursor).toBe(l.events.length);
  });

  it("binds answers by parent and side, in order", () => {
    const l = opened();
    const a = l.tile(BOB, null, null, "A hot dog is meat in bread.");
    const b = l.tile(PLAYER, null, null, "A sandwich needs two separate slices.");
    const b1 = l.tile(BOB, b, b, "A hoagie roll is hinged too.");
    const a1 = l.tile(PLAYER, a, a, "Then a taco is a sandwich.");
    const a2 = l.tile(BOB, a1, a, "A taco is a wrap.");
    const b2 = l.tile(PLAYER, b1, b, "Delis file hoagies under sandwiches.");
    const progress = levelProgress(ONBOARDING, l.board(), ALL_PAUSES_DISMISSED);
    expect(progress.keys).toEqual({ A: a, B: b, B1: b1, A1: a1, A2: a2, B2: b2 });
    expect(currentBeat(ONBOARDING, progress)?.id).toBe("bob-token-b");
  });

  it("does not bind a tile the player hung in the wrong place", () => {
    const l = opened();
    const a = l.tile(BOB, null, null, "A hot dog is meat in bread.");
    // The script wants a root tile from the player; this one answers A.
    l.tile(PLAYER, a, a, "Then a taco is a sandwich.");
    const progress = levelProgress(ONBOARDING, l.board(), ALL_PAUSES_DISMISSED);
    expect(progress.keys.B).toBeUndefined();
    expect(currentBeat(ONBOARDING, progress)?.id).toBe("player-root-b");
    // The board moved past the cursor, which is what the director reads as a nudge.
    expect(l.board().lastSeq).toBeGreaterThan(progress.cursor);
  });

  it("walks tokens, the throw, the revision and the ending to completion", () => {
    const l = opened();
    const a = l.tile(BOB, null, null, "A hot dog is meat in bread.");
    const b = l.tile(PLAYER, null, null, "A sandwich needs two separate slices.");
    const b1 = l.tile(BOB, b, b, "A hoagie roll is hinged too.");
    const a1 = l.tile(PLAYER, a, a, "Then a taco is a sandwich.");
    l.tile(BOB, a1, a, "A taco is a wrap.");
    l.tile(PLAYER, b1, b, "Delis file hoagies under sandwiches.");

    l.push("resolution_emoji_placed", { thread_root_id: b, emoji: "👍" }, BOB);
    expect(beatAt(l, ALL_PAUSES_DISMISSED)).toBe("player-token-b");
    l.push("resolution_emoji_placed", { thread_root_id: b, emoji: "👍" }, PLAYER);
    l.push("thread_resolved", { thread_root_id: b, emoji: "👍", note: null });
    expect(beatAt(l, ALL_PAUSES_DISMISSED)).toBe("bob-violation");

    const a3 = l.tile(
      BOB,
      a1,
      a,
      "You only say that because you have never had one at the ballpark.",
    );
    expect(beatAt(l, ALL_PAUSES_DISMISSED)).toBe("player-throws");
    const throwSeq = l.push(
      "card_thrown",
      { card_id: "you_is_taboo", rung_id: null, target_tile_id: a3 },
      PLAYER,
    );
    expect(beatAt(l, ALL_PAUSES_DISMISSED)).toBe("bob-revises");
    l.push(
      "tile_revised",
      {
        tile_id: a3,
        text: "At the ballpark nobody calls it a sandwich.",
        in_response_to_seq: throwSeq,
      },
      BOB,
    );
    expect(beatAt(l, ALL_PAUSES_DISMISSED)).toBe("player-token-a");

    l.push("resolution_emoji_placed", { thread_root_id: a, emoji: "👀" }, PLAYER);
    expect(beatAt(l, ALL_PAUSES_DISMISSED)).toBe("bob-token-a");
    l.push("resolution_emoji_placed", { thread_root_id: a, emoji: "👀" }, BOB);
    l.push("thread_resolved", { thread_root_id: a, emoji: "👀", note: null });
    expect(beatAt(l, ALL_PAUSES_DISMISSED)).toBe("win");
    l.push("game_ended", { win_condition: "threads_resolved" });

    const progress = levelProgress(ONBOARDING, l.board(), ALL_PAUSES_DISMISSED);
    expect(progress.complete).toBe(true);
    expect(progress.done).toHaveLength(ONBOARDING.beats.length);
  });
});

/**
 * BRAIN-T260904: a player who places a legal token that is not the one the
 * script narrates must still end the level. Before this fix, the walker's
 * player-token match required the exact scripted emoji, so bossAct
 * (app/gym/actions.ts) saw the current beat as still the player's, decided
 * there was nothing to do, and the boss never mirrored back, so the thread
 * and then the game never resolved.
 *
 * app/gym/actions.ts's bossAct and settle hit the real database
 * (appendGameEvent, readGameEvents), so this does not call them directly.
 * It drives the same event log a real game produces, computing the boss's
 * move with mirroredBossToken, a pure stand-in for bossAct's fixed token
 * case (mirror the player's actual pending token, falling back to the
 * scripted one only when the player has not moved yet). That is the walker
 * plus a pure next-boss-move function, in place of an end-to-end test.
 */
describe("a legal token that is not the scripted one still ends level 1", () => {
  function mirroredBossToken(
    board: ReturnType<typeof projectBoard>,
    rootId: string,
    playerSide: "plus" | "minus",
    scripted: "👍" | "👀",
  ): "👍" | "👀" {
    const thread = board.threads.find((t) => t.rootId === rootId);
    const pending = thread?.pending[playerSide];
    return pending === "👍" || pending === "👀" ? pending : scripted;
  }

  it("resolves both threads and ends the game when the player answers 👍 where the script says 👀", () => {
    const l = opened();
    const a = l.tile(BOB, null, null, "A hot dog is meat in bread.");
    const b = l.tile(PLAYER, null, null, "A sandwich needs two separate slices.");
    const b1 = l.tile(BOB, b, b, "A hoagie roll is hinged too.");
    const a1 = l.tile(PLAYER, a, a, "Then a taco is a sandwich.");
    l.tile(BOB, a1, a, "A taco is a wrap.");
    l.tile(PLAYER, b1, b, "Delis file hoagies under sandwiches.");

    // Thread B: the boss goes first with the scripted 👍 and the player
    // matches it exactly. No deviation on this side, the control for the
    // deviation on thread A below.
    l.push("resolution_emoji_placed", { thread_root_id: b, emoji: "👍" }, BOB);
    l.push("resolution_emoji_placed", { thread_root_id: b, emoji: "👍" }, PLAYER);
    const mirroredB = mirroredBossToken(l.board(), b, "minus", "👍");
    expect(mirroredB).toBe("👍");
    l.push("thread_resolved", { thread_root_id: b, emoji: mirroredB, note: null });
    expect(beatAt(l, ALL_PAUSES_DISMISSED)).toBe("bob-violation");

    const a3 = l.tile(
      BOB,
      a1,
      a,
      "You only say that because you have never had one at the ballpark.",
    );
    const throwSeq = l.push(
      "card_thrown",
      { card_id: "you_is_taboo", rung_id: null, target_tile_id: a3 },
      PLAYER,
    );
    l.push(
      "tile_revised",
      {
        tile_id: a3,
        text: "At the ballpark nobody calls it a sandwich.",
        in_response_to_seq: throwSeq,
      },
      BOB,
    );
    expect(beatAt(l, ALL_PAUSES_DISMISSED)).toBe("player-token-a");

    // Thread A: the script narrates 👀 here. The player places 👍 instead,
    // a different token that is just as legal. The walker's loosened
    // player-token match (lib/gym/script.ts) still counts this beat as
    // done, because the player has some pending token on the thread.
    l.push("resolution_emoji_placed", { thread_root_id: a, emoji: "👍" }, PLAYER);
    expect(beatAt(l, ALL_PAUSES_DISMISSED)).toBe("bob-token-a");

    // The boss mirrors what the player actually placed, 👍, not the
    // scripted 👀. That mirroring, not a match against the script, is what
    // closes the thread.
    const mirroredA = mirroredBossToken(l.board(), a, "minus", "👀");
    expect(mirroredA).toBe("👍");
    l.push("resolution_emoji_placed", { thread_root_id: a, emoji: mirroredA }, BOB);
    l.push("thread_resolved", { thread_root_id: a, emoji: mirroredA, note: null });
    l.push("game_ended", { win_condition: "threads_resolved" });

    expect(l.board().status).toBe("ended");
    expect(l.board().threads.every((thread) => thread.resolution !== null)).toBe(true);
  });
});
