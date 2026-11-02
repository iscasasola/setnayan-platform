## 2026-08-22 · fix(repo): return four merged features a stale-branch merge deleted

On 2026-08-21, PR #4700 merged from a branch cut days earlier. **A merge from a
stale branch does not merely miss what landed while it was open — it deletes
it.** That one merge removed **24 files and reverted 43 more**, wiping most of
four already-merged PRs:

| PR | what was lost |
|---|---|
| #4686 | 631 Papic Challenges — the pool, the picker, the categories, the couple's screen, the emit script |
| #4695 | connection-request expiry — "requests do not linger", a promise the live privacy notice makes |
| #4696 | the couple's own custom editorial column |
| #4699 | `pay-path` — every buy button landing on the one payment page |

**CI passed on that PR, and could not have done otherwise.** The clobber took
the CALLING code along with each feature, so the repo was left internally
consistent: no dangling import, no type error, no failing test, nothing to grep
for. Measured on `origin/main` before this change: **zero** files referenced any
of the deleted modules.

The only symptom was four features away from the cause — **production stopped
deploying.** `deploy-prod.yml` applies migrations before firing the Vercel hook;
three of the deleted files were migrations **already applied in production**, so
`supabase db push` refused, the hook never fired, and six merges built green and
reached nobody.

### What this restores

- The **24 deleted files**, from the commit immediately before the clobber.
- The **27 files whose edits were reverted**, re-applied with a three-way merge
  so every later change on top of them survives. All 27 applied with **zero
  conflicts**.
- Two lines of `exposure-surface.baseline.txt` recording real objects —
  **verified present in production**: `papic_challenge_library.event_types` and
  `papic_challenge_pick_counts()`. Production also holds **631 challenge rows**,
  which have been sitting there without their code.

**Scoped by measurement, not by eye.** The restore covers exactly the files that
the clobber touched AND that belong to one of the four clobbered PRs — an
intersection of two git-derived sets, 24 deletions + 27 modifications. PR
#4700's own genuine work is untouched, asserted file by file: `rsvp-widget.tsx`,
`guest-details-changed.ts` and `only-the-answer-freezes.test.ts` carry **no**
change from this recovery.

### The guard

`apps/web/scripts/lint-migrations-never-deleted.mjs` + a
`supabase/migrations.manifest.txt` ledger of all 1,169 versions. A line with no
file fails the build. Deleting an applied migration is never right, and it is
the one direction with no legitimate cause.

⚖ A **new** migration missing from the ledger only prints a note. Making that
fatal would block every open PR in a repo where several sessions merge in
parallel, to catch a case far rarer than the one that cost production an hour —
and a guard that halts honest work gets weakened.

Mutation-tested: deleting `20271154904649_five_hundred_papic_challenges.sql`
(occurrence count 1 → 0) turns it **exit 1**; restoring it returns exit 0.
🪤 The first measurement read `exit=0` because the command was piped into `head`
— `$?` is the pipe's status, the trap this repo has already paid for once.
Re-measured without the pipe.

Wired into `ci.yml` with all **three** required edits — the step, the env
binding, and the `check` line. Any one missing and the guard runs but can never
fail the job.

⚠ **ORDERING.** Production is still on `daf6de93e`, which predates the clobber,
so the live site currently has all four features. The broken deploy is the only
thing holding that. **This must land before, or together with, PR #4706** — that
PR restores the three migrations and unblocks the deploy, and a deploy that
fires against a `main` still missing this code would take the four features off
the live site for real.

SPEC IMPACT: None. This restores previously-merged work to the state it had
before an accidental deletion; no product decision changes.
