/**
 * Seed demo play history: invents ~20 fictional players and a spread of
 * finished games so the account page and any leaderboard have something real
 * to show, instead of one lonely row.
 *
 * WHY THIS EXISTS
 * Written for Steve's own dev database so his account page shows a believable
 * history tomorrow morning. Not a fixture for tests, not something that ever
 * runs against production.
 *
 * MARKER CONVENTION (read this before writing a teardown)
 * Every row this script creates directly (players.id, games.id) gets a
 * deterministic id in the form `5eed0000-XXXX-4XXX-8XXX-XXXXXXXXXXXX`. That
 * prefix is not decorative: it is how a future cleanup finds every seeded
 * row. `game_events` (bigint identity, no id to mark) and `game_players`
 * (composite key, no id to mark) carry no marker of their own; find them by
 * joining on a marked `game_id` or `player_id`. To select everything this
 * script ever wrote:
 *   select * from players where id::text like '5eed0000-%';
 *   select * from games where id::text like '5eed0000-%';
 *   select * from game_events where game_id::text like '5eed0000-%';
 *   select * from game_players where game_id::text like '5eed0000-%';
 * This script never deletes anything, on any run.
 *
 * IDEMPOTENCY
 * Every id is derived from a fixed string key (a player's cohort slug, a
 * game's sequence number), not from time or randomness, so the same run
 * produces the same ids every time. Before creating a player or a game, the
 * script checks whether that exact id already exists and skips it if so.
 * Rows this script did not create are never read for a match and never
 * written to. Run it as many times as you like; the second run should
 * report the same totals as the first, having done nothing.
 *
 * DETERMINISM
 * No Math.random() anywhere in this file. All shuffling, pairing, name
 * generation and topic/content selection go through a small seeded PRNG
 * (mulberry32) fed by a fixed numeric seed, so two runs on the same day (or
 * ten years apart) produce byte-identical player and game structure. Only
 * the actual calendar dates move, and they move because they are computed
 * relative to `new Date()` at the moment the script runs, per the request:
 * "some of them started a month ago, some last week, some today."
 *
 * WHAT GETS BACKDATED, AND WHAT DOES NOT (read this before extending it)
 * `game_events` is append-only and the only two ways to write it
 * (`append_game_event` / `append_game_events`, both in
 * supabase/migrations/0002_event_type_catalogue.sql) hardcode
 * `created_at` to the column default `now()` with no override parameter.
 * `service_role` also holds only SELECT on `game_events`
 * (0003_service_role_read.sql, deliberately: "INSERT would let a caller
 * write a row without going through the append functions"). There is no
 * sanctioned path, direct or otherwise, to backdate an event's own
 * `created_at`. So every seeded event is honestly timestamped at the real
 * moment this script ran.
 *
 * `games` and `game_players`, by contrast, are directly
 * select/insert/update-able by `service_role`
 * (grant in 0004_identity_and_games.sql), even though the migration's own
 * comment on `games` says "do not update this table directly" as a style
 * rule for the application, not a technical restriction. This script is not
 * the application: it is a one-time data seed with no other way to satisfy
 * "spread across the last month," so after each game's real events are
 * appended (all timestamped "now"), it does one follow-up UPDATE per game to
 * set games.created_at / started_at / ended_at and game_players.joined_at to
 * the intended historical spread. games.created_at is set correctly at
 * INSERT time and is never touched by any trigger, so no correction is
 * needed there.
 *
 * Net effect: player_stats' first_game_at/last_game_at (sourced from
 * game_players.joined_at) and the games table itself show a real month-long
 * spread with varied times of day, exactly as asked. The raw game_events log
 * for every seeded game will show every one of that game's events clustered
 * within the few minutes this script actually ran, which is a genuine,
 * permanent gap between the event log and the read model for seeded rows
 * only. It is flagged here, in the script's own comments, and in the
 * migration read that discovered it, precisely so nobody re-derives it the
 * hard way later.
 *
 * WHAT IS NOT SEEDED
 * No ai_feedback_returned / ai_feedback_shown / coach_nudge_delivered
 * events. Those need several fields (model_name, prompt_versions,
 * evaluator_schema_version, error_types, ...) this script has no principled
 * way to fabricate, and nothing in the task asks for coach-flag stats.
 * coach_flags_by_id reads as an empty object for every seeded player, which
 * is a valid, internally-consistent zero, not a gap.
 *
 * OUTCOME VARIETY (added after the leaderboard's first look at the data)
 * Every game gets one of five outcomes, chosen deterministically per game:
 * about 85% finish normally (threads_resolved or topic_agreed), a smaller
 * share end abandoned (a mid-game player_left, then game_ended) or timeout
 * (game_ended with no walkout). Only the threads_resolved outcome resolves
 * every thread it created (that is what the win condition means); every
 * other outcome leaves some threads open, and every thread's tile count
 * varies (1 to 4 tiles) instead of a fixed root-plus-reply, so
 * threads_resolved and tiles_placed no longer move in lockstep on the
 * account page.
 *
 * IN-PROGRESS BOARDS (added after the leaderboard could be clicked into)
 * A fixed subset of three to five games, spread across distinct seeded
 * players rather than reusing the same one or two, are left with no
 * game_ended event at all, so their `games` row stays status='active':
 * someone mid-match right now, not just a finished row in a list. Each of
 * these has a real partial board underneath it, not a bare lobby: a topic
 * set, both seats taken, four to eight tiles placed across two or three
 * threads, at least one thread already resolved and at least one still
 * open. Which side placed the last tile (and so whose turn it reads as
 * next) varies from game to game rather than always landing on the same
 * seat.
 *
 * RUN
 *   npm run seed:demo
 */

