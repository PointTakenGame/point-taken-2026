-- 0007: whether a player wants the coach reading their reasons.
--
-- Per player, not per game. My coach reads my tiles and advises me; the other
-- side never sees it. That is why this is not in the event log: it is a display
-- preference, not something that happened in the game. What DOES reach the log
-- is the feedback itself (ai_feedback_returned), because the study cares which
-- games had coaching and what it said.
--
-- Default false. Steve expected the coach off until asked for (BRAIN-T260713-06,
-- where the old stack defaulted it on and surprised him). Off also means a fresh
-- player never pays for a model call they did not ask for.
--
-- Safe to re-run.
alter table public.players
  add column if not exists coach_enabled boolean not null default false;

comment on column public.players.coach_enabled is
  'Player has asked the AI coach to read their reasons. Off by default (BRAIN-T260713-06).';

-- The existing players_update_self policy already lets a player flip their own
-- row and nobody else''s, so no new policy is needed. Writes still go through
-- the service client in practice; the policy is the backstop.
