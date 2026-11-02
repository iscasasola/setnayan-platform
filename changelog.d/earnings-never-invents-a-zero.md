## 2026-09-21 · fix(vendor-earnings): an unread ledger says so — it is never ₱0, and never "no payments yet"

The supplier Earnings page awaited `fetchVendorLedgerEarnings` with no catch. That
reader throws on a refused or short read (correctly — #5680/#5724), so a refusal took
the WHOLE `/vendor-dashboard/earnings` route to the dashboard error boundary, losing
the payouts totals, the booking-fee bills and the verification chip, every one of
which already degrades honestly on its own. And the obvious repair for that crash —
`.catch(() => [])` — would have printed **₱0 year-to-date · 0 payments confirmed ·
"No confirmed payments yet."** to a supplier who had been paid: a failure rendering
identically to emptiness, on the money screen.

- **New pure module `apps/web/lib/vendor-earnings-view.ts`.** `readVendorEarnings`
  turns the throw into a value; `earningsView` maps it to what the page prints. An
  unread ledger is `ytdPhp: null` / `thisMonthPhp: null` / `paymentCount: null`
  (`formatPhp(null)` is an em-dash) and `ledger: 'unreadable'` — never `0`, never
  `'empty'`. Pure on purpose: the page is a server component, so the decision that
  can be got wrong lives where a test can EXECUTE it instead of grepping for it.
- **`app/vendor-dashboard/earnings/surface.tsx`** now has three states where it had
  two. Four "We couldn't load" branches instead of one: payouts (already there), the
  two money tiles, the 12-month table and the payment ledger. A read that fails is
  logged through `logQueryError` with `graceful_degrade`, as the payouts read is.
- **The empty-state copy described the reader that could never match.** It told
  suppliers to add services and wait for their category's platform orders to roll up
  — the `orders.service_key == vendor_services.category` join that matched nothing in
  prod (the two vocabularies are disjoint: `ONBOARDING_SERVICES`/`PAPIC_GUEST_500`
  vs `live_band`/`host_mc`). It now names the one path money actually takes: a couple
  logs a payment on their booking, the supplier confirms it.
- **`app/vendor-dashboard/reads-are-honest.test.ts` was blind to the worse half of
  its own page.** Both its assertions were about the payouts read, which REFUSES; the
  earnings read SUCCEEDS and returns `[]`, so a silent empty walked past it. It is
  now also pinned to `formatPhp(view.ytdPhp)` and the `view.ledger === 'unreadable'`
  branch.
- **New guard `apps/web/lib/the-earnings-page-never-invents-a-zero.test.ts`** —
  10 tests, each sabotage-proven (5 sabotages, each caught):
  · the scoping decision EXECUTED with **two fixture shops in ONE category**
  (`band_dj`), each with confirmed money, proving shop A is shown neither shop B's
  ₱99,999 nor its couple's name — the arrangement in which the old category filter
  and `marketplace_vendor_id` give different answers;
  · a confirmed payment appears (Saysay's prod shape: ₱2,000 + ₱3,350 = ₱5,350 YTD);
  · a refused read, a SHORT read and a genuinely empty ledger produce three
  different answers.

Verified read-only against prod 2026-09-21: Saysay (`vendor_profile_id`
`d266c234-3aca-46c3-b1c8-6a5c78e3f310`) has exactly two ledger payments, both
`vendor_confirmed_at` set, neither refused, disputed nor voided — ₱2,000 (Rosa & Ben,
2026-09-18) and ₱3,350 (Ana & Miguel, 2026-09-20). Both are earned under the shipped
rule, so Earnings reads **₱5,350 · 2 payments confirmed**, not ₱0.

Sweep for other money reads keyed on a shared string (`service_key` ↔ `category`):
none left. `lib/entitlements.ts`, `lib/add-on-state.ts` and
`app/[slug]/_components/editorial/data.ts` filter SKU-against-SKU and are
event-scoped; `vendor-dashboard/subscription/photo-challenge-actions.ts` is scoped by
`vendor_profile_id`; `lib/booking-fee-lock.server.ts` keys on
`vendor_booking_fee__<chargeId>`, which carries a UUID and cannot collide;
`lib/add-on-stats.ts` is a deliberate platform-wide feature counter, not a per-owner
total.

SPEC IMPACT: None.
