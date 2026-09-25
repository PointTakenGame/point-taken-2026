import { describe, expect, it } from "vitest";

import type { Side } from "@/lib/events/types";
import { levelById } from "@/lib/gym/levels";
import { levelRemaining } from "@/lib/gym/remaining";
import { BOSS, PLAYER, perform, play } from "@/lib/gym/levels/play-harness";
import { ALL_PAUSES_DISMISSED, currentBeat, levelProgress } from "@/lib/gym/script";

/**
 * A playtester's report on level 2: "I tried to end the game by resolving all
 * the tiles ... I don't see any option to end the game and go to the next
 * level. There is no clear instruction on what is pending."
 *
 * The level can be cleared. What blocks a player is one specific, silent
 * state: Rosa puts 👀 down first on three threads, and a player who answers
 * with 👍 satisfies the walker (any legal token counts as their move) but not
 * the thread, which only closes when both sides hold the SAME token. The
 * script then runs out of things to ask, the last beat says "Every thread is
 * closing", and nothing anywhere says which thread is still open or why.
 */

const level = levelById("ground_rules")!;

/** Plays every beat up to, and not including, the named one. */
function playUntil(beatId: string) {
  const p = play(level);
  const tokens = new Map<string, Set<Side>>();
  for (const beat of level.beats) {
    if (beat.id === beatId) break;
    if (beat.kind === "pause") continue;
    perform(level, beat, p, tokens);
  }
  return { p, tokens };
}

describe("level 2: a player who answers Rosa's token with the other token", () => {
  it("runs the script out with a thread still open and the game not ended", () => {
    const { p, tokens } = playUntil("player-token-c");
    const rootC = levelProgress(level, p.board(), ALL_PAUSES_DISMISSED).keys.C;

    // Rosa's 👀 is down. The player picks 👍.
    p.push("resolution_emoji_placed", { thread_root_id: rootC, emoji: "👍" }, PLAYER);

    // Everything else the script asks, played exactly as written.
    const at = level.beats.findIndex((beat) => beat.id === "player-token-c");
    for (const beat of level.beats.slice(at + 1)) {
      if (beat.kind === "pause" || beat.kind === "win") continue;
      perform(level, beat, p, tokens);
    }

    const board = p.board();
    const progress = levelProgress(level, board, ALL_PAUSES_DISMISSED);

    // The walker is at the last beat, waiting for a game that will not end.
    expect(currentBeat(level, progress)?.kind).toBe("win");
    expect(board.status).toBe("active");

    const open = board.threads.filter((thread) => !thread.resolution);
    expect(open).toHaveLength(1);
    expect(open[0].rootId).toBe(rootC);
    expect(open[0].pending).toEqual({ plus: "👍", minus: "👀" });
    expect(BOSS).toBeTruthy();
  });

  it("closes as soon as the player takes theirs back and matches Rosa's", () => {
    const { p, tokens } = playUntil("player-token-c");
    const rootC = levelProgress(level, p.board(), ALL_PAUSES_DISMISSED).keys.C;
    p.push("resolution_emoji_placed", { thread_root_id: rootC, emoji: "👍" }, PLAYER);

    const at = level.beats.findIndex((beat) => beat.id === "player-token-c");
    for (const beat of level.beats.slice(at + 1)) {
      if (beat.kind === "pause" || beat.kind === "win") continue;
      perform(level, beat, p, tokens);
    }

    p.push("resolution_emoji_removed", { thread_root_id: rootC }, PLAYER);
    p.push("resolution_emoji_placed", { thread_root_id: rootC, emoji: "👀" }, PLAYER);
    p.push("thread_resolved", { thread_root_id: rootC, emoji: "👀", note: null });
    p.push("game_ended", { win_condition: "threads_resolved" });

    const progress = levelProgress(level, p.board(), ALL_PAUSES_DISMISSED);
    expect(progress.complete).toBe(true);
  });
});

describe("what is left on level 2", () => {
  it("starts with everything to do and the threads not yet closed", () => {
    const p = play(level);
    const board = p.board();
    const progress = levelProgress(level, board, ALL_PAUSES_DISMISSED);
    const remaining = levelRemaining(level, board, progress);

    expect(remaining.todo).toEqual([
      "Write 4 more reasons",
      "Throw Stick to the Thread's Root once",
      "Move 2 reasons into the right thread",
      "Close every thread: 0 of 4 closed",
    ]);
    expect(remaining.blockers).toEqual([]);
    expect(remaining.threads).toEqual({ closed: 0, total: 4 });
  });

  it("shrinks as the player acts and is empty once the level is done", () => {
    const p = play(level);
    const tokens = new Map<string, Set<Side>>();
    let last = Infinity;
    for (const beat of level.beats) {
      if (beat.kind === "pause") continue;
      perform(level, beat, p, tokens);
      const board = p.board();
      const progress = levelProgress(level, board, ALL_PAUSES_DISMISSED);
      const size = levelRemaining(level, board, progress).todo.length;
      expect(size).toBeLessThanOrEqual(last);
      last = size;
    }
    const board = p.board();
    const progress = levelProgress(level, board, ALL_PAUSES_DISMISSED);
    expect(levelRemaining(level, board, progress)).toEqual({
      todo: [],
      blockers: [],
      threads: { closed: 4, total: 4 },
    });
  });

  it("names the thread and both tokens when they do not match", () => {
    const { p } = playUntil("player-token-c");
    const rootC = levelProgress(level, p.board(), ALL_PAUSES_DISMISSED).keys.C;
    p.push("resolution_emoji_placed", { thread_root_id: rootC, emoji: "👍" }, PLAYER);

    const board = p.board();
    const progress = levelProgress(level, board, ALL_PAUSES_DISMISSED);
    const { blockers } = levelRemaining(level, board, progress);

    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toContain("No, because long summer evenings");
    expect(blockers[0]).toContain("you put 👍, Rambling Rosa put 👀");
    expect(blockers[0]).toContain("put 👀 down");
  });

  it("still says why, once the script is out of steps, when a thread is open", () => {
    const { p, tokens } = playUntil("player-token-c");
    const rootC = levelProgress(level, p.board(), ALL_PAUSES_DISMISSED).keys.C;
    p.push("resolution_emoji_placed", { thread_root_id: rootC, emoji: "👍" }, PLAYER);
    const at = level.beats.findIndex((beat) => beat.id === "player-token-c");
    for (const beat of level.beats.slice(at + 1)) {
      if (beat.kind === "pause" || beat.kind === "win") continue;
      perform(level, beat, p, tokens);
    }
    const board = p.board();
    const progress = levelProgress(level, board, ALL_PAUSES_DISMISSED);
    const remaining = levelRemaining(level, board, progress);

    expect(remaining.todo).toEqual(["Close every thread: 3 of 4 closed"]);
    expect(remaining.blockers).toHaveLength(1);
  });
});
