import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import type { Uuid } from "@/lib/events/types";
import type { GameMode, GamePlayerRow, GameRow } from "./types";
import { REDACTED_TEXT } from "@/lib/board/project";
import { generateJoinCode } from "@/lib/games/joinCode";

/**
 * Creating a game is the one place the app writes a row before its event.
 * The log carries a foreign key to `games`, so the row has to exist first;
 * `create_game` inserts it and appends `game_created` at seq 1 in the same
 * transaction, which is why this goes through the RPC and never through a
 * plain insert. Everything after creation is an appended event.
 */

export interface CreateGameInput {
  mode: GameMode;
  createdBy: Uuid;
  levelId?: string | null;
  bossId?: string | null;
  joinCode?: string | null;
  clientBuild?: string | null;
}

/** Redraws before giving up on a free room code. */
export const JOIN_CODE_ATTEMPTS = 5;

const UNIQUE_VIOLATION = "23505";

export async function createGame(input: CreateGameInput): Promise<GameRow> {
  if (input.mode === "gym" && input.joinCode) {
    throw new Error("A gym run has nobody to invite, so it takes no join code.");
  }

  // A live game nobody can join is not a live game, so draw a code when the
  // caller did not name one. A caller-supplied code is used as given.
  const drawing = input.mode === "live" && !input.joinCode;
  const attempts = drawing ? JOIN_CODE_ATTEMPTS : 1;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const joinCode = drawing ? generateJoinCode() : (input.joinCode ?? null);

    const { data, error } = await serviceClient().rpc("create_game", {
      p_mode: input.mode,
      p_created_by: input.createdBy,
      p_level_id: input.levelId ?? null,
      p_boss_id: input.bossId ?? null,
      p_join_code: joinCode,
      p_client_build: input.clientBuild ?? null,
    });

    if (!error) return data as GameRow;

    // Another open game holds that code. Redraw only when we chose it: a
    // caller who asked for a specific code wants to hear that it is taken.
    if (drawing && error.code === UNIQUE_VIOLATION) continue;
    throw new Error(`create_game failed: ${error.message}`);
  }

  throw new Error(`could not find a free join code in ${JOIN_CODE_ATTEMPTS} tries`);
}

export async function getGame(gameId: Uuid): Promise<GameRow | null> {
  const { data, error } = await serviceClient()
    .from("games")
    .select("*")
    .eq("id", gameId)
    .maybeSingle();

  if (error) throw new Error(`read game failed: ${error.message}`);
  return (data as GameRow) ?? null;
}

/**
 * Look up an open lobby by its code. Join codes are unique only among games
 * that have not ended, so this must not be used to find historical games.
 */
export async function findOpenGameByJoinCode(joinCode: string): Promise<GameRow | null> {
  const { data, error } = await serviceClient()
    .from("games")
    .select("*")
    .eq("join_code", joinCode.toUpperCase())
    .neq("status", "ended")
    .maybeSingle();

  if (error) throw new Error(`join-code lookup failed: ${error.message}`);
  return (data as GameRow) ?? null;
}

export async function getGamePlayers(gameId: Uuid): Promise<GamePlayerRow[]> {
  const { data, error } = await serviceClient()
    .from("game_players")
    .select("*")
    .eq("game_id", gameId)
    .order("joined_at", { ascending: true });

  if (error) throw new Error(`read members failed: ${error.message}`);
  return (data ?? []) as GamePlayerRow[];
}

// Player reads and the display-name write live in ./players.ts.

/** A player's own games, newest first. The history a dashboard reads. */
export async function listGamesForPlayer(playerId: Uuid, limit = 50): Promise<GameRow[]> {
  const { data, error } = await serviceClient()
    .from("game_players")
    .select("games(*)")
    .eq("player_id", playerId)
    .order("joined_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`read player games failed: ${error.message}`);
  return ((data ?? []) as unknown as { games: GameRow }[])
    .map((row) => row.games)
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Topics, for a list of games
// ---------------------------------------------------------------------------

/**
 * What a history row calls a game.
 *
 * The `games` table has no topic column and should not grow one: the topic is
 * something players said, so it lives in the log like everything else they
 * said. `projectBoard` already derives it, but a dashboard listing fifty games
 * cannot project fifty boards, so this reads the three event types that decide
 * the answer and folds them the same way the projection does.
 *
 * Kept honest by `foldTopics` being the only place the rule is written, and by
 * `games.test.ts` pinning it against the same cases the projection handles.
 */
export interface GameTopic {
  text: string;
  redacted: boolean;
}

/** The columns the fold needs. A narrower select than the projection's. */
export interface TopicEventRow {
  game_id: Uuid;
  seq: number;
  type: "topic_set" | "topic_revised" | "content_redacted";
  payload: Record<string, unknown>;
}

const TOPIC_EVENT_TYPES = ["topic_set", "topic_revised", "content_redacted"];

/**
 * The topic as it stands for each game: the last accepted revision, else the
 * original. Both `topic_set` and `topic_revised` set the current text in
 * `projectBoard`, so the last of either by seq is the answer, and a later
 * `topic_set` deliberately outranks an earlier revision because changing the
 * topic starts the argument over.
 *
 * Redaction is honoured rather than assumed away. A `content_redacted` event
 * naming a topic event's seq means that text is gone, and a game whose topic
 * was redacted must not have it reappear on an account page.
 */
export function foldTopics(rows: readonly TopicEventRow[]): Map<Uuid, GameTopic> {
  // Redactions can arrive at any seq, including after the event they point at,
  // so index them before folding rather than while folding.
  const redacted = new Map<Uuid, Set<number>>();
  for (const row of rows) {
    if (row.type !== "content_redacted") continue;
    if (row.payload.target_path !== "text") continue;
    const seqs = redacted.get(row.game_id) ?? new Set<number>();
    seqs.add(row.payload.target_seq as number);
    redacted.set(row.game_id, seqs);
  }

  const latest = new Map<Uuid, { seq: number; topic: GameTopic }>();
  for (const row of rows) {
    if (row.type === "content_redacted") continue;
    const standing = latest.get(row.game_id);
    if (standing && standing.seq > row.seq) continue;
    const gone = redacted.get(row.game_id)?.has(row.seq) ?? false;
    latest.set(row.game_id, {
      seq: row.seq,
      topic: {
        text: gone ? REDACTED_TEXT : String(row.payload.text ?? ""),
        redacted: gone,
      },
    });
  }

  return new Map([...latest].map(([gameId, held]) => [gameId, held.topic]));
}

/**
 * One round trip for a whole page of history. Games with no topic yet are
 * simply absent from the map, which is the same thing the caller renders for a
 * room nobody has named an argument in.
 */
export async function readTopicsForGames(
  gameIds: readonly Uuid[],
): Promise<Map<Uuid, GameTopic>> {
  if (gameIds.length === 0) return new Map();

  const { data, error } = await serviceClient()
    .from("game_events")
    .select("game_id, seq, type, payload")
    .in("game_id", gameIds as Uuid[])
    .in("type", TOPIC_EVENT_TYPES)
    .order("seq", { ascending: true });

  if (error) throw new Error(`read topics failed: ${error.message}`);
  return foldTopics((data ?? []) as unknown as TopicEventRow[]);
}
