# Final check · PLAN · Area 7 · Coordinator & venue, Spaces, maps

**Date:** 25 Nov 2026 · Fable planner for area 7 · plan and drawings only, no app code changed.
**Sources:** `ALL-FINDINGS.md` (this branch) · `area-7.md` on `final-check/area-7` (search the ID, e.g. `A7-13`) · `FINAL-CHECK-OWNER-ADDS-2026-11-25.md` (Adds 1–25 win) · the house design standard · the shipped components on `origin/main` (`7c14361159`).
**Drawings:** specs repo `iscasasola/Setnayan-specs`, `prototypes/final-check-area-7_2026-11-25/final-check-area-7_2026-11-25.html` (one file, 4 sections, Now beside Proposed, 375 and 1280, light and dark).

File paths below are under `apps/web/`. `vd/` is short for `app/vendor-dashboard/`. `ws/` is short for `app/dashboard/[eventId]/vendors/[vendorId]/workspace/`.

## Rules every batch keeps

- Lane A changes HOW something shows or refuses. It never changes an amount, a fee, a rate, who may do what, or which price is read. If the true fix would, mark the entry 🟠 in the PR body and skip it.
- One branch and one draft PR per batch: `claude/fc-fix-a7-bK`, label `do-not-auto-merge`, from fresh `origin/main`, merge commits only.
- Every fix carries a test that holds the claim itself, not a proxy. Source-scanning guards use `lib/strip-comments.ts`. Server actions do not grow in number (fold into the existing action). A migration only where the finding names one (A7-17).
- Failed-read fixes keep the three-way split: read failed ≠ empty ≠ zero. Use the shipped parts and words ("Couldn't load … Nothing was changed." + a neutral Try again), as Spaces already does for its refused read.
- A thrown server-action message never reaches a person in production. Return a state and show it next to the control; keep what was typed.
- Area 7 has no LIVE fault and no blocker. Order is: broken → money-signin → wrong.
- Skip retired pages: `/dashboard/[eventId]/seating/lab` is R5. A7-10 names it; fix only `seating/page.tsx`.

## Lane A · 19 own entries · 2 batches

Order of batches: **A1** (the hosts' picked-supplier page, Spaces, the seat-plan read: all three broken items and the one money item) → **A2** (the 3D demo, the guest venue walk, the supplier's seat plan).
Order inside a batch: the table order.

### Batch A1 · Workspace, Spaces, the honest floor-plan read

IDs (10): A7-27 · A7-22 · A7-30 · A7-32 · A7-33 · A7-23 · A7-10 · A7-13 · A7-14 · A7-31

