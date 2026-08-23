import { notFound } from "next/navigation";
import { FinishedMap } from "@/components/board/finished-map";
import { projectBoard } from "@/lib/board/project";
import { readGameEvents } from "@/lib/events/append";
import { getGame, getGamePlayers } from "@/lib/db/games";
import { currentPlayerId } from "@/lib/supabase/session";

/**
 * One game's board, replayed from its log and rendered read-only.
 *
 * Only the people who played it can open it. A game holds what two people
 * actually said to each other, so there is no public link and no share token
 * until Steve decides there should be (BRAIN-T260822-14). A non-member gets
 * the same 404 as a game that does not exist, which is why this returns
 * notFound() rather than a "not allowed" page.
 */

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function GameMapPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  if (!UUID.test(gameId)) notFound();

  const playerId = await currentPlayerId();
  if (!playerId) notFound();

  const members = await getGamePlayers(gameId);
  if (!members.some((member) => member.player_id === playerId)) notFound();

  const [game, events] = await Promise.all([
    getGame(gameId),
    readGameEvents(gameId),
  ]);
  if (!game) notFound();

  return <FinishedMap board={projectBoard(events)} endedAt={game.ended_at} />;
}
