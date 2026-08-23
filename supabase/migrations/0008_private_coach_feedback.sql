-- 0008: a coach reading is visible only to the player it was written for.
--
-- The coach is personal. My coach reads my reasons and tells me what it thinks;
-- the other side is not shown it and should not be able to find it either. The
-- board only renders a player their own readings, but the UI is a promise and
-- RLS is enforcement, and this project's whole stance is that the database says
-- no rather than the app remembering to.
--
-- Realtime respects RLS, so this also stops the opponent's subscription from
-- waking on a reading that is none of their business.
--
-- The convention this bends: 0001 says actor_id is null for server-generated
-- events. Coach readings now carry the recipient's id instead, because "who is
-- this for" has to be a column for a policy to read it. Everything else written
-- by the server still uses null.
--
-- Safe to re-run.
drop policy if exists game_events_read_member on public.game_events;

create policy game_events_read_member
  on public.game_events for select to authenticated
  using (
    public.is_game_member(game_id)
    and (
      type not in ('ai_feedback_returned', 'ai_feedback_shown')
      or actor_id = (select auth.uid())
    )
  );

comment on policy game_events_read_member on public.game_events is
  'Members read their game. Coach readings are further limited to the player '
  'they were written for: actor_id on those rows is the recipient.';
