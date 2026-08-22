-- 0004: who the players are, what a game is, and who is in one.
--
-- 0001 shut game_events to anon and authenticated with no policies and said
-- why: "read policies need a games table naming who is in a game, and that
-- table is not designed yet ... the table starts shut and opens in the
-- migration that introduces the games table." This is that migration.
--
-- Build-order context: Steve reset the order on 2026-08-17 (BRAIN-T260817-05).
-- Levels, badges and coach names are deferred; the unleveled account and the
-- dashboards it feeds come first. What that decision explicitly does NOT
-- retire is the data model, because "an unleveled account still needs a
-- durable home, and dashboards still need a queryable history that does not
-- exist today." The log is the history. These three tables are the home.
--
-- The shape of the thing: the log stays the authority for what happened.
-- games and game_players are read models derived from it, maintained by one
-- trigger, never written by hand. The single exception is the games row
-- itself, which has to exist before the first event because game_events now
-- carries a foreign key to it.

-- ---------------------------------------------------------------------------
-- players
-- ---------------------------------------------------------------------------

-- One row per auth user, anonymous sign-ins included (those are enabled on this
-- project, BRAIN-T260819-16). The account is the auth user; this table is the
-- part of it we own.
create table public.players (
  id uuid primary key references auth.users (id) on delete cascade,

  -- Reddit-style three random words, no real names (BRAIN-T260714-71). Null
  -- until the server assigns one: the word list is content and belongs in the
  -- rules package, not in a migration. player_joined requires a display_name,
  -- so a player must be named before joining anything.
  display_name text check (display_name is null or display_name <> ''),

  -- When an anonymous account attached an email and became durable. Null means
  -- still anonymous. auth.users.is_anonymous already carries the flag, so this
  -- records the moment rather than duplicating the state.
  claimed_at timestamptz,

  created_at timestamptz not null default now()
);

comment on table public.players is
  'Profile per auth user. Progression totals are NOT here: points and badges '
  'are derived from game_events and get a projection table when a read needs '
  'one, not before.';

-- Display names are shown to opponents, so collisions are confusing rather
-- than dangerous. Unique anyway, since the generator can simply redraw.
create unique index players_display_name_key
  on public.players (lower(display_name))
  where display_name is not null;

