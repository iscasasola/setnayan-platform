## 2026-09-11 · fix(vendor-page): a shop's link preview never breaks

Session E1 (bundle HONEST SHOP), following D2. Owner: "a universal
representation of a vendor that they will be proud of to share to the
public."

Before this change a shop's og:image was either a presigned R2 URL that
expired 24h after it was shared (`X-Amz-Expires=86400` — a broken image the
next day), or, for a shop with no logo, no og:image at all — the page's own
raw `logo_url` reference was handed straight to `openGraph.images` /
`twitter.images` / the LocalBusiness JSON-LD `image` field.

1. **New `app/api/og/v/[slug]/route.tsx`**, modelled on
   `app/api/og/u/[slug]/route.ts` — a permanent, always-fresh 1200×630 PNG
   card. Same safety gate as `vendorMetadataBySlug` (`app/v/[slug]/page.tsx`,
   now exported as `fetchVendor` / `PublicVendorRow` so this route reuses the
   IDENTICAL select + legacy fallback rather than a second hand-rolled
   query): hidden/archived shops and demo shops 302 to the static brand card,
   never the personalized one. The card's name is
   `resolveVendorDisplayName`'s output (hybrid-anonymity honoured, never the
   raw `business_name`).
2. **New `lib/social/vendor-card.tsx`** (`renderVendorOgPng`) — same
   satori+sharp+bundled-static-font pipeline as `lib/social/profile-card.tsx`
   / `realstory-card.tsx`, self-contained. PNG (not JPEG, unlike its
   siblings) because a shop logo may carry transparency. The logo, when
   present, is fetched once, normalized via `sharp`, and embedded as a data
   URI — never a remote satori fetch — and a failed/unreachable logo
   degrades to the wordmark-only card rather than breaking the render.
3. **The logo is read through `displayUrlForStoredAsset`**, which — since
   today's earlier N4 part 3 fix — already signs ONLY the public media bucket
   (`lib/site-media-ref.ts`'s `publicBucketServeRef`, the exact allow-list
   `vendor_profiles.logo_url` is checked against everywhere else it's read).
   No separate manual gate was needed; reusing the existing resolver already
   satisfies "never sign a non-public bucket."
4. **New `lib/vendor-og-description.ts`** (`composeVendorOgDescription`) —
   the card's one descriptive line: the shop's own tagline when it has one,
   otherwise "category · city · Verified" with each part present only when
   actually true (never a fabricated placeholder — the same row-3838 rule D2
   enforces on the page itself).
5. **`vendorMetadataBySlug`** now points `openGraph.images`,
   `twitter.images` AND the LocalBusiness JSON-LD `image` at the permanent
   route instead of the raw (expiring) presigned logo URL.

Guarded by `app/api/og/v/[slug]/a-shops-link-preview-never-breaks.test.ts`
(6 tests, source-scan pattern — satori cannot render in this local install,
same established practice as `lib/social/profile-card.tsx`'s history) and
`lib/vendor-og-description.test.ts` (5 tests, direct unit tests of the pure
description logic). Every source-scan guard mutation-checked RED (dropped
the visibility check, leaked the raw business_name, bypassed the
public-bucket-only signer, served image/jpeg instead of image/png, reverted
`openGraph.images` to the raw presigned URL) then restored from an explicit
backup.

SPEC IMPACT: None.
