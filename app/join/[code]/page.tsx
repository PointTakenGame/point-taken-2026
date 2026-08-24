import Link from "next/link";
import { redirect } from "next/navigation";

import { JoinRoom } from "@/components/rooms/room-entry";
import { projectBoard } from "@/lib/board/project";
import { canJoin } from "@/lib/board/setup";
import { findOpenGameByJoinCode, getGamePlayers } from "@/lib/db/games";
import { readGameEvents } from "@/lib/events/append";
import { normalizeJoinCode } from "@/lib/games/joinCode";
import { currentPlayerId } from "@/lib/supabase/session";

/**
 * The page an invite code opens: what room this is, who is in it, one button in.
 *
 * The code is the credential, so this page is public where /game/[gameId] is
 * not. It shows only what somebody holding the code needs to decide whether to
 * walk in: the topic if there is one, and who is already there by first name.
 * Registry row BRAIN-T260823-17.
 */

export const dynamic = "force-dynamic";

const NOT_SEATED = "00000000-0000-4000-8000-000000000000";

function Message({ code, text }: { code: string; text: string }) {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">
        Room <span className="font-mono">{code}</span>
      </h1>
      <p className="opacity-70">{text}</p>
      <Link href="/" className="underline">
        Start your own room
      </Link>
    </main>
  );
}

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const raw = (await params).code;
  const code = normalizeJoinCode(decodeURIComponent(raw));
  if (!code) return <Message code={raw.toUpperCase()} text="That is not a room code." />;

  const game = await findOpenGameByJoinCode(code);
  if (!game) {
    return (
      <Message
        code={code}
        text="No open room has that code. It may have ended, or the code may be a letter off."
      />
    );
  }

  // Already seated: no reason to ask them to join their own room again.
  const playerId = await currentPlayerId();
  const seated = await getGamePlayers(game.id);
  if (
    playerId &&
    seated.some((row) => row.player_id === playerId && row.left_at === null)
  ) {
    redirect(`/game/${game.id}`);
  }

  const board = projectBoard(await readGameEvents(game.id));
  const here = board.players.filter((p) => p.left !== "quit");
  // No account yet means certainly not seated; the button signs them in.
  const verdict = canJoin(board, playerId ?? NOT_SEATED);

  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">
          Room <span className="font-mono">{code}</span>
        </h1>
        <p className="opacity-70">
          {board.currentTopicText
            ? `The topic: ${board.currentTopicText}`
            : "No topic yet. You settle it together once you are both in."}
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          Already here
        </h2>
        {here.length === 0 ? (
          <p className="opacity-70">Nobody yet.</p>
        ) : (
          <ul className="list-inside list-disc">
            {here.map((player) => (
              <li key={player.id}>{player.displayName ?? "someone"}</li>
            ))}
          </ul>
        )}
      </section>

      {verdict.ok ? (
        <JoinRoom code={code} label="Join this room" />
      ) : (
        <p className="text-sm opacity-70">{verdict.error}</p>
      )}
    </main>
  );
}
