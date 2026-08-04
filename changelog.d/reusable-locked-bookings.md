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
- **New:** `vendor_reuse_requests` table (migration `20271103100614`, RLS enabled,
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

---

## 2026-08-04 · unblocked — and the new table was shipping OPEN TO ANON

This PR sat open since 2026-07-24, 951 commits behind main. Refreshing it turned up three
things, one of them a real security hole.

**1 · 🔴 `vendor_reuse_requests` was reachable by `anon`.** The migration enabled RLS and wrote
three policies, all `TO authenticated` — but never issued the mandatory `REVOKE`. Every new
table in the `public` schema ships OPEN: the default ACL hands **anon** full
SELECT/INSERT/UPDATE/DELETE at the *table* level, and RLS does not undo a table-level GRANT.
The exposure baseline is what caught it, regenerating as `tpriv … |anon SIUD` and
`quoted_total_php anon=SIU` — anon-reachable surface on a table holding vendors' quoted prices
and decline reasons. Now `REVOKE ALL … FROM PUBLIC, anon, authenticated` +
`GRANT … TO authenticated`; the baseline reads `anon=-` on every column.

**2 · The migration would have created nothing.** Prefix `20270929330649` had fallen below
main's applied head (`20271102113000`). Migrations apply once, in prefix order — it would have
merged green and created no table, while the flag comment told the owner to *"flip on AFTER
pushing migration 20270929330649"*. Re-allocated to `20271103100614`.

**3 · `.env.example` conflicted** because both sides appended a new block. Kept both.

⏭ **After merge, verify the OBJECT:** `SELECT to_regclass('public.vendor_reuse_requests');`
must be non-NULL. The feature stays dark — `NEXT_PUBLIC_REUSABLE_BOOKINGS_ENABLED` is empty.

SPEC IMPACT: None — the feature is unchanged and still flag-dark.
