## 2026-11-16 · feat(booking-fee): a supplier sees where and when a couple found them — on the client card and the fee bill

Owner ruling 16 Nov 2026 (DECISION_LOG e5d166cd (2)): "Found you on Setnayan · from Search, 3 Nov". `foundYouLine` sits
beside the admin's `foundReceiptLine` in `lib/booking-fee-dispute.ts` and reads the same found-record
(`event_vendor_found.first_found_at` + `first_source`); one shared map turns each Setnayan surface into plain words
(Search, Discover, Shortlist, First Pick, Favorites, Best matches, Real Stories, a shared story, your Setnayan page) and an
unknown value prints no code. The date is the Manila day. The client card and the fee bill read the record with the
service role, scoped to the event and shop each page has already proven is the caller's; the bill now shows it on every
bill with a charge, not only after an accepted dispute. The admin receipt names the surface too. No record, no line. No
server action, no migration. Guard: `lib/the-found-you-line-reaches-the-supplier.test.ts` (13 sabotages, all red).

SPEC IMPACT: None — implements a ruled decision; the surface words are the code's choice and are listed above for review.
