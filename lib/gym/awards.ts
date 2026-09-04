import "server-only";

import { projectBoard, type BoardState } from "@/lib/board/project";
import { readPlayerAwards } from "@/lib/db/awards";
import { appendGameEvents, readGameEvents } from "@/lib/events/append";
import type { GameEventType, NewEvent, Uuid } from "@/lib/events/types";
import { bossPlayerId } from "@/lib/gym/boss-account";
import { levelById } from "@/lib/gym/levels";
import {
  ALL_PAUSES_DISMISSED,
  levelBadges,
  levelProgress,
  type Level,
} from "@/lib/gym/script";

/**
 * Writing down what a player walked away with.
 *
 * Called after any append that might have ended a game. It re-reads the log
 * rather than taking a board from its caller, because the whole point is to
 * decide on what actually landed, and because two clients can end the same
 * game within the same second.
 *
 * Idempotent by the same trick `bossAct` uses: the awards are already in the
 * log or they are not, and a game that carries `level_cleared` is done being
 * awarded. So a double call appends once.
 *
 * Three things it refuses to do:
 *
 * - Award anything for a game that ended by being abandoned or timing out.
 *   Both win conditions here are cooperative, and walking away is not one.
 * - Award anything in a live game. Nothing in live play grants a rung, a badge
 *   or a card yet, and inventing one here would be inventing a rule.
 * - Award anything to the boss. He has a seat and a script, not an account.
 */

const COOPERATIVE = new Set(["threads_resolved", "topic_agreed"]);

function newEvent<T extends GameEventType>(event: NewEvent<T>): NewEvent {
  return event as NewEvent;
}

/** The human in a gym game: the seat that is not the boss's. */
function humanSeat(board: BoardState, level: Level): Uuid | null {
  const bossId = bossPlayerId(level.bossId);
  const seat = board.players.find((player) => player.id !== bossId);
  return seat?.id ?? null;
}

export async function grantLevelAwards(gameId: Uuid): Promise<void> {
  const board = projectBoard(await readGameEvents(gameId));

  if (board.mode !== "gym") return;
  if (board.status !== "ended") return;
  if (!board.winCondition || !COOPERATIVE.has(board.winCondition)) return;
  if (board.awards.levelCleared) return;

  const level = board.levelId ? levelById(board.levelId) : null;
  if (!level) return;

  const playerId = humanSeat(board, level);
  if (!playerId) return;

  const progress = levelProgress(level, board, ALL_PAUSES_DISMISSED);
  if (!progress.complete) return;

  // Occurrence is a fact about the player, not about this game, so it comes
  // from every game they have played. A badge earned again in a later run is a
  // second row, not an overwrite: the log keeps both and the reader counts.
  const already = await readPlayerAwards(playerId);
  const timesBefore = new Map(
    already.badges.map((badge) => [badge.badgeId, badge.times]),
  );

  const actor = {
    actorRole: level.playerSide,
    source: "system" as const,
    actorId: playerId,
  };

  const batch: NewEvent[] = [];

  const doneIds = new Set(progress.done);
  for (const beat of level.beats) {
    if (!beat.points || !doneIds.has(beat.id)) continue;
    batch.push(
      newEvent({
        type: "points_changed",
        ...actor,
        payload: { delta: beat.points, reason: "throw" },
      }),
    );
  }

  for (const badgeId of levelBadges(level)) {
    batch.push(
      newEvent({
        type: "badge_granted",
        ...actor,
        payload: { badge_id: badgeId, occurrence: (timesBefore.get(badgeId) ?? 0) + 1 },
      }),
    );
  }

  batch.push(
    newEvent({
      type: "level_cleared",
      ...actor,
      payload: { level_id: level.id, card_id: level.awards.cardId },
    }),
    newEvent({
      type: "certificate_granted",
      ...actor,
      payload: { level_id: level.id, issued_at: new Date().toISOString() },
    }),
  );

  await appendGameEvents(gameId, batch);
}
