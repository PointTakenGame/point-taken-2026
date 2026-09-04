import type { BoardState, BoardTile } from "@/lib/board/project";
import type { ProposalKind, Side, Uuid } from "@/lib/events/types";

/**
 * A Gym level is a cooked game: a real `games` row, a real event log, a real
 * board, and a script that says whose move is next and what the boss does
 * when it is his. This module is the script half. It is pure: it knows the
 * projected board and nothing about the database, so the same walk runs on
 * the server (to decide what the boss appends next) and in the client (to
 * decide what the coach says and which pause to show).
 *
 * Tiles in a script are named with short keys ("A", "A1", "B2") because
 * their uuids do not exist until the game does. `levelProgress` walks the
 * beats against the board in order and binds each key to the uuid it turns
 * out to have, so a later beat can say "throw the card at A3" and the client
 * can point at a real tile. Binding is by position, not text: the first
 * unbound tile of the right side under the right parent placed after the
 * previous beat is the one. The boss only ever places what the script says,
 * and the player is nudged back to the expected move if they wander, so
 * order is enough and text is left free to vary.
 *
 * Nothing here appends anything. Badges and points on a beat are what the
 * coach shows while the level runs; the four award events landed in
 * `0014_awards.sql`, and `lib/gym/awards.ts` writes them from these same
 * beats once the game ends. So during play the score is script-derived, and
 * after it the certificate reads the log.
 */

export type TileKey = string;

/** Resolution tokens the scripts use. The vocabulary lives in lib/board/rules. */
export type ScriptToken = "👍" | "👀";

export interface ScriptContext {
  /** Text of a bound tile, or null when the key has no tile yet. */
  textOf(key: TileKey): string | null;
  /** Every boss-side text already on the board, for "line already used" branches. */
  bossTexts: ReadonlySet<string>;
}

/** A line the boss speaks. A function when the line depends on what the player chose. */
export type ScriptText = string | ((ctx: ScriptContext) => string);

export type BossAct =
  | { kind: "tile"; key: TileKey; parent: TileKey | null; text: ScriptText }
  | { kind: "token"; thread: TileKey; emoji: ScriptToken }
  | { kind: "revise"; tile: TileKey; text: ScriptText }
  | { kind: "remove"; tile: TileKey }
  /** `tile` is null for a proposal that points at no tile, a definition. */
  | { kind: "accept"; proposal: ProposalKind; tile: TileKey | null };

export type PlayerExpect =
  | { kind: "tile"; key: TileKey; parent: TileKey | null; suggestions: readonly string[] }
  | { kind: "token"; thread: TileKey; emoji: ScriptToken }
  | { kind: "throw"; tile: TileKey; cardId: string; rungId: string | null }
  | { kind: "relocate"; tile: TileKey; to: TileKey }
  /**
   * The player rewriting one of their own tiles (level 3's third rung). Matched
   * on the tile carrying an edit, not on what it now says: the whole lesson is
   * that the player picks the smaller wording themselves, so nothing here reads
   * the words back and grades them.
   */
  | { kind: "edit"; tile: TileKey; suggestions?: readonly string[] }
  /**
   * The player asking the boss for something: a reading handed back, or a word
   * pinned down (level 4). `tile` is null when the proposal points at no tile.
   */
  | {
      kind: "propose";
      proposal: ProposalKind;
      tile: TileKey | null;
      suggestions?: readonly string[];
    };

interface BeatBase {
  id: string;
  /** What the coach says at the top of the board while this beat is current. */
  coach?: string;
  /** Badge ids (lib/progression/sample.ts) the certificate shows for clearing this beat. */
  badges?: readonly string[];
  /** Points the beat is worth, THROW_POINTS for a catch. Negative for a stake. */
  points?: number;
  /**
   * The machine-readable why, written into `points_changed.reason` when the
   * level is banked. "throw" unless the beat says otherwise; level 3's dare
   * uses "dare_staked" and "dare_repaired".
   */
  pointsReason?: string;
  /** The same thing in words, shown beside the score as it moves. */
  pointsLabel?: string;
}

