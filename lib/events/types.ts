/**
 * The event vocabulary, in TypeScript.
 *
 * The database is the authority: `supabase/migrations/0002_event_type_catalogue.sql`
 * holds the same 28 types and the same byte ceilings, and refuses anything else.
 * This file exists so a writer is wrong at compile time rather than at runtime.
 * Prose half: docs/reference/materials/spec/2026-08-22_event-type-catalogue.md.
 *
 * Changing anything here without the matching migration is a bug in this file.
 */

/** Which side of the board acted. Column on the row, not a payload key. */
export type ActorRole = "plus" | "minus" | "server";

/** What produced the act. Independent of actorRole: a coach can play a side. */
export type Source = "human" | "coach" | "system";

/** The two sides a tile can belong to. Distinct from who placed it. */
export type Side = "plus" | "minus";

export type Uuid = string;

// ---------------------------------------------------------------------------
// Payloads
// ---------------------------------------------------------------------------
// A field typed `T | null` is required-and-nullable, which the spec separates
// from optional on purpose. Optional fields are marked `?`.

export interface GameCreatedPayload {
  mode: "gym" | "live";
  level_id: string | null;
  boss_id: string | null;
  join_code: string | null;
  client_build?: string;
}

export interface PlayerJoinedPayload {
  display_name: string;
}

export interface RoleSelectedPayload {
  role: Side;
}

export interface AgreementSignedPayload {
  /** Ids of the lines this player signed. Three lines or four is unsettled;
      the payload carries what was actually signed, so settling it is data. */
  items: string[];
}

export interface TopicSetPayload {
  text: string;
  origin: "library" | "custom";
  topic_id: string | null;
}

export interface GameStartedPayload {
  card_set: {
    policy: "intersection" | "raised";
    card_ids: string[];
    raised_by: Uuid | null;
  };
  coach: { coach_id: string; temperament: string } | null;
  /**
   * How many thread roots the board opens with. Until that many roots are
   * down, no tile may hang off another one: the game starts by putting the
   * disagreement's main branches on the table, not by diving into the first
   * one. Four in a live game and in gym levels 2 and up, two in gym level 1.
   *
   * Settings rather than a constant because it varies per game, and settings
   * rather than a mode switch because a gym game and a live game are the same
   * kind of game played under different numbers.
   *
   * Optional in this type and only in this type: version 1 of this payload
   * predates the field, and those rows are still in the log. Version 2 always
   * writes it. Readers default to `LIVE_ROOT_TARGET` (lib/board/rules.ts).
   */
  root_target?: number;
}

export interface PlayerLeftPayload {
  reason: "disconnect" | "quit";
}

export interface GameEndedPayload {
  win_condition: "threads_resolved" | "topic_agreed" | "abandoned" | "timeout";
}

/**
 * Which diagonal of its parent a tile was placed on, as the player clicked it.
 * Roots hang off the topic, replies off the reason they answer. Optional and
 * advisory: the layout honours it when the cell is free and falls back to its
 * own order otherwise, so a log written before this field draws as it always
 * did (Steve, 2026-09-04: a rebuttal placed on the lower right must not come
 * back on the upper right).
 */
export type TileCorner = "ne" | "se" | "sw" | "nw";

export interface TilePlacedPayload {
  tile_id: Uuid;
  parent_tile_id: Uuid | null;
  thread_root_id: Uuid;
  side: Side;
  /** At most 100 characters. */
  text: string;
  is_opening_reason?: boolean;
  via_proposal_id?: Uuid;
  corner?: TileCorner;
}

export interface TileEditedPayload {
  tile_id: Uuid;
  text: string;
}

export interface TileRevisedPayload {
  tile_id: Uuid;
  text: string;
  /** The seq of the card_thrown this answers. */
  in_response_to_seq: number;
}

export interface TileRelocatedPayload {
  tile_id: Uuid;
  new_parent_tile_id: Uuid | null;
  new_thread_root_id: Uuid;
  new_side: Side;
  via_proposal_id?: Uuid;
}

export interface TileRemovedPayload {
  tile_id: Uuid;
}

export interface ResolutionEmojiPlacedPayload {
  thread_root_id: Uuid;
  /** The vocabulary is unsettled and lives in the rules package, not here. */
  emoji: string;
}

export interface ResolutionEmojiRemovedPayload {
  thread_root_id: Uuid;
}

export interface ThreadResolvedPayload {
  thread_root_id: Uuid;
  emoji: string;
  note: string | null;
}

export type ProposalKind =
  | "topic_revision"
  | "tile_relocation"
  | "reading_handback"
  | "steelman_reading"
  | "steelman_tile"
  | "definition";

/** Content is shaped by kind. One primitive, six mechanics. */
export type ProposalContent =
  | { text: string }
  | { new_parent_tile_id: Uuid | null; new_thread_root_id: Uuid; new_side: Side }
  | { text: string; parent_tile_id: Uuid | null; side: Side }
  | { term: string; text: string };

export interface ProposalMadePayload {
  proposal_id: Uuid;
  kind: ProposalKind;
  target_tile_id: Uuid | null;
  target_thread_root_id: Uuid | null;
  content: ProposalContent;
  prompted_by_seq?: number;
}

