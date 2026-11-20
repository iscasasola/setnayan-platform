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

- fix: three stale `numbers-carry-commas` allowlist rows for the old suppliers page (FREE_PHOTOS ×2, BADGE_FIRST) are deleted — the new page no longer renders them.

- fix: the `the-couple-books-never-locks` allowlist row for `app/for-suppliers/` is dropped — the new page has nothing it excused.

- merge: main (#8014 reach is not a plan allowance). The page names no reach by plan, so it keeps its own copy; the generated files are regenerated.

## 2026-11-20 · fix(for-suppliers): "How Setnayan earns" (#7833) mounted inside the v8 fees section, in the 19 Nov words

- Merged `origin/main`. #7833's block now sits at the end of the fees section, which carries `id="model"` (before
  `#plans`); the hero gained the "How the fee works" ⓘ that links to `#earn`. The block is restyled on this page's
  `--sf-*` tokens and heading scale, not its old page look.
- The retired "All your own clients, no limit… free for a year" line is replaced by `SUPPLIER_FREE_BOOKING_LINE`
  (DECISION_LOG 2026-11-19 "PROMOTION PAGES", item 4). The block names no number of months. ⚠ The fees section and
  the hero ⓘ still quote the shared `FEE_FREE_RULE` ("books you free for a year"), which `lib/no-fee-wording.test.ts`
  pins on both public pages; retiring that shared rule is a separate change.
- The fees ⓘ no longer says badge steps give a fee ticket; since 15 Nov none does (`FIRST_FREE_FEE_STEP` = 0).
  Main's Badges ⓘ claim "a free booking fee from 1,000 events" is not carried over, for the same reason.
- `the-website-moves-by-the-standard.test.ts`: its premise counted Drift loops (≥ 3), and the v8 drawing has none. It
  now checks that every page's sheets parse (≥ 10 rules each) and that at least one loop is seen. The rule itself
  ("one at most, none on a phone") is unchanged.
- `the-earn-block-says-what-was-ruled.test.ts` now asserts the 19 Nov line and that the retired line is absent. Its
  anti-vacuity check for the 1,000-events claim is replaced by "the page promises no fee ticket while no badge pays one".

SPEC IMPACT: None. The 19 Nov ruling is already in DECISION_LOG. `SUPPLIER_FREE_BOOKING_LINE` is also exported by open
PR #8041 (`lib/seo/ai-answers.ts`); whichever PR lands second imports the other's copy.
