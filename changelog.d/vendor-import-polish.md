## 2026-06-30 · feat(vendor/crm): Verified booking vs Verified wedding review pill + generic-onboarding return-path

Closes the two optional-polish tails on the vendor import → CRM workstream
(free import #2448 · QR claim→shortlist #2449 · review-on-import #2450 ·
wedding onboarding loop #2452).

**1. "Verified booking" (import) vs "Verified wedding" (on-platform) review pill.**
Splits the single receipt-backed "Booked through Setnayan" pill into two, per the
owner spec (project_setnayan_vendor_import_crm_workstream): a couple brought onto
Setnayan by the vendor's invite QR earns "Verified booking"; a couple who booked
the vendor on-platform themselves earns "Verified wedding". Off-platform bookings
with no linked profile still get no pill.

- `lib/vendor-couple-invite.ts` — `importVendorToEventShortlist` now stamps
  `event_vendors.source = 'vendor_invite'` (was `'host_manual'`, indistinguishable
  from a marketplace save). This is the discriminator the pill reads.
- New migration `20270330100000_review_import_provenance.sql` — adds
  `vendor_reviews.via_vendor_import BOOLEAN` (a strict subset of
  `booked_through_setnayan`: TRUE only when the linking booking also carries
  `source='vendor_invite'`) + the `review_via_vendor_import()` SECURITY DEFINER
  helper, extends the existing `stamp_review_provenance` BEFORE trigger to derive
  both columns, and backfills. PLATFORM-DERIVED exactly like
  `booked_through_setnayan` — couples can never set it; a forged value would only
  downgrade their own review's pill (import is the narrower claim), so no abuse
  incentive. Builds directly on `20270321252758_receipt_backed_reviews.sql`.
- `lib/reviews.ts` — `via_vendor_import` added to `ReviewRow` + `REVIEW_COLUMNS`;
  new `resolveViaVendorImport()` server resolver; `createReview` resolves + passes
  it (advisory — the trigger is authoritative).
- `/v/[slug]` + `/vendor-dashboard/reviews` — render `VerifiedBookingPill`
  (terracotta/Champagne-Gold accent) vs `VerifiedWeddingPill` (mulberry, the old
  "Booked through Setnayan" styling/copy renamed). `vendor-marketplace-info.tsx`
  selects the new column for type-parity (it renders no provenance pill today).

**2. Generic `/onboarding/[type]` honors `next` post-commit.**
The wedding flow already returned a QR-invite couple to `/vendor-invite/[slug]`
after creating their first event (#2452); the non-wedding generic flow carried
`next` (via the picker's `withNext()`) but ignored it. Now `[type]/page.tsx`
reads `safeNext(sp.next)` and threads `nextPath` into `GenericOnboarding`, whose
post-commit `router.replace` returns to `nextPath ?? /dashboard/{id}` — mirroring
the wedding `goToDashboard` "continue free" branch. Additive/byte-identical when
`next` is absent.

SPEC IMPACT: None (corpus-side). Closes the two polish items tracked in memory
project_setnayan_vendor_import_crm_workstream; that memory + DECISION_LOG.md
(2026-06-30) updated. Surfaced for owner sign-off: the public copy rename
"Booked through Setnayan" → "Verified wedding" (the spec's exact term) is a
load-bearing trust-UI label change.
