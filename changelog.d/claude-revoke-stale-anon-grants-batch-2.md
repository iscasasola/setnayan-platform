## 2026-08-02 · security(db): revoke stale `anon` table grants — batch 2, the 23 most sensitive

Batch 1 (`20271029105532`) closed 11 tables from the 202608xx–202609xx era. This is the next
reviewable batch: **23 tables** where `anon` holds at least one privilege and **zero RLS policies
admit `anon` or PUBLIC**, so the grant buys an anonymous caller nothing and only removes a layer of
defence. Prod-verified SELECT-only on 2026-08-02 before writing — `relrowsecurity = true` and
`anon`-admitting policy count `= 0` on all 23.

Chosen by **sensitivity**, not by era or alphabet:

- **Tier A — secrets / tokens / OAuth state (11):** `platform_integration_secrets`,
  `platform_secret_rotations`, `api_keys`, `oauth_grants`, `oauth_state`, `patiktok_oauth_grants`,
  `patiktok_oauth_state`, `vendor_ig_connections`, `vendor_ig_oauth_state`,
  `live_studio_channel_grants`, `live_studio_channel_oauth_state`.
- **Tier B — money (7):** `orders`, `order_ledger`, `order_refunds`, `payments`, `receipts`,
  `manual_payment_logs`, `vendor_payouts`.
- **Tier C — regulated personal data (2):** `user_face_profiles` (biometric — the account-side twin
  of batch 1's `guest_face_enrollments`), `dependents` (minors).
- **Tier D — admin / compliance state (3):** `admin_audit_log`, `admin_data_access_log`,
  `account_deletion_requests`.

Five of them (`platform_integration_secrets`, `platform_secret_rotations`, `manual_payment_logs`,
`live_studio_channel_grants`, `live_studio_channel_oauth_state`) have **no policies at all** — the
anon grant there is unambiguously dead weight.

No behaviour change, and it was checked rather than assumed: no browser/anon-session client
(`lib/supabase/client`) reads any of the 23 anywhere in `app`, `lib` or `components`; every reader
is `createAdminClient()` (service_role) or a `supabase/server` client behind an auth gate.
`authenticated` and `service_role` are untouched — the positive control **snapshots**
`authenticated`'s effective privileges before the revokes and diffs after, rather than hardcoding an
expectation, because `vendor_ig_connections` already grants `authenticated` nothing and a hardcoded
control would have failed on a table that is already correct.

No policy / `USING` / `WITH CHECK` edits. Exposure baseline regenerated in the same commit; the
delta attributable to this migration is **23 removed `tpriv` anon lines** plus 275 `col` lines whose
value narrows from `anon=SIU` to `anon=-` — zero widenings. (The regeneration also picks up 12
pre-existing `func` narrowings that earlier merged migrations left un-regenerated; noted in the PR
body, not caused here.)

Reported, not fixed: from the same default ACL `authenticated` also holds `TRUNCATE` on 21 of the 23
(all but `order_ledger` and `vendor_ig_connections`) and `REFERENCES`/`TRIGGER` on 22 of 23, and RLS
is never consulted for `TRUNCATE` — including on `admin_audit_log` and `payments`. That needs its
own diff. Remaining backlog after this batch: **213** tables.

SPEC IMPACT: None — privilege-layer hardening only; no product surface, pricing or entitlement
changes.
