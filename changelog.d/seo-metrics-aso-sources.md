## 2026-07-10 · feat(seo): seo_metrics accepts app-store sources (ASO future-proofing)

Owner 2026-07-10 ("APO is for apps search?" — ASO, App Store Optimization). Widens the `seo_metrics.source` CHECK from `('gsc','bing')` to `('gsc','bing','app_store','play_store')` so the `/admin/seo` metrics table can later receive App Store Connect / Google Play Developer API pulls (rankings · ratings · impressions) with no schema change — the future ASO cron becomes an insert.

Schema-only, additive, reversible. **No ASO pull ships yet** — deliberately: the native iOS/Android apps have no live store listings until the Dec 2026 launch (web-first V1), so there is nothing to read. Migration `20270710700200` applied live.

SPEC IMPACT: None (internal ops schema; ASO monitoring queued for when store listings go live — ties to 0052_native_apps_delivery).
