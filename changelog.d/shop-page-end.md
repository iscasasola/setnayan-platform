## 2026-11-14 · feat(shop): a shop page ends with its partners, then similar shops nearby

Builds the owner-approved ending of a supplier's public page (DECISION_LOG 2026-11-14 "A SHOP PAGE ENDS WITH ITS
PARTNERS, THEN SIMILAR SHOPS NEARBY — APPROVED AS DRAWN"; prototype `prototypes/shop_page_end_2026-11-14_fable.html`).

- **Trusted by moved from About to just before the end.** Each partner is its round shop profile photo (the shop
  card's logo circle; initials with no logo, and always initials for a still-hidden partner) · name · its kind in
  `lib/vendor-partnership-kinds.ts`'s words, strongest first (`PARTNERSHIP_RANK`). An endless row
  (`_components/trusted-by-carousel.tsx`): native swipe with scroll-snap, ‹ › on a computer only, wraps last → first
  both ways, one tile for one partner, no arrows when they fit, an arrow jumps under reduce-motion, nothing moves by
  itself. Still the shop's choice (`trusted_by`); the "couldn't load" line and not-drawn-when-empty are unchanged.
- **New "More <kind of work> near <area>"** (`_components/similar-shops-row.tsx`): up to four of Discover's shipped
  `ShopCard`s (one row at 1280, 2×2 at 390). Same kind of work (`services[0]`, the marketplace's `?category=` match),
  same city first, verified first, then nearest by HQ pin; public only (`LIVE_SHOP_GATE`); never this shop or a
  Trusted-by shop; a demo shop sees demo shops only (marked Sample), a real one real shops only. Too few nearby → widens
  and the heading drops the area; none → not drawn. "See all ›" = `categoryPickHref` (Discover's supplier view on that
  category). Rule: `lib/similar-shops.ts` (pure, executed by `lib/similar-shops.test.ts`).
- **ONE read, remembered**: `lib/similar-shops.server.ts` — one `vendor_profiles` select keyed on (kind of work, demo),
  through `rememberPublicRead` with the shop shelf's tag, started beside Trusted by's read. The cards skip the three
  badge-stats reads (`toShopCardsFromRows`, `badgeStats: false`) and wear the Verified badge their row carries. No
  migration, no new server action.
- The card's CSS is carried into `_components/shop-end.css` (the shop page does not load the 40 KB `front-door.css`);
  `the-shop-page-ends-with-partners-then-similar-shops.test.ts` fails when the copy drifts from Discover's.
- Dev lab: `/dev/shop-end-lab` (`?partners=0|1|3|8&similar=0|3|6&sample=1&unreadable=1`).
- `apps/web/scripts/port-control-baseline.json` regenerated (`port:baseline`): `main`'s copy was already behind.

WHERE WE ARE: `app/v/[slug]/page.tsx` is also edited by open PRs #7667, #7640 and #7622 — this PR's hunks there are
the import block, the two reads beside `fetchTrustedByVendors`, the About section's old Trusted-by mount, the foot of
`#get-in-touch`, and `TrustedBySection`'s body. RW-269 / RW-270 (same page) are left to the fixer session.

SPEC IMPACT: None — implements the 2026-11-14 DECISION_LOG row as drawn; no corpus edit.
