-- Owner ruling, 13 Nov 2026 (verbatim): "event plus 1000, event pro 2000, event ultra 3500".
-- Event Ultra (3500) is a future plan with no catalogue row yet; none is created here.
-- Event Plus (EVENT_PLUS) included Papic credits 100 -> 1000.
-- Event Pro (COUPLE_WEBSITE_PRO) included Papic credits 1000 -> 2000.
-- DECISION_LOG row 2026-11-13 "PAPIC CREDITS IN THE EVENT PLANS".

UPDATE public.platform_retail_catalog_v2
   SET included_papic_credits = 1000, updated_at = now()
 WHERE service_code = 'EVENT_PLUS';

UPDATE public.platform_retail_catalog_v2
   SET included_papic_credits = 2000, updated_at = now()
 WHERE service_code = 'COUPLE_WEBSITE_PRO';
