import "server-only";

import { appendGameEvent } from "@/lib/events/append";
import type { Uuid } from "@/lib/events/types";
import { getPlayer } from "@/lib/db/players";
import {
  COACH_MODEL,
  COACH_PROMPT_VERSION,
  COACH_SCHEMA_VERSION,
  evaluateTile,
  type CoachInput,
} from "./evaluate";

/**
 * One reason, read by the coach, written back to the log.
 *
 * This runs after the tile is already in the log, never before it. A player
 * waiting on a model call to see their own tile land would feel the coach as
 * lag; instead the tile appears at once and the reading arrives a second later
 * over realtime, the same way the other player's moves do.
 *
 * It also means every failure here is silent by construction. A missing key, a
 * timeout, a model that says something unparseable: the game carries on without
 * a reading. The coach is an offer, not a gate (Steve, 2026-08-23).
 */

export interface CoachRun {
  /** Whose tile it is. The coach reads for this player only. */
  playerId: Uuid;
  tileId: Uuid;
  input: CoachInput;
}

export async function runCoach(gameId: Uuid, run: CoachRun): Promise<void> {
  try {
    const player = await getPlayer(run.playerId);
    // Off by default, and off means no model call at all, not a discarded one.
    if (!player?.coach_enabled) return;

    const verdict = await evaluateTile(run.input);
    if (!verdict) return;

    // Silence is the normal answer. Logging every "nothing to say" would bury
    // the readings that matter under readings that say nothing.
    if (verdict.cardIds.length === 0) return;

    await appendGameEvent(gameId, {
      type: "ai_feedback_returned",
      actorRole: "server",
      source: "coach",
      actorId: run.playerId,
      payload: {
        tile_id: run.tileId,
        error_types: verdict.cardIds,
        feedback: verdict.feedback,
        suggestion: verdict.suggestion,
        model_name: COACH_MODEL,
        prompt_versions: { coach: COACH_PROMPT_VERSION },
        evaluator_schema_version: COACH_SCHEMA_VERSION,
        latency_ms: verdict.latencyMs,
      },
    });
  } catch {
    // Deliberate. This runs detached from the request that placed the tile, so
    // throwing here would surface as an unhandled rejection in the server log
    // and change nothing the player can see.
    return;
  }
}
