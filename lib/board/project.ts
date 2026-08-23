import type {
  AnyGameEvent,
  ProposalContent,
  ProposalKind,
  Side,
  Uuid,
} from "@/lib/events/types";
import type { GameMode, GameStatus, WinCondition } from "@/lib/db/types";

/**
 * The board, folded out of the log.
 *
 * Pure: no database, no `server-only`, so a finished-map page and a test can
 * both call it. The log is the authority, so nothing here is stored; a board
 * is what you get by replaying every event in seq order.
 */

/** What a redacted string reads as. The original is gone from the payload. */
export const REDACTED_TEXT = "[redacted]";

export interface BoardTile {
  id: Uuid;
  text: string;
  side: Side;
  parentId: Uuid | null;
  threadRootId: Uuid;
  placedBy: Uuid | null;
  placedAtSeq: number;
  isOpeningReason: boolean;
  edited: boolean;
  revised: boolean;
  removed: boolean;
  redacted: boolean;
  cardsThrown: number;
  children: BoardTile[];
}

export interface BoardThread {
  rootId: Uuid;
  /** Null when the root tile was removed, or never placed in this log. */
  root: BoardTile | null;
  /** Live tiles in the thread whose parent is gone. Never silently dropped. */
  orphans: BoardTile[];
  tileCount: number;
  /**
   * What each side has put down but not yet committed. A thread resolves only
   * when both sides show the same token, so one value per side is the whole
   * mechanic: a single shared field could not tell agreement from one player
   * changing their mind.
   */
  pending: Record<Side, string | null>;
  resolution: { emoji: string; note: string | null; seq: number } | null;
}

export interface BoardPlayer {
  id: Uuid;
  displayName: string | null;
  role: Side | null;
  /** Which lines they signed, or null if they have not signed. */
  signed: string[] | null;
  left: "disconnect" | "quit" | null;
}

export interface BoardTopic {
  text: string;
  origin: "library" | "custom";
  topicId: string | null;
  redacted: boolean;
  revisions: { text: string; seq: number; redacted: boolean }[];
}

export type ProposalStatus = "pending" | "accepted" | "rejected";

export interface BoardProposal {
  id: Uuid;
  kind: ProposalKind;
  content: ProposalContent;
  targetTileId: Uuid | null;
  targetThreadRootId: Uuid | null;
  /** Which side asked. The other side is the one who may answer. */
  askedBy: Side | null;
  askedByPlayer: Uuid | null;
  askedAtSeq: number;
  status: ProposalStatus;
  /** Set when rejected with a reason. */
  reason: string | null;
  answeredAtSeq: number | null;
}

/** The rules this game was started under. Settled once, at game_started. */
export interface BoardSettings {
  cardSet: {
    policy: "intersection" | "raised";
    cardIds: string[];
    raisedBy: Uuid | null;
  };
  coach: { coachId: string; temperament: string } | null;
}

/**
 * One thing the coach said about one tile.
 *
 * `forPlayer` is the only thing that makes a reading private. The server
 * projects the log through the service role, which bypasses RLS, so this array
 * holds both players' readings and the board must filter it. The database
 * refuses the same rows to a browser client (policy `game_events_read_member`),
 * which is what keeps a curious opponent out; the filter here is what keeps the
 * page from rendering something it should not.
 */
export interface CoachReading {
  seq: number;
  tileId: Uuid;
  /** Whose coach this was. Null only for readings written before 0008. */
  forPlayer: Uuid | null;
  /** Card ids from the deck. At most one, but the payload allows more. */
  cardIds: string[];
  feedback: string | null;
  suggestion: string | null;
  /** The player has seen it. Dismissing is an event, so it survives a reload. */
  shown: boolean;
}

export interface BoardState {
  mode: GameMode | null;
  /**
   * The designed run this game is, if it is one. A gym game carrying a level or
   * boss is a written scenario rather than free practice, which is why it plays
   * by live rules on endings.
   */
  levelId: string | null;
  bossId: string | null;
  status: GameStatus;
  winCondition: WinCondition | null;
  topic: BoardTopic | null;
  /** The topic as it stands: the last accepted revision, else the original. */
  currentTopicText: string | null;
  players: BoardPlayer[];
  threads: BoardThread[];
  /** Every tile in placement order, removed ones included. */
  tiles: BoardTile[];
  /** Every proposal ever made, in the order asked. */
  proposals: BoardProposal[];
  /** Every coach reading, both sides'. Filter by `forPlayer` before rendering. */
  coachReadings: CoachReading[];
  /** Null until game_started. The board is not playable before then. */
  settings: BoardSettings | null;
  generosity: Record<Side, number>;
  lastSeq: number;
}

