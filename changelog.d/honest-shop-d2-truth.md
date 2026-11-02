## 2026-09-11 · fix(vendor-page): songs only for musicians, no "0 yrs", a lapsed plan loses its paid look

Session D2 (bundle HONEST SHOP), applying row 3838 ("never a stock photo, a
zero, or an empty chart" — the orchestrator's application of the owner's
2026-06-04 ruling, itself still an open question and NOT touched here) and
the owner's "downgrade reverts" ruling:

1. **One music rule.** Two DIFFERENT rules previously disagreed on which
   vendors count as a music act: `MUSIC_CANONICALS`
   (`lib/songs.ts` — live_band, choir, orchestra, wedding_singer, dj, the
   finer leaf actually stored on `vendor_services.category` /
   `vendor_profiles.services`) and `SPECIALIST_TOOLS.repertoire.categories`
   (`lib/vendor-service-tools.ts` — band_dj, string_quartet, the broader
   codes no real card's `category` column has ever stored). The specialist
   card matched none of a real band's cards. `MUSIC_TOOL_CATEGORIES`
   (`lib/songs.ts`) is their union, widening — never narrowing — either;
   `MUSIC_CANONICALS`/`isMusicVendor` keep every other existing caller
   unchanged. Now the ONE rule behind: the public "Songs they play" block
   (`app/v/[slug]/page.tsx`), `addRepertoireSong`'s new server-side refusal
   (`app/vendor-dashboard/repertoire/actions.ts` — the page already gated
   entry, the action itself had no check), the More-tools Repertoire card
   (now conditional, `app/vendor-dashboard/shop/shop-tool-shelves.ts` +
   `shop/page.tsx`), and `SPECIALIST_TOOLS.repertoire`.
2. **Never print a zero.** `yearsInBusiness` (`lib/vendor-experience.ts`)
   returned `nowYear - sinceYear` unclamped, so a shop that started this
   year printed "0 yrs in business". Clamped to `null` for `years < 1` once
   in the shared helper (its only production caller).
3. **A downgrade reverts.** `tierCaps`, `micrositeCan` (×2), `isTrueNameTier`
   and `boothTierCanBrand` inside `renderVendorBySlug` read raw
   `vendor.tier_state` without `tier_expires_at` — the file's own comment on
   the column requires pairing them, since tier lapse is login-driven and
   nobody is logged in on this public render. Computed once via the
   already-shipped `effectiveSeoTier` (`lib/vendor-seo-tier.ts`, previously
   only used for the SEO plan) and threaded to all four gates.
   `vendorMetadataBySlug` (a separate function, out of this session's scope)
   is unchanged.
4. **Event-neutral copy.** "Wedding compatibility" → "Event compatibility";
   the BreadcrumbList's "Wedding vendors" → "Vendors" (matching the app-wide
   "Setnayan vendor" term).

Guarded by `lib/vendor-experience.test.ts` (5 tests),
`app/v/[slug]/the-shop-page-tells-the-truth-d2.test.ts` (4 tests),
`app/vendor-dashboard/repertoire/the-song-bank-refuses-non-music-vendors.test.ts`
(2 tests), `app/vendor-dashboard/shop/the-repertoire-card-is-for-music-acts.test.ts`
(3 tests). Every guard mutation-checked RED (years-clamp removed → 4/5;
MUSIC_TOOL_CATEGORIES narrowed → 2/3; action refusal removed → 1/2; songs-block
gate removed → 3/4; tier threading reverted → 2/4; wedding copy reverted →
3/4) then restored from an explicit backup.

SPEC IMPACT: None.
