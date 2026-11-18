## 2026-11-19 · fix(supplier-plans): cards are unlimited to make — the plan counts the LIVE ones

Owner, 19 Nov 2026, verbatim: *"service cards. you can create to the limit of your cards. but you can choose if you
want to add all."* → *"or we keep it unlimited"* → *"sorry. we already agreed they can add as many"* → *"so we can
motivate them to upgrade"*. Same rule as DECISION_LOG 2026-11-10 "UNLIMITED CARDS, ONLY 3 LIVE" and the 17 Nov rule.
#7975 had shipped `serviceCardsTotal` as a refusal on CREATE; this moves it to turning a card LIVE.

- **Making a card is never refused by plan.** `serviceCardsTotalRefusal` and both create-time checks
  (`createVendorService`, `commitVendorService`) are gone; the card maker's chooser (`standingForCategory`) no longer
  locks a kind on a card total (the family cap stays).
- **Turning a card live is capped** at the plan's `serviceCardsTotal` (read through `fetchCapsWithAddOns` —
  `vendor_plan_contents`, falling back to `TIER_CAPS`; never typed), counting live cards with branch copies excluded
  and the card itself excluded. Asked on the list's on/off switch (`toggleVendorServiceActive`) and on the maker's
  Publish / wizard finish (`commitVendorService`). Past it: "Your plan shows N service cards live. Hide one, or upgrade
  to show more." An EDIT is refused; a NEW card is saved hidden and told so. An unread count fails closed. Founders
  unlimited, as before. Rule + sentences in `lib/live-cards-cap.ts`.
- Plan copy says live, with making unlimited: `vendor-benefits.ts`, `supplier-front-data.ts`,
  `for-coordinators/_facts.ts`, the sample shop page.
- Guard: `app/vendor-dashboard/services/cards-limit-live-not-made.test.ts` (verified red on four sabotages: the switch
  skipping the count, a create refusal restored, a new card refused instead of held, a verdict that never refuses).
- Not changed: the admin's take-down lift (`app/admin/vendors/[vendorProfileId]/card-actions.ts`) still restores a
  card live without the count — an admin action, left for a ruling.

SPEC IMPACT: None — implements the existing DECISION_LOG 2026-11-10 row and the owner's 19 Nov words; no new decision.
⚠ For the owner: `TIER_CAPS` / `vendor_plan_contents` hold the top plan's total as 80 (#7975, ruling 39); the
controller's brief quoted 1 · 3 · 10 · 20 · 50. This PR reads the stored number and does not change it.