export interface ProposalAcceptedPayload {
  proposal_id: Uuid;
}

export interface ProposalRejectedPayload {
  proposal_id: Uuid;
  reason: string | null;
}

export interface TopicRevisedPayload {
  text: string;
  via_proposal_id: Uuid;
}

export interface CardThrownPayload {
  card_id: string;
  /** Set when the throw exercises a rung rather than a card. */
  rung_id: string | null;
  target_tile_id: Uuid;
}

export interface CardThrowDeclinedPayload {
  in_response_to_seq: number;
  reason: string | null;
}

export interface GenerosityTokenGivenPayload {
  to_role: Side;
  target_tile_id?: Uuid;
}

export interface AiFeedbackReturnedPayload {
  tile_id: Uuid;
  error_types: string[];
  feedback: string | null;
  suggestion: string | null;
  model_name: string;
  prompt_versions: Record<string, string>;
  /** The AI pipeline's own output-schema version, not this row's schema_version. */
  evaluator_schema_version: string;
  pipeline_mode?: string | null;
  first_wave_categories?: string[];
  suggestion_source?: string;
  /**
   * The model's own confidence in its rewrite. Typed as his three words rather
   * than a number: he asks for a word and never computes a score, and a number
   * here would have to be invented.
   */
  suggestion_confidence?: "high" | "medium" | "low" | null;
  suggestion_preserves_stance?: boolean | null;
  latency_ms?: number;
  /**
   * The research corpus. Every one of the nine checks that fired, including the
   * four that are detected and deliberately never shown to a player. Keeping
   * them is the point of the split; see RESEARCH_ONLY_CHECK_KEYS in
   * `lib/coach/checks.ts`.
   */
  check_violations?: string[];
  /** supports / rebuts / irrelevant. Research metadata, never a card. */
  structure_relation?: string;
  clarification_needed?: boolean;
  /** The words in the reason the model says triggered the first violation. */
  trigger_phrase?: string | null;
  /** His threshold calibration version, carried so later drift is detectable. */
  threshold_version?: string;
}

export interface AiFeedbackShownPayload {
  in_response_to_seq: number;
}

export interface CoachNudgeDeliveredPayload {
  nudge_kind: string;
  text: string | null;
  target_tile_id?: Uuid;
  card_id?: string;
}

export interface GymRunRecordedPayload {
  rules_package_version: string;
  client_build: string;
  /** The validator's count. Disagreement with the log is the signal it exists to raise. */
  event_count: number;
  client_started_at: string | null;
  client_ended_at: string | null;
}

// --- Awards ----------------------------------------------------------------
// What a player walked away with. These are the only events written about a
// player rather than about the board, and they are still game events: they
// carry the actor_id of the player they belong to, so an account's whole
// history of them is one query and no join (lib/db/awards.ts).
//
// Nothing here is a score against an opponent. There is no losing, so there is
// no event that says anyone lost.

export interface LevelClearedPayload {
  /** Level id as used by lib/gym/levels, e.g. "onboarding". */
  level_id: string;
  /** The rule card this level grants, or null for a level that grants none. */
  card_id: string | null;
}

export interface BadgeGrantedPayload {
  /** Kebab-case badge id (BIZ-T260823-66). */
  badge_id: string;
  /**
   * 1 the first time this player earned it, 2 the second, and so on. The same
   * badge can be earned again in a later game, and the log keeps both, so the
   * reader can say "3 times" without the writer having to know it is a repeat.
   */
  occurrence: number;
}

export interface PointsChangedPayload {
  /** Signed. Negative is a stake put down, never a punishment for being wrong. */
  delta: number;
  /** Why, in a stable machine-readable word: "throw", "dare_staked", "dare_repaired". */
  reason: string;
}

export interface CertificateGrantedPayload {
  level_id: string;
  /** ISO timestamp. Written rather than derived so a reprint says the same date. */
  issued_at: string;
}

export interface ContentRedactedPayload {
  target_seq: number;
  /** Dotted path into that event's payload, e.g. "text". */
  target_path: string;
  reason: "author_request" | "moderation" | "legal";
  requested_by: Uuid | null;
}

// ---------------------------------------------------------------------------
// The map
// ---------------------------------------------------------------------------

