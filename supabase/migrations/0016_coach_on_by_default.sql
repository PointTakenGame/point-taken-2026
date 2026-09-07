-- The AI coach is on for a new player, not off.
--
-- Steve, 2026-09-07, reversing BRAIN-T260713-06. A new account is created by a
-- database trigger (0004_identity_and_games.sql: `insert into public.players
-- (id) values (new.id)`), so no application code ever passes coach_enabled and
-- this column default is the whole decision about what a first-time player
-- gets. Off by default meant the coach, which is most of what makes a first
-- game legible, only ever appeared for a player who went looking in Settings
-- for a feature they had never seen.
--
-- No backfill on purpose. Altering a default does not touch existing rows, and
-- it should not: an existing player with coach_enabled false either set it
-- there deliberately or has been playing without the coach long enough that
-- turning it on for them would be a surprise rather than a welcome.
alter table public.players alter column coach_enabled set default true;

comment on column public.players.coach_enabled is
  'Player has asked the AI coach to read their reasons. On by default since 2026-09-07 (Steve), reversing BRAIN-T260713-06.';
