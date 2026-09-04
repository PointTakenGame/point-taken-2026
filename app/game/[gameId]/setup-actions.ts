"use server";

import { revalidatePath } from "next/cache";

import { projectBoard, type BoardState } from "@/lib/board/project";
import * as rules from "@/lib/board/rules";
import * as setup from "@/lib/board/setup";
import { readPlayerAwards } from "@/lib/db/awards";
import { ensureDisplayName } from "@/lib/db/players";
import { appendGameEvent, readGameEvents } from "@/lib/events/append";
import type { ActorRole, Side, Uuid } from "@/lib/events/types";
import { endIfAbandoned } from "@/lib/games/abandon";
import { readSeat, type Seat } from "@/lib/games/membership";
import { bossPlayerId } from "@/lib/gym/boss-account";
import { levelById } from "@/lib/gym/levels";
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

const LEFT = "You left this room. Rejoin if you want to take part.";

interface Lobby {
  seat: Seat;
  board: BoardState;
}

async function lobby(gameId: string): Promise<Lobby | ActionResult> {
  if (!UUID.test(gameId)) return failed("That game id is not a game id.");

  const found = await readSeat(gameId);
  if (!found.ok) return failed(DENIALS[found.denial]);

  const board = projectBoard(await readGameEvents(gameId));

  // The one place a departure is enforced. Leaving does not release the seat,
  // so `readSeat` still says yes and every setup write would otherwise still
  // land: a player who had walked out could pick a side, change the topic, or
  // sign, and the roster would say "left" beside all of it. Rejoining is the
  // way back, and it is the one action below that does not come through here.
  if (setup.hasLeft(board, found.seat.playerId)) return failed(LEFT);

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

/**
 * Which cards this game is played with, worked out once, here.
 *
 * Live: the intersection of what the two players have earned in the Gym
 * (Steve, 2026-09-03). Two people who have never trained hold nothing, and
 * that is the intended answer, not an oversight.
 *
 * Gym: the human's earned cards plus the one this level teaches. The boss is
 * left out of the intersection entirely, because he has no account and his
 * empty hand would otherwise empty everyone's.
 */
async function cardSetFor(
  board: BoardState,
  level: ReturnType<typeof levelById> | null,
): Promise<ReturnType<typeof setup.startingCardSet>> {
  if (level) {
    const bossId = bossPlayerId(level.bossId);
    const human = board.players.find((player) => player.id !== bossId);
    const owned = human ? (await readPlayerAwards(human.id)).cardIds : [];
    return setup.startingCardSet([owned], [level.awards.cardId]);
  }

  const owned = await Promise.all(
    board.players.map(async (player) => (await readPlayerAwards(player.id)).cardIds),
  );
  return setup.startingCardSet(owned);
}

export async function startGame(gameId: string): Promise<ActionResult> {
  const loaded = await lobby(gameId);
  if (isDenial(loaded)) return loaded;
  const { seat, board } = loaded;

  const verdict = setup.canStartGame(board);
  if (!verdict.ok) return failed(verdict.error);

  // The root stage, settled here because this is the one place a game starts:
  // a gym level is started through this same action, so the level declares its
  // target and this reads it rather than startLevel writing a second
  // game_started. Anything that is not a scripted level opens with four.
  const level = board.levelId ? levelById(board.levelId) : null;

  await appendGameEvent(gameId, {
    type: "game_started",
    ...actor(seat),
    payload: {
      card_set: await cardSetFor(board, level),
      // No live-play coach surface has been decided yet (BRAIN-T260823-15).
      coach: null,
      root_target: level?.rootTarget ?? rules.LIVE_ROOT_TARGET,
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

/**
 * Walking back into a room you left.
 *
 * The seat was never given away, so this is an ordinary `player_joined` against
 * the same row: the trigger in 0004 clears `left_at` on conflict, and the
 * projection clears the departure the same way. It reads the seat directly
 * rather than through `lobby`, because `lobby` is what refuses a leaver.
 */
export async function rejoinLobby(gameId: string): Promise<ActionResult> {
  if (!UUID.test(gameId)) return failed("That game id is not a game id.");

  const found = await readSeat(gameId);
  if (!found.ok) return failed(DENIALS[found.denial]);

  const board = projectBoard(await readGameEvents(gameId));
  if (!setup.hasLeft(board, found.seat.playerId)) return { ok: true };

  const verdict = setup.canJoin(board, found.seat.playerId);
  if (!verdict.ok) return failed(verdict.error);

  const player = await ensureDisplayName(found.seat.playerId);
  await appendGameEvent(gameId, {
    type: "player_joined",
    actorRole: "server",
    source: "human",
    actorId: found.seat.playerId,
    payload: { display_name: player.display_name ?? "Player" },
  });

  refresh(gameId);
  return { ok: true };
}
