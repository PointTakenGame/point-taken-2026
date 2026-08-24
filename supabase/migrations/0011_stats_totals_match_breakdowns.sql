-- ---------------------------------------------------------------------------
-- 0011: make every headline number equal to the breakdown printed under it
-- ---------------------------------------------------------------------------
--
-- BRAIN-T260823-04. The account page shows "Threads resolved: 5" and then lists
-- how those threads ended. In 0005 the headline summed every `thread_resolved`
-- event while the list dropped any whose payload carried no emoji, so the two
-- could disagree and the page would be quietly, unaccountably wrong: a reader
-- sees a fifth thread that no row explains. `cards_thrown` and
-- `cards_thrown_by_id` had the identical split, so both are fixed here.
--
-- The rule this settles, applied to every pair in the function: a total and its
-- breakdown are computed from the same rows. Where a row is too malformed to
-- appear in the breakdown, it is left out of the total as well. A count nobody
-- can account for is worse than a count that is one short, because the short
-- count is at least internally honest and the log is still there to audit.
--
-- Neither payload can actually be malformed today: `emoji` and `card_id` are
-- required strings in lib/events/types.ts, and the only writer of
-- `thread_resolved` is `settleIfAgreed`, which passes the token that
-- `agreedToken` just returned. This is the arithmetic being made robust, not a
-- bug being observed. Nothing here validates payload shape as a constraint;
-- 0002 deliberately leaves shape to TypeScript and checks only the type name
-- and a byte cap.
--
-- One semantic change comes with it. `threads_resolved` used to count events
-- and now counts threads, deduplicated on (game_id, thread_root_id), keeping
-- the earliest by seq. Two clients can both read a thread as unresolved and
-- both append a close for it: the append lock serialises the writes but not the
-- reads before them, and `settleIfAgreed` guards on a board it read first. That
-- race writes one thread and two events, and a player who resolved four threads
-- should not be told they resolved five.

create or replace function public.player_stats(p_player_id uuid)
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
-- One row per thread, not per event, and only threads whose close says how it
-- ended. jsonb_typeof rather than `?`, because a key present with a json null
-- passes `?` and then reads back as SQL NULL, which is the case that split the
-- two numbers in the first place.
resolutions as (
  select distinct on (e.game_id, e.payload ->> 'thread_root_id')
         e.game_id,
         e.payload ->> 'thread_root_id' as thread_root_id,
         e.payload ->> 'emoji' as emoji
    from public.game_events e
    join mine m on m.game_id = e.game_id
   where e.type = 'thread_resolved'
     and jsonb_typeof(e.payload -> 'thread_root_id') = 'string'
     and jsonb_typeof(e.payload -> 'emoji') = 'string'
   order by e.game_id, e.payload ->> 'thread_root_id', e.seq
),
thrown as (
  select e.payload ->> 'card_id' as card_id, count(*) as n
    from public.game_events e
   where e.actor_id = p_player_id
     and e.type = 'card_thrown'
     and jsonb_typeof(e.payload -> 'card_id') = 'string'
   group by 1
),
flagged as (
  select card_id, count(*) as n
    from public.game_events e
    cross join lateral jsonb_array_elements_text(e.payload -> 'error_types') as card_id
   where e.actor_id = p_player_id
     and e.type = 'ai_feedback_returned'
     and jsonb_typeof(e.payload -> 'error_types') = 'array'
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
  'threads_resolved', (select count(*) from resolutions),
  'resolutions_by_emoji', coalesce(
    (select jsonb_object_agg(emoji, n)
       from (select emoji, count(*) as n from resolutions group by 1) t), '{}'::jsonb),
  'tiles_placed', coalesce((select n from acts where type = 'tile_placed'), 0),
  'cards_thrown', coalesce((select sum(n)::int from thrown), 0),
  'cards_thrown_by_id', coalesce(
    (select jsonb_object_agg(card_id, n) from thrown), '{}'::jsonb),
  'card_throws_declined', coalesce(
    (select n from acts where type = 'card_throw_declined'), 0),
  'coach_flags_by_id', coalesce(
    (select jsonb_object_agg(card_id, n) from flagged), '{}'::jsonb),
  'events_by_type', coalesce((select jsonb_object_agg(type, n) from acts), '{}'::jsonb),
  'first_game_at', (select min(joined_at) from mine),
  'last_game_at', (select max(joined_at) from mine)
);
$$;

comment on function public.player_stats(uuid) is
  'Account-page and cards-page counters derived from the event log. Acts credit '
  'the actor; outcomes credit every participant. Every total equals the sum of '
  'the breakdown beside it: see 0011. service_role only: see 0005.';

-- create or replace preserves the existing grants, but restate them so a reader
-- of this file alone cannot conclude the function is open.
revoke all on function public.player_stats(uuid) from public, anon, authenticated;
grant execute on function public.player_stats(uuid) to service_role;
