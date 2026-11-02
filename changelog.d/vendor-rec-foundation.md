## 2026-06-30 · feat(vendor): vendor "recommend to your couples" engine — Phase 1 foundation

Adds the admin-editable `vendor_service_recommendations` map — vendor leaf
(`service_categories` tier-2 `tile_id`) → recommendable Setnayan SKU
(`platform_retail_catalog_v2.service_code`) — seeded with the refined complement
map (45 rows / 16 leaves). Governing rule: a SKU appears for a leaf only when it
amplifies that vendor's OWN deliverable; the map is deliberately sparse (most of
the ~50 leaves get nothing). `is_opt_in` flags cannibalization-risk SKUs (off by
default) — Papic is opt-in for capture leaves (`photo_video`, `photo_booth`).

Migration `20270325000000_vendor_service_recommendations.sql`: table + public-read
RLS (mirrors the catalog; writes via service-role admin client) + idempotent seed.
**Lands INERT** — nothing reads the table yet. Admin curation surface = Phase 2,
vendor-facing "Recommend to your couples" panel = Phase 3.

SPEC IMPACT: Decision logged in corpus `DECISION_LOG.md` (2026-06-30 — vendor
recommendation engine design + cannibalization opt-in rule). No iteration-spec
rewrite needed yet; the vendor-facing surface will land with Phase 3.
