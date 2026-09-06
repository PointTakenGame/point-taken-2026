import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import type {
  BadgeGrantedPayload,
  CertificateGrantedPayload,
  LevelClearedPayload,
  PointsChangedPayload,
  Uuid,
} from "@/lib/events/types";

/**
 * What one account has earned, across every game it has played.
 *
 * `projectBoard` answers the same question for a single game. This answers it
 * for a player, which is what the profile, the ladder, the badge strip, the
 * points counter and the rule-card hand all actually ask. It is one query:
 * every award event carries the actor_id of the player it belongs to
 * (0014_awards.sql), so there is nothing to join.
 *
 * Deliberately not a `player_stats`-style SQL function. The counting here is a
 * sum and a group-by over at most a few hundred rows per account, and the
 * arithmetic that genuinely must not be written twice (who gets credit for a
 * thread, and for a game) is already in `0005_player_stats.sql`. Adding a
 * second function to add up four small lists would be a second place to keep
 * the award vocabulary correct.
 *
 * Read shape only: nothing here writes. The writer is lib/gym/awards.ts.
 */

const AWARD_TYPES = [
  "level_cleared",
  "badge_granted",
  "points_changed",
  "certificate_granted",
] as const;

export interface ClearedLevel {
  levelId: string;
  /** The rule card the level granted, or null for one that grants none. */
  cardId: string | null;
  gameId: Uuid;
  /** When the game that cleared it ended. */
  at: string;
}

export interface EarnedBadge {
  badgeId: string;
  /** How many times this player has earned it. At least 1. */
  times: number;
  /** The first time, which is the date a gallery shows. */
  firstAt: string;
}

export interface IssuedCertificate {
  levelId: string;
  issuedAt: string;
  gameId: Uuid;
}

export interface PlayerAwards {
  /** In the order cleared. A level cleared twice appears once, dated first. */
  clearedLevels: ClearedLevel[];
  badges: EarnedBadge[];
  /** Signed deltas summed. A staked-then-refunded dare nets zero, as it should. */
  points: number;
  certificates: IssuedCertificate[];
  /** Card ids this player owns, which is the cards their cleared levels granted. */
  cardIds: string[];
}

export const NO_AWARDS: PlayerAwards = {
  clearedLevels: [],
  badges: [],
  points: 0,
  certificates: [],
  cardIds: [],
};

interface AwardRow {
  game_id: Uuid;
  seq: number;
  type: (typeof AWARD_TYPES)[number];
  created_at: string;
  payload: unknown;
}

export async function readPlayerAwards(playerId: Uuid): Promise<PlayerAwards> {
  const { data, error } = await serviceClient()
    .from("game_events")
    .select("game_id, seq, type, created_at, payload")
    .eq("actor_id", playerId)
    .in("type", [...AWARD_TYPES])
    .order("created_at", { ascending: true })
    .order("seq", { ascending: true });

  if (error) throw new Error(`read awards failed: ${error.message}`);

  const awards: PlayerAwards = {
    clearedLevels: [],
    badges: [],
    points: 0,
    certificates: [],
    cardIds: [],
  };
  const levelSeen = new Set<string>();
  const badgeIndex = new Map<string, EarnedBadge>();

  for (const row of (data ?? []) as AwardRow[]) {
    switch (row.type) {
      case "level_cleared": {
        const payload = row.payload as LevelClearedPayload;
        if (levelSeen.has(payload.level_id)) break;
        levelSeen.add(payload.level_id);
        awards.clearedLevels.push({
          levelId: payload.level_id,
          cardId: payload.card_id,
          gameId: row.game_id,
          at: row.created_at,
        });
        if (payload.card_id && !awards.cardIds.includes(payload.card_id)) {
          awards.cardIds.push(payload.card_id);
        }
        break;
      }
      case "badge_granted": {
        const payload = row.payload as BadgeGrantedPayload;
        const existing = badgeIndex.get(payload.badge_id);
        if (existing) {
          existing.times += 1;
        } else {
          const badge = {
            badgeId: payload.badge_id,
            times: 1,
            firstAt: row.created_at,
          };
          badgeIndex.set(payload.badge_id, badge);
          awards.badges.push(badge);
        }
        break;
      }
      case "points_changed": {
        awards.points += (row.payload as PointsChangedPayload).delta;
        break;
      }
      case "certificate_granted": {
        const payload = row.payload as CertificateGrantedPayload;
        awards.certificates.push({
          levelId: payload.level_id,
          issuedAt: payload.issued_at,
          gameId: row.game_id,
        });
        break;
      }
    }
  }

  return awards;
}
