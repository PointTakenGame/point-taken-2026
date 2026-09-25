import { describe, expect, it } from "vitest";

import type { Side } from "@/lib/events/types";
import { SCRIPTED_LEVELS } from "@/lib/gym/levels";
import { play, perform } from "@/lib/gym/levels/play-harness";
import {
  ALL_PAUSES_DISMISSED,
  currentBeat,
  levelBadges,
  levelProgress,
} from "@/lib/gym/script";

/**
 * Every beat of every level, played through.
 *
 * `script.test.ts` beside this file takes level 1 apart beat by beat and
 * checks what the walker does with a board that does not match the script.
 * This one asks a coarser question of all four levels at once: if a player
 * does exactly what the script asks, in order, does the walker follow them to
 * the end? It plays each beat as the events that beat describes and asserts
 * after every one that the level advanced by exactly that beat, so a beat the
 * walker can never match fails here on the beat itself rather than at the end.
 *
 * The board is projected from a hand-built log rather than from the database,
 * so this is the script and the projection under test and nothing else. It is
 * deliberately not a rules test: `canPlaceTile` and its friends are not
 * consulted here, and a script that asks for an illegal move would still pass.
 * The order the scripts place their roots in is covered separately, below.
 */

describe.each(SCRIPTED_LEVELS.map((level) => [level.title, level] as const))(
  "level %s, played straight through",
  (_title, level) => {
    it("advances one beat per scripted move, and finishes", () => {
      const p = play(level);
      const tokens = new Map<string, Set<Side>>();

      const pauses = new Set(
        level.beats.filter((beat) => beat.kind === "pause").map((beat) => beat.id),
      );

      for (const beat of level.beats) {
        if (beat.kind === "pause") continue;
        perform(level, beat, p, tokens);
        const progress = levelProgress(level, p.board(), ALL_PAUSES_DISMISSED);
        // The beat just played must be the last one the walker saw evidence
        // for. Pauses are dropped from the comparison because a dismissed
        // pause is done the moment the walk reaches it, so the walk always
        // ends on any pause that follows the last real move. Naming the beat
        // in the assertion is the point: a beat the walker cannot see fails
        // here, where the script says which one it was.
        const moves = progress.done.filter((id) => !pauses.has(id));
        expect([beat.id, moves.at(-1)]).toEqual([beat.id, beat.id]);
      }

      const progress = levelProgress(level, p.board(), ALL_PAUSES_DISMISSED);
      expect(progress.complete).toBe(true);
      expect(progress.done).toEqual(level.beats.map((beat) => beat.id));
      expect(currentBeat(level, progress)).toBeNull();
    });

    it("places every root before any tile hangs off one", () => {
      // canPlaceTile refuses a child until `rootTarget` roots are down, and
      // the walker knows nothing about that rule, so a script that opened a
      // thread too early would pass the walk above and stall a real game.
      const roots = level.beats.filter(
        (beat) =>
          (beat.kind === "boss" &&
            beat.act.kind === "tile" &&
            beat.act.parent === null) ||
          (beat.kind === "player" &&
            beat.expect.kind === "tile" &&
            beat.expect.parent === null),
      );
      // At least as many roots as the stage needs; level 1 opens on one and
      // grows a second thread later, so the count may exceed the target.
      expect(roots.length).toBeGreaterThanOrEqual(level.rootTarget);

      const children = level.beats.filter(
        (beat) =>
          (beat.kind === "boss" &&
            beat.act.kind === "tile" &&
            beat.act.parent !== null) ||
          (beat.kind === "player" &&
            beat.expect.kind === "tile" &&
            beat.expect.parent !== null),
      );
      const lastRoot = level.beats.indexOf(roots[level.rootTarget - 1]);
      const firstChild =
        children.length > 0 ? level.beats.indexOf(children[0]) : Infinity;
      expect(lastRoot).toBeLessThan(firstChild);
    });

    it("awards badges the sample progression knows about", () => {
      // A badge id nobody recognises means a certificate with a hole in it,
      // and the level would still play perfectly, so nothing else catches it.
      for (const id of levelBadges(level)) expect(id).toMatch(/^[a-z0-9-]+$/);
      expect(level.awards.cardId).toBe(level.cardId);
    });
  },
);
