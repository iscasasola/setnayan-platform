## 2026-11-11 · feat(quote): three doors on the quote maker — Apply an offer · ＋ Make a new card · Start from a bundle

Owner, 11 Nov 2026, asked "Should the quote get the Offer Maker line and 'Make a new card'?": *"YES. they can load a
bundle also and edit from it."* Visual contract: `controller-2026-11-11/client-supplier-page.html` frame 6.

- **Apply an offer** (Discount section): the shop's running Offer Maker offers that fit the quote's cards, listed in one
  dropdown with what each takes off; one tap applies it as its own named negative line ("Dry-season weekday · 5% off ·
  offer"). Priced only by the Offer Maker's own functions (`offerCandidatesFor` + `pickBestDiscount`,
  `lib/quote-offer-door.ts`) against what the lines come to; never automatic; the offer already in the card discount is
  not offered twice. 🔒 Locked shops see the shared `LockedFeature` (offerMaker).
- **＋ Make a new card**: last row of the cards picker. Opens the shipped Card Maker (`/vendor-dashboard/services/new`)
  with `?quote=`; the quote is kept on the device; `commitVendorService` returns a CREATED card to the quote with
  `quote_card=`, which adds its lines through the shipped card seed (`lib/quote-card-return.ts`, allowlisted — never an
  open redirect).
- **Start from a bundle** (Start from menu): a saved Bundle Maker bundle loads its cards at their lowest, their gathered
  inclusions, its extra discount and its plan — `loadPackageLinesForQuote` now prices a bundle with the Bundle Maker's
  own sums (`lib/quote-from-bundle.ts` over `bundleSums`, behind `canUse('bundleMaker')`). Every line stays editable.
  🔒 Locked shops see the shared `LockedFeature` (bundleMaker).
- Reads: `lib/quote-doors.server.ts` (offers, bundles, both locks) on the thread page. No new server action exports.
- Guards: `app/_components/the-quote-has-three-doors.test.ts`, `lib/quote-offer-door.test.ts`,
  `lib/quote-from-bundle.test.ts`, `lib/quote-card-return.test.ts`. Lab: `/dev/supplier-chat-lab?m=quote&embed=quotation&doors=1`
  (`&doors=locked`). Shots: `build-notes/shots/quote-doors/`.

SPEC IMPACT: None — implements the owner's 11 Nov ruling and the approved prototype's proposed rows ("Apply an Offer
Maker offer to a quote", "Make a new card from the quote"); no locked decision changes.
