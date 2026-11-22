## 2026-11-19 · fix(supplier): the audit's HIGH findings — a refused read never says "Free", "0 of 3", "No bookings yet" or opens a box that deletes

From the supplier dashboard audit (closed PR #7934) re-measured against main on 2026-11-19. Each one was a refused read drawn as a fact about the supplier's own business:

- **S-2 · Shop cover** — a refused own-row read drew **"Free plan"** on a paying shop's cover and Plan tile. Now "Couldn't load your plan".
- **S-3 · Shop cover** — a refused application read drew **"Get verified · 0 of 3 papers"** to a shop in review. Now "Couldn't load your papers"; the Offer Maker lock line says the same.
- **S-4 · Offer Maker** — the same refused read locked the Offer Maker on a verified shop. It now falls back to the profile's measured visibility.
- **S-5 · "In our words" (data loss)** — a refused notes read opened each Ultra story's box EMPTY, and a blank save deletes the note. Now the box is not drawn; "Couldn't load your 'In our words' note".
- **C-1 · Booth branding (money)** — a refused order read was `'none'`, so a supplier who had paid saw the buy form again, and the buy action could mint a second order. The state is now `'unread'`: the card says so, and the buy refuses ("Nothing was charged — try again"). A refused plan read no longer says "comes with a paid plan".
- **C-2 · Script tab** — a refused timeline or script read said "<couple> haven't built their timeline yet". Now it says it couldn't load them, and draws no composer.
- **T-2 · Today** — the threads read was `.catch(() => [])`, and meetings / unsent quotes returned `[]` on a refusal, so Today could read "Nothing waiting on you" and an undercounted "asked". They now make the desk incomplete ("couldn't load"), and the 28-day inquiry count is withheld when the threads read was short.
- **T-3 · Today › Coming up** — a refused bookings or schedules read said "No bookings yet · Add the ones you already have". Now "Couldn't load your bookings".
- **V-3 · Services** — the tier probe threw its error away, so a refused read hid the branches and every card read "assigned to You". The error is bound and logged; an unread plan still reads the branch labels.
- **L-2 · Plans** — a refused catalogue removed a Plus shop's own "Plus · your plan" row and said "Not sold on this cycle" on Pro/Ultra. The read now keeps its outcome (`fetchV2VendorCatalogRead`); an unread catalogue keeps every row and says "Couldn't load the price".

Guard: new `app/vendor-dashboard/a-refused-read-is-never-free-or-empty.test.ts` (10 tests, all red against origin/main's sources, green here). `lib/entitlement-reads-keep-their-reason.test.ts` now expects `'unread'` (still fail-closed) from a refused booth order read and `'none'` from a genuine empty one. `shop/the-quick-row-is-the-drawn-three.test.ts` matches the plan line's new form.

Not fixed here, needs the owner: **H-2** (a failed "Confirm received" is silent — Q3) and **L-3** (a failed plan-order insert sends the shop to a 404 pay page — Q2).

SPEC IMPACT: None.
