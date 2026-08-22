-- 0003: let the server read the log it writes.
--
-- 0001 shut game_events down hard: RLS on with no policies, and all privileges
-- revoked from anon and authenticated. It never granted anything back to
-- service_role, because at that point nothing read the table. Writes worked
-- anyway: append_game_event and append_game_events are SECURITY DEFINER and run
-- as the owner, so the missing grant stayed invisible until the first reader.
--
-- Found by the first real reader, in the Next port: a select on game_events as
-- service_role returns 42501, permission denied. Every projection, replay,
-- badge criterion and export starts with that select.
--
-- SELECT only, on purpose. INSERT would let a caller write a row without going
-- through the append functions, and the seq assignment those functions do under
-- a per-game advisory lock is the whole ordering guarantee. One write path.
-- UPDATE and DELETE stay off for the same reason 0001 blocks them: append-only.

grant select on public.game_events to service_role;

-- The catalogue already had this from 0002; restated so the two tables the
-- server reads are granted in one visible place.
grant select on public.game_event_types to service_role;

-- anon and authenticated are untouched: still no grants, still no RLS policy,
-- and they stay that way until the games table exists to scope a read policy to
-- the players actually in a game.
