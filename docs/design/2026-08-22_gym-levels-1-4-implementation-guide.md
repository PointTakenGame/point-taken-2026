---
tid: BIZ-T260822-07
authoring_task: BIZ-T260819-15
type: spec
thread: roadmap-consolidation
owner: biz
date: 2026-08-22
status: active
audience: point-taken-brain (build), Rannie and Audrey (design)
supersedes: point-taken-brain/docs/reference/materials/roadmap-consolidation/2026-08-04_level-build-table.md (levels 1-4 only)
built_from:
  - point-taken-biz/docs/reference/2026-08-18_gym-levels-1-4-nathan-revision-2.md (Revision 2)
  - 2026-08-04_level-build-table.md
  - decisions BIZ-T260819-06, -09, -16, -17, BIZ-T260822-03, -04, -05
  - decisions BIZ-T260823-65 through -72 (Steve's 2026-08-23 rulings, see §10.1)
---

# The Gym: Levels 1-4 Implementation Guide

This is the build document for the first release of the Gym, the Point Taken
levels ladder. It replaces the levels 1-4 half of
`2026-08-04_level-build-table.md`, which is stale in six specific places listed
in §9. Levels 5 and up stay in the build table and are untouched here.

## 0. How to read this

**It is a data drop, not a patch.** Nothing in this document should be
hand-transcribed into brain's tree as prose. Everything that the game reads at
runtime belongs in the ladder config (§1) and in a per-level script table; the
level scripts below are the authored content for those tables. Biz owns this
file and the PDF conversion of it. Brain owns the config schema, the loader, and
every line of code that consumes it.

**The strings are configuration, not rules to encode.** Brain's own framing,
adopted here: assume any string in this document, level names, coach names,
boss names, card names, point values, can change at any time. Nothing below
should end up in a `switch` statement or a class name.

**One warning that comes with that.** If point values live in config and totals
are a recomputable cache, editing a value restates every player's history on the
next recompute. The recommendation for the first release is to accept that
rather than build config versioning. Steve has not objected; it is not a blocker,
and §10 keeps it visible.

**Punctuation.** No em dashes anywhere in Point Taken copy. Nathan's draft used
them heavily and every quoted line below has been repunctuated. The words are
his.

**Naming.** The mode is the **Gym**. It was called the Dojo and was renamed on
2026-08-16 (`BRAIN-T260816-18`). Nathan's draft is titled "Dojo" and the Figma
frames still say Dojo (`BIZ-T260819-04`). Gym and Dojo were never two modes.
The real pair is practice, now the Gym, versus live play against a human.

**Political neutrality.** The four topics were chosen to be morally weightless or
purely definitional: a food category, a clock convention, restaurant pay, and
labeling. Neutrality here is achieved by avoiding charged material rather than
by balancing it, so no counterpart examples are owed. Any later substitution of a
topic re-opens that obligation.

---

## 1. The ladder config object

Brain asked for a per-level object carrying `id`, `displayName`, `ruleCardId`,
`coachId`, `topicId`, `pointsScope`, `fastForward`, and an `awards` list of
`{trigger, badgeId, points}`. That shape works with three amendments, all
flagged in §1.3.

### 1.1 The four levels

```json
[
  {
    "id": "L1",
    "displayName": "Onboarding",
    "ruleCardId": "you_is_taboo",
    "coachId": "$account.coachId",
    "topicId": "hot-dog-sandwich",
    "bossId": "bashful-bob",
    "threadCount": 2,
    "pointsScope": "none",
    "fastForward": { "enabled": false },
    "awards": [
      { "trigger": "beat:L1.1",  "badgeId": "mutual-respect",       "points": 0 },
      { "trigger": "beat:L1.1",  "badgeId": "honest-thinking",      "points": 0 },
      { "trigger": "beat:L1.1",  "badgeId": "shared-facts",         "points": 0 },
      { "trigger": "beat:L1.10", "badgeId": "resolve-first-thread", "points": 0 },
      { "trigger": "beat:L1.12", "badgeId": "call-broken-rule",     "points": 0 },
      { "trigger": "beat:L1.17", "badgeId": "finish-one-game",      "points": 0 }
    ]
  },
  {
    "id": "L2",
    "displayName": "Ground rules",
    "ruleCardId": "stick_to_root",
    "coachId": "$account.coachId",
    "topicId": "clock-changes",
    "bossId": "rambling-rosa",
    "threadCount": 4,
    "pointsScope": "personal",
    "fastForward": { "enabled": false },
    "awards": [
      { "trigger": "beat:L2.3",       "badgeId": "compression",    "points": 0 },
      { "trigger": "beat:L2.5.throw", "badgeId": "stick-to-root-1", "points": "THROW_POINTS" },
      { "trigger": "beat:L2.7.throw", "badgeId": "stick-to-root-2", "points": "THROW_POINTS" },
      { "trigger": "beat:L2.9.throw", "badgeId": "stick-to-root-3", "points": "THROW_POINTS" }
    ]
  },
  {
    "id": "L3",
    "displayName": "Claim size",
    "ruleCardId": "no_exaggeration",
    "coachId": "$account.coachId",
    "topicId": "tipping-vs-wages",
    "bossId": "braggy-brenda",
    "threadCount": 4,
    "pointsScope": "personal",
    "fastForward": { "enabled": true, "grantsCard": true, "grantsCertificate": false },
    "awards": [
      { "trigger": "beat:L3.4.throw",  "badgeId": "no-exaggeration-1", "points": "THROW_POINTS" },
      { "trigger": "beat:L3.6.throw",  "badgeId": "no-exaggeration-2", "points": "THROW_POINTS" },
      { "trigger": "beat:L3.8.repair", "badgeId": "no-exaggeration-3", "points": 0 },
      { "trigger": "beat:L3.9.send",   "badgeId": null,                "points": "-THROW_POINTS" },
      { "trigger": "beat:L3.9.repair", "badgeId": "no-exaggeration-3", "points": "THROW_POINTS" },
      { "trigger": "beat:L3.10.throw", "badgeId": null,                "points": "THROW_POINTS" }
    ]
  },
  {
    "id": "L4",
    "displayName": "Clarity",
    "ruleCardId": "help_me_understand",
    "coachId": "$account.coachId",
    "topicId": "ai-content-labeling",
    "bossId": "sloppy-salma",
    "threadCount": 4,
    "pointsScope": "personal",
    "fastForward": { "enabled": true, "grantsCard": true, "grantsCertificate": false },
    "awards": [
      { "trigger": "beat:L4.4.throw", "badgeId": "help-me-understand-1", "points": "THROW_POINTS" },
      { "trigger": "beat:L4.6.throw", "badgeId": "help-me-understand-2", "points": "THROW_POINTS" },
      { "trigger": "beat:L4.7.throw", "badgeId": null,                   "points": "THROW_POINTS" }
    ]
  }
]
```

### 1.2 Two award events, not one

Finishing a level grants two things and they are separate events
(`BIZ-T260819-16`):

```json
{
  "onLevelComplete": [
    { "event": "card.granted",        "cardId": "<ruleCardId>" },
    { "event": "certificate.granted", "levelId": "<id>" }
  ],
  "onLevelFastForward": [
    { "event": "card.granted",        "cardId": "<ruleCardId>" }
  ]
}
```

A fast-forwarded level therefore leaves a visible gap on the certificate wall
and no gap in the player's card set. That gap is intended pull, not a bug. Live
play sees a fast-forwarder as holding the card, because the live-play card set
keys off cards **earned**, not certificates held. Brain owes a check of phase 1.4
against exactly that in two places, the award pass and the least-common-denominator
card set (`BIZ-T260819-22`).

**Event type names, settled 2026-08-24 (`BIZ-T260824-08`).** The event catalogue
is a closed set of 28 snake_case single-token types enforced by the database, so
`card.granted` as written above was never expressible. Brain's proposed names are
adopted as-is: **`card_granted`, `certificate_granted`, `badge_granted`,
`points_adjusted`.** Adding them is a migration, and it is brain's to schedule.

`points_adjusted` is the one that is not cosmetic and it was brain's catch. L3.9
visibly docks `THROW_POINTS` and refunds it. A log carrying only "granted" events
cannot replay that honestly, and the whole scoring model is replay-derived, so the
dock has to be an event like everything else.


### 1.3 The three amendments to the requested shape

1. **`pointsScope` needs a third value, `"none"`.** Brain asked for
   `'personal' | 'shared'`. Level 1 has no score at all; the score is introduced
   at level 2. `"shared"` is unused in the first release and arrives at level 5
   with Steel Man (`BIZ-T260819-17`).
2. **`coachId` is not a level property.** The coach is picked once at L1.0 and
   stands at the side of the board for all four levels, so it lives on the
   account and the level reads it. Written above as `$account.coachId` to make
   that explicit; the real field name is brain's call. **Settled
   (`BIZ-T260823-68`): the coach belongs to the account, not to the game, and
   the player can change it later in profile settings.** Two consequences.
   The profile page needs a coach control, which is added to §8. And changing
   the coach changes it everywhere at once, including in levels already
   finished; there is no per-game snapshot of who coached you.
3. **`points` is a named constant, not a number.** `THROW_POINTS` is the value of
   one correct card throw. **`THROW_POINTS = 10` (`BIZ-T260823-65`).** It must
   still be settable in one place, because every points figure in the first
   release is either `THROW_POINTS`, `-THROW_POINTS`, or `0`. Nothing in levels
   1-4 needs a second magnitude. Level 3's dare therefore docks 10 and refunds
   10.

4. **Two id conventions, on purpose (`BIZ-T260823-66`, amended by
   `BIZ-T260824-07`).** The exception is **ids already written into shipped event
   payloads**, which is card ids and also the three signing-line ids
   (`mutual_respect`, `honest_thinking`, `shared_facts`). Card ids are
   `snake_case`, because they are already shipped that way in
   `lib/coach/cards.ts` and `lib/board/setup.ts` and are baked into every
   `game_started` payload's `card_set.card_ids`. Changing them after the first
   real game is a data migration, so the code wins and this document was
   corrected to match. Every other id in the config, badges included, is
   `kebab-case`. That split is deliberate and is not a bug to be tidied later:
   `"ruleCardId": "no_exaggeration"` sitting next to `"badgeId":
   "no-exaggeration-1"` is correct.

   **Amendment, 2026-08-24 (`BIZ-T260824-07`).** Brain pointed out that the
   original wording said "card ids" when the reason given was "already in shipped
   payloads", and the three signing-line ids meet that reason word for word: same
   file, same snake_case, same already-played games. Read literally the ruling
   made them wrong and fixing them would break history. The exception is therefore
   the reason, not the category: **an id already written into a shipped event
   payload keeps its casing.** Everything else is `kebab-case`.

`trigger` values are beat ids from the level scripts in §3 to §6. That works
because these are cooked games with a fixed script. Live play needs the general
event names instead, which live in
`point-taken-brain/web/point-taken-backend/src/models/Progression.ts` and are out
of scope here.

Badges are re-earnable and count correctly, via
`badgeRecordType(badgeId, sourceGameId, sourceEventSeq)` in that same file.

> **Correction, 2026-08-24 (`BIZ-T260824-13`).** "No change needed" was wrong.
> Everything the two paragraphs above point at, and everything §8 assumes about
> points, badges, certificates and streaks, lives in DynamoDB inside the Express
> backend being retired. Brain checked (`BRAIN-T260823-41`): the governing spec
> `BRAIN-T260817-11` names DynamoDB five times and Postgres zero times, and the
> rebuild's players table carries an explicit comment saying progression totals
> deliberately do not live there. **Read every "already exists" in §1.3 and §8 as
> "exists in the stack we are turning off."**
>
> **What this is not is a surprise.** Steve's ruling: the rebuild is an entire new
> database, so all of this has to be built either way, and there is no difference in
> cost between a guide that said "build it" and a guide that said "no change needed".
> Only the sentence was wrong, not the plan. This is the rebuild doing what the
> rebuild is for, and it does not block anything.
>
> **What it does carry is an expectation.** Steve, same ruling: brain is expected to
> harvest the retired stack rather than reimplement it. The database is new; the game
> logic inside it is years old and settled, and rewriting settled logic invents new
> bugs in solved problems. Tracked as `BIZ-T260824-17`.
>
> One detail travels with the port: the old counters use the field name
> `snitchCatches`. §8 rules that phrase dead, so the port renames it rather than
> carrying it across.

---

## 2. Cross-cutting rules

> ### ⭐ The rule above all of these
>
> **A tile must make the thread root more or less likely to strengthen or weaken
> support for the topic.**
>
> That is Steve's formal definition of a legal move, given on 2026-08-23 and
> recorded as `BIZ-T260823-77`. It is not a style guideline and not one check
> among nine. It is what makes a tile belong on the board at all, and everything
> the coach does sits downstream of it.
>
> Three things follow. It lets the coach reject a tile without ever adjudicating
> whether the world is actually that way, which is the line the whole
> surfaced-versus-logged split was drawn on. It is why whataboutism needs no
> detector of its own: a tile that changes the subject fails this test by
> construction (`BIZ-T260823-76`). And it is the sentence to reach for when
> someone argues about whether a particular check should exist, because most of
> those arguments dissolve once the question is re-asked as *does this tile bear
> on the root*.

### 2.1 One cooked game per level, and it is the boss game

There is one cooked game per level and it **is** that level's boss game. The
level's card is taught inside it. There is no separate onboarding game and no
separate boss fight.

That settles what a boss is. A boss has no personality-driven habit of its own:
**a boss commits exactly the violations its level teaches, and nothing else.**
The character is voice and face, the behaviour is the level's syllabus. So the
boss name reads as the card. Ratified by Steve on 2026-08-19 (`BIZ-T260819-06`).

| Level | Boss | Why this one |
|---|---|---|
| 1 | 🧑🏻‍💼 **Bashful Bob** | Conflict-averse and slow to commit, which is what makes him never volunteer a resolution token, and makes his one "you" slip read as nervous deflection rather than attack |
| 2 | 🧑🏿‍🔧 **Rambling Rosa** | Rambling *is* wandering off the thread's root. The name is the card |
| 3 | 🧑🏼‍🔬 **Braggy Brenda** | Braggy *is* exaggeration. The name is the card |
| 4 | 🧑🏾‍🍳 **Sloppy Salma** | Sloppy *is* unpinned wording. The name is the card |

Parked for levels 5-8: 🧑🏼‍🌾 Kranky Karl, 🧑🏻‍🏫 Twisty Thibault, 🧑🏾‍🎤 Cagey
Chandni, 🧑🏿‍🎨 Hasty Hakeem, and 🧑🏽‍🚀 Bao. Karl's row in the build table
encodes the opposite rule, two cards at once, unannounced, re-testing an earned
habit, so it needs rewriting rather than renaming when it comes back.

The cast's skin tones are deliberately uncorrelated with name origin. An artist
must not "fix" the scatter. **Gap carried forward from the build table:** no
Indigenous, Native American, or First Nations character exists in the roster.

### 2.2 Three voices

**The boss is across the board.** Every scripted opponent tile in this document
is played by the boss.

**🧘 The coach never plays a tile.** Chosen at L1.0, at the side of the board for
all four levels, and does four things and only four:

1. **Nudges.** When a violation goes unanswered for a turn: hint hint, there is a
   card for this. Never names the tile or the card.
2. **Dares.** Level 3 only. Asks the player to commit a violation on purpose,
   with the tile pre-typed for them.
3. **Points at what just happened.** The short "notice this" lines after a repair
   lands.
4. **Reads your draft before you post it, and names the card an opponent could
   throw at it.** Added 2026-08-24 (`BIZ-T260824-24`). See below.

**The fourth job: the coach as a rule-card mirror.** Before you commit a tile, the
coach runs the cards you have already earned against your own draft and tells you
which one you just handed your opponent. It plays the co-player a generous human
would be: it catches the word "you," it catches a question you meant as a claim, it
catches the uncharitable reading of the other side. Three rules hold it in place:

- **It names the card, it does not rewrite the tile.** "An opponent could throw
  🙅 'You' is Taboo at this," with the word highlighted. The player makes the edit.
  This is why job 4 does not violate "never plays a tile": the coach is pointing,
  not authoring. A version that hands back finished prose would make the coach a
  co-author and would make 🎭 Steel Man at level 5 a card the machine already plays
  for you.
- **Gym only. Off in live play.** The gym is where you learn the cards; live play is
  where you are tested on them. If the coach pre-fixed every tile in a live game, no
  card would ever land, and Cards Landed (§8.1) is the profile stat that measures
  whether any of this worked.
- **Only cards the player has already earned.** At level 2 the coach can catch 🙅 and
  🎯 and nothing else. Its hand grows exactly as the player's does, so it never
  demonstrates a move that is not yet playable.

Rannie drew an early version of this on the play board as "AI Coach / HOW TO MAKE IT
STRONGER / TRY THIS VERSION" with an on/off toggle. The panel is right, the buttons
are wrong: they hand back rewritten text. Retarget them to name the card.

The coach's role escalates deliberately. L1 explains everything. L2 explains the
card and nudges. L3 plants one idea early, then dares. L4 sets up the first rung
and then goes quiet, because level 5 has a real person on the other side of it.

**The moderator is the third voice.** A neutral system channel that enforces
board rules at write time, a question written as a tile, a self-response. It is
not a character, has no avatar, and earns nothing.

Coach picks are cosmetic and tonal only, carried as a persona parameter:
🏋🏽 Drill-Sergeant Dev, 🙇🏻 Patient Pia, 🏃🏾 Peppy Paz.

### 2.3 Four nugget types

| Type | What it is | Throwable | Earnable |
|---|---|---|---|
| `card` | A rule card. Bold, thrown at a tile | yes | yes |
| `badge` | A record that something happened | no | yes |
| `rung` | A graded step inside one card. Shares the card's icon plus a numeral | via its card | yes |
| `rule` | Board law, moderator-enforced at write time | no | no |

Rungs share one icon with a numeral: 🎯1 / 🎯2 / 🎯3, and the same for ✍️1-3.

### 2.4 The card list, named for the good move

Every card in Point Taken is named for the good move, never for the fallacy, and
the card name **is** the sixth-grade term. The formal term is reference material,
never the label.

*Updated 2026-08-24 (`BIZ-T260824-18`).* This section used to say Rannie's Figma
frames needed relabeling because they named each card for the fallacy. A full
scrape of her board on 2026-08-24 shows she has largely already done it: Stick to
the Root, Help Me Understand, No Exaggeration, Who Would Know?, and What Else Has
To Be True all name the move. One fallacy-name remained, "Cherry Picking," and one
label is a family rather than a card, "Stay on the Thread 🧭," which is the family
holding 🎯 Stick to the Thread's Root.

*Cherry Picking resolved 2026-08-24 (`BIZ-T260824-21`).* Steve delegated the rename
to biz. 🍒 is now **"Show Me the Rest."** The move is asking for the evidence that
was left out, and the phrasing deliberately rhymes with 💬 Help Me Understand, since
both cards hand a request back to the author instead of accusing them. It sits in the
🔬 "Not enough to go on" family at tier 2 and is not in the first release, so nothing
in levels 1 through 4 changes. Alternates considered and rejected: "The Whole Basket"
(keeps the 🍒 icon literal but reads as a metaphor a sixth grader has to decode) and
"Count the Misses" (accurate, but it points at the opponent's failure rather than at
what you want next).

| Card | Name (the label) | Formal term (reference only) | Level |
|---|---|---|---|
| 🙅 | "You" is Taboo | ad hominem | 1 |
| 🎯 | Stick to the Thread's Root | whataboutism, red herring, irrelevance | 2 |
| 📏 | No Exaggeration | overgeneralization plus exaggeration | 3 |
| 💬 | Help Me Understand | lack of clarity | 4 |

Four cards in the first release, not five. 📖 Define That is **no longer a card**:
demoted on 2026-08-15 to rung 2 of Help Me Understand, keeps its 📖 icon, loses
its own throw.

A rule card is three things at once: something you take away, a subset of badges,
and an action inside the game, which is to say the set of allowable calls.

The full 4x3 grid stays as the build table has it. The families are what a card
asks of the other player:

| | 💛 Play fair | 🧭 Stay on the thread | 📌 Pin it down | 🔬 Not enough to go on |
|---|---|---|---|---|
| 1 | 🙅 | 🎯 | 📏 | 🕳️ |
| 2 | 💬 | ✂️ | ✅ | 🍒 |
| 3 | 🎭 | 🧊 | 🎓 | 🔗 |

Eleven real cards plus one placeholder, 🕳️ Burden of Proof, which is unlevelled.
**The level tags printed in the build table's copy of this grid are the
pre-reorder mapping and are stale for levels 1-4.** The mapping in this document
is the live one.

Governing principle for 💬, which no script line may break: **you never show
someone their writing was unclear by saying "that was unclear."** You hand back a
reading.

### 2.5 Points

**No points on level 1.** The score does not exist yet. Level 1's card throw
earns the 🃏 badge and nothing else, so level 1's only feedback is badges.

**Personal points from level 2 through level 4.** Communal points are cut from
these levels entirely and arrive with 🎭 Steel Man at level 5
(`BIZ-T260819-17`).

**Points are for catching, not for writing.** Nothing the player writes scores.

**One place points move backwards: level 3's dare.** Sending the dared
overstatement docks the score by exactly `THROW_POINTS`, and repairing it refunds
exactly that. Net zero. Detail at L3.9.

📏3 pays a badge and no points on both paths. That is deliberate: nobody can
inflate on purpose to farm the repair.

### 2.6 The signing ritual: three items

Three lines, each with one checkbox and one badge, all three earned in the
player's first game at L1.1 (`BIZ-T260822-04`).

| Line | Family | Badge |
|---|---|---|
| Play fair | 💛 | ✍️1 Mutual Respect |
| Stay on the thread | 🧭 | ✍️2 Honest Thinking |
| Pin it down | 📌 | ✍️3 Shared Facts |

**Nathan's draft still lists four items at L1.1** ("We're on the Same Team,
Mutual Respect, Honest Thinking, Shared Facts"). Three is the ruling. Rannie's
fourth line is folded into Mutual Respect and "I'll control my emotions" is cut.

🔬 Not enough to go on has no agreement line and that is not an oversight:
conduct can be promised up front and evidence quality cannot.

Ritual, not points. 🧘 signs first.

### 2.7 Fast-forward

Levels 3 and 4 only. A fast-forward earns the rule card and **not** the
certificate (`BIZ-T260819-16`).

Build order matters here: **build the full level first, then scale back**, so the
short path is a strict subset of the long one. Do not build two paths.

### 2.8 Player tiles are suggested, not free

At every player turn the box is pre-loaded with two suggestions plus
write-your-own. The scripts below assume the **first** suggestion, and where a
different choice would break the boss's next line a fallback is given. Fallback
lines answer the **thread** rather than the tile, which is why the write-your-own
path degrades gracefully.

Recommendation, from Nathan's Appendix B: suggestions everywhere on levels 1 and
2; suggestions only on the beats that matter, the violation setups and the
resolutions, with free text elsewhere on levels 3 and 4. By level 3 the player has
written a dozen tiles and should not still be picking from a menu, and the
violations are the boss's tiles anyway.

**One exception and it matters: level 3's suggested root tiles must stay
suggested.** The baited quantifier in each pair is what makes L3.8, the good path
into rung 3, fire for most players. Free-text roots there and most playthroughs
fall through to the dare.

### 2.9 Conventions

- **Boss tiles are fixed text.** Everything marked with a boss emoji below is
  written, not generated.
- **⏸ marks a pause beat.** Play stops, something is taught, and it does not
  resume until the player acts.
- **Sides.** ✚ Plus says yes to the topic, ➖ Minus says no. Each level fixes who
  is which, chosen so the player gets the side that is easier to write cold.
- **Tokens.** 👍 = "Point taken, you actually moved me." 👀 = "Now I see why we
  disagree." A thread closes when both peers place the same token on the same
  tile.
- **Beat ids** (L1.1, L2.5, and so on) are the `trigger` keys in §1 and should
  survive into the script tables as stable identifiers.

### 2.10 You cannot fail a Gym level

Ruled by Steve on 2026-08-23 (`BIZ-T260823-67`), closing the question the build
table left open. **There is no failure state anywhere in levels 1-4.** No move
budget, no timer, no wrong-answer counter, no retry loop, no way to be sent back
to the start of a level. A player who throws the wrong card, misses a bait, or
sits still simply gets the coach again, and the script waits.

This is not leniency, it is what the Gym is for. Losing belongs to live play
against a human, where the stakes are real and another person is on the other
side. Practice that can be failed stops being practice.

Two things follow for the build. Every beat in §3 to §6 must have a defined
"player did not do the thing" path that still moves forward, which the scripts
already provide via the coach. And nothing in the config needs a `failure`,
`lives`, `attempts`, or `maxMoves` field; if one appears, it is wrong.

### 2.11 Two builds carry three levels

Build these once, not twice (`BIZ-T260819-09`: extensible, no debt):

- **The restatement box**, a text field plus accept and reject, is L4 rungs 1 and
  2 and is also both halves of Steel Man at level 5. Build it as a general
  **propose-and-approve primitive**.
- **The grab-handle-and-magnet gesture** is L2 rung 3 and is also thread
  reordering later. Build it as **tile movement**.

Rung 2 of Steel Man is the same interaction as Help Me Understand and should be
built once, not twice.

---

## 3. LEVEL 1: Onboarding

> **Topic:** *Should a hot dog be called a sandwich?*
> **Opponent:** 🧑🏻‍💼 Bashful Bob = ✚ Plus (yes, it is a sandwich) · **Player** = ➖ Minus (no, it is not)
> **Threads:** 2 · **Tiles:** ~9 · **Target length:** 8 to 10 minutes
> **Card earned:** 🙅 "You" is Taboo · **Badges:** ✍️1, ✍️2, ✍️3, 🤝, 🃏, 🎬
> **Points:** none.

**Why this topic.** It is already in the manual's Practice Topics, so it carries
no reading cost and no stance the player has to be careful about. Everyone has an
opinion and nobody has a stake.

**Why the player takes "no."** That is the intuition most people already hold.
The level is teaching the board, not the argument, and a player inventing a
position they do not hold is doing two jobs at once.

**Why two threads.** Banner at the top of the board: *Real games run four
threads, two reasons from each player. We'll use two while you're learning.*

**Bob's whole behaviour.** Slow, agreeable, and he **never volunteers a
resolution token**; the player has to ask. He commits exactly one violation, at
L1.11, and it is a nervous deflection rather than a jab. Nothing else.

### Beat sheet

**L1.0 Coach and avatar pick.** Three coaches, three temperaments, one screen.
The player picks their 🧘 figure and skin tone beside it. Cosmetic and tonal only.
The coach is at the side of the board from here to level 8.

**L1.1 The agreement.** The three items of §2.6, initialed. 🏅 ✍️1, ✍️2, ✍️3.

**L1.2 The topic tile is placed for them.** Pre-written, dropped in the center.

> ⏸ **PAUSE 1: the board.**
> 🧘: *"Topic sits in the middle, everything else hangs off it. You're the ➖ side, you think a hot dog is not a sandwich. That's Bob over there. He thinks it is."*

**L1.3 Bob places Thread A's root.**

> 🧑🏻‍💼 ✚ · **Thread A root:** "Yes, because a hot dog is a filling served inside bread, and that's what a sandwich is."

> ⏸ **PAUSE 2: what a reason tile is.**
> 🧘: *"That's a reason tile. A short claim supporting one side, and it starts a thread. One idea per tile. If you've got two, that's two tiles."*

**L1.4 P places Thread B's root.** Suggestions:

1. *"No, because nobody who orders a sandwich would ever be handed a hot dog."*
2. *"No, because a bun is one piece of bread that's been cut, not two slices."*

Script assumes **#1**. If the player goes structural, Bob's L1.5 line swaps to
the fallback.

**L1.5 Bob answers Thread B's root.**

> 🧑🏻‍💼 ✚ · **in Thread B:** "But menus list burgers separately from sandwiches too, and a burger is definitely a sandwich. What a menu calls something isn't really the test, is it?"
>
> *Fallback (P went structural):* "But a hoagie roll is hinged exactly the same way, and nobody has ever doubted a hoagie is a sandwich."

> ⏸ **PAUSE 3: tiles answer tiles.**
> 🧘: *"A 'But…' tile goes directly under the tile it argues with. That column is a thread. Everything in a thread has to be about the tile at the top of it. That's the one rule about threads, and it's most of the game."*

**L1.6 P answers Thread A's root.** Suggestions:

1. *"But a bun is hinged, that's one piece of bread, not two."*
2. *"But a sandwich has to still work when you lay it flat, and a hot dog doesn't."*

**L1.7 Bob answers in Thread A.**

> 🧑🏻‍💼 ✚: "But a hoagie roll is hinged the same way, and nobody has ever doubted a hoagie is a sandwich."
>
> *Fallback (line already used at L1.5):* "But then a wrap wouldn't be a sandwich either, and most people would say it is."

**L1.8 P answers in Thread B.** Suggestions:

1. *"But a burger has its own name for the same reason: when a food gets specific enough, the specific name wins."*
2. *"But food categories are about how people use the word, not about geometry."*

**L1.9 Bob proposes 👍 on P's L1.8 tile.**

> 🧑🏻‍💼: *"…oh. That one actually got me. The specific name winning is better than what I had."*
> Bob places 👍.

> ⏸ **PAUSE 4: the two tokens.**
> 🧘: *"Two ways a thread can end.*
> *👍 **Point taken**, the other person actually changed your mind.*
> *👀 **Now I see why we disagree**, neither of you moved, but you found the reason underneath it.*
> *A thread closes when you both put the same token on the same tile. Bob's put the first 👍 down. Put yours next to it."*

**L1.10 P confirms 👍.** Thread B resolved. 🏅 🤝 Resolve your first thread.

**L1.11 Bob commits the violation.**

> 🧑🏻‍💼 ✚ · **in Thread A:** "But you only think that because you grew up eating them at ballparks. That's nostalgia, not a definition."

Deliberately mild and deniable. There is a real point buried in it, so the throw
is a judgment call rather than a reflex, and it reads as Bob deflecting rather
than attacking. Bob does not flag it. If the player answers past it:

> 🧘 (nudge, from the side): *"Hang on. Read Bob's last tile again. Is it about the hot dog?"*

> ⏸ **PAUSE 5: your first rule card, 🙅 "You" is Taboo.**
> Card face, verbatim from the physical card:
> *Agreement: I won't use 'you' or 'yours'. I'll critique arguments, not people.*
> Examples: *"**You**'re only saying that because…" · "**People** who believe that are…" · "Why don't **you** care about…"*
> 🧘: *"That card is yours now. Something on the board breaks it. Throw the card at that tile."*

**L1.12 P throws 🙅.** 🏅 🃏 Call a broken rule. **No points, the score does not
exist yet.**

**L1.13 Bob revises his own tile.**

> 🧑🏻‍💼 replaces it with: "But the ballpark version of this argument is about memory, not about what the food is."

> ⏸ **PAUSE 6: what a card actually does.**
> 🧘: *"The card didn't delete anything. Bob rewrote the tile without the 'you' in it and the argument survived. That's the whole point. His reason was fine. The way he aimed it wasn't."*

**L1.14 P proposes 👀.** Prompt: *"You two are not going to agree about what the
word 'sandwich' means. Close it out."* P places 👀 on Bob's Thread A root, the
definitional tile, the one that explains the disagreement.

**Bob does not confirm.** One full beat of silence.

**L1.15 The silence gets explained.**

> 🧑🏻‍💼: *"…sorry. I don't like to assume."*
> 🧘 (from the side): *"He won't place his until you ask him to. Agreement gets asked for, not assumed. True here, and very true with a real person."*

> ⏸ **PAUSE 7: ask for the confirm.** Button: **Ask Bob to confirm.**

**L1.16 P asks. Bob confirms 👀.** Thread A resolved, every thread resolved, win
condition #1.

> **This beat does not work against the shipped code, and the fix is approved.**
> Live play refuses to end on "all threads resolved" unless there are at least
> four real threads, so Level 1 as written is a two-thread game a player can
> finish and still not win. Brain found this (`BRAIN-T260823-39`) and its fix is
> adopted (`BIZ-T260824-11`): **the minimum becomes a per-game number set at
> creation, and Level 1 sets its own to 2.** Every Gym level sets its own; the
> Gym is cooked games, and a cooked game knowing how many threads it contains is
> not a special case.
>
> Live play is answered separately and does not change: Steve ruled on 2026-08-24
> (`BIZ-T260824-16`) that four is the right minimum there, six is the ceiling, and
> the condition is that **every** thread resolves, not that four of them do. The Gym
> is the exception to the minimum, not to the "all of them" part. Level 1 has two
> threads and both must resolve.

**L1.17 Certificate.** Certificate of Agreeable Disagreement, pre-filled: 1 👍,
1 👀, topic line. 🏅 🎬 Finish one game. Card 🙅 granted as a separate event
(§1.2).

### What the player leaves with

Place a tile · answer a tile · a thread is a column and everything in it is about
the top · 👍 and 👀 · a resolution takes two and you have to ask · a rule card is
thrown at a tile and the author repairs it.

---

## 4. LEVEL 2: Ground rules

> **Topic:** *Should we stop changing the clocks twice a year?*
> **Opponent:** 🧑🏿‍🔧 Rambling Rosa = ➖ Minus (no, keep the change) · **Player** = ✚ Plus (yes, stop)
> **Threads:** 4 · **Tiles:** ~16 · **Target length:** 15 minutes
> **Card earned:** 🎯 Stick to the Thread's Root, all three rungs · **Badges:** 🗜️, 🎯1, 🎯2, 🎯3
> **Points:** introduced here. Personal.

**Why this topic.** It has to produce four threads that are genuinely separate
subjects, because "right reason, wrong home" is only teachable when there is an
obviously correct other home for the tile. Daylight saving splits cleanly into
health, energy, evening life, and coordination, four arguments that do not bleed
into each other. It is also mildly funny, argued by everyone, and morally
weightless.

**Why the player takes "stop changing them."** Majority intuition, so writing two
roots cold is easy.

**Rosa's whole behaviour.** Three off-root tiles, one per rung, in ascending
order. Ordinary correct play everywhere else. She is not stupid and the argument
underneath her tiles is real. What the player fixes is where her tiles sit, not
what she thinks.

Banner: *Four threads this time, two reasons from each of you. That's a standard
game.*

### The board

| Thread | Side | Root tile |
|---|---|---|
| **A** | P ✚ | *"Yes, because the spring change causes a measurable spike in car crashes and heart attacks in the days right after it."* |
| **B** | P ✚ | *"Yes, because the energy savings it was invented for have basically disappeared."* |
| **C** | 🧑🏿‍🔧 ➖ | *"No, because long summer evenings are what make after-work life possible for most people."* |
| **D** | 🧑🏿‍🔧 ➖ | *"No, because we'd have to renegotiate every schedule we share with countries that keep it."* |

Player suggestions for A: the tile above, or *"Yes, because the week after the
change, everyone I know is useless."* For B: the tile above, or *"Yes, because
we're keeping a wartime measure for reasons nobody can state."*

### Beat sheet

**L2.0 Four threads, and points.**

> ⏸ **PAUSE 1.**
> 🧘: *"Two reasons from each of you this time, four threads is the normal game. And there's a score now. You'll get points for catching Rosa with a card, and only for that. Nothing you write scores; catching does."*

**L2.1 Roots placed.** Rosa places C and D, P writes A and B.

**L2.2 Ordinary play, two rounds.** Four clean tiles from Rosa, no violations.
This stretch exists to grow the board past one screen.

> 🧑🏿‍🔧 ➖ · **in A:** "But it's one week a year, and the effect washes out by the following Monday."
> 🧑🏿‍🔧 ➖ · **in B:** "But nobody kept it for the energy math after about 1975, it stayed because people liked the evenings."
> *(P answers each, suggestions supplied.)*

**L2.3 Compression walkthrough.** The board has now outgrown one screen. This is
engineered, not incidental: the gesture answers a problem the player already has.

> 🧘: *"You're scrolling. Hit the arrow on a thread's root and it folds up. You keep the shape of the board and lose the wall of text. Try it on Thread A."*

> ⏸ **PAUSE 2: compression.** Player collapses one thread, then expands it again. 🏅 🗜️.

Scripted and unevaluated. The only real check is whether the player uses it again
later unprompted, which is worth logging and not worth scoring. 🗜️ displays as
**"Fold a Thread"** (`BIZ-T260823-71`); its id stays `compression`.

**L2.4 Card introduction: 🎯, rung 1.**

> ⏸ **PAUSE 3: 🎯 Stick to the Thread's Root.**
> *Agreement: Every tile in a thread has to be about the tile at the top of it. It either makes that statement more likely to be true, or less. If it does neither, it belongs somewhere else.*
> 🧘: *"Three ways a tile can miss its root. Here's the first, and it's the obvious one."*

**L2.5 🎯1 · Not even about this.**

> 🧑🏿‍🔧 ➖ · **in Thread A** (root: crashes and heart attacks): "But whoever put that tiny recessed clock-set button on the back of my microwave should be prosecuted."

Unmissable by design. The player is learning the gesture, not the judgment. Rosa
waits. If it goes unanswered for one turn:

> 🧘 (nudge): *"…that one isn't doing anything for the thread it's in, is it."*

**Repair: removal.** P throws 🎯, Rosa takes the tile off the board.

> ⏸ 🧘: *"Rung one, it isn't about the root at all. Nothing to salvage, it just comes off."*

**L2.6 Card introduction: 🎯, rung 2.** One pop-up per rung: three short screens,
not one long one.

> ⏸ **PAUSE 4: 🎯2 · On topic, already said.**
> 🧘: *"Harder. This one is true, and it is about the root. It just doesn't add anything the thread doesn't already have."*

**L2.7 🎯2 · On topic, already said.**

> 🧑🏿‍🔧 ➖ · **in Thread A:** "But we're talking about a handful of days out of three hundred and sixty-five."

This restates Rosa's own earlier tile in the same thread (*"it's one week a year,
and the effect washes out"*) in different words.

**Repair: withdraw, or say what's new.** P throws 🎯, Rosa replaces it with a tile
that does add:

> 🧑🏿‍🔧: "But the autumn change runs the other way in the same studies, so the annual net is close to zero."

> ⏸ 🧘: *"Relevant and true, and still worth catching. Relevance isn't the test; adding something is."*

**L2.8 Card introduction: 🎯, rung 3.**

> ⏸ **PAUSE 5: 🎯3 · Right reason, wrong home.**
> 🧘: *"The last one is why this card exists. The tile is good. It's in the wrong place, and the repair isn't a delete, it's a move."*

**L2.9 🎯3 · Right reason, wrong home.**

> 🧑🏿‍🔧 ➖ · **in Thread B** (root: the energy savings have disappeared): "But evening light is when people actually leave the house, and that's worth more than the kilowatt-hours."

A genuinely good argument. It is not an answer to "the energy savings
disappeared", it is an answer to why we keep it anyway, which is **Thread C's
root exactly.**

**Repair: relocation.** P throws 🎯. The tile grows a grab handle; holding it
lights the legal destinations as magnets, every thread root on the board plus
open space on the player's own side. P drops it on **Thread C's root**.

> ⏸ **PAUSE 6: moving, not deleting.**
> 🧘: *"Nothing was wrong with that tile. It was answering a question nobody in that thread had asked. Now it's under the root it was actually arguing with, and it's strong there. You just made Rosa's case better, which is allowed."*

**L2.10 Play out and resolve.**

| Thread | Token | Proposed by |
|---|---|---|
| A (health) | 👀 | Rosa |
| B (energy) | 👍 | P |
| C (evenings) | 👀 | P |
| D (coordination) | 👍 | Rosa |

C closing with 👀 is the good one: the relocated tile is what makes that thread
resolvable, so the player's own repair is what closes it.

**L2.11 Certificate.** Card 🎯 granted, three rungs lit.

### What the player leaves with

Four threads is the real game · a thread can be folded · three distinct ways a
tile misses its root, in ascending difficulty · the repair depends on which one it
was: remove, sharpen, or **move**.

---

## 5. LEVEL 3: Claim size

> **Topic:** *Should tipping be replaced by higher base wages?*
> **Opponent:** 🧑🏼‍🔬 Braggy Brenda = ➖ Minus (no, keep tipping) · **Player** = ✚ Plus (yes, replace it)
> **Threads:** 4 · **Tiles:** ~18 · **Target length:** 15 to 18 minutes
> **Card earned:** 📏 No Exaggeration, all three rungs · **Badges:** 📏1, 📏2, 📏3
> **Points:** personal. The only level where the score can go down, see L3.9.
> **Fast-forward:** available. Card yes, certificate no.

**Why this topic.** The card needs claims that beg to be oversized, and tipping is
unusually rich in them: everyone has anecdotes, nobody has data, and the arguments
on both sides arrive pre-inflated in ordinary speech, *"servers never make a
living wage," "every server would take tips," "nobody can budget."* That is rung 1
handed to you. It is also a live opinion with no moral charge.

**Why the player takes "replace it."** Rung 3 needs the player to overstate
**their own** claim, which is far easier to do sincerely on the side they would
naturally take.

**Brenda's whole behaviour.** She inflates, her claims, her sources, her certainty,
cheerfully and without malice. She never attacks the player, which keeps this
level's lesson single. Two catchable inflations, rungs 1 and 2, plus one more at
L3.10 after the dare.

### The board

| Thread | Side | Root tile |
|---|---|---|
| **A** | P ✚ | *(see suggestions below)* |
| **B** | P ✚ | *(see suggestions below)* |
| **C** | 🧑🏼‍🔬 ➖ | *"No, because the best servers out-earn any flat wage a restaurant would actually offer."* |
| **D** | 🧑🏼‍🔬 ➖ | *"No, because the money comes out of the same pocket either way, menu prices just go up instead."* |

**Player root suggestions, note the bait.** One suggestion in each pair carries a
quantifier. This is deliberate: it makes it likely the player writes an
overstatement of their own without being asked, which is the *good* path into rung
3, see L3.8. These two pairs are the one place on levels 3 and 4 where
suggestions are mandatory rather than optional (§2.8).

> **Thread A**
> 1. *"Yes, because tipping means every server's pay is decided by strangers who've never done the job."* ← baited
> 2. *"Yes, because a server's income shouldn't depend on how charming a stranger finds them."*
>
> **Thread B**
> 1. *"Yes, because tip income swings with the weather and the shift, so nobody can budget on it."* ← baited
> 2. *"Yes, because tip income swings with the weather and the shift, which makes it hard to plan around."*

### Beat sheet

**L3.1 Roots placed, one round of ordinary play.**

> 🧑🏼‍🔬 ➖ · **in A:** "But a flat wage doesn't reward the difference between a server who's paying attention and one who isn't."
> 🧑🏼‍🔬 ➖ · **in B:** "But plenty of jobs have variable pay and people manage it fine."

**L3.2 The coach models the repair, before the card exists.** Brenda will not
self-correct, that is her character. So the modelling comes from the side of the
board, on one of *her* tiles, out loud, before the player owns anything:

> 🧑🏼‍🔬 ➖ · **in Thread B:** "But every restaurant that's tried going no-tip has gone back to it."
> 🧘 (from the side, to the player): *"Watch that one. She said 'every.' If that were my tile I'd have written 'several well-known ones went back within two years', and here's the thing that's going to matter for the next twenty minutes: **the smaller version is harder to argue with.** You can't knock it down by finding one exception. Keep that in your head."*

> ⏸ **PAUSE 1: size is not strength.** Nothing to do yet. The line is planted so the card lands on prepared ground.

**L3.3 Card introduction: 📏, rung 1.**

> ⏸ **PAUSE 2: 📏 No Exaggeration.**
> *Agreement: I'll make claims at a size I can actually defend. Throw this card at a claim bigger than the reason underneath it. The thrower asks the author to restate it at a size they'll stand behind.*
> 🧘: *"Rung one has a tell. The word gives it away, and there's one sitting on the board right now."*

**L3.4 📏1 · Always, never, everyone.** The tile from L3.2 is still there,
unrepaired, and it is the rung-1 target. If the player throws at it immediately
they get the badge and the points. If not, Brenda supplies a fresh one:

> 🧑🏼‍🔬 ➖ · **in Thread A:** "But every server would take tips over a flat wage. Without exception."

**Repair.** P throws 📏. Brenda restates at a defensible size:

> 🧑🏼‍🔬: "But most servers I've worked with on a busy dinner shift would take tips over a flat wage."
> 🧑🏼‍🔬, grudgingly: *"…which is harder to argue with. Fine."*

**L3.5 Card introduction: 📏, rung 2.**

> ⏸ **PAUSE 3: 📏2 · A true point, inflated.**
> 🧘: *"No tell word this time. The point underneath is real. The size isn't."*

**L3.6 📏2 · A true point, inflated.**

> 🧑🏼‍🔬 ➖ · **in Thread B:** "But tipping is the only reason service in this country is as fast as it is."

There is a real incentive argument in there. *"The only reason"* is what breaks
it, and there is no always, never, or everyone to point at. The player has to
judge.

**Repair.** P throws 📏.

> 🧑🏼‍🔬: "But tipping is one of the things that keeps servers turning tables quickly."

> ⏸ 🧘: *"Same claim, honest size. Notice you didn't take her point away, you took the padding off it."*

**L3.7 Card introduction: 📏, rung 3.**

> ⏸ **PAUSE 4: 📏3 · You inflate your own.**
> 🧘: *"Last rung, and it's the only one that isn't about Brenda. Catching an oversized claim is easy when someone else wrote it."*

**From here the level branches.** The check runs silently over every tile the
player has placed so far, roots included. **Steve ruled on 2026-08-23
(`BIZ-T260823-74`) that it uses the wider word list and makes no model call.**
Three families fire it:

- **Absolute quantifiers:** *every, all, none, never, nobody, no one, always,
  everyone, everybody, only, completely*.
- **Evidence-standing superlatives:** *the best, the worst, the only, the first,
  the most*, where the superlative is doing the work a citation should do.
- **Every/any constructions:** *any server, every restaurant, anyone who*.

**Correction, 2026-08-24.** An earlier draft said `overgeneralization` is live and
does this work today. Brain checked and that was wrong twice (`BRAIN-T260823-42`):
the string appears nowhere in the rebuild, and in the old stack `overgeneralization`
was a category the language model returned, not a word list. So the sentence cited a
model classifier as evidence that a no-model-call check already exists, which is the
opposite of what `BIZ-T260823-74` asks for. **Nothing to reuse: the list gets written
from scratch.** Brain is doing that as a single shared constant read by both L3.7 and
the coach's No Exaggeration card, so the two can never drift apart, and a constant is
something brain can extend without a deploy.

Widening it means the coach will sometimes point at a tile whose superlative was
fine. That is the accepted cost, and it is cheap here: L3.8 Path A is an
invitation to edit with no dare, no point cost and no penalty, so a false alarm
costs the player one sentence of the coach's attention. The alternative, letting
a model judge, was rejected: it would put the Gym's only model call inside four
levels that are otherwise fully scripted, and it would be hard to test.

**Path A is the expected one.** The baited root suggestions make it the common
case.

#### L3.8 PATH A: the player already exaggerated

The coach points at the player's own tile. No dare, no pre-typed text, no point
cost. The tile is already on the board and was never worth points either way.

> 🧘: *"Before we go further, read your own Thread B root back to me. 'Nobody can budget on it.' Nobody? Not one server in the country has ever managed a budget? I could knock that over with a single counterexample, and then I'd have won an argument you shouldn't have lost."*

> ⏸ **PAUSE 5A: your turn.** The player's own tile opens for editing.
> 🧘: *"Same move you've thrown at Brenda twice. Pull it back to something you'd defend."*

Suggested repairs:

1. *"But tip income swings enough week to week that planning around it is hard."*
2. *"But a server can't know in March what they'll make in April."*

🏅 **Badge 📏3. No points, and none lost.** Nothing was farmed and nothing was
penalized. The badge is the whole reward, which also means nobody can inflate on
purpose to collect it twice.

> ⏸ 🧘: *"You wrote that twenty minutes ago and it looked fine. That's the reason this rung exists: the oversized claim never looks oversized to the person who wrote it."*

#### L3.9 PATH B: the player wrote nothing inflatable (the dare)

Nothing in an ordinary game makes a careful player overstate their own claim on
cue, so the coach asks outright. A tile is pre-typed **into the player's own
box**, aimed at Thread C. The player only has to hit return.

> 🧘: *"Everything you've written is the right size, which is the problem, I can't teach you this by waiting. So I've typed something into your box. It's your argument, two sizes too big. It's going to cost you points to send it. **Send it anyway.**"*
>
> Pre-typed for P ✚ · **in Thread C:** "But tipping makes a server's pay completely disconnected from how hard they work."

**On send: the score visibly drops** by exactly `THROW_POINTS`, what one correct
throw is worth. The drop is animated and labelled *"oversized claim."*

**L3.9b Brenda shows the cost.**

> 🧑🏼‍🔬: *"'Completely disconnected'? So a server at a packed steakhouse takes home the same as one at a dead diner on a Tuesday night? Come on. That's not true, and now I'm arguing with **that word** instead of with your point, and your point was a good one."*

> ⏸ **PAUSE 5B: pull it back.**
> 🧘: *"You had a real argument and you oversized it, and she went after the size instead of the argument. That's what it costs. Now restate it at something you'd defend."*

Suggested repairs:

1. *"But tip income tracks how busy the restaurant is more than it tracks the server's effort."*
2. *"But a server can do everything right on a slow Tuesday and take home nothing."*

**On repair: the points come straight back**, animated, labelled *"brought back to
size."* Net zero.

> 🧘: *"Back where you started. That's the deal the card is offering, you can always get it back by saying what you meant."*

🏅 **Badge 📏3.** Net points zero. The dock is a lesson, not a punishment, and a
player who follows an instruction is never left out of pocket.

**Guard rail: the dare fires once per Gym run.** A player who sees Path B here
does not see it again on any later level of that run, so the point-dock cannot
become a mechanic players learn to game or dread.

**Narrowed on 2026-08-24 (`BIZ-T260824-09`).** This said "once per account, ever"
and asked for a flag on the account. Brain pointed out that the shipped dare is
matched inside a single game's replayed log, so an account-lifetime promise would
need state that is not derived from the event log, and it would be the first such
thing in the rebuild. That precedent is not worth buying here. Per-run gets the
whole benefit: the dare's job is to stop the dock feeling like a recurring tax
inside one sitting, and nobody plays the Gym twice for the points.

#### L3.10 Both paths rejoin: Brenda inflates again, and P throws

> 🧑🏼‍🔬 ➖ · **in Thread D:** "But nobody has ever made a no-tipping restaurant work."
> P throws 📏. Brenda narrows: "But the no-tipping restaurants I know of have had a hard time holding staff."

> ⏸ 🧘: *"Bait, catch, throw, three times now. The rung you just did was the other direction: sometimes the claim that needs shrinking is yours."*

**L3.11 Play out and resolve.**

| Thread | Token | Proposed by |
|---|---|---|
| A (charm / income) | 👀 | P |
| B (predictability) | 👍 | Brenda |
| C (best servers earn more) | 👀 | Brenda |
| D (same pocket) | 👍 | P |

**L3.12 Certificate.** Card 📏 granted, three rungs lit. A fast-forwarded L3
grants the card here and no certificate.

### What the player leaves with

A claim has a size, and the size is separate from whether it's true · three ways
it goes wrong: the tell word, the quiet inflation, and your own · shrinking a
claim makes it harder to argue with, not weaker · the card asks for a
restatement, never a retraction.

---

## 6. LEVEL 4: Clarity

> **Topic:** *Should AI-generated content be clearly labeled?*
> **Opponent:** 🧑🏾‍🍳 Sloppy Salma = ➖ Minus (no, don't label) · **Player** = ✚ Plus (yes, label it)
> **Threads:** 4 · **Tiles:** ~19 · **Target length:** 15 to 18 minutes
> **Card earned:** 💬 Help Me Understand, rung 0 (rule), rung 1 twice, rung 2 · **Badges:** 💬1, 💬2
> **Points:** personal.
> **Fast-forward:** available. Card yes, certificate no.

**Why this topic.** This card needs two things the topic has to supply: a sentence
that honestly reads two ways, and a word doing more work than its meaning can
carry. AI labeling is full of both. *"AI-generated," "authentic," "made by a
machine," "meaningful human input"* are all terms people use confidently and
define differently, which is exactly the failure the card is built for. It is
argued in good faith on both sides, and the disagreement is genuinely about
definitions rather than about values.

**The governing principle, never broken in any script line:** you never show
someone their writing was unclear by saying *"that was unclear."* You hand back
how you read it and let them see the gap.

**Salma's whole behaviour.** Fast and careless rather than hostile. She argues in
a question once, writes one tile that reads two ways, leans on one load-bearing
word she never pins down, and mangles one sentence outright. She takes every
correction well, which is what makes the round winnable.

### The board

| Thread | Side | Root tile |
|---|---|---|
| **A** | P ✚ | *"Yes, because people decide how much to trust something partly by knowing who made it."* |
| **B** | P ✚ | *"Yes, because without labels, the only people who pay a price are the ones who disclose honestly."* |
| **C** | 🧑🏾‍🍳 ➖ | *"No, because nearly every tool has AI in it somewhere now, so the label stops separating anything."* |
| **D** | 🧑🏾‍🍳 ➖ | *"No, because a label gets read as a warning, and the work gets judged before anyone looks at it."* |

### Beat sheet

**L4.1 Roots placed, one round of ordinary play.**

> 🧑🏾‍🍳 ➖ · **in A:** "But people already decide what to trust from the source, and a label doesn't change who's publishing it."
> 🧑🏾‍🍳 ➖ · **in B:** "But the ones who disclose are also the ones whose work is easiest to check."

**L4.2 Rung 0: Salma argues in a question, and the moderator stops her.**

> 🧑🏾‍🍳 ➖ · **attempting to place in Thread A:** "But how would anyone even verify a label like that?"

The tile never lands. The **moderator** intercepts it at write time, in front of
the player:

> **Moderator:** *"That's a question, Salma. Your side of the board is for statements. What's the claim behind it?"*
> 🧑🏾‍🍳: *"…fine. That there's no way to check one."*
> 🧑🏾‍🍳 ➖ · **placed in Thread A:** "But there's no way to check whether a label is honest, so it's just a promise."

> ⏸ **PAUSE 1: you can't argue with a question.**
> 🧘: *"That's a rule of the board, not a card. It applies to both of you and the moderator enforces it every time. A question doesn't hand the other player anything to answer. There's no claim in it to agree or disagree with, so there's nothing for a tile to be.*
> *Which leaves a real problem: what do you do when their tile genuinely doesn't land? That's the card you're about to get."*

*Build note: this beat is entirely opponent-side and does not depend on anything
the player does. It fires identically every playthrough.* Rung 0 is a `rule`
nugget: nothing to throw, nothing to earn.

> **This rung is live-play board law, and the check does not exist yet.** Brain
> flagged (`BRAIN-T260823-43`) that the coach's line above is literally true: the
> rule applies to both players and the moderator enforces it every time, which makes
> it board law rather than a Gym script beat, and there is no question test in the
> tile validator today.
>
> **Steve approved brain's test as-is on 2026-08-24 (`BIZ-T260824-14`).** A trailing
> question mark, plus a list of interrogative openers. **No model call**, consistent
> with the standing ruling that the moderator is not a model. On a refusal the
> moderator names the rule and **hands the text back for editing** rather than
> discarding it, which is exactly what the script above dramatizes: Salma's sentence
> is not thrown away, she rewrites it into a claim.
>
> Build it in the tile validator, not in the Gym level, and the Gym gets it for
> free.

**L4.3 Card introduction: 💬, rung 1.**

> ⏸ **PAUSE 2: 💬 Help Me Understand.**
> *Agreement: If I can't tell what a tile means, I won't say "that was unclear." I'll write out how I read it and hand it back.*
> 🧘: *"Throw the card, then type their tile back to them in your own words. They see your reading next to what they actually wrote. That gap is the whole message, it tells them what to fix, which 'that was vague' never does."*

**L4.4 💬1a · Unclear wording, the two-ways shape.**

> 🧑🏾‍🍳 ➖ · **in Thread D:** "But nobody wants their work labeled by a machine."

Genuinely two-ways, and invisible to whoever wrote it:

- **Reading 1:** creators don't want an automated system deciding what gets flagged.
- **Reading 2:** creators don't want a badge on their work saying a machine made it.

Salma privately holds **reading 2**. She does not know it was ambiguous, that is
the point.

P throws 💬 and types their reading. Suggested completions:

1. *"I read that as: creators don't want some automated system deciding what gets flagged."*
2. *"I read that as: creators don't want a stamp on work they made themselves."*

Script assumes **#1**, the reading Salma did *not* mean. The two are shown side by
side, her tile above, the player's reading below.

> 🧑🏾‍🍳: *"Oh, no, that's not it at all, and that's on me. I meant a badge on their work saying a machine made it. Reading mine back, it says both, doesn't it."*
> 🧑🏾‍🍳 rewrites: "But creators don't want a badge stamped on work they made themselves."

> *If P takes #2 (the reading she did mean):* Salma accepts. *"That's exactly it. Which means it was clearer than I feared, but now that you've written a reading down, I can see the other one sitting in there too."* The rewrite still happens and the throw still scores. **Acceptance is the score; nothing ever judges the quality of the player's reading.**

> ⏸ **PAUSE 3: why this works.**
> 🧘: *"You never told her the sentence was bad. You showed her where a careful reader landed, and she fixed it herself in about four seconds. Try 'that was unclear' on a real person some time and see how long it takes."*

🏅 Badge 💬1.

**L4.5 Card introduction: 💬, rung 2.**

> ⏸ **PAUSE 4: 💬2 · 📖 Define That.**
> 🧘: *"Sometimes the sentence is built perfectly well and one word inside it was never pinned down. You don't hand back a reading for that, you stop at the word and ask."*

**L4.6 💬2 · Define that.**

> 🧑🏾‍🍳 ➖ · **in Thread B:** "But a label is worthless unless what's underneath it is actually authentic."

*Authentic* is load-bearing, undefined, and doing the entire job of the tile. The
sentence itself is fine.

P throws 💬 rung 2 and asks. Suggested phrasings:

1. *"What counts as authentic here? I can't tell if you mean nobody used a tool, or a person made the real decisions."*
2. *"I need 'authentic' pinned down before I can agree or disagree with this."*

> 🧑🏾‍🍳: *"Fair. By authentic I mean a person made the substantive choices, whatever tools they used to carry them out."*

> ⏸ **PAUSE 5: it binds now.**
> 🧘: *"That definition is pinned to the edge of the board. Neither of you gets to quietly switch it later, that's what makes asking worth doing rather than just polite."*

The agreed definition is displayed persistently in a pinned strip at the board
edge and both players' later tiles are read against it. 🏅 Badge 💬2.

**L4.7 💬1b · Unclear wording, the mangled shape. No pop-up.**

Rung 1 covers two different failures and L4.4 only exercised one: a sentence that
reads two ways, and a sentence that simply does not parse. This one comes **late
and unscaffolded**, no card screen, no coach setup, because by now the player
should recognise the shape without being told what it is.

> 🧑🏾‍🍳 ➖ · **in Thread C:** "But labels that people ignore them anyway doesn't help who it's for."

There is a real point in there and it has fallen over on the way out. If the
player answers past it, one nudge:

> 🧘: *"Did that one land for you? Be honest."*

P throws 💬 and hands back a reading. Suggested completions:

1. *"I read that as: a label that people scroll past doesn't help the person it was meant to protect."*
2. *"I think you mean the label only helps if someone actually reads it."*

> 🧑🏾‍🍳: *"Yes, that's exactly what I meant, and you wrote it better than I did. Take it."*
> 🧑🏾‍🍳 rewrites the tile in the player's words.

> ⏸ **PAUSE 6: same card, different failure.**
> 🧘: *"That one wasn't ambiguous, it was just broken. Same card, same move, hand back a reading. You didn't need me to tell you which rung it was, and you won't in a real game either."*

**L4.8 Play out and resolve.** The definition agreed at L4.6 should visibly do
work here: Thread B's resolution turns on it.

| Thread | Token | Proposed by |
|---|---|---|
| A (trust / provenance) | 👍 | Salma |
| B (honest disclosers lose) | 👀 | P |
| C (AI is in everything) | 👍 | P |
| D (label reads as warning) | 👀 | Salma |

**L4.9 Certificate.** Card 💬 granted, rung 0 rule met, rungs 1 and 2 lit.
**First release complete.**

### What the player leaves with

A question isn't a move, for either player · when a tile doesn't land, the honest
response is a reading, not a complaint · two shapes of unclear, the whole
sentence or one word in it · an agreed definition binds the rest of the game ·
being shown how you were read is the cheapest way to find out you weren't clear.

---

## 7. Cross-level check

| | L1 | L2 | L3 | L4 |
|---|---|---|---|---|
| **Boss** | 🧑🏻‍💼 Bob | 🧑🏿‍🔧 Rosa | 🧑🏼‍🔬 Brenda | 🧑🏾‍🍳 Salma |
| **Threads** | 2 | 4 | 4 | 4 |
| **Tiles (approx.)** | 9 | 16 | 18 | 19 |
| **Card** | 🙅 | 🎯 | 📏 | 💬 |
| **Rungs** | none | 3 | 3 | rung 0 + 2 (rung 1 twice) |
| **Scripted violations** | 1 | 3 | 3 (+1 dared, contingency only) | 4 |
| **Card pop-ups** | 1 | 3 (one per rung) | 3 (one per rung) | 2 (+ rung 0 as a rule, + one unscaffolded) |
| **Pause beats** | 7 | 6 | 5 | 6 |
| **Badges** | 6 | 4 | 3 | 2 |
| **Points** | none | personal | personal (can dip) | personal |
| **Fast-forward** | no | no | yes | yes |
| **New mechanic** | resolution handshake, the throw | compression, tile relocation | the dare, editing your own tile | restatement box, pinned definition strip |
| **Topic register** | silly | light-civic | opinionated, no charge | definitional |

**First release totals:** 15 badges of 26, 4 rule cards of 11, 4 bosses of 8, 4
certificates.

**The difficulty curve runs in one direction: visible, then judgment, then
self-directed.** L1's "you" is a word you could search for. L2 runs word-tell
(rung 1) to judgment (rungs 2 and 3). L3 does the same inside one card and then
turns it on the player. L4 has no tell at all: the player has to notice they did
not understand something, which is the hardest thing on the ladder to notice.

**Why levels 1-4 and not more.** The reason is evidence, not scope trimming: we
want to see whether anybody actually plays as far as level 4 before paying to
build level 5. This is a build order, not a ladder order.

**Deferred to level 5 or later:** ↕️ importance ranking, the revise-topic win
condition, 🎭 Steel Man, Not Straw Man, communal points, generosity tokens. None
of these appear in any levels 1-4 script.

---

## 8. The profile

Ruling: **personal and non-comparative only** (`BIZ-T260822-05`). No
leaderboards, no opponent comparison, no win/loss record, nothing that ranks one
player against another. Rannie's mockup content is placeholder; this is the real
set.

### 8.1 The stat set

| Stat | Notes |
|---|---|
| Games played | |
| Topics debated | |
| Threads resolved | Plain count, no breakout, for the first release (`BIZ-T260824-10`) |
| Cards Landed | Rule-card throws the author accepted (`BIZ-T260823-71`). The working phrase "snitch catches" is dead and must not reach any player-facing surface |
| Tiles placed | |
| Current streak and longest streak | Delta D1: brain flagged streaks as missing from the data model |

Stats are stored per `BRAIN-T260817-11`. D1, streaks, is still a real gap brain
needs before this page can render truthfully.

**And D1 is not the only gap. None of this page exists yet** (`BRAIN-T260823-41`).
Every stat above reads out of a progression layer that lives only in the DynamoDB
backend being retired; the rebuild has no points, badges, certificates or streaks.
This page renders when that port lands. Per `BIZ-T260824-13` that is expected work in
a new-database rebuild rather than a discovered cost, and per `BIZ-T260824-17` it
should be a port of the retired logic, not a reimplementation. See the correction box
in §1.3.

**D2 is withdrawn, 2026-08-24 (`BIZ-T260824-10`).** The fact / priorities / taste
breakout is dropped for the first release. It was never a data-model gap: the game
accepts only 👍 and 👀, the three meaning-carrying tokens are named in code and
deliberately refused, and no Gym level teaches the distinction. So no player action
anywhere produces the information, and adding it would mean reopening board law and
giving some level the job of teaching three tokens. That is a real design question
and it should be asked on purpose later, not smuggled in through a profile stat.

**Location is cut from the first release. The slot is parked, not dead.** Leave
room in the layout; do not collect the data.

### 8.2 The two halves

**Gym half.** Certificate wall, one slot per level, with a visible gap for any
level that was fast-forwarded. The card set the player holds. Badges by level.

**Live half.** The same personal stats above, restricted to live games, plus the
cards the player holds going into a live game. Nothing comparative. A player's
live half never mentions another player.

**Settings carries the coach control.** The coach lives on the account
(`BIZ-T260823-68`), so the profile is where it is changed. One control, the same
picker the player saw at L1.0, reachable at any time. Changing it is global and
immediate: the new coach appears in every level from that point, and there is no
per-game record of who coached a finished level.

**The two halves are a split inside the existing screens, not two new tabs.**
Rannie's four-way navigation, Profile as root plus Cards & Badges, History, and
Settings, is adopted as drawn (delta §E). Gym versus Live is the filter that runs
through it: the Profile stat block shows both halves, History filters by half,
Cards & Badges is shared because a card earned in the Gym is the same card you
carry into a live game. The pair the frames should distinguish is practice, now
the Gym, versus live play against a human. Gym and Dojo were never two modes.

---

## 9. What this supersedes

`2026-08-04_level-build-table.md`, levels 1-4 only. Levels 5 and up stand.

| Build table | What it says | Correction |
|---|---|---|
| `:391` | Kranky Karl is the level 2 boss | Rambling Rosa. Karl parks for 5-8 and his row needs rewriting, not renaming |
| `:437` | points go communal at level 3 | personal through level 4, communal at 5 |
| `:439` | communal points detail | same |
| `:442` | Sloppy Salma is the level 3 boss | Braggy Brenda. Salma is level 4 |
| `:495` | Twisty Thibault is the level 4 boss | Sloppy Salma. Thibault parks for 5-8 |
| `:869` | counts row: L2 Karl, L3 Salma, L4 Thibault, L5 Bogdan, L6 Rosa | Bob, Rosa, Brenda, Salma for 1-4 |
| the 4x3 grid, `:620-684` | level tags on each card | pre-reorder mapping, stale for L1-L4. The grid's families and tiers are correct |
| badges by level, `:749-806` | L3 is 💬1, 💬2; L4 is 🎭1-3, 📏1-3, ↕️ | L3 is 📏1-3, L4 is 💬1, 💬2. 🃏 moves from L2 to L1. ✍️1-3 stay at L1 |
| counts, `:860-874` | first release is 19 of 26 badges, 5 of 11 cards | 15 of 26 badges, 4 of 11 cards. Per-level badges are 6 / 4 / 3 / 2 |
| the agreement table, `:686-697` | four lines in some places | three lines, §2.6 |
| level 4 Generosity table, `:452-495` | the level is claim size and generosity, with 🎭 rungs | 🎭 defers to level 5 entirely. 📏 moves to level 3 |
| §4.8, `:1948-1957` | up to three threads per side from level 2, because ↕️ importance ranking lands there and is what makes a third thread survivable | **Two per side through level 4.** The third thread travels with the ranking, and the ranking defers to level 5, so the pairing holds; only its level number changed. Level 1 is a two-thread game, one per side; levels 2-4 are four-thread games, two per side |

Also superseded from Nathan's draft: the title says Dojo, and L1.1 lists four
agreement items. Both are corrected above.

---

## 10. Settled and still open

**Nothing here blocks the build.** Brain found nine things on 2026-08-24, biz
settled five and Steve settled the other four the same day. §10.2 is biz's five,
§10.3 is Steve's four. Nothing in this document is waiting on anyone.

### 10.1 Settled by Steve on 2026-08-23

Thirteen rulings from Steve across four rounds, each a decision row in
`point-taken-biz/data/todos.csv`. All are already applied above; they are listed
here so nobody re-litigates them.

| What | Ruling | Row |
|---|---|---|
| **What makes a tile legal** | **It must make the thread root more or less likely to strengthen or weaken support for the topic.** See the starred block at the top of §2 | `BIZ-T260823-77` |
| Level titles | Onboarding / Ground rules / Claim size / Clarity, shipped as written | `BIZ-T260823-69` |
| `THROW_POINTS` | 10 | `BIZ-T260823-65` |
| Id casing | Card ids `snake_case` (code wins), everything else `kebab-case`. Widened 2026-08-24, see §10.2 | `BIZ-T260823-66` |
| Failing a level | There is no failure state in the Gym. See §2.10 | `BIZ-T260823-67` |
| Coach ownership | Per account, changeable in profile settings | `BIZ-T260823-68` |
| Level 3 boss | Braggy Brenda, replacing Braggy Bogdan. Roster stays US-centric | `BIZ-T260823-70` |
| 🗜️ badge name | Displays as "Fold a Thread", id stays `compression` | `BIZ-T260823-71` |
| Profile "catches" | Displays as "Cards Landed" | `BIZ-T260823-71` |
| L3.8 self-catch trigger | The wider word list, no model call. See §5 beat L3.8 | `BIZ-T260823-74` |
| Score history | Point-value edits restate history. No config versioning in the first release | `BIZ-T260823-75` |
| Which fallacy checks surface | The five stand as ruled. Whataboutism is excluded by the relevance rule, not by a detector | `BIZ-T260823-76` |
| Coach model budget | Cheapest that passes the fixtures. Latency is forgiving because feedback is always post-submission | `BIZ-T260823-78` |

The boss ruling also answers what used to be an open item here, the absence of an
Indigenous, Native American, or First Nations character: the answer is not now,
and the reason given was to keep the first release's roster US-centric. It is a
deferral, not a closed door, and levels 5 and up are where it can be revisited.

**One loose end from the rename.** `2026-08-04_level-build-table.md:869` puts
Bogdan at level 5. Levels 5 and up are not designed, so nothing is being changed
there now, but whoever designs level 5 should know the name was retired at
level 3 and should not quietly return.

### 10.2 Settled by biz on 2026-08-24, answering brain's objections

Brain read this guide under `BRAIN-T260823-36` and came back with nine places it
would build differently. Five of those are design calls inside a document biz owns,
so biz ruled on them rather than holding the build for Steve. In four of the five
brain's proposed default was adopted unchanged, because brain's reasoning was
correct against the shipped code.

| What | Ruling | Row | Brain's |
|---|---|---|---|
| Casing scope hole | The exception is the reason, not the category: an id already in a shipped event payload keeps `snake_case`. That covers the three signing-line ids | `BIZ-T260824-07` | `BRAIN-T260823-47` |
| Award event names | `card_granted`, `certificate_granted`, `badge_granted`, `points_adjusted`. Brain's names as-is; the migration is brain's to schedule | `BIZ-T260824-08` | `BRAIN-T260823-44` |
| Scope of the L3.9 dare | Once per Gym run, not once per account ever. No account state outside the event log | `BIZ-T260824-09` | `BRAIN-T260823-45` |
| Threads-resolved breakout | Withdrawn. Plain count ships; the fact / priorities / taste split is a board-law question to ask on purpose later | `BIZ-T260824-10` | `BRAIN-T260823-40` |
| Level 1 cannot be won | The all-threads-resolved minimum becomes a per-game number set at creation. Level 1 sets its own to 2 | `BIZ-T260824-11` | `BRAIN-T260823-39` |

Brain also corrected §5 without needing a ruling: `overgeneralization` is not a
live word-list check anywhere, so the L3.8 list is written from scratch as a shared
constant (`BRAIN-T260823-42`). That correction is applied in §5.

### 10.3 Settled by Steve on 2026-08-24

The four items brain's round raised that were above biz's authority. Steve answered
all four the same day, so none of them is open.

| What | Ruling | Row | Brain's |
|---|---|---|---|
| The absent progression layer | Not a discovery and not a blocker. The rebuild is an entire new database, so this was always going to be built; only the guide's sentence was wrong. It comes with an expectation to harvest, not rewrite | `BIZ-T260824-13` | `BRAIN-T260823-41` |
| L4.2 rung 0 strictness | Brain's test approved as-is: trailing question mark plus interrogative openers, no model call, refusal names the rule and hands the text back for editing | `BIZ-T260824-14` | `BRAIN-T260823-43` |
| The three missing affordances | All three approved to build. Root suggestions is the one with teeth | `BIZ-T260824-15` | `BRAIN-T260823-46` |
| Live-play thread count | Four is the minimum, six is the max, and **every** thread must be resolved, not four of them | `BIZ-T260824-16` | `BRAIN-T260823-10` |

**The thread-count ruling needs saying precisely, because it is easy to hear wrong.**
The win condition was never "four threads resolved". It is **all threads resolved**,
on a board carrying at least four. A six-thread game needs all six. Six is the
ceiling. Steve could not recall from memory at which level a player is allowed past
four, and this document already answers it: two threads per side through level 4 is a
four-thread game, and the third thread per side travels with the importance ranking,
which defers to level 5. So the ceiling opens at level 5. **Brain should confirm that
against the code rather than take it from here**, since §9 records that this pairing
had its level number changed once already.

**Harvest, not rewrite** (`BIZ-T260824-17`). Steve's words: he hopes brain is using
the code we have now retired, and that it understands it does not need to do all of
this from scratch. The database is new. The game logic inside it is years old and
settled, and reimplementing settled logic invents new bugs in solved problems. Brain
owes an answer naming what it is porting versus reimplementing, specifically for the
progression layer, the tile validator, and the scoring replay.

### 10.4 Still open

Neither item is about this document.

1. **Old roadmap questions Q7, Q8, Q10** remain Steve's.
2. **Brain's harvest questions Q1 and Q6** (`BRAIN-T260823-05`): whether the
   unmerged `origin/aicop` frontend is in harvest scope, and whether the eval
   fixtures are an IRB instrument or plain engineering fixtures. Q2 and Q7 cannot be
   answered until the conversation with Corey happens.

**Closed since the last revision.** The old Q2, the live-play card set, is built:
it ships as a per-game field with a `policy` of `intersection` or `raised` plus
`raised_by`, defaulting to the least common denominator, per `BRAIN-T260817-11`.
The narrower piece still open is who may raise the set above the intersection,
which is `BRAIN-T260817-09`.
