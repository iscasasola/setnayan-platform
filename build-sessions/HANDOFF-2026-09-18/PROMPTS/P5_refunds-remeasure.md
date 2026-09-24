# P5 · Refunds — MEASURE FIRST. Do not build a path that may already exist.

> **Model: Fable · effort: high.** **This is a measurement task. It may end with
> "nothing to build", and that is a valid, valuable outcome.**

## Why this prompt is not a build prompt

`order_refunds` = **0 rows**, so the path has never been exercised. A register
concluded from that: *"no refund path exists."*

**That conclusion is wrong.** Re-measured 2026-09-18 — **12 files carry refund or
re-issue references**, including real admin actions:

```
apps/web/app/admin/payments/actions.ts
apps/web/app/admin/payments/page.tsx
apps/web/app/admin/users/[userId]/page.tsx
apps/web/app/admin/users/actions.ts
apps/web/lib/erasure/purge.ts
apps/web/lib/notifications.ts
apps/web/lib/sku-activation.ts
apps/web/lib/admin-map/admin-jobs.generated.ts
… plus 4 guard/coverage files
```

🔑 **An empty table means the path was never USED. It does not mean the path was
never BUILT.** Zero rows and zero code are different measurements, and this
register conflated them.

## Your job, in order

1. **Read what those files actually do.** Is there a working admin refund action?
   A receipt re-issue? Which of the 12 are guards and docs rather than code?
2. **Establish reachability** — `git grep -l` each symbol for importers. An
   enumeration finds what exists, never what is reachable.
3. **Check `changelog.d/` and `git log --diff-filter=D`** for a recorded decision
   to leave something alone or to delete it. A previous session rebuilt something
   a council verdict had deliberately deleted.
4. **Then, and only then**, report: what exists · what is missing · the delta.

## What to bring back

A short, honest answer to one question: **if a customer paid ₱2,499 by GCash
today and needed it back, what would actually happen?** Trace it, do not infer it.

Four orders are paid and receipted (₱2,499 GCash · ₱2,899 GCash · ₱147 GCash ·
₱49 BDO), so this is not hypothetical.

---

## The rules every one of these prompts inherits

- Read `04_TRAPS.md` before running anything.
- **Never read code from `/Users/icecasasola`** or the primary checkout — both are
  hundreds of commits behind. `git worktree add --detach /tmp/wt-<name> origin/main`.
- **RULE 0** — paste the four searches into your first reply before building.
- **Auto-merge immediately**: `gh pr merge <N> --auto --merge`. Never ask.
- Add a `changelog.d/<branch-slug>.md` fragment with a `SPEC IMPACT:` line.
- **Never weaken a guard to go green** — fix its window, keep its assertion.
- **Probe your runner with a deliberate failure first.** Print the numbers.
- Prune the worktree when the PR merges.
- Test as `testnayan1`, **email + password, never the Google button.**
