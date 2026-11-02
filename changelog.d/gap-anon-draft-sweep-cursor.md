## 2026-07-24 · fix(privacy): stop the anon-draft deletion sweep from wedging (gap audit)

Gap audit 2026-07-23. `runAnonDraftSweep` (RA 10173 data-minimization — deletes
abandoned anonymous drafts holding third-party guest PII) selected candidate
`users` rows with `.limit(50)` and NO `.order()`, so Postgres returned the same
physical-order rows every run. Four `continue` paths skip a row WITHOUT mutating
it — the worst being a CONVERTED (real) account whose real email never overwrote
the placeholder, a PERMANENT skip. Once ≥50 such sticky rows sit at the head of
the unordered window, the sweep re-reads them forever and never reaches the
deletable drafts behind them → abandoned PII persists indefinitely.

Fix (the audit's cursor option, twin of the fullres-drop fix):
- Migration `20270924201580` adds `anon_sweep_skipped_at TIMESTAMPTZ` to
  `public.users`.
- The sweep orders by `(anon_sweep_skipped_at ASC NULLS FIRST, created_at ASC)`
  and stamps the column `= now()` on EVERY skip path (non-anonymous, legal-hold,
  event-delete-fail, auth-delete-fail, unexpected error). A skipped row rotates
  to the back; never-/least-recently-skipped rows go first; a row that becomes
  deletable stops being re-stamped and gets swept.

Ships INERT: the column defaults NULL (= "never skipped", sorts first), so the
sweep behaves exactly as before until it stamps a skip. The cursor is
ordering-only and never gates deletion — nothing is deleted unsafely. The whole
anon-draft feature is flag-gated (`NEXT_PUBLIC_ANON_ONBOARDING_ENABLED`), so no
live rows are affected today.

Verified: tsc/lint clean · migration replays.

SPEC IMPACT: None — background-sweep robustness fix (RA 10173 deletion path).
