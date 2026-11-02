## 2026-06-26 · fix(money): re-baseline pax surcharge on re-quote / cost-edit (#6/#7)

Money bug-hunt #6 + #7 (HIGH, wrong-amount, 3/3 verified). When a vendor's
`event_vendors.total_cost_php` was overwritten, the stale pax-surcharge
bookkeeping (`pax_surcharge_php` / `pax_quote_base` / `cost_basis_pax`) was left
in place — so the NEXT guest-count surcharge confirm charged against the new
total using the OLD base, a wrong amount.

- **#6 — proposal accept.** `respond_vendor_proposal` (SECURITY DEFINER RPC) now
  re-baselines on accept: zeroes `pax_surcharge_php`, sets `pax_quote_base` to the
  proposal's pax (`merge_snapshot.confirmed_guests`, kept if the snapshot has no
  usable count), and clears `cost_basis_pax`. The accepted total is the price for
  the pax it was quoted at, so the surcharge re-derives cleanly (no double-count).
- **#7 — manual cost edit.** `updateVendorCosts` now re-baselines **only when the
  total actually changed** (the form also carries transport/food): re-reads the
  old total, and on a change sets `pax_quote_base` / `cost_basis_pax` to the
  current `resolveLivePax` and zeroes `pax_surcharge_php`. The edited total is the
  price for the current pax; surcharge accrues only on further growth.

Care taken to NOT introduce a new wrong-amount: resetting all three columns to
NULL was rejected (it falls back to paxAtInquiry and double-counts) — the base is
set to the pax the new total is actually for.

SPEC IMPACT: None — corrects surcharge amounts; no SKU/price/flow change.
