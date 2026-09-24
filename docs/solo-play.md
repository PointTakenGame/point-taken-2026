---
slot: solo-play.md
game: brain
purpose: The third way to play Brain, one human against a model opponent with the coach at the side, specified so it can be built without re-deciding what it is.
status: draft, unreviewed by Steve
sources:
  - docs/rules.md
  - docs/tech-spec.md
  - docs/roadmap.md
  - app/gym/actions.ts, lib/gym/boss-account.ts, lib/db/types.ts
---

# Solo play

**Marker key is in `docs/README.md`.** Read the marker before building against a
value. Most values here are `[vibecoded]`: this document exists to be corrected.

## 1. What it is

One human plays a full game of Brain against an opponent the model writes, on a
topic the human picks, with the coach reading the human's own reasons exactly as
it does in the Gym.

It is not a level. There is no script, no beat list and no boss character. The
opponent argues whichever side the human did not take, and the game ends through
the ordinary win conditions.

**It sits beside live play, not on the ladder** `[ruled, Gerrit; Steve's
confirmation outstanding]`. The ladder keeps meaning the four scripted levels.
Solo play is a third door on the profile's Live play card, next to starting a
room and joining one by code.

## 2. Why it exists

Live play needs two people at the same time, and the Gym teaches one card per
level on a fixed topic. Neither lets one person sit down at any hour and play a
whole game about something they actually disagree about. Solo play is the only
mode a pilot can rely on, which is the same reason the research study chose a
single human against a model co-player rather than human pairs.

## 3. The mode

`GameMode` is `"gym" | "live"` today `[unratified: lib/db/types.ts:16]`, and the
database enforces the same pair `[unratified:
supabase/migrations/0004_identity_and_games.sql:86]`. Solo play adds a third
value, `solo` `[vibecoded]`, with the same shape of constraint the other two
carry: no `join_code`, no `level_id`.

A solo game is an ordinary game in every other respect. The event log, the board
projection, the tile and token actions and the win conditions are unchanged, and
every move the human makes goes through `app/game/[gameId]/actions.ts` exactly as
it already does.

## 4. Seats

Two seats, the same as any game. The opponent is a real player row, seated
through `ensureBossAccount` the way a Gym boss already is
`[unratified: lib/gym/boss-account.ts]`, so nothing downstream has to learn about
a player that is not a row.

Its moves are appended with `source: "system"` and its own actor id, which is
what the Gym's `bossAct` already does. **No new event type and no new source**
`[vibecoded]`: a reader of the log can tell a solo game from a level by the mode
on the game, not by a different vocabulary in the events.

## 5. Choosing the topic and the side

The human picks both, through the same topic library and stance picker live play
uses. The opponent takes the other side, always, and holds no position of its
own `[ruled, Gerrit; Steve's confirmation outstanding]`.

That is the whole of the political-balance design. The opponent is never given a
stance to defend, only an instruction to argue against whatever the human chose,
so there is no side for it to lean toward and nothing to audit per topic.

## 6. Cards

**Both sides hold cards, and the hand is the cards the human has earned**
`[ruled, Gerrit; Steve's confirmation outstanding]`. A human who has cleared no
levels plays a game with no cards on either side; a human who has cleared all
four plays against an opponent holding all four.

This mirrors the live-play rule that a round holds only the cards both players
have earned, and it gives solo play a difficulty curve for free: training makes
the opponent sharper, not just the human.

The earned set is read with `readPlayerAwards`, the same call the ladder uses, so
the two can never disagree about what the human owns.

## 7. How the opponent plays

**Advanced play on popular topics** `[ruled, Gerrit; Steve's confirmation
outstanding]`. It argues well, it uses the rhetorical habits real people use, and
it is allowed to be imperfect.

**It concedes.** When the human's reason is complete and carries real evidence,
the opponent plays the point-taken token on it rather than pushing back
`[ruled, Gerrit; Steve's confirmation outstanding]`. This is the moment the mode
exists for: the game rewards making an argument that holds, not out-talking
somebody.

**It is not asked to commit specific errors** `[vibecoded]`. Heart tried a model
opponent instructed to commit exactly one named foul while staying in character
and kept authored scripts as the default because it would not do it reliably.
Solo play asks for something easier: argue well, and let the coach react to what
the human writes rather than staging mistakes for the human to catch.

GAP: how strong is "advanced"? An opponent that wins every exchange teaches
nothing and is unpleasant; one that folds on contact is not worth playing.
Nobody has said where between those it should sit, and it is not a number this
document should invent. Answer from the first playtest, not from theory.

## 8. The opponent's turn

A sibling of `bossAct`, with the same idempotence: re-read the board, act only if
it is the opponent's turn and nothing has been appended for it yet, so a client
that fires twice appends once `[unratified: app/gym/actions.ts:181]`.

The difference is where the move comes from. `bossAct` reads the next beat from a
script; the solo action asks the model for it. Two calls rather than one
`[vibecoded]`, following the study's co-player pipeline: one call chooses the
move (which thread, rebut or concede, whether to throw a card), a second writes
the words. One call tends to produce either a sensible move or good prose.

## 9. The coach

Unchanged, and present `[vibecoded]`. It reads the human's own reasons after they
land, exactly as in the Gym, and says nothing about the opponent's.

This does not touch the ruling that live play carries no coach nudges: solo play
is practice, not a match between two people.

The coach's own specification is `docs/coach.md`.

## 10. Limits

Every exchange costs two model calls for the opponent plus one for the coach, so
a solo game is roughly three times a Gym level's spend. Two limits, both
`[vibecoded]`:

- A turn limit per solo game, so one abandoned tab cannot run indefinitely.
- A spend cap on the key, as the backstop.

GAP: the numbers for both. They depend on what a finished solo game costs, which
nobody has measured yet. Measure one game, then set them.

## 11. Build order

Each step ends with something playable, which matters when the work changes
hands.

1. The migration and the third mode.
2. Opening a solo game: seats, topic, side, board on screen, with the opponent
   replying with a fixed placeholder line.
3. The opponent's real turn: the two-call pipeline, rebuttals only.
4. Cards in the opponent's hand, gated by what the human has earned.
5. Concede.
6. The turn limit and the cap.

## 12. Not in this mode

- No coach for the opponent. Nothing reads the model's own reasons.
- No scripted beats, no boss character, no badge or certificate of its own
  `[vibecoded]`. GAP: whether a solo game earns points at all is unanswered.
- No second human. This is not a route to pair play.
