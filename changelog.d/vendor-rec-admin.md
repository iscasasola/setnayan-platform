## 2026-06-30 · feat(vendor): recommend-to-couples engine — Phase 2 data layer (two-way curation)

Builds on Phase 1. Adds the two tables the owner-decided **two-way** curation
model needs:

- `vendor_recommendation_feedback` — vendors flag `not_a_fit` / `suggest_add`
  against their leaf → an admin review queue (mirrors `taxonomy_category_requests`
  governance). Vendor-owned RLS (own rows select/insert; admin sees all).
- `vendor_recommendation_optins` — per-vendor enabled state for `is_opt_in`
  (cannibalization-risk) SKUs. Absent row = not opted in = hidden. Vendor-owned RLS.

Migration `20270326230210_vendor_recommendation_feedback_and_optins.sql`. Applied
to prod + ledger recorded. **Lands INERT** — the admin curation surface + queue
(rest of Phase 2) and the vendor panel (Phase 3) read these.

SPEC IMPACT: Decision logged in corpus `DECISION_LOG.md` (2026-06-30 — curation
model = two-way).

## 2026-06-30 · feat(admin): vendor recommendations map editor + curation queue

New admin surface at `/admin/vendor-recommendations` — the Phase 2 UI on top of
the tables above.

- **page.tsx** (server, admin-gated via the shared `requireAdmin()` pattern):
  reads `vendor_service_recommendations` joined to SKU titles
  (`platform_retail_catalog_v2`) + leaf labels (`service_categories.label_en`,
  tier 2), grouped by leaf then priority; loads the tier-2 leaf picker, the
  active-SKU picker, and the pending `vendor_recommendation_feedback` queue
  (vendor business name via `vendor_profiles.business_name` + SKU title).
- **actions.ts** — `addRecommendation` (UNIQUE-safe upsert/ignore),
  `updateRecommendation`, `deleteRecommendation`, and `resolveFeedback`
  (accept `suggest_add` → upsert into the map; accept `not_a_fit` → deactivate
  the matching map row; always stamp status + resolver + resolved_at). All
  service-role writes, best-effort `admin_audit_log`, `revalidatePath`.
- **_editor.tsx** — client islands (row editor, add form, feedback Accept/Decline
  cards) reusing `ConfirmForm` / `SubmitButton` + existing palette primitives.
- **Nav:** registered `admin.sidebar.vendor-recommendations` in
  `ADMIN_NAV_GROUPS` (Monetization group, after Add-ons, `Lightbulb` icon) and
  the matching slot default in `lib/nav-registry-defaults.ts` so the registry
  overlay (/admin/menus) governs its label + icon.

SPEC IMPACT: None. New admin surface on already-applied tables; no schema,
pricing, SKU, or product-lock change. (Phase 3 vendor-facing panel still pending.)
