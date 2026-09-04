import type {
  ActorRole,
  AnyGameEvent,
  GameEventType,
  ProposalContent,
  ProposalKind,
  Side,
  TileCorner,
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
  /** The diagonal the placer clicked, when the log recorded one. */
  corner: TileCorner | null;
  children: BoardTile[];
}

/**
 * One card thrown at one reason, and what happened next.
 *
 * `status` deliberately does not say whether the throw was *right*. The event
 * catalogue is explicit that no verdict is stored, because a stored verdict
 * would freeze a judgement the rules package is meant to be able to retune.
 * What is here is only the shape of the exchange: a card landed, and then the
 * reason was rewritten, or its author said the card does not fit, or neither
 * has happened yet.
 */
export interface BoardThrow {
  seq: number;
  cardId: string;
  /** Set when the throw exercises a gym rung rather than a card. */
  rungId: string | null;
  targetTileId: Uuid;
  /** Who threw it. Null only for a server-written throw. */
  thrownBy: Uuid | null;
  thrownByRole: ActorRole;
  status: "standing" | "answered" | "declined";
  /** Why the card was said not to fit. Null unless declined, and optional then. */
  declineReason: string | null;
  /** The seq of the revision or the decline. Null while the throw still stands. */
  answeredAtSeq: number | null;
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

/**
 * The threads that are actually on the board.
 *
 * `BoardState.threads` reports what the log says, which includes a thread every
 * one of whose tiles was later removed or moved somewhere else. That entry is a
 * true fact about the history and the projection is right to keep it, but it is
 * not a thread anyone is arguing in: nothing can be placed in it, and the rules
 * already refuse to count it toward the win or the six-thread cap.
 *
 * So every place that asks "which threads are there" asks through here. Note
 * this is a different case from a thread whose root tile was removed while its
 * children live on: that one still has tiles, still renders, and still says
 * "The reason this thread started from is gone."
 */
export function liveThreads(board: BoardState): BoardThread[] {
  return board.threads.filter((thread) => thread.tileCount > 0);
}

/** A word this game has agreed a meaning for, and the meaning. */
export interface AgreedDefinition {
  term: string;
  text: string;
  /** The proposal that settled it, so a reader can find the exchange. */
  proposalId: Uuid;
  /** Which side asked for it. */
  askedBy: Side | null;
  agreedAtSeq: number;
}

/**
 * The words this game has pinned down, in alphabetical order.
 *
 * Define That is the one mechanic whose whole point is what happens after the
 * agreement: "what it should mean for the rest of this game". A definition that
 * scrolled away into the proposal history the moment it was accepted would not
 * be pinned to anything. So every surface that shows a board asks here.
 *
 * Alphabetical rather than in the order agreed, because this is a list you look
 * a word up in. Defining the same word twice is allowed and the later agreement
 * wins: two players who find their first wording did not survive contact with
 * the argument should be able to say so without a new mechanic for it.
 */
export function agreedDefinitions(board: BoardState): AgreedDefinition[] {
  const byTerm = new Map<string, AgreedDefinition>();

  for (const proposal of board.proposals) {
    if (proposal.kind !== "definition" || proposal.status !== "accepted") continue;
    const content = proposal.content;
    if (!("term" in content) || !("text" in content)) continue;

    const term = String(content.term).trim();
    if (term.length === 0) continue;

    // Keyed case-insensitively so "Legal" does not sit beside "legal" as two
    // separate agreements, but displayed as whoever asked last wrote it.
    byTerm.set(term.toLowerCase(), {
      term,
      text: String(content.text),
      proposalId: proposal.id,
      askedBy: proposal.askedBy,
      agreedAtSeq: proposal.answeredAtSeq ?? proposal.askedAtSeq,
    });
  }

  return [...byTerm.values()].sort((a, b) =>
    a.term.localeCompare(b.term, undefined, { sensitivity: "base" }),
  );
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

/**
 * Thread roots a live game opens with, and what a game_started written before
 * root_target existed reads as, which is the same number for the same reason:
 * those games were played with four roots on the table.
 *
 * It lives here rather than beside MAX_THREADS in rules.ts because the
 * projection needs it to fill in version 1 rows and rules.ts already reads from
 * this file. rules.ts re-exports it.
 */
export const LIVE_ROOT_TARGET = 4;

/** The rules this game was started under. Settled once, at game_started. */
export interface BoardSettings {
  cardSet: {
    policy: "intersection" | "raised";
    cardIds: string[];
    raisedBy: Uuid | null;
  };
  coach: { coachId: string; temperament: string } | null;
  /**
   * How many thread roots this game opens with. No tile hangs off another
   * until that many are down (`canPlaceTile` in rules.ts). Always a number
   * here: a game_started written at version 1 predates the field and reads as
   * `LIVE_ROOT_TARGET`, which is what those games were played under.
   */
  rootTarget: number;
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

/**
 * One thing the coach said unprompted, rather than about a tile the player just
 * wrote. Nothing writes these in live play: the nudge is a script directive a
 * gym run steps through. Projected anyway, because the alternative is a read
 * model that silently loses events the moment the gym lands.
 */
export interface BoardNudge {
  seq: number;
  kind: string;
  text: string | null;
  targetTileId: Uuid | null;
  cardId: string | null;
  /** Whose coach nudged them. */
  forPlayer: Uuid | null;
}

/**
 * An event this projection could not fold, and did not pretend to.
 *
 * The log contract is that a reader declares the (type, version) pairs it
 * understands, skips everything else, and says so. Silence is the failure mode
 * worth naming: an event written at version 2 and folded as if it were
 * version 1 is a board that is quietly wrong, which is worse than a board that
 * is visibly missing something.
 */
export interface SkippedEvent {
  seq: number;
  type: string;
  schemaVersion: number;
  /** `unknown_type`: the log is ahead of this code. `unknown_version`: same
      type, a shape this code has never seen. */
  reason: "unknown_type" | "unknown_version";
}

/**
 * What this projection understands, stated once.
 *
 * A number list means "folded, at these payload versions". `null` means
 * "deliberately not board state", and the comment beside it says why: those are
 * skipped in silence, because a declared decision is not a gap.
 *
 * Typed as a total Record on purpose. Adding an event type to `EventPayloads`
 * fails to compile until someone decides which of the two this is, which is the
 * whole point: the 28th type got missed here once already.
 */
export const PROJECTED_VERSIONS: Record<GameEventType, number[] | null> = {
  game_created: [1],
  player_joined: [1],
  role_selected: [1],
  agreement_signed: [1],
  topic_set: [1],
  // 2 added root_target (0012_root_stage.sql). 1 is still folded: those games
  // were played under the live target, and that is what a missing field reads as.
  game_started: [1, 2],
  player_left: [1],
  game_ended: [1],
  tile_placed: [1],
  tile_edited: [1],
  tile_revised: [1],
  tile_relocated: [1],
  tile_removed: [1],
  resolution_emoji_placed: [1],
  resolution_emoji_removed: [1],
  thread_resolved: [1],
  proposal_made: [1],
  proposal_accepted: [1],
  proposal_rejected: [1],
  topic_revised: [1],
  card_thrown: [1],
  card_throw_declined: [1],
  generosity_token_given: [1],
  ai_feedback_returned: [1],
  ai_feedback_shown: [1],
  coach_nudge_delivered: [1],
  // A client's own account of a gym run: rules version, build, its event count.
  // It exists to be compared against the log by a validator, so folding it into
  // the board would make the board a party to its own audit.
  gym_run_recorded: null,
  // The four awards (0014_awards.sql). Folded so the certificate at the end of
  // a game can read what that game actually granted rather than recomputing it
  // off the script. What an account has earned across every game is a different
  // question and a different reader: lib/db/awards.ts.
  level_cleared: [1],
  badge_granted: [1],
  points_changed: [1],
  certificate_granted: [1],
  // Folded, but in the pre-pass: a redaction rewrites the event it points at,
  // so it has to be known before the fold starts rather than during it.
  content_redacted: [1],
};

/**
 * What this one game granted. Per game, and per player only in the sense that
 * every award event carries the actor it belongs to: a gym game has one human
 * in it, so `awards` is that human's. A live game grants nothing today, and
 * this stays empty there rather than being null.
 */
export interface BoardAwards {
  /** The rung this game cleared, if it cleared one. */
  levelCleared: { levelId: string; cardId: string | null; seq: number } | null;
  badges: { badgeId: string; occurrence: number; seq: number }[];
  /** Net points from this game. Signed deltas summed, so a refunded stake nets zero. */
  points: number;
  /** Every points_changed in order, so a screen can show what moved and why. */
  pointEvents: { delta: number; reason: string; seq: number }[];
  certificate: { levelId: string; issuedAt: string } | null;
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
  /** Every card ever thrown, in the order thrown, answered or not. */
  throws: BoardThrow[];
  /** Every coach reading, both sides'. Filter by `forPlayer` before rendering. */
  coachReadings: CoachReading[];
  /** Every unprompted coach nudge, both sides'. Filter by `forPlayer` too. */
  nudges: BoardNudge[];
  /** Events this code did not understand. Empty is the normal case. */
  skipped: SkippedEvent[];
  /** Null until game_started. The board is not playable before then. */
  settings: BoardSettings | null;
  generosity: Record<Side, number>;
  /** What this game granted (0014_awards.sql). Empty until something is. */
  awards: BoardAwards;
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
  const nudges: BoardNudge[] = [];
  // Throws by their own seq, because that is how a decline names the one it is
  // answering. Keyed rather than listed so the lookup stays O(1) in a long game.
  const throwsBySeq = new Map<number, BoardThrow>();

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
    throws: [],
    coachReadings: [],
    nudges: [],
    skipped: [],
    settings: null,
    generosity: { plus: 0, minus: 0 },
    awards: {
      levelCleared: null,
      badges: [],
      points: 0,
      pointEvents: [],
      certificate: null,
    },
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

    // Declared understanding, checked before the fold rather than trusted.
    // lastSeq is still advanced above: the board's position in the log is a
    // fact about the log, not about how much of it this code could read.
    const understood = PROJECTED_VERSIONS[event.type as GameEventType];
    if (understood === undefined) {
      state.skipped.push({
        seq: event.seq,
        type: event.type,
        schemaVersion: event.schema_version,
        reason: "unknown_type",
      });
      continue;
    }
    if (understood === null) continue;
    if (!understood.includes(event.schema_version)) {
      state.skipped.push({
        seq: event.seq,
        type: event.type,
        schemaVersion: event.schema_version,
        reason: "unknown_version",
      });
      continue;
    }

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
        // Changing the topic un-signs everybody. Either seated player may set
        // the topic, and there is no rule that the topic is settled before
        // anyone signs, so without this a player could sign, watch the other
        // one swap the argument out, and start a game standing behind lines
        // they agreed to about something else. Signing is about this argument.
        //
        // Done here rather than as a guard on canSetTopic because refusing the
        // change instead would trap a pair who both signed and then thought
        // better of the topic: there is no unsign event, so their only way out
        // would be to abandon the room. Re-signing costs one click each.
        for (const player of players.values()) player.signed = null;
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
          rootTarget: event.payload.root_target ?? LIVE_ROOT_TARGET,
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
          corner: event.payload.corner ?? null,
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
        // The payload names the throw this rewrite answers, so only that one is
        // answered, even if others are still standing against the same reason.
        // Note what is *not* happening: the throw keeps counting on the tile,
        // because a reason that had to be rewritten was in fact thrown at. Only
        // a decline takes the count back off.
        const answered = throwsBySeq.get(event.payload.in_response_to_seq);
        if (
          answered &&
          answered.status === "standing" &&
          answered.targetTileId === tile.id
        ) {
          answered.status = "answered";
          answered.answeredAtSeq = event.seq;
        }
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
        if (!tile) break;
        tile.cardsThrown += 1;
        throwsBySeq.set(event.seq, {
          seq: event.seq,
          cardId: event.payload.card_id,
          rungId: event.payload.rung_id,
          targetTileId: tile.id,
          thrownBy: event.actor_id,
          thrownByRole: event.actor_role,
          status: "standing",
          declineReason: null,
          answeredAtSeq: null,
        });
        break;
      }

      case "card_throw_declined": {
        // The tile's author saying the card does not fit. A declined throw did
        // not land, so the tile should not go on carrying it. Corrective, in
        // the log's sense: the throw stays in the history and stops counting on
        // the board. Only a standing throw can be declined, so a second decline
        // of the same throw changes nothing rather than double-decrementing.
        const thrown = throwsBySeq.get(event.payload.in_response_to_seq);
        if (!thrown || thrown.status !== "standing") break;
        thrown.status = "declined";
        thrown.declineReason = isRedacted(event.seq, "reason")
          ? REDACTED_TEXT
          : event.payload.reason;
        thrown.answeredAtSeq = event.seq;
        const tile = tiles.get(thrown.targetTileId);
        if (tile && tile.cardsThrown > 0) tile.cardsThrown -= 1;
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

      case "coach_nudge_delivered": {
        nudges.push({
          seq: event.seq,
          kind: event.payload.nudge_kind,
          text: isRedacted(event.seq) ? REDACTED_TEXT : event.payload.text,
          targetTileId: event.payload.target_tile_id ?? null,
          cardId: event.payload.card_id ?? null,
          forPlayer: event.actor_id,
        });
        break;
      }

      case "generosity_token_given": {
        state.generosity[event.payload.to_role] += 1;
        break;
      }

      case "level_cleared": {
        state.awards.levelCleared = {
          levelId: event.payload.level_id,
          cardId: event.payload.card_id,
          seq: event.seq,
        };
        break;
      }

      case "badge_granted": {
        state.awards.badges.push({
          badgeId: event.payload.badge_id,
          occurrence: event.payload.occurrence,
          seq: event.seq,
        });
        break;
      }

      case "points_changed": {
        state.awards.points += event.payload.delta;
        state.awards.pointEvents.push({
          delta: event.payload.delta,
          reason: event.payload.reason,
          seq: event.seq,
        });
        break;
      }

      case "certificate_granted": {
        state.awards.certificate = {
          levelId: event.payload.level_id,
          issuedAt: event.payload.issued_at,
        };
        break;
      }

      // Unreachable: the gate above already sent anything undeclared to
      // `skipped`. Kept so the switch stays exhaustive to the compiler.
      default:
        break;
    }
  }

  // Which thread a tile is really in.
  //
  // `tile_relocated` names one tile and moves it. Its children come along,
  // because a child is attached to its parent and the parent moved, but the
  // event says nothing about them and their own `threadRootId` still points at
  // the thread the subtree left. So the field cannot be trusted on its own;
  // the parent chain is the authority, and the root of that chain is the only
  // tile whose `threadRootId` is necessarily current.
  //
  // Deriving it here rather than cascading at relocation time means already
  // recorded games come out right on the next read, with no migration and no
  // corrective event. That is what a disposable projection is for.
  //
  // Walking up passes through removed parents on purpose: a removed tile is
  // still in the map, still holds its own parent link, and its live children
  // belong to the thread it was in, which is exactly where they surface as
  // orphans below.
  const effectiveRoot = (start: BoardTile): Uuid => {
    let current = start;
    const seen = new Set<Uuid>([start.id]);
    while (current.parentId && !seen.has(current.parentId)) {
      seen.add(current.parentId);
      const parent = tiles.get(current.parentId);
      if (!parent) break;
      current = parent;
    }
    return current.threadRootId;
  };

  // Normalise before bucketing, and on every tile rather than the live ones:
  // the composer reads `parent.threadRootId` to decide what `thread_root_id` a
  // new reply carries, so a stale value here would write the same mistake into
  // fresh events instead of only mis-drawing an old one.
  for (const tile of tiles.values()) tile.threadRootId = effectiveRoot(tile);

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
  state.proposals = [...proposals.values()].sort((a, b) => a.askedAtSeq - b.askedAtSeq);
  state.throws = [...throwsBySeq.values()].sort((a, b) => a.seq - b.seq);
  state.coachReadings = [...readings.values()].sort((a, b) => a.seq - b.seq);
  state.nudges = nudges;
  state.threads = [...threads.values()];
  state.tiles = [...tiles.values()].sort((a, b) => a.placedAtSeq - b.placedAtSeq);
  return state;
}
