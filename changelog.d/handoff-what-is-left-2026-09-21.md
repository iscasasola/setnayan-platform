## 2026-09-21 · docs(handoff): WHAT_IS_LEFT_2026-09-21 — the register for an account transfer

Adds `WHAT_IS_LEFT_2026-09-21.md` at the repo root and re-points `CLAUDE.md`'s START HERE block at
it. Compiled from four parallel read-only audits (money · supplier · couple · launch) measured
against `origin/main` and the live prod database on 2026-09-21; the raw audit output ships alongside
it in `docs/handoff-2026-09-21/`, together with the parked mood-board outfit-library plan.

The document carries, per row, the symptom in plain words, a greppable anchor or the SQL that
re-measures it, the state (BROKEN / NOT BUILT / UNREACHABLE / DECIDED-UNBUILT / NEVER EXERCISED /
DECIDED), and effort — plus the owner decisions already made so a new account does not re-ask them,
the decisions still open, what is already fixed and must not be rebuilt, the environment traps, and
an explicit list of what could not be verified. No line numbers are cited anywhere in it (RULE 0 §7).

It supersedes `WHAT_IS_LEFT.md` (2026-08-07) and the corpus `WHATS_NEXT_HANDOFF_2026-08-20.md`; both
are left in place and marked superseded rather than deleted.

Documentation only — no app code, migration, or prod row is touched.

SPEC IMPACT: None. The owner decisions summarised in §5 are already recorded in the corpus
`DECISION_LOG.md`; this file restates them so they survive an account transfer.

## 2026-09-21 · docs(handoff): the live-site walk, the re-measurement arithmetic, four ready briefs

Second pass on the same document, before merge.

- **§4b — walked the live site, logged out.** Five findings observed on a rendered page rather than
  inferred from code, plus three claims made earlier the same day that the walk forced a retraction
  of. The retractions are kept deliberately: they are the part that teaches.
- **§4c — how much of a register is already built.** Two agents re-measured the 2026-09-18 bundle:
  ~106 items claimed open, ~75 re-measured, **~49 already built**. Twenty-one closed by finding a
  merged PR that named the row's own ID. Includes the three ways that bundle's own evidence columns
  misled a diligent reader.
- **§1a M18/M19** — paying the booking fee does not block the supplier's calendar (owner ruling the
  code does not follow); a send-sourced fee charge still dies with its proposal, which the migration
  that fixed the other half names as unfinished in its own comment.
- **§6** — five further open owner questions, including whether "0% commission" is the promise to
  keep beside a 5% booking fee.
- `docs/handoff-2026-09-21/` now also carries four ready-to-dispatch build briefs and the rules for
  bundling several builds into one PR. **They are documentation of how each item would be done — no
  build was dispatched.**

SPEC IMPACT: None. The open questions in §6 are recorded as open, not answered.

## 2026-09-21 · docs(handoff): the merge plan now rests on a measurement, not an assumption

The plan said "cost is charged per merge". Re-measured against the live Vercel deployment list, the
precise statement is: a push to a `claude/*` branch is created and **immediately CANCELED** by
`apps/web/vercel.json`'s `ignoreCommand`, so updating an open PR costs nothing; **a merge to `main`
produces one READY production build of the whole app**, and that is the entire bill. Six such builds
were observed in one ninety-minute window.

Consequence now stated in the plan: **there is never a reason to open a second PR for work that
belongs in one already open.**

Also records why `main` builds unconditionally even for documentation — the 2026-08-07 incident where
the rule asked "did the last commit touch the app?", answered no for a CI-only fix, and left
production 35 files behind with nothing saying so — and names `turbo-ignore` as the principled fix,
explicitly scoped as its own change rather than a side effect of this plan.

SPEC IMPACT: None.
