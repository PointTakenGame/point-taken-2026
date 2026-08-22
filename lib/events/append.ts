import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import {
  EVENT_TYPES,
  PAYLOAD_HARD_CAP_BYTES,
  type GameEventRow,
  type GameEventType,
  type NewEvent,
  type Uuid,
} from "./types";

/**
 * The only supported way to write a game event.
 *
 * Ordering is the database's job: append_game_event assigns `seq` under a
 * per-game advisory lock, so callers never compute it. Everything checked here
 * is checked again by the trigger; this layer exists to fail with a message
 * that names the type and the overage instead of a bare SQLSTATE.
 */

const encoder = new TextEncoder();

/** Matches the trigger exactly: octet_length of the payload's JSON text. */
export function payloadBytes(payload: unknown): number {
  return encoder.encode(JSON.stringify(payload)).length;
}

export function assertPayloadFits(type: GameEventType, payload: unknown): void {
  const spec = EVENT_TYPES[type];
  if (!spec) throw new Error(`Unknown event type "${type}".`);

  const size = payloadBytes(payload);
  const limit = Math.min(spec.maxBytes, PAYLOAD_HARD_CAP_BYTES);
  if (size > limit) {
    throw new Error(
      `Payload for "${type}" is ${size} bytes, over its ${limit}-byte ceiling. ` +
        "Nothing is ever deleted from the log, so this is refused at write time.",
    );
  }
}

function toRpcElement(event: NewEvent): Record<string, unknown> {
  assertPayloadFits(event.type, event.payload);
  return {
    type: event.type,
    schema_version: EVENT_TYPES[event.type].schemaVersion,
    actor_role: event.actorRole,
    source: event.source,
    actor_id: event.actorId ?? null,
    payload: event.payload,
  };
}

export async function appendGameEvent<T extends GameEventType>(
  gameId: Uuid,
  event: NewEvent<T>,
): Promise<GameEventRow<T>> {
  assertPayloadFits(event.type, event.payload);

  const { data, error } = await serviceClient().rpc("append_game_event", {
    p_game_id: gameId,
    p_type: event.type,
    p_schema_version: EVENT_TYPES[event.type].schemaVersion,
    p_actor_role: event.actorRole,
    p_source: event.source,
    p_payload: event.payload,
    p_actor_id: event.actorId ?? null,
  });

  if (error) throw new Error(`append ${event.type} failed: ${error.message}`);
  return data as GameEventRow<T>;
}

/**
 * Batch append for a validated gym run. The batch is numbered contiguously
 * under one lock. Replay the run through the rules package BEFORE calling: this
 * function validates envelopes and sizes, never legality.
 */
export async function appendGameEvents(
  gameId: Uuid,
  events: NewEvent[],
): Promise<GameEventRow[]> {
  if (events.length === 0) return [];

  const { data, error } = await serviceClient().rpc("append_game_events", {
    p_game_id: gameId,
    p_events: events.map(toRpcElement),
  });

  if (error) throw new Error(`batch append failed: ${error.message}`);
  return (data ?? []) as GameEventRow[];
}

/** The whole log for one game, in order. Every projection starts here. */
export async function readGameEvents(gameId: Uuid): Promise<GameEventRow[]> {
  const { data, error } = await serviceClient()
    .from("game_events")
    .select("*")
    .eq("game_id", gameId)
    .order("seq", { ascending: true });

  if (error) throw new Error(`read events failed: ${error.message}`);
  return (data ?? []) as GameEventRow[];
}
