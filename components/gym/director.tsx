"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { bossAct } from "@/app/gym/actions";
import { clearBossDraft, publishBossDraft } from "@/components/gym/boss-draft";
import {
  clearCookedPlacement,
  publishCookedPlacement,
} from "@/components/gym/cooked-placement";
import {
  clearHiddenSurfaces,
  publishHiddenSurfaces,
} from "@/components/gym/hidden-surfaces";
import { clearTaughtMoves, publishTaughtMoves } from "@/components/gym/taught-moves";
import {
  clearSampleAnswers,
  publishSampleAnswers,
} from "@/components/gym/sample-answers";
import {
  legalPlacements,
  topicRootedLayout,
  TOPIC_CELL_ID,
  type GridPosition,
} from "@/components/board/layout";
import { setSeatSpeech } from "@/components/board/seat-speech";
import { RuleCardFace } from "@/components/board/rule-card-face";
import {
  clearPointedSlot,
  publishPointedSlot,
  type PointedSlot,
} from "@/components/gym/pointed-slot";
import { useMovingTile } from "@/components/gym/moving-tile";
import { clearPointedTile, publishPointedTile } from "@/components/gym/pointed-tile";
import { AnchoredCard } from "@/components/ui/anchored-card";
import type { BoardState } from "@/lib/board/project";
import type { TileCorner, Uuid } from "@/lib/events/types";
import { levelById } from "@/lib/gym/levels";
import {
  currentBeat,
  levelPoints,
  levelProgress,
  offScriptTokenNudge,
  renderText,
  scriptContext,
  type Beat,
  type BeatAnchor,
  type BoardSurface,
  type Level,
  type LevelProgress,
  type PlayerExpect,
  type TileKey,
} from "@/lib/gym/script";
import { taughtMoves } from "@/lib/gym/taught";

/**
 * The Gym director: the coach at the top centre of the board and the pauses
 * between beats, driven by the level script against the live board.
 *
 * It renders beside LiveBoard rather than inside it. The board is the same
 * board a live game uses; the director only reads it (through the page's
 * server render, which the realtime feed already refreshes) and adds three
 * things on top: the coach's line for the current beat, a suggestion picker
 * when the beat wants a tile, and a speech bubble pointing at whatever the
 * script is talking about. When the beat is the boss's tile it types the
 * boss's line into the slot it will land in, a character at a time
 * (`components/gym/boss-draft.ts`), and asks the server to play the move
 * once the typing is done; a token or a revision waits a moment instead, so
 * the boss reads as thinking rather than instant.
 *
 * The coach itself never leaves the top centre and never unmounts while a
 * beat is showing (Steve, 2026-09-04 playtest: "keep the coach on the top as
 * that's their place where they live"). Everything it says is drawn as a
 * speech bubble pointing at the thing the beat is about, using
 * `AnchoredCard`'s selector-anchoring against the board's `data-tile-id` /
 * `data-slot-parent` / `data-slot-corner` attributes; a beat with nothing to
 * point at, or whose target has not entered the DOM yet, docks its bubble
 * below the coach instead of vanishing.
 *
 * Which pauses have been read is client state, kept in sessionStorage per
 * game so a refresh does not replay them. Everything else is the log.
 */

const BOSS_DELAY_MS = 1200;

/**
 * The boss's typing speed, per character. The same band as the player's own
 * sample being typed into the composer (`useTypedSample`, live-board.tsx),
 * so the two sides of the table type alike. A 90-character reason takes
 * under three seconds; a `prefers-reduced-motion` viewer gets the whole line
 * at once after the ordinary thinking delay.
 */
const BOSS_TYPE_MIN_MS = 25;
const BOSS_TYPE_MAX_MS = 35;

function storageKey(gameId: string): string {
  return `pt-gym-pauses:${gameId}`;
}

// sessionStorage as an external store, so the read is a snapshot rather
// than a setState inside an effect (react-hooks/set-state-in-effect), and
// the server render sees an empty set rather than a hydration mismatch.
const CHANGE_EVENT = "pt-gym-pauses-change";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readRaw(gameId: string): string {
  try {
    return window.sessionStorage.getItem(storageKey(gameId)) ?? "[]";
  } catch {
    return "[]";
  }
}