| # | ID | Sev | Where · file | Fix (the claim) | Test that holds it |
|---|---|---|---|---|---|
| 1 | A7-27 | broken | Book & Budget · `app/dashboard/[eventId]/vendors/actions.ts` (`updateVendorCosts`), `ws/page.tsx` (the two bare forms), `ws/_components/quote-bridge.tsx` | A failed "Save costs" or "Save crew" keeps the screen and the typed values and says "That did not save. Nothing changed. Please try again." beside the button. The action returns a state; it does not throw. | unit: `updateVendorCosts` with the write (and with the accepted-quote read) forced to error returns `{ok:false}` and never throws; component: the form shows the sentence and the inputs keep their values; source guard: no bare `<form action={updateVendorCosts}>` in `ws/` |
| 2 | A7-22 | broken | Details · `ws/page.tsx` (`manualContactRes`), `ws/_components/self-added-contact-card.tsx`, `ws/actions.ts` | A failed `manual_vendors` read draws "Couldn't load their details" with Try again and no form. A save can never write a field the page did not read: the action writes only the fields the form sent as changed. | component: read error → no inputs, no "No contact yet", the couldn't-load line; unit: the save with only `phone` changed leaves `address` and the payment note out of the update |
| 3 | A7-30 | broken | Shop › Spaces · `vd/spaces/_components/space-sheet.tsx`, `spaces-screen.tsx` (`run`), `add-first-space.tsx` | A refused write shows its reason INSIDE the open sheet, next to the button ("Only the shop's owner can change its spaces."), and the button stops looking busy. No rule changes: who may add is untouched. | component: `run` resolving `{ok:false,error}` → the sheet draws the error with `role="alert"` and stays open with the typed values; the same for `AddFirstSpace` |
| 4 | A7-32 | money-signin | Book & Budget · `ws/page.tsx` ("Payments so far", Progress), `lib/budget-truth.ts` (`resolveEventMoney`) | 🟠 check first. The hosts' page reads paid from the one reader the supplier's page uses. A payment the supplier has not confirmed shows as "waiting for confirmation" with its amount, is not counted in "paid", and does not tick "First payment paid". If the one reader does not carry "unconfirmed", stop and file 🟠: no new rule is invented. | unit: one logged, unconfirmed ₱14,364 → hosts' paid = supplier's paid (₱0), the row says waiting; once confirmed both read ₱14,364; component: Progress has no "✓ First payment paid" while unconfirmed |
| 5 | A7-33 | wrong | Book & Budget · `ws/page.tsx` (the Amount to pay card and the payment line) | "Amount to pay" shows the peso still owed from the one reader, or the row is not drawn. A stored method code is said in words (`bank_transfer` → "Bank transfer") through one small map in `lib/`, used by the hosts' line and the supplier's. | component: with no amount the row is absent, never "Next payment" alone; unit: the map covers every stored method value and never returns a string with `_` |
| 6 | A7-23 | wrong | Files · Schedule · Details · Book & Budget · `ws/page.tsx`, `handover-inbox.tsx`, `colour-access-card.tsx`, `change-order-trail.tsx` | Each of the five reads (`handoverRows`, `apptRows`, `grantRows`, `changeRows`, `eventVendorCrewRows`) keeps its error. A failed one draws "Couldn't load …" with Try again in its own section; never the empty line, "Off", "No changes yet" or "Feeding 0 crew meals". | component, one per read: forced error → the couldn't-load line and none of the empty strings; source guard: none of the five is read as `?? []` without its error |
| 7 | A7-10 | wrong | Guests › Seats (2D and 3D) · `app/dashboard/[eventId]/seating/page.tsx`, `lib/seating.ts` (`fetchFloorPlanMeasured`, `fetchSceneObjects`, `fetchSigns`) | A refused floor-plan, fixtures or signs read says "Couldn't read your floor plan" with Try again. Never the default room, never the "Show guests their seats early" switch drawn Off. | unit: the page's loader with each read forced to error returns `measured:false`; component: unmeasured → the couldn't-read line, no room, no switch; source guard: `seating/page.tsx` does not call the non-measured `fetchFloorPlan` |
| 8 | A7-13 | wrong | Shop › Spaces · `spaces-screen.tsx` (the Date `onPick`), `vd/spaces/actions.ts` (`fresh` for `op:'read'`) | A failed date change: the tiles say nothing about the day (the page's own rule for a refused day read), and the message is "Couldn't read who holds what on <day>." It never says "Saved". | component: pick a date with `spacesWrite` failing → no tile carries a state word, the day-read warning shows, the text has no "Saved"; unit: `fresh` after `op:'read'` never returns the "Saved, but …" sentence |
| 9 | A7-14 | wrong | Shop › Spaces · `space-sheet.tsx` (`PAID_NEED`), `vd/spaces/page.tsx`, `lib/v2-catalog.ts` (`getVendorPrices`) | Both Spaces locks show the plan's price read from `vendor_billing_catalog`, as other supplier pages do. If the catalogue read fails the lock says it couldn't read the price; it never types one. No price is written in code. | component: lock with a catalogue price shows that ₱ through `lib/php.ts`; with the read failed it shows the couldn't-read line; source guard: no `price: null` constant for these two locks, no digit typed after ₱ |
| 10 | A7-31 | wrong | Shop › Spaces · `spaces-screen.tsx` (`data-spaces-empty`) | Covered by drawing **B4, frame 4c** (the house empty state with one "Add a space" button). Build it WITH B4 once approved. If B4 is not approved when this batch ships, change only the words to a true line ("No spaces yet. Tap the search icon to add your first.") and leave the layout. | render test: the empty state never contains "the box below"; with B4: the block has exactly one main button and it opens the New space sheet |

Notes for A1:
- A7-24 (SW-PHP) and A7-21 (SW-BOOKED) touch `ws/page.tsx` too. Their sweeps are separate batches. Whoever lands second merges `origin/main` first; row 4 here and A7-24's "paid so far" must end on the same reader.
- Row 4 is the only money item. It changes which payments count as paid on the hosts' screen (to match the supplier's). The owner's line in `ALL-FINDINGS.md` (the one money reader) covers it; name it in the PR body.

### Batch A2 · The 3D demo, the guest venue walk, the supplier's seat plan

IDs (9): A7-03 · A7-04 · A7-28 · A7-06 · A7-01 · A7-02 · A7-29 · A7-17 · A7-16

