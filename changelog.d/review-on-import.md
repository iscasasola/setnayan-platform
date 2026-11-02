## 2026-06-30 · fix(vendor/reviews): wire couple reviews for imported / marketplace-linked vendors

Completes the vendor-import workstream (free import #2448, QR invite #2449): a
couple can now leave the 1 couple-authenticated review for a vendor they
imported (QR claim) or saved from the marketplace — the relationship is the
`event_vendors` row, and reviews attach to it.

The gap was purely client-side resolution, NOT the gate. The review-insert RLS
(`20270206186005`) already correlates `event_vendors → vendor_profiles` via the
direct FK `marketplace_vendor_id` and already accepts the **N=30d post-event
auto-complete** path. But two server reads still resolved the profile via the
legacy `contact_email` match and gated on the `status='complete'` proxy — so an
imported vendor (no contact_email, status stays `considering` because it never
runs the vendor-driven completion handshake) was wrongly shown "Vendor isn't on
Setnayan" and never surfaced a "Leave a review" CTA, even 30d+ after the event
when the DB would have accepted the review.

- **Review page** (`[vendorId]/review/page.tsx`) — resolve `vendor_profile` by
  `event_vendors.marketplace_vendor_id` first (the FK the RLS uses), falling
  back to the legacy `contact_email` match. (The page comment literally
  anticipated this: "once the linkage column lands … swap this for a direct FK.")
- **Tracker review badge** (`vendors/page.tsx`) — replace the
  `status==='complete'` + contact_email proxy with the real
  `reviewState(completionFields, eventDate)` gate (same one the page + RLS use,
  incl. N=30d), resolving the profile via `marketplace_vendor_id` first. So an
  imported/saved vendor surfaces "Leave a review" once its event is 30d+ past.
- **Accordion** (`plan-budget-accordion.tsx`) — refreshed the now-stale comment
  (the CTA was never independently re-gated on `status`, only on the map value).

No migration, no RLS change, no fraud-model change — the eligibility gate
(completion handshake incl. N=30d) and the one-review-per-(vendor,event)
uniqueness are unchanged; this only aligns the two client reads with the gate
the DB already enforces. Also fixes marketplace-"Save"d vendors that had a
`marketplace_vendor_id` but no `contact_email`.

SPEC IMPACT: Reviews are event-bound, 1 per (vendor, event) — unchanged. Imports
now reach that existing flow via the FK linkage. DECISION_LOG.md (2026-06-30) +
memory project_setnayan_vendor_import_crm_workstream updated.
