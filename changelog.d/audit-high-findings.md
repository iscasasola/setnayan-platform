## 2026-11-10 · fix(supplier): a shop's own booking counts are read where RLS lets them be read — the honest-read guard now walks lib/

Audit 2026-11-10 (corpus `plans/audit_supplier_admin_events_2026-11-10/00-AUDIT.md`), HIGH finding **C2**.
`event_vendors` has no vendor SELECT policy, so a shop reading it on its own session gets `count: 0` and no
error. The guard `a-shop-cannot-read-its-own-booking.test.ts` walked `app/vendor-dashboard` only, so three
shared `lib/` readers escaped it:

- **My Performance** (`lib/vendor-funnel.ts`): the Booked stage, booked-by-source and per-service booked read 0
  for every shop. `performance/page.tsx` now hands those readers `createAdminClient()` (`bookingsAdmin`), scoped by
  the shop id it resolved from the session.
- **Money — the first-booking-free add-ons** (`fetchVendorCommittedBookingCount`): RLS answered 0, not an error,
  so the "fails CLOSED" read never closed and 3D Plan Ads / Papic Challenge priced at ₱0 forever. All three callers
  (`plan-screen.tsx`, `booth-addon-actions.ts`, `photo-challenge-actions.ts`) now pass the admin client. Latent in
  production: `NEXT_PUBLIC_VENDOR_ADDON_FIRST5_FREE` is not set there (Build 5 plan, Step 0b flag list).
- **Getting started** (`countVendorCustomers` in `lib/vendor-first-steps.server.ts`): "bring in the customers you
  already have" could never read done. Reads on the admin client now, fail-soft.

Guard: the same test file now walks `lib/vendor-*` and `lib/supplier-*`. Every read whose receiver is not an
admin client must be billed `shop` or `couple`; every call of a `shop` reader, and every call from the shop tree,
must hand it an admin client. Sabotage-checked: reverting the five fixed files fails tests 6, 7 and 8 with all 18
call sites named.

No look changes; numbers that were silently 0 now read true. C1 (booking gate) is not in this PR — it is in
flight on Lane G (branch `claude/quirky-archimedes-p08bpk`, commit `c1fd9419f1`).

⚠ Rebase note: draft #7418 (Analytics re-port, Build 6 Lane I) rewrites `performance/page.tsx` and still passes
`supabase`; after this lands its rebase will fail test 7 until those calls take `bookingsAdmin`.

SPEC IMPACT: None
