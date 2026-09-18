## 2026-09-18 · docs(register): re-measure all 60 LAU-* launch-readiness rows

Re-checked every LAU-1…LAU-60 row in `build-sessions/HANDOFF-2026-09-18/REFERENCE/ONE_REGISTER.md`
against `origin/main` (= served sha `2c3b0dd`), the live Supabase DB and `gh`/branch-protection
state. Result written to `build-sessions/REGISTER-SWEEP-2026-09-18.md`. Read-only — no application
code touched.

Headline finding: **LAU-20 is a confirmed live production bug**, not a "needs measuring" row — a
later fraud-enforcement migration (`20270518682623`) silently dropped the CHECK-constraint value a
sponsored journal-spotlight approval needs to insert. 18 rows were already DONE and served (several
mistagged NOT BUILT/BLOCKED), 6 rows misdescribed their own mechanism or premise, and SUP-\*/DAY-\*/
DSK-\* (390 of 456 total register rows) were not reached this session — flagged for a follow-up
sweep.

SPEC IMPACT: None (internal build-tracking register only, not the product spec corpus).
