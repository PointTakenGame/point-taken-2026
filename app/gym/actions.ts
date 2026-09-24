"use server";

import { revalidatePath } from "next/cache";

import { projectBoard, type BoardState } from "@/lib/board/project";
import * as rules from "@/lib/board/rules";
import { SIGNING_LINE_IDS } from "@/lib/board/setup";
import { readPlayerAwards } from "@/lib/db/awards";
import { createGame } from "@/lib/db/games";
import { ensureDisplayName } from "@/lib/db/players";
import { appendGameEvent, appendGameEvents, readGameEvents } from "@/lib/events/append";
import type { GameEventType, NewEvent, Side, Uuid } from "@/lib/events/types";
import { endInFlightGame } from "@/lib/games/abandon";
import { readSeat } from "@/lib/games/membership";
import { grantLevelAwards } from "@/lib/gym/awards";
import { bossPlayerId, ensureBossAccount } from "@/lib/gym/boss-account";
import { levelById } from "@/lib/gym/levels";
import {
  ALL_PAUSES_DISMISSED,
  currentBeat,
  levelProgress,
  renderText,
  scriptContext,
  type Level,
} from "@/lib/gym/script";
import { ladderFor } from "@/lib/progression/state";
import { currentPlayerId } from "@/lib/supabase/session";

/**
 * The two server actions a Gym level needs: one to open a cooked game, one
 * to let the boss take his scripted turn.
 *
 * A Gym game is an ordinary game. `startLevel` creates the `games` row with
 * mode gym, seats the player and the boss (a real player row, see
 * lib/gym/boss-account.ts), gives both their scripted sides, sets the topic,
 * and signs for the boss. The player signs and starts through the same
 * setup-actions a live room uses. From there every tile, token and throw
 * the player makes goes through app/game/[gameId]/actions.ts unchanged; the
 * only new write path is `bossAct`, which appends what the script says the
 * boss does next, as source "system" with the boss's actor id.
 *
 * `bossAct` is idempotent by construction: it re-walks the script against the
 * log and acts only if the current beat is the boss's and not yet on the
 * board, so a client that fires it twice appends once. The client (the gym
 * director) decides when to call it; the server only decides whether.
 *
 * Same shape as the other action files and no new SQL. This file is server
 * actions and therefore core lane (web/point-taken-2026/CLAUDE.md); it goes
 * in its own `core:` commit for review.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };
export type StartLevelResult =
  { ok: true; gameId: string } | { ok: false; error: string; signIn?: true };

const failed = (error: string): ActionResult => ({ ok: false, error });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function newEvent<T extends GameEventType>(event: NewEvent<T>): NewEvent {
  return event as NewEvent;
}

function refresh(gameId: string): void {
  revalidatePath(`/game/${gameId}`);
}

function bossActor(level: Level): { actorRole: Side; source: "system"; actorId: Uuid } {
  return {
    actorRole: level.bossSide,
    source: "system",
    actorId: bossPlayerId(level.bossId),
  };
}

/**
 * Opens the level this player should do next, without them having to pick one.
 *
 * "Next" is the ladder's own answer: `ladderFor` marks as `current` the first
 * designed rung the player has not cleared, so somebody who has never trained
 * gets level 1 and somebody who cleared 1 and 2 gets 3. A player who skipped
 * ahead is pointed back at the earliest gap, which is the same rule the ladder
 * strip draws on the profile; this action and that strip must not disagree
 * about where "you are here" is.
 *
 * This exists for the buttons that offer training as a destination rather than
 * as a menu (the landing popup's "Go to the Gym"). The ladder strip keeps
 * calling `startLevel` with the rung the player actually clicked.
 *
 * The signed-out answer is `signIn`, not a failure: the caller mints a guest
 * account and calls again, the same handshake `createRoom` already uses.
 */
export async function startCurrentLevel(): Promise<StartLevelResult> {
  const playerId = await currentPlayerId();
  if (!playerId) {
    return {
      ok: false,
      error: "Start playing first, so you have a name to train with.",
      signIn: true,
    };
  }

  const ladder = ladderFor(await readPlayerAwards(playerId));
  // Every designed rung carries an id; the undesigned ones above level 4 are
  // null and can never be opened, so they are filtered out before choosing.
  const playable = ladder.filter((rung) => rung.id !== null);
  const next = playable.find((rung) => rung.status === "current") ?? playable[0];
  if (!next?.id) return { ok: false, error: "No level is ready to play yet." };

  return startLevel(next.id);
}

