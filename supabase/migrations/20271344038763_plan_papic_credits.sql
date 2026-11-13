-- Owner ruling, 13 Nov 2026 (verbatim): "event plus make it 1000 / event pro make it 3000".
-- Event Plus (EVENT_PLUS) included Papic credits 100 -> 1000.
-- Event Pro (COUPLE_WEBSITE_PRO) included Papic credits 1000 -> 3000.
-- DECISION_LOG row 2026-11-13 "PAPIC CREDITS IN THE EVENT PLANS".

UPDATE public.platform_retail_catalog_v2
   SET included_papic_credits = 1000, updated_at = now()
 WHERE service_code = 'EVENT_PLUS';

UPDATE public.platform_retail_catalog_v2
   SET included_papic_credits = 3000, updated_at = now()
 WHERE service_code = 'COUPLE_WEBSITE_PRO';
