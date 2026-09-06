"use client";

import { LevelIntro } from "@/components/gym/level-intro";
import type { BoardState } from "@/lib/board/project";
import { levelById } from "@/lib/gym/levels";

/**
 * The room before a Gym level starts. Sides and topic are the script's, and
 * the boss has already signed, so the only thing left for the player is the
 * signing ritual. The actual screen is LevelIntro's two cards
 * (components/gym/level-intro.tsx, Figma `1058:211649` and `1077:220185`);
 * this file stays as the entry point so the "level by id, not by object"
 * lookup (see GymDirector for why) happens in one place regardless of which
 * component ends up rendering the room.
 */

/**
 * Level by id, not by object: see GymDirector for why. The "use client" at
 * the top of this file is load-bearing for the same reason. This lookup has
 * to run in the browser, because a Level carries beats whose text is a
 * function (level 1's are), and a function cannot cross from a server
 * component into a client one. Dropping the directive turned this file into
 * a server component that handed the whole Level to LevelIntro, and level 1
 * failed to draw with "Functions cannot be passed directly to Client
 * Components" (2026-09-04). Level 2 masked it, because none of its beats
 * happen to use a function.
 */
export function GymLobby({
  gameId,
  levelId,
  board,
  me,
  cardEarned,
}: {
  gameId: string;
  levelId: string;
  board: BoardState;
  me: { playerId: string };
  cardEarned: boolean;
}) {
  const level = levelById(levelId);
  if (!level) return null;
  return (
    <LevelIntro
      gameId={gameId}
      level={level}
      board={board}
      me={me}
      cardEarned={cardEarned}
    />
  );
}