export async function startLevel(levelId: string): Promise<StartLevelResult> {
  const playerId = await currentPlayerId();
  if (!playerId) {
    return {
      ok: false,
      error: "Start playing first, so you have a name to train with.",
      signIn: true,
    };
  }

  const level = levelById(levelId);
  if (!level) return { ok: false, error: "That level has no script yet." };

  // A Gym game is an ordinary game (see the file comment): starting one ends
  // whatever unfinished game this player has, live or Gym, the same as
  // starting a new live room does (Steve, 2026-09-05, BRAIN-T260905-44).
  await endInFlightGame(playerId);

  const player = await ensureDisplayName(playerId);
  await ensureBossAccount(level.bossId, level.bossName);

  const game = await createGame({
    mode: "gym",
    createdBy: playerId,
    levelId: level.id,
    bossId: level.bossId,
  });

  const boss = bossActor(level);
  await appendGameEvents(game.id, [
    newEvent({
      type: "player_joined",
      actorRole: "server",
      source: "human",
      actorId: playerId,
      payload: { display_name: player.display_name ?? "Player" },
    }),
    newEvent({
      type: "player_joined",
      actorRole: "server",
      source: "system",
      actorId: boss.actorId,
      payload: { display_name: level.bossName },
    }),
    newEvent({
      type: "role_selected",
      actorRole: level.playerSide,
      source: "system",
      actorId: playerId,
      payload: { role: level.playerSide },
    }),
    newEvent({
      type: "role_selected",
      ...boss,
      payload: { role: level.bossSide },
    }),
    newEvent({
      type: "topic_set",
      actorRole: "server",
      source: "system",
      actorId: null,
      payload: { text: level.topic, origin: "custom", topic_id: level.topicId },
    }),
    newEvent({
      type: "agreement_signed",
      ...boss,
      payload: { items: [...SIGNING_LINE_IDS] },
    }),
  ]);

  return { ok: true, gameId: game.id };
}

/** thread_resolved when both tokens agree, then game_ended when that was the last thread. */
async function settle(gameId: string, threadRootId: Uuid): Promise<void> {
  const board = projectBoard(await readGameEvents(gameId));
  const thread = board.threads.find((candidate) => candidate.rootId === threadRootId);
  if (!thread || rules.isResolved(thread)) return;

  const agreed = rules.agreedToken(thread);
  if (!agreed) return;

  await appendGameEvent(gameId, {
    type: "thread_resolved",
    actorRole: "server",
    source: "system",
    payload: { thread_root_id: threadRootId, emoji: agreed, note: null },
  });

  const settled = projectBoard(await readGameEvents(gameId));
  if (settled.status === "ended" || !rules.threadsWinReached(settled)) return;

  await appendGameEvent(gameId, {
    type: "game_ended",
    actorRole: "server",
    source: "system",
    payload: { win_condition: "threads_resolved" },
  });

  await grantLevelAwards(gameId);
}

function loadLevel(board: BoardState): Level | null {
  if (board.mode !== "gym") return null;
  return levelById(board.levelId) ?? null;
}

