import { liveThreads, type BoardState } from "@/lib/board/project";
import { coachCard } from "@/lib/coach/cards";
import { currentBeat, type Level, type LevelProgress } from "@/lib/gym/script";

/**
 * What is left before a level clears, worked out from the board.
 *
 * A player cannot read the script, and the script's own step count ("12 of
 * 36") counts the boss's moves and every pause, so it says nothing about what
 * they are supposed to do next. This reads the same walk the director already
 * does (`levelProgress`) and turns the player's unfinished beats into plain
 * things to do. It changes no win condition and reads no level content that
 * is not already public on the board: a beat's kind and its card id.
 *
 * `blockers` is separate and is not the script's business. A thread closes
 * only when both sides hold the same token, and the walker deliberately
 * counts any legal token as the player's move, so a player who answers the
 * boss's 👀 with 👍 is past the beat and the thread is still open. That state
 * used to be invisible; it is what a playtester reported on level 2 as "I
 * don't see any option to end the game".
 */

export interface Remaining {
  /** Things still to do, in the order the script asks for them. */
  todo: string[];
  /** Why the game cannot end right now, when something on the board is stuck. */
  blockers: string[];
  /** Threads closed and threads the level needs closed. */
  threads: { closed: number; total: number };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function excerpt(text: string | undefined): string {
  const clean = (text ?? "").trim();
  return clean.length > 48 ? `${clean.slice(0, 45).trimEnd()}...` : clean;
}

/** How many threads the script opens: one per root tile, from either side. */
function threadsInScript(level: Level): number {
  return level.beats.filter(
    (beat) =>
      (beat.kind === "boss" && beat.act.kind === "tile" && beat.act.parent === null) ||
      (beat.kind === "player" &&
        beat.expect.kind === "tile" &&
        beat.expect.parent === null),
  ).length;
}

export function levelRemaining(
  level: Level,
  board: BoardState,
  progress: LevelProgress,
): Remaining {
  const total = Math.max(threadsInScript(level), level.rootTarget);
  const live = liveThreads(board);
  const closed = live.filter((thread) => thread.resolution).length;

  // Group the player's unfinished beats by what they ask for, keeping the
  // order in which each kind first turns up.
  const groups = new Map<string, { count: number; label: (n: number) => string }>();
  const add = (key: string, label: (n: number) => string) => {
    const group = groups.get(key);
    if (group) group.count += 1;
    else groups.set(key, { count: 1, label });
  };

  for (const beat of level.beats.slice(progress.index)) {
    if (beat.kind !== "player") continue;
    const want = beat.expect;
    switch (want.kind) {
      case "tile":
        add("tile", (n) => `Write ${plural(n, "more reason", "more reasons")}`);
        break;
      case "throw": {
        const name = coachCard(want.cardId)?.name ?? "a rule card";
        add(
          `throw:${want.cardId}`,
          (n) => `Throw ${name} ${n === 1 ? "once" : `${n} times`}`,
        );
        break;
      }
      case "relocate":
        add(
          "relocate",
          (n) => `Move ${plural(n, "reason", "reasons")} into the right thread`,
        );
        break;
      case "edit":
        add("edit", () => "Rewrite your own reason");
        break;
      case "propose":
        add(`propose:${want.proposal}`, () =>
          want.proposal === "definition"
            ? "Pin down a word"
            : want.proposal === "reading_handback"
              ? "Hand back your reading of a reason"
              : "Make a proposal",
        );
        break;
      case "token":
        break;
    }
  }

  const todo = [...groups.values()].map((group) => group.label(group.count));
  if (closed < total) {
    todo.push(`Close every thread: ${closed} of ${total} closed`);
  }

  const mine = level.playerSide;
  const theirs = level.bossSide;
  const atEnd = currentBeat(level, progress)?.kind === "win";
  const blockers: string[] = [];
  for (const thread of live) {
    if (thread.resolution) continue;
    const yours = thread.pending[mine];
    const hers = thread.pending[theirs];
    const name = `“${excerpt(thread.root?.text)}”`;
    if (yours && hers && yours !== hers) {
      blockers.push(
        `${name}: you put ${yours}, ${level.bossName} put ${hers}. A thread only closes when you both put the same one. Take yours back, then put ${hers} down.`,
      );
    } else if (atEnd && hers && !yours) {
      blockers.push(
        `${name}: ${level.bossName} put ${hers} down. Put ${hers} down too to close it.`,
      );
    } else if (atEnd && yours && !hers) {
      blockers.push(
        `${name}: your ${yours} is down. ${level.bossName} answers when the talk in this thread is done.`,
      );
    } else if (atEnd) {
      blockers.push(`${name}: still open. Put a token on it to close it.`);
    }
  }

  return { todo, blockers, threads: { closed, total } };
}
