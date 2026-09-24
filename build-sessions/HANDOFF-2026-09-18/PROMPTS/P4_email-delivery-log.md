# P4 · You cannot tell whether any email arrived

> **Model: Fable · effort: high.**

## The measurement

**0 writers.** Confirmed still 0 on 2026-09-18:
```bash
git grep -c "notification_deliveries\|recordDelivery" origin/main -- apps/web   # empty = still 0
```
`emitNotification` records that a notification was **created**, never whether it
was **delivered**. 76 notifications exist. How many reached a human is
unanswerable.

## Why it is urgent NOW and was not before

SMTP only started working on 2026-09-18 — Supabase Auth now points at Resend
(`smtp.resend.com:587`, rate limit raised 2/hr → **100/hr**). Before that the
honest answer to "did it arrive" was "no, nothing did". Now it is genuinely
unknown, which is worse.

⚠ Both the payment notification and the daily digest send **nothing, silently**,
if `RESEND_API_KEY` is unset in Vercel. The digest is the net underneath, not a
substitute for the log.

## The thing that makes this worth building

🔑 **A LOG LINE NEVER CHANGED A PIXEL.** This project has already shipped the
failure where an error was correctly bound, correctly sent to Sentry, and the
couple was still told her wedding had no guests. **If a delivery failure cannot
reach a screen an owner looks at, you have built a second thing nobody reads.**

Decide — and say in the PR body — where a failed delivery becomes **visible**.

## Before you build

```bash
git grep -n "emitNotification" origin/main -- apps/web/lib/notifications.ts | head
git grep -l "resend\|Resend" origin/main -- apps/web/lib | head
```
There is an **email allowlist** — a notification not on it reaches nobody away
from the console. 🔑 **The notification and the allowlist are two halves of one
mechanism; having one is indistinguishable from having neither.**

⚠ This repo has **no scheduler, deliberately** — `vercel.json` has
`"crons": []` and ~23 periodic jobs ride request traffic via `claim_periodic_job`.
If your design needs a sweep, register it there. **Check registry MEMBERSHIP
first**, and note that `cron_job_runs.last_run_at` is stamped **before** the job
runs, so a fresh timestamp is not proof a sweep completed.

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
