## 2026-07-31 · fix(papic): give Papic Pool a buy path — it was advertised in two live places and buyable in none

Found while testing a Simple Event on prod: the onboarding services card sells
the whole Pool ladder and closes with *"Top up any time from your Papic studio"*;
the Suite card says *"add more any time"* under a CTA reading *"Open the pool ›"*.
Both link to `/studio/papic`, which had **no Pool ladder on it at all**.

**Every part of the chain already worked except the middle.** The three
`PAPIC_GUEST*` rows have been `is_active = true` at owner-set prices since the
2026-07-29 two-type lock; `papic_pass_tiers` resolves each to a point bucket;
and `grantPapicPassPoints` has been wired in the activation map for all three,
ready to write a `papic_event_point_grants` row the moment an order is approved.
The only missing link was a doorway that mints the order.

The sibling `HostPoolMeterCard` could not have closed this even switched on: its
own header says it "carries NO purchase copy or doorway", and it is flag-dark
behind `NEXT_PUBLIC_PAPIC_POOL_BAR`. That card is the meter; this one is the
buy path.

**Added**
- `_components/papic-pool-card.tsx` — mirrors `papic-one-card.tsx` exactly:
  rungs from `papic_pass_tiers` (`is_active` filtered in the fetch), price from
  `platform_retail_catalog_v2`, phrasing from `lib/papic-tier-copy`. A rung with
  no live catalog price DISAPPEARS rather than rendering at an invented figure,
  and the card self-gates to `null` when none survive. No literal peso figure or
  shot count in the file. Shows the live remaining balance from
  `fetchEventPoolStatus` — the same reader the capture path meters against, so
  the number here and the fence that stops a shutter cannot disagree.
- `purchasePapicPoolTopUp` in `studio/papic/actions.ts` — simpler than its One
  sibling because a pool top-up lands on the EVENT: no seat to provision, no
  reload target, no mapping row. Rejects an inactive catalog row *before* an
  order exists (`resolveRetailChargeCentavos` prices by `service_code` alone, so
  a retired rung would otherwise still quote). SEC-4 holds: the browser posts a
  `service_code` — a CHOICE — and the server resolves both points and pesos.
- `lib/papic-pool-buyable.test.ts` — the seam guardrail. Asserts every sellable
  Pool rung has an activation hook (money in / no shots out is the worse
  direction), that the card reaches a real server action, that the studio
  actually MOUNTS it, and that no amount is read off the form. Mutation-checked:
  removing the mount fails test 3.

**Why the old tests could not have caught it.** Every one of them asserted a
PART, and every part was correct. The defect lived in the seam, where nothing
was looking.

SPEC IMPACT: None — no new SKU, no price change. `PAPIC_GUEST` / `_6K` / `_10K`
were already active and owner-priced; this makes them reachable.
