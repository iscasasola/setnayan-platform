## 2026-07-12 · fix(anti-fraud): Phase B hardening — money-path fixes from adversarial review

Adversarial review of the Phase B token-hold system (PR #3133) found no double-charge, lost-token, false-block, or apply-failure, and confirmed idempotency/races/gates/RLS are correct — but flagged two UNDER-charge gaps (both vendor-favorable, never couple-facing). This closes them via a superseding migration (`CREATE OR REPLACE`; the merged `20270726988829` is not mutated).

- **FIX 1 (concurrency)** — `unlock_vendor_event_hold`'s reservation now locks the wallet row `FOR UPDATE` before reading the held sum, so two concurrent accepts by the same vendor can't both pass `available − held ≥ tokens` and over-hold past the balance (which would strand one genuine lead's charge).
- **FIX 2 (verified quota)** — `release_lead_token_hold` + `sweep_ghosted_lead_holds` now DELETE the `vendor_event_unlocks` row created at accept (tokens_burned=0, never charged). Otherwise a verified vendor's 10/week cap — which COUNTs unlock rows — would be drained by ghosted fakes even though none were paid for. The chat gate keys on `chat_threads.inquiry_status`, not this row, so removing it is safe.

Documented (not fixed — accepted v1, vendor-favorable, rare): a ghost-then-return couple after release, or a vendor who drains their balance between hold and reply, yields one un-charged real lead. Operational note added to the migration: don't toggle the flag OFF while holds are outstanding.

SPEC IMPACT: None (hardening of the flag-off Phase-B hold mechanic; no schema/pricing/behavior change until the owner applies + flips `NEXT_PUBLIC_LEAD_TOKEN_HOLD_ENABLED`). Both original Phase-B migrations are still unapplied.
