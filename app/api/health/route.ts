import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase/server";
import { EVENT_TYPE_NAMES } from "@/lib/events/types";

/**
 * Health check. It returns 200 only when the database answers, because the old
 * stack's long RED-health outage was an ALB probe pointed at a route that
 * 404'd. `?deep=1` also compares the live catalogue against lib/events/types.ts.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const deep = new URL(request.url).searchParams.get("deep") === "1";

  try {
    const supabase = serviceClient();
    const { count, error } = await supabase
      .from("game_event_types")
      .select("type", { count: "exact", head: true });
    if (error) throw new Error(error.message);

    const body: Record<string, unknown> = {
      ok: true,
      catalogue_types: count,
      catalogue_types_in_code: EVENT_TYPE_NAMES.length,
    };

    if (deep) {
      const { data, error: listError } = await supabase
        .from("game_event_types")
        .select("type, schema_version, payload_max_bytes, retired");
      if (listError) throw new Error(listError.message);

      const live = new Set((data ?? []).map((r) => r.type as string));
      body.missing_in_db = EVENT_TYPE_NAMES.filter((t) => !live.has(t));
      body.missing_in_code = [...live].filter(
        (t) => !EVENT_TYPE_NAMES.includes(t as never),
      );
      body.retired = (data ?? [])
        .filter((r) => r.retired)
        .map((r) => r.type as string);

      // Migrations applied, not just credentials valid: a project missing 0004
      // answers the catalogue query fine and then fails at the first game.
      const tables = ["players", "games", "game_players", "game_events"];
      const reachable: Record<string, number | string> = {};
      for (const table of tables) {
        const { count: n, error: tableError } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true });
        reachable[table] = tableError ? `ERROR: ${tableError.message}` : (n ?? 0);
      }
      body.tables = reachable;
    }

    return NextResponse.json(body);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
