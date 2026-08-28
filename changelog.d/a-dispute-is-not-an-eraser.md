## 2026-08-28 · feat(disputes): Setnayan settles a refused downpayment by hand

A supplier saying *"the downpayment never reached me"* now raises a question
Setnayan can answer. Before this it reached the couple and **nobody else** —
there was no queue, no surface and no function with which to "confirm it
manually", so the two parties were left disagreeing about money with no referee.

Owner 2026-08-28: *"no. do not. we will confirm it manually."*

- New settlement columns on `event_vendors` + `settle_vendor_deposit_dispute`
  (admin-only, `SECURITY DEFINER`). Two outcomes — the payment stands, or it did
  not arrive — and **neither deletes the couple's amount, receipt, method or
  ledger row.**
- `/admin/disputes` grows a section for them; the `disputes` queue badge counts
  both kinds through the sanctioned `digest` escape hatch, so it cannot
  undercount its own page.
- Both parties are told, reusing `dispute_resolved` — an existing, already
  email-enabled notification type that had **zero emit sites**. No enum
  migration.
- Corrects a docblock that still described the erasure PR #4927 removed.

**RULE 0:** the destruction this was scoped around was ALREADY FIXED (PR #4927,
verified in prod by `pg_get_functiondef`, not by the original migration file).

SPEC IMPACT: `WHATS_NEXT_Shop_Redesign_SESSIONS_2026-08-28.md` (S1 premise
corrected) + `DECISION_LOG.md` row.
