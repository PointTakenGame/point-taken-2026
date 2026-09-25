import { projectBoard } from "@/lib/board/project";
import type {
  AnyGameEvent,
  EventPayloads,
  GameEventType,
  ProposalContent,
  Side,
} from "@/lib/events/types";
import {
  ALL_PAUSES_DISMISSED,
  levelProgress,
  renderText,
  scriptContext,
  type Beat,
  type Level,
} from "@/lib/gym/script";

/**
 * Builds a game log by hand and plays a level's beats into it. Shared by the
 * walkthrough test and the level-progress tests, so neither restates how a
 * beat becomes events. The board is projected from the hand-built log, never
 * the database.
 */

const GAME = "00000000-0000-4000-8000-000000000000";
export const PLAYER = "11111111-1111-4111-8111-111111111111";
export const BOSS = "b055b055-0000-4000-8000-000000000002";

export function player(level: Level): Record<string, Side> {
  return { [PLAYER]: level.playerSide, [BOSS]: level.bossSide };
}

export interface Play {
  events: AnyGameEvent[];
  push: <T extends GameEventType>(
    type: T,
    payload: EventPayloads[T],
    actorId?: string | null,
  ) => number;
  board: () => ReturnType<typeof projectBoard>;
}

export function play(level: Level): Play {
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
export function perform(
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
    case "relocate": {
      // Moving a reason asks nobody: the second click writes the move
      // (BRAIN-T260905-64), so the walk appends the same single event
      // `relocateTile` in app/game/[gameId]/actions.ts does, with no
      // proposal and therefore no `via_proposal_id`.
      const targetId = keys[spec.tile] ?? null;
      const target = targetId ? board.tiles.find((t) => t.id === targetId) : null;
      const to = keys[spec.to] ?? null;
      const toTile = to ? board.tiles.find((t) => t.id === to) : null;
      p.push(
        "tile_relocated",
        {
          tile_id: targetId as string,
          new_parent_tile_id: to,
          new_thread_root_id: toTile ? toTile.threadRootId : board.threads[0].rootId,
          new_side: target ? target.side : side,
        },
        actor,
      );
      return;
    }
    case "propose": {
      const kind = spec.proposal;
      const targetId = spec.tile === null ? null : (keys[spec.tile] ?? null);
      const target = targetId ? board.tiles.find((t) => t.id === targetId) : null;
      const content: ProposalContent =
        kind === "definition"
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
      // Accepting a move writes the move. The server action does this in the
      // same batch, and leaving it out here is what let the walk pass while a
      // real game rewound its own script and placed the moved tile twice.
      if (
        spec.proposal === "tile_relocation" &&
        proposal &&
        "new_thread_root_id" in proposal.content
      ) {
        p.push(
          "tile_relocated",
          {
            tile_id: targetId as string,
            new_parent_tile_id: proposal.content.new_parent_tile_id,
            new_thread_root_id: proposal.content.new_thread_root_id,
            new_side: proposal.content.new_side,
            via_proposal_id: proposal.id,
          },
          actor,
        );
      }
      return;
    }
  }
}
