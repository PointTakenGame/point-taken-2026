---
tid: BIZ-T260823-04
type: spec
thread: design-workshop
owner: biz
date: 2026-08-23
status: draft
audience: Steve
built_from:
  - point-taken-brain/docs/reference/materials/design-briefs/2026-08-19_rannie-figma-delta.md
  - point-taken-biz/docs/reference/2026-08-22_figma-redraw-brief-rannie-audrey.md
  - point-taken-biz/docs/reference/2026-08-22_gym-levels-1-4-implementation-guide.md section 8
governs: BIZ-T260804-02
---

# Account pages: the entity list, and the delta against Rannie's frames

Entities only. No layout, no mockup. The question this answers is "what does
each screen hold," so that the mockup pass afterwards has nothing left to
invent.

Four screens, because Rannie's navigation is adopted as drawn: **Profile** as
root, plus **Cards & Badges**, **History**, **Settings**. Gym versus Live is a
filter running through those four, not a fifth screen.

## 0. The one thing to notice before reading

Nothing below is new information. It is brain's 2026-08-19 frame-by-frame diff
plus the rulings biz made on 2026-08-22, reorganised by screen instead of by
kind of disagreement. The review was done; the per-screen entity list was
never written down, which is why it reads as undone.

## 1. Profile (root)

| Category | Entity | Stored as | Status |
|---|---|---|---|
| Identity | Username | account | settled |
| Identity | Avatar | account | settled |
| Identity | Location / city | not stored | **parked.** Leave the slot, do not collect the data |
| Position | Current level, 1 to 4, named by its boss | progression record | settled |
| Position | Active boss card, prerequisites as a checklist, then "Start to play" | derived | settled, keep Rannie's drawing |
| Position | Certificate wall, one slot per level completed, four in the first release | `badgeRecordType` certificate | settled. **Visible gap** for a fast-forwarded level, intended pull, not an error |
| Action | The one button: resume, or start | `inFlightGameId` | settled |
| Action | Empty state, nothing in flight | derived | **add.** Rannie drew only the resume case |
| Stats | Games played, with "+3 this week" | stored, delta computable | settled |
| Stats | Topics debated | stored | settled |
| Stats | Threads resolved, broken out fact / priorities / taste | stored per game | **add.** Absent from her frames. Delta D2 |
| Stats | Catches, rule-card throws the author accepted | award event | settled as a stat. **Player-facing label unresolved**; "snitch catches" is wrong for a profile |
| Stats | Tiles placed, lifetime and per game | stored | **add** |
| Stats | Current streak, longest streak | stored | **add.** Delta D1. The one genuinely motivating personal number we have |
| Coach | Chosen coach persona | `coachId` | settled, one parameter, three personas |
| Footer | Version string | build | settled. No season |

All stats are personal and non-comparative (`BIZ-T260822-05`). Both halves show
here: Gym and Live, in one block.

## 2. Cards & Badges

| Category | Entity | Status |
|---|---|---|
| Cards | Cards owned, four in the first release of eleven | settled. Named for the good move: 🙅 "You" is Taboo, 🎯 Stick to the Thread's Root, 📏 No Exaggeration, 💬 Help Me Understand |
| Cards | The full card grid, four families by three tiers | settled. Draw **without level tags**, the families and tiers hold, the level assignments moved |
| Badges | Badges earned, as a **set with occurrence counts** | settled. 15 of 26 in the first release, distributed 6 / 4 / 3 / 2 by level. Not a fraction, badges are re-earnable |
| Not here | Certificates | deliberate. The certificate wall lives on Profile; this screen stays narrow |

## 3. History

| Category | Entity | Status |
|---|---|---|
| Row | Date, topic, opponent, duration, cards thrown | settled, all stored, keep as drawn |
| Row | Outcome as a **win condition**: threads resolved, or topic revised | settled |
| Row | Points, **one number per account** | settled. Never a versus |
| Expanded | Match replay panel | settled, keep. Strip the versus score |
| Expanded | Resolutions by type, fact / priorities / taste | **add** |
| Filter | Gym versus Live | **add.** The filter, not a tab |

## 4. Settings

| Category | Entity | Status |
|---|---|---|
| Account | Email, password | settled as a **link out** to the auth provider, not a custom form |
| Preference | Coach persona | settled |
| Preference | Compact-display toggle | settled. Per-player display only, it never changes what the other player sees |
| Preference | Notification opt-out | settled |

## 5. The delta, counted

Twenty-six items, against Rannie's seven frames.

**Cut, eight.** Second eight-rung ladder (Newcomer through Legend); Cooperation
Score "8.4, top 12% globally"; Ladder Rank "#31, Silver Division"; per-match
"14 vs 11" and the Win / Loss labels; the events calendar and its whole
subsystem; "Season 3"; Location; the Change Email and Change Password forms.

**Rename or reshape, five.** Dojo becomes Gym everywhere, including the FAQ
line; cards renamed from fallacies to good moves; "Reformed Bosses 4 / 8" loses
its denominator and becomes a set of four; "Badges Gallery 7 / 16" becomes a set
with counts; Drill-Sergeant Dev needs a new name, "Dev" collides with developer
and a drill sergeant is the wrong register for a character who never plays.

**Add, six.** Streaks; threads resolved by type; tiles placed; the empty state;
certificates with the fast-forward gap; the Gym-versus-Live filter.

**Keep exactly, seven.** The four-way navigation; the boss challenge card with
its checklist, which is the clearest expression of level structure anyone on this
project has drawn, us included; the three coach personas; the room invite frame;
the host setup flow; "Ways to win: resolve all threads, or revise the topic";
the expanded match replay panel; per-match cards thrown, duration, topic,
opponent.

## 6. What is still genuinely undecided

Four labels and one number, none of which changes the entity list:

1. The player-facing word for **catches**.
2. Drill-Sergeant Dev's replacement name. Candidates: Firm Fikri, Tough Tova.
3. The four **level titles** (Onboarding, Ground rules, Claim size, Clarity are proposals).
4. Whether the **coach pick can change** after level 1, and whether it is per player or per account. This one does touch storage: per account or per player is a schema question.
5. `THROW_POINTS` has no value, so points cannot render.

## 7. What this closes

`BIZ-T260725-05` asked whether progression is persistent per account or reset
per game, and warned that under the per-game reading "there is no player record
to design." Every entity above assumes the persistent reading. That fork is not
open any more in practice; it needs ratifying rather than deciding.
