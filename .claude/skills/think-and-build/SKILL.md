---
name: think-and-build
description: The mandatory 4-step thought process for EVERY Setnayan build, fix, page, component, migration or UI change. Load it before writing any code in setnayan-platform. It auto-discovers what the change connects to (upstream data, downstream pages, navigation, canonical components) from CLAUDE.md §3–4, the Ugat map and the specs corpus, so the owner never has to spell out how a page should look or what it links to. Triggers: build, fix, add, change, redesign, wire, new page, new button, new table, migration, "make X", "the Y is broken".
---

# Think and build: four steps, in order, every task

Owner ruling, 22 Nov 2026: **derive the look and the connections yourself, before any code.** Do not ask
the owner what a page should look like or what it connects to. The answer is in the drawings, the corpus, `CLAUDE.md` and the code.
Ask only for a *function* or business rule that none of them settles, and say what you checked first.

Write the output of steps 1 and 2 into your first message, or the PR body for a cloud builder, as a short **Connection card**:

```
CONNECTION CARD · <task>
Extends:      <shipped page/component path>   · drawing: <corpus prototype file or "fix, no drawing needed">
Ruling:       <DECISION_LOG row date + title, or "none found">
In flight:    <open PRs / worktrees touching the same files, or "none">
Reads:        <tables/RPCs/readers>           Writes: <tables/RPCs/actions>
Feeds:        <every downstream page that shows this data>
Ways in:      <menu entry · doors · notifications · emails · deep links>
Pieces:       <the canonical components from CLAUDE.md §3 this uses>
Delta:        <exactly what is new; everything else is reuse>
```

## Step 1 · Auto-discover connections

Run these and read the results; don't skim:

```bash
# what ships
rg -ln "<feature noun>" apps/web/app apps/web/lib --glob '*.{ts,tsx}' | head -30
# the map: which screens read/write the tables involved, and their doors
rg -n "<table or route>" apps/web/lib/ugat/screens.generated.json | head -40
rg -n "<table or concept>" apps/web/lib/ugat/graph.ts | head -20
# the design and the ruling (corpus: fetch first, read origin/main)
git -C ~/Documents/Claude/Projects/Setnayan fetch -q origin
git -C ~/Documents/Claude/Projects/Setnayan ls-tree -r --name-only origin/main | rg -i "<noun>" | head
git -C ~/Documents/Claude/Projects/Setnayan show origin/main:DECISION_LOG.md | rg -n -i "<noun>" | tail -20
# work in flight (RULE 0.8)
gh pr list --state open --limit 60 --json number,title,headRefName | rg -i "<noun>"
git worktree list
```

From these, fill in:
- **Upstream:** where the data comes from (the one reader in `CLAUDE.md` §4).
- **Downstream:** every page that shows it: the screens JSON reads, plus `rg` on the reader's name.
- **Navigation:** its menu source and every door.
- **Pieces:** the canonical components it needs.

If two sources disagree, the order of authority is: the owner's words → a newer DECISION_LOG row → the topic standard → the house design standard → anything else.

## Step 2 · Design and data lock

Before the first edit, check each item and fix the plan if one fails:
- [ ] Every UI piece is a canonical primitive from `CLAUDE.md` §3. No new button, input, modal, card, colour, size, radius or speed.
- [ ] The layout matches the approved drawing 1:1. With no drawing, the nearest sibling page's structure (`.claude/rules/design-and-wiring.md` A1–A2).
- [ ] Every shared number uses its ONE reader (rule C8). No second computation.
- [ ] Prices are read from the catalogs and money is formatted by `lib/php.ts`. No number that governs money is invented.
- [ ] A schema change: a migration via `pnpm migration:new`, RLS at create with the canonical patterns, a writer and a reader in the same PR, and a Ugat node or a baseline line. No prod apply.
- [ ] Failed reads render as "couldn't read", never as 0, empty or success.
- [ ] Light and dark both work from the tokens. Phone first at 375 px.
- [ ] Scope stays inside your assigned files. A file another builder owns means stop and tell the controller.

## Step 3 · Build and wire everything

- Extend the shipped files. Write only the delta.
- Wire every control to its action or destination. Register the page and add its doors (rules A3–A4, B5–B7).
- Update every downstream page that shows changed data, and `revalidatePath` each affected route.
- Add or extend the guard test that would fail if this wiring broke. Sabotage it once to prove it goes red, then restore.
- Changelog fragment `changelog.d/<branch-slug>.md` with a `SPEC IMPACT:` line. When the spec changes, add a DECISION_LOG row in the corpus.

## Step 4 · End-to-end verification

- Every new or changed control, pressed in a browser (dev lab or preview): it lands. **Zero dead buttons, zero broken links.**
- Every way in walked. Every downstream page checked to show the new data.
- Screenshots at 375 light and dark plus desktop, beside the drawing.
- `pnpm preflight` (from `apps/web`) green, covering typecheck, lint, guards, units and the DB replay. Generated baselines are left to the ship controller.
- Hand over with the Connection card, the proof, the overlapping files and anything unverified, said plainly. Then stop: the ship controller owns the PR from here.
