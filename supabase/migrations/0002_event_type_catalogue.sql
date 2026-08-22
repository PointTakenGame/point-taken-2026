-- All rights reserved. Copyright (c) 2025-2026 Experception LLC. pointtaken.social
--
-- Migration 0002: the event type catalogue.
--
-- 0001 built the log and left its own gap 1 open: there was no designed
-- vocabulary, only the placeholder strings used to verify the SQL. This
-- migration closes it. The prose is
-- docs/reference/materials/spec/2026-08-22_event-type-catalogue.md; this file is
-- the enforcement, and where they disagree one of the two is a bug.
--
-- Three things land here, all of which are cheap today and expensive later:
--
--   1. Two columns, actor_role and source, promoted out of payload. The table is
--      empty, so adding NOT NULL columns costs nothing now and would cost a
--      backfill decision in a week.
--   2. A catalogue table with a foreign key pointing at it, so a typo'd type
--      string is refused at write time. In an append-only log with no cleanup
--      path, a typo is permanent.
--   3. The payload size caps decided in the contract's gap 6: a 16 KB hard
--      ceiling for every event, and a tighter per-type limit under it.

-- ---------------------------------------------------------------------------
-- The envelope: two fields that are columns rather than payload keys
-- ---------------------------------------------------------------------------

-- Which side of the board acted. Every projection filters on it, and actor_id
-- alone cannot answer it: there is no games table naming who plays which side,
-- so deriving it would mean replaying role_selected first.
alter table public.game_events
  add column actor_role text not null
    check (actor_role in ('plus', 'minus', 'server'));

-- Who or what produced the act. This is the field that lets a badge criterion
-- tell "the player reached for the stronger reading" from "the coach walked them
-- into it". A criterion that has to unpack JSON to ask that question is a
-- criterion that eventually forgets to ask it.
--
-- Independent of actor_role: a coach playing the minus side is
-- ('minus', 'coach') with a null actor_id, and a server-written fact caused by a
-- player's move is ('server', 'system') with the actor_id set.
alter table public.game_events
  add column source text not null
    check (source in ('human', 'coach', 'system'));

comment on column public.game_events.actor_role is
  'plus | minus | server. Which side acted. Column, not payload: non-null on '
  'every row and filtered by nearly every reader.';

comment on column public.game_events.source is
  'human | coach | system. What produced the act. Independent of actor_role.';

-- The hard ceiling from the contract's gap 6. octet_length on the text form,
-- not pg_column_size: the latter reports the compressed and possibly TOASTed
-- size, which is not a stable contract. Nothing is ever removed from this table,
-- so an oversized row is permanent; refuse the paste bomb at write time.
alter table public.game_events
  add constraint game_events_payload_size
    check (octet_length(payload::text) <= 16384);

-- ---------------------------------------------------------------------------
-- The catalogue
-- ---------------------------------------------------------------------------

create table public.game_event_types (
  type text not null check (type <> ''),

  -- The version of this type's payload. A type appears once per version it has
  -- ever had, and old versions are never removed: recorded history means what
  -- the type said at the time it was written.
  schema_version integer not null check (schema_version >= 1),

  description text not null check (description <> ''),

  -- Per-type ceiling, at or under the table-wide 16 KB. Enforced by the trigger
  -- below rather than by a check constraint, because the limit depends on
  -- another table's row.
  payload_max_bytes integer not null default 2048
    check (payload_max_bytes between 1 and 16384),

  -- Retiring a type means no longer writing it. Existing rows still read
  -- normally; a new write is refused loudly rather than quietly reviving a dead
  -- vocabulary. The check is insert-time, so retiring later cannot invalidate
  -- history.
  retired boolean not null default false,

  created_at timestamptz not null default now(),

  primary key (type, schema_version)
);

comment on table public.game_event_types is
  'The event vocabulary. Adding a type is a deliberate migration insert, which '
  'is the point. Catalogue: docs/reference/materials/spec/2026-08-22_event-type-catalogue.md';

-- ---------------------------------------------------------------------------
-- Version 1 of the vocabulary: 28 types
-- ---------------------------------------------------------------------------