import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { TOPIC_LIBRARY } from "../lib/board/setup";
import { SIGNING_LINE_IDS } from "../lib/board/setup";
import { FIRST_RELEASE_CARD_IDS } from "../lib/board/setup";
import { RESOLUTION_TOKENS, MIN_THREADS_TO_END, MAX_THREADS } from "../lib/board/rules";
import { generateDisplayName, numericTail, type Picker } from "../lib/names/generate";
import { EVENT_TYPES, type GameEventType, type Uuid } from "../lib/events/types";

// ---------------------------------------------------------------------------
// Env (standalone script: not run through Next, loads .env.local by hand)
// ---------------------------------------------------------------------------

function loadEnv(path: string) {
  try {
    // Node 20.6+/22+ builtin. Falls through to the manual parser below on an
    // older runtime rather than failing outright.
    (process as unknown as { loadEnvFile: (p: string) => void }).loadEnvFile(path);
    return;
  } catch {
    // fall through
  }
  try {
    const text = readFileSync(path, "utf8");
    for (const rawLine of text.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // No .env.local: assume the environment already has what is needed.
  }
}

loadEnv(new URL("../.env.local", import.meta.url).pathname);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SECRET_KEY. Expected them in .env.local " +
      "(never printed by this script, only checked for presence).",
  );
  process.exit(1);
}

const db: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Deterministic helpers: hashing, ids, PRNG
// ---------------------------------------------------------------------------

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32, matching the `Picker` signature from lib/names/generate.ts. */
function makeRng(seedLabel: string): Picker {
  let a = (fnv1a(seedLabel) || 1) >>> 0;
  return (bound: number) => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return Math.floor(r * bound);
  };
}

/** len hex characters, deterministic from key. */
function seededHex(key: string, len: number): string {
  const pick = makeRng(`hex:${key}`);
  let out = "";
  while (out.length < len) {
    out += pick(16).toString(16);
  }
  return out.slice(0, len);
}

/** A valid-shaped v4 UUID beginning with the 5eed0000 marker, deterministic
    from `key`. See the marker-convention note at the top of this file. */
function markedUuid(key: string): Uuid {
  const hex = seededHex(key, 22);
  const g2 = hex.slice(0, 4);
  const g3 = "4" + hex.slice(4, 7);
  const g4 = "8" + hex.slice(7, 10);
  const g5 = hex.slice(10, 22);
  return `5eed0000-${g2}-${g3}-${g4}-${g5}`;
}

const rngPlayers = makeRng("5eedseed:players");
const rngPairing = makeRng("5eedseed:pairing");
const rngDates = makeRng("5eedseed:dates");
const rngContent = makeRng("5eedseed:content");
const rngActive = makeRng("5eedseed:active");

function pick(rng: Picker, bound: number): number {
  return rng(bound);
}

