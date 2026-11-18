## 2026-11-16 · fix(shop): unverified shops show their real name everywhere; the page is open by link; the three ₱0 waived test bookings go

Owner rulings 16 Nov 2026:

- **(15) Real shop name everywhere.** `resolveVendorDisplayName` (`apps/web/lib/vendors.ts`) now returns the stored
  business name whenever one is on file — the public shop page, its `<title>`/metadata/JSON-LD, the marketplace cards,
  the couple's Suppliers lists and pickers. The "<City> <Category> #N" screen name and "<Service> · <City>" stub draw
  only for a shop with no name at all. New `isShopNameWithheld` keys the "Real name shown after they reply" hint on
  that, not on verification. The explore card's "New shops stay unnamed until they reply to their first couple." line
  is gone. The reveal PREDICATE `isVendorNameRevealed` is unchanged (it still gates the logo/portfolio photos and is
  pinned to its SQL twin by `a-couple-sees-every-suppliers-chat-name.db.test.ts`). Held by `lib/vendors.test.ts`.
- **(18) The page is open to anyone with the link before verification.** The website editor's not-yet-live line now
  reads "Anyone with the link can open it now. Your shop shows in Find once Setnayan checks your documents." Access is
  unchanged. Held by `app/vendor-dashboard/website/your-page-applies-once.test.ts` test 5.
- **(21) Delete the three ₱0 waived test bookings** (debut-18 · test-w1-fee-walk · test-own-link-14-nov on
  testnayanw1lights). Migration `20271349501852_delete_the_three_zero_peso_waived_test_bookings.sql`, the same shape as
  #7877: found by joins from the shop slug and the three event slugs, one refusing transaction (refuses a non-₱0 or
  non-waived charge, a paid order, a shared ledger, a count other than decided, cale-ice / maria-and-jose moving, or a
  booking the mint would bill again). Proved by
  `apps/web/tests/db/the-three-zero-peso-waived-test-bookings-are-deleted.db.test.ts`.
- **(16) Pre-ticked ceremonies:** no code default exists — the pre-tick is the `vendor_profiles.compatible_ceremony_types`
  column DEFAULT `ARRAY['catholic','civil','christian']` (migration 20260521000000, kept by 20271146556997). Not changed
  here; needs a migration (owner/lead call).

SPEC IMPACT: None in code contracts; the hybrid-anonymity NAME rule (V2.1 brief amendment #2, 2026-05-30) is retired
for names by the owner's 16 Nov ruling — the corpus DECISION_LOG row is the owner's own ruling, not edited here.
