## 2026-11-20 · feat(for-suppliers): the approved 20 Nov page — "Run the business you already have."

`/for-suppliers` is rebuilt to the owner-approved drawing `prototypes/for_suppliers_2026-11-20/`: a photo-card hero
with "Open your shop free", Your tools, Your shop page, Start free · Get Verified free, Your service cards (the real
`ServiceFace` + `CardBadgeRow`, labelled as samples), the booking-fee card with a swipe ruler and "Free when" switches,
five plan rows (Free · Verified · Plus · Pro · Ultra) and the close. It replaces the 6 Nov page.

Every line ships only once its build is live; where the drawing names something that is not built, the page shows
what is live today and never "Coming":
- the fee is the LIVE schedule (`bookingFeeFigures` / `bookingFeePhp`): no ceiling ("locks at ₱100,000") and no
  "every 100,000th fee is on us" — neither is built;
- "Free when" = the free bookings that exist: a client you bring, your first booking from Setnayan, a badge's free
  booking fee ticket ("first supplier on their event" is not built); charged when the client agrees to book;
- the gift-with-every-booking section (drawn "Coming") is not drawn; plan ⓘ names only live `TIER_CAPS` (no Ultra
  Add-on, no storage); the fine line claims only that no plan limits inquiries; the drawing's "Compare →" is not drawn
  (no public supplier-plan comparison page exists).

The page no longer draws the sample shop's QR codes, so `page.tsx` stops rendering them. The shared plan table and
shop-page miniature rules (used by /for-coordinators) are kept verbatim in `supplier-front.module.css`.

Guards moved to the new approved copy (moved, not loosened): the CTA constant (`the-invite-button-reaches-the-invite`),
cut (1) of the first steps (`supplier-cuts-first-steps`), the plan rows' slice (`supplier-plan-offer`), and the
front-page plan-preview check (`the-lab-never-ships`, now conditional: the drawing draws no shop-page miniature).

SPEC IMPACT: None — the page implements the already-approved drawing `prototypes/for_suppliers_2026-11-20/`; the
drawing's unbuilt lines (fee ceiling, 100,000th fee, first-supplier rule, gift, Ultra Add-on) stay owner rulings to build.
