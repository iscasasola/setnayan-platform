## 2026-06-29 · feat(reviews): receipt-backed reviews — booking provenance + dated track record

Wave 5 vendor benefit. Two platform-derived trust signals that prove a vendor's
Setnayan reviews and history are real, not padded — both server-derived so a
couple can never assert them by hand.

- **Per-review "Booked through Setnayan" provenance.** New
  `vendor_reviews.booked_through_setnayan BOOLEAN` (default FALSE, migration
  `20270321252758_receipt_backed_reviews.sql`). TRUE when the review's source
  `event_vendors` booking links to the reviewed vendor's marketplace profile via
  `linked_vendor_profile_id` OR `marketplace_vendor_id`. Existing rows backfilled
  from the same linkage. The value is **stamped server-side** in
  `lib/reviews.ts createReview` (resolved via the `review_is_booked_through_setnayan`
  SECURITY DEFINER RPC) and re-derived authoritatively by the
  `stamp_review_provenance` BEFORE trigger on every INSERT/UPDATE — so couples
  can NEVER set it (verified: a couple passing TRUE on an unlinked booking lands
  FALSE; passing FALSE on a linked booking lands TRUE). The couple RLS
  INSERT/UPDATE policies stay byte-identical to the original (the FALSE-pin was
  deliberately NOT added: a BEFORE trigger fires before the RLS WITH CHECK, so a
  FALSE-pin would have rejected legitimate reviews of linked vendors). The
  existing public SELECT on `vendor_reviews` is untouched. Rendered as a small
  "Booked through Setnayan" pill in `ReviewRow` (`/v/[slug]`) + the vendor
  dashboard `VendorReviewCard`.

- **Dated track record.** New `vendor_completed_events` SELECT-able VIEW exposing
  `{vendor_profile_id, event_type, event_date, completed_at}` (one row per
  delivered/complete LINKED booking), applying the SAME owner / team / internal /
  self-comp / archived exclusions as `vendor_public_completed_events_stats` from
  `20260515020000_public_stats_exclusion.sql`. GRANT SELECT to anon +
  authenticated. Rendered as a "Track record" list (`event type · month-year`) on
  `/v/[slug]` + the vendor dashboard reviews page.

Migration dry-run validated against prod in a `BEGIN…ROLLBACK`. No prices.

SPEC IMPACT: None on locks/SKUs/pricing. New column + view + RPC + trigger are
additive review-provenance plumbing; logs as a notable decision in the corpus
DECISION_LOG (Wave 5 vendor benefit — Receipt-Backed Reviews shipped).
