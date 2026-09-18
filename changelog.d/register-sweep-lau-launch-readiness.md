## 2026-09-18 · docs(register): re-measure the entire 456-row build register (LAU/SUP/DAY/DSK)

Re-checked every row in `build-sessions/HANDOFF-2026-09-18/REFERENCE/ONE_REGISTER.md` — 60 LAU-*,
122 SUP-* (letter + numeric), 33 DAY-* and 17 DSK-* — against `origin/main`, the live Supabase DB,
production (`curl`), and `gh`/branch-protection state. Result written to
`build-sessions/REGISTER-SWEEP-2026-09-18.md`. Read-only — no application code touched (one DB test
suite was run against a throwaway worktree to verify the DATA-* deletion chain by actually deleting,
then pruned).

Headline findings:
- **LAU-20 and SUP-67 are both confirmed live, ungated bugs** — LAU-20: a later fraud-enforcement
  migration silently dropped the CHECK-constraint value a sponsored journal-spotlight approval needs
  to insert. SUP-67: deleting a manually-recorded supplier can silently cascade-destroy an
  already-logged payment row, because the delete-guard's protected-status list doesn't cover the
  status the "record a cost" flow actually produces.
- **The desktop app went live during this sweep**: the R2 release secrets landed 2026-09-14 and
  `/api/download/{mac,windows}` now serve real installers with a working auto-updater — the
  register's own most recent "verified 503" snapshot (2026-09-12) is now stale.
- A prior sweep's own "DONE" tag on DAY-10 was itself wrong — the cited PR removed a false claim
  rather than building the fix; the couple's shot list still never syncs.
- Dozens of rows across all four families flipped status in both directions (several secretly
  shipped, a handful mistagged their own mechanism); the full per-row evidence and a ranked list of
  follow-up prompts are in the register document.

SPEC IMPACT: None (internal build-tracking register only, not the product spec corpus).
