## 2026-09-05 · feat(pricing): the 3D Plan is free for couples — vendors pay for branded presence

Owner decision 2026-09-05. Couples pay nothing for the room; vendors pay for a
branded booth in it — ₱500 per event or ₱3,000 per 4-week cycle
(`vendor_3d_booth`; the vendor-side pricing lands in its own PR).

**Measured before deciding:** the ₱1,500 `SEATING_3D` charge gated **nothing** at
any layer — the latest `public_venue_scene` definer checks only `published_at`;
`/[slug]/venue` adds only the event privacy gate; `publishSeating` has no
entitlement check; the lab and the 2D→3D segment are gated only on the
`NEXT_PUBLIC_SEATING_3D` kill-switch. The SKU had **zero orders** in its history,
and the two published plans in production both belong to internal-hosted events
that owned every SKU anyway. The buy card was, functionally, a donation button.
The couple's published room is the shelf a vendor pays to be branded on;
charging the couple to build that shelf taxed the inventory the vendor add-on
sells into.

- `SEATING_3D` joins `FREE_FOR_ALL_SKUS` — the same switch `LIVE_WALL`, `KWENTO`
  and `EDITORIAL_PRO` use. No new schema.
- Retired: `couple-3d-plan-buy.tsx`, `couple-3d-plan-unlock-notice.tsx` (the lab
  page mounts neither).
- Retired end to end: the vendor-unlocks-couple ₱1,000 discount path —
  `lib/vendor-3d-plan-unlock.ts` + test, its actions, section and button on the
  vendor client page, **and** the branch in `resolvePaxPricedOrderCentavos` that
  honoured it. A discount on a free thing cannot be true; a resolver branch
  nobody reaches is the "both ends built, no wire" shape.
- `/pricing` keeps the `SEATING_3D` row with a FREE comment, the way `LIVE_WALL`
  did, so the change reads as deliberate rather than a deletion.
- `port-control-baseline.json` regenerated in the same PR (the port-controls guard
  lists each removed control as a readable line).
- `lib/the-3d-plan-is-free.test.ts` pins the switch, the absence of every couple
  buy surface, the end-to-end removal of the discount path, and that the vendor's
  own 3D Booth product is untouched.

What still costs money *inside* the room keeps its price — the animated
monogram, mood-board renders, Papic. Only the room itself is free.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-05 rows added (couple-free + vendor
two-option pricing; all five avatar styles available). The catalogue row for
`SEATING_3D` is admin-managed — the owner retires it; `vendor_3d_booth` carries
three disagreeing prices (docblock ₱1,500 · catalogue ₱2,500 · tiered matrix
₱2,000/₱1,500) that the ₱3,000 flat replaces in the vendor PR.
