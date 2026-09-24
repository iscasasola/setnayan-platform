# Paste this into the new Claude Code session

> **Run this on Fable** (the account's weekly all-model window was at **98%** on
> 2026-09-18 and resets 2026-09-19 18:00 UTC; Fable was at 34%). Effort: high.

---

You are picking up the Setnayan platform build. Read the attached handoff zip
**before running anything** — start with `00_START_HERE.md`, then `04_TRAPS.md`.

Work in `~/Documents/Claude/Projects/setnayan-platform`, but **never read code
from `/Users/icecasasola`** (~750 commits behind) or from the primary checkout
(1400+ behind). Use `git worktree add --detach /tmp/wt-read origin/main`.

**Your first three actions, in order:**

1. **Re-measure, do not trust the zip.** Every row in it carries its command.
   Specifically confirm whether #5586 and #5585 merged and served:
   ```bash
   for n in 5585 5586; do gh pr view $n --json state,mergedAt -q '.mergedAt // .state'; done
   curl -s https://www.setnayan.com/api/health
   ```

2. **Report what changed since the zip was written** — merged PRs, new open PRs,
   and anything in `00_START_HERE.md` § THE SEQUENCE that is now already done.
   The zip says ~40% of such rows turn out already finished. **Tell me which
   ones before you build.**

3. **Then take step 2 of the sequence** ("Update this quote") — *unless* step 1
   shows #5586 has not merged, in which case that comes first.

**Rules that are not negotiable:**
- Auto-merge every PR immediately: `gh pr merge <N> --auto --merge`. Never ask.
- Never weaken or delete a guard to go green. If a guard fails against code you
  believe is correct, fix the guard's **window**, keep its assertion.
- Never apply a migration directly to production; never run `migration repair`.
- Test as `testnayan1` by **email + password**, never the Google button — the
  owner's account is `is_internal` and passes every paid gate.
- Print the numbers you measured, not just the verdict.
- Prune each worktree the moment its PR merges.

**What I care about:** the platform being genuinely usable for a **wedding and a
simple event at minimum**. Engineering is not the bottleneck — supplier
recruitment is — so tell me plainly when something I have asked for will not move
that.
