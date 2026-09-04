-- All rights reserved. Copyright (c) 2025-2026 Experception LLC. pointtaken.social
--
-- Migration 0013: a player row says whether there is a person behind it.
--
-- A Gym boss sits in a real seat. `player_joined` carries an actor_id with a
-- foreign key through public.players to auth.users, and the game_players
-- trigger refuses a seat without one, so Bashful Bob has been a human-shaped
-- row with a script behind him since the first level shipped
-- (lib/gym/boss-account.ts). Nothing in the schema said so, which meant every
-- player-facing list had to remember not to count him, and the leaderboard did
-- not.
--
-- `kind` is that fact, written down once. 'human' is the default and every
-- existing row is one except the bosses, which are backfilled below off the
-- metadata their auth users were created with.
--
-- What this migration deliberately does NOT do: remove the boss's auth user.
-- Steve's 2026-09-03 ruling allowed it if the trigger could accept a system
-- actor without one, and it cannot without changing what public.players.id
-- references, which is the identity spine of every RLS policy in 0004 and 0009.
-- That is a bigger change than one night, so the boss keeps his auth user: no
-- password, an undeliverable address, and now a row that says what he is.

alter table public.players
  add column kind text not null default 'human'
    check (kind in ('human', 'boss'));

comment on column public.players.kind is
  'human | boss. A boss is a scripted Gym opponent with a real seat and no '
  'person behind it. Excluded from the leaderboard and from every '
  'player-facing roster; still named as your opponent in your own history, '
  'because that is who you played.';

-- The bosses already seated. `gym_boss` is the user_metadata key
-- ensureBossAccount creates them with, and it is the only marker that survives
-- independently of this codebase's id derivation.
update public.players p
   set kind = 'boss'
  from auth.users u
 where u.id = p.id
   and u.raw_user_meta_data ? 'gym_boss';

-- The leaderboard reads the roster out of game_players and then filters by
-- kind, so this index is what keeps that filter from being a full scan once
-- there are more players than bosses, which is every day after the first.
create index players_kind_idx on public.players (kind) where kind <> 'human';
