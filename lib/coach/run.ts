import "server-only";

import { TILE_MAX_CHARS } from "@/lib/board/rules";
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
import { NU_PROMPT_VERSIONS, NU_THRESHOLD_VERSION, firstWaveCategories } from "./checks";

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
    //
    // PORT-NOTE(log-everything): his pipeline logs every evaluation, silent
    // ones included, because the study needs the denominator. Ours does not,
    // because this log is the game's history and a player scrolling it should
    // see the moments the coach spoke. If the corpus ever needs the silent
    // readings, that is a second sink, not a change here.
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
        // Both stamps travel together: ours for the framing and the card
        // derivation, his for the checklist inside it. A later diff against a
        // newer Northwestern bundle needs his numbers to be here.
        prompt_versions: { coach: COACH_PROMPT_VERSION, ...NU_PROMPT_VERSIONS },
        evaluator_schema_version: COACH_SCHEMA_VERSION,
        threshold_version: NU_THRESHOLD_VERSION,
        latency_ms: verdict.latencyMs,
        pipeline_mode: "analysis",
        first_wave_categories: firstWaveCategories(verdict.findings),
        // The raw nine, not the five that surface. This is the whole reason the
        // research-only checks are still detected.
        check_violations: verdict.findings.violations,
        structure_relation: verdict.findings.relation,
        clarification_needed: verdict.findings.clarificationNeeded,
        trigger_phrase: verdict.triggerPhrase,
        suggestion_source: verdict.suggestionSource,
        suggestion_confidence: verdict.suggestionConfidence,
        suggestion_preserves_stance: verdict.suggestionPreservesStance,
      },
    });

    // The dare: the same observation, offered as a rewrite the player can take
    // with one click instead of retyping. It is a second event rather than a
    // field on the reading because "the coach saw something" and "the coach put
    // words in front of you" are different facts, and the gap between the dare
    // and the tile_edited that follows it is the only way to tell later whether
    // anyone took one.
    //
    // A rewrite longer than a tile cannot be offered at all, so it is dropped
    // here rather than shown as a button that would be refused. The reading
    // still carries it, so nothing the model said is lost.
    const dare = verdict.suggestion?.trim() ?? "";
    if (dare.length > 0 && dare.length <= TILE_MAX_CHARS) {
      await appendGameEvent(gameId, {
        type: "coach_nudge_delivered",
        actorRole: "server",
        source: "coach",
        actorId: run.playerId,
        payload: {
          nudge_kind: "dare",
          text: dare,
          target_tile_id: run.tileId,
          card_id: verdict.cardIds[0],
        },
      });
    }
  } catch {
    // Deliberate. This runs detached from the request that placed the tile, so
    // throwing here would surface as an unhandled rejection in the server log
    // and change nothing the player can see.
    return;
  }
}
