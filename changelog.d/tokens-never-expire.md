## 2026-07-01 · change(vendors): tokens never expire

Owner 2026-07-01 ("no expiry for all tokens"). Purchased + teammate tokens
already never expired; this retires the last timer — the 45-day expiry on
earned/granted `earned_token_vouchers`.

- **Migration `20270406637718`**: `grant_admin_direct_tokens` now mints vouchers
  at a `2999-12-31` far-future sentinel (`p_ttl_days` retained for signature
  compat but ignored); every currently-live voucher is extended to the same
  sentinel (already-expired ones left dead, not resurrected). No change to
  `consume_vendor_assets_per_voucher` / `evaluate_earned_token_expiry` — they key
  on `expires_at > NOW()`, always true for the sentinel. `2999-…` is a real
  timestamp (NOT `'infinity'`) so the frontend `new Date()` never breaks.
- **UI**: the vendor token page voucher list renders **"never expires" / Permanent**
  for sentinel vouchers (year ≥ 2900); the admin grant form drops the
  "Available for (days)" field and notes grants never expire; the grant audit no
  longer records a `ttl_days`.

SPEC IMPACT: supersedes the 2026-05-28 "earned vouchers expire 45 days" lock —
logged in DECISION_LOG 2026-07-01; memory `project_setnayan_vendor_token_model`
updated (45-day earned-token expiry retired · all tokens permanent).
