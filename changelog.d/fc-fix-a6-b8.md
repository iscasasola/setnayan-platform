## 2026-11-26 · fix(supplier): final check area 6 — the route builders win (Add 47), the Notifications title moves, no rate in a comment

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

SPEC IMPACT: None. Wiring and guard changes under the 26 Nov rulings; no product decision changed.
