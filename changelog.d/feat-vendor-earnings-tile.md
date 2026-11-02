## 2026-07-11 · feat(vendor): real earnings tiles on the Overview bento

The Overview reskin (PR #2980) shipped the energy bento but SKIPPED a
booked-revenue/earnings hero, noting "no real source on this surface." There
IS a source — the overview loader just wasn't loading it. This wires two real
earnings tiles into `VendorEnergyStats`, honestly and fail-soft.

- `lib/vendor-overview.ts`: new `fetchVendorEarningsSummary(supabase, vendorProfileId)`
  → `{ earnedThisYearPhp, bookingCount, confirmedPhp, expectedPhp }`. Two
  independent REAL sources, run concurrently, each fail-soft to empty (→ ₱0):
  · **Earned (YTD)** — the exact same figure `/vendor-dashboard/earnings` shows:
    `fetchVendorEarnings` matched payments on orders whose `service_key` is in
    the vendor's OWN `vendor_services` categories (admin client, scoped by the
    vendor's own service rows — never `vendor_profiles.user_id`), summed via
    `computeMonthlySubtotals().ytdTotal`.
  · **Confirmed cash-flow** — the ownership-gated `vendor_payday_installments()`
    RPC (auth.uid()-scoped internally), summed via `buildPaydayTimeline` to
    `confirmedPhp` (received) / `expectedPhp` (total booked installment value).
- `app/vendor-dashboard/page.tsx`: the summary joins the existing overview
  `Promise.all` batch (alongside `fetchVendorCurrentAwards`), `.catch(() => null)`
  → a failed read hides the money tiles rather than tripping the page. No new
  serial round-trip on the hot path.
- `app/vendor-dashboard/_components/overview-sections.tsx`: two tiles —
  `EarnedTile` (wine `--m-nav-active`, serif peso via the shared `formatPhp`,
  whole card links to the full earnings ledger, ₱0 → "No earnings yet") and
  `CashFlowTile` (a `ProgressRing` in `--v-blue` encoding the real
  confirmed÷expected ratio; ₱0 booked → "No booked installments yet"). When
  `earnings` is null both are omitted. No number is fabricated or estimated.

Preserves every existing overview widget + identity-masking. No schema /
migration / dependency / flag / billing change.

SPEC IMPACT: None (wires real earnings data the reskin had skipped; no product/pricing decision changed).
