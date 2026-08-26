---
tid: BIZ-T260822-21
type: spec
thread: skills-levels-ladder
governs: BIZ-T260725-02
status: draft, needs Steve's ear on the wording
---

# The skill ladder, levels 1 to 4: what the player can do afterwards

`BIZ-T260725-02` asks for the binding between three things: the skill a player
learns at each level, the mechanic that requires that skill, and what counts as
having demonstrated it. The levels 1-4 implementation guide (`BIZ-T260822-07`)
supplies two of the three completely. Every level names its mechanic, its card,
its rungs, its badges, and the exact beat at which each is earned, and section 8
fixes what the account stores.

The third column is the one it does not have. Each level in the guide ends with a
"what the player leaves with" line, and every one of them is written in game
vocabulary: tiles, threads, roots, rungs, repairs. Those are true and they are not
skills. **Constraint C-052 requires that every skill be statable as something that
survives outside the game, in spoken conversation, with no board in front of you.**
This document supplies that column and nothing else.

## The test each row has to pass

One sentence a player could say at a dinner table, containing no Point Taken
vocabulary. If the sentence needs the word "tile", "thread", or "card" to make
sense, the skill has not been stated yet, only the mechanic has.

## Levels 1 to 4

| Level | The skill, said without any game words | The mechanic that requires it | What counts as demonstrated |
|---|---|---|---|
| **1** | *"I can disagree with what you said without saying anything about you."* | 🙅 "You" is Taboo, thrown at a tile that argues against the person instead of the claim. The violation is written to be mild and deniable on purpose, so the call is a judgment, not a reflex | One accepted 🙅 throw, badge 🃏. No points exist at level 1 |
| **1, second skill** | *"Agreement is something you ask for. You don't get to announce it."* | The resolution handshake. The player proposes 👀 and the boss does not confirm until asked, then says why: he does not like to assume | The player asks, the boss confirms, the thread resolves. Win condition 1 |
| **2** | *"That's true, and it isn't an answer to what I asked. Here's the question it does answer."* | 🎯 Stick to the Thread's Root, three rungs in ascending difficulty: not about the root at all, true but adds nothing, and right reason in the wrong place. Only the third has a repair that is a move rather than an edit | Three accepted throws, one per rung, the third of them a relocation the player performs onto another thread's root. Badges 🎯1-3 |
| **3** | *"That's bigger than what you can back up. Say the version you'd actually defend."* | 📏 No Exaggeration, plus the dare, which is the only place in levels 1-4 where the player is invited to overstate their own claim and then repair it | Two accepted throws at the boss, and the player shrinking a claim of their own. Badges 📏1-3. The self-repair pays a badge and no points, deliberately, so nobody can inflate on purpose to farm the refund |
| **4** | *"Here's what I heard you say. Is that what you meant?"* | 💬 Help Me Understand. The player writes their reading of the other person's words and hands it back; the gap between the two does the teaching. Rung 2 stops at one undefined word and asks | An accepted reading and an accepted definition ask. Badges 💬1-2. **Acceptance is the score; nothing ever judges the quality of the player's reading** |

## Three things this makes visible

**Level 1 carries two skills, not one, and the second is the stronger one.** Asking
for agreement rather than assuming it transfers further than anything else in the
first four levels, and it is the only skill here that is about your own conduct
toward a person rather than about the shape of an argument. It currently has no
card, because there is nothing to throw: it is enforced by the boss refusing to
confirm until asked. Worth knowing that level 1's most transferable lesson is
carried entirely by one beat of silence.

**Level 3 is the only level that asks the player to fix themselves.** Levels 1, 2
and 4 all teach a call the player makes about someone else's writing. Level 3's
dare turns the same card inward. That asymmetry is deliberate and it is the reason
level 3 is where the ladder gets hard, not because exaggeration is subtler than
irrelevance.

**Level 4's skill is a substitution, not an addition.** Every other level adds a
move the player did not have. Level 4 removes one, "that was unclear", and puts
something in its place. That is why the governing rule for 💬 is phrased as a
prohibition: you never show someone their writing was unclear by saying it was
unclear.

## What is still open on the P0

This document closes the skill column for levels 1 to 4. `BIZ-T260725-02` also
asks for level 5 and beyond, and two of its named reconciliations are now moot
rather than resolved:

1. **Level 5 is unwritten.** 🎭 Steel Man, communal points, and ↕️ importance
   ranking all land there, and the third thread per side travels with the ranking.
2. **The co-premises conflict is deferred, not settled.** One source places
   co-premises at level 3 and the old ladder places it at level 7. In the current
   mapping it appears in neither levels 1-4 nor level 5, so nothing in the first
   release depends on which is right.
3. **The old eight-level mechanics mapping is stale for levels 1-4** and should not
   be folded in. The guide's section 9 names eleven superseded locations.
4. **The emoji vocabulary question (`BIZ-T260425-33`) is still open** above level 1.
   Level 1 ships with 👍 and 👀 only, which is a two-emoji game, and that is
   settled by the beat sheet rather than by the open decision.