function writeDismissed(gameId: string, ids: Set<string>): void {
  try {
    window.sessionStorage.setItem(storageKey(gameId), JSON.stringify([...ids]));
  } catch {
    // Storage is a convenience; the pause just shows again on reload.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function parseDismissed(raw: string): Set<string> {
  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

/**
 * The score as it stands, and what moved it last.
 *
 * Points are only written to the log when the level ends (lib/gym/awards.ts
 * banks them all at once), so during play the running total is the script's
 * own arithmetic over the beats already done. Level 3 stakes points on the
 * dare and gives them back on the repair, and a stake nobody can see is not
 * a stake, so the beat that last moved the number says so in words.
 */
function scoreboard(
  level: Level,
  progress: LevelProgress,
): { total: number; delta: number; label: string } | null {
  const total = levelPoints(level, progress);
  const byId = new Map(level.beats.map((beat) => [beat.id, beat]));
  let delta = 0;
  let label = "";
  for (const id of [...progress.done].reverse()) {
    const beat = byId.get(id);
    if (!beat?.points) continue;
    delta = beat.points;
    label = beat.pointsLabel ?? "caught it";
    break;
  }
  if (total === 0 && delta === 0) return null;
  return { total, delta, label };
}

const PILL =
  "font-primary rounded-full border-[1.5px] border-ink bg-orange px-5 py-2 tracking-wide uppercase text-ink transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40";

/** The coach persona's own DOM hook: every bubble that has nothing else to point at docks under this. */
const COACH_PERSONA_SELECTOR = "[data-coach-persona]";

/**
 * Same escaping `components/board/live-board.tsx` does for its own
 * `data-tile-id` selectors. Not exported there, so duplicated here rather
 * than reaching into a file this agent does not own.
 */
function cssEscape(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

function resolveAnchor(
  anchor: BeatAnchor | null | undefined,
  keys: Readonly<Record<TileKey, Uuid>>,
): string | null {
  if (!anchor) return null;
  if ("tile" in anchor) {
    // "topic" is the one tile key that is not a script key: the topic tile is
    // on the board before any beat runs, so it has no uuid to bind, and the
    // board renders it under the fixed id `TOPIC_CELL_ID`. The slot branch
    // below already treats the literal the same way.
    const id = anchor.tile === "topic" ? TOPIC_CELL_ID : keys[anchor.tile];
    return id ? `[data-tile-id="${cssEscape(id)}"]` : null;
  }
  if ("ui" in anchor) {
    return `[data-ui="${cssEscape(anchor.ui)}"]`;
  }
  if ("token" in anchor) {
    // The badge is drawn by live-board's `ThreadTokenBadge` and stamped with
    // the thread root's own uuid, so a token anchor is a tile anchor pointed
    // one level finer: at the token on the tile's edge rather than at the
    // tile.
    const rootId = keys[anchor.token];
    return rootId ? `[data-token-badge="${cssEscape(rootId)}"]` : null;
  }
  const parentValue =
    anchor.slot.parent === "topic" ? TOPIC_CELL_ID : keys[anchor.slot.parent];
  if (!parentValue) return null;
  return `[data-slot-parent="${cssEscape(parentValue)}"][data-slot-corner="${anchor.slot.corner}"]`;
}

// The reverse of layout.ts's own (private) CORNER_OFFSETS table. Not
// exported there, so mirrored here; the four diagonals never change shape,
// only which offset corresponds to which corner name, so this is a fixed
// table rather than a magic number.
const OFFSET_TO_CORNER: Readonly<Record<string, TileCorner>> = {
  "1,-1": "ne",
  "1,1": "se",
  "-1,1": "sw",
  "-1,-1": "nw",
};

function cornerFromOffset(parent: GridPosition, target: GridPosition): TileCorner | null {
  return OFFSET_TO_CORNER[`${target.x - parent.x},${target.y - parent.y}`] ?? null;
}

/**
 * Where a tile-placement beat's slot actually sits right now, read off the
 * same geometry the board itself uses (`legalPlacements`, `topicRootedLayout`
 * in `components/board/layout.ts`), not guessed. A root tries the player's
 * side first (bottom corner in level 1); a reply tries the fixed NE/SE/SW/NW
 * order every ordinary placement does. Either way this asks the board's own
 * layout function for the first open, legal cell, so it can never disagree
 * with where the tile would actually land.
 */
function defaultTileAnchor(
  level: Level,
  board: BoardState,
  keys: Readonly<Record<TileKey, Uuid>>,
  expect: Extract<PlayerExpect, { kind: "tile" }>,
): BeatAnchor | null {
  const layout = topicRootedLayout(
    board.tiles.map((tile) => ({
      id: tile.id,
      parentId: tile.parentId,
      side: tile.side,
      corner: tile.corner,
    })),
  );
  const parentId = expect.parent === null ? TOPIC_CELL_ID : keys[expect.parent];
  if (!parentId) return null;
  const parentPos = layout.positions.get(parentId);
  if (!parentPos) return null;
  const side = expect.parent === null ? level.playerSide : null;
  const open = legalPlacements(layout, parentId, side)[0];
  if (!open) return null;
  const corner = cornerFromOffset(parentPos, open);
  if (!corner) return null;
  return { slot: { parent: expect.parent ?? "topic", corner } };
}

/**
 * The slot the boss's next tile will land in, and the words that will go in
 * it, worked out on the client from the same script and layout the server
 * will use. `bossAct` (app/gym/actions.ts) renders the same `act.text`
 * against the same board, so what gets typed is what gets placed; the
 * corner is the first legal cell the layout offers, which is where the
 * server's cornerless `tile_placed` gets drawn anyway.
 */
function bossTilePlan(
  level: Level,
  board: BoardState,
  progress: LevelProgress,
  beat: Extract<Beat, { kind: "boss" }>,
): { text: string; parentId: string; corner: TileCorner } | null {
  if (beat.act.kind !== "tile") return null;
  const text = renderText(beat.act.text, scriptContext(level, board, progress.keys));
  const layout = topicRootedLayout(
    board.tiles.map((tile) => ({
      id: tile.id,
      parentId: tile.parentId,
      side: tile.side,
      corner: tile.corner,
    })),
  );
  const parentId =
    beat.act.parent === null ? TOPIC_CELL_ID : progress.keys[beat.act.parent];
  if (!parentId) return null;
  const parentPos = layout.positions.get(parentId);
  if (!parentPos) return null;
  const side = beat.act.parent === null ? level.bossSide : null;
  const open = legalPlacements(layout, parentId, side)[0];
  if (!open) return null;
  const corner = cornerFromOffset(parentPos, open);
  if (!corner) return null;
  return { text, parentId, corner };
}

/**
 * Which of the level's `hiddenSurfaces` are still hidden, given how far the
 * script has gotten. A surface stays hidden until some pause beat at or
 * before the current one names it in `reveal`; `progress.index` only moves
 * forward (`levelProgress` in lib/gym/script.ts), so a surface already
 * revealed can never go back into this set on a later render or a reload.
 */
function stillHidden(level: Level, progress: LevelProgress): readonly BoardSurface[] {
  const all = level.hiddenSurfaces;
  if (!all || all.length === 0) return [];
  const revealed = new Set<BoardSurface>();
  const last = progress.complete ? level.beats.length - 1 : progress.index;
  for (let i = 0; i <= last && i < level.beats.length; i += 1) {
    const beat = level.beats[i];
    if (beat.kind !== "pause" || !beat.reveal) continue;
    for (const surface of beat.reveal) revealed.add(surface);
  }
  return all.filter((surface) => !revealed.has(surface));
}

/**
 * Takes the level by id rather than as an object: a level's boss lines can
 * be functions of what the player wrote, and a function cannot cross the
 * server-to-client prop boundary. The lookup is pure and runs on both sides.
 */
export function GymDirector({
  gameId,
  levelId,
  board,
}: {
  gameId: string;
  levelId: string;
  board: BoardState;
}) {
  const level = levelById(levelId);
  if (!level) return null;
  return <Director gameId={gameId} level={level} board={board} />;
}

function Director({
  gameId,
  level,
  board,
}: {
  gameId: string;
  level: Level;
  board: BoardState;
}) {
  const router = useRouter();
  const rawDismissed = useSyncExternalStore(
    subscribe,
    () => readRaw(gameId),
    () => "[]",
  );
  const dismissed = useMemo(() => parseDismissed(rawDismissed), [rawDismissed]);
  // Which reason the board is currently waiting to put somewhere else, if any.
  // The only reader is the relocate anchor below; see the file comment in
  // `components/gym/moving-tile.ts` for why the board has to say this out loud.
  const movingTileId = useMovingTile();
  const [error, setError] = useState<string | null>(null);
  // The boss move is the only transition left here now that the sample
  // answers are placed from the board; nothing on this card is disabled
  // while it runs, so the pending flag itself is unread.
  const [, startTransition] = useTransition();

  const progress = useMemo(
    () => levelProgress(level, board, dismissed),
    [level, board, dismissed],
  );
  const beat = currentBeat(level, progress);

  // One boss move per (beat, board) pair. A second render with the same
  // board must not fire again; a refreshed board with the same beat may,
  // because that means the first attempt did not land.
  const firedRef = useRef<string | null>(null);
  const beatId = beat?.id ?? null;
  const beatKind = beat?.kind ?? null;
  // A tile beat is typed into its slot before it is played; anything else
  // (a token, a revision) is played after the thinking delay. Memoised on
  // the board, so a re-render with the same board does not restart typing.
  const plan = useMemo(
    () => (beat?.kind === "boss" ? bossTilePlan(level, board, progress, beat) : null),
    [beat, level, board, progress],
  );
  // Primitives, not the plan object: a refreshed board with the same lastSeq
  // (a realtime tick, another action's refresh) makes a new object with the
  // same three values, and an effect keyed on the object would tear down the
  // typing mid-line and, with the stamp already set, never restart it.
  const planText = plan?.text ?? null;
  const planParent = plan?.parentId ?? null;
  const planCorner = plan?.corner ?? null;
  useEffect(() => {
    if (beatKind !== "boss" || !beatId) return;
    const plan =
      planText !== null && planParent !== null && planCorner !== null
        ? { text: planText, parentId: planParent, corner: planCorner }
        : null;
    // Checked and set inside `play`, not up here: React's dev-only Strict
    // Mode runs this effect, tears it down, and runs it again before the
    // first paint, and the stamp must not survive that phantom first pass.
    // A guard set here would be written by the phantom run and make the
    // real, lasting run see its own stamp as already spent, so it would
    // return before ever publishing a draft or scheduling `play` at all
    // (Steve, 2026-09-05 playtest: this is the actual cause of a boss turn
    // that never starts, not merely one that starts slow).
    const stamp = `${beatId}@${board.lastSeq}`;
    let played = false;
    const play = () => {
      // A finished tick loop and a finishNow click can both reach here for
      // the same move; only the first one goes out. The stamp guard is the
      // same idea across effect invocations: only the first invocation
      // whose `play` actually runs (the phantom Strict Mode pass never gets
      // this far, because its own cleanup clears its timers first) gets to
      // send the move.
      if (played || firedRef.current === stamp) return;
      played = true;
      firedRef.current = stamp;
      // Drop the draft as the move goes out: the real tile lands in the same
      // cell on the next refresh, and two of them for a frame is a stutter.
      clearBossDraft();
      startTransition(async () => {
        const result = await bossAct(gameId);
        if (!result.ok) setError(result.error);
        router.refresh();
      });
    };
    if (!plan) {
      const timer = window.setTimeout(play, BOSS_DELAY_MS);
      return () => window.clearTimeout(timer);
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const draft = {
      parentId: plan.parentId,
      corner: plan.corner,
      side: level.bossSide,
      bossName: level.bossName,
    };
    if (reduced) {
      publishBossDraft({ ...draft, text: plan.text, finishNow: play });
      const timer = window.setTimeout(play, BOSS_DELAY_MS);
      return () => {
        window.clearTimeout(timer);
        clearBossDraft();
      };
    }
    // Time-based, not count-based: `shown` is worked out from how much real
    // time has elapsed since typing started, not incremented by one on every
    // tick. A tab that loses focus gets its timers clamped by the browser
    // (observed: a background tab's setTimeout chain fires at roughly 1Hz
    // instead of every ~30ms, which is exactly the 40-50s a 2026-09
    // playtester saw for an 80-character line). With a fixed one-char-per-
    // tick loop that clamp makes the whole line take as long as it has
    // characters; here it only costs the one clamped tick, because that tick
    // reveals however many characters should already be showing and catches
    // straight up.
    const avgMsPerChar = (BOSS_TYPE_MIN_MS + BOSS_TYPE_MAX_MS) / 2;
    // Set when the typing phase itself starts (after the thinking pause
    // below), not when the effect runs: `elapsed` below measures from there.
    let startedAt = 0;
    let timer = 0;
    const finishTyping = () => {
      window.clearTimeout(timer);
      publishBossDraft({ ...draft, text: plan.text, finishNow: play });
      timer = window.setTimeout(play, BOSS_DELAY_MS / 2);
    };
    const tick = () => {
      const elapsed = performance.now() - startedAt;
      const shown = Math.min(plan.text.length, Math.floor(elapsed / avgMsPerChar) + 1);
      if (shown >= plan.text.length) {
        finishTyping();
        return;
      }
      publishBossDraft({
        ...draft,
        text: plan.text.slice(0, shown),
        finishNow: finishTyping,
      });
      timer = window.setTimeout(
        tick,
        BOSS_TYPE_MIN_MS + Math.random() * (BOSS_TYPE_MAX_MS - BOSS_TYPE_MIN_MS),
      );
    };
    // An empty slot with a caret for a moment first, the way a person pauses
    // before the first key, then the line.
    publishBossDraft({ ...draft, text: "", finishNow: finishTyping });
    timer = window.setTimeout(() => {
      startedAt = performance.now();
      tick();
    }, BOSS_DELAY_MS / 2);
    return () => {
      window.clearTimeout(timer);
      clearBossDraft();
    };
  }, [
    beatId,
    beatKind,
    board.lastSeq,
    gameId,
    router,
    planText,
    planParent,
    planCorner,
    level.bossSide,
    level.bossName,
  ]);

  // Hand the coach's sample answers to the board, which draws them in the
  // open slots. Republishing an unchanged list is a no-op, and unmounting
  // clears the offer so a board that outlives the Director shows plain slots.
  const samples =
    beat?.kind === "player" && beat.expect.kind === "tile"
      ? beat.expect.suggestions
      : null;
  useEffect(() => {
    publishSampleAnswers(samples ?? []);
    return () => clearSampleAnswers();
  }, [samples]);

  // Every player/pause beat gets a spatial target: the one it wrote into the
  // script, or, for a placement prompt that did not name one, the slot the
  // board's own layout would actually offer next. Boss and win beats have no
  // `anchor` field (script.ts only adds it to pause and player) so they
  // always dock under the coach.
  const anchor: BeatAnchor | null = useMemo(() => {
    if (!beat) return null;
    if (beat.kind === "pause") return beat.anchor ?? null;
    if (beat.kind === "player") {
      if (beat.expect.kind === "relocate") {
        // Two-phase pointer: point at the tile to pick up first, then, once
        // the player has pressed Move it and the board is waiting for the
        // destination click, switch to pointing at the destination root, so
        // the coach walks the player through both clicks instead of freezing
        // on the first one for the rest of the beat. A move lands on that
        // second click with nothing appended in between (BRAIN-T260905-64),
        // so the phase comes from the board rather than from the log.
        const tileId = progress.keys[beat.expect.tile];
        const armed = Boolean(tileId && movingTileId === tileId);
        return armed
          ? { tile: beat.expect.to }
          : (beat.anchor ?? { tile: beat.expect.tile });
      }
      if (beat.anchor) return beat.anchor;
      if (beat.expect.kind === "tile") {
        return defaultTileAnchor(level, board, progress.keys, beat.expect);
      }
      return null;
    }
    return null;
  }, [beat, level, board, progress.keys, movingTileId]);

  const targetSelector = useMemo(
    () => resolveAnchor(anchor, progress.keys),
    [anchor, progress.keys],
  );

  // A slot anchor is also published to the board, which draws that one slot
  // permanently so the arrow has something to point at: reply slots are
  // otherwise hover-only (`components/gym/pointed-slot.ts`).
  const pointedSlot: PointedSlot | null = useMemo(() => {
    if (!anchor || !("slot" in anchor)) return null;
    const parentId =
      anchor.slot.parent === "topic" ? TOPIC_CELL_ID : progress.keys[anchor.slot.parent];
    return parentId ? { parentId, corner: anchor.slot.corner } : null;
  }, [anchor, progress.keys]);
  useEffect(() => {
    publishPointedSlot(pointedSlot);
    return () => clearPointedSlot();
  }, [pointedSlot]);

  // A tile anchor (a beat pointing at something already on the board, the
  // relocate lesson in level 2 being the first) is published the same way,
  // so the board's "frame the coach's target" pan can bring it into view.
  // Without this the arrow still finds the tile (AnchoredCard measures the
  // DOM directly) but nothing brings the tile itself onto the screen, and a
  // resumed game's leftover camera position can leave it well off the pane.
  const pointedTileId: string | null = useMemo(() => {
    if (!anchor) return null;
    // A token anchor points at a badge on a tile's edge, so the tile to bring
    // on screen is that badge's thread root. Without this the camera would
    // leave the arrow pointing off the pane at exactly the beat that asks the
    // player to click the thing.
    if ("token" in anchor) return progress.keys[anchor.token] ?? null;
    if (!("tile" in anchor)) return null;
    return progress.keys[anchor.tile] ?? null;
  }, [anchor, progress.keys]);
  useEffect(() => {
    publishPointedTile(pointedTileId);
    return () => clearPointedTile();
  }, [pointedTileId]);

  // Board chrome level 1 keeps off screen until the beat that explains it.
  // Every other level's `hiddenSurfaces` is unset, so this is always [].
  const hidden = useMemo(() => stillHidden(level, progress), [level, progress]);
  useEffect(() => {
    publishHiddenSurfaces(hidden);
    return () => clearHiddenSurfaces();
  }, [hidden]);

  // What the ladder has taught by this beat, so the board can withhold the
  // moves the player has never been shown (lib/gym/taught.ts). Level 1 was
  // offering "Say it back", "Pin down a word", "move", and both resolution
  // tokens from its first beat, and teaches none of them until it does.
  // `progress.index` is the current beat and runs one past the last beat
  // when the level is complete, which `taughtMoves` reads as "all of them",
  // so nothing stays withheld once the script is finished.
  const taught = useMemo(
    () => taughtMoves(level, progress.index),
    [level, progress.index],
  );
  useEffect(() => {
    publishTaughtMoves(taught);
    return () => clearTaughtMoves();
  }, [taught]);

  // A cooked level (level 1 today) narrows placement down to one choice:
  // the slot the beat already points at, nothing under the player's own
  // tiles, no hover ghosts, and a locked draft. `pointedSlot` above is the
  // slot the beat's anchor resolves to regardless of level; here it doubles
  // as the one legal placement, and is already null for a beat with no slot
  // anchor (a throw, a token, a tile anchor), which is exactly when nothing
  // should be offered at all.
  //
  // Steve, 2026-09-07: the locked draft is not part of that bundle any more,
  // it applies to every Gym level. A level teaches one rule by walking the
  // player through a board whose next move is known, and a player who rewrites
  // the coach's sample can walk it somewhere the script cannot follow. Stick
  // to the Root is the plain case: if the player edits the root, the rule has
  // nothing left to be about. So a Gym draft is the script's words, and Place
  // or Cancel are the only moves. This is until further notice; when a level
  // should hand the writing back, that level stops locking, not all of them.
  // A live game is untouched: no Director mounts, so `NONE` still applies.
  const cookedPlacement = useMemo(
    () =>
      level.cooked
        ? {
            onlySlot: pointedSlot,
            ownReplies: false,
            ghosts: false,
            lockedText: true,
          }
        : { onlySlot: null, ownReplies: true, ghosts: true, lockedText: true },
    [level.cooked, pointedSlot],
  );
  useEffect(() => {
    publishCookedPlacement(cookedPlacement);
    return () => clearCookedPlacement();
  }, [cookedPlacement]);

  // Where "Bashful Bob is typing" gets drawn.
  //
  // Steve, 2026-09-07: "the Bashful Bob is thinking notification appears under
  // the coach instead of near Bashful Bob. Bashful Bob should have some area
  // above him where his thoughts are available." It was in the coach's bubble
  // because the coach is what narrates a beat, but the coach narrating that
  // somebody else is typing is the coach reporting the room rather than
  // teaching. The boss has a seat badge with a face in it, and that is where a
  // person's own activity belongs, so it goes to the badge and the coach stops
  // mentioning it (see LineBubble below).
  //
  // A tile act is typing, because words are being written. Everything else is
  // thinking, because nothing is.
  const bossActivity =
    beat?.kind === "boss" ? (beat.act.kind === "tile" ? "typing" : "thinking") : null;
  useEffect(() => {
    setSeatSpeech(bossActivity ? { side: level.bossSide, state: bossActivity } : null);
    return () => setSeatSpeech(null);
  }, [bossActivity, level.bossSide]);

  // Pause beats can ask to hold their bubble back a moment
  // (`Beat.delayMs`), so the coach visibly reads the board before speaking,
  // instead of the bubble appearing the instant the beat becomes current.
  // Keyed on beat id rather than reset synchronously in this effect: a beat
  // with no delay is simply always ready (see `bubbleReady` below), and one
  // with a delay becomes ready only once its own timer's callback says so,
  // which is what keeps this off the `react-hooks/set-state-in-effect` rule
  // the same way the boss-typing effect above does.
  const [readyBeatId, setReadyBeatId] = useState<string | null>(null);
  const delayMs = beat?.kind === "pause" ? (beat.delayMs ?? 0) : 0;
  useEffect(() => {
    if (!beatId || !delayMs) return;
    const timer = window.setTimeout(() => setReadyBeatId(beatId), delayMs);
    return () => window.clearTimeout(timer);
  }, [beatId, delayMs]);
  const bubbleReady = delayMs === 0 || readyBeatId === beatId;

  if (!beat) return null;

  const dismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    writeDismissed(gameId, next);
  };

  const step = `Level ${level.number} · ${progress.done.length + 1} of ${level.beats.length}`;
  const score = scoreboard(level, progress);

  return (
    <>
      <CoachPersona step={step} score={score} thinking={!bubbleReady} />
      {!bubbleReady ? null : beat.kind === "pause" ? (
        <PauseBubble
          beat={beat}
          level={level}
          targetSelector={targetSelector}
          onDismiss={() => dismiss(beat.id)}
        />
      ) : (
        <LineBubble
          beat={beat}
          level={level}
          board={board}
          progress={progress}
          targetSelector={targetSelector}
          error={error}
        />
      )}
    </>
  );
}

/**
 * The coach itself: small, pinned top centre, always mounted while a beat is
 * showing. Never the thing carrying the level's words any more; those are
 * the speech bubbles pointing at it or at the board. This is just where the
 * coach visibly lives, and where the score sits.
 *
 * **The coach's own activity sits under the card, Steve 2026-09-07:** "for the
 * coach, their equivalent of that is the area right underneath the coach
 * card." The equivalent being the thought space now reserved beside each
 * player's seat badge (`SeatBadge`, live-board.tsx). So "reading the board" is
 * no longer a word swap inside the pill, where it replaced the coach's own
 * name and made the pill change width mid-level; it hangs below, in the same
 * place every time, and the pill stays put.
 *
 * It is absolutely positioned so it cannot move the pill, and it does not
 * collide with the beat's bubble even though the bubble docks in the same
 * place when it has no target: the bubble is only mounted once `bubbleReady`,
 * and `thinking` is exactly `!bubbleReady`.
 */
function CoachPersona({
  step,
  score,
  thinking = false,
}: {
  step: string;
  score: { total: number; delta: number; label: string } | null;
  /** True while a beat's `delayMs` is holding its bubble back. */
  thinking?: boolean;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-40 flex flex-col items-center px-4">
      <div
        data-coach-persona
        className="sticker pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2"
      >
        <span aria-hidden className="text-2xl leading-none">
          🧘
        </span>
        <span className="font-label text-ink-soft">Coach · {step}</span>
        {score ? (
          <span className="font-label text-ink shrink-0">
            {score.total} pts
            {score.delta ? (
              <span className="text-ink-soft">
                {" "}
                · {score.delta > 0 ? "+" : ""}
                {score.delta} {score.label}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>
      {/* The coach's thought space: under the card, always in the same place,
          empty when the coach has nothing going on. */}
      <div className="relative w-full" aria-live="polite">
        {thinking ? (
          <span className="sticker font-secondary text-p-sm text-ink-soft absolute top-2 left-1/2 -translate-x-1/2 rounded-2xl px-3 py-1.5 whitespace-nowrap italic">
            reading the board...
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Wraps `AnchoredCard` with the gym's own two rules: point at the target
 * with an arrow when there is one, or dock below the coach, arrowless, when
 * there is not (no target named, or the named one has not rendered yet). No
 * close button on either: a pause is dismissed by its own button, and a
 * player/boss/win beat has nothing to dismiss, it just changes when the
 * board does.
 */
function Bubble({
  targetSelector,
  width,
  children,
}: {
  targetSelector: string | null;
  width: number;
  children: ReactNode;
}) {
  const noop = () => {};
  if (targetSelector) {
    return (
      <AnchoredCard
        anchorSelector={targetSelector}
        fallbackSelector={COACH_PERSONA_SELECTOR}
        onClose={noop}
        showClose={false}
        arrow
        placement="side"
        width={width}
      >
        {children}
      </AnchoredCard>
    );
  }
  return (
    <AnchoredCard
      anchorSelector={COACH_PERSONA_SELECTOR}
      onClose={noop}
      showClose={false}
      placement="below"
      width={width}
    >
      {children}
    </AnchoredCard>
  );
}

function PauseBubble({
  beat,
  level,
  targetSelector,
  onDismiss,
}: {
  beat: Extract<Beat, { kind: "pause" }>;
  level: Level;
  targetSelector: string | null;
  onDismiss: () => void;
}) {
  // The card is drawn at full size, the same object the tray raises when it is
  // armed, so "this is a rule card" and the thing the player clicks a beat
  // later are recognisably one card rather than two summaries of it.
  const cardId = beat.cardId ?? null;
  return (
    <Bubble targetSelector={targetSelector} width={24}>
      <div
        role="dialog"
        aria-labelledby={`gym-pause-${beat.id}`}
        className="flex flex-col gap-3"
      >
        <h2
          id={`gym-pause-${beat.id}`}
          className="font-figure text-ink text-xl font-black tracking-wide uppercase"
        >
          {beat.title}
        </h2>
        {cardId ? (
          <div className="flex justify-center py-1">
            <RuleCardFace cardId={cardId} />
          </div>
        ) : null}
        {beat.bossSays ? (
          <p className="font-secondary text-ink-soft italic">
            {level.bossEmoji} {level.bossName}: “{beat.bossSays}”
          </p>
        ) : null}
        {/*
          The moderator is the board itself talking, not a third player, so it
          is set apart from both of them: level 4 opens with it refusing a
          question tile in front of you, and the boss answering it.
        */}
        {beat.moderator ? (
          <p className="border-ink font-secondary text-ink border-l-[1.5px] pl-3">
            ⚖️ Moderator: {beat.moderator}
          </p>
        ) : null}
        {beat.bossReplies ? (
          <p className="font-secondary text-ink-soft italic">
            {level.bossEmoji} {level.bossName}: “{beat.bossReplies}”
          </p>
        ) : null}
        <Paragraphs className="font-secondary text-ink" text={beat.body} />
        <div>
          <button type="button" className={PILL} onClick={onDismiss} autoFocus>
            {beat.button}
          </button>
        </div>
      </div>
    </Bubble>
  );
}

/**
 * A coach line or a pause body, broken at its blank lines.
 *
 * Both used to be one `<p>{text}</p>`, which quietly collapsed every `\n\n`
 * in the scripts into a single space: the breaks were written and never
 * appeared. Steve asked on 2026-09-07 for real breaks at the natural pauses,
 * so a blank line in a script string is now a paragraph break here. A single
 * newline is not: the scripts use blank lines for this and nothing else, and
 * treating every newline as a break would turn a wrapped source string into
 * an accidental split.
 *
 * `text` may be null or undefined, which is what a player beat with no
 * nudge of its own hands over; nothing renders in that case.
 */
function Paragraphs({
  text,
  className,
}: {
  text: string | null | undefined;
  className?: string;
}) {
  const parts = (text ?? "").split(/\n\s*\n/).filter((part) => part.trim() !== "");
  if (parts.length === 0) return null;
  return (
    <>
      {parts.map((part, i) => (
        <p key={i} className={className}>
          {part}
        </p>
      ))}
    </>
  );
}

function LineBubble({
  beat,
  level,
  board,
  progress,
  targetSelector,
  error,
}: {
  beat: Extract<Beat, { kind: "player" | "boss" | "win" }>;
  level: Level;
  board: BoardState;
  progress: LevelProgress;
  targetSelector: string | null;
  error: string | null;
}) {
  const nudging =
    beat.kind === "player" && !!beat.nudge && board.lastSeq > progress.cursor;
  // A pending token with nothing to answer it yet is worth explaining
  // before anything else this bubble might say, on either a player or a
  // boss beat: see offScriptTokenNudge for the two cases it covers.
  const tokenNudge =
    beat.kind === "win" ? null : offScriptTokenNudge(level, board, progress);
  // A boss beat with nothing written for it used to fall back to
  // "<boss> is typing...", which is now drawn at the boss's own seat badge
  // instead (see the bossActivity effect in Director, and `seat-speech.ts`).
  // So the line can be nothing at all, and when it is, and there is nothing
  // else to show, the coach says nothing rather than saying something in order
  // to avoid an empty bubble.
  const line =
    tokenNudge ??
    (beat.kind === "player"
      ? nudging
        ? beat.nudge
        : beat.coach
      : beat.kind === "boss"
        ? (beat.coach ?? null)
        : (beat.coach ?? "Every thread is closing. One moment."));

  const suggestions =
    beat.kind === "player" &&
    (beat.expect.kind === "edit" || beat.expect.kind === "propose")
      ? (beat.expect.suggestions ?? [])
      : [];

  if (
    !line &&
    !(beat.kind === "boss" && beat.bossSays) &&
    !error &&
    suggestions.length === 0
  ) {
    return null;
  }

  return (
    <Bubble targetSelector={targetSelector} width={20}>
      <div className="flex flex-col gap-2">
        {beat.kind === "boss" && beat.bossSays ? (
          <p className="font-secondary text-p-sm text-ink-soft italic">
            {level.bossEmoji} {level.bossName}: “{beat.bossSays}”
          </p>
        ) : null}
        {line ? <Paragraphs className="font-secondary text-ink" text={line} /> : null}

        {/*
          Nothing is said here about where to click, on purpose. The sample
          answers used to be chips in this bubble and clicking one placed the
          tile; Steve moved them onto the board on 2026-09-03, so they are
          drawn inside the open slots and the click that takes one is the same
          click that chooses the slot and opens the composer. What replaced
          them was a line reading "Click where I’m pointing, then hit Place",
          which Steve cut on 2026-09-07 as redundant: the coach is already
          pointing at the slot, the slot is already the only one drawn, and the
          sample text is already sitting in it. A sentence describing a gesture
          the board is demonstrating is one more thing to read, not help.
        */}

        {/*
          A tile's samples are drawn in the board's open slots, but an edit
          and a proposal are typed into forms the board owns, and there is no
          empty slot to draw them in. So the coach reads them out instead and
          the player copies whichever one they want.
        */}
        {beat.kind === "player" &&
        (beat.expect.kind === "edit" || beat.expect.kind === "propose") &&
        suggestions.length > 0 ? (
          <div className="flex flex-col gap-1">
            <span className="font-label text-ink-soft">
              {beat.expect.kind === "edit"
                ? "Something like:"
                : "Something like one of these:"}
            </span>
            {suggestions.map((sample) => (
              <p key={sample} className="font-secondary text-p-sm text-ink-soft">
                “{sample}”
              </p>
            ))}
          </div>
        ) : null}

        {error ? <p className="font-secondary text-p-sm text-red-700">{error}</p> : null}
      </div>
    </Bubble>
  );
}
