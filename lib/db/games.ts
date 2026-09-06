import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import type { Uuid } from "@/lib/events/types";
import type { GameMode, GamePlayerRow, GameRow, PlayerRow } from "./types";
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

/**
 * Which of a player's own games (as returned by `listGamesForPlayer`, newest
 * first) counts as "the one still going": an active game beats a lobby still
 * waiting for a second player, because the argument left in the middle is
 * more urgent than the invitation nobody accepted, and either beats nothing.
 *
 * Mode-blind on purpose: a Gym run and a live room are both rows in `games`,
 * both close the same way, and the profile's "Back to your game" link has
 * never distinguished them either. The one lookup both that link
 * (`app/account/profile.tsx`) and `endInFlightGame` (`lib/games/abandon.ts`)
 * read from, so the two cannot disagree about what "unfinished" means
 * (BRAIN-T260905-44).
 */
export function inFlightGame(games: readonly GameRow[]): GameRow | null {
  return (
    games.find((game) => game.status === "active") ??
    games.find((game) => game.status === "lobby") ??
    null
  );
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

// ---------------------------------------------------------------------------
// Who else was there, and how much of a fight it was
// ---------------------------------------------------------------------------

/**
 * The other seat, for a list of games.
 *
 * A game has two seats at most, so "everyone who is not me" is one player.
 * Rows must arrive oldest first: if a seat were ever vacated and refilled, the
 * first person to sit is the one the game is remembered by.
 */
export function foldOpponents(
  rows: readonly Pick<GamePlayerRow, "game_id" | "player_id">[],
  viewerId: Uuid,
): Map<Uuid, Uuid> {
  const opponents = new Map<Uuid, Uuid>();
  for (const row of rows) {
    if (row.player_id === viewerId) continue;
    if (opponents.has(row.game_id)) continue;
    opponents.set(row.game_id, row.player_id);
  }
  return opponents;
}

/**
 * Name the other player in each of these games. A game still waiting for a
 * second person maps to nothing, which is how the caller tells "nobody yet"
 * apart from "somebody who has not been named yet" (null).
 */
export async function readOpponentsForGames(
  gameIds: readonly Uuid[],
  viewerId: Uuid,
): Promise<Map<Uuid, string | null>> {
  if (gameIds.length === 0) return new Map();

  const { data, error } = await serviceClient()
    .from("game_players")
    .select("game_id, player_id")
    .in("game_id", gameIds as Uuid[])
    .order("joined_at", { ascending: true });

  if (error) throw new Error(`read opponents failed: ${error.message}`);

  const seats = foldOpponents(
    (data ?? []) as unknown as Pick<GamePlayerRow, "game_id" | "player_id">[],
    viewerId,
  );
  const ids = [...new Set(seats.values())];
  if (ids.length === 0) return new Map();

  // A second query rather than an embed: game_players.player_id points at
  // auth.users, not at public.players, so PostgREST has no foreign key to
  // follow from one to the other.
  const { data: named, error: nameError } = await serviceClient()
    .from("players")
    .select("id, display_name")
    .in("id", ids);

  if (nameError) throw new Error(`read opponent names failed: ${nameError.message}`);

  const names = new Map(
    ((named ?? []) as unknown as Pick<PlayerRow, "id" | "display_name">[]).map((row) => [
      row.id,
      row.display_name,
    ]),
  );

  return new Map(
    [...seats].map(([gameId, playerId]) => [gameId, names.get(playerId) ?? null]),
  );
}

/** The columns the card-throw fold needs. */
export interface CardThrowEventRow {
  game_id: Uuid;
  seq: number;
  type: "card_thrown" | "card_throw_declined";
  payload: Record<string, unknown>;
}

const CARD_THROW_EVENT_TYPES = ["card_thrown", "card_throw_declined"];

/**
 * How many rule cards stuck, per game.
 *
 * Mirrors the projection: a throw the tile's author declined did not land, so
 * it stops counting, and declining the same throw twice changes nothing. Rows
 * must arrive in seq order, which is also the only order in which a decline
 * can follow the throw it answers.
 */
export function foldCardThrows(rows: readonly CardThrowEventRow[]): Map<Uuid, number> {
  const standing = new Map<Uuid, Set<number>>();
  for (const row of rows) {
    const seqs = standing.get(row.game_id) ?? new Set<number>();
    if (row.type === "card_thrown") seqs.add(row.seq);
    else seqs.delete(row.payload.in_response_to_seq as number);
    standing.set(row.game_id, seqs);
  }
  return new Map([...standing].map(([gameId, seqs]) => [gameId, seqs.size]));
}

export async function readCardThrowsForGames(
  gameIds: readonly Uuid[],
): Promise<Map<Uuid, number>> {
  if (gameIds.length === 0) return new Map();

  const { data, error } = await serviceClient()
    .from("game_events")
    .select("game_id, seq, type, payload")
    .in("game_id", gameIds as Uuid[])
    .in("type", CARD_THROW_EVENT_TYPES)
    .order("seq", { ascending: true });

  if (error) throw new Error(`read card throws failed: ${error.message}`);
  return foldCardThrows((data ?? []) as unknown as CardThrowEventRow[]);
}

/**
 * Every moment this player sat down in a game, oldest first.
 *
 * Timestamps rather than days on purpose: which calendar day an instant falls
 * on depends on where the reader is standing, and the server does not know.
 * `lib/games/streak.ts` explains the split; the browser resolves these into
 * local days and folds them there.
 *
 * `joined_at` and not `games.started_at`, because the streak is about turning
 * up. Somebody who joins a room whose second player never arrives still spent
 * that evening trying, and a habit counter that only rewards completed games
 * would quietly punish them for somebody else's no-show.
 */
export async function readPlayDaysForPlayer(playerId: Uuid): Promise<string[]> {
  const { data, error } = await serviceClient()
    .from("game_players")
    .select("joined_at")
    .eq("player_id", playerId)
    .order("joined_at", { ascending: true });

  if (error) throw new Error(`readPlayDaysForPlayer failed: ${error.message}`);
  return (data ?? []).map((row) => (row as { joined_at: string }).joined_at);
}

export interface ThreadResolvedEventRow {
  game_id: Uuid;
  payload: Record<string, unknown>;
}

/**
 * Which tokens ended the threads in each game.
 *
 * Counted straight, with no corrective pass, because resolving a thread is
 * final: `resolution_emoji_removed` takes back a token somebody placed while
 * the two of them were still deciding, and once they agree the thread is done.
 * That is the same reading `player_stats` takes, so a game's tokens here always
 * add up to the profile's totals.
 */
export function foldResolutions(
  rows: readonly ThreadResolvedEventRow[],
): Map<Uuid, Map<string, number>> {
  const byGame = new Map<Uuid, Map<string, number>>();
  for (const row of rows) {
    const token = row.payload.emoji;
    if (typeof token !== "string" || token === "") continue;
    const counts = byGame.get(row.game_id) ?? new Map<string, number>();
    counts.set(token, (counts.get(token) ?? 0) + 1);
    byGame.set(row.game_id, counts);
  }
  return byGame;
}

export async function readResolutionsForGames(
  gameIds: readonly Uuid[],
): Promise<Map<Uuid, Map<string, number>>> {
  if (gameIds.length === 0) return new Map();

  const { data, error } = await serviceClient()
    .from("game_events")
    .select("game_id, payload")
    .in("game_id", gameIds as Uuid[])
    .eq("type", "thread_resolved")
    .order("seq", { ascending: true });

  if (error) throw new Error(`read resolutions failed: ${error.message}`);
  return foldResolutions((data ?? []) as unknown as ThreadResolvedEventRow[]);
}
