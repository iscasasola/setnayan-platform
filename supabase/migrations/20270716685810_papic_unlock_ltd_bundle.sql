-- Papic "Unlock all (Ltd)" bundle — owner-set 2026-07-11
-- (Pricing.md § 2.1 · DECISION_LOG 2026-07-11 · 0012_papic build plan WS1b)
--
-- The Ltd-based twin of PAPIC_UNLOCK. "Unlock all of Papic" is two tiers:
--   • PAPIC_UNLOCK      ₱15,000 — frees UNLIMITED (Unli) capture + Photo Wall + Camera Bridge
--   • PAPIC_UNLOCK_LTD  ₱9,000  — frees LIMITED  (Ltd/Roll) capture + Photo Wall + Camera Bridge
-- Both = the à-la-carte sum of their parts (Unli 11,999 + 2,500 + 500 = 14,999→15,000;
-- Ltd 5,999 + 2,500 + 500 = 8,999→9,000): a one-click convenience bundle + all-in
-- daily ceiling, NOT a discount.
--
-- The Ltd capture free is a separate capture-gate bypass (eventLtdFreeViaUnlock in
-- lib/papic-cameras.ts) mirroring the Unli one — the meaningful paid add-ons it
-- grants (Photo Wall + Camera Bridge) ride the single-source bundle_components
-- table, which public.bundles_granting_sku() reads dynamically (no fn re-declare).
-- Idempotent.

-- 1. Sellable package row -----------------------------------------------------
insert into public.platform_package_catalog
  (package_code, title, retail_price_php, is_active, description)
values
  ('PAPIC_UNLOCK_LTD', 'Unlock all of Papic (Ltd)', 9000, true,
   'Everything Papic on the Limited tier in one: Papic Ltd cameras for the whole wedding (30 photos + 10 clips each) plus the Live Photo Wall and the DSLR Camera Bridge. The Unlimited-tier unlock is the separate ₱15,000 pass.')
on conflict (package_code) do update
  set retail_price_php = excluded.retail_price_php,
      title            = excluded.title,
      description       = excluded.description,
      is_active         = true,
      updated_at        = now();

-- 2. Bundle composition (single source read by bundles_granting_sku) ----------
-- Grants the two meaningful paid Papic add-ons (the others — Kwento, Pabati,
-- Stories — are FREE now, and Thank-You / Guest are retired, so they need no grant).
insert into public.bundle_components (bundle_sku_code, component_service_code)
values
  ('PAPIC_UNLOCK_LTD', 'LIVE_WALL'),
  ('PAPIC_UNLOCK_LTD', 'CAMERA_BRIDGE')
on conflict (bundle_sku_code, component_service_code) do nothing;
