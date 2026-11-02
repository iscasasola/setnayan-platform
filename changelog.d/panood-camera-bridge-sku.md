## 2026-06-26 · pricing(panood): add a separate Panood Camera Bridge SKU @ ₱200/cam/day

Owner 2026-06-26: "we will also add camera bridge here [Panood] 200/camera."
Panood gets its **own** camera-bridge SKU, separate from Papic's.

- **New** `PANOOD_CAMERA_BRIDGE` — "Panood Camera Bridge (per camera, per day)" @
  **₱200/cam/day** (connect a DSLR/external camera into the multicam control room;
  the phone-camera QR join stays free).
- **Papic's `CAMERA_BRIDGE` stays ₱100/seat/day** — reverted my earlier reprice
  that had mistakenly applied the Panood ₱200 to the shared/Papic SKU.

Both applied live to `platform_retail_catalog_v2` via SQL (db push creds stale);
migration `20270302400000_panood_camera_bridge_sku.sql` mirrors the new SKU.
Not added to any bundle (per-camera/per-day variable SKU; bundling is the owner's
call). App reads prices live — no code change.

SPEC IMPACT: `Pricing.md` — two separate bridge SKUs (Papic ₱100/seat/day ·
Panood ₱200/cam/day); DECISION_LOG 2026-06-26.
