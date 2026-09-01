import Link from "next/link";
import { LeaveLinks } from "@/components/board/leave-links";
import { notFound } from "next/navigation";

import { Ending } from "@/components/board/ending";
import { FinishedMap } from "@/components/board/finished-map";
import { HotseatBar } from "@/components/dev/hotseat-bar";
import { GameSetup } from "@/components/board/game-setup";
import { LiveBoard } from "@/components/board/live-board";
import { WinOverlay } from "@/components/win/win-overlay";
import { projectBoard } from "@/lib/board/project";
import { getPlayer } from "@/lib/db/players";
import { hotseatAllowed } from "@/lib/dev/hotseat";
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
  // A preference, not a move, so it lives on the player row rather than the log.
  const player = await getPlayer(seat.seat.playerId);

  // Local sandbox bypass, see docs/filed/SANDBOX.md. Inert outside local dev.
  const hotseat = hotseatAllowed() ? (
    <HotseatBar
      gameId={gameId}
      me={seat.seat.playerId}
      players={board.players.map((player) => ({
        id: player.id,
        displayName: player.displayName,
        role: player.role,
      }))}
    />
  ) : null;

  if (board.status === "ended") {
    return (
      <>
        <Ending board={board} />
        <FinishedMap board={board} endedAt={seat.seat.game.ended_at} />
        {/*
          The celebration goes here rather than on the live board: a won game
          never renders LiveBoard, it lands on this branch. Ending states the
          win in prose below it; the overlay is the moment of it, dismissable
          to a pill so the finished map underneath stays readable.
        */}
        <WinOverlay board={board} />
        <nav className="mx-auto flex w-full max-w-3xl gap-4 px-8 pb-8 print:hidden">
          <Link href="/account" className="underline">
            Your games
          </Link>
          <Link href="/leaderboard" className="underline">
            Leaderboard
          </Link>
          <Link href="/" className="underline">
            Start another room
          </Link>
        </nav>
        {hotseat}
      </>
    );
  }

  if (board.status === "lobby") {
    return (
      <>
        <GameSetup
          gameId={gameId}
          board={board}
          joinCode={seat.seat.game.join_code}
          me={{ playerId: seat.seat.playerId, role: seat.seat.role }}
        />
        <LeaveLinks />
        {hotseat}
      </>
    );
  }

  // Active and still without a side should not happen: game_started requires
  // both roles. Send them back to setup rather than render a sideless board.
  if (seat.seat.role === null) {
    return (
      <>
        <GameSetup
          gameId={gameId}
          board={board}
          joinCode={seat.seat.game.join_code}
          me={{ playerId: seat.seat.playerId, role: null }}
        />
        <LeaveLinks />
        {hotseat}
      </>
    );
  }

  return (
    <>
      <LiveBoard
        gameId={gameId}
        board={board}
        me={{ playerId: seat.seat.playerId, role: seat.seat.role }}
        coachEnabled={player?.coach_enabled ?? false}
        joinCode={seat.seat.game.join_code}
      />
      <LeaveLinks />
      {hotseat}
    </>
  );
}
