## 2026-11-25 · fix(supplier): final check area 6, batch 7: the Headcount card counts the way the hosts count; the Recaps forward lands on Share

Lane A fixes from the 25 Nov final check (area 6), the last batch. No amount, fee or rule changed.

- **The client page's Headcount card (A6-48).** New pipeline migration `the_brief_says_how_the_hosts_count`: `get_vendor_event_brief` hands `pax.headcount_basis` (events.headcount_basis, the basis a supplier's pax follows; suppliers cannot read `events`). Only that column and that one key changed; every other line is the shipped body. The card counts with the one reader (`briefHeadcount` in lib/brief-headcount.ts → `headcountForBasis`, lib/guests.ts) and says which guests it holds: "coming", "coming or maybe", or "invited, not declined", of N invited. A per-head service still draws its own count (`SupplierCountTile`), unchanged.
- **Recaps → Promote (A6-B21).** The old `/vendor-dashboard/recaps` address forwards to `/vendor-dashboard/shop/promote#share`; the share section now lands itself in view (`LandsAtHash`, app/_components/lands-at-hash.tsx: Fold's own hash landing, for a section). **Not walked in a browser:** the page needs a signed-in supplier and no dev lab draws it.
- **Tests:** `app/vendor-dashboard/area-6-batch-7-holds.test.ts`; `tests/db/the-brief-says-how-the-hosts-count.db.test.ts` (attending 2 → coming-or-maybe 3 → not-declined 4; counts unchanged). Server actions: no new export.
- Migration applied by the pipeline only. Not run by hand.

### Also in this PR — the 26 Nov rulings (Add 47)
Rulings of 26 Nov (Main Controller + owner, Add 47). No money value changes, no server action added, no baseline regenerated.

- **The route builders win (A6-08 · A6-19's links · A6-38c).** Links now come from `lib/routes.ts`:
  - the supplier chat's payment and guest-count notices (`routes.dashboard.vendors.workspace`, `routes.dashboard.messages.detail`, `routes.dashboard.budget`);
  - On the day's plan, customers, papers, repertoire and client links;
  - the Clients hub's ⚙, asking door, Dates ⚙ and day-sheet back link, and Today's Inquiries stat — through a new `routes.vendorDashboard.customers(query?)`.
- **The guards read the builders, never only literal text.** New `apps/web/scripts/lib/route-builders.mjs` loads the REAL `lib/routes.ts`, calls each builder with its own arguments (an unknown value becomes `[seg]`), and checks the address against `lib/ugat/screens.generated.json` (an `/api/…` address against its route handler).
  - `lint-port-no-lost-controls` (through `port-controls.mjs`): a builder call counts as the door it builds, and a builder that builds an address that is no screen fails the lint.
  - `lint-email-links`: a builder-built `relatedUrl` is resolved and must be a screen in the map.
  - `couple-supplier-notices-reach-email.test.ts`: builder links are resolved like helper links; new test 3b holds every built notice address to the map.
  - `redirect-keeps-params.test.ts` and `store-shell.test.ts` read On the day's links through the builder and assert the screen exists.
  - Proved: breaking the subscription, workspace or profile builder turns each guard red.
- **The supplier Notifications title moves (A6-15, owner: "Move it now").** The page title is the house `PageMasthead` (the shared `NotificationsHead` gained a `masthead` level, so the page keeps its block); "Mark all read" (a shared `MarkAllRead`, a 44 px press) is its action. The loading screen reserves that action and draws no title bar.
- **No rate in a comment (A6-61a, "no price in a comment" wins).** The booking-fees page docblock no longer types the fee rate, cap or minimum. `lib/booking-fee-copy.test.ts` now requires the page to draw the live `<BookingFeeLine fee={schedule}>` and checks that the minimum it states is `BOOKING_FEE.minPhp`, and that no fee figure is typed in the page.
- **Not changed:** A6-38(a)(b) (owner to pick the words); A6-B01 (measured on production after launch).

SPEC IMPACT: None. One-reader and Law 9 fixes (CLAUDE.md §4 Guest row, design-and-wiring A4); no product decision changed.