-- Every auth user gets a profile, including the anonymous ones created mid-game.
-- Doing this server-side instead would mean any missed call leaves an auth user
-- with no profile and no way to join anything.
create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.players (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- games
-- ---------------------------------------------------------------------------

create table public.games (
  id uuid primary key default gen_random_uuid(),

  -- Two modes, exactly (BRAIN-T260819-08). The old backend's live|practice|solo
  -- conflated mode with player count; this does not. Dojo is retired and the
  -- decided name is Gym (BRAIN-T260816-18).
  mode text not null check (mode in ('gym', 'live')),

  -- Deferred content, so text ids rather than a foreign key to a levels table
  -- that does not exist and is not on the critical path.
  level_id text,
  boss_id text,

  -- How a second human finds a live game. Gym games have no one to invite.
  join_code text,

  status text not null default 'lobby'
    check (status in ('lobby', 'active', 'ended')),

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,

  -- Mirrors the game_ended payload. Null while the game is unfinished.
  win_condition text
    check (win_condition in
      ('threads_resolved', 'topic_agreed', 'abandoned', 'timeout')),

  constraint games_gym_has_no_join_code
    check (mode <> 'gym' or join_code is null),
  constraint games_ended_has_condition
    check ((status = 'ended') = (ended_at is not null)),
  constraint games_active_has_start
    check (status <> 'active' or started_at is not null)
);

comment on table public.games is
  'A game record. Everything after creation is projected from game_events by '
  'project_game_event(); do not update this table directly.';

-- A join code only has to be unique among games you could still join. Reusing
-- a retired code is fine and keeps codes short.
create unique index games_join_code_open_key
  on public.games (upper(join_code))
  where join_code is not null and status <> 'ended';

create index games_created_by_idx
  on public.games (created_by, created_at desc)
  where created_by is not null;

-- ---------------------------------------------------------------------------
-- game_players
-- ---------------------------------------------------------------------------

create table public.game_players (
  game_id uuid not null references public.games (id) on delete cascade,
  player_id uuid not null references auth.users (id) on delete cascade,

  -- Null until role_selected. Distinct from actor_role on the log, which is
  -- what a given event did, not what the player is.
  role text check (role in ('plus', 'minus')),

  joined_at timestamptz not null default now(),
  left_at timestamptz,

  primary key (game_id, player_id)
);

-- One player per side, enforced rather than checked in application code.
create unique index game_players_one_per_side
  on public.game_players (game_id, role)
  where role is not null;

-- The "my games" read, which is the dashboard's first query.
create index game_players_player_idx
  on public.game_players (player_id, joined_at desc);

-- ---------------------------------------------------------------------------
-- The log points at a real game
-- ---------------------------------------------------------------------------

-- Safe to add now because the log is empty; it would need a backfill later.
-- restrict, not cascade: the retain-everything ruling (BRAIN-T260822-03) says
-- deletion is an appended event and never erasure, so a game holding events
-- must not be deletable at all.
alter table public.game_events
  add constraint game_events_game_id_fkey
  foreign key (game_id) references public.games (id) on delete restrict;

-- ---------------------------------------------------------------------------
-- The projection
-- ---------------------------------------------------------------------------

-- Runs inside append_game_event, so inside its per-game advisory lock. That is
-- what makes the two-player cap and the one-per-side rule below actually
-- atomic rather than a check-then-act race.
create function public.project_game_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  case new.type

  when 'player_joined' then
    if new.actor_id is null then
      raise exception 'player_joined needs an actor_id'
        using errcode = 'invalid_parameter_value';
    end if;

    select count(*) into v_count
      from public.game_players where game_id = new.game_id;
    if v_count >= 2 and not exists (
      select 1 from public.game_players
       where game_id = new.game_id and player_id = new.actor_id
    ) then
      raise exception 'game % already has two players', new.game_id
        using errcode = 'check_violation';
    end if;

    -- Rejoining after a disconnect is the same row coming back, not a new seat.
    insert into public.game_players (game_id, player_id, joined_at)
    values (new.game_id, new.actor_id, new.created_at)
    on conflict (game_id, player_id) do update set left_at = null;

  when 'role_selected' then
    update public.game_players
       set role = new.payload ->> 'role'
     where game_id = new.game_id and player_id = new.actor_id;

  when 'player_left' then
    update public.game_players
       set left_at = new.created_at
     where game_id = new.game_id and player_id = new.actor_id;

  when 'game_started' then
    update public.games
       set status = 'active', started_at = new.created_at
     where id = new.game_id and status = 'lobby';

  when 'game_ended' then
    update public.games
       set status = 'ended',
           ended_at = new.created_at,
           win_condition = new.payload ->> 'win_condition'
     where id = new.game_id and status <> 'ended';

  else
    null;
  end case;

  return null;
end;
$$;

comment on function public.project_game_event is
  'Maintains games and game_players from the log. The log is the authority; '
  'these tables are a read model and must never be updated by hand.';

create trigger project_game_event_after_insert
  after insert on public.game_events
  for each row execute function public.project_game_event();

-- ---------------------------------------------------------------------------
-- Creating a game
-- ---------------------------------------------------------------------------

-- The one thing the trigger cannot do. game_events has a foreign key to games,
-- so the games row must exist before game_created can be appended, and both
-- have to happen in one transaction or a crash leaves a game with no history.
create function public.create_game(
  p_mode text,
  p_created_by uuid,
  p_level_id text default null,
  p_boss_id text default null,
  p_join_code text default null,
  p_client_build text default null
)
returns public.games
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_game public.games;
begin
  insert into public.games (mode, level_id, boss_id, join_code, created_by)
  values (p_mode, p_level_id, p_boss_id, p_join_code, p_created_by)
  returning * into v_game;

  perform public.append_game_event(
    v_game.id, 'game_created', 1, 'server', 'system',
    -- level_id, boss_id and join_code are required-and-nullable in the payload
    -- contract, so they stay present as explicit nulls. client_build is the
    -- only genuinely optional key, so it is the only one conditionally added.
    jsonb_build_object(
      'mode',      p_mode,
      'level_id',  p_level_id,
      'boss_id',   p_boss_id,
      'join_code', p_join_code
    ) || case
           when p_client_build is null then '{}'::jsonb
           else jsonb_build_object('client_build', p_client_build)
         end,
    p_created_by
  );

  return v_game;
end;
$$;

comment on function public.create_game is
  'Creates the game row and appends game_created atomically. The only '
  'supported way to start a game.';

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

alter table public.players enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;

-- Membership, factored out so the four policies below cannot drift apart.
--
-- SECURITY DEFINER is load-bearing, not habit. game_players_read_member is a
-- policy ON game_players whose body reads game_players, which recurses under
-- the caller's own role. Running as the owner, who is exempt from RLS, breaks
-- the cycle. Do not "simplify" this to a plain inlined exists() in the policy.
--
-- Stable, not immutable: it reads a table.
create function public.is_game_member(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.game_players
     where game_id = p_game_id and player_id = auth.uid()
  );
$$;

-- A player reads their own profile, plus the profiles of people they share a
-- game with, because the board shows an opponent's name.
create policy players_read_self_and_opponents
  on public.players for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
        from public.game_players mine
        join public.game_players theirs on theirs.game_id = mine.game_id
       where mine.player_id = auth.uid()
         and theirs.player_id = players.id
    )
  );

