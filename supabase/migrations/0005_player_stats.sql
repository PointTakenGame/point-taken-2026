-- 0005: the numbers an account page shows, derived, never stored.
--
-- BRAIN-T260714-70 asks for games played and completed, thread resolutions split
-- by emoji, tiles placed, and snitches caught. The old stack's plan was to cache
-- a stats record on the user row. This does not, because the event log already
-- holds every one of these facts and a cached copy is a second source of truth
-- that goes stale the first time a projection changes. Recompute; add a cache
-- when a real page is measurably slow, not before.
--
-- ATTRIBUTION, the one judgment call in here. Two rules, applied consistently:
--
--   Acts belong to the actor. A tile is placed by one person, and game_events
--   .actor_id says who. These come from `acts`.
--
--   Outcomes belong to every participant. A thread resolves only when both
--   sides agree on it, and a topic is revised only by acceptance, so crediting
--   the player who happened to click last would be a lie about a cooperative
--   game. These come from `mine`, the player's games, regardless of actor.
--
-- The emoji vocabulary is deliberately not enumerated. 0002 leaves it to the
-- rules package, so `resolutions_by_emoji` is whatever the log actually holds,
-- counted. Hard-coding fact/priorities/taste here would freeze an unsettled
-- decision in a migration, which is the one place it is most expensive to
-- change. Same reasoning for `events_by_type`: a new counter for the account
-- page is then a read of an existing key, not another migration.
--
-- SERVICE_ROLE ONLY, and this is a footgun worth naming. The function is
-- SECURITY INVOKER, so under an authenticated caller every table it touches is
-- filtered by the RLS policies from 0004. Asked about another player it would
-- return a partial count rather than an error: quietly wrong, which is worse.
-- If a client ever needs this, add an auth.uid() = p_player_id guard first.

create function public.player_stats(p_player_id uuid)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
with mine as (
  select gp.game_id, g.mode, g.status, g.win_condition, gp.joined_at
    from public.game_players gp
    join public.games g on g.id = gp.game_id
   where gp.player_id = p_player_id
),
acts as (
  select e.type, count(*) as n
    from public.game_events e
   where e.actor_id = p_player_id
   group by e.type
),
resolutions as (
  select e.payload ->> 'emoji' as emoji, count(*) as n
    from public.game_events e
    join mine m on m.game_id = e.game_id
   where e.type = 'thread_resolved'
   group by 1
)
select jsonb_build_object(
  'player_id', p_player_id,
  'games_played', (select count(*) from mine),
  'games_completed', (select count(*) from mine where status = 'ended'),
  'games_by_mode', coalesce(
    (select jsonb_object_agg(mode, n)
       from (select mode, count(*) as n from mine group by mode) t), '{}'::jsonb),
  'games_by_win_condition', coalesce(
    (select jsonb_object_agg(win_condition, n)
       from (select win_condition, count(*) as n
               from mine where win_condition is not null
              group by win_condition) t), '{}'::jsonb),
  -- Catching the snitch: the game ended because both sides agreed a revision.
  'topic_agreed_wins', (select count(*) from mine where win_condition = 'topic_agreed'),
  'threads_resolved', coalesce((select sum(n) from resolutions), 0),
  'resolutions_by_emoji', coalesce(
    (select jsonb_object_agg(emoji, n) from resolutions where emoji is not null),
    '{}'::jsonb),
  'tiles_placed', coalesce((select n from acts where type = 'tile_placed'), 0),
  'events_by_type', coalesce((select jsonb_object_agg(type, n) from acts), '{}'::jsonb),
  'first_game_at', (select min(joined_at) from mine),
  'last_game_at', (select max(joined_at) from mine)
);
$$;

comment on function public.player_stats(uuid) is
  'Account-page counters derived from the event log. Acts credit the actor; '
  'outcomes credit every participant. service_role only: see 0005.';

-- The PUBLIC-grant trap again. Revoke PUBLIC first, then name the grantee.
revoke all on function public.player_stats(uuid) from public, anon, authenticated;
grant execute on function public.player_stats(uuid) to service_role;