insert into public.game_event_types (type, schema_version, description, payload_max_bytes) values

  -- Lifecycle
  ('game_created', 1,
   'The room comes into being. Always seq 1, so no replay is ambiguous about what kind of game it is reading. mode, level_id, boss_id, join_code.', 1024),
  ('player_joined', 1,
   'A player is present in the room. display_name.', 512),
  ('role_selected', 1,
   'A player takes the plus or minus side. Reselectable until game_started; the last one wins.', 256),
  ('agreement_signed', 1,
   'One player signs the opening agreement. items carries what was actually signed, so settling three-lines-or-four changes data and not the version.', 512),
  ('topic_set', 1,
   'The topic statement, from the library or written fresh. text, origin, topic_id.', 1024),
  ('game_started', 1,
   'Play begins. card_set and coach. The roster is not repeated here: actor_role on role_selected already carries it.', 2048),
  ('player_left', 1,
   'A player is gone. Appended only after the presence layer debounces, so a flaky connection does not fill the log.', 256),
  ('game_ended', 1,
   'win_condition only. No counters and no duration: both are derivable from the log and a stored copy that disagrees has no fix path.', 256),

  -- Tiles
  ('tile_placed', 1,
   'A tile committed to the board, text inline. Drafts and typing are never logged. side is separate from actor_role because a Steel Man rung can add a tile to the other side.', 1024),
  ('tile_edited', 1,
   'The author rewords their own tile, unprompted. Separate from tile_revised because this one does not score.', 1024),
  ('tile_revised', 1,
   'The answer to a thrown card. in_response_to_seq names the throw.', 1024),
  ('tile_relocated', 1,
   'A tile moves. Only the destination is recorded; the origin is the previous state in the log.', 512),
  ('tile_removed', 1,
   'A tile is taken off the board. The text stays in the log.', 256),

  -- Threads and resolution
  ('resolution_emoji_placed', 1,
   'A resolution emoji on a thread root. Roots only. The allowed value set is still unsettled and lives in the rules package, not here.', 256),
  ('resolution_emoji_removed', 1,
   'A resolution emoji taken back off a thread root.', 256),
  ('thread_resolved', 1,
   'Server-written after both players confirm. Carries the statement they agreed on.', 1024),

  -- Propose and approve
  ('proposal_made', 1,
   'The one propose-and-approve primitive: topic revision, tile relocation, reading handback, both Steel Man offers, and Define That are all kinds of this.', 4096),
  ('proposal_accepted', 1,
   'A proposal is taken. A board change follows as its own event naming the proposal; acceptance alone is the whole record when nothing on the board moves.', 256),
  ('proposal_rejected', 1,
   'A proposal is declined. Rejection teaches and does not score.', 512),
  ('topic_revised', 1,
   'The effect of an accepted topic revision. Catching the snitch, when it ends the game.', 1024),

  -- Cards
  ('card_thrown', 1,
   'A rule card or rung is thrown at a tile. Whether the throw was correct is NOT stored: it is read at scoring time from what followed, so criteria stay retunable.', 512),
  ('card_throw_declined', 1,
   'The target declines to revise. in_response_to_seq names the throw.', 512),
  ('generosity_token_given', 1,
   'The generosity token from the printed game.', 256),

  -- AI and coach
  ('ai_feedback_returned', 1,
   'The evaluator pipeline returns. The largest realistic event, and the reason the hard cap is 16 KB. evaluator_schema_version is the pipeline output schema, deliberately not named schema_version.', 16384),
  ('ai_feedback_shown', 1,
   'Feedback actually displayed. Generated and shown are different facts and the gap between them is the research signal; append-only forbids a mutable shown flag anyway.', 256),
  ('coach_nudge_delivered', 1,
   'The coach says something. A coach board move is not this: it is an ordinary tile_placed with source = coach.', 2048),

  -- Gym
  ('gym_run_recorded', 1,
   'Written by the server as the last event of a validated batch. event_count is the validator''s count, and a disagreement with the log is exactly the signal it exists to raise. Client clocks are labelled as claims.', 1024),

  -- Retention
  ('content_redacted', 1,
   'The deletion event required by the 2026-08-22 retain-everything ruling. The raw log keeps the original; every player-visible view and every export must apply redactions before rendering.', 1024);

-- The foreign key is the actual enforcement. RESTRICT on both sides: a
-- catalogue row that events point at is not deletable and its key is not
-- editable, which is the append-only property reaching one table further.
alter table public.game_events
  add constraint game_events_type_fk
    foreign key (type, schema_version)
    references public.game_event_types (type, schema_version)
    on delete restrict on update restrict;

-- ---------------------------------------------------------------------------
-- The rules a foreign key cannot express
-- ---------------------------------------------------------------------------

-- A trigger rather than function-only validation, for the same reason
-- append-only is a trigger: it has to survive the secret key. Server-side code
-- that inserts directly instead of calling append_game_event is a bug, but it
-- should be a refused bug rather than a silently accepted one.
create or replace function public.game_events_validate()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_max integer;
  v_retired boolean;
  v_size integer;
begin
  -- seq 1 is reserved for game_created, in both directions. Every replay can
  -- therefore learn the mode from the first row without scanning, and a game
  -- cannot be "created" twice.
  if new.seq = 1 and new.type <> 'game_created' then
    raise exception
      'the first event of a game must be game_created, got % on game %',
      new.type, new.game_id
      using errcode = 'restrict_violation';
  end if;

  if new.seq <> 1 and new.type = 'game_created' then
    raise exception
      'game_created may only be seq 1, got seq % on game %',
      new.seq, new.game_id
      using errcode = 'restrict_violation';
  end if;

  select payload_max_bytes, retired
    into v_max, v_retired
    from public.game_event_types
   where type = new.type
     and schema_version = new.schema_version;

  -- The foreign key catches this too, but it fires after this trigger, so
  -- without these two lines the lookup below reads nulls and the size check
  -- silently passes.
  if not found then
    raise exception
      'unknown event type % version %: add it to game_event_types in a migration',
      new.type, new.schema_version
      using errcode = 'foreign_key_violation';
  end if;

  if v_retired then
    raise exception
      'event type % version % is retired and is no longer written',
      new.type, new.schema_version
      using errcode = 'restrict_violation';
  end if;

  v_size := octet_length(new.payload::text);
  if v_size > v_max then
    raise exception
      'payload for % is % bytes, over its % byte limit',
      new.type, v_size, v_max
      using errcode = 'program_limit_exceeded';
  end if;

  return new;
