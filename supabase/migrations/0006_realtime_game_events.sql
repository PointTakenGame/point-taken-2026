-- 0006: let a player's browser hear its own game.
--
-- 0004 wrote the read policy (game_events_read_member) and granted select to
-- authenticated, and its comment says that line is what lets a client subscribe.
-- It is necessary but not sufficient. Realtime only forwards changes for tables
-- in the supabase_realtime publication, and no migration ever added this one, so
-- a subscription connects, reports SUBSCRIBED, and then stays silent forever.
-- That failure mode is worth naming because it looks exactly like a working
-- subscription on a quiet board.
--
-- Safe to re-run: adding a table already in the publication raises 42710.
do $$
begin
  alter publication supabase_realtime add table public.game_events;
exception
  when undefined_object then
    -- No publication yet, on a database Supabase Realtime has never touched.
    raise notice 'supabase_realtime does not exist; skipping';
  when duplicate_object then
    raise notice 'game_events already published; skipping';
end
$$;

-- RLS still decides who hears what: Realtime evaluates the select policy per
-- subscriber, so a player only receives events for games they are in. Nothing
-- here widens read access, and no write path is opened. Inserts are all that
-- ever happen on this table, so the default replica identity is enough.
