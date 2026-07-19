## 2026-07-02 · feat(vendor-dashboard): Locked QR captures what the couple availed + the agreed wedding date (PR2)

A Locked QR is a real booking, so it now records the deal, not just a price.

- **Migration `20270426214000`** adds two columns to `vendor_locked_qr_tokens`:
  `service_description` (what the couple availed — a plain-text scope of work)
  and `event_date` (the agreed wedding date). Both NULLABLE at the DB layer for
  backfill safety; new issuance REQUIRES them. Additive, idempotent, no RLS change.
- **`LockedQrGenerator`** gains a required "Wedding date" field and a required
  "What the couple availed" textarea (frozen onto the couple's plan — they see it
  as their scope of work).
- **`issueLockedQr`** validates both (fails fast on blank / bad date) and persists
  them; the issued-QR confirmation now shows the wedding date + the scope of work.

SPEC IMPACT: Vendor dashboard § Locked QR — the token now carries scope + date.
Logged in DECISION_LOG.md (2026-07-02). The couple-facing half (freezing the
description onto the booking + resolving the date on scan) lands in PR3.
⚠ Migration NOT yet applied to prod — apply via `supabase db push` (code reads
tolerantly: legacy/pre-migration tokens keep NULL and behave as before).