export interface EventPayloads {
  game_created: GameCreatedPayload;
  player_joined: PlayerJoinedPayload;
  role_selected: RoleSelectedPayload;
  agreement_signed: AgreementSignedPayload;
  topic_set: TopicSetPayload;
  game_started: GameStartedPayload;
  player_left: PlayerLeftPayload;
  game_ended: GameEndedPayload;
  tile_placed: TilePlacedPayload;
  tile_edited: TileEditedPayload;
  tile_revised: TileRevisedPayload;
  tile_relocated: TileRelocatedPayload;
  tile_removed: TileRemovedPayload;
  resolution_emoji_placed: ResolutionEmojiPlacedPayload;
  resolution_emoji_removed: ResolutionEmojiRemovedPayload;
  thread_resolved: ThreadResolvedPayload;
  proposal_made: ProposalMadePayload;
  proposal_accepted: ProposalAcceptedPayload;
  proposal_rejected: ProposalRejectedPayload;
  topic_revised: TopicRevisedPayload;
  card_thrown: CardThrownPayload;
  card_throw_declined: CardThrowDeclinedPayload;
  generosity_token_given: GenerosityTokenGivenPayload;
  ai_feedback_returned: AiFeedbackReturnedPayload;
  ai_feedback_shown: AiFeedbackShownPayload;
  coach_nudge_delivered: CoachNudgeDeliveredPayload;
  gym_run_recorded: GymRunRecordedPayload;
  level_cleared: LevelClearedPayload;
  badge_granted: BadgeGrantedPayload;
  points_changed: PointsChangedPayload;
  certificate_granted: CertificateGrantedPayload;
  content_redacted: ContentRedactedPayload;
}

export type GameEventType = keyof EventPayloads;

export interface EventTypeSpec {
  /** Per type, never global. A type versions on its own clock. */
  schemaVersion: number;
  /** octet_length of the payload's JSON text, matching the trigger. */
  maxBytes: number;
}

/** Typed as a total Record, so a type added to EventPayloads fails to compile
    until its ceiling is stated here too. */
export const EVENT_TYPES: Record<GameEventType, EventTypeSpec> = {
  game_created: { schemaVersion: 1, maxBytes: 1024 },
  player_joined: { schemaVersion: 1, maxBytes: 512 },
  role_selected: { schemaVersion: 1, maxBytes: 256 },
  agreement_signed: { schemaVersion: 1, maxBytes: 512 },
  topic_set: { schemaVersion: 1, maxBytes: 1024 },
  // Version 2 adds root_target (0012_root_stage.sql). Version 1 rows are still
  // in the log and still project; they read as the live target of four.
  game_started: { schemaVersion: 2, maxBytes: 2048 },
  player_left: { schemaVersion: 1, maxBytes: 256 },
  game_ended: { schemaVersion: 1, maxBytes: 256 },
  tile_placed: { schemaVersion: 1, maxBytes: 1024 },
  tile_edited: { schemaVersion: 1, maxBytes: 1024 },
  tile_revised: { schemaVersion: 1, maxBytes: 1024 },
  tile_relocated: { schemaVersion: 1, maxBytes: 512 },
  tile_removed: { schemaVersion: 1, maxBytes: 256 },
  resolution_emoji_placed: { schemaVersion: 1, maxBytes: 256 },
  resolution_emoji_removed: { schemaVersion: 1, maxBytes: 256 },
  thread_resolved: { schemaVersion: 1, maxBytes: 1024 },
  proposal_made: { schemaVersion: 1, maxBytes: 4096 },
  proposal_accepted: { schemaVersion: 1, maxBytes: 256 },
  proposal_rejected: { schemaVersion: 1, maxBytes: 512 },
  topic_revised: { schemaVersion: 1, maxBytes: 1024 },
  card_thrown: { schemaVersion: 1, maxBytes: 512 },
  card_throw_declined: { schemaVersion: 1, maxBytes: 512 },
  generosity_token_given: { schemaVersion: 1, maxBytes: 256 },
  ai_feedback_returned: { schemaVersion: 1, maxBytes: 16384 },
  ai_feedback_shown: { schemaVersion: 1, maxBytes: 256 },
  coach_nudge_delivered: { schemaVersion: 1, maxBytes: 2048 },
  gym_run_recorded: { schemaVersion: 1, maxBytes: 1024 },
  // The four awards (0014_awards.sql). Small on purpose: each one names an id
  // and a number, and the words that go with the id live in content.
  level_cleared: { schemaVersion: 1, maxBytes: 256 },
  badge_granted: { schemaVersion: 1, maxBytes: 256 },
  points_changed: { schemaVersion: 1, maxBytes: 256 },
  certificate_granted: { schemaVersion: 1, maxBytes: 256 },
  content_redacted: { schemaVersion: 1, maxBytes: 1024 },
};

/** The table-level ceiling. No per-type value may exceed it. */
export const PAYLOAD_HARD_CAP_BYTES = 16384;

export const EVENT_TYPE_NAMES = Object.keys(EVENT_TYPES) as GameEventType[];

/** A row as it comes back from the database. */
export interface GameEventRow<T extends GameEventType = GameEventType> {
  id: string;
  game_id: Uuid;
  seq: number;
  type: T;
  schema_version: number;
  actor_role: ActorRole;
  source: Source;
  actor_id: Uuid | null;
  payload: EventPayloads[T];
  created_at: string;
}

/** Every row shape as one discriminated union, so `switch (event.type)`
    narrows the payload. `GameEventRow` alone cannot: its payload is a union. */
export type AnyGameEvent = {
  [T in GameEventType]: GameEventRow<T>;
}[GameEventType];

/** One event to write. schema_version comes from EVENT_TYPES, not the caller. */
export interface NewEvent<T extends GameEventType = GameEventType> {
  type: T;
  actorRole: ActorRole;
  source: Source;
  payload: EventPayloads[T];
  actorId?: Uuid | null;
}
