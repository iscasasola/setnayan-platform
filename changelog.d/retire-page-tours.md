## 2026-11-16 · chore(tours): delete the seven supplier page tours that no longer auto-open (W1-B14)

Owner ruling 16 Nov 2026 (DECISION_LOG, specs 61e7a2fb), answering #7898's open question: the supplier's first-login
journey (`supplier_spotlight_v1`) is THE supplier tour, so the seven per-page tours #7898 stopped auto-opening are
deleted rather than kept for "Show me around".

Deleted, each with its words in `lib/tours.ts` (TourKey, TOUR_KEYS, TOURS entry):

1. `vendor_shop_v1` — Shop (How it is going · Your badges)
2. `vendor_hub_v1` — Event Hub (Your events · Your Hub · Run the day · Post an update · day-of tools)
3. `vendor_dates_v1` — Clients › Dates (the month · ＋ outside booking)
4. `vendor_money_v1` — Clients › Money (to come in · one row per payment · log a payment · Setnayan's fee)
5. `vendor_today_v3` — Today (Messages · your day · next events · numbers · needs you · Show)
6. `vendor_people_v1` — Clients › Events (Events ▾ · counts · ⚙ · search · ＋)
7. `vendor_collections_v1` — Your collections (Who sees what · the list · Add photos)

With them: the path rule `lib/supplier-page-tours.ts`, the layout mount `SupplierPageSpotlight` +
`SupplierPageSpotlightMount` (`app/vendor-dashboard/_components/`), its `<SupplierPageSpotlight>` line in
`app/vendor-dashboard/layout.tsx`, the Money tour's fee sentence `bookingFeeTourLine`, the spotlight lab's
`/shop-tour · /dates-tour · /money-tour` screens, and the guard `each-supplier-page-has-its-tour.test.ts`.
Guards that held those tours lost the tests about them, each with the reason in place
(`the-supplier-foundations-hold` § 5, `the-calendar-key-says-what-green-means` § 2, `the-fee-words-match-the-rule`
§ 1–2 folded into one, `spotlight-anchors-exist`'s key list and ANCHOR_HOME). New guard:
`lib/the-supplier-page-tours-are-retired.test.ts`. The `data-tour` attributes on the pages are left as they are (inert;
nothing else was in scope). No schema change — a `tour_seen_keys` row that lists a retired key is never read.

SPEC IMPACT: None beyond the owner's own DECISION_LOG ruling (specs 61e7a2fb), which this implements.
