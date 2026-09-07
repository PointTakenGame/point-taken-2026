import type { ProposalKind } from "@/lib/events/types";

import { SCRIPTED_LEVELS } from "./levels";
import type { Level, ScriptToken } from "./script";

/**
 * What the ladder has taught the player by a given beat.
 *
 * Steve, 2026-09-06, from his level 1 playthrough: "don't let people take
 * actions that aren't relevant given the onboarding training. Like right now
 * I'm only halfway through the level with Bob and I'm allowed to propose a
 * side-eye on the left thread that shouldn't be available to me right now
 * because it doesn't make any sense. Only introduce these options as the game
 * moves on and they are explained."
 *
 * The board already hides board chrome per level (`Level.hiddenSurfaces`) and
 * narrows placement inside a cooked level (`Level.cooked`). Neither reaches the
 * moves offered on a tile card, which were gated per mode: everything in
 * `components/board/later-moves.ts` was offered in every Gym level from the
 * first beat, including the three that level 1 never mentions. The resolution
 * token picker was not gated at all, which is the 👀 Steve could reach for
 * halfway through level 1.
 *
 * A move is taught when the script has actually exercised it: the player is
 * asked to make it, or the boss makes it where the player can see. So the walk
 * reads the beats rather than a hand-kept list, which is the only version of
 * this that cannot drift as the scripts are rewritten.
 *
 * It runs over the whole ladder, not just the current level: every earlier
 * level is counted in full, because the player cleared it to get here, and the
 * current one only up to the beat they have reached. That is why 👀 is gone in
 * level 1 until Bob's own thread needs it, and back for good from level 2.
 */
export interface TaughtMoves {
  /** Later-move proposal kinds the ladder has reached. */
  proposals: readonly ProposalKind[];
  /** Resolution tokens the ladder has reached. */
  tokens: readonly ScriptToken[];
}

function collect(
  level: Level,
  throughBeat: number,
  proposals: Set<ProposalKind>,
  tokens: Set<ScriptToken>,
): void {
  for (let i = 0; i < level.beats.length && i <= throughBeat; i += 1) {
    const beat = level.beats[i];
    if (beat.kind === "player") {
      const expect = beat.expect;
      // Relocation is the one later move with its own expect kind rather than
      // a `propose` carrying a ProposalKind, because the script names the
      // destination tile. It is still the same proposal underneath.
      if (expect.kind === "relocate") proposals.add("tile_relocation");
      else if (expect.kind === "propose") proposals.add(expect.proposal);
      else if (expect.kind === "token") tokens.add(expect.emoji);
    } else if (beat.kind === "boss") {
      const act = beat.act;
      // The boss accepting a proposal can only follow the player making one,
      // so this adds nothing a `propose` beat has not already added. It is
      // here so a script that ever opens with the boss conceding does not
      // silently withhold the move the player just made.
      if (act.kind === "accept") proposals.add(act.proposal);
      else if (act.kind === "token") tokens.add(act.emoji);
    }
  }
}

/**
 * The moves available to a player standing at `throughBeat` of `level`.
 *
 * `throughBeat` is inclusive, and deliberately so: the beat that asks for a
 * move has to offer it. `LevelProgress.index` is exactly this number, and it
 * runs one past the last beat when the level is complete, which the loop reads
 * as "all of them".
 */
export function taughtMoves(level: Level, throughBeat: number): TaughtMoves {
  const proposals = new Set<ProposalKind>();
  const tokens = new Set<ScriptToken>();

  for (const earlier of SCRIPTED_LEVELS) {
    if (earlier.number >= level.number) continue;
    collect(earlier, earlier.beats.length, proposals, tokens);
  }
  collect(level, throughBeat, proposals, tokens);

  return { proposals: [...proposals], tokens: [...tokens] };
}

/**
 * Whether the player may reach for this yet. Both answer true when nothing is
 * being withheld, which is what `null` means, so a live board and a board with
 * no Director behave exactly as they did before any of this existed.
 */
export function taughtProposal(taught: TaughtMoves | null, kind: ProposalKind): boolean {
  return taught === null || taught.proposals.includes(kind);
}

export function taughtToken(taught: TaughtMoves | null, emoji: ScriptToken): boolean {
  return taught === null || taught.tokens.includes(emoji);
}
