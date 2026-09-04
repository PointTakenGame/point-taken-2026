import { describe, expect, it } from "vitest";

import { projectBoard } from "@/lib/board/project";
import type {
  AnyGameEvent,
  EventPayloads,
  GameEventType,
  ProposalContent,
  Side,
} from "@/lib/events/types";
import { SCRIPTED_LEVELS } from "@/lib/gym/levels";
import {
  ALL_PAUSES_DISMISSED,
  currentBeat,
  levelBadges,
  levelProgress,
  renderText,
  scriptContext,
  type Beat,
  type Level,
} from "@/lib/gym/script";

/**
 * Every beat of every level, played through.
 *
 * `script.test.ts` beside this file takes level 1 apart beat by beat and
 * checks what the walker does with a board that does not match the script.
 * This one asks a coarser question of all four levels at once: if a player
 * does exactly what the script asks, in order, does the walker follow them to
 * the end? It plays each beat as the events that beat describes and asserts
 * after every one that the level advanced by exactly that beat, so a beat the
 * walker can never match fails here on the beat itself rather than at the end.
 *
 * The board is projected from a hand-built log rather than from the database,
 * so this is the script and the projection under test and nothing else. It is
 * deliberately not a rules test: `canPlaceTile` and its friends are not
 * consulted here, and a script that asks for an illegal move would still pass.
 * The order the scripts place their roots in is covered separately, below.
 */

const GAME = "00000000-0000-4000-8000-000000000000";
const PLAYER = "11111111-1111-4111-8111-111111111111";
const BOSS = "b055b055-0000-4000-8000-000000000002";

function player(level: Level): Record<string, Side> {
  return { [PLAYER]: level.playerSide, [BOSS]: level.bossSide };
}

interface Play {
  events: AnyGameEvent[];
  push: <T extends GameEventType>(
    type: T,
    payload: EventPayloads[T],
    actorId?: string | null,
  ) => number;
  board: () => ReturnType<typeof projectBoard>;
}

function play(level: Level): Play {
  const role = player(level);
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
      actor_role: actorId ? (role[actorId] ?? "server") : "server",
      source: actorId === BOSS ? "system" : "human",
      actor_id: actorId,
      payload,
      created_at: "2026-09-04T00:00:00Z",
    } as AnyGameEvent);
    return events.length;
  };

  push("game_created", {
    mode: "gym",
    level_id: level.id,
    boss_id: level.bossId,
    join_code: null,
  });
  push("player_joined", { display_name: "Brisk Copper Otter" }, PLAYER);
  push("player_joined", { display_name: level.bossName }, BOSS);
  push("role_selected", { role: level.playerSide }, PLAYER);
  push("role_selected", { role: level.bossSide }, BOSS);
  push("topic_set", { text: level.topic, origin: "custom", topic_id: level.topicId });
  push("agreement_signed", { items: ["mutual_respect"] }, BOSS);
  push("agreement_signed", { items: ["mutual_respect"] }, PLAYER);
  push("game_started", {
    card_set: { policy: "intersection", card_ids: [], raised_by: null },
    coach: null,
    root_target: level.rootTarget,
  });

  return { events, push, board: () => projectBoard(events) };
}

