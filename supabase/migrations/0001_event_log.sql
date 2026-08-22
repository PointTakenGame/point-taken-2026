-- All rights reserved. Copyright (c) 2025-2026 Experception LLC. pointtaken.social
--
-- Migration 0001: the game event log.
--
-- This is the first migration on purpose. Fable's architecture crit
-- (docs/reference/materials/architecture/crits/2026-08-19_fable-architecture-crit.md)
-- made one demand ahead of all others: treat the event log as a versioned public
-- contract and write it down before any code. Every projection, every badge
-- criterion, every analytic, and every replay reads this table, so its shape is
-- the hardest thing in the system to change later and the cheapest thing to get
-- right now.
--
-- The contract itself, in prose, is
-- docs/reference/materials/spec/2026-08-19_event-log-contract.md. This file is
-- the enforcement.

-- ---------------------------------------------------------------------------
-- The log
-- ---------------------------------------------------------------------------

create table public.game_events (
  -- A global, gap-free-enough cursor. NOT the ordering authority for a game:
  -- it exists so a projection rebuild can stream the whole table in a stable
  -- order and resume from where it stopped. Two events in different games have
  -- a meaningless relative id and nothing should read one.
  id bigint generated always as identity primary key,

  game_id uuid not null,

  -- The ordering authority. Per game, starts at 1, no gaps. Postgres arbitrates
  -- concurrent appends through the unique constraint below rather than any
  -- in-memory room state deciding who went first. This is the single line that
  -- replaces the socket server's authority in the old architecture, and it is
  -- why realtime is allowed to be dumb pub/sub.
  seq integer not null check (seq > 0),

  -- What happened. A stable string, never renamed: recorded history means what
  -- the type said at the time it was written. Retiring an event type means no
  -- longer writing it, never renaming or deleting the old rows.
  type text not null check (type <> ''),

  -- The version of THIS event type's payload, not of the log as a whole. A new
  -- required field on tile_confirmed bumps tile_confirmed and touches nothing
  -- else. Readers declare which versions they understand and skip the rest;
  -- see the contract doc.
  schema_version integer not null check (schema_version >= 1),

  -- Who caused it. Null for server-generated events (timeouts, AI feedback,
  -- awards), which is a real and common case rather than missing data.
  actor_id uuid references auth.users (id) on delete set null,

  payload jsonb not null default '{}'::jsonb,

  -- Server time, always. A client clock is a claim, not a fact; if a client
  -- timestamp ever matters it goes in the payload where it is visibly a claim.
  created_at timestamptz not null default now(),

  constraint game_events_game_seq_unique unique (game_id, seq)
);

comment on table public.game_events is
  'Append-only game event log. (game_id, seq) is the ordering authority. '
  'Contract: docs/reference/materials/spec/2026-08-19_event-log-contract.md';

-- The read pattern that matters most: replay one game in order. The unique
-- constraint above already provides this index, named here for the reader.
-- Second pattern: sweep one event type across all games for analytics and for
-- badge backfills. Without this that sweep is a full scan, which is the
-- specific failure the JSONB-moves-column design could not avoid.
create index game_events_type_created_idx
  on public.game_events (type, created_at desc);

-- Third pattern: everything one player did, across games. Partial because most
-- rows are player-caused and the null rows are never queried this way.
create index game_events_actor_idx
  on public.game_events (actor_id, created_at desc)
  where actor_id is not null;

-- ---------------------------------------------------------------------------
-- Append-only, enforced rather than promised
-- ---------------------------------------------------------------------------

-- Row-level security refuses the anon and authenticated roles; this trigger
-- refuses everyone, including the service role, which bypasses RLS entirely.
-- A log that can be edited by whoever holds the secret key is not a log.
create or replace function public.game_events_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'game_events is append-only: % rejected on game % seq %',
    tg_op, old.game_id, old.seq
    using errcode = 'restrict_violation';
end;
$$;

create trigger game_events_no_update
  before update on public.game_events
  for each row execute function public.game_events_append_only();

create trigger game_events_no_delete
  before delete on public.game_events
  for each row execute function public.game_events_append_only();

-- ---------------------------------------------------------------------------
-- The append path
-- ---------------------------------------------------------------------------