export type Beat =
  | (BeatBase & {
      kind: "pause";
      title: string;
      body: string;
      button: string;
      /** A rule card to show face-up in the pause, by card id. */
      cardId?: string;
      /** A line the boss says in the pause, shown above the coach's. */
      bossSays?: string;
      /**
       * The moderator, who is neither player and speaks for the board itself.
       * Level 4 opens with the moderator refusing a question tile in front of
       * the player, which is how the rule is taught before the card is.
       */
      moderator?: string;
      /** What the boss says after the moderator, shown under that line. */
      bossReplies?: string;
    })
  | (BeatBase & {
      kind: "player";
      coach: string;
      /** Shown instead of `coach` once the player has moved and it was not the move. */
      nudge?: string;
      expect: PlayerExpect;
    })
  | (BeatBase & { kind: "boss"; act: BossAct; bossSays?: string })
  | (BeatBase & { kind: "win" });

export interface Level {
  id: string;
  number: number;
  title: string;
  topic: string;
  topicId: string;
  /** Kebab-case, matching lib/progression/sample.ts (BIZ-T260823-66). */
  bossId: string;
  bossName: string;
  bossEmoji: string;
  /** Snake_case card id from lib/coach/cards.ts, the card this level grants. */
  cardId: string;
  /**
   * How many thread roots this level's board opens with, written into
   * `game_started` when the player starts the level. Four everywhere except
   * level 1, where the script only has two threads to teach with.
   */
  rootTarget: number;
  playerSide: Side;
  bossSide: Side;
  /** The banner under the topic on the lobby screen. */
  banner: string;
  beats: readonly Beat[];
  /** What the certificate lists. Display only until award events exist. */
  awards: { badges: readonly string[]; cardId: string };
}

export interface LevelProgress {
  /** Index of the current beat, or beats.length when the level is complete. */
  index: number;
  complete: boolean;
  /** Script keys bound to real tile ids so far. */
  keys: Readonly<Record<TileKey, Uuid>>;
  /** The last event seq the walk consumed; a later lastSeq means the player did something else. */
  cursor: number;
  /** Beat ids that are done, in order. */
  done: readonly string[];
}

/** Pass this on the server, which cannot know which pauses the client has dismissed. */
export const ALL_PAUSES_DISMISSED: ReadonlySet<string> = new Set(["*"]);

function sideOf(level: Level, beat: Beat): Side {
  return beat.kind === "boss" ? level.bossSide : level.playerSide;
}

function findTile(
  board: BoardState,
  bound: Set<Uuid>,
  side: Side,
  parentId: Uuid | null,
  after: number,
): BoardTile | undefined {
  return board.tiles
    .filter(
      (tile) =>
        tile.side === side &&
        tile.parentId === parentId &&
        tile.placedAtSeq > after &&
        !bound.has(tile.id),
    )
    .sort((a, b) => a.placedAtSeq - b.placedAtSeq)[0];
}

/**
 * Walk the beats against the board. Returns where the level stands and the
 * tile keys it has bound on the way. A pause is done when it has been
 * dismissed, or when any evidence beat after it is done (a refresh must not
 * replay a pause the player already read past).
 */
