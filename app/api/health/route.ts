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
    const { data, error } = await supabase
      .from("game_event_types")
      .select("type, schema_version, retired");
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const distinctTypes = new Set(rows.map((r) => r.type as string));

    // The catalogue keeps one row per (type, schema_version) ever shipped
    // (0002's own comment: old versions are never removed), so a versioned
    // type such as game_started (v1 and v2, migration 0012) makes
    // catalogue_rows bigger than catalogue_types without either side being
    // wrong. catalogue_types_in_code is comparable to catalogue_types, never
    // to catalogue_rows.
    const body: Record<string, unknown> = {
      ok: true,
      catalogue_rows: rows.length,
      catalogue_types: distinctTypes.size,
      catalogue_types_in_code: EVENT_TYPE_NAMES.length,
    };

    if (rows.length !== distinctTypes.size) {
      const versionsByType = new Map<string, number[]>();
      for (const r of rows) {
        const list = versionsByType.get(r.type as string) ?? [];
        list.push(r.schema_version as number);
        versionsByType.set(r.type as string, list);
      }
      body.multi_version_types = Object.fromEntries(
        [...versionsByType].filter(([, versions]) => versions.length > 1),
      );
    }

    if (deep) {
      body.missing_in_db = EVENT_TYPE_NAMES.filter((t) => !distinctTypes.has(t));
      body.missing_in_code = [...distinctTypes].filter(
        (t) => !EVENT_TYPE_NAMES.includes(t as never),
      );
      body.retired = rows.filter((r) => r.retired).map((r) => r.type as string);

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
