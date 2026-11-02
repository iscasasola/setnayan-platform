## 2026-06-26 · fix(money): self-comp quota race + re-lock balance (bug-hunt batch 2)

Two more confirmed money-path bug-hunt findings (lower-severity than the PR #2238
security cluster). Migration already applied to prod.

- **#4/#14 — self-comp quota TOCTOU.** `enforce_vendor_self_comp_quota` (BEFORE
  INSERT on `comp_grants`) counted-then-checked the quarterly cap with no
  serialization, so two concurrent self-comps could both read `count<cap` and both
  insert, exceeding the cap. Added a transaction-scoped `pg_advisory_xact_lock`
  keyed on `(vendor_profile_id, quarter)` before the count, so concurrent inserts
  serialize and the cap holds.
- **#15 — re-lock showed a fresh balance as settled.** `finalizeVendor` re-snapshots
  a payment plan's `instances_json` on re-lock but left `cleared_at` intact, so a
  previously-cleared plan with a freshly-recomputed (larger) balance displayed as
  fully settled. The upsert now resets `cleared_at = null` / `cleared_by = null`
  (via the service-role `planAdmin`, which bypasses the #10 write-guard) so a
  re-snapshot starts uncleared; the couple re-confirms through the gated path.

SPEC IMPACT: None. Remaining bug-hunt findings tracked separately (#3 BIR receipt
base — owner sign-off pending; #6/#7 pax-surcharge re-baseline; #8 stale-proposal
supersede; #9 client-trusted price; #12 discount cap atomicity; #13 cross-event
order) — spun off as background tasks.