export function levelProgress(
  level: Level,
  board: BoardState,
  dismissed: ReadonlySet<string> = new Set(),
): LevelProgress {
  const keys: Record<TileKey, Uuid> = {};
  const bound = new Set<Uuid>();
  const done: string[] = [];
  let cursor = 0;
  let pendingPause: number | null = null;
  const skipPauses = dismissed.has("*");

  const resolve = (key: TileKey | null): Uuid | null | undefined =>
    key === null ? null : keys[key];

  for (let i = 0; i < level.beats.length; i += 1) {
    const beat = level.beats[i];

    if (beat.kind === "pause") {
      if (!skipPauses && !dismissed.has(beat.id) && pendingPause === null)
        pendingPause = i;
      else done.push(beat.id);
      continue;
    }

    let matchedSeq: number | null = null;

    if (beat.kind === "win") {
      if (board.status === "ended") matchedSeq = board.lastSeq;
    } else {
      const spec = beat.kind === "boss" ? beat.act : beat.expect;
      const side = sideOf(level, beat);

      switch (spec.kind) {
        case "tile": {
          const parentId = resolve(spec.parent);
          if (parentId === undefined) break;
          const tile = findTile(board, bound, side, parentId, cursor);
          if (tile) {
            keys[spec.key] = tile.id;
            bound.add(tile.id);
            matchedSeq = tile.placedAtSeq;
          }
          break;
        }
        case "token": {
          const rootId = resolve(spec.thread);
          if (!rootId) break;
          const thread = board.threads.find((t) => t.rootId === rootId);
          if (!thread) break;
          if (thread.resolution && thread.resolution.emoji === spec.emoji) {
            matchedSeq = Math.max(cursor, thread.resolution.seq);
          } else if (thread.pending[side] === spec.emoji) {
            matchedSeq = cursor;
          }
          break;
        }
        case "throw": {
          const tileId = resolve(spec.tile);
          if (!tileId) break;
          const found = board.throws.find(
            (t) =>
              t.targetTileId === tileId && t.cardId === spec.cardId && t.seq > cursor,
          );
          if (found) matchedSeq = found.seq;
          break;
        }
        case "revise": {
          const tileId = resolve(spec.tile);
          if (!tileId) break;
          const answered = board.throws.find(
            (t) =>
              t.targetTileId === tileId && t.status === "answered" && t.seq <= cursor,
          );
          if (answered?.answeredAtSeq) matchedSeq = answered.answeredAtSeq;
          break;
        }
        case "remove": {
          const tileId = resolve(spec.tile);
          if (!tileId) break;
          const tile = board.tiles.find((t) => t.id === tileId);
          if (tile?.removed) matchedSeq = cursor;
          break;
        }
        case "relocate": {
          const tileId = resolve(spec.tile);
          if (!tileId) break;
          const proposal = board.proposals.find(
            (p) =>
              p.kind === "tile_relocation" &&
              p.targetTileId === tileId &&
              p.askedBy === side &&
              p.askedAtSeq > cursor,
          );
          if (proposal) matchedSeq = proposal.askedAtSeq;
          break;
        }
        case "accept": {
          const tileId = resolve(spec.tile);
          if (tileId === undefined) break;
          const proposal = board.proposals.find(
            (p) =>
              p.kind === spec.proposal &&
              p.targetTileId === tileId &&
              p.status === "accepted",
          );
          if (proposal?.answeredAtSeq) matchedSeq = proposal.answeredAtSeq;
          break;
        }
        case "edit": {
          const tileId = resolve(spec.tile);
          if (!tileId) break;
          const tile = board.tiles.find((t) => t.id === tileId);
          // Same shape as "remove": the projection keeps the flag, not the seq
          // it was set at, so the cursor stands where it was.
          if (tile?.edited) matchedSeq = cursor;
          break;
        }
        case "propose": {
          const tileId = resolve(spec.tile);
          if (tileId === undefined) break;
          const proposal = board.proposals.find(
            (p) =>
              p.kind === spec.proposal &&
              p.targetTileId === tileId &&
              p.askedBy === side &&
              p.askedAtSeq > cursor,
          );
          if (proposal) matchedSeq = proposal.askedAtSeq;
          break;
        }
      }
    }

    if (matchedSeq === null) {
      return {
        index: pendingPause ?? i,
        complete: false,
        keys,
        cursor,
        done,
      };
    }

    if (pendingPause !== null) {
      done.push(level.beats[pendingPause].id);
      pendingPause = null;
    }
    done.push(beat.id);
    cursor = Math.max(cursor, matchedSeq);
  }

  if (pendingPause !== null) {
    return { index: pendingPause, complete: false, keys, cursor, done };
  }
  return { index: level.beats.length, complete: true, keys, cursor, done };
}

export function currentBeat(level: Level, progress: LevelProgress): Beat | null {
  return progress.complete ? null : level.beats[progress.index];
}

/** The context a boss line is rendered against. */
export function scriptContext(
  level: Level,
  board: BoardState,
  keys: Readonly<Record<TileKey, Uuid>>,
): ScriptContext {
  const byId = new Map(board.tiles.map((tile) => [tile.id, tile]));
  return {
    textOf: (key) => {
      const id = keys[key];
      return id ? (byId.get(id)?.text ?? null) : null;
    },
    bossTexts: new Set(
      board.tiles.filter((tile) => tile.side === level.bossSide).map((tile) => tile.text),
    ),
  };
}

export function renderText(text: ScriptText, ctx: ScriptContext): string {
  return typeof text === "string" ? text : text(ctx);
}

/** Everything a level lists as earned, gathered from its beats and its awards. */
export function levelBadges(level: Level): string[] {
  const seen = new Set<string>();
  for (const beat of level.beats) for (const id of beat.badges ?? []) seen.add(id);
  for (const id of level.awards.badges) seen.add(id);
  return [...seen];
}

export function levelPoints(level: Level, progress: LevelProgress): number {
  const doneIds = new Set(progress.done);
  return level.beats.reduce(
    (sum, beat) => sum + (doneIds.has(beat.id) ? (beat.points ?? 0) : 0),
    0,
  );
}
