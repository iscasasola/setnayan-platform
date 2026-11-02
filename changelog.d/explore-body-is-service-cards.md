## 2026-09-08 · fix(explore): the body lists services, and the page has one search bar

Two owner complaints on one screenshot.

**1 · *"i still do not see the service cards"***

The grid drew one card per VENDOR and picked a service to stand for the shop.
Measured in prod: Saysay has TWO cards — Live Band ₱35,000 and Host Mc ₱40,000 —
and the marketplace showed "Live Band by Saysay Live Band & Hosting" and nothing
else. The ₱40,000 card was on no page.

🔑 **RULE 0 — BOTH HALVES ALREADY EXISTED AND NEITHER WAS WIRED.**
`lib/marketplace-service-cards.ts` shipped EARLIER THE SAME DAY with a docblock
naming this exact defect, and had **zero importers** outside its own test.
`ServiceCardView` — *"THE service card. The one a couple sees"* — also shipped
today, rendered on `/v/[slug]` and the vendor dashboard, never on the
marketplace. This commit is the wire, not a third implementation; the card is
built by the same `toServiceCard` call the vendor's own list uses, so all three
surfaces draw the identical card.

⚠ **A SHOP WITH NO SERVICE CARDS NOW HAS NOTHING TO LIST.** SetnaProd has no
`vendor_services` rows at all — its `vendor_profiles.services` text array is
what drew the old "Pabati by SetnaProd" vendor card. Listing services means it
drops out of the body until it creates one. That is the ruling working, not a
regression, but it is a visible change and the owner should know it.

**2 · *"why are there 2 search bar when i explicitly said use the search bar on
top"*** — my regression, shipped an hour earlier in #5311.

Rendering `<CatalogView>` under the results to keep the category breadth dragged
its `ExploreSearchHero` down with it. 🔑 **A COMPONENT IS NOT A SECTION.**
CatalogView is a whole landing — hero, search, folder strip — not a category grid
you can park under something else; reaching for one of its parts brought all of
them. Removed. The catalog stays one tap away via the hero's own "Browse all
categories" link and `?browse=1`, exactly as `browseMode` already documents.

The guard pins this by SHAPE, not by counting search inputs: exactly one
`<CatalogView>` render site, and it must be the empty-marketplace branch. A
second render site is a second search bar.

The service read THROWS rather than returning `[]` (its own docblock explains
why: an empty array renders identically to an empty marketplace). It is caught
here so a broken read falls back to the vendor grid — degraded, never a
convincing lie.

Verified by sabotage: re-adding a `<CatalogView>` under the results fails the
guard. 10,686 tests pass.

SPEC IMPACT: None. Implements the owner ruling already recorded in
`marketplace-service-cards.ts` — *"on the body, it will only show all service
cards."*
