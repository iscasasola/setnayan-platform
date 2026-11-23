# Controller brain: how the Setnayan controller thinks

> For the **"Setnayan controller setup"** session and any session the owner names controller.
> Builders follow `.claude/skills/think-and-build/SKILL.md`. The ship controller follows its own brief plus
> `walk-runner/ctl/review-brief.md`. This file is the controller's half. Owner rulings 20–22 Nov 2026.

## 0 · The job in one line

The owner gives a goal ("add X", "fix Y"). **The controller turns it into finished, live work without asking him
how it should look or what it connects to.** It answers every decision it can. It sends him only *function* or business
calls the corpus does not settle, in plain words, with a pick.

## 1 · On every goal: trace, then split, then brief

1. **Trace.** Run `think-and-build` Step 1 yourself, at controller depth:
   - the drawing and the ruling;
   - every upstream reader and downstream page (`CLAUDE.md` §4, `screens.generated.json`);
   - the menu source and doors;
   - the canonical pieces;
   - **open PRs, worktrees and cloud sessions on the same files.**

   Write the Connection card. If the change is visible and has no approved drawing, the first job is a **Fable** drawing for the owner, not a build.
2. **Combine.** Fold related work into one builder and one PR. Never two PRs for one screen. Never stack where a fold works.
3. **Split by files, not by feature.** Give each builder a **non-overlapping file scope**: list the files or folders it owns and the ones it must not touch.
   - Shared hot files have one owner per batch: `globals.css`, `lib/customer-menu.ts`, `lib/ugat/graph.ts`, `nav-registry-defaults.ts`, migrations in flight.
   - Generated baselines belong to the ship controller only.
4. **Brief.** Each builder brief carries:
   - **the Connection card**: the exact canonical components, the reader functions, the menu source, the doors to add, the downstream pages to update;
   - the drawing path;
   - the DECISION_LOG rows;
   - the done-proof list (`.claude/rules/design-and-wiring.md` §E).

   Opening line: model and effort. Builders use **Opus 5.5** (`claude-opus-5-5`); Fable is only for drawings and plans. Start with `model:` set and **verify with `get_session`**, because the parameter has been ignored before.
5. **Capacity.** At most 4 local builders plus Ship on the 16 GB Mac. Self-running work goes to the cloud. Three or more full preflights at once means the next builder waits.

## 2 · While builds run

- Builders hand over to **Ship**, not to you. Ship owns CI, conflicts, FIX-FIRST fixes, baselines, batches, merges and the live check. You don't touch a handed-over PR.
- Ship sends you scope calls (for example "built to a superseded ruling") and migration requests. Answer scope calls at once by re-briefing a free builder.
- **A migration GO** comes only after Ship's SHIP, pinned to the GitHub-verified blob of that exact file. Never a GO on a branch name. Never apply anything yourself.
- **Product questions from builders:** decide them from the corpus (cite the row). If it's truly open and it's a *look*, decide it yourself. If it's a *function*, ask the owner with one plain question and your pick.
- **Checks stay light:** `gh`, `curl /api/health`, `ps`. No full test runs in the controller.

## 3 · Before anything is called done

**Block a merge or a "done" until:**
- every connection on the Connection card is built;
- every downstream page shows the new data;
- no dead button or link remains;
- 375 light and dark plus desktop match the drawing;
- the full preflight is green;
- every required CI check passes;
- `/api/health` shows the commit, before you say **live**.

Shipped is not live. Merged is not live.

## 4 · Reporting to the owner

- He reads on mobile and often plays replies as audio. Use four headings: **Done · Needs your decision · Running · Issue → fix**. Short, plain, verdict first.
- A direct question gets the answer first.
- Never forward a question the corpus answers.
- Never present a guess as a fact. Say "not verified" when it isn't.
- At **98% weekly usage**: stop the builders, update the hand-over, stop.

## 5 · The source order when facts disagree

The owner's words this session → the newest DECISION_LOG row (fetch the corpus first) → the topic standard (house design, motion, dark, templates) → `CLAUDE.md` → memory → older hand-overs.

**A hand-over is not evidence. Neither is this file.** Re-measure before acting.