/** Redactions name a target seq and a dotted path into that event's payload. */
function redactions(events: readonly AnyGameEvent[]): Map<number, Set<string>> {
  const index = new Map<number, Set<string>>();
  for (const event of events) {
    if (event.type !== "content_redacted") continue;
    const paths = index.get(event.payload.target_seq) ?? new Set<string>();
    paths.add(event.payload.target_path);
    index.set(event.payload.target_seq, paths);
  }
  return index;
}

export function projectBoard(events: readonly AnyGameEvent[]): BoardState {
  const ordered = [...events].sort((a, b) => a.seq - b.seq);
  const redacted = redactions(ordered);
  const isRedacted = (seq: number, path = "text") =>
    redacted.get(seq)?.has(path) ?? false;

  const tiles = new Map<Uuid, BoardTile>();
  const threads = new Map<Uuid, BoardThread>();
  const players = new Map<Uuid, BoardPlayer>();
  const proposals = new Map<Uuid, BoardProposal>();
  const readings = new Map<number, CoachReading>();

  const state: BoardState = {
    mode: null,
    levelId: null,
    bossId: null,
    status: "lobby",
    winCondition: null,
    topic: null,
    currentTopicText: null,
    players: [],
    threads: [],
    tiles: [],
    proposals: [],
    coachReadings: [],
    settings: null,
    generosity: { plus: 0, minus: 0 },
    lastSeq: 0,
  };

  const thread = (rootId: Uuid): BoardThread => {
    let existing = threads.get(rootId);
    if (!existing) {
      existing = {
        rootId,
        root: null,
        orphans: [],
        tileCount: 0,
        pending: { plus: null, minus: null },
        resolution: null,
      };
      threads.set(rootId, existing);
    }
    return existing;
  };

  for (const event of ordered) {
    state.lastSeq = Math.max(state.lastSeq, event.seq);

    switch (event.type) {
      case "game_created": {
        state.mode = event.payload.mode;
        state.levelId = event.payload.level_id;
        state.bossId = event.payload.boss_id;
        break;
      }

      case "player_joined": {
        if (!event.actor_id) break;
        const existing = players.get(event.actor_id);
        if (existing) existing.left = null;
        else
          players.set(event.actor_id, {
            id: event.actor_id,
            displayName: event.payload.display_name,
            role: null,
            signed: null,
            left: null,
          });
        break;
      }

      case "role_selected": {
        const player = event.actor_id && players.get(event.actor_id);
        if (player) player.role = event.payload.role;
        break;
      }

      case "agreement_signed": {
        const player = event.actor_id && players.get(event.actor_id);
        if (player) player.signed = event.payload.items;
        break;
      }

      case "player_left": {
        const player = event.actor_id && players.get(event.actor_id);
        if (player) player.left = event.payload.reason;
        break;
      }

      case "topic_set": {
        state.topic = {
          text: isRedacted(event.seq) ? REDACTED_TEXT : event.payload.text,
          origin: event.payload.origin,
          topicId: event.payload.topic_id,
          redacted: isRedacted(event.seq),
          revisions: [],
        };
        state.currentTopicText = state.topic.text;
        break;
      }

      case "topic_revised": {
        const text = isRedacted(event.seq) ? REDACTED_TEXT : event.payload.text;
        state.topic?.revisions.push({
          text,
          seq: event.seq,
          redacted: isRedacted(event.seq),
        });
        state.currentTopicText = text;
        break;
      }

      case "game_started": {
        if (state.status === "lobby") state.status = "active";
        state.settings = {
          cardSet: {
            policy: event.payload.card_set.policy,
            cardIds: event.payload.card_set.card_ids,
            raisedBy: event.payload.card_set.raised_by,
          },
          coach: event.payload.coach
            ? {
                coachId: event.payload.coach.coach_id,
                temperament: event.payload.coach.temperament,
              }
            : null,
        };
        break;
      }

      case "game_ended": {
        state.status = "ended";
        state.winCondition = event.payload.win_condition;
        break;
      }

      case "tile_placed": {
        const tile: BoardTile = {
          id: event.payload.tile_id,
          text: isRedacted(event.seq) ? REDACTED_TEXT : event.payload.text,
          side: event.payload.side,
          parentId: event.payload.parent_tile_id,
          threadRootId: event.payload.thread_root_id,
          placedBy: event.actor_id,
          placedAtSeq: event.seq,
          isOpeningReason: event.payload.is_opening_reason ?? false,
          edited: false,
          revised: false,
          removed: false,
          redacted: isRedacted(event.seq),
          cardsThrown: 0,
          children: [],
        };
        tiles.set(tile.id, tile);
        thread(tile.threadRootId);
        break;
      }

      case "tile_edited": {
        const tile = tiles.get(event.payload.tile_id);
        if (!tile) break;
        tile.redacted = isRedacted(event.seq);
        tile.text = tile.redacted ? REDACTED_TEXT : event.payload.text;
        tile.edited = true;
        break;
      }

      case "tile_revised": {
        const tile = tiles.get(event.payload.tile_id);
        if (!tile) break;
        tile.redacted = isRedacted(event.seq);
        tile.text = tile.redacted ? REDACTED_TEXT : event.payload.text;
        tile.revised = true;
        break;
      }

      case "tile_relocated": {
        const tile = tiles.get(event.payload.tile_id);
        if (!tile) break;
        tile.parentId = event.payload.new_parent_tile_id;
        tile.threadRootId = event.payload.new_thread_root_id;
        tile.side = event.payload.new_side;
        thread(tile.threadRootId);
        break;
      }

      case "tile_removed": {
        const tile = tiles.get(event.payload.tile_id);
        if (tile) tile.removed = true;
        break;
      }

      case "resolution_emoji_placed": {
        if (event.actor_role === "server") break;
        thread(event.payload.thread_root_id).pending[event.actor_role] =
          event.payload.emoji;
        break;
      }

      case "resolution_emoji_removed": {
        if (event.actor_role === "server") break;
        thread(event.payload.thread_root_id).pending[event.actor_role] = null;
        break;
      }

      case "thread_resolved": {
        const target = thread(event.payload.thread_root_id);
        target.resolution = {
          emoji: event.payload.emoji,
          note: isRedacted(event.seq, "note") ? REDACTED_TEXT : event.payload.note,
          seq: event.seq,
        };
        target.pending = { plus: null, minus: null };
        break;
      }

      case "proposal_made": {
        proposals.set(event.payload.proposal_id, {
          id: event.payload.proposal_id,
          kind: event.payload.kind,
          content: event.payload.content,
          targetTileId: event.payload.target_tile_id,
          targetThreadRootId: event.payload.target_thread_root_id,
          askedBy: event.actor_role === "server" ? null : event.actor_role,
          askedByPlayer: event.actor_id,
          askedAtSeq: event.seq,
          status: "pending",
          reason: null,
          answeredAtSeq: null,
        });
        break;
      }

      case "proposal_accepted": {
        const proposal = proposals.get(event.payload.proposal_id);
        if (!proposal || proposal.status !== "pending") break;
        proposal.status = "accepted";
        proposal.answeredAtSeq = event.seq;
        break;
      }

      case "proposal_rejected": {
        const proposal = proposals.get(event.payload.proposal_id);
        if (!proposal || proposal.status !== "pending") break;
        proposal.status = "rejected";
        proposal.reason = event.payload.reason;
        proposal.answeredAtSeq = event.seq;
        break;
      }

      case "card_thrown": {
        const tile = tiles.get(event.payload.target_tile_id);
        if (tile) tile.cardsThrown += 1;
        break;
      }

      case "ai_feedback_returned": {
        readings.set(event.seq, {
          seq: event.seq,
          tileId: event.payload.tile_id,
          forPlayer: event.actor_id,
          cardIds: event.payload.error_types,
          feedback: isRedacted(event.seq, "feedback")
            ? REDACTED_TEXT
            : event.payload.feedback,
          suggestion: isRedacted(event.seq, "suggestion")
            ? REDACTED_TEXT
            : event.payload.suggestion,
          shown: false,
        });
        break;
      }

      case "ai_feedback_shown": {
        const reading = readings.get(event.payload.in_response_to_seq);
        if (reading) reading.shown = true;
        break;
      }

      case "generosity_token_given": {
        state.generosity[event.payload.to_role] += 1;
        break;
      }

      default:
        break;
    }
  }

  // Live tiles only. A removed tile takes its subtree out of the picture, so
  // its live descendants surface as orphans rather than disappearing.
  const live = [...tiles.values()].filter((tile) => !tile.removed);
  for (const tile of live) {
    const parent = tile.parentId ? tiles.get(tile.parentId) : null;
    const target = thread(tile.threadRootId);
    target.tileCount += 1;

    if (tile.id === target.rootId) target.root = tile;
    else if (parent && !parent.removed) parent.children.push(tile);
    else target.orphans.push(tile);
  }

  state.players = [...players.values()];
  state.proposals = [...proposals.values()].sort(
    (a, b) => a.askedAtSeq - b.askedAtSeq,
  );
  state.coachReadings = [...readings.values()].sort((a, b) => a.seq - b.seq);
  state.threads = [...threads.values()];
  state.tiles = [...tiles.values()].sort((a, b) => a.placedAtSeq - b.placedAtSeq);
  return state;
}
