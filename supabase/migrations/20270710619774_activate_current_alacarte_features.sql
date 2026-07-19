-- Activate the three built-but-hidden current à-la-carte features so they
-- surface on /pricing and in the in-dashboard service picker (owner
-- "all our features should now be active" · 2026-07-10).
--
-- These were is_active=false — the pricing reader (lib/v2-catalog.ts
-- fetchV2CustomerCatalog) filters .eq('is_active', true), so a false row is
-- invisible everywhere. Flipping them true is the only lever that reveals
-- them; the "Live / In build" chip is a separate, code-side signal
-- (BUILD_STATUS map) updated in the same PR.
--
-- Scope is DELIBERATELY the 3 current features only. The other ~16
-- is_active=false rows are RETIRED/superseded SKUs (old RSVP/Website
-- standalones collapsed into COUPLE_WEBSITE_PRO, Papic Guest/Seats, SDE,
-- Call-Time Escalator, Today's Focus, High-Res Archive, Indoor Blueprint,
-- website granular unbundles) and MUST stay off — reactivating them would
-- resurrect products the decision log retired (owner confirmed 2026-07-10).

update public.platform_retail_catalog_v2
set is_active = true,
    updated_at = now()
where service_code in ('SEATING_3D', 'PAPIC_ADDON_STORIES', 'PAPIC_ADDON_THANK_YOU')
  and is_active = false;
