## 2026-08-30 · docs(build-sessions): rule 0c — a check that cannot fail is not a check

Docs-only, no code. Lands the C-program session-prompt edits that were sitting uncommitted in
the main checkout, plus one correction and one previously-untracked prompt.

- **Rule `0c` added to all nine session prompts** (`C1`, `C2`, `C4`–`C8`, `C10`, `C10b`) —
  identical block in each, verified byte-identical by md5 across the nine diffs. It names two
  verification commands that returned a confident FALSE answer because of their own shape rather
  than the repo's state: a `git cat-file -e` loop whose inner command ate the loop's stdin and so
  reported "97 files absent upstream" when all 97 were present, and
  `git check-ignore -v X | head -2 || echo "not ignored"`, where `||` binds to the pipeline and
  takes `head`'s zero status, so **both** branches print nothing and neither outcome is
  observable. The rule: before believing a verification, ask what output the FAILING case would
  produce and confirm the command can produce it.
- **`BUILD_SESSIONS.md` — `wt-editable-prices` closed.** The entry carried a 🛑 DO-NOT-PRUNE and an
  open owner decision ("salvage or discard") about a worktree that no longer exists. All three of
  its replacement claims were re-measured against `origin/main` before landing, not taken from the
  draft:
  - worktree absent from disk and from `git worktree list`; branch
    `claude/admin-editable-prices-2026-08-28` still exists locally — **confirmed**.
  - the 5% regression never landed: `apps/web/lib/booking-fee-lock.server.ts` still interpolates
    `bookingFeeScheduleSummary(liveSchedule)` into the order description, and the file's only
    `(5%)` is a comment explaining the bug — **confirmed**.
  - the good half was not lost: `apps/web/lib/booking-fee-schedule-summary.test.ts` on main already
    accepts no argument or one identifier/dotted path and separately rejects inline objects **and**
    numeric literals (it rejects braces, brackets, quotes and a leading digit or sign) —
    **confirmed**, and stronger than the lost draft.
- **One claim in the draft was FALSE and was rewritten, not landed.** It read
  `✅ The main checkout is CURRENT`. Measured at commit time: **29 commits behind `origin/main`**.
  It had already gone stale the same day it was written — a session read `CLAUDE.md` out of that
  checkout and reported the `0 ORDERS EVER` line as live a full day after C10b (#5021) corrected
  it upstream. Replaced with what is durably true (on `main` and tracking, the 2237-commit
  staleness resolved) plus the `git rev-list --left-right --count` command to re-measure. A
  checkout's freshness is not a property a file that checkout carries can assert.
- **`build-sessions/C11.md` was untracked and is now in the repo.** 166 lines, owner-decided
  2026-08-30, existing only on one machine's disk. `git check-ignore -v` confirms it is not
  ignored — `.gitignore` line 41 is `!/build-sessions/`, added after that directory was caught
  with no allowlist line under the root `/*` rule.

**SPEC IMPACT:** None. Repo-side process documents only; no product decision, schema, or copy
changes.
