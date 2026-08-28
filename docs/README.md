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
verified: 2026-08-28
notes: "Lives inside the game repo so contractors with GitHub access can read it without workspace access. Created 2026-08-26 under BIZ-T260826-06; the six spec files it indexes were drafted 2026-08-28 and are unreviewed by Steve. The older dated design, roadmap, and spec docs it was written from stay in the agent folder above this repo and are not pushed here."
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


## How to read a value in these files: the status markers

Every specific value in these documents (a number, a timer, a count, a name, a
threshold) carries a marker saying how much authority it has. **Read the marker
before you build against the value.**

| Marker | Meaning | What to do with it |
|---|---|---|
| `[ruled]` | Steve or a registry decision established it. | Build it. Do not change it without a new ruling. |
| `[unratified]` | It is live in the code, but nobody ever decided it. Cited as `file.ts:LINE`. | Build to it, because it is what runs today, but say so out loud before you depend on it. |
| `[vibecoded]` | Written as a rough sketch so there is something to correct. **Nobody approved it.** | Treat as a question wearing the clothes of an answer. Correcting it is welcome and expected. |
| `GAP:` | Deliberately left blank, with the exact question a human must answer. | Do not guess and fill it in silently. Answer it, or raise it. |

A `[vibecoded]` value that survives into shipped code because nobody questioned
it is the specific failure mode this vocabulary exists to prevent.

## Changing anything in this folder: open a pull request

Commit freely on a local branch, but **anything under `docs/` reaches `main`
through a pull request**, not a direct push. These files are the shared account
of what the game is, and a silent edit to them is how two people end up building
different games. The diff is the point.

## The design sources are not in this repo

These documents were written from a much larger set of design documents that live
in Steve's workspace, above this repository, and are not pushed here. That is
deliberate: these files are meant to carry the substance you need, not to point
at things you cannot open. If a document references a design asset by name
(a PDF, a slide deck, a Figma file, a print master), it is naming something to
**request from Steve by name**, not a path you can follow. If you find yourself
needing a source that is not here, ask rather than reconstructing it.

**This includes the `sources:` list in each file's frontmatter.** Every file in
the table above except this one opens with a `sources:` block naming what it was
written from. Those entries are provenance, not navigation: the paths resolve on
Steve's machine and nowhere else. The only exception is an entry that names this
repository itself.

## Where the line falls between `rules.md` and `tech-spec.md`

Ask: **could a player, with no access to the code, notice this value changed?**
Yes puts it in `rules.md`. No puts it in `tech-spec.md`. Ties go to
`rules.md`.

## Status

Every file listed above exists and is a **first draft, written 2026-08-28, not yet
reviewed by Steve**. Read the status markers above before treating any specific
value as settled. Where a document says a source and the running code disagree,
that disagreement is a real finding, not a documentation error: the code is what
is true today, and the document says so on purpose.