export async function bossAct(gameId: string): Promise<ActionResult> {
  if (!UUID.test(gameId)) return failed("That game id is not a game id.");
  const seat = await readSeat(gameId);
  if (!seat.ok) return failed("That game is not open to you.");

  const board = projectBoard(await readGameEvents(gameId));
  const level = loadLevel(board);
  if (!level) return failed("This is not a scripted level.");
  if (board.status !== "active") return { ok: true };

  const progress = levelProgress(level, board, ALL_PAUSES_DISMISSED);
  const beat = currentBeat(level, progress);
  if (!beat || beat.kind !== "boss") return { ok: true };

  const boss = bossActor(level);
  const ctx = scriptContext(level, board, progress.keys);
  const key = (name: string): Uuid | null => progress.keys[name] ?? null;
  const act = beat.act;

  switch (act.kind) {
    case "tile": {
      const parentId = act.parent === null ? null : key(act.parent);
      if (act.parent !== null && !parentId)
        return failed(`Script tile ${act.parent} is not on the board yet.`);
      const parent = parentId ? board.tiles.find((tile) => tile.id === parentId) : null;
      const tileId = crypto.randomUUID();
      await appendGameEvent(gameId, {
        type: "tile_placed",
        ...boss,
        payload: {
          tile_id: tileId,
          parent_tile_id: parentId,
          thread_root_id: parent ? parent.threadRootId : tileId,
          side: level.bossSide,
          text: renderText(act.text, ctx),
        },
      });
      break;
    }
    case "token": {
      const rootId = key(act.thread);
      if (!rootId) return failed(`Script thread ${act.thread} is not on the board yet.`);
      const thread = board.threads.find((t) => t.rootId === rootId);
      if (!thread) return failed(`Script thread ${act.thread} is not on the board yet.`);
      // Mirror whatever the player actually put down, not the emoji the
      // script narrates: a legal token different from the scripted one still
      // closes the thread, since what ends it is the two sides landing on
      // the same token, never which of the two tokens that turns out to be.
      // Falls back to the scripted emoji when the player has not moved yet,
      // which is the ordinary case: the boss goes first on some threads.
      const mirrored = thread.pending[level.playerSide] ?? act.emoji;
      const bossPending = thread.pending[level.bossSide];
      if (bossPending && bossPending !== mirrored) {
        // The boss already has a different token down here, from before the
        // player's actual choice was known. Take it back before putting the
        // matching one down, the same way a player retracts their own with
        // clearResolutionToken.
        await appendGameEvent(gameId, {
          type: "resolution_emoji_removed",
          ...boss,
          payload: { thread_root_id: rootId },
        });
      }
      await appendGameEvent(gameId, {
        type: "resolution_emoji_placed",
        ...boss,
        payload: { thread_root_id: rootId, emoji: mirrored },
      });
      await settle(gameId, rootId);
      break;
    }
    case "revise": {
      const tileId = key(act.tile);
      if (!tileId) return failed(`Script tile ${act.tile} is not on the board yet.`);
      const standing = board.throws.find(
        (t) => t.targetTileId === tileId && t.status === "standing",
      );
      if (!standing) return failed("No card is standing against that tile.");
      await appendGameEvent(gameId, {
        type: "tile_revised",
        ...boss,
        payload: {
          tile_id: tileId,
          text: renderText(act.text, ctx),
          in_response_to_seq: standing.seq,
        },
      });
      break;
    }
    case "remove": {
      const tileId = key(act.tile);
      if (!tileId) return failed(`Script tile ${act.tile} is not on the board yet.`);
      await appendGameEvent(gameId, {
        type: "tile_removed",
        ...boss,
        payload: { tile_id: tileId },
      });
      break;
    }
    case "accept": {
      // A definition points at no tile, so `act.tile` may be null on purpose.
      // Null means "the proposal whose target is null"; a name that is not
      // bound yet is the failure.
      const tileId = act.tile === null ? null : key(act.tile);
      if (act.tile !== null && !tileId)
        return failed(`Script tile ${act.tile} is not on the board yet.`);
      const proposal = board.proposals.find(
        (p) =>
          p.kind === act.proposal && p.targetTileId === tileId && p.status === "pending",
      );
      if (!proposal) return failed("No proposal is waiting on that tile.");
      const batch: NewEvent[] = [
        newEvent({
          type: "proposal_accepted",
          ...boss,
          payload: { proposal_id: proposal.id },
        }),
      ];
      // Mirrors acceptProposal in app/game/[gameId]/actions.ts: accepting a
      // relocation is what moves the tile.
      if (
        tileId &&
        proposal.kind === "tile_relocation" &&
        "new_thread_root_id" in proposal.content
      ) {
        batch.push(
          newEvent({
            type: "tile_relocated",
            ...boss,
            payload: {
              tile_id: tileId,
              new_parent_tile_id: proposal.content.new_parent_tile_id,
              new_thread_root_id: proposal.content.new_thread_root_id,
              new_side: proposal.content.new_side,
              via_proposal_id: proposal.id,
            },
          }),
        );
      }
      await appendGameEvents(gameId, batch);
      break;
    }
  }

  refresh(gameId);
  return { ok: true };
}
