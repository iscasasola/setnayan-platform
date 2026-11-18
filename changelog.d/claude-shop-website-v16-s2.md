## 2026-11-16 · feat(shop): the verified shop's hero shows its photos — slides, the desktop mosaic, the shared viewer (v16 S2)

- **Phone.** The hero's background is now the shop's first five portfolio photos, as slides you swipe. The shop's chosen hero photo comes first.
  - Dots on top follow the swipe.
  - "All N photos" sits top right. N counts the shop's real photos.
- **Desktop.** With a full five photos, the hero becomes the drawing's mosaic (2fr · 1fr · 1fr, two rows).
  - Each photo is a button, and "All N photos" sits on the mosaic.
  - The name, kicker, tagline and awards sit below it on the page's own ground.
- **The viewer.** A tap opens the shared photo viewer (`PhotoViewer` → `GalleryLightbox`'s screen layout):
  - ✕ at 44 px, top left;
  - "3 of 12 · <shop>";
  - ‹ ›, a sideways swipe, and Esc or Back to close, with focus returning to the button.
  - It is fetched only on the tap.
- **Views.** Each photo shown counts as one view through the portfolio's own door (`recordVendorProfileView({ photoKey })`). A demo shop or a team preview counts nothing.
- **Unchanged cases.** A shop with one photo, or one that hides its portfolio, keeps the single hero exactly as before, and so does the sample frame on /for-suppliers.
- **Reused, not redrawn:** `ShopHero` (a `gallery` slot and a `bento` flag), `MarkedPhoto` (the mark is never cropped), `PhotoViewer` / `GalleryLightbox`, `recordVendorProfileView` and `formatCount`.
- **New:** `ShopHeroGallery`, `lib/shop-hero-photos.ts` (`HERO_PHOTO_COUNT`), and the guard `lib/the-shop-hero-follows-v16-s2.test.ts` (8 tests, 9 sabotages red).
- Zero new server actions and no migration. Colours come only from tokens.

SPEC IMPACT: None. This builds the owner-approved v16 drawing (`prototypes/shop_website_two_looks_2026-11-15`) and the 15 Nov shop-website rows already in DECISION_LOG.
