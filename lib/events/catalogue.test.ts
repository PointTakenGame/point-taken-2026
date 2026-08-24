import { readFileSync, readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { EVENT_TYPES, PAYLOAD_HARD_CAP_BYTES, type GameEventType } from "./types";

/**
 * The event vocabulary is written down twice, and the two copies have to agree.
 *
 * `EVENT_TYPES` in types.ts is what the application writes: it decides the
 * schema_version stamped on every row and the byte ceiling checked before the
 * insert. `game_event_types` in the migrations is what the database will accept:
 * a foreign key on (type, schema_version) and a trigger that reads
 * payload_max_bytes off the catalogue row. Drift between them does not surface
 * as a failing type check. It surfaces as a write that passes everything local
 * and is refused by Postgres, on whichever event nobody exercised before
 * deploying.
 *
 * So this reads the migrations as text and compares. Deliberately a plain unit
 * test rather than a database query: it has to run in the gate with no
 * credentials, on a machine that has never reached Supabase, and the migrations
 * on disk are what will be applied to it anyway. BRAIN-T260823-08 check 1.
 *
 * Not covered: retirement. `retired` exists on the catalogue and no migration
 * sets it yet, so there is no statement shape to parse. When the first type is
 * retired, this file is where the check that TypeScript stopped writing it goes.
 */

const MIGRATIONS = new URL("../../supabase/migrations/", import.meta.url);

function migrationSource(): string {
  return readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => readFileSync(new URL(name, MIGRATIONS), "utf8"))
    .join("\n");
}

/**
 * Comments go first, then every string literal is replaced by its own index.
 *
 * Both steps are here because the descriptions in the catalogue are prose, and
 * prose ends sentences with semicolons ("Reselectable until game_started; the
 * last one wins"), doubles its quotes ("the validator''s count"), and the file's
 * own commentary uses an apostrophe mid-word ("a typo'd type string"). Any one
 * of those ends a naive match in the wrong place: the first draft of this parser
 * read two of the twenty-eight rows and the tests that depended on it passed.
 *
 * Stripping comments before masking is what keeps the unpaired apostrophe in a
 * comment from swallowing the SQL after it. The reverse assumption, that no
 * string literal contains a double hyphen, holds in these migrations.
 */
function mask(sql: string): { sql: string; literals: string[] } {
  const literals: string[] = [];
  const masked = sql
    .replaceAll(/--[^\n]*/g, "")
    .replaceAll(/'(?:[^']|'')*'/g, (match) => {
      literals.push(match.slice(1, -1).replaceAll("''", "'"));
      return `'${literals.length - 1}'`;
    });
  return { sql: masked, literals };
}

interface CatalogueRow {
  type: string;
  schemaVersion: number;
  maxBytes: number;
}

/**
 * Every (type, version, description, bytes) tuple inserted into the catalogue,
 * from any migration, so a type added in a later one is picked up without
 * anybody remembering to edit this file.
 */
function catalogueRows(masked: string, literals: string[]): CatalogueRow[] {
  const rows: CatalogueRow[] = [];
  const inserts = masked.matchAll(
    /insert\s+into\s+public\.game_event_types\s*\([^)]*\)\s*values([\s\S]*?);/gi,
  );
  for (const insert of inserts) {
    for (const tuple of insert[1].matchAll(
      /\(\s*'(\d+)'\s*,\s*(\d+)\s*,\s*'\d+'\s*,\s*(\d+)\s*\)/g,
    )) {
      rows.push({
        type: literals[Number(tuple[1])],
        schemaVersion: Number(tuple[2]),
        maxBytes: Number(tuple[3]),
      });
    }
  }
  return rows;
}

const MASKED = mask(migrationSource());
const ROWS = catalogueRows(MASKED.sql, MASKED.literals);
const BY_KEY = new Map(ROWS.map((row) => [`${row.type}@${row.schemaVersion}`, row]));
const SQL_TYPE_NAMES = new Set(ROWS.map((row) => row.type));
const TS_TYPE_NAMES = Object.keys(EVENT_TYPES) as GameEventType[];

describe("the event catalogue in SQL and in TypeScript", () => {
  /** A parser that quietly matched nothing would make every assertion below it
      vacuous, which is not hypothetical: see the comment on `mask`. */
  it("parses the catalogue out of the migrations at all", () => {
    expect(ROWS.length).toBeGreaterThanOrEqual(28);
    expect(BY_KEY.size, "the same (type, version) inserted twice").toBe(ROWS.length);
  });

  it("has a catalogue row for every type the application writes", () => {
    const missing = TS_TYPE_NAMES.filter(
      (type) => !BY_KEY.has(`${type}@${EVENT_TYPES[type].schemaVersion}`),
    );
    expect(missing, "no catalogue row, so the foreign key refuses the insert").toEqual(
      [],
    );
  });

  it("names every catalogued type in EventPayloads", () => {
    const unknown = [...SQL_TYPE_NAMES].filter((type) => !(type in EVENT_TYPES));
    expect(unknown, "in the database vocabulary but not in the union").toEqual([]);
  });

  it("agrees on every payload ceiling", () => {
    const disagreements = TS_TYPE_NAMES.flatMap((type) => {
      const spec = EVENT_TYPES[type];
      const row = BY_KEY.get(`${type}@${spec.schemaVersion}`);
      if (!row || row.maxBytes === spec.maxBytes) return [];
      return [`${type}: TypeScript says ${spec.maxBytes}, SQL says ${row.maxBytes}`];
    });
    expect(disagreements).toEqual([]);
  });

  it("keeps every per-type ceiling under the table-wide cap", () => {
    const over = ROWS.filter((row) => row.maxBytes > PAYLOAD_HARD_CAP_BYTES);
    expect(over.map((row) => row.type)).toEqual([]);
  });

  /** The hard cap is a check constraint in 0002 and a constant here, and the
      constant is what the append path measures against before the round trip. */
  it("agrees on the table-wide cap", () => {
    const constraint = MASKED.sql.match(/octet_length\(payload::text\)\s*<=\s*(\d+)/);
    expect(constraint, "no payload size constraint in any migration").not.toBeNull();
    expect(Number(constraint?.[1])).toBe(PAYLOAD_HARD_CAP_BYTES);
  });
});
