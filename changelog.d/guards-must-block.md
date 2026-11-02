## 2026-08-06 · fix(ci): nine guards were running on every PR and blocking nothing

Auto-merge waits on REQUIRED status contexts only. Nine guard jobs were not in
`main`'s required-checks list, so each one could go red on the PR page while the
PR merged anyway — the red tick was decoration:

`lint page masthead` · `lint port keeps every control` · `lint email template
links` · `lint admin chat-guard` · `lint radius tokens` · `lint booth poster
placement` · `lint duplicated-rule baseline` · `lint vendor layout revalidate` ·
`lint changelog fragment dir`

Confirmed against `repos/iscasasola/setnayan-platform/branches/main/protection`
— all nine absent from `required_status_checks.contexts`. The port guard is the
sharpest case: it was written on 2026-08-06 precisely because two working
controls ("Invite guests" / "Arrange the room") were deleted from the couple's
guest page with every other check green — and it shipped unable to stop the next
one.

Fixed on the CODE side, so no branch-protection edit is needed:

- All nine moved out of their own jobs and into `typecheck + lint`, which IS a
  required context. Their `run:` commands are byte-identical to before — only
  the job they ride in changed.
- They sit BEFORE `pnpm install` (all nine are pure node, no `node_modules`), so
  a breach is reported in seconds instead of after a five-minute typecheck.
- Each keeps `continue-on-error: true` plus its own named step and its own log,
  so **one failing guard cannot hide the other eight** — the old one-job-per-guard
  layout got that for free and a naive step list would have lost it.
- A new `Every blocking guard must pass` step reads each step's `outcome`
  (`continue-on-error` rewrites `conclusion` but leaves `outcome` truthful) and
  fails the job, emitting one `::error title=…::` annotation per failing guard so
  the PR page names each without anyone opening a log. It runs under
  `!cancelled()`, so a typecheck failure earlier in the job cannot swallow a
  guard breach either.
- FAIL-CLOSED: anything that is not exactly `success` — including `skipped`,
  which is what a mis-edited `if:` produces — counts as a failure.
- The nine now-duplicate standalone jobs are deleted: 20 jobs → 11, so this also
  drops nine runner spin-ups per PR rather than adding any.

Two of the moved guards (`lint-dup-rule-baseline.mjs`, and the still-separate
`lint-exposure-baseline.mjs`) assert their own CI wiring by regex-matching a
single-line `run:` naming their script. Both still pass; the constraint is noted
in a comment beside the step so a future edit does not silently unwire them.

Also added, as a job-level comment on `typecheck + lint`: a new single-file guard
belongs there as a STEP, not as a new job — a new job needs a settings change
nobody remembers to make. That is how all nine ended up decorative.

Verified before making anything blocking: all nine pass on `origin/main`
(`5314ba545`) both locally and in CI run `31071617331`, where all 20 jobs were
green — so none of these turns red on arrival. Every one of the 13 existing
required contexts still exists. The aggregator was watched go RED in three
separate scenarios (one guard failing, two failing at once with both named, and
a guard `skipped` rather than run) and green on the all-pass control; a real
breach was also driven end-to-end through `lint-changelog-dir`.

SPEC IMPACT: None. CI wiring only — no product behaviour, schema or pricing.
