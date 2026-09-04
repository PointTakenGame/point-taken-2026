import { describe, expect, it } from "vitest";

import { READING_MAX_CHARS, TILE_MAX_CHARS } from "@/lib/board/rules";
import { SCRIPTED_LEVELS } from "@/lib/gym/levels";
import { renderText, type Level, type ScriptContext } from "@/lib/gym/script";

/**
 * Everything the script writes for somebody has to fit in the box it goes in.
 *
 * Found by playing level 1 on 2026-09-04: the coach offered a 108-character
 * sample answer for a tile, the composer opened pre-filled with it, and Place
 * was greyed out with "A reason is at most 100 characters." The player is
 * invited to send the coach's own words and then not allowed to. Steve's
 * ruling 3 of the 2026-09-03 brief is that clicking a slot opens the composer
 * pre-filled and the player edits **or sends**, so a suggestion that cannot be
 * sent as written is a broken beat rather than a tight one.
 *
 * `walkthrough.test.ts` cannot catch this and says so at the top of the file:
 * it plays the script as events and never consults `canPlaceTile`. This is the
 * missing half, and it is a length check rather than a rules check because
 * length is the only rule a piece of written content can break on its own.
 *
 * What it does not cover: a boss line whose text is a function gets rendered
 * against two stub contexts, one where the boss has said nothing and one where
 * the boss has already said the first rendering, which is the only shape any
 * script uses today. A future conditional with a third branch would need this
 * to grow a case.
 */

const EMPTY: ScriptContext = { textOf: () => null, bossTexts: new Set<string>() };

/** Both sides of the one conditional pattern the scripts use. */
function renderings(text: Parameters<typeof renderText>[0]): string[] {
  const first = renderText(text, EMPTY);
  const second = renderText(text, {
    textOf: () => null,
    bossTexts: new Set<string>([first]),
  });
  return first === second ? [first] : [first, second];
}

interface Written {
  where: string;
  text: string;
  limit: number;
}

function written(level: Level): Written[] {
  const out: Written[] = [];
  for (const beat of level.beats) {
    if (beat.kind === "boss") {
      const act = beat.act;
      if (act.kind === "tile" || act.kind === "revise") {
        for (const text of renderings(act.text)) {
          out.push({
            where: `${level.id} ${beat.id} boss tile`,
            text,
            limit: TILE_MAX_CHARS,
          });
        }
      }
      continue;
    }
    if (beat.kind !== "player") continue;
    const spec = beat.expect;
    if (spec.kind === "tile" || spec.kind === "edit") {
      for (const text of spec.suggestions ?? []) {
        out.push({
          where: `${level.id} ${beat.id} suggestion`,
          text,
          limit: TILE_MAX_CHARS,
        });
      }
    }
    if (spec.kind === "propose") {
      for (const text of spec.suggestions ?? []) {
        // A reading is said back in the player's own words and gets more room
        // than the tile it answers. See READING_MAX_CHARS in lib/board/rules.
        out.push({
          where: `${level.id} ${beat.id} proposal`,
          text,
          limit: READING_MAX_CHARS,
        });
      }
    }
  }
  return out;
}

describe("every scripted line fits the box it goes in", () => {
  for (const level of SCRIPTED_LEVELS) {
    it(`${level.id} writes nothing too long to place`, () => {
      const over = written(level)
        .filter((entry) => entry.text.length > entry.limit)
        .map((entry) => `${entry.where}: ${entry.text.length} > ${entry.limit}`);
      expect(over).toEqual([]);
    });
  }

  it("checks something, so an empty walk cannot pass silently", () => {
    const all = SCRIPTED_LEVELS.flatMap(written);
    expect(all.length).toBeGreaterThan(20);
  });
});
