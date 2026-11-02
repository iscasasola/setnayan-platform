## 2026-09-11 · fix(marketplace): a service card shows its cover photo on the main grid, and "Host / MC" instead of "Host Mc"

Two defects in the couple's first impression of `/explore` (session C2, bundle
HONEST SHOP):

1. The landing grid's `toServiceCard` call in `app/(shell)/explore/page.tsx`
   always passed `showcase: undefined` — it never resolved showcase photos for
   this view — and `toServiceCard` had no fallback to the card's own cover
   (`vendor_services.primary_photo_r2_key`, required to publish). Every card
   drew with nothing to look at. `toServiceCard` (`lib/service-card-view-model.ts`)
   gains a new, optional last argument, `coverPhotoUrl`, resolved once per card
   by the caller via `publicUrlForStoredAsset` (synchronous, no signing round
   trip — the function documented for exactly this surface) and used only when
   `showcase` carries no photos. The function stays pure (no I/O); the two
   other callers (`services-manager.tsx`, `app/v/[slug]/page.tsx` — D2 owns
   that file) don't pass the new argument and render byte-identical to before.
2. `displayServiceLabel` (`lib/vendors.ts`) checked `VENDOR_CATEGORY_LABEL`
   then fell straight to title-casing the raw key — `host_mc` printed
   "Host Mc". `WEDDING_TILE_LABEL` (`lib/taxonomy.ts`) already carries the
   real copy for every one of these finer canonical-service leaves ("Host /
   MC", "Live Band", …) as a pure map; it's now consulted before the
   humanised floor. `VENDOR_CATEGORY_LABEL` still wins where both apply
   (unchanged for existing callers keyed on `VendorCategory`).

Guarded by `lib/service-card-cover-fallback.test.ts` (5 tests) and new cases
in `lib/vendors.test.ts` (4 tests). Both sabotaged and confirmed RED before
landing (WEDDING_TILE_LABEL branch removed → 8/9 pass, 1 fail;
coverPhotoUrl fallback removed → 3/5 pass, 2 fail), then restored.

SPEC IMPACT: None.
