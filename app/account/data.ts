import { getPlayer } from "@/lib/db/players";
import { getPlayerStats } from "@/lib/db/stats";
import {
  listGamesForPlayer,
  readCardThrowsForGames,
  readOpponentsForGames,
  readPlayDaysForPlayer,
  readResolutionsForGames,
  readTopicsForGames,
} from "@/lib/db/games";
import type { Uuid } from "@/lib/events/types";

/**
 * Everything both account tabs need about one player, read once.
 *
 * Profile and History are two routes over the same three questions: who is
 * this, what have they done, and which games were they in. Splitting the tabs
 * (2026-09-02, Rannie's four-tab hub) without sharing the read would have meant
 * two copies of a seven-query fan-out drifting apart, so it lives here.
 *
 * Not a server action and not in lib/: it is a read this route group does for
 * itself, with no identity of its own. The caller has already established who
 * is asking.
 */
export async function loadAccount(playerId: Uuid) {
  const [player, stats, games, playedAt] = await Promise.all([
    getPlayer(playerId),
    getPlayerStats(playerId),
    listGamesForPlayer(playerId),
    readPlayDaysForPlayer(playerId),
  ]);
  // A second round trip on purpose: all four of these are keyed by the game
  // ids the first query returned, so they cannot start any earlier. They do run
  // together, since none of them depends on the others.
  const gameIds = games.map((game) => game.id);
  const [topics, opponents, cardsThrown, resolutions] = await Promise.all([
    readTopicsForGames(gameIds),
    readOpponentsForGames(gameIds, playerId),
    readCardThrowsForGames(gameIds),
    readResolutionsForGames(gameIds),
  ]);

  return { player, stats, games, playedAt, topics, opponents, cardsThrown, resolutions };
}

/**
 * How many of these games were joined in the last seven days.
 *
 * Deliberately a rolling 168 hours rather than "since Monday" or "today minus
 * six days". A rolling window needs no notion of where the reader is or when
 * their week starts, so unlike the streak it is safe to work out on the server.
 */
export function joinedThisWeek(playedAt: readonly string[], now = Date.now()): number {
  const cutoff = now - 7 * 24 * 60 * 60 * 1000;
  return playedAt.filter((iso) => {
    const at = Date.parse(iso);
    return Number.isFinite(at) && at >= cutoff && at <= now;
  }).length;
}
