-- All rights reserved. Copyright (c) 2025-2026 Experception LLC. pointtaken.social
--
-- Migration 0014: awards. What a player walked away with, in the log.
--
-- Until now the Gym's certificate, badge strip, ladder, points and card hand
-- were all read back out of the level script and out of an invented file
-- (lib/progression/sample.ts). That made the screens honest about being a
-- mock-up and dishonest about being progress: clearing a level wrote nothing
-- anywhere, so a player's account could not tell you what they had done.
--
-- These four types are that record. They are the only events written about a
-- player rather than about the board, and they are still ordinary game events:
-- each carries the actor_id of the player it belongs to, so an account's whole
-- award history is one indexed query over game_events and no join.
--
--   level_cleared         the rung, and the card it grants
--   badge_granted         one badge, with which time this is for that player
--   points_changed        a signed delta and the word for why
--   certificate_granted   the certificate, with the date it will keep saying
--
-- Two things they deliberately are not.
--
-- They are not a score against an opponent. Point Taken has no losing, so
-- there is no event here that says anyone lost, and points_changed goes
-- negative only for a stake a player chose to put down (the level 3 dare),
-- which is refunded by a second, positive points_changed when the claim is
-- repaired. A negative delta is never a punishment for being wrong.
--
-- They are not derived state. A projection could count a level as cleared by
-- looking at the board, but "cleared" is a decision with a date on it, made
-- once, by the server, at the moment the game ended. Recomputing it later from
-- a board whose rules have since changed would silently reissue or revoke
-- certificates that were already printed. So it is written down when it
-- happens, and the reader believes the log.
--
-- Idempotence is the writer's job, not the schema's: lib/gym/awards.ts
-- re-projects and returns early if the game already carries level_cleared, so
-- two clients ending the same game at once append once.
--
-- The application half is lib/events/types.ts (the four payload interfaces and
-- EVENT_TYPES) and lib/board/project.ts (BoardState.awards). CI asserts this
-- file and that one agree: lib/events/catalogue.test.ts.

insert into public.game_event_types (type, schema_version, description, payload_max_bytes) values
  ('level_cleared', 1,
   'A Gym level was cleared. level_id, and card_id for the rule card it grants (null if it grants none). Written once per game, by the server, when the game ends on a cooperative win.', 256),
  ('badge_granted', 1,
   'One badge earned. badge_id, and occurrence: 1 the first time this player earned it, 2 the second. The log keeps repeats so a reader can say how many times without the writer knowing.', 256),
  ('points_changed', 1,
   'A signed change to this player''s points. delta and reason, where reason is a stable word such as throw, dare_staked or dare_repaired. Negative only for a stake the player chose to put down.', 256),
  ('certificate_granted', 1,
   'The Certificate of Agreeable Disagreement for a level. level_id and issued_at, the date written down rather than derived so a reprint says the same thing.', 256);
