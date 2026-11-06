## 2026-11-06 · feat(for-suppliers): the owner-approved page — "Not just a place to sell. A place to stay."

/for-suppliers now draws the page the owner approved on 6 Nov (`prototypes/for_suppliers_2026-11-06/index.html`,
DECISION_LOG "SUPPLIER FRONT PAGE (/for-suppliers): ONE STORY FOR EVERYONE — APPROVED"), section by section with the
prototype's words, inside the shared front-door shell from #7263. Built on #7263 (merged `origin/main` into it; its one
failing test — the every-fold guard reading a CSS selector string as a hand-rolled fold — is fixed here).

- **Every number is read.** Plan, year, branch and seat prices from the catalog (`getVendorPrices`, which now also
  returns the extra-seat price `seat` from `SEAT_SKU_CODE`); the booking fee from the live schedule
  (`getLiveBookingFeeSchedule` + `isBookingFeeEnabled`, placed by the new `bookingFeeFigures`, computed by
  `bookingFeePhp`); reach, categories, cards, seats, branches, waiting list, the free Helper, the badge steps and which
  plan a line sits under from `TIER_CAPS`, the Plans page's own rows, `boothTierCanBrand`, `FREE_HELPER_SEATS` and
  `MILESTONE_THRESHOLDS` (`supplier-front-data.ts`). The only typed pesos are the four price-shape illustrations, which
  the page labels as illustrations.
- **The QR chips scan to real addresses** of the sample shop `setnayan-production` (invite, check-a-date, page,
  reviews), drawn by the same `renderUrlQrSvg` the Promote screen uses.
- New: `supplier-front-page.tsx` (sections), `supplier-front-client.tsx` (hero, reveals, check-a-date, QR sheet,
  price shapes, day status, fee slider, Grow tabs, phone dock), `supplier-front-info.tsx` (the in-page ⓘ, drawn with
  the house ⓘ mark), `supplier-badge-shelf.tsx`, `supplier-front.module.css` (the prototype's layout on globals.css
  tokens), photos in `public/marketing/for-suppliers-2026-11-06/`, and `/dev/for-suppliers-lab` (fixture prices, 404 in
  production).
- Guards: `supplier-front-reads-its-numbers.test.ts` (no typed peso, the fee read, specs = caps, Grow lines find their
  rows, papers = `REQUIRED_DOC_COUNT`, add-on tiers, fold groups, no forbidden wording); the new files joined
  `the-supplier-page-claims-what-ships`, `booking-fee-copy`, `one-commission-promise`, `there-is-one-info-dot`; the
  invite-button and pricing-pointer tests now read what the page draws.
- The old section components (`vendor-grow-*`, `vendor-tier-*`) are no longer mounted; left in place for a follow-up
  removal so their guards move in one PR.

⚠ HELD: draft + `do-not-auto-merge` until the page's five promised features are live, and until the owner renames the
demo shop `setnaprod` → `setnayan-production` and opens it (a demo shop's page opens to nobody, so the codes and "See a
real shop" lead to a closed page until then).

SPEC IMPACT: None — builds the already-approved prototype; the differences from it are listed in the PR for the owner.
