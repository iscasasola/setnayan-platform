## 2026-11-10 · feat(discover): the shop card wears the shop — cover, logo, live category, badge pills; the event card shows the host's photo

Owner approval 10 Nov, DECISION_LOG "DISCOVER'S SHOP CARD — APPROVED" (prototype `shop-card` v3).

- **Big picture = the shop's cover.** The rule Shop's hero already used (Your page's pick while it is on the portfolio, else the first photo) moved out of `vendor-dashboard/shop/page.tsx` into `shopCoverKey` (`lib/supplier-hero.ts`) — Shop now asks that function too, so the two cannot drift. Discover resolves it with the hero's own `heroPicture`; with no photo the tile shows the category picture with the hero's "Sample photo" chip.
- **Circle = the logo, shown whole** (contain, on a light `--fd-logo-ground`, with a dark value). Initials only with no logo. The logo left the big tile, where `.fd-thumb img`'s cover crop was cutting square logos.
- **Category line from the live taxonomy** (`getTaxonomy`), never `TAXONOMY_MAP` — `band_dj` and `florist` no longer read "Setnayan supplier". Line = group · city; " · verified" is gone (the pill replaces it).
- **Up to 2 `ShopBadgePill`s** under the line (`cardBadges` — `shopBadges` order, cut at `CARD_BADGE_CAP = 2`, so Verified first). New `readShopBadgeFactsForShops` reads the three stats tables ONCE each for the whole shelf (`.in(...)`); Verified still `hasVerifiedBadge`; an unread fact wears no pill.
- **One card:** the search hits (`front-door-results.tsx`) now draw the shelf's exported `ShopCard`, not a copy.
- **Event cards:** the host circle shows the host's photo on the viewer's own event or when the host's public profile is on (the "People to follow" consent), signed with `displayUrlForStoredAsset` + `renderableImageSrc`. The photo ref rides the existing host read (`profile_photo_url` added to it) — no new request.
- Remembered-read keys bumped (`home:live-shops-v2`, `home:discover-hosts-v2`) for the added columns.
- Lab: `/dev/shop-card-lab` (`?state=now` / proposed). Guard: `app/_components/frontdoor/the-shop-card-wears-the-shop.test.ts`; `demo-shops-wear-the-marker.test.ts` re-anchored (the search hit draws `ShopCard`).

SPEC IMPACT: None — the ruling is already recorded (DECISION_LOG "DISCOVER'S SHOP CARD — APPROVED").