function shuffle<T>(rng: Picker, items: T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = pick(rng, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Content pools. Topic-agnostic and side-neutral on purpose: see the
// political-neutrality note below. Actual topic wording always comes from
// TOPIC_LIBRARY, never invented here.
// ---------------------------------------------------------------------------

const GENERIC_REASONS: readonly string[] = [
  "The cost of getting this wrong falls on people who never got a vote.",
  "Whatever we pick needs to be easy to explain to someone hearing about it for the first time.",
  "The rule only works if it is actually enforced, and I am not sure this one would be.",
  "Precedent cuts both ways here, so I do not think we can lean on it alone.",
  "Whoever decides this should be the one who has to live with the outcome.",
  "The short term fix and the long term fix are not the same thing, and we are conflating them.",
  "This is easy to say and much harder to actually schedule.",
  "I keep coming back to who bears the cost if we are wrong.",
  "The exception we are describing might end up swallowing the rule.",
  "Two reasonable people could read this the same way and still land in different places.",
  "The timing matters as much as the decision itself.",
  "We are both assuming good faith, and the plan should survive when that is not true.",
  "Something that works at a small scale does not automatically work at a larger one.",
  "The people most affected by this are not in the room for it.",
  "I would rather have a clear rule that is sometimes wrong than a vague one that is always debatable.",
  "This depends on trust holding up over time, not just at the start.",
];

const REVISION_REASONS: readonly string[] = [
  "To put that more carefully: the cost still concerns me, but I may be overstating it.",
  "Revised: I think this is more about timing than about the rule itself.",
  "On reflection, the enforcement question is my real concern, not the rule as written.",
  "Let me narrow that: I am only worried about the edge cases, not the general rule.",
];

const TOPIC_AGREED_TEXT =
  "We agree this deserves a careful, case by case answer rather than a single fixed rule.";

// ---------------------------------------------------------------------------
// Political neutrality
// ---------------------------------------------------------------------------
// Topic text is always drawn verbatim from TOPIC_LIBRARY (never invented
// here), and every game cycles through all 17 topics roughly evenly rather
// than a curated subset, so this script makes no editorial selection of its
// own. All other text (tile reasons, revisions, the topic-agreement
// sentence) comes from the topic-agnostic, side-neutral pools above: they
// never engage with any topic's substance, so they carry no lean by
// construction, on either side, on any topic.

// ---------------------------------------------------------------------------
// Player roster
// ---------------------------------------------------------------------------

interface PlayerSpec {
  slug: string;
  index: number; // 1..21, activity rank; Steve occupies 11
  joinDaysAgo: number;
  weight: number; // target games_played
}

const STEVE_ID: Uuid = "7e64bc4f-296d-41f7-84f1-2b59cb1cc9fc";
const STEVE_INDEX = 11;

function weightFor(index: number): number {
  return Math.round(3 + 0.65 * index);
}

const NEWCOMER_DAYS = [0, 0, 1, 1, 2, 2];
const REGULAR_DAYS = [4, 6, 7, 9, 11, 13, 14];
const VETERAN_DAYS = [22, 24, 25, 26, 27, 28, 30];

const fictionalSpecs: PlayerSpec[] = [];
{
  const newcomerIndices = [1, 2, 3, 4, 5, 6];
  const regularIndices = [7, 8, 9, 10, 12, 13, 14];
  const veteranIndices = [15, 16, 17, 18, 19, 20, 21];

  newcomerIndices.forEach((index, i) => {
    fictionalSpecs.push({
      slug: `newcomer-${i + 1}`,
      index,
      joinDaysAgo: NEWCOMER_DAYS[i],
      weight: weightFor(index),
    });
  });
  regularIndices.forEach((index, i) => {
    fictionalSpecs.push({
      slug: `regular-${i + 1}`,
      index,
      joinDaysAgo: REGULAR_DAYS[i],
      weight: weightFor(index),
    });
  });
  veteranIndices.forEach((index, i) => {
    fictionalSpecs.push({
      slug: `veteran-${i + 1}`,
      index,
      joinDaysAgo: VETERAN_DAYS[i],
      weight: weightFor(index),
    });
  });
}

const STEVE_WEIGHT = weightFor(STEVE_INDEX);

// ---------------------------------------------------------------------------
// Step: players
// ---------------------------------------------------------------------------

interface SeededPlayer {
  id: Uuid;
  slug: string;
  displayName: string;
  weight: number;
}

async function ensurePlayers(): Promise<SeededPlayer[]> {
  const { data: existingRows, error: existingErr } = await db
    .from("players")
    .select("display_name")
    .not("display_name", "is", null);
  if (existingErr)
    throw new Error(`reading existing players failed: ${existingErr.message}`);

  const takenNames = new Set(
    (existingRows ?? []).map((r) => String(r.display_name).toLowerCase()),
  );

  const seeded: SeededPlayer[] = [];

  for (const spec of fictionalSpecs) {
    const id = markedUuid(`player:${spec.slug}`);

    const { data: found, error: findErr } = await db
      .from("players")
      .select("id, display_name")
      .eq("id", id)
      .maybeSingle();
    if (findErr)
      throw new Error(`checking player ${spec.slug} failed: ${findErr.message}`);

    if (found) {
      seeded.push({
        id,
        slug: spec.slug,
        displayName: found.display_name ?? spec.slug,
        weight: spec.weight,
      });
      continue;
    }

    let displayName = generateDisplayName(rngPlayers);
    while (takenNames.has(displayName.toLowerCase())) {
      displayName = `${generateDisplayName(rngPlayers)} ${numericTail(rngPlayers)}`;
    }
    takenNames.add(displayName.toLowerCase());

    const email = `demo-${spec.slug}@pointtaken-seed.invalid`;
    const { error: createErr } = await db.auth.admin.createUser({
      id,
      email,
      email_confirm: false,
    });
    if (createErr && !/already been registered|already exists/i.test(createErr.message)) {
      throw new Error(`creating auth user for ${spec.slug} failed: ${createErr.message}`);
    }

    const joinedAt = new Date(Date.now() - spec.joinDaysAgo * 86400_000).toISOString();
    const { error: updateErr } = await db
      .from("players")
      .update({ display_name: displayName, created_at: joinedAt })
      .eq("id", id);
    if (updateErr)
      throw new Error(`backdating player ${spec.slug} failed: ${updateErr.message}`);

    seeded.push({ id, slug: spec.slug, displayName, weight: spec.weight });
  }

  return seeded;
}

// ---------------------------------------------------------------------------
// Step: pairing games
// ---------------------------------------------------------------------------

interface GamePairing {
  index: number;
  plus: { id: Uuid; slug: string };
  minus: { id: Uuid; slug: string };
}

function buildPairings(players: SeededPlayer[]): GamePairing[] {
  const withSteve: { id: Uuid; slug: string; weight: number }[] = players.map((p) => ({
    id: p.id,
    slug: p.slug,
    weight: p.weight,
  }));
  withSteve.push({ id: STEVE_ID, slug: "steve", weight: STEVE_WEIGHT });

  const slots: { id: Uuid; slug: string }[] = [];
  for (const p of withSteve) {
    for (let i = 0; i < p.weight; i += 1) slots.push({ id: p.id, slug: p.slug });
  }

  const shuffled = shuffle(rngPairing, slots);

  const pairings: GamePairing[] = [];
  let gameIndex = 0;
  let i = 0;
  while (i + 1 < shuffled.length) {
    const a = shuffled[i];
    let bIdx = i + 1;
    // Never pair a player with themself: scan forward for a different one.
    while (bIdx < shuffled.length && shuffled[bIdx].id === a.id) bIdx += 1;
    if (bIdx >= shuffled.length) {
      i += 1;
      continue;
    }
    const b = shuffled[bIdx];
    // Remove b from its original position and treat i+1 as consumed by
    // moving the displaced elements down by one conceptually: simplest
    // correct approach is to splice.
    shuffled.splice(bIdx, 1);
    const useAsPlus = pick(rngPairing, 2) === 0;
    pairings.push({
      index: gameIndex,
      plus: useAsPlus ? a : b,
      minus: useAsPlus ? b : a,
    });
    gameIndex += 1;
    i += 1;
  }

  return pairings;
}

/**
 * Three to five pairings marked to stay in progress: "clicking into a game
 * and seeing a board mid-argument." Steve is excluded (this is about the
 * seeded players having something to walk into, not his own dashboard), and
 * no player appears in more than one chosen pairing, so the in-progress set
 * is spread across distinct people rather than the same two or three. A
 * dedicated rng stream so this selection never shifts where rngContent lands
 * for any individual game's own structure.
 */
function selectForcedActive(pairings: GamePairing[]): Set<number> {
  const count = 3 + pick(rngActive, 3); // 3, 4, or 5
  const candidates = pairings.filter(
    (p) => p.plus.id !== STEVE_ID && p.minus.id !== STEVE_ID,
  );
  const shuffled = shuffle(rngActive, candidates);
  const used = new Set<Uuid>();
  const chosen: GamePairing[] = [];
  for (const p of shuffled) {
    if (chosen.length >= count) break;
    if (used.has(p.plus.id) || used.has(p.minus.id)) continue;
    chosen.push(p);
    used.add(p.plus.id);
    used.add(p.minus.id);
  }
  return new Set(chosen.map((p) => p.index));
}

/**
 * Split `total` tiles across `buckets` threads, each landing in 1..4, so an
 * in-progress board's tile count is exact rather than a coincidence of
 * independent per-thread rolls.
 */
function splitTiles(rng: Picker, buckets: number, total: number): number[] {
  const counts = new Array(buckets).fill(1) as number[];
  let remaining = total - buckets;
  while (remaining > 0) {
    const idx = pick(rng, buckets);
    if (counts[idx] < 4) {
      counts[idx] += 1;
      remaining -= 1;
    }
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Step: event construction
// ---------------------------------------------------------------------------

interface EventDraft {
  type: GameEventType;
  actorRole: "plus" | "minus" | "server";
  source: "human" | "system";
  payload: unknown;
  actorId: Uuid | null;
}

function ev(
  type: GameEventType,
  actorRole: "plus" | "minus" | "server",
  source: "human" | "system",
  actorId: Uuid | null,
  payload: unknown,
): EventDraft {
  return { type, actorRole, source, actorId, payload };
}

const RESOLUTION_EMOJI = RESOLUTION_TOKENS[0];

type Outcome = "threads_resolved" | "topic_agreed" | "abandoned" | "timeout" | "active";

/**
 * One thread's tile chain, 1 to 4 tiles long, alternating side from whoever
 * opened it. `resolve` decides whether the thread gets both resolution
 * tokens and a thread_resolved close; an unresolved thread simply stops
 * after its last tile, same as a real board nobody got back to.
 */
function buildThread(
  index: number,
  t: number,
  opener: { id: Uuid },
  replier: { id: Uuid },
  openerRole: "plus" | "minus",
  replierRole: "plus" | "minus",
  tileCount: number,
  resolve: boolean,
  isFirstThreadOverall: boolean,
): EventDraft[] {
  const events: EventDraft[] = [];
  const rootTileId = markedUuid(`tile:${index}:${t}:0`);
  let parentTileId: Uuid | null = null;
  let lastAuthor = opener;
  let lastRole: "plus" | "minus" = openerRole;

  for (let i = 0; i < tileCount; i += 1) {
    const tileId = i === 0 ? rootTileId : markedUuid(`tile:${index}:${t}:${i}`);
    const author = i % 2 === 0 ? opener : replier;
    const role: "plus" | "minus" = i % 2 === 0 ? openerRole : replierRole;
    const text = GENERIC_REASONS[(index * 11 + t * 5 + i) % GENERIC_REASONS.length];

    events.push(
      ev("tile_placed", role, "human", author.id, {
        tile_id: tileId,
        parent_tile_id: parentTileId,
        thread_root_id: rootTileId,
        side: role,
        text,
        is_opening_reason: i === 0 && isFirstThreadOverall,
      }),
    );

    // Card exchange stays on the second tile of the thread's opening
    // exchange only (as before), now gated on there actually being one.
    if (i === 1 && t === 0) {
      const cardId = FIRST_RELEASE_CARD_IDS[index % FIRST_RELEASE_CARD_IDS.length];
      events.push(
        ev("card_thrown", lastRole, "human", lastAuthor.id, {
          card_id: cardId,
          rung_id: null,
          target_tile_id: tileId,
        }),
      );
      const throwSeq = events.length;
      if (pick(rngContent, 2) === 0) {
        events.push(
          ev("tile_revised", role, "human", author.id, {
            tile_id: tileId,
            text: REVISION_REASONS[index % REVISION_REASONS.length],
            in_response_to_seq: throwSeq,
          }),
        );
      } else {
        events.push(
          ev("card_throw_declined", role, "human", author.id, {
            in_response_to_seq: throwSeq,
            reason: null,
          }),
        );
      }
    }

    parentTileId = tileId;
    lastAuthor = author;
    lastRole = role;
  }

  if (resolve) {
    events.push(
      ev("resolution_emoji_placed", openerRole, "human", opener.id, {
        thread_root_id: rootTileId,
        emoji: RESOLUTION_EMOJI,
      }),
    );
    events.push(
      ev("resolution_emoji_placed", replierRole, "human", replier.id, {
        thread_root_id: rootTileId,
        emoji: RESOLUTION_EMOJI,
      }),
    );
    events.push(
      ev("thread_resolved", "server", "system", null, {
        thread_root_id: rootTileId,
        emoji: RESOLUTION_EMOJI,
        note: null,
      }),
    );
  }

  return events;
}

/**
 * Which outcome a game gets. Deterministic per pairing.index: about 85%
 * finish (threads_resolved or topic_agreed), a smaller share abandoned or
 * timed out, and whatever pairing.index is in `forcedActive` is left in
 * progress regardless of the roll. main() passes an empty set for the history
 * pass and the real set only for the second, in-progress pass, so a pairing
 * chosen to have a running game still gets its finished history too.
 */
function outcomeFor(pairing: GamePairing, forcedActive: Set<number>): Outcome {
  if (forcedActive.has(pairing.index)) return "active";
  const roll = pick(rngContent, 100);
  if (roll < 85) {
    return pick(rngContent, 4) === 0 ? "topic_agreed" : "threads_resolved";
  }
  if (roll < 93) return "abandoned";
  return "timeout";
}

function buildGame(
  pairing: GamePairing,
  displayNames: Map<Uuid, string>,
  outcome: Outcome,
): { setupAndPlay: EventDraft[]; outcome: Outcome } {
  const { plus, minus, index } = pairing;
  const topic = TOPIC_LIBRARY[index % TOPIC_LIBRARY.length];
  const plusName = displayNames.get(plus.id) ?? "Player";
  const minusName = displayNames.get(minus.id) ?? "Player";

  const events: EventDraft[] = [];

  events.push(
    ev("player_joined", "server", "human", plus.id, { display_name: plusName }),
  );
  events.push(
    ev("player_joined", "server", "human", minus.id, { display_name: minusName }),
  );
  events.push(ev("role_selected", "plus", "human", plus.id, { role: "plus" }));
  events.push(ev("role_selected", "minus", "human", minus.id, { role: "minus" }));
  events.push(
    ev("topic_set", "plus", "human", plus.id, {
      text: topic.text,
      origin: "library",
      topic_id: topic.id,
    }),
  );
  events.push(
    ev("agreement_signed", "plus", "human", plus.id, { items: [...SIGNING_LINE_IDS] }),
  );
  events.push(
    ev("agreement_signed", "minus", "human", minus.id, { items: [...SIGNING_LINE_IDS] }),
  );
  events.push(
    ev("game_started", "plus", "human", plus.id, {
      card_set: {
        policy: "intersection",
        card_ids: [...FIRST_RELEASE_CARD_IDS],
        raised_by: null,
      },
      coach: null,
    }),
  );

  // How many threads, and how many of them actually get resolved. Only
  // threads_resolved closes every thread it opened, because that is what the
  // win condition means (MIN_THREADS_TO_END, MAX_THREADS in lib/board/rules).
  // Every other outcome leaves at least one open, same as a board nobody
  // finished clearing.
  let numThreads: number;
  let resolvedCount: number;
  // Only set for outcome === "active": an exact tile count per thread (4 to
  // 8 total) instead of the generic per-thread roll used below, so an
  // in-progress board reads as "a few tiles in," not a random spread.
  let activeTileCounts: number[] | null = null;
  switch (outcome) {
    case "threads_resolved":
      numThreads =
        MIN_THREADS_TO_END + pick(rngContent, MAX_THREADS - MIN_THREADS_TO_END + 1);
      resolvedCount = numThreads;
      break;
    case "topic_agreed":
      numThreads = 2 + pick(rngContent, 3);
      resolvedCount = pick(rngContent, 3) === 0 ? numThreads - 1 : numThreads;
      break;
    case "abandoned":
      numThreads = 2 + pick(rngContent, 3);
      resolvedCount = pick(rngContent, 2); // 0 or 1: a walkout, not a finish
      break;
    case "timeout":
      numThreads = 3 + pick(rngContent, MAX_THREADS - 3 + 1);
      resolvedCount = Math.ceil(numThreads / 2) - 1 + pick(rngContent, 2); // roughly half
      break;
    case "active": {
      // Two or three threads, at least one resolved and at least one still
      // open: a board someone left mid-argument, not an empty lobby.
      numThreads = 2 + pick(rngContent, 2);
      const totalTiles = 4 + pick(rngContent, 5); // 4..8
      activeTileCounts = splitTiles(rngContent, numThreads, totalTiles);
      resolvedCount = numThreads === 2 ? 1 : 1 + pick(rngContent, numThreads - 1); // always leaves >=1 open
      break;
    }
  }
  resolvedCount = Math.max(0, Math.min(resolvedCount, numThreads));

  // Which thread indices resolve: a deterministic subset rather than always
  // "the first N", so an unresolved thread is not always the last one opened.
  const threadOrder = shuffle(
    rngContent,
    Array.from({ length: numThreads }, (_, t) => t),
  );
  const resolvedThreads = new Set(threadOrder.slice(0, resolvedCount));

  let abandonAfterThread = -1;
  let abandonerRole: "plus" | "minus" = "plus";
  let abandonerId: Uuid = plus.id;
  if (outcome === "abandoned") {
    // Whoever walks out leaves partway through, not before anything at all
    // and not after every thread either.
    abandonAfterThread = pick(rngContent, Math.max(1, numThreads - 1));
    const leaverIsPlus = pick(rngContent, 2) === 0;
    abandonerRole = leaverIsPlus ? "plus" : "minus";
    abandonerId = leaverIsPlus ? plus.id : minus.id;
  }

  for (let t = 0; t < numThreads; t += 1) {
    const openerIsPlus = t % 2 === 0;
    const opener = openerIsPlus ? plus : minus;
    const replier = openerIsPlus ? minus : plus;
    const openerRole = openerIsPlus ? "plus" : "minus";
    const replierRole = openerIsPlus ? "minus" : "plus";

    const tileCount = activeTileCounts ? activeTileCounts[t] : 1 + pick(rngContent, 4); // 1..4 tiles in this thread
    events.push(
      ...buildThread(
        index,
        t,
        opener,
        replier,
        openerRole,
        replierRole,
        tileCount,
        resolvedThreads.has(t),
        t === 0,
      ),
    );

    if (outcome === "abandoned" && t === abandonAfterThread) {
      events.push(
        ev("player_left", abandonerRole, "human", abandonerId, { reason: "quit" }),
      );
    }
  }

  if (outcome === "topic_agreed") {
    const proposalId = markedUuid(`proposal:${index}`);
    const proposerRole: "plus" | "minus" = "plus";
    const accepterRole: "plus" | "minus" = "minus";

    events.push(
      ev("proposal_made", proposerRole, "human", plus.id, {
        proposal_id: proposalId,
        kind: "topic_revision",
        target_tile_id: null,
        target_thread_root_id: null,
        content: { text: TOPIC_AGREED_TEXT },
      }),
    );
    events.push(
      ev("proposal_accepted", accepterRole, "human", minus.id, {
        proposal_id: proposalId,
      }),
    );
    events.push(
      ev("topic_revised", accepterRole, "human", minus.id, {
        text: TOPIC_AGREED_TEXT,
        via_proposal_id: proposalId,
      }),
    );
    events.push(
      ev("game_ended", "server", "system", null, { win_condition: "topic_agreed" }),
    );
  } else if (outcome === "active") {
    // No game_ended: the games row stays status='active' via project_game_event.
  } else {
    events.push(ev("game_ended", "server", "system", null, { win_condition: outcome }));
  }

  return { setupAndPlay: events, outcome };
}

// ---------------------------------------------------------------------------
// Step: writing one game (idempotent)
// ---------------------------------------------------------------------------

async function writeGame(
  pairing: GamePairing,
  displayNames: Map<Uuid, string>,
  forcedActive: Set<number>,
  now: number,
  /**
   * The string the game's deterministic id is derived from. It is a parameter
   * rather than a constant because the same two players can have more than
   * one game: the first pass writes everybody's finished history under
   * `game:<index>`, and a second pass gives a few of those pairings a second,
   * still-running game under `active:<index>`. Two keys, two ids, two rows,
   * and a re-run still finds both already there and skips both.
   */
  idKey: string = `game:${pairing.index}`,
): Promise<"created" | "skipped"> {
  const gameId = markedUuid(idKey);

  const { data: existing, error: existErr } = await db
    .from("games")
    .select("id")
    .eq("id", gameId)
    .maybeSingle();
  if (existErr)
    throw new Error(`checking game ${pairing.index} failed: ${existErr.message}`);
  if (existing) return "skipped";

  // Computed only for a game actually being created, same as the rest of
  // this game's structure below: an already-existing game never touches
  // rngContent, so a re-run's early skip cannot shift any other game's roll.
  const outcome = outcomeFor(pairing, forcedActive);

  let t0: number;
  let tStart: number;
  let tEnd: number | null;

  if (outcome === "active") {
    // Still going: started a little while ago today, no end yet.
    const minutesAgo = 8 + pick(rngDates, 180); // 8 minutes to 3 hours ago
    t0 = now - minutesAgo * 60_000;
    const lobbyMinutes = 1 + pick(rngDates, 3);
    tStart = t0 + lobbyMinutes * 60_000;
    tEnd = null;
  } else {
    // Session start: somewhere between when both players had joined and now,
    // with the hour-of-day varied too, so the log does not read as a batch
    // import. Steve's own games lean toward the last two weeks so his
    // recency streak is visible.
    const involvesSteve = pairing.plus.id === STEVE_ID || pairing.minus.id === STEVE_ID;
    const spanDays = involvesSteve ? 12 : 30;
    const daysAgo = pick(rngDates, spanDays) + pick(rngDates, 2) / 2; // fractional day for spread
    const hourOfDay = pick(rngDates, 16) + 6; // 06:00-21:59
    const minuteOfHour = pick(rngDates, 60);
    const base = new Date(now - Math.floor(daysAgo * 86400_000));
    base.setHours(hourOfDay, minuteOfHour, 0, 0);
    t0 = base.getTime() > now ? now - 3600_000 : base.getTime();

    const lobbyMinutes = 1 + pick(rngDates, 3);
    // A walkout or a timeout runs shorter than a game somebody actually
    // finished; a finished game gets the fuller spread it had before.
    const sessionMinutes =
      outcome === "abandoned" ? 2 + pick(rngDates, 8) : 5 + pick(rngDates, 20);
    tStart = t0 + lobbyMinutes * 60_000;
    tEnd = tStart + sessionMinutes * 60_000;
  }

  const { error: insertErr } = await db.from("games").insert({
    id: gameId,
    mode: "live",
    level_id: null,
    boss_id: null,
    join_code: null,
    status: "lobby",
    created_by: pairing.plus.id,
    created_at: new Date(t0).toISOString(),
  });
  if (insertErr)
    throw new Error(`inserting game ${pairing.index} failed: ${insertErr.message}`);

  const gameCreatedType: GameEventType = "game_created";
  const { error: createdErr } = await db.rpc("append_game_event", {
    p_game_id: gameId,
    p_type: gameCreatedType,
    p_schema_version: EVENT_TYPES.game_created.schemaVersion,
    p_actor_role: "server",
    p_source: "system",
    p_payload: { mode: "live", level_id: null, boss_id: null, join_code: null },
    p_actor_id: pairing.plus.id,
  });
  if (createdErr) {
    throw new Error(`game_created for ${pairing.index} failed: ${createdErr.message}`);
  }

  const { setupAndPlay } = buildGame(pairing, displayNames, outcome);
  const batch = setupAndPlay.map((e) => ({
    type: e.type,
    schema_version: EVENT_TYPES[e.type].schemaVersion,
    actor_role: e.actorRole,
    source: e.source,
    actor_id: e.actorId,
    payload: e.payload,
  }));
  const { error: batchErr } = await db.rpc("append_game_events", {
    p_game_id: gameId,
    p_events: batch,
  });
  if (batchErr)
    throw new Error(`event batch for game ${pairing.index} failed: ${batchErr.message}`);

  // An active game has no ended_at to set: leave the column as the insert
  // left it (null), matching games_active_has_start / games_ended_has_condition.
  const gameUpdate: Record<string, string> = {
    started_at: new Date(tStart).toISOString(),
  };
  if (tEnd !== null) gameUpdate.ended_at = new Date(tEnd).toISOString();

  const { error: fixGameErr } = await db
    .from("games")
    .update(gameUpdate)
    .eq("id", gameId);
  if (fixGameErr) {
    throw new Error(
      `backdating game ${pairing.index} timestamps failed: ${fixGameErr.message}`,
    );
  }

  const { error: fixJoinErr } = await db
    .from("game_players")
    .update({ joined_at: new Date(t0).toISOString() })
    .eq("game_id", gameId)
    .in("player_id", [pairing.plus.id, pairing.minus.id]);
  if (fixJoinErr) {
    throw new Error(
      `backdating game_players for game ${pairing.index} failed: ${fixJoinErr.message}`,
    );
  }

  return "created";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const now = Date.now();

  console.log(
    "Checking Steve's account (id fixed, not created or modified by this script)...",
  );
  const { data: steveRow, error: steveErr } = await db
    .from("players")
    .select("id, display_name, created_at")
    .eq("id", STEVE_ID)
    .maybeSingle();
  if (steveErr) throw new Error(`reading Steve's account failed: ${steveErr.message}`);
  if (!steveRow) {
    console.warn(
      `WARNING: player ${STEVE_ID} not found. Steve will not be joined to any seeded games. ` +
        "This id was identified empirically as the only claimed account in the dev database " +
        "(steve+pttest4@becise.com); if it changed, update STEVE_ID at the top of this file.",
    );
  } else {
    console.log(
      `Steve's account: "${steveRow.display_name}" (created ${steveRow.created_at})`,
    );
  }

  console.log("Ensuring fictional players...");
  const players = await ensurePlayers();
  console.log(`${players.length} fictional players ready.`);

  const displayNames = new Map<Uuid, string>();
  for (const p of players) displayNames.set(p.id, p.displayName);
  if (steveRow) displayNames.set(STEVE_ID, steveRow.display_name ?? "Player");

  console.log("Building pairings...");
  const pairings = buildPairings(players).filter(
    (p) => steveRow || (p.plus.id !== STEVE_ID && p.minus.id !== STEVE_ID),
  );
  console.log(`${pairings.length} games planned.`);

  const forcedActive = selectForcedActive(pairings);

  // Pass one: everybody's history. No pairing is forced to stay in progress
  // here, so every game in this pass reaches an ending of its own.
  const noneForced = new Set<number>();
  let created = 0;
  let skipped = 0;
  for (const pairing of pairings) {
    const result = await writeGame(pairing, displayNames, noneForced, now);
    if (result === "created") created += 1;
    else skipped += 1;
    if ((created + skipped) % 10 === 0) {
      console.log(`  ...${created + skipped}/${pairings.length} games processed`);
    }
  }

  console.log(
    `Games created this run: ${created}. Already present (skipped): ${skipped}.`,
  );

  // Pass two: a handful of games still in progress, so that clicking into one
  // shows a board mid-argument rather than a finished summary. These are
  // additional games under their own id key, not rewrites of the finished
  // ones above, which matters because this script never deletes anything: on
  // a database that already holds a previous run's history, pass one skips
  // every game it finds and this pass is the only thing that writes.
  const activePairings = pairings.filter((p) => forcedActive.has(p.index));
  let activeCreated = 0;
  let activeSkipped = 0;
  for (const pairing of activePairings) {
    const result = await writeGame(
      pairing,
      displayNames,
      forcedActive,
      now,
      `active:${pairing.index}`,
    );
    if (result === "created") activeCreated += 1;
    else activeSkipped += 1;
  }
  console.log(
    `Games left in progress: ${activeCreated} created, ${activeSkipped} already present.`,
  );

  // PostgREST has no LIKE operator for a uuid column ("operator does not
  // exist: uuid ~~ unknown"), so the marker prefix is matched with a range
  // instead: every 5eed0000-* uuid sorts within [5eed0000-0...0, 5eed0001-0...0).
  const MARKER_LO = "5eed0000-0000-0000-0000-000000000000";
  const MARKER_HI = "5eed0001-0000-0000-0000-000000000000";
  const { count: playerCount } = await db
    .from("players")
    .select("*", { count: "exact", head: true })
    .gte("id", MARKER_LO)
    .lt("id", MARKER_HI);
  const { count: gameCount } = await db
    .from("games")
    .select("*", { count: "exact", head: true })
    .gte("id", MARKER_LO)
    .lt("id", MARKER_HI);
  const { count: eventCount } = await db
    .from("game_events")
    .select("*", { count: "exact", head: true })
    .gte("game_id", MARKER_LO)
    .lt("game_id", MARKER_HI);

  console.log("--- Marked-row totals ---");
  console.log(`players (5eed0000-*): ${playerCount}`);
  console.log(`games (5eed0000-*): ${gameCount}`);
  console.log(`game_events (game_id 5eed0000-*): ${eventCount}`);

  if (steveRow) {
    const { data: steveStats, error: statsErr } = await db.rpc("player_stats", {
      p_player_id: STEVE_ID,
    });
    if (statsErr) {
      console.warn(`Could not read back Steve's stats: ${statsErr.message}`);
    } else {
      console.log("--- Steve's player_stats ---");
      console.log(JSON.stringify(steveStats, null, 2));
    }
  }
}

main()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed script failed:", err);
    process.exit(1);
  });
