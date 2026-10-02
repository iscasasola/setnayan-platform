## 2026-10-02 · fix(admin-pricing): saving a price no longer takes the product off sale

The /admin/pricing row card has no on-sale checkbox, but `saveRetailRow`,
`saveBundleRow` and `saveVendorRow` still read an `active` checkbox from the
form. Absent means false, so every "Save this price" — even a rename — wrote
`is_active = false`. Measured in prod: LIVE_STUDIO ("Live Watch") and
LIVE_STUDIO_HOSTED_CHANNEL went off sale at the second they were renamed
(2026-09-30 19:01 UTC), `retired_at` null.

- The three saves no longer read, compare or write `is_active`; on-sale state
  changes only through Retire / Put back on sale. `validateRetailRowFields`'
  payload has no `is_active`, so the two-admin "save the copy now" write is
  covered too.
- Migration `a_save_took_live_watch_off_sale` puts back on sale exactly
  LIVE_STUDIO and LIVE_STUDIO_HOSTED_CHANNEL (guarded by the bug's signature:
  off sale, `retired_at` null, touched after the row card shipped). The four
  other rows with that signature (SETNAYAN_AI_C/D, SEATING_3D,
  CUSTOM_QR_GUEST) were turned off on purpose and are left alone.
- Tests: `app/admin/pricing/a-save-keeps-on-sale.test.ts`,
  `tests/db/a-save-keeps-on-sale.db.test.ts`. Admin job map regenerated.

SPEC IMPACT: None
