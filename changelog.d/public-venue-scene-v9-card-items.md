## 2026-07-21 · fix(plan3d): guests get the full booth card — `public_venue_scene` v9 carries `cardItems`

Follow-up to v8 (booth `tier`/`slug`/`bookable`). v8 lit up booth branding on the public guest walk; the same RPC still omitted `cardItems`, so **guests — the highest-intent viewers — saw the thinnest booth card** while the couple's lab and the authenticated scene showed the full "what you get" list. The 2026-07-19 council verdict flagged exactly this: *"the first fix is a BUG, not a feature."*

**v9 is a faithful plpgsql port of `lib/vendor-services.ts` `fetchBoothCardItems`.** Resolution per booth, in precedence order:

1. the chosen listing's `vendor_service_inclusions` (`label` + `worth_php`), ordered by `sort_order`;
2. else that listing's legacy `package_inclusions` JSONB — strings become `{label}`, objects become `{label, worthPhp}` where `worth_php` is a number `> 0` (`parsePackageInclusions`, verbatim);
3. else the host-authored `event_vendors.host_inclusions[]` (DIY parity — always empty on marketplace rows).

"The chosen listing" is the linked profile's ACTIVE `vendor_services` rows, oldest first, category match preferred — expressed as `ORDER BY (s.category = ev.category::text) DESC, s.created_at ASC LIMIT 1`, which is `list.find(c => c.category === ev.category) ?? list[0]` over a `created_at ASC` list. `vendor_services` is `UNIQUE (vendor_profile_id, category)`, so the preferred match is unique when it exists. `is_active` is `NOT NULL BOOLEAN`, so a plain truth test matches the TS `=== false` skip exactly.

**Fail-soft is preserved structurally, not by a `try`.** Every rung is a scalar subquery that yields NULL when it has no rows, so `COALESCE` falls through exactly like the TS `items.length === 0` checks, and all-NULL ⇒ `'cardItems': null`, matching `boothCardItems.get(booth_id) ?? null`. A booth with no `event_vendor_id`, a manual/off-platform vendor, or a linked profile with no active listing each degrade to null rather than erroring the scene.

Idempotent `CREATE OR REPLACE`, identical to v8 apart from the added `'cardItems'` key and the two LATERAL joins that feed it (verified by diffing the function bodies). Signature unchanged; `STABLE SECURITY DEFINER`, `search_path` and every v6–v8 join preserved. `Lab3DBooth.cardItems` already exists and is optional, and `/api/venue-scene` spreads the payload, so **no client change**. Not PII — inclusions are public marketing copy already served on `/v/[slug]`, and `vendor_service_inclusions` carries a public-read RLS policy.

**Also fixed — `/api/venue-scene` returned raw booth logo refs.** `vendor_profiles.logo_url` is whatever the vendor uploaded (usually `r2://bucket/key`), and `BoothSign` feeds the value straight to `THREE.TextureLoader`, which cannot resolve an `r2://` ref. `/[slug]/venue/page.tsx` already resolves booth logos server-side; the API route resolved only guest `photos`. This was latent — before v8 the route never returned `tier`, so `boothCanBrand` was always false and the branded backdrop never mounted — and v8 made it reachable. Added `resolveBoothLogos`, mirroring the existing `resolveScenePhotos` shape; failed refs drop to null → the generic booth, the same outcome as an unbranded tier. The route currently has no in-app callers, so this is a correctness fix on a public surface rather than a user-visible one.

SPEC IMPACT: None — `Booth_and_Avatar_Build_Plan_2026-07-21.md` §A2b already scoped this port; it is now shipped.
