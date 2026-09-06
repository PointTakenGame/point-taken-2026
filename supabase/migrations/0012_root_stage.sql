-- All rights reserved. Copyright (c) 2025-2026 Experception LLC. pointtaken.social
--
-- Migration 0012: the root stage, as a number the game carries rather than a
-- rule the code assumes.
--
-- The rule: no tile may hang off another tile until the board has its opening
-- thread roots down. A game starts by putting the main branches of the
-- disagreement on the table, and only then goes into one of them. It is four
-- roots in a live game and in gym levels 2 and up, and two in gym level 1,
-- which is the level whose whole job is to teach what a thread is.
--
-- The number lives in game_started's payload, because it is a rule the game
-- was started under and not a property of the mode: a gym game and a live game
-- are the same game played under different numbers, and reading it off `mode`
-- would put the rule in two places the first time a live room wants three.
--
-- That is a shape change to an existing payload, so game_started versions to 2
-- rather than being edited in place. Version 1 rows stay exactly as written and
-- keep projecting; lib/board/project.ts folds both versions and reads a missing
-- root_target as the live target of four, which is what those games were
-- actually played under.
--
-- The application half is lib/events/types.ts (GameStartedPayload,
-- EVENT_TYPES.game_started) and lib/board/rules.ts (canPlaceTile). CI asserts
-- this file and that one agree: lib/events/catalogue.test.ts.

insert into public.game_event_types (type, schema_version, description, payload_max_bytes) values
  ('game_started', 2,
   'Play begins. card_set, coach, and root_target: how many thread roots the board opens with before any tile may hang off another. Version 1 lacked root_target and reads as four.', 2048);
