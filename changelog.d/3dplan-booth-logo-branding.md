# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-04 · feat(seating-3d): Pro/Enterprise vendors brand their 3D booth with their logo

Owner directive (2026-07-04): "booth customization is for pro and enterprise. free and solo, just generic no customization." Booth branding is now a **pro / enterprise** perk — those tiers get their logo textured onto their 3D booth's backdrop; **free / verified / solo** render the generic booth.

- **`lib/seating-3d.ts`**: `BoothVendor` gains `tier?: string | null`; new `boothCanBrand(tier)` = `tier === 'pro' || 'enterprise'` — the single gate shared by every 3D surface's `BoothMesh`.
- **`venue-objects.tsx`**: new `BoothSign` — an accent-framed backdrop board behind the booth carrying the vendor's logo, loaded via a manual `TextureLoader` (no Suspense boundary in these scenes), **aspect-preserving** (a wordmark isn't stretched), sRGB, and it drops silently if the image is blocked/broken. `BoothMesh` renders it only when `boothCanBrand(booth.vendor?.tier) && booth.vendor?.logoUrl`.
- **`lib/seating.ts` `fetchBooths`**: the vendor embed now selects `tier_state` and carries `tier` on the booth's vendor (the authenticated couple-lab path).
- **Surfaces wired**: couple **lab** (`seating/lab/page.tsx`) and the homepage **3D-Plan demo** (`plan3d-demo-actions.ts`, which loads the sample event via `fetchBooths(admin, …)`) both thread `tier` → branded booths render for pro/enterprise vendors.

**Follow-up (flagged):** the PUBLIC guest venue walk (`/[slug]/venue`) sources its scene from the `public_venue_scene` `SECURITY DEFINER` RPC (anon guests can't read `vendor_profiles.tier_state` directly under RLS), so it currently renders every booth generic. Branding it needs one added line in that RPC — `'tier', vp.tier_state` in the booth `jsonb_build_object` (it already joins `vp` for `logo_url`). Deferred to keep this PR off an 8720-char `CREATE OR REPLACE` of a security-definer function; the `boothCanBrand(undefined) === false` fallback makes the public walk safe (generic) until then.

SPEC IMPACT: None — additive tier-gated branding on the shipped 3D booth system; no schema, no pricing change.