-- Assigning seq is the one genuinely concurrent operation in the system: two
-- players confirming a tile at the same instant both want the next number.
--
-- Computing max(seq) + 1 and inserting is a race under read committed; both
-- transactions read the same max and one loses to the unique constraint. That
-- outcome is correct but it turns an ordinary simultaneous move into a visible
-- error the caller has to retry.
--
-- The transaction-scoped advisory lock below serializes appends per game and
-- nothing else. Two games never contend. The lock releases with the
-- transaction, including on rollback, so a crashed append cannot wedge a room.
--
-- SECURITY DEFINER because callers are server-side functions holding the secret
-- key today, and because a future player-facing path must go through this
-- function rather than inserting directly. search_path is pinned: a
-- SECURITY DEFINER function with a caller-controlled search_path is the classic
-- Postgres privilege-escalation hole.
create or replace function public.append_game_event(
  p_game_id uuid,
  p_type text,
  p_schema_version integer,
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
  perform pg_advisory_xact_lock(hashtextextended(p_game_id::text, 0));

  select coalesce(max(seq), 0) + 1
    into v_seq
    from public.game_events
   where game_id = p_game_id;

  insert into public.game_events
    (game_id, seq, type, schema_version, actor_id, payload)
  values
    (p_game_id, v_seq, p_type, p_schema_version, p_actor_id, p_payload)
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.append_game_event is
  'The only supported way to write a game event. Assigns seq under a per-game '
  'advisory lock so simultaneous moves do not collide on the unique constraint.';

-- The gym is client-authoritative (Steve's decision, 2026-08-19), so a whole
-- gym run arrives as one upload rather than as a move-by-move stream.
-- Fable's crit is blunt that this cannot be retrofitted: "a client-authoritative
-- gym wants events designed for batch upload and replay validation, and
-- retrofitting that is a rewrite." Hence a batch path in the first migration,
-- before there is anything to migrate.
--
-- Three properties this has to hold, and does:
--
--   1. Contiguous seq. One lock, one base number, ordinality off the input
--      array. A run's events are numbered 1..n with no interleaving, because
--      the lock is held for the whole insert.
--   2. All or nothing. A single statement in a single transaction. A run is
--      never half-recorded, which is what makes replay validation meaningful.
--   3. Server time on every row. The client's own clock is not trusted for
--      created_at. A client timestamp that genuinely matters (how long the
--      player took) belongs inside payload, where it reads as a claim.
--
-- What this function does NOT do is validate. Validation is the caller's job
-- and must happen BEFORE the call: replay the uploaded run through the shared
-- rules package, and only append if it is legal. A forged gym log is an
-- accepted cost for personal badges in a free game, but an unvalidated one
-- should never reach the table.
create or replace function public.append_game_events(
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

  return query
  with inserted as (
    insert into public.game_events
      (game_id, seq, type, schema_version, actor_id, payload)
    select
      p_game_id,
      v_base + e.ord::integer,
      e.value ->> 'type',
      (e.value ->> 'schema_version')::integer,
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

alter table public.game_events enable row level security;

-- Deliberately no policies yet, which means deny-all for anon and authenticated.
--
-- This is a decision, not an omission. Today every write goes through a
-- server-side function holding the secret key, which bypasses RLS. Player-scoped
-- read policies need a games table naming who is in a game, and that table is
-- not designed yet. Writing a permissive placeholder policy now and tightening
-- it later is how a log ends up world-readable in production, so the table
-- starts shut and opens in the migration that introduces the games table.
--
-- Realtime subscriptions respect RLS, so the client cannot listen to this table
-- until that migration lands either. Until then, broadcast is server-side.

-- Tables get no default grants, so this is belt and braces.
revoke all on public.game_events from anon, authenticated;

-- Functions are the opposite, and this is the part that bites. Postgres grants
-- EXECUTE on every new function to PUBLIC automatically, and anon and
-- authenticated inherit from PUBLIC. Revoking from those two roles by name
-- therefore does NOTHING: the grant they are actually using is the PUBLIC one.
--
-- This is not theoretical. The first version of this migration revoked from
-- anon and authenticated only, and a request carrying nothing but the
-- publishable key successfully appended a forged event to a game it was not in
-- (verified 2026-08-19, HTTP 200, seq 6). A SECURITY DEFINER function callable
-- by PUBLIC is a privilege escalation with extra steps.
--
-- Revoke from PUBLIC first, always. Do not "simplify" these three lines into
-- one that names roles.
revoke all on function public.append_game_event(uuid, text, integer, jsonb, uuid)
  from public, anon, authenticated;
revoke all on function public.append_game_events(uuid, jsonb)
  from public, anon, authenticated;

-- And then hand it back to exactly one role. service_role was also riding the
-- PUBLIC grant, so revoking PUBLIC without this line locks out the server-side
-- code that is supposed to be the only caller (verified: HTTP 403 on the secret
-- key until this grant existed).
--
-- Deny PUBLIC, grant the one role that should have it. Naming the grantee is
-- the point: when a player-facing append path is eventually wanted, it shows up
-- here as a deliberate new line rather than as an inherited default nobody read.
grant execute on function public.append_game_event(uuid, text, integer, jsonb, uuid)
  to service_role;
grant execute on function public.append_game_events(uuid, jsonb)
  to service_role;
