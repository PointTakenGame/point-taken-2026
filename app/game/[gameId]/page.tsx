import { notFound } from "next/navigation";

import { FinishedMap } from "@/components/board/finished-map";
import { GameSetup } from "@/components/board/game-setup";
import { LiveBoard } from "@/components/board/live-board";
import { projectBoard } from "@/lib/board/project";
import { readGameEvents } from "@/lib/events/append";
import { readSeat } from "@/lib/games/membership";

/**
 * One game's board, replayed from its log.
 *
 * The setup room until it starts, playable while it runs, a read-only map once
 * it has ended. Only the people who played it can open it: a game holds what
 * two people actually said to each other, so there is no public link and no
 * share token until Steve decides there should be (BRAIN-T260822-14). A
 * non-member gets the same 404 as a game that does not exist, so nobody can
 * probe which ids are real.
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

  // readSeat, not readMembership: a seated player with no side yet belongs in
  // the setup room, which is where they pick one.
  const seat = await readSeat(gameId);
  if (!seat.ok) notFound();

  const board = projectBoard(await readGameEvents(gameId));

  if (board.status === "ended") {
    return <FinishedMap board={board} endedAt={seat.seat.game.ended_at} />;
  }

  if (board.status === "lobby") {
    return (
      <GameSetup
        gameId={gameId}
        board={board}
        joinCode={seat.seat.game.join_code}
        me={{ playerId: seat.seat.playerId, role: seat.seat.role }}
      />
    );
  }

  // Active and still without a side should not happen: game_started requires
  // both roles. Send them back to setup rather than render a sideless board.
  if (seat.seat.role === null) {
    return (
      <GameSetup
        gameId={gameId}
        board={board}
        joinCode={seat.seat.game.join_code}
        me={{ playerId: seat.seat.playerId, role: null }}
      />
    );
  }

  return (
    <LiveBoard
      gameId={gameId}
      board={board}
      me={{ playerId: seat.seat.playerId, role: seat.seat.role }}
    />
  );
}