end;
$$;

create trigger game_events_validate_insert
  before insert on public.game_events
  for each row execute function public.game_events_validate();

-- ---------------------------------------------------------------------------
-- The append path, re-cut for the new envelope
-- ---------------------------------------------------------------------------

-- Dropped and recreated rather than overloaded. An overload would leave the old
-- signature callable, and the old signature is the one that omits source, which
-- is the field every badge criterion needs.
drop function if exists public.append_game_event(uuid, text, integer, jsonb, uuid);
drop function if exists public.append_game_events(uuid, jsonb);

create function public.append_game_event(
  p_game_id uuid,
  p_type text,
  p_schema_version integer,
  p_actor_role text,
  p_source text,
  p_payload jsonb default '{}'::jsonb,
  p_actor_id uuid default null
)
returns public.game_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_seq integer;
  v_row public.game_events;
begin
  -- Transaction-scoped, per game, releases on rollback. See 0001 for why this
  -- lock is the thing that keeps simultaneous moves from colliding on the
  -- unique constraint.
  perform pg_advisory_xact_lock(hashtextextended(p_game_id::text, 0));

  select coalesce(max(seq), 0) + 1
    into v_seq
    from public.game_events
   where game_id = p_game_id;

  insert into public.game_events
    (game_id, seq, type, schema_version, actor_role, source, actor_id, payload)
  values
    (p_game_id, v_seq, p_type, p_schema_version, p_actor_role, p_source,
     p_actor_id, p_payload)
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.append_game_event is
  'The only supported way to write a game event. Assigns seq under a per-game '
  'advisory lock. actor_role and source are required, not defaulted.';

create function public.append_game_events(
  p_game_id uuid,
  p_events jsonb
)
returns setof public.game_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_base integer;
begin
  if jsonb_typeof(p_events) is distinct from 'array' then
    raise exception
      'append_game_events expects a JSON array, got %',
      coalesce(jsonb_typeof(p_events), 'null')
      using errcode = 'invalid_parameter_value';
  end if;

  if jsonb_array_length(p_events) = 0 then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_game_id::text, 0));

  select coalesce(max(seq), 0)
    into v_base
    from public.game_events
   where game_id = p_game_id;

  -- Still no validation here beyond what the table and trigger enforce. A gym
  -- run is replayed through the shared rules package BEFORE this call, and only
  -- a legal run is appended. An element missing actor_role or source fails the
  -- NOT NULL, which names the column.
  return query
  with inserted as (
    insert into public.game_events
      (game_id, seq, type, schema_version, actor_role, source, actor_id, payload)
    select
      p_game_id,
      v_base + e.ord::integer,
      e.value ->> 'type',
      (e.value ->> 'schema_version')::integer,
      e.value ->> 'actor_role',
      e.value ->> 'source',
      nullif(e.value ->> 'actor_id', '')::uuid,
      coalesce(e.value -> 'payload', '{}'::jsonb)
      from jsonb_array_elements(p_events) with ordinality as e(value, ord)
    returning *
  )
  select * from inserted order by seq;
end;
$$;

comment on function public.append_game_events is
  'Batch append for client-authoritative gym runs. Numbers the batch '
  'contiguously under one per-game lock. Validate the run BEFORE calling.';

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

-- The catalogue is not secret, but Supabase grants anon and authenticated on new
-- public tables by default, and a table that is readable today is a table
-- somebody writes a client against tomorrow. It opens deliberately or not at all.
alter table public.game_event_types enable row level security;
revoke all on public.game_event_types from anon, authenticated;
grant select on public.game_event_types to service_role;

-- The PUBLIC trap from 0001, restated because the signatures changed and the
-- revokes therefore do not carry over. New functions are granted EXECUTE to
-- PUBLIC automatically, and anon inherits from PUBLIC, so revoking from anon by
-- name does nothing. This bit once already: a request carrying only the
-- publishable key appended a forged event with HTTP 200.
--
-- Revoke from PUBLIC first, always. Do not "simplify" these lines into one that
-- names roles.
revoke all on function public.append_game_event(uuid, text, integer, text, text, jsonb, uuid)
  from public, anon, authenticated;
revoke all on function public.append_game_events(uuid, jsonb)
  from public, anon, authenticated;

grant execute on function public.append_game_event(uuid, text, integer, text, text, jsonb, uuid)
  to service_role;
grant execute on function public.append_game_events(uuid, jsonb)
  to service_role;
