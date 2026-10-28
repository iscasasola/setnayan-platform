## 2026-10-28 · feat(supplier-today): a new shop's six steps done in place · the counts are the pinned row and filter in place · tasks finish in the row with Undo · Today ⚙

The first of the approved supplier pages (owner 2026-10-28, corpus DECISION_LOG "SUPPLIER DASHBOARD APPROVED —
EVERYTHING IN PLACE, A ⚙ PER PAGE" (TODAY) and "THE SUPPLIER PACKAGE IS SIGNED OFF"; prototype
`prototypes/supplier_in_place_2026-10-28/interactive.html` v8). Extends the shipped Today (`SupplierTodayScreen`);
nothing on it was redrawn and every shipped door stays.

- **New shop — "Get your shop live", six folds in place** (`SupplierSetupScreen` / `SupplierSetupFolds`,
  `lib/supplier-setup.ts`): Name your shop · Your details · Add your logo · What you offer · Send your documents ·
  Your QR + days off. Every body is a SHIPPED editor mounted (Your details' close-save rows, the logo upload,
  `VerifySection`, `QrCard`); each ✓ is the saved fact read back from the rail, and a save that ticks the open step
  opens the next one with "Saved ✓" — no reload. It takes the setup Next card's and "Then"'s place.
- **Step 4 counts Good · Better · Best** — three cards per service, "N to go", lowest starting price first (a
  position, not a new column). The rail's own "What you offer" step now agrees (done at 3 per service, read in the one
  `vendor_services` read it already made). An empty slot opens the shipped maker as a SHEET over Today
  (`NewServiceMaker`, now the one drawing of the maker the `/services/new` page also uses); its Save returns to Today
  (`servicesReturnBase`).
- **Step 5** says Checking / Needs a fix (+ the admin's reason, already on the application) / Approved / "N of 4 in".
- **Step 6** holds the shop's QR (Share · Save) and "Days you can't take", saved in place through the shipped
  `addManualBlock` (new `return_to=inplace`: answers instead of redirecting — no new server action).
- **Running shop — the pinned row** (`TodayCounts`): waiting · this week · ₱ to come in · ⚙, sticky, each count a
  filter that shows ITS list right under the row (the week's bookings; who still owes what, cut per booking from the
  same payday read — `owedBookings`). Unread stays honest: "couldn't load" on the count and in its list.
- **Each task finishes in its row with Undo** (`UndoableAnswers`): the pressed answer is held for the shared toast's
  Undo window, the row leaves at once, Undo writes nothing, then the shipped form is sent unchanged.
- **Today ⚙** (`TodaySettings`, menu `today`): Notifications = the shipped push switch for this device.
- Dev lab: `/dev/supplier-lab?easy=setup&docs=none|checking|fix&gbb=0..3`.

Guards: `setup-is-done-in-place.test.ts` · `the-counts-filter-in-place.test.ts` · `tasks-finish-in-the-row.test.ts`
(15 sabotages, each RED, restored). Updated to the new truth (each says why in place): `a-count-you-can-tap-goes-somewhere`,
`today-is-rows` (1e · 4 · 8), `the-today-page-speaks-to-every-supplier`, `the-upcoming-row-opens-the-customer-card`,
`the-supplier-app-lands-where-it-says` (1d), `money-reads-are-honest`, `spotlight-anchors-exist` (today-money's home),
four maker guards (read the page with its drawing). The setup reads hang off the one shop-row read, so Today stays
≤ 8 trips deep (`the-supplier-today-reads-together`). Ugat screens map regenerated.

Review round (controller, 2026-10-28): the setup steps' mounted editor draws house FORM ROWS (`flat` on
`ProfileChecklistEditor` / `EditableRow` — a hairline between rows, label left · answer right, no card; same save
logic); the pinned counts row is FIRST and the Next card sits under it (the first-tap guard re-aimed to the approved
prototype, with the reason); the fee row is title + one line (amount · due), the "introduced" sentence in the title's
ⓘ and the lock sentence behind one short line's ⓘ; the pressed count is the prototype's filled pill.

SPEC IMPACT: corpus `DECISION_LOG.md` — an "AS BUILT" row under the 2026-10-28 supplier-dashboard approval (what
shipped, what waits on data that does not exist: per-paper document states, per-kind notification switches + quiet
hours, Run-the-day defaults).
