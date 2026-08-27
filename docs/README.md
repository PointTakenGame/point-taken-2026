---
id: point-taken-brain-da4da68b
name: game-docs
agent: point-taken-brain
thread: game-engine
kind: spec
status: live
ticket:
sub_index:
what_it_is: "The canonical, present-tense specification set for the brain edition (Point Taken, tile board): soul, roadmap, rules, script, tech spec, and UI components. Normative; history lives in the agent folder, not here."
regen_command: none
verified: 2026-08-26
notes: "Lives inside the point-taken-2026 game repo so contractors with GitHub access can read it without workspace access. Created 2026-08-26 under BIZ-T260826-06. Only this index exists on main so far; the six spec files it lists are being written. The older dated design, roadmap, and spec docs are being folded in from the agent folder and archived there."
---

# Point Taken (brain edition, tile board): canonical documentation

**These files are specifications, written in the present tense.** They say what
the game *is*, not what happened to it.

## House rules for editing anything in this folder

1. **No history.** No dated entries, no "Update 2026-08-27:" sections, no
   changelog blocks, no "previously" or "superseded" language. If something
   changed, change the sentence. Git holds the history.
2. **No date-prefixed filenames.** A date in a filename announces "artifact from
   a moment", which is how these files turned into changelogs the first time.
3. **One fact, one home.** If a fact belongs in two files, put it in the more
   normative one and reference it from the other.
4. **New doc means a new line here.** If you add a file to this folder, add it to
   the table below in the same commit.

## The files

| File | What it is | Who it is for |
|---|---|---|
| `soul.md` | Why the game exists and how it should feel | Read first, everyone |
| `roadmap.md` | What ships in what order | Steve, Emma, Athira |
| `rules.md` | Normative game rules and every player-observable constant | Everyone |
| `script.md` | The strings players read | Nathan |
| `tech-spec.md` | Architecture, data model, file layout | Coding agents |
| `ui-components.md` | Component inventory with states | Rannie, Audrey |


## Where the line falls between `rules.md` and `tech-spec.md`

Ask: **could a player, with no access to the code, notice this value changed?**
Yes puts it in `rules.md`. No puts it in `tech-spec.md`. Ties go to
`rules.md`.

## Status

Folder created 2026-08-26. The files above are being written now; a missing file
means not yet written, not "does not apply".
