## 2026-09-18 · fix(money): a supplier's own purchase never schedules a payout to them

`schedulePayoutForOrder` exists for one shape of order — a couple paid Setnayan
for a supplier's service, so Setnayan owes that supplier their net. A supplier
buying something **from** Setnayan is the same table, the same
`vendor_profile_id`, and the opposite direction of money.

The M1 guard inferred the direction from two accidents:

```ts
if (!row.event_id || isBranchOrder) return;
```

That holds for **seven of the nine** supplier purchase paths only because they
pass `eventId: null`. It does not hold for the two that are per-event:
`vendor_3d_booth_event` (₱500, a supplier branding one wedding's booth) and
`vendor_papic_portfolio_pack` (₱500, a supplier buying Papic credits for their
own portfolio at one wedding). Both carry a **real** `event_id` — there
genuinely is a wedding behind them — and neither is a branch key. So approving a
supplier's ₱500 payment scheduled roughly **₱447.50 to be paid back to that
supplier**, showing as money owed on the admin and supplier screens.

M1's own comment hoped its `service_key` test was *"belt-and-suspenders for any
other vendor-pays-Setnayan SKU that joins this code path"*. It only ever knew
about branches.

🔑 **The direction of money is a property of the SKU, not of whether a wedding
is attached.** `lib/vendor-pays-setnayan.ts` declares it as one list — 7 fixed
SKUs and 6 key prefixes — and M1 consults it. The older checks stay: the list is
authoritative about the SKUs we know, and `!row.event_id` still catches an
account-level order nobody has classified.

**A closed allowlist, not `startsWith('vendor_')`** — a couple booking's
`service_key` arrives from a **form field**, so a guessing rule would start
refusing real payouts. Unknown answers `false` for the same reason: wrongly
refusing a payout is somebody else's money and is invisible.

**The test that matters is the self-maintaining one.** The defect was not a
wrong list, it was a list nobody had to update — so every `VENDOR_*_SKU_CODE`
constant and every `vendor_*__` service-key prefix in `lib/` must appear in it,
and adding the next supplier purchase goes red until somebody says which way the
money moves. It carries a floor (≥12 constants found) so it cannot pass by
finding nothing.

Sabotage-proven: un-listing either offending SKU fails **2** tests each; an
unknown key answering `true`, the scheduler dropping the check, and prefixes
ceasing to match fail 1 each.

⚠ **Latent** — `vendor_payouts` holds 0 rows, so nothing needs unwinding. Both
SKUs are live and buyable now.

SPEC IMPACT: None — this enforces the existing owner-locked direction
(2026-06-05) for SKUs it had never been extended to.
