## 2026-06-30 · feat(vendor): "Recommend to your couples" panel (Phase 3a)

A new vendor-dashboard surface at `/vendor-dashboard/recommendations` where a
vendor sees a curated, read-mostly list of Setnayan SKUs that amplify their OWN
work — keyed to their own service leaves.

**How a vendor's leaves resolve.** `vendor_profiles.services` (a `text[]` of
`canonical_service` codes · confirmed shape via live prod) → DISTINCT `tile_id`s
via `canonical_service_taxonomy` (e.g. a `videography` vendor maps to the
`photo_video` tile). The admin map `vendor_service_recommendations` (read WHERE
`is_active` AND `tile_id IN` the vendor's leaves) decides which SKUs surface per
leaf, joined to SKU title/price (`platform_retail_catalog_v2`) and leaf label
(`service_categories.label_en`). Prices render via the shared
`formatSkuPriceLabel` from `lib/v2-catalog.ts` (no hand-formatted pesos).

**Three behaviors, grouped by leaf.** Always-on recs render as cards with the
rationale as "Why this helps you". Opt-in (cannibalization-risk) recs render as
"Overlaps your work" offers with a turn-on toggle; once enabled (a
`vendor_recommendation_optins` row) they move into the active list. Each card
carries a "Not a fit for me" flag and each leaf a "Suggest a service to
recommend" control — both write `vendor_recommendation_feedback` (`not_a_fit` /
`suggest_add`, `status='pending'`) for the admin review queue. A pending flag
shows "Flagged — pending review" instead. Empty leaves / no leaves → friendly
empty state. NO couple-facing output this phase.

**Writes are vendor-scoped under RLS.** Both server actions (`setOptIn`,
`flagFeedback`) use the normal user-scoped server client (`@/lib/supabase/server`,
NOT the admin client), resolve `vendor_profile_id` server-side from auth (never
from the form), and rely on the existing owner RLS policies. `setOptIn` upserts
ON CONFLICT (vendor_profile_id, tile_id, service_code); `flagFeedback` swallows
the UNIQUE-violation (23505) as already-flagged (idempotent). Both
`revalidatePath` the panel.

**Nav.** Registered the `recommendations` item in the vendor sidebar's "Grow"
group (`VENDOR_NAV_GROUPS` in `vendor-sidebar.tsx`) + a matching
`vendor.sidebar.recommendations` slot in `lib/nav-registry-defaults.ts`
(Lightbulb icon, already in the nav-icon resolver map), per the
lint-nav-icon-source delegation contract. Owner/admin only (key absent from
`VENDOR_SCOPED_NAV_ITEM_KEYS`).

Verified: typecheck, ESLint, lint:navicon, lint:botnav, lint:entitlement-gates,
and the production build all pass; the route appears in the build manifest as a
dynamic server route.

SPEC IMPACT: None. (New Phase-3a vendor surface over already-applied tables; no
SKU/price/schema decisions changed. The recommendation MAP content itself is
admin-curated data, not a spec lock.)
