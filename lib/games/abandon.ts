import { projectBoard } from "@/lib/board/project";
import { isAbandoned } from "@/lib/board/rules";
import { inFlightGame, listGamesForPlayer } from "@/lib/db/games";
import { appendGameEvent, readGameEvents } from "@/lib/events/append";
import type { Uuid } from "@/lib/events/types";

/**
 * Closes a game nobody is left to play, once the departure has landed.
 *
 * Called after a `player_left` append, never instead of one: it re-reads the log
 * so the decision sees the leave itself, and the status guard inside
 * `isAbandoned` makes a duplicate ending harmless when two clients race.
 *
 * This is the only writer of `abandoned`. `timeout` still has none
 * (BRAIN-T260823-19).
 */
export async function endIfAbandoned(gameId: string): Promise<void> {
  const board = projectBoard(await readGameEvents(gameId));
  if (!isAbandoned(board)) return;

  await appendGameEvent(gameId, {
    type: "game_ended",
    actorRole: "server",
    source: "system",
    payload: { win_condition: "abandoned" },
  });
}

/**
 * Ends whatever game this player has not finished, the moment they start
 * another one.
 *
 * Steve's ruling (2026-09-05, BRAIN-T260905-44): an old game does not stay
 * reachable once its player has moved on. The exception, "Back to your
 * game" on the profile, is for a browser crash, not for a player who chose
 * to start over; starting over is treated exactly like walking out, which is
 * why this writes the same `player_left` an explicit leave writes and hands
 * off to the same `endIfAbandoned` that a leave calls. The other side, if
 * there is one, sees the game end exactly as if this player had left it,
 * because that is what happened.
 *
 * The game in question is `inFlightGame`'s pick, the identical lookup the
 * profile's "Back to your game" link reads (`app/account/profile.tsx`), so
 * starting a new game and resuming an old one can never disagree about which
 * game that was. Mode-blind: a Gym run and a live room close the same way,
 * so a Gym level starting through `app/gym/actions.ts` ends a prior
 * unfinished game exactly as a new live room does.
 *
 * A no-op when there is nothing unfinished, when this player already left it
 * (the projection already reads `left: "quit"`), or when the game has since
 * ended by some other path, so calling this before every kind of "start" is
 * always safe.
 */
export async function endInFlightGame(playerId: Uuid): Promise<void> {
  const unfinished = inFlightGame(await listGamesForPlayer(playerId));
  if (!unfinished) return;

  const board = projectBoard(await readGameEvents(unfinished.id));
  if (board.status === "ended") return;

  const player = board.players.find((candidate) => candidate.id === playerId);
  if (!player || player.left === "quit") return;

  await appendGameEvent(unfinished.id, {
    type: "player_left",
    actorRole: player.role ?? "server",
    source: "human",
    actorId: playerId,
    payload: { reason: "quit" },
  });
  await endIfAbandoned(unfinished.id);
}
