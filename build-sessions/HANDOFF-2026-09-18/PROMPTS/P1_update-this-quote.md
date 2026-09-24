# P1 · "Update this quote" — the supplier can revise, the couple must re-accept

> **Model: Fable · effort: high.** (Weekly all-model was at 98% on 2026-09-18,
> resets Sep 19 18:00 UTC. Fable was at 34%.)

**Do not start this until PR #5586 has MERGED.** It rides inside the one-frame
chat box; building it first means building it twice.
```bash
gh pr view 5586 --json state,mergedAt -q '.mergedAt // .state'
```

## The defect

The owner, testing live: **"vendor cannot edit the proposal."** A supplier who
sends a quote and then needs to change it has no path.

## The ruling

Owner, verbatim: **"they can do updates and must be reaccepted. so they can
negotiate of the benefits."**

He chose **option (a)** on 2026-09-18: a new proposal **supersedes** the old one.

- The superseded quote **stays visible in the thread as history** — it is not
  deleted. The trail of what changed is the point; that is what "negotiate the
  benefits" means.
- The couple's acceptance **resets to pending**. An accepted quote that was then
  revised is not still accepted.
- One thread, **one live quote**.

## Before you build

RULE 0 applies hardest here. The quote already renders in the stream (#5584) and
the compose route already exists (`?compose=deal`, a Link — a server component
cannot pass a callback). **Find those two and extend them.** Name them in your
first reply.

```bash
git grep -l "compose=deal\|ChatMessageStream\|proposal" origin/main -- apps/web/app apps/web/lib | head -20
```

## Watch for

- **A zero-row UPDATE is success-shaped.** Add `.select()` and count the rows
  before any screen says the revision saved.
- The couple's accept state lives on `event_vendors` / the proposal row — find
  **the writer** of the number the budget renders before you change anything.
  A previous session declared the budget empty after querying the wrong table
  (`event_vendor_line_items`, 0 rows) while `event_vendors.total_cost_php` held
  ₱10,170 all along.
- `actions.ts` files are OUT of the honest-read pattern — there an absence
  **denies**, and failing closed is correct.

---

## The rules every one of these prompts inherits

- Read `04_TRAPS.md` before running anything. It is not optional reading.
- **Never read code from `/Users/icecasasola`** (~750 commits behind) or the
  primary checkout (1400+ behind). Use `git worktree add --detach /tmp/wt-<name> origin/main`.
  A fresh worktree has no `node_modules` — symlink from a worktree that has them.
- **RULE 0 — find it before you build it.** Run all four searches and paste the
  results into your first reply: `git grep -l` on origin/main, `gh pr list --state open`,
  `git worktree list`, `git log origin/main --oneline -15`.
- **Auto-merge immediately** after `gh pr create`: `gh pr merge <N> --auto --merge`.
  Never ask whether to.
- Add a `changelog.d/<branch-slug>.md` fragment with a `SPEC IMPACT:` line. Never
  edit `CHANGELOG.md` or `STATUS.md` in a feature PR.
- **Never weaken or delete a guard to go green.** If a guard fails against code you
  believe is correct, the usual fault is the guard's *window*, not its assertion.
- **Probe your own runner with a deliberate failure first.** A zero from an
  unproven harness is not evidence. Print the numbers you measured.
- Prune the worktree the moment the PR merges.
- Test as `testnayan1`, **email + password, never the Google button.**