| # | ID | Sev | Where · file | Fix (the claim) | Test that holds it |
|---|---|---|---|---|---|
| 1 | A7-03 | wrong | /3d_plan/demo/[token] · `app/3d_plan/demo/[token]/page.tsx`, `app/_actions/plan3d-demo-actions.ts` (`loadPlan3DDemoScene`) | The expired card points to where codes are made today and has one button to `/pa3d/try`; no "3D Plan tile on the Setnayan homepage". A failed guests read says "Couldn't load this demo" with Try again, never "expired". | render: expired card holds a link to `/pa3d/try` and no "homepage"; unit: guests read error → the loader returns a read-failed result, distinct from not-found |
| 2 | A7-04 | wrong | /3d_plan/demo/[token] · `_components/plan3d-guest-view.tsx` | The line under "You're at …" is true: "A sample guest, on a sample table. Guests get this when their hosts share the seat plan." No "every real Setnayan guest". | render test: the string "every real Setnayan guest" is absent; the new line is present |
| 3 | A7-28 | wrong | /pa3d · /pa3d/try · `app/(shell)/pa3d/_pa3d-room.tsx`, `pa3d/try/page.tsx` | The room is called a sample once. The eyebrow "A real reception, not a mock-up" goes; the card says it is Maria & Jose's sample room; `/pa3d/try` does not say it three times. | render: no "not a mock-up" on either page; the word "sample" appears once in the card; source guard on both files |
| 4 | A7-06 | wrong | /pa3d · /pa3d/try · `_pa3d-room.tsx` (`handleGuestClick`) | A failed or empty code says "Couldn't make their code" with Try again (re-runs the same guest). The press never ends with nothing drawn. | component: `mintPlan3DGuestQr` rejecting, and resolving null → the line and the button are drawn; Try again calls the mint with the same guest id |
| 5 | A7-01 | wrong | /[slug]/venue · `app/[slug]/venue/_components/use-live-scene.ts`, `lib/venue-live-scene.ts` (`sceneSignature`), `app/api/venue-scene/[slug]/route.ts` | The live refresh asks the route that makes the same joins as the first paint (table name, role palette, photo and logo URLs, booth slug and bookable). The signature compares like with like, so the room changes only when a seat, table or booth moved. | unit: first-paint scene vs the refresh answer for unchanged data → equal signature, no swap; unit: after a seat move → differs; component: after a refresh `you.tableName`, palette and booth `bookable` are still set |
| 6 | A7-02 | wrong | /[slug]/venue · `app/[slug]/venue/_components/guest-venue-loader.tsx`, `app/[slug]/_lib/room-links.ts` | "Try again" keeps `?t=<token>`: it uses the same link builder every other door uses. | unit: the retry href for a walk opened with a token contains that token; source guard: no hand-built `/${slug}/venue` in the loader |
| 7 | A7-29 | wrong | Supplier seat plan lock · `lib/event-access-stage.ts` (`feeLockCopy`, reason `no_charge`), `vd/clients/[eventId]/seat-plan/page.tsx` | The lock names the one thing to do and gives ONE button to the booking's accept step (the client page). The words do not contradict the "Booked" header one tap back. Which bookings are locked does not change. | unit: `feeLockCopy('no_charge')` returns a `cta` with a label and the client-page href; render: the lock has exactly one main button; the copy has no "not confirmed" beside a "Booked" header (shared word from one helper) |
| 8 | A7-17 | wrong | Supplier seat plan · a new migration replacing `get_vendor_seat_plan` (last: `supabase/migrations/20271320476390_…`), `vd/clients/[eventId]/seat-plan/seat-plan-body.tsx` | "N of M seated" uses the same capacity the hosts see (`effectiveCapacity(capacity, removed_seats)`). Where the covers pills add up to fewer than "seated", one line says why ("Covers leave out guests not eating with this supplier."). | PGlite: a table of 10 with 2 chairs removed and 6 seated → the RPC returns capacity 8; component: seated 6, covers 5 → the why-line shows; covers = seated → no line. Run the table-roster and exposure guards (the RPC's grants stay as they are) |
| 9 | A7-16 | wrong | Supplier seat plan · `seat-plan-body.tsx`, `lib/seat-plan-engine` (`PlanPoster`, `planTableGeometry`) | The supplier's picture is drawn by the one seat-plan engine, as Spaces draws a hall: real table shapes and sizes, joined tables under the group's name, the engine's default room for an unsized plan. The hand-drawn 9 % squares go. Read-only; counts only, names never cross. | component: a long table renders through `PlanPoster` (no fixed 9 % box in the file, guard via `strip-comments`); snapshot of geometry for one fixture equals the hosts' `planTableGeometry` for the same plan; an unsized room uses `DEFAULT_ROOM_M` |

Notes for A2:
- Row 9 is the largest fix in the area and it changes what the supplier sees, to the picture the hosts already have (DECISION_LOG 2026-11-20, one engine). It is lane A because the target is a shipped drawing, not a new one. If it grows past the batch, give it its own PR `claude/fc-fix-a7-b2-engine`.
- Rows 7–9 cannot be seen on the staging copy today: the seed set the booking status without the Setnayan handshake, so the coordinator only meets the lock. Ask for a re-seed before the testers walk them. Rows 1–4 need the sample event `maria-and-jose` (`is_sample = true`) on the copy.
- Row 3 changes marketing words: read `docs/brand.md` first.

### Area 7 members of shared sweeps (not batched here; the sweep's own batch fixes them)

| Sweep | Area 7 IDs | Where |
|---|---|---|
| SW-PHP (A) | A7-18 · A7-24 | `/for-coordinators` sample card price · the workspace's own peso formatters |
| SW-BOOKED (A) | A7-21 | workspace Details chip, `inferStage`, `promote-coordinator-card.tsx` |
| SW-PROMISE (A) | A7-19 | `/for-coordinators` "No end date" |

## Lane B · 4 screens · one drawing file

Door check done in code for each screen before drawing (a visible link, no flag off for good, not retired or forwarded).

| # | ID | Screen | Live door | Drawing section | Status |
|---|---|---|---|---|---|
| B1 | A7-35 | Guests › Seats › 3D: the count row at 375 (`/dashboard/[eventId]/plan3d` forwards here) | Guests › place menu › Seats › 3D | Section 1: the counts take their own line when they do not fit; 375 light and dark, 1280 unchanged | APPROVAL: pending controller |
| B2 | A7-20 | Venue connection check (`/dashboard/[eventId]/studio/panood/setup/venue-check`) | Live Watch setup › "Check the venue" (live while the Live Studio roam switch is off, as in production today) | Section 2: 2a one hero number, 2b a refused read says so, 2c the bar moves by transform at Move 320; 375 light and dark, 1280 | APPROVAL: pending controller |
| B3 | A7-05 | `/pa3d` and `/pa3d/try`: the 3D room on a phone | sitemap, Studio apps, the features page, `/alaala` | Section 3: `touch-action: pan-y`, a sideways drag or two turn rounds; 375 light, 1280 unchanged (public page, light only) | APPROVAL: pending controller |
| B4 | A7-15 | Shop › Spaces: title, toast, Undo, empty state | Shop › Specialized tools › Spaces | Section 4: 4a `PageMasthead` + toast, 4b Undo, 4c `EmptyState` (also answers A7-31); 375 light and dark, 1280 | APPROVAL: pending controller |

Notes for lane B:
- **B1 dark.** The area report marks this screen "DARK: no", but `/dashboard/*/guests$` is on `DARK_READY` on `origin/main`, so the drawing shows dark as Now.
- **B2 and B4 dark.** Neither route is on `DARK_READY`. Their dark frames are Proposed only and follow the dark standard (flat page, the glow on the top block). Listing the routes belongs to SW-DARK (A7-34).
- **B2 door (R watch).** The check's only door is the footer card of the old Live Watch setup page, and `/studio/panood` already forwards away from that page when `NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED` is on. If the owner turns that switch on for good, the setup page and this check become one retire-or-move item. Not an R candidate today.
- **B4 Undo (could be lane C).** Removing a space is a soft switch-off (`is_active = false`, `connects_to` cleared). Undo needs one new op in the existing `spacesWrite` action that switches it back on and restores `connects_to` (no new server action, no migration). If the controller reads that as function, frame 4b moves to lane C and the rest of B4 stands. Test when built: remove then Undo within 6 s → the space, its tables, doors and connection are back; Undo after a booking landed is refused with words.
- **B2 parts 2b and 2c are not look changes** (an honest state and a motion token). They ride with B2 so the page is touched once; they can ship in an A batch if B2's approval waits.

### Area 7 members of shared B sweeps (drawn once by the sweep, not here)

| Sweep | Area 7 IDs |
|---|---|
| SW-K1 · one main button | A7-07 · A7-09 · A7-12 · A7-25 |
| SW-DIALOG · hand-built layers | A7-26 |
| SW-POPPOP · popup on popup | A7-08 · A7-11 |
| SW-DARK | A7-34 |
| SW-TAP · tap targets | A7-36 |

## Lane C · none for area 7. Lane R · none found in area 7 (one R watch, B2 above).
