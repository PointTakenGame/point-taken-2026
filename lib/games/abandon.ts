import { projectBoard } from "@/lib/board/project";
import { isAbandoned } from "@/lib/board/rules";
import { appendGameEvent, readGameEvents } from "@/lib/events/append";

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
