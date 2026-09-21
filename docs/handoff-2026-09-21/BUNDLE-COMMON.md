# BUNDLE-COMMON — rules for a session that carries several builds in ONE PR

Read this first, then your `CTRL-B*.md` brief. Everything in `AREA-AUDIT-TEMPLATE.md` still applies;
this file only adds what changes when one PR carries more than one build.

**Why bundles exist:** a PR here is a ~45–55 minute CI round trip, almost all of it the DB replay.
Five separate PRs for five small fixes costs five round trips and five merge conflicts against a
moving `main`. One PR with five commits costs one. The owner asked for fewer things to merge.

---

## The five rules

**1. One branch, one PR — but one COMMIT PER BUILD.**
Never squash the builds together. If one turns out to be wrong after merge, the owner needs a
surgical `git revert <sha>`, not an archaeology session. Name each commit for the build it carries.

**2. Hardest and riskiest FIRST, cheapest last.**
Your brief lists the builds in the order to do them. That order is the cut line: if the bundle has
to shrink, it shrinks from the END. Never start with the easy one because it feels like progress.

**3. A red build is DROPPED, not nursed.**
If one build goes red and you cannot get it green in ~20 minutes, `git reset` that one commit out of
the branch, push the rest, and say plainly in your report: *"build N dropped, here is what it hit."*
**Never hold four finished builds hostage to one.** A dropped build comes back as its own PR; a
stalled bundle blocks everything behind it.

**4. Stay inside the named neighbourhood.**
Your brief names the files each build touches. They were chosen so the builds cannot collide with
each other or with another live session. If a build pulls you outside that set, stop and report it
rather than widening the blast radius — a bundle that touches everything is a bundle nobody can review.

**5. Prove you changed only what you meant to.**
Before pushing: `git diff --stat origin/main...HEAD`. Read every file in it. If a file you had no
reason to touch appears — especially a DELETION, and especially a helper another PR added recently —
you have a restore loop writing over a merge. Fix it before pushing. **PR #5719 merged green while
silently reverting #5717 and deleting its helper. CI cannot see this; only the `--stat` can.**

---

## Sequence inside the session

1. `git fetch origin main` and branch from `origin/main`. Never branch from this repo's checked-out
   working tree — it is thousands of commits behind.
2. **Merge `origin/main` BEFORE you take any sabotage backups.** Taking them first and restoring
   after a merge is how a green PR reverts a merged one.
3. Build 1 → its guard → its commit. Then build 2. One at a time; do not interleave.
4. Scoped tests only — the file you touched and its guard. **Never run the full suite**, never watch
   the PR, never poll CI. Push, arm auto-merge, report the verdict, and stop.
5. `gh pr merge <N> --auto --merge` immediately after `gh pr create`. This is the standing default —
   do not ask.

## The changelog fragment

One NEW file `changelog.d/<branch-slug>.md` for the whole bundle, with **one `##` section per build**
and a `SPEC IMPACT:` line on each (even if "None"). Never edit `CHANGELOG.md` or `STATUS.md` in a
feature PR — a unique fragment file cannot conflict, which is the entire point.

## Guards

Every build gets a guard, and the guard asserts the **property**, never a phrasing — a reword makes
the identical promise without the banned noun, and a phrasing ban also convicts innocent code.
Prove each guard by sabotage: break the property, confirm the guard goes RED, restore. **A guard you
did not watch fail is a hypothesis.** If a sabotage passes, your assertion is facing the wrong way —
fix the assertion, not the sabotage.

⚠ Count what you assert. A file-level match cannot say WHICH component still holds a flag; anchor
per component and print the occurrence count, so a sabotage that lands 2→1 cannot stay green.

## The lines that do not bend

- **Prod is READ-ONLY.** `select` only. **Never apply a migration directly to production** — a direct
  apply once stranded seven merged PRs for three hours. **Never run `supabase migration repair`.**
- **Never weaken, delete or narrow a guard to go green.** If it is genuinely too noisy, raise its
  threshold and say so in the PR body.
- **STOP and report BLOCKED** rather than routing around a safety or permission check. A blocked
  report is a good outcome; a bypass is not.
- Never `pkill` by pattern. One heavy job at a time — three concurrent `tsc` runs shut this Mac down.
- Never read code from `/Users/icecasasola`; use `git show origin/main:<path>` / `git grep … origin/main`.
- Cite a greppable symbol or a SQL query, **never a line number**.
- Drop `node_modules` symlinks before removing a worktree. Prune your own worktree when your PR
  merges — never another session's.

## Your report back

Per build: **done / dropped**, the property the guard now holds, and the sabotage you watched fail.
Then the PR number and whether anything is red. Keep it short — the controller relays it to the owner,
who wants outcomes, not process. If you measured something that contradicts your brief, say so first;
**the brief is a claim, the tree is the evidence.**
