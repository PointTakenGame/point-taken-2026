import { describe, expect, it } from "vitest";

import { COACH_CASES, type CoachCase } from "./fixtures";
import { COACH_MODEL, evaluateTile } from "./evaluate";
import { TILE_MAX_CHARS } from "@/lib/board/rules";

/**
 * The coach's model bake-off. Skipped by default: it calls the real API, costs
 * money, and takes a minute, so it is not part of the five-command gate.
 *
 *   set -a && . ../../../point-taken-biz/api-keys/claude-api-key.env && set +a
 *   COACH_EVAL=1 npx vitest run lib/coach/coach-eval.test.ts
 *
 * BIZ-T260823-78 set the budget at "the cheapest that passes the fixtures,
 * latency forgiving because feedback is always post-submission". This is what
 * decides that. It runs every case against each candidate and prints a table,
 * then asserts that the model actually pinned in evaluate.ts clears the bar.
 *
 * The bar is deliberately lopsided. Naming the wrong card on a reason that does
 * break something is a bad hint; speaking up on a clean reason teaches the
 * player to stop reading the panel, which costs the whole feature. So false
 * alarms are fatal and card confusions are tolerated a couple at a time.
 */

const CANDIDATES = ["claude-haiku-4-5-20251001", "claude-sonnet-5"];

const NO_FALSE_ALARMS = 0;
const MIN_CORRECT_CARDS = 6;
/** A rewrite that does not fit on a tile is still shown as prose, but the dare
    button never appears for it (run.ts drops it), so the offer quietly stops
    happening. A couple out of eight is tolerable; half is a different feature. */
const MAX_UNUSABLE_REWRITES = 2;

interface Outcome {
  id: string;
  pair: string;
  expected: string | null;
  got: string | null;
  ok: boolean;
  suggestionTooLong: boolean;
  latencyMs: number | null;
}

async function judge(item: CoachCase, model: string): Promise<Outcome> {
  const verdict = await evaluateTile(item.input, model);
  const got = verdict && verdict.cardIds.length > 0 ? verdict.cardIds[0] : null;
  return {
    id: item.id,
    pair: item.pair,
    expected: item.expect,
    got,
    ok: got === item.expect,
    suggestionTooLong: (verdict?.suggestion?.length ?? 0) > TILE_MAX_CHARS,
    latencyMs: verdict?.latencyMs ?? null,
  };
}

/** Four at a time: enough to keep the run short, gentle enough not to trip a
    rate limit and turn a real answer into a null. */
async function runAll(model: string): Promise<Outcome[]> {
  const out: Outcome[] = [];
  for (let i = 0; i < COACH_CASES.length; i += 4) {
    const batch = COACH_CASES.slice(i, i + 4);
    out.push(...(await Promise.all(batch.map((item) => judge(item, model)))));
  }
  return out;
}

function report(model: string, results: Outcome[]): void {
  const silent = results.filter((r) => r.expected === null);
  const breaking = results.filter((r) => r.expected !== null);
  const falseAlarms = silent.filter((r) => r.got !== null);
  const correct = breaking.filter((r) => r.ok);
  const unreachable = results.filter((r) => r.latencyMs === null && r.got === null);
  const latencies = results
    .map((r) => r.latencyMs)
    .filter((ms): ms is number => ms !== null)
    .sort((a, b) => a - b);

  const lines = [
    "",
    `=== ${model} ===`,
    `  false alarms on clean reasons: ${falseAlarms.length}/${silent.length}` +
      (falseAlarms.length > 0
        ? ` (${falseAlarms.map((r) => `${r.id}->${r.got}`).join(", ")})`
        : ""),
    `  right card when one broke:     ${correct.length}/${breaking.length}`,
    `  rewrites too long for a tile:  ${results.filter((r) => r.suggestionTooLong).length}`,
    `  no answer at all:              ${unreachable.length}`,
    `  median latency:                ${latencies[Math.floor(latencies.length / 2)] ?? "n/a"} ms`,
  ];

  // Side-by-side, because the failure this is really watching for is a model
  // that hears one side's exaggeration and not the other's.
  const pairs = [...new Set(results.map((r) => r.pair))];
  for (const pair of pairs) {
    const both = results.filter((r) => r.pair === pair);
    const agree = both.every((r) => r.ok) || both.every((r) => !r.ok);
    lines.push(
      `  ${agree ? " " : "!"} ${pair}: ${both.map((r) => `${r.id.split("_").pop()}=${r.got ?? "silent"}`).join("  ")}`,
    );
  }

  console.log(lines.join("\n"));
}

describe.skipIf(!process.env.COACH_EVAL)("which model should coach", () => {
  it("measures every candidate and holds the pinned one to the bar", async () => {
    const measured = new Map<string, Outcome[]>();
    for (const model of CANDIDATES) {
      const results = await runAll(model);
      measured.set(model, results);
      report(model, results);
    }

    const pinned = measured.get(COACH_MODEL);
    expect(pinned, `${COACH_MODEL} is pinned but was not measured`).toBeDefined();
    if (!pinned) return;

    const falseAlarms = pinned.filter((r) => r.expected === null && r.got !== null);
    expect(falseAlarms.map((r) => r.id)).toHaveLength(NO_FALSE_ALARMS);

    const correct = pinned.filter((r) => r.expected !== null && r.ok);
    expect(correct.length).toBeGreaterThanOrEqual(MIN_CORRECT_CARDS);

    expect(pinned.filter((r) => r.suggestionTooLong).length).toBeLessThanOrEqual(
      MAX_UNUSABLE_REWRITES,
    );
  }, 600_000);
});
