-- a save took live watch off sale — put back on sale exactly the rows the
-- admin "Save this price" bug switched off.
--
-- ── THE BUG ───────────────────────────────────────────────────────────────
-- The per-row card on /admin/pricing (catalog-editor.tsx, shipped to main by
-- PR #4924 on 2026-08-28 03:36 UTC) has NO on-sale checkbox, but
-- saveRetailRow / saveBundleRow / saveVendorRow still read an `active`
-- checkbox from the form. The field was never there, so it read FALSE on every
-- save and wrote `is_active = false`. Any save — even a rename — took the
-- product off sale. The code fix (same PR as this file) removes the field from
-- the save path entirely; on-sale state now changes only through Retire /
-- Put back on sale.
--
-- ── THE SIGNATURE ────────────────────────────────────────────────────────
-- A real retire stamps `retired_at`. This bug flipped `is_active` and left
-- `retired_at` NULL. Measured in production 2026-10-02 (read-only):
--   is_active = false AND retired_at IS NULL AND updated_at > 2026-08-28 03:36 UTC
-- matches six retail rows and zero bundle / supplier rows:
--   SETNAYAN_AI_C, SETNAYAN_AI_D         — deliberately off (AI tiers)          → LEFT
--   SEATING_3D                           — deliberately off                     → LEFT
--   CUSTOM_QR_GUEST                      — folded into Pro 2026-09-27/28        → LEFT
--   LIVE_STUDIO                          — off at the rename to "Live Watch"    → RESTORED
--   LIVE_STUDIO_HOSTED_CHANNEL           — off at the rename to "Live Watch"    → RESTORED
-- admin_audit_log confirms it: since 2026-08-27 the ONLY save-path edits that
-- moved is_active are `v2_retail_sku_edit` on these two codes
-- (2026-09-30 19:01:18 and 19:01:39 UTC), each before.is_active = true,
-- after.is_active = false, with the title changing "Live Studio" → "Live Watch".
--
-- Both are meant to be on sale (DECISION_LOG): Live Watch is the ₱2,500
-- one-time unlock; the hosted channel is the optional per-day add-on put on
-- sale by migration 20271200509567. Never quote a price from this comment —
-- `platform_retail_catalog_v2` is the only price a customer is charged.
--
-- ── WHY AN EXPLICIT LIST, NOT THE SIGNATURE ALONE ─────────────────────────
-- The signature also matches four rows a person turned off on purpose. A
-- predicate cannot tell those apart; the audit log can, and it named two. The
-- signature is kept as a GUARD on top of the list, so a row that has since been
-- retired properly (retired_at stamped) or put back on sale is left untouched.
--
-- Idempotent: a second run matches nothing (is_active is already true).
-- Pinned by apps/web/tests/db/a-save-keeps-on-sale.db.test.ts.

UPDATE public.platform_retail_catalog_v2
   SET is_active  = TRUE,
       updated_at = NOW()
 WHERE service_code IN ('LIVE_STUDIO', 'LIVE_STUDIO_HOSTED_CHANNEL')
   AND is_active  = FALSE
   AND retired_at IS NULL
   AND updated_at > TIMESTAMPTZ '2026-08-28 03:36:28+00';
