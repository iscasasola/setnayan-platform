## 2026-11-06 · feat(supplier-scan): slice 5 — the guest's optional review after "received", into the ONE guest-review store

Slice 5 of 5 of the supplier claim scanner (stacked on slice 4). Owner ruling: DECISION_LOG 2026-09-25 "AFTER A GUEST
RECEIVES A SUPPLIER'S ITEM, AN OPTIONAL REVIEW CAN POP UP ON THEIR EVENT HUB" — *"optional to respond"*. Reworked
2026-11-06 per the owner's ruling that guest reviews are **ONE store, ONE writer and ONE "From guests" section**
(PR #7337): the scanner's pop-up is a second door into that store, not a store of its own. **Merges after #7337.**

- **Migration `20271323347634`** (edited in place, never applied): no review table and no review writer. It creates
  only `supplier_scan_review_skips` — the guest's "Not now", one row per event · guest · shop (PK), so the pop-up never
  asks about that shop twice. RLS at CREATE: Setnayan admin reads; written only by the scanner action with the service
  role (the guest id from the verified pass); no supplier, couple, guest or anon access.
- **Guest**: under "Your number", "How was the Photo booth?" — a rating dropdown, one optional line, **Shown as**
  ("Gabriel D." · "G. D.", the guest-review page's two choices), Send · Not now (`ScanReviewAsk`). One ask per shop
  (the store keeps one guest review per shop per event); a shop already reviewed through the QR door is not asked.
- **Send** writes through `submitGuestReview` (`lib/guest-reviews.ts` → `vendor_guest_review_submit`), which admits the
  guest because that shop's scanner marked their item RECEIVED. Public at once in the shop page's "From guests" group;
  Setnayan admin hides or shows it in Admin › Reviews › Guest reviews (#7337's queue). Refusals use the store's own words.
- **Dropped** (from this slice's first version): `supplier_scan_reviews` + `supplier_scan_review_submit`, the
  `GuestRatingsSection` on the shop page and its test, the admin "Guests' ratings from the scanner" list, the
  `admin_review` op and `readAdminScanReviews` / `readPublishedGuestRatings`, and the lab's `?s=scan-shop`.
- Tests: `tests/db/a-guest-reviews-a-supplier-only-after-receiving.db.test.ts` rewritten against the one writer and
  the skip ledger (4) · `lib/supplier-scan.test.ts` (+1).

SPEC IMPACT: None beyond #7337's DECISION_LOG row (one store, one writer, one "From guests" section) — this slice now
follows it. The 2026-11-05 "separate Guest ratings section" note in this slice's first version is superseded by it.
