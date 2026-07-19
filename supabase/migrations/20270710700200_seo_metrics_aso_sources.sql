-- Widen seo_metrics.source to accept app-store search metrics (owner 2026-07-10:
-- "APO is for apps search?" — ASO, App Store Optimization).
--
-- Future-proofing only: no ASO pull ships yet (the native iOS/Android apps have
-- no live store listings until the Dec 2026 launch — web-first V1). This just
-- makes the seo_metrics schema ready to receive App Store Connect / Google Play
-- Developer API pulls (rankings · ratings · impressions) on the SAME table the
-- /admin/seo trend already reads, so the later ASO cron is an insert, not a
-- schema change. Additive + reversible; no data touched.
ALTER TABLE public.seo_metrics DROP CONSTRAINT IF EXISTS seo_metrics_source_check;
ALTER TABLE public.seo_metrics
  ADD CONSTRAINT seo_metrics_source_check
  CHECK (source IN ('gsc', 'bing', 'app_store', 'play_store'));
