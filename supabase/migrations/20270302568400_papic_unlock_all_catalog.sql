-- Papic "Unlock All" — the Papic-vertical everything-pass (owner 2026-06-26).
--
-- One purchase unlocks ALL Papic features for an event, and ONLY Papic: every
-- camera shoots unlimited (no per-camera/day quota, no per-camera charge, the
-- guest 150-credit cap lifted), Camera Bridge is included unlimited, and every
-- paid add-on is owned (Kwento, Photo Wall, Thank You, Stories, Pabati, SDE,
-- Patiktok). The entitlement override lives in apps/web/lib/entitlements.ts
-- (PAPIC_UNLOCK_ALL_GRANTS — allowlist-scoped so it can never confer a non-Papic
-- SKU); the metered-allowance bypasses live in lib/papic-cameras call sites and
-- the papic_record_guest_capture RPC (sibling migration).
--
-- PRICE IS PROVISIONAL + ADMIN-MANAGED. The ₱15,000 seed below is the holistic-
-- pass placeholder (= Unli cap ₱10,000 + ~₱5,000 of add-ons, framed as a
-- cap/discount since à-la-carte now sums higher); the owner dials the real price
-- at /admin/pricing. ON CONFLICT therefore does NOT clobber an admin-edited
-- price/title — it only re-asserts the row is active.
--
-- Additive + idempotent. No RLS change (platform_retail_catalog_v2 keeps its
-- existing read policy). Mirrors the KWENTO seed shape (20270302568299).

insert into public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php,
   is_token_able, description, is_pax_priced, is_active)
values
  ('PAPIC_UNLOCK_ALL', 'Papic Unlock All', 15000, 0,
   false,
   'Unlock every Papic feature for your event in one purchase — unlimited guest cameras, unlimited Camera Bridge, and every add-on (Kwento, Photo Wall, Thank You, Stories, Pabati, SDE, and more). Everything on, all event long.',
   false, true)
on conflict (service_code) do update
  set is_active  = true,
      updated_at = now();
