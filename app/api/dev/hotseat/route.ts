import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { projectBoard } from "@/lib/board/project";
import { canJoin } from "@/lib/board/setup";
import { getGamePlayers } from "@/lib/db/games";
import { ensureDisplayName } from "@/lib/db/players";
import { HOTSEAT_COOKIE, hotseatAllowed } from "@/lib/dev/hotseat";
import { appendGameEvent, readGameEvents } from "@/lib/events/append";

/**
 * Local sandbox bypass, see docs/filed/SANDBOX.md.
 *
 * The two things the hot-seat bar needs: somebody to be, and the ability to
 * become them. Outside local dev this route does not exist at all, which is a
 * 404 rather than a 403 so it cannot be probed for.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GONE = () => new NextResponse("Not found", { status: 404 });

/** A second anonymous player, minted the same way a real second visitor is. */
async function mintPlayer(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase public config is missing.");

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user) {
    throw new Error(`could not mint a practice player: ${error?.message}`);
  }
  return data.user.id;
}

export async function POST(request: Request) {
  if (!hotseatAllowed()) return GONE();

  let body: { action?: string; playerId?: string; gameId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send JSON." }, { status: 400 });
  }

  if (body.action === "release") {
    const response = NextResponse.json({ ok: true, playerId: null });
    response.cookies.delete(HOTSEAT_COOKIE);
    return response;
  }

  if (body.action === "become") {
    const playerId = body.playerId ?? "";
    if (!UUID.test(playerId)) {
      return NextResponse.json({ error: "Not a player id." }, { status: 400 });
    }
    const response = NextResponse.json({ ok: true, playerId });
    response.cookies.set(HOTSEAT_COOKIE, playerId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return response;
  }

  if (body.action === "opponent") {
    const gameId = body.gameId ?? "";
    if (!UUID.test(gameId)) {
      return NextResponse.json({ error: "Not a game id." }, { status: 400 });
    }

    const seated = await getGamePlayers(gameId);
    if (seated.length === 0) {
      return NextResponse.json({ error: "No such game." }, { status: 404 });
    }

    const playerId = await mintPlayer();
    const board = projectBoard(await readGameEvents(gameId));
    const verdict = canJoin(board, playerId);
    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.error }, { status: 409 });
    }

    // Same seating as app/join/actions.ts: actor_role `server`, because no
    // side exists to name yet.
    const player = await ensureDisplayName(playerId);
    await appendGameEvent(gameId, {
      type: "player_joined",
      actorRole: "server",
      source: "human",
      actorId: playerId,
      payload: { display_name: player.display_name ?? "Player" },
    });

    // Land in the new seat: adding an opponent you then have to click to
    // become is one step too many for the thing this exists to speed up.
    const response = NextResponse.json({
      ok: true,
      playerId,
      displayName: player.display_name,
    });
    response.cookies.set(HOTSEAT_COOKIE, playerId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return response;
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
