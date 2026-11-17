## 2026-11-16 · fix(supplier/qr): the Booked QR reads the one taxonomy, and keeps the form when it refuses (W1 RW-378)

**LIVE FIX.** On live `027f641`, Generate on a Booked QR refused a shop's REAL services with "Pick at least one service
you actually offer." `issueLockedQr` compared `vendor_services.category` (a taxonomy id: a tile or a leaf) to the coarse
`VENDOR_CATEGORIES` enum by spelling. Prod (read-only SELECT, 2026-11-16): 7 services, and 6 were refused —
`lights_sound` ×3 (enum `lights_and_sound`), `photo_booth` (`photobooth`), `photoman` (leaf → `photo_booth` tile →
`photobooth`), `florals` (leaf → `florist`). Only `mobile_bar` passed. The data is right; no migration.

- `lib/locked-qr-category.ts` — `lockedQrCategoryOf` resolves a picked service through the ONE source the services were
  made from (`canonical_service_taxonomy` → `service_categories.coarse_category`, read by `getTaxonomy()`), via the
  resolver the couple-side writers already use (`eventVendorCategoryForCardKind`). No spelling map. The fallback key
  (a shop with no services) is still checked against coverage; the token still stores the enum value the scan casts.
- The refusal no longer wipes the form: the form writes its unsent draft to sessionStorage as it submits
  (`lib/locked-qr-draft.ts`), and a page that arrives with `?error=` opens the form filled from it, through the same
  `initial` an edited code opens with. A visit with no refusal drops any old draft; a draft is for the same outside
  booking only and expires after 30 min. Every storage access is guarded.
- 🔒 `app/vendor-dashboard/invite/the-booked-qr-reads-the-one-taxonomy.test.ts` — one test per prod category value on
  rows mirroring prod's taxonomy; sabotaged with main's spelling check → the 4 mismatched kinds go red. The draft round
  trip + wiring; sabotaged by dropping the submit save → red.

SPEC IMPACT: None.