/** What the walker needs to see for one beat, appended to the log. */
function perform(
  level: Level,
  beat: Beat,
  p: Play,
  tokens: Map<string, Set<Side>>,
): void {
  if (beat.kind === "pause") return;
  if (beat.kind === "win") {
    p.push("game_ended", { win_condition: "threads_resolved" });
    return;
  }

  const board = p.board();
  const progress = levelProgress(level, board, ALL_PAUSES_DISMISSED);
  const keys = progress.keys;
  const ctx = scriptContext(level, board, keys);
  const boss = beat.kind === "boss";
  const actor = boss ? BOSS : PLAYER;
  const side = boss ? level.bossSide : level.playerSide;
  const spec = beat.kind === "boss" ? beat.act : beat.expect;

  switch (spec.kind) {
    case "tile": {
      const parentId = spec.parent === null ? null : keys[spec.parent];
      const parent = parentId ? board.tiles.find((t) => t.id === parentId) : null;
      const id = `tile-${beat.id}`;
      p.push(
        "tile_placed",
        {
          tile_id: id,
          parent_tile_id: parentId ?? null,
          thread_root_id: parent ? parent.threadRootId : id,
          side,
          // A boss line may be a function of what the player wrote; a player
          // beat's sample is only a suggestion, so its id stands in for text
          // the player would type.
          text: "text" in spec ? renderText(spec.text, ctx) : `${beat.id} answer`,
        },
        actor,
      );
      return;
    }
    case "token": {
      const rootId = keys[spec.thread];
      p.push(
        "resolution_emoji_placed",
        { thread_root_id: rootId, emoji: spec.emoji },
        actor,
      );
      const seen = tokens.get(`${rootId}:${spec.emoji}`) ?? new Set<Side>();
      seen.add(side);
      tokens.set(`${rootId}:${spec.emoji}`, seen);
      if (seen.size === 2)
        p.push("thread_resolved", {
          thread_root_id: rootId,
          emoji: spec.emoji,
          note: null,
        });
      return;
    }
    case "throw": {
      p.push(
        "card_thrown",
        {
          card_id: spec.cardId,
          rung_id: spec.rungId ?? null,
          target_tile_id: keys[spec.tile],
        },
        actor,
      );
      return;
    }
    case "revise": {
      const tileId = keys[spec.tile];
      const standing = p
        .board()
        .throws.find((t) => t.targetTileId === tileId && t.status === "standing");
      p.push(
        "tile_revised",
        {
          tile_id: tileId,
          text: renderText(spec.text, ctx),
          in_response_to_seq: standing?.seq ?? 0,
        },
        actor,
      );
      return;
    }
    case "remove": {
      p.push("tile_removed", { tile_id: keys[spec.tile] }, actor);
      return;
    }
    case "edit": {
      p.push(
        "tile_edited",
        { tile_id: keys[spec.tile], text: `${beat.id} rewritten` },
        actor,
      );
      return;
    }
    case "relocate":
    case "propose": {
      const kind = spec.kind === "relocate" ? "tile_relocation" : spec.proposal;
      const targetId = spec.tile === null ? null : (keys[spec.tile] ?? null);
      const target = targetId ? board.tiles.find((t) => t.id === targetId) : null;
      const content: ProposalContent =
        kind === "tile_relocation"
          ? {
              new_parent_tile_id: null,
              new_thread_root_id: board.threads[0].rootId,
              new_side: side,
            }
          : kind === "definition"
            ? { term: "authentic", text: `${beat.id} definition` }
            : { text: `${beat.id} reading` };
      p.push(
        "proposal_made",
        {
          proposal_id: `proposal-${beat.id}`,
          kind,
          target_tile_id: targetId,
          target_thread_root_id: target ? target.threadRootId : null,
          content,
        },
        actor,
      );
      return;
    }
    case "accept": {
      const targetId = spec.tile === null ? null : (keys[spec.tile] ?? null);
      const proposal = p
        .board()
        .proposals.find(
          (candidate) =>
            candidate.kind === spec.proposal &&
            candidate.targetTileId === targetId &&
            candidate.status === "pending",
        );
      p.push("proposal_accepted", { proposal_id: proposal?.id ?? "missing" }, actor);
      return;
    }
  }
}

describe.each(SCRIPTED_LEVELS.map((level) => [level.title, level] as const))(
  "level %s, played straight through",
  (_title, level) => {
    it("advances one beat per scripted move, and finishes", () => {
      const p = play(level);
      const tokens = new Map<string, Set<Side>>();

      const pauses = new Set(
        level.beats.filter((beat) => beat.kind === "pause").map((beat) => beat.id),
      );

      for (const beat of level.beats) {
        if (beat.kind === "pause") continue;
        perform(level, beat, p, tokens);
        const progress = levelProgress(level, p.board(), ALL_PAUSES_DISMISSED);
        // The beat just played must be the last one the walker saw evidence
        // for. Pauses are dropped from the comparison because a dismissed
        // pause is done the moment the walk reaches it, so the walk always
        // ends on any pause that follows the last real move. Naming the beat
        // in the assertion is the point: a beat the walker cannot see fails
        // here, where the script says which one it was.
        const moves = progress.done.filter((id) => !pauses.has(id));
        expect([beat.id, moves.at(-1)]).toEqual([beat.id, beat.id]);
      }

      const progress = levelProgress(level, p.board(), ALL_PAUSES_DISMISSED);
      expect(progress.complete).toBe(true);
      expect(progress.done).toEqual(level.beats.map((beat) => beat.id));
      expect(currentBeat(level, progress)).toBeNull();
    });

    it("places every root before any tile hangs off one", () => {
      // canPlaceTile refuses a child until `rootTarget` roots are down, and
      // the walker knows nothing about that rule, so a script that opened a
      // thread too early would pass the walk above and stall a real game.
      const roots = level.beats.filter(
        (beat) =>
          (beat.kind === "boss" &&
            beat.act.kind === "tile" &&
            beat.act.parent === null) ||
          (beat.kind === "player" &&
            beat.expect.kind === "tile" &&
            beat.expect.parent === null),
      );
      expect(roots).toHaveLength(level.rootTarget);

      const children = level.beats.filter(
        (beat) =>
          (beat.kind === "boss" &&
            beat.act.kind === "tile" &&
            beat.act.parent !== null) ||
          (beat.kind === "player" &&
            beat.expect.kind === "tile" &&
            beat.expect.parent !== null),
      );
      const lastRoot = level.beats.indexOf(roots[roots.length - 1]);
      const firstChild =
        children.length > 0 ? level.beats.indexOf(children[0]) : Infinity;
      expect(lastRoot).toBeLessThan(firstChild);
    });

    it("awards badges the sample progression knows about", () => {
      // A badge id nobody recognises means a certificate with a hole in it,
      // and the level would still play perfectly, so nothing else catches it.
      for (const id of levelBadges(level)) expect(id).toMatch(/^[a-z0-9-]+$/);
      expect(level.awards.cardId).toBe(level.cardId);
    });
  },
);
