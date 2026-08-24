import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The one property of the server actions that a unit test can actually hold.
 *
 * `vitest.config.mts` deliberately does not run tests under `app/`. The actions
 * there are I/O wrappers: they work out who is asking, project the board, ask
 * `lib/board/rules.ts` whether the move is legal, and append. The deciding is
 * in `lib/`, where it is tested directly, and testing the wrappers would mean
 * standing up a database to prove that a call is forwarded.
 *
 * What no `lib/` test can see is the wiring, and one piece of the wiring is a
 * security property rather than a correctness one: a server action is a public
 * HTTP endpoint. If one of them ever takes a player id from its caller, or does
 * work before establishing who is asking, anyone can write to anyone's game.
 * So that is checked here, structurally, against the source text.
 *
 * The files are discovered rather than listed. A hand-kept list is how
 * `setup-actions.ts` went unnoticed in a census of this same code.
 */

const ROOT = path.resolve(import.meta.dirname, "..", "..");

/** Every identity chokepoint an action is allowed to open with. */
const ENTRY_POINTS = [
  // lib/games/membership.ts, by way of the local `session` / `lobby` helpers.
  "session",
  "lobby",
  "readSeat",
  // lib/supabase/session.ts, for the actions that are not scoped to a game.
  "currentPlayerId",
];

/**
 * Parameter names that would mean the caller gets to say who they are. The
 * check is on names, not types: `gameId: string` is fine, `playerId: string`
 * is the bug.
 */
const CALLER_SUPPLIED_IDENTITY = /^(player|actor|user|seat|me|whoami)/i;

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
    const file = path.join(entry.parentPath, entry.name);
    if (readFileSync(file, "utf8").startsWith('"use server"')) found.push(file);
  }
  return found.sort();
}

/** Text between an opening bracket and the one that closes it. */
function balanced(source: string, open: number): string {
  const pairs: Record<string, string> = { "(": ")", "{": "}", "[": "]" };
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const char = source[i];
    if (char in pairs) depth += 1;
    else if (Object.values(pairs).includes(char)) {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error("unbalanced source");
}

interface Action {
  file: string;
  name: string;
  params: string;
  body: string;
}

function actionsIn(file: string): Action[] {
  const source = readFileSync(file, "utf8");
  const found: Action[] = [];
  const declaration = /^export async function ([A-Za-z_$][\w$]*)\s*\(/gm;

  for (const match of source.matchAll(declaration)) {
    const open = match.index + match[0].length - 1;
    const params = balanced(source, open);
    const brace = source.indexOf("{", open + params.length + 2);
    found.push({
      file: path.relative(ROOT, file),
      name: match[1],
      params,
      body: balanced(source, brace),
    });
  }
  return found;
}

/** Top-level commas only: a default value or an inline type holds commas too. */
function parameterNames(params: string): string[] {
  const names: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of `${params},`) {
    if ("({[".includes(char)) depth += 1;
    if (")}]".includes(char)) depth -= 1;
    if (char === "," && depth === 0) {
      const name = current.trim().split(/[:=?]/)[0].trim();
      if (name) names.push(name);
      current = "";
      continue;
    }
    current += char;
  }
  return names;
}

const ACTIONS = sourceFiles(path.join(ROOT, "app")).flatMap(actionsIn);

describe("server actions", () => {
  it("finds the action files at all", () => {
    // A regression here means the discovery broke, not that the rules hold.
    expect(new Set(ACTIONS.map((action) => action.file)).size).toBeGreaterThan(3);
    expect(ACTIONS.length).toBeGreaterThan(25);
  });

  it.each(ACTIONS.map((action) => [`${action.file} ${action.name}`, action] as const))(
    "%s takes no caller-supplied identity",
    (_label, action) => {
      const offending = parameterNames(action.params).filter((name) =>
        CALLER_SUPPLIED_IDENTITY.test(name),
      );
      expect(offending).toEqual([]);
    },
  );

  it.each(ACTIONS.map((action) => [`${action.file} ${action.name}`, action] as const))(
    "%s establishes who is asking before anything else",
    (_label, action) => {
      const first = action.body.match(/await\s+([A-Za-z_$][\w$]*)\s*\(/);
      expect(first?.[1], "no awaited call at all").toBeDefined();
      expect(ENTRY_POINTS).toContain(first?.[1]);
    },
  );
});
