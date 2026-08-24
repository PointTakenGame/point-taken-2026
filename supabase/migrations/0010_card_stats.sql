-- ---------------------------------------------------------------------------
-- 0010: how a player has used each card, added to player_stats
-- ---------------------------------------------------------------------------
--
-- The cards page needs three numbers per card, and all three are already in the
-- log, so nothing new is stored. `create or replace` on 0005's function rather
-- than a second function: the account page and the cards page want one round
-- trip between them, and two functions over the same events would drift.
--
-- The same attribution rule as 0005 applies, and it is worth restating because
-- it decides what each of these three means:
--
--   cards_thrown_by_id      you threw this card at the other player's reason.
--                           An act, credited to the actor.
--   card_throws_declined    you were offered a throw and passed on it. Also an
--                           act, and deliberately counted rather than hidden:
--                           declining is a move in this game, not an absence.
--   coach_flags_by_id       your own coach raised this card about your own
--                           reason. Private by construction: the log tags the
--                           reading with the player it was for, and 0008 keeps
--                           the other side from reading it.
--
-- coach_flags_by_id reads `error_types`, which is a jsonb array of card ids,
-- because the coach's whole vocabulary is the card set (lib/coach/cards.ts). A
-- coach that invented its own categories would put a key in here that no card
-- page could name, which is the drift the guard below is for: rows whose
-- error_types is not an array are skipped rather than crashing the function,
-- since a stats call is not the place to discover a malformed payload.
--
-- Nothing here enumerates the four cards. The rules package owns that list and
-- it is not settled, so this counts whatever ids the log holds and the page
-- decides which ones it has a card for.

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
resolutions as (
  select e.payload ->> 'emoji' as emoji, count(*) as n
    from public.game_events e
    join mine m on m.game_id = e.game_id
   where e.type = 'thread_resolved'
   group by 1
),
thrown as (
  select e.payload ->> 'card_id' as card_id, count(*) as n
    from public.game_events e
   where e.actor_id = p_player_id
     and e.type = 'card_thrown'
     and e.payload ? 'card_id'
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
  'threads_resolved', coalesce((select sum(n) from resolutions), 0),
  'resolutions_by_emoji', coalesce(
    (select jsonb_object_agg(emoji, n) from resolutions where emoji is not null),
    '{}'::jsonb),
  'tiles_placed', coalesce((select n from acts where type = 'tile_placed'), 0),
  'cards_thrown', coalesce((select n from acts where type = 'card_thrown'), 0),
  'cards_thrown_by_id', coalesce(
    (select jsonb_object_agg(card_id, n) from thrown where card_id is not null),
    '{}'::jsonb),
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
  'the actor; outcomes credit every participant. service_role only: see 0005.';

-- create or replace preserves the existing grants, but restate them so a reader
-- of this file alone cannot conclude the function is open. The PUBLIC-grant
-- trap from 0005 still applies: revoke from public, then name the grantee.
revoke all on function public.player_stats(uuid) from public, anon, authenticated;
grant execute on function public.player_stats(uuid) to service_role;