-- Display name is the only field a player may set, and only on themselves.
-- WITH CHECK repeats the USING clause because without it a player could update
-- their own row into someone else's id.
create policy players_update_self
  on public.players for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy games_read_member
  on public.games for select to authenticated
  using (public.is_game_member(id));

create policy game_players_read_member
  on public.game_players for select to authenticated
  using (public.is_game_member(game_id));

-- What 0001 deferred. Read the log of a game you are in; nothing else.
create policy game_events_read_member
  on public.game_events for select to authenticated
  using (public.is_game_member(game_id));

-- Realtime respects RLS, so this is also the line that lets a client subscribe
-- to its own game. Broadcast no longer has to be server-side.

-- No insert, update or delete policy on any of these, deliberately. Every write
-- goes through create_game or append_game_event, both of which run as the owner
-- and bypass RLS. A player-writable table would be a second write path.

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

-- Tables: RLS decides which rows, grants decide which verbs. Both are needed.
grant select on public.players, public.games, public.game_players,
                public.game_events to authenticated;
grant update (display_name) on public.players to authenticated;

grant select, insert, update on
  public.players, public.games, public.game_players to service_role;

-- anon stays at nothing. An anonymous sign-in produces an authenticated JWT,
-- so the anon role is only ever the pre-sign-in state and never a player.
revoke all on public.players, public.games, public.game_players from anon;

-- The PUBLIC-grant trap, spelled out at length in 0001: Postgres grants EXECUTE
-- to PUBLIC on every new function, and revoking from anon and authenticated by
-- name does nothing about it. Revoke PUBLIC first, then name the grantee.
revoke all on function public.create_game(text, uuid, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.project_game_event()
  from public, anon, authenticated;
revoke all on function public.handle_new_auth_user()
  from public, anon, authenticated;

grant execute on function public.create_game(text, uuid, text, text, text, text)
  to service_role;

-- is_game_member is the exception and must stay callable by authenticated:
-- it is the body of four RLS policies, and a policy runs as the querying role.
revoke all on function public.is_game_member(uuid) from public, anon;
grant execute on function public.is_game_member(uuid) to authenticated, service_role;
