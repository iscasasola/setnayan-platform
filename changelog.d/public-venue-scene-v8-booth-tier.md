## 2026-07-21 · fix(plan3d): public guest walk renders EVERY booth generic — `public_venue_scene` never selected the vendor's tier

**The bug.** Booth logo branding is a Pro/Enterprise perk (owner-locked 2026-07-04): `boothCanBrand(tier)` in `lib/seating-3d.ts` returns true only for `pro` / `enterprise`, and `BoothSign` (`plan3d/venue-objects.tsx`) then textures the vendor's `logo_url` onto the booth. That path is built, gated, and sold — and on `/[slug]/venue` it has **never rendered**.

The public guest walk sources from the `public_venue_scene` SECURITY DEFINER RPC, whose booth `vendor` block selected only `name` / `category` / `logoUrl`. No `tier` → `BoothVendor.tier` arrives `undefined` → `boothCanBrand(undefined)` is false → **every public booth falls back to the generic chassis**, for every vendor, at every tier. The same omission dropped `slug` and `bookable`, so the booth card's `/v/[slug]` profile CTA was dark too. The couple's lab and the authenticated scene were always correct (`lib/seating.ts` selects all three) — only the public payload was thin, which is precisely the surface guests see.

**The fix — `public_venue_scene` v8.** Three keys added to the booth vendor object, mirroring the authenticated path (`lib/seating.ts:1853-1856`) exactly:

- `tier` = `vendor_profiles.tier_state`
- `slug` = `business_slug` when `isPubliclyVisible(public_visibility)`
- `bookable` = `isBookable(public_visibility)`

with `lib/vendor-visibility.ts` semantics ported verbatim into SQL — `isPubliclyVisible := visibility IN ('coming_soon','verified')`, `isBookable := visibility = 'verified'`, and `parseVisibility(NULL) := 'coming_soon'` as the `COALESCE` default. A manual / off-platform booth (no `marketplace_vendor_id`, so the `vendor_profiles` join is NULL) still yields `tier` NULL, `slug` NULL, `bookable` false — unchanged behaviour, no new NULL-handling in the renderer. `BoothVendor` already declares all three as optional, so no client change is required and older cached scene payloads keep parsing.

Idempotent `CREATE OR REPLACE`, byte-identical to v7 apart from the vendor block (verified by diffing the function bodies). Signature unchanged; `STABLE SECURITY DEFINER`, `search_path`, and every v6/v7 join preserved. **No PII added** — `tier`, `slug` and `bookable` are the same three fields already public on `/v/[slug]`.

**Also — killed a load-bearing myth in the comments.** Four kit comments asserted a Content-Security-Policy that does not exist:

- `plan3d/kit/booth-props.tsx`, `plan3d/kit/outfits.ts` — "procedural CanvasTexture only (CSP: no fetched assets)"
- `plan3d/scene-lighting.tsx`, `plan3d/venue-decor.tsx` — "NO network fetch (CSP + offline-first)"

The app ships **only** `frame-ancestors 'self'` (`next.config.ts`, whose own comment says so) — no `img-src`, `connect-src`, `default-src` or nonce; `middleware.ts` and `vercel.json` set none. Two shipped paths already load uploaded images as WebGL textures: `BoothSign` and `GuestPhotoAvatar` (`plan3d/guest-avatar.tsx`), both via `THREE.TextureLoader` + `setCrossOrigin('anonymous')` against R2, whose CORS allows `GET` on all five buckets (`scripts/r2-cors.sh`). The real constraint those comments encode is **offline-first / no asset pipeline**, not CSP — they now say so. Also corrected `venue-objects.tsx`, which described `logoUrl` as a "same-origin display URL"; it is a **cross-origin presigned R2 URL**, which is why the loader sets `crossOrigin` two lines below.

This mattered beyond tidiness: the false constraint was cited in design review as "vendor 3D/texture uploads are architecturally impossible in V1 and must not be promised," which is not true and had been shaping product decisions.

**Not in this PR:** booth `cardItems`, which the same RPC also omits (guests get the thinner card). Its resolver is a ~90-line multi-table composition in `lib/vendor-services.ts` `fetchBoothCardItems` — category-match-beats-first-active over `vendor_services` → `vendor_service_inclusions`, `host_inclusions` fallback, fail-soft throughout. Porting that to plpgsql is its own change, deliberately not bundled with a one-block RPC fix.

SPEC IMPACT: `3D_Plan_and_Vendor_Revenue_Model_2026-07-20.md` §2.0b + `Booth_and_Avatar_Build_Plan_2026-07-21.md` A1/A2 already record this bug and the CSP correction; both are updated — no further corpus edit needed.
