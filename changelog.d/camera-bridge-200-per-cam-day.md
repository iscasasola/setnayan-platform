## 2026-06-26 · pricing(panood): Camera Bridge → ₱200 per camera, per day

Owner-set in the Panood multicam context. The `CAMERA_BRIDGE` catalog SKU
(shared DSLR/external-camera bridge for Papic + Panood) repriced from
₱100/seat/day to **₱200/cam/day**; title clarified to "per camera, per day".
Applied live to `platform_retail_catalog_v2` via SQL (db push creds stale);
migration `20270302400000_camera_bridge_200_per_cam_day.sql` mirrors it. App
reads the price live from the catalog — no code change. The ₱2,000 daily cap is
unchanged (= 10 cams/day at the new rate).

SPEC IMPACT: `Pricing.md` Camera Bridge entries updated to ₱200/cam/day;
DECISION_LOG row 2026-06-26.
