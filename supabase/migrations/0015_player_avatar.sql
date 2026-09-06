-- 0015: a player can pick their own avatar, from a fixed set.
--
-- There is still no upload and no free-form image (see lib/avatar.ts): a
-- derived initials mark is the default for every player, and this column is
-- only an opt-in override of it. The nine emoji are the same set Point Taken
-- Heart already offers, so a player who has picked one there recognises the
-- choice here. The check constraint is the source of truth for the set;
-- lib/avatar.ts mirrors it as PLAYER_EMOJIS and must be kept in step by hand,
-- the same way lib/events/types.ts mirrors 0002_event_type_catalogue.sql.
--
-- Nullable, default null: a player who has never opened the picker keeps the
-- initials avatar, not a first entry chosen for them.
--
-- Safe to re-run.
alter table public.players
  add column if not exists avatar_emoji text;

alter table public.players
  drop constraint if exists players_avatar_emoji_check;

alter table public.players
  add constraint players_avatar_emoji_check
  check (avatar_emoji is null or avatar_emoji in (
    '👨🏻', '👩🏻', '👱🏻‍♂️', '👩🏻‍🦰', '👩🏽', '👨🏽', '🧑🏼', '👨🏾‍🦲', '👩🏾‍🦱'
  ));

comment on column public.players.avatar_emoji is
  'One of nine fixed emoji a player can choose as their avatar, or null to '
  'keep the derived initials mark. Same nine Point Taken Heart offers.';

-- The existing players_update_self policy already lets a player flip their
-- own row and nobody else''s, so no new policy is needed. Writes still go
-- through the service client in practice; the policy is the backstop.
