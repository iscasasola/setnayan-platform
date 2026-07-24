## 2026-07-24 · feat(booking): reusable locked bookings — couple re-book, vendor re-price (dark)

A couple can re-book a vendor they previously locked, for a NEW event; the vendor
re-prices it, and the resulting lock is a fresh booking = a NEW fee. Ships DARK
behind `NEXT_PUBLIC_REUSABLE_BOOKINGS_ENABLED` (default OFF → both surfaces render
nothing and every reuse action is an inert no-op; byte-identical to today).

Model (owner-locked 2026-07-24): the couple INITIATES; the TEMPLATE is
VENDOR-owned; the vendor SETS the new price (or declines a retired package).

- **Two layers kept apart.** TEMPLATE (vendor-owned scope/inclusions) is
  snapshotted from the source booking's accepted proposal `line_items` (falling
  back to `event_vendors.host_inclusions`) as `[{label, detail}]` ONLY — never a
  price, never another couple's instance data (`merge_snapshot` / `rendered_body`
  are never read). INSTANCE (couple-owned) = the target event + the vendor's
  point-in-time re-quote, landing as a fresh `event_vendors` row.
- **New-lock-new-fee is STRUCTURAL.** Reuse always targets a DIFFERENT event, a
  distinct `(vendor_profile_id, event_id)` from the source. The booking-fee ledger
  keys on that pair and the charge on `event_vendor_id`, so a new event ⇒ a new
  ledger row ⇒ its own frozen free-5 ordinal ⇒ its own charge; the source event's
  fee-paid state is unreachable. No fee code is duplicated — reuse rides the
  UNCHANGED `finalizeVendor` → `collectBookingFeeAtLock` path, and the 6th distinct
  reuse booking is charged exactly like any 6th booking (first 5 free). Same-event
  reuse is forbidden (table CHECK + guards) so it can't inherit an existing charge.
- **New:** `vendor_reuse_requests` table (migration `20270929330649`, RLS enabled,
  SELECT for couple/vendor/admin, writes service-role only, one-live-per
  target×vendor). `lib/reusable-bookings.ts` (pure: flag, status machine, scope
  sanitizer, distinct-event invariant) + `.server.ts` (create/quote/decline/accept
  wrappers). Couple actions (`_actions/reuse-actions.ts`) + a flag-gated "Book a
  past vendor again" panel; vendor actions (`proposals/reuse-actions.ts`) + a
  flag-gated re-booking inbox. Reuses existing notification types.
- **Tests:** `lib/reusable-bookings.test.ts` (13) — scope strips price + PII, the
  vendor-can-decline state machine, only-quoted-is-acceptable, distinct-event rule,
  and the 6th-reuse-is-charged / free-5-counts-it invariant against the unchanged
  fee rule. Typecheck + lint clean.

SPEC IMPACT: None (net-new dark feature; no locked SKU/price/schema rename touched;
the booking-fee schedule + free-5 rule are reused unchanged). Corpus decision row
to be appended to `DECISION_LOG.md` when the owner flips this on.
