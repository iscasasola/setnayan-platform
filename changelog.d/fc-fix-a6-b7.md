## 2026-11-25 · fix(supplier): final check area 6, batch 7: the Headcount card counts the way the hosts count; the Recaps forward lands on Share

Lane A fixes from the 25 Nov final check (area 6), the last batch. No amount, fee or rule changed.

- **The client page's Headcount card (A6-48).** New pipeline migration `the_brief_says_how_the_hosts_count`: `get_vendor_event_brief` hands `pax.headcount_basis` (events.headcount_basis, the basis a supplier's pax follows; suppliers cannot read `events`). Only that column and that one key changed; every other line is the shipped body. The card counts with the one reader (`briefHeadcount` → `headcountForBasis`, lib/guests.ts) and says which guests it holds: "coming", "coming or maybe", or "invited, not declined", of N invited. A per-head service still draws its own count (`SupplierCountTile`), unchanged.
- **Recaps → Promote (A6-B21).** The old `/vendor-dashboard/recaps` address forwards to `/vendor-dashboard/shop/promote#share`; the share section now lands itself in view (`LandsAtHash`, app/_components/lands-at-hash.tsx: Fold's own hash landing, for a section). **Not walked in a browser:** the page needs a signed-in supplier and no dev lab draws it.
- **Tests:** `app/vendor-dashboard/area-6-batch-7-holds.test.ts`; `tests/db/the-brief-says-how-the-hosts-count.db.test.ts` (attending 2 → coming-or-maybe 3 → not-declined 4; counts unchanged). Server actions: no new export.
- Migration applied by the pipeline only. Not run by hand.

SPEC IMPACT: None. One-reader and Law 9 fixes (CLAUDE.md §4 Guest row, design-and-wiring A4); no product decision changed.
