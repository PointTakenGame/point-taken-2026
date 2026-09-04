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

/** Level by id, not by object: see GymDirector for why. */
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
