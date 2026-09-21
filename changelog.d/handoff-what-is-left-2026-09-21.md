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
