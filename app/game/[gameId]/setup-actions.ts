"use server";

import { revalidatePath } from "next/cache";

import { projectBoard, type BoardState } from "@/lib/board/project";
import * as setup from "@/lib/board/setup";
import { appendGameEvent, readGameEvents } from "@/lib/events/append";
import type { ActorRole, Side, Uuid } from "@/lib/events/types";
import { endIfAbandoned } from "@/lib/games/abandon";
import { readSeat, type Seat } from "@/lib/games/membership";
import type { ActionResult } from "./actions";

/**
 * Everything two players settle before the first reason is placed: which side
 * each is on, what they are arguing about, the agreement they both sign, and
 * the moment play starts.
 *
 * Same shape as actions.ts, and no new SQL: seating, sides and starting are all
 * event appends whose read-model effects the projection trigger already applies
 * inside the append's advisory lock.
 */

const failed = (error: string): ActionResult => ({ ok: false, error });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DENIALS = {
  anonymous: "Sign in to play.",
  not_found: "That game is not open to you.",
} as const;

interface Lobby {
  seat: Seat;
  board: BoardState;
}

async function lobby(gameId: string): Promise<Lobby | ActionResult> {
  if (!UUID.test(gameId)) return failed("That game id is not a game id.");

  const found = await readSeat(gameId);
  if (!found.ok) return failed(DENIALS[found.denial]);

  const board = projectBoard(await readGameEvents(gameId));
  return { seat: found.seat, board };
}

function isDenial(value: Lobby | ActionResult): value is ActionResult {
  return "ok" in value;
}

/**
 * A player with no side yet still has to write "server" here, because the
 * column allows only plus, minus, or server. The projection reads actor_id for
 * every lobby event, so nothing depends on this being a side.
 */
function actor(seat: Seat): { actorRole: ActorRole; source: "human"; actorId: Uuid } {
  return {
    actorRole: seat.role ?? "server",
    source: "human",
    actorId: seat.playerId,
  };
}

function refresh(gameId: string): void {
  revalidatePath(`/game/${gameId}`);
}

export async function chooseSide(gameId: string, side: Side): Promise<ActionResult> {
  const loaded = await lobby(gameId);
  if (isDenial(loaded)) return loaded;
  const { seat, board } = loaded;

  if (side !== "plus" && side !== "minus") return failed("That is not a side.");

  const verdict = setup.canChooseSide(board, seat.playerId, side);
  if (!verdict.ok) return failed(verdict.error);

  await appendGameEvent(gameId, {
    type: "role_selected",
    // The one lobby event whose actor_role is load-bearing: the catalogue says
    // the roster is read off these rather than repeated in game_started.
    actorRole: side,
    source: "human",
    actorId: seat.playerId,
    payload: { role: side },
  });

  refresh(gameId);
  return { ok: true };
}

export async function setTopic(
  gameId: string,
  input: { text: string; topicId: string | null },
): Promise<ActionResult> {
  const loaded = await lobby(gameId);
  if (isDenial(loaded)) return loaded;
  const { seat, board } = loaded;

  // A library topic is trusted for its own text, never the client's copy of it.
  const fromLibrary = input.topicId
    ? setup.TOPIC_LIBRARY.find((topic) => topic.id === input.topicId)
    : undefined;
  if (input.topicId && !fromLibrary) return failed("No such topic.");

  const text = fromLibrary ? fromLibrary.text : input.text.trim();
  const verdict = setup.canSetTopic(board, text);
  if (!verdict.ok) return failed(verdict.error);

  await appendGameEvent(gameId, {
    type: "topic_set",
    ...actor(seat),
    payload: {
      text,
      origin: fromLibrary ? "library" : "custom",
      topic_id: fromLibrary ? fromLibrary.id : null,
    },
  });

  refresh(gameId);
  return { ok: true };
}

/**
 * Signing is all three lines or none, so this takes no list: the client cannot
 * negotiate a partial ritual by sending a shorter one.
 */
export async function signAgreement(gameId: string): Promise<ActionResult> {
  const loaded = await lobby(gameId);
  if (isDenial(loaded)) return loaded;
  const { seat, board } = loaded;

  const items = [...setup.SIGNING_LINE_IDS];
  const verdict = setup.canSign(board, seat.playerId, items);
  if (!verdict.ok) return failed(verdict.error);

  await appendGameEvent(gameId, {
    type: "agreement_signed",
    ...actor(seat),
    payload: { items },
  });

  refresh(gameId);
  return { ok: true };
}

export async function startGame(gameId: string): Promise<ActionResult> {
  const loaded = await lobby(gameId);
  if (isDenial(loaded)) return loaded;
  const { seat, board } = loaded;

  const verdict = setup.canStartGame(board);
  if (!verdict.ok) return failed(verdict.error);

  await appendGameEvent(gameId, {
    type: "game_started",
    ...actor(seat),
    payload: {
      card_set: setup.startingCardSet(),
      // No live-play coach surface has been decided yet (BRAIN-T260823-15).
      coach: null,
    },
  });

  refresh(gameId);
  return { ok: true };
}

export async function leaveLobby(gameId: string): Promise<ActionResult> {
  const loaded = await lobby(gameId);
  if (isDenial(loaded)) return loaded;
  const { seat } = loaded;

  await appendGameEvent(gameId, {
    type: "player_left",
    ...actor(seat),
    payload: { reason: "quit" },
  });
  await endIfAbandoned(gameId);

  refresh(gameId);
  return { ok: true };
}
