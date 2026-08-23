-- 0006: a cross-player leaderboard, derived, never stored.
--
-- BRAIN-T260714-72 asks for a ranking by cooperative-positive metrics: games
-- completed, tiles placed, threads resolved, and catching the snitch.
-- Deliberately not head-to-head win/loss, which would fight the cooperative
-- soul of the game. The four metrics and their attribution rules are exactly
-- 0005's: acts belong to the actor, outcomes belong to every participant. The
-- snitch metric reuses 0005's own name, `topic_agreed_wins`, rather than
-- inventing a second name for the same fact.
--
-- WHY PLPGSQL, UNLIKE 0005. player_stats takes no discriminator argument, so
-- a plain SQL function was enough. This one takes a caller-supplied metric
-- name and must reject an unknown one loudly rather than silently ranking
-- everyone by NULL. That guard needs an IF/RAISE, so this function is
-- language plpgsql where 0005 is language sql; everything after the guard is
-- one ordinary query.
--
-- SERVICE_ROLE ONLY, and this is a different footgun than 0005's, not the
-- same one restated. player_stats is dangerous under `authenticated` because
-- it takes a player id and doesn't check it against the caller. This function
-- is dangerous under `authenticated` for the opposite reason: it is a
-- leaderboard, so it is *supposed* to return every ranked player's handle and
-- counts to anyone who calls it. That is exactly the enumeration a caller
-- should not get by hitting Postgres directly, unrate-limited and unpaged.
-- The app route in front of `lib/db/leaderboard.ts` is where paging, a
-- request cap, and (if it's ever needed) auth-required-but-anonymous-ok
-- belong. Keep the trust boundary at the Next.js layer, same as every other
-- read and write path in this codebase.
--
-- Only players who have played at least one game are ranked; a fresh
-- anonymous account with no game history does not appear at all, rather than
-- tying for last place with everyone else who has never played.

create function public.leaderboard(
  p_metric text default 'games_completed',
  p_viewer_id uuid default null,
  p_top_n int default 20,
  p_radius int default 2
)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if p_metric not in ('games_completed', 'tiles_placed', 'threads_resolved', 'topic_agreed_wins') then
    raise exception
      'Unknown leaderboard metric "%". Must be one of games_completed, tiles_placed, threads_resolved, topic_agreed_wins.',
      p_metric;
  end if;

  with participated as (
    select gp.player_id, gp.game_id, g.status, g.win_condition
      from public.game_players gp
      join public.games g on g.id = gp.game_id
  ),
  completed as (
    select player_id, count(*) as n from participated where status = 'ended' group by player_id
  ),
  acts as (
    select actor_id as player_id, count(*) as n
      from public.game_events
     where type = 'tile_placed' and actor_id is not null
     group by actor_id
  ),
  resolutions as (
    select p.player_id, count(*) as n
      from public.game_events e
      join participated p on p.game_id = e.game_id
     where e.type = 'thread_resolved'
     group by p.player_id
  ),
  snitches as (
    select player_id, count(*) as n
      from participated
     where status = 'ended' and win_condition = 'topic_agreed'
     group by player_id
  ),
  agg as (
    select pl.id as player_id, pl.display_name,
           coalesce(c.n, 0) as games_completed,
           coalesce(a.n, 0) as tiles_placed,
           coalesce(r.n, 0) as threads_resolved,
           coalesce(s.n, 0) as topic_agreed_wins
      from public.players pl
      join (select distinct player_id from participated) played on played.player_id = pl.id
      left join completed c on c.player_id = pl.id
      left join acts a on a.player_id = pl.id
      left join resolutions r on r.player_id = pl.id
      left join snitches s on s.player_id = pl.id
  ),
  scored as (
    select agg.*,
           case p_metric
             when 'games_completed' then games_completed
             when 'tiles_placed' then tiles_placed
             when 'threads_resolved' then threads_resolved
             when 'topic_agreed_wins' then topic_agreed_wins
           end as value
      from agg
  ),
  ranked as (
    select *, rank() over (order by value desc, player_id) as rank
      from scored
  )
  select jsonb_build_object(
    'metric', p_metric,
    'total_ranked', (select count(*) from ranked),
    'top', coalesce((
      select jsonb_agg(jsonb_build_object(
               'rank', rank, 'player_id', player_id, 'display_name', display_name,
               'value', value, 'games_completed', games_completed, 'tiles_placed', tiles_placed,
               'threads_resolved', threads_resolved, 'topic_agreed_wins', topic_agreed_wins)
             order by rank)
        from ranked where rank <= p_top_n
    ), '[]'::jsonb),
    -- Null when p_viewer_id is null or has no ranked row: a uuid column never
    -- equals null, so this needs no separate guard.
    'viewer', (
      select jsonb_build_object(
               'rank', rank, 'player_id', player_id, 'display_name', display_name,
               'value', value, 'games_completed', games_completed, 'tiles_placed', tiles_placed,
               'threads_resolved', threads_resolved, 'topic_agreed_wins', topic_agreed_wins)
        from ranked where player_id = p_viewer_id
    ),
    -- May overlap "top" when the viewer is already near the front. The caller
    -- de-dupes by player_id rather than this function trying to be clever
    -- about the boundary and getting it wrong.
    'viewer_neighbors', coalesce((
      select jsonb_agg(jsonb_build_object(
               'rank', rank, 'player_id', player_id, 'display_name', display_name,
               'value', value, 'games_completed', games_completed, 'tiles_placed', tiles_placed,
               'threads_resolved', threads_resolved, 'topic_agreed_wins', topic_agreed_wins)
             order by rank)
        from ranked
       where player_id <> p_viewer_id
         and exists (select 1 from ranked v where v.player_id = p_viewer_id)
         and rank between
               (select rank from ranked v where v.player_id = p_viewer_id) - p_radius
               and (select rank from ranked v where v.player_id = p_viewer_id) + p_radius
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

comment on function public.leaderboard(text, uuid, int, int) is
  'Cross-player ranking by a cooperative-positive metric. Only players with '
  'at least one game are ranked. service_role only: see 0006.';

-- The PUBLIC-grant trap again. Revoke PUBLIC first, then name the grantee.
revoke all on function public.leaderboard(text, uuid, int, int) from public, anon, authenticated;
grant execute on function public.leaderboard(text, uuid, int, int) to service_role;
