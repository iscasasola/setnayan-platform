## 2026-06-30 · feat(vendor/crm): In-house vs Import customer mix on vendor Home

Surfaces the owner customer taxonomy (locked 2026-06-30) as a CRM signal on the
vendor dashboard Home:
- **In-house** — customers who inquired via Setnayan (Explore + the vendor's
  Website). `event_vendors.source` IS DISTINCT FROM `'vendor_invite'`.
- **Imported** — customers the vendor brought in via QR Code.
  `event_vendors.source = 'vendor_invite'` (the same discriminator the
  receipt-backed review pill uses, PR #2453).

- New migration `20270330200000_vendor_customer_source_counts.sql` — a
  `vendor_customer_source_counts(p_vendor_profile_id)` SECURITY DEFINER RPC
  returning `(in_house, imported)` distinct-event counts. WHY a DEFINER RPC:
  `event_vendors` carries couple-only RLS, so a vendor's own session reads zero
  rows from it (the Home page already derives bookings from chat_threads for the
  same reason). The RPC exposes only the two aggregate counts (no PII, no rows)
  for the vendor's OWN profile, gated to the owner or a team member — else it
  returns `(0,0)`. Mirrors the ownership-checked DEFINER pattern of
  `unlock_vendor_event` / `review_is_booked_through_setnayan`. Counts distinct
  non-archived events linked via `marketplace_vendor_id`/`linked_vendor_profile_id`.
- `lib/vendor-profile.ts` — `fetchVendorCustomerSourceCounts()` calls the RPC;
  fail-soft to `{inHouse:0, imported:0}` on any error (pre-migration deploys).
- `vendor-dashboard/page.tsx` — fetched in the existing Home `Promise.all`; a
  compact "Where your customers came from" card (two figures + icons) renders
  directly above the "Invite a couple" QR CTA, so the mix leads into the
  bring-in-more action. Links to the Clients page.

SPEC IMPACT: None (code-only CRM signal; reads existing `event_vendors.source`).
Owner taxonomy + this surface logged in DECISION_LOG.md (2026-06-30) + memory
project_setnayan_vendor_import_crm_workstream.

Open nuance (surfaced for owner): "In-house" counts any linked Explore/Website
event including a pure shortlist Save (no message), not strictly a messaged
inquiry — faithful to the owner's "Explore + Website = in-house" bucketing, but
flag if you want save-vs-inquiry split.
