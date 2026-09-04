import Link from "next/link";
import { LeaveLinks } from "@/components/board/leave-links";
import { notFound } from "next/navigation";

import { Ending } from "@/components/board/ending";
import { FinishedMap } from "@/components/board/finished-map";
import { HotseatBar } from "@/components/dev/hotseat-bar";
import { GameSetup } from "@/components/board/game-setup";
import { BuildStamp } from "@/components/build-stamp";
import { LiveBoard } from "@/components/board/live-board";
import { WinOverlay } from "@/components/win/win-overlay";
import { Certificate } from "@/components/gym/certificate";
import { GymDirector } from "@/components/gym/director";
import { GymLobby } from "@/components/gym/gym-lobby";
import { levelById } from "@/lib/gym/levels";
import { projectBoard } from "@/lib/board/project";
import { readPlayerAwards } from "@/lib/db/awards";
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

  // A scripted Gym level is the same board with a script beside it: the
  // lobby is the signing ritual alone, the ending is the certificate, and
  // the live board gets the director on top. Same URL, same history row.
  const level = board.mode === "gym" ? levelById(board.levelId) : undefined;

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

  if (board.status === "ended" && level) {
    return (
      <>
        <Certificate level={level} board={board} />
        <FinishedMap board={board} endedAt={seat.seat.game.ended_at} />
        {hotseat}
      </>
    );
  }

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
        {/* The three ways on from a finished game, in the board's own
            furniture rather than three browser-default links: the one a
            player most likely wants next is the gold pill, the other two
            are the offwhite pill the board uses for a way out. */}
        <nav className="mx-auto flex w-full max-w-3xl flex-wrap gap-3 px-8 pb-8 print:hidden">
          <Link
            href="/"
            className="bg-gold text-neutral-white font-primary text-p-sm rounded-full px-4 py-1.5 tracking-wide shadow-md"
          >
            Start another room
          </Link>
          <Link
            href="/account"
            className="border-gray/40 bg-offwhite text-neutral-black font-primary text-p-sm hover:bg-sand/40 rounded-full border px-4 py-1.5 tracking-wide"
          >
            Your games
          </Link>
          <Link
            href="/leaderboard"
            className="border-gray/40 bg-offwhite text-neutral-black font-primary text-p-sm hover:bg-sand/40 rounded-full border px-4 py-1.5 tracking-wide"
          >
            Leaderboard
          </Link>
        </nav>
        {hotseat}
      </>
    );
  }

  if (board.status === "lobby" && level) {
    // Only fetched on this branch: the awards read is a second query, and the
    // one thing it decides is whether the level-intro's rule card panel
    // (components/gym/level-intro.tsx) shows the real card or a question
    // mark, which only matters before a level has started.
    const awards = await readPlayerAwards(seat.seat.playerId);
    const cardEarned = awards.cardIds.includes(level.cardId);
    return (
      <>
        <GymLobby
          gameId={gameId}
          levelId={level.id}
          board={board}
          me={{ playerId: seat.seat.playerId }}
          cardEarned={cardEarned}
        />
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
      {/*
        No LeaveLinks and no page chrome around a live board: LiveBoard is a
        full-screen surface now, ported from the retired client's board page,
        and it carries its own way out in the bottom left. Anything rendered
        beside it here would sit underneath it.
      */}
      <LiveBoard
        gameId={gameId}
        board={board}
        me={{ playerId: seat.seat.playerId, role: seat.seat.role }}
        coachEnabled={player?.coach_enabled ?? false}
        joinCode={seat.seat.game.join_code}
        // The root layout's footer is suppressed on this route (a fixed
        // full-screen board collapses it into the top-left corner), so the
        // build id is handed to the board and printed in its own bottom-left
        // utility stack. Rendered here rather than inside the client
        // component, because it reads server-only environment.
        buildStamp={<BuildStamp />}
      />
      {level ? <GymDirector gameId={gameId} levelId={level.id} board={board} /> : null}
      {hotseat}
    </>
  );
}
