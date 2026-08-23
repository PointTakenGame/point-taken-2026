import { notFound } from "next/navigation";

import { FinishedMap } from "@/components/board/finished-map";
import { LiveBoard } from "@/components/board/live-board";
import { projectBoard } from "@/lib/board/project";
import { readGameEvents } from "@/lib/events/append";
import { readMembership } from "@/lib/games/membership";

/**
 * One game's board, replayed from its log.
 *
 * Playable while the game is running, a read-only map once it has ended. Only
 * the people who played it can open it: a game holds what two people actually
 * said to each other, so there is no public link and no share token until
 * Steve decides there should be (BRAIN-T260822-14). A non-member gets the same
 * 404 as a game that does not exist, so nobody can probe which ids are real.
 */

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function GamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  if (!UUID.test(gameId)) notFound();

  // Includes "no_side": a seated player who never picked one belongs on the
  // setup screen, which does not exist yet (BRAIN-T260823-11).
  const seat = await readMembership(gameId);
  if (!seat.ok) notFound();

  const board = projectBoard(await readGameEvents(gameId));

  if (board.status === "ended") {
    return <FinishedMap board={board} endedAt={seat.membership.game.ended_at} />;
  }

  return (
    <LiveBoard
      gameId={gameId}
      board={board}
      me={{ playerId: seat.membership.playerId, role: seat.membership.role }}
    />
  );
}
