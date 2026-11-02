## 2026-07-09 · feat(pricing): Live Studio device tiers (Mobile ₱1,299/day · Desktop ₱2,499/day)

Repackage the single Panood multicam catalog SKU into two device tiers on the public `/pricing` catalog, per the owner decision (`Live_Studio_Repackaging_2026-07-08.md`):

- `PANOOD_SYSTEM` → **Live Studio — Desktop Controller** ₱2,499/day (was "Panood Multi-Cam Live Broadcast Engine" ₱3,499), `billing_period='per_day'`, ≤8 cams, offline-capable.
- New `PANOOD_SYSTEM_MOBILE` → **Live Studio — Mobile Controller** ₱1,299/day, ≤3 cams, online-only.
- Both stay non-purchasable **"In build"** via `BUILD_STATUS` in `apps/web/lib/v2-catalog.ts` — the controller video build + a real-event test gate come before "buyable".

Migration `20270526326110_live_studio_device_tiers.sql` carries the catalog change; it reaches prod on the next `supabase db push` (DB apply is a manual owner step in this repo). Camera Bridge reprice (₱499, independent) is handled by the Papic session's own PR to avoid a collision.

SPEC IMPACT: None new — this lands the catalog half of the already-recorded Live Studio repackaging (`DECISION_LOG.md` 2026-07-08, `Live_Studio_Repackaging_2026-07-08.md`, `Pricing.md` §00/§2.2).
