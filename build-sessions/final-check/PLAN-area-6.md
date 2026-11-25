# Final check · PLAN · Area 6 · Supplier bookings, chat, payments

**Date:** 25 Nov 2026 · Fable planner for area 6 · plan and drawings only, no app code changed.
**Sources:** `ALL-FINDINGS.md` (this branch) · `area-6.md` on `final-check/area-6` (search the ID, e.g. `A6-41`) · `FINAL-CHECK-OWNER-ADDS-2026-11-25.md` (Adds 1–25 win) · the house design standard · the shipped components on `origin/main` (`7c14361159`).
**Drawings:** specs repo `iscasasola/Setnayan-specs`, `prototypes/final-check-area-6_2026-11-25/final-check-area-6_2026-11-25.html` (one file, 8 sections, Now beside Proposed, 375 and 1280, light and dark; screen 4 adds 768).

File paths below are under `apps/web/`. `vd/` is short for `app/vendor-dashboard/`.

## Rules every batch keeps

- Lane A changes HOW something shows or refuses. It never changes an amount, a fee, a rate, who may book, or which price is read. If the true fix would, mark the entry 🟠 in the PR body and skip it.
- One branch and one draft PR per batch: `claude/fc-fix-a6-bK`, label `do-not-auto-merge`, from fresh `origin/main`, merge commits only.
- Every fix carries a test that holds the claim itself, not a proxy. Source-scanning guards use `lib/strip-comments.ts`. Server actions do not grow in number (fold into the existing action). A migration only where the finding names one (A6-57, A6-71).
- Failed-read fixes use the shipped parts (`ReadFailedBody`, `PartNote tone="warn"`, `ToolFail`, `ErrorState`) and the three-way split: read failed ≠ empty ≠ zero.
- A thrown server-action message never reaches a person in production. Return a state and show it next to the field; keep what was typed.
- Area 6 has no LIVE fault and no blocker. Order is: broken → money-signin → wrong → look.

## Lane A · 49 own entries + 1 shared sweep · 4 batches

Order of batches: **A1** (broken: contracts, disputes, on the day, fault reporter) → **A2** (money reads) → **A3** (client pages and the lock link) → **A4** (Clients hub, chats, the rest).
Order inside a batch: the table order.

### Batch A1 · Broken: contracts, disputes, On the day, the fault reporter

IDs (12 + sweep): A6-B13 · A6-64 · A6-68 · A6-65 · A6-66 · A6-17 · A6-18 · A6-21 · A6-22 · A6-52 · A6-19 · A6-B22 · **SW-TELE** (A6-B04 · A8·P-B-2)

| # | ID | Sev | Where · file | Fix (the claim) | Test that holds it |
|---|---|---|---|---|---|
| 1 | A6-B13 | broken | /vd/contracts/new · `vd/contracts/new/page.tsx`, `lib/chat.ts` (`fetchVendorThreadsDetailed`) | A shop with open chats sees its couples in the event picker; the "no conversation" note shows only when there truly are none. Find why `t.event` is empty for the supplier (the thread → event join) and read the name the supplier is allowed to read. | db test: a supplier with 2 threads gets 2 `eventOptions`; component: `eventOptions.length > 0` draws the form, not `contract-no-couple` |
| 2 | A6-64 | broken | /vd/contracts/new · /contracts/[contractId] · `vd/contracts/actions.ts`, `upload-form.tsx` | Bad input (title length, file too big, not a PDF, cancelled contract) returns a reason shown next to the field; the form keeps the title, description and event. No `throw new Error` for a validation case. | unit: each validation case returns `{ status: 'error', field, message }` and never throws; component: the message draws beside the field and the typed title is still there |
| 3 | A6-68 | broken | /vd/disputes · `vd/disputes/actions.ts`, `dispute-contest-form.tsx` | "This dispute has already been reviewed" shows next to the box; the typed response is kept. | unit: `submitDisputeContest` on a reviewed dispute returns the sentence as state (no throw); component: textarea value survives |
| 4 | A6-65 | broken | /vd/contracts/[contractId] · /contracts/new · /vd/disputes (three `page.tsx`) | Signed out → sign in → back on the same page, via `loginRedirectPath(...)` as booking-fees does. | source guard: none of the three pages calls a bare `redirect('/login')`; unit: the built path carries `next=` for a contract id |
| 5 | A6-66 | wrong | `vd/contracts/actions.ts` | Publish and Cancel revalidate where the list is drawn (`/vendor-dashboard/customers`) and the couple's page that shows the contract, not the redirect stub. | unit (mock `revalidatePath`): both actions call it with the customers hub and the couple's contract route |
| 6 | A6-17 | broken | /vd/on-the-day · `vd/on-the-day/page.tsx` | A refused bookings read says "Couldn't read your events", never "No events yet". Use `fetchVendorRoomEventsDetailed` and keep `complete` / `measured`. | component: `complete: false` draws the unread note and no "No events yet"; source guard: the page does not call the flag-dropping reader |
| 7 | A6-18 | broken | /vd/on-the-day · `vd/on-the-day/page.tsx` | Failed completion, handover or media reads say "Couldn't load"; never "0% done", "0 clips", "0 photos", "Not yet". | component: each of the three reads forced to error draws the unread line and none of the zero strings |
| 8 | A6-21 | broken | /vd/on-the-day/live/[eventId] · `page.tsx` | A failed `get_vendor_event_brief` draws "—" / couldn't load on the headcount row, never "0 / 0". | component: rpc error → no "0 / 0", the row shows the unread mark |
| 9 | A6-22 | broken | /vd/on-the-day/live/[eventId] · `page.tsx` | A refused bookings read or crew-grant read says so on the page; no bounce to the Hub with "opens on <date>", no send to `/profile#docs`. | unit: with either read erroring the page returns the read-failed body and calls no `redirect` |
| 10 | A6-52 | broken | their-event/[part] · `their-event-part-body.tsx` | A schedule row has no word that looks pressable and does nothing: remove the dead "View". (Making the row a door is a look change, not this batch.) | render test: no "View" text inside a row that is not a link or button |
| 11 | A6-19 | wrong | /vd/on-the-day · `page.tsx` | The media cap comes from `lib/editorial-vendor-media` (no second constant, no typed "up to 3"); the two links use `lib/routes.ts` builders. | source guard: no `MAX_MEDIA_PER_TYPE =` in the page, no typed `/vendor-dashboard/subscription` or `/customers` string |
| 12 | A6-B22 | wrong | On the day · client chat, offline · service worker / offline page | An offline reload shows the saved copy, or Setnayan's own offline page naming what still works; never the browser's error. Back online the page refreshes itself. | Playwright: open online, go offline, reload → the Setnayan offline page (or saved copy) is drawn, not `ERR_INTERNET_DISCONNECTED` |
| 13 | SW-TELE | broken | `app/api/telemetry/client-fault/route.ts` | The fault reporter records and answers 2xx; a write it cannot make still answers 2xx (or 202) and logs, never 500. First check the route on production (the copy's write locks may be the cause). Area 6 is first in this sweep's list, so it is built here once for A6-B04 and A8·P-B-2. | route test: a valid fault → 2xx and one row; a forced insert error → not 5xx |

### Batch A2 · Money reads say "couldn't read" (no number changes)

IDs (13): A6-01 · A6-02 · A6-45 · A6-43 · A6-44 · A6-31 · A6-59 · A6-24 · A6-60 · A6-B07 · A6-B06 · A6-61 · A6-B14

| # | ID | Sev | Where · file | Fix (the claim) | Test that holds it |
|---|---|---|---|---|---|
| 1 | A6-01 | money-signin | thread · `lib/vendor-service-payment-schedules.server.ts`, `vendor-payment-live.tsx` | `fetchPlanProgressForVendor` hands `complete` on; a failed payments read draws "Couldn't read payments", never "₱0 of ₱X received". | component: `complete: false` → the unread line and no "of … received" figure |
| 2 | A6-02 | money-signin | thread · same reader, `vd/messages/[threadId]/page.tsx` | The two pending-payment reads bind their errors; a failure draws "Couldn't read logged payments" and the tools sheet does not say 0 to confirm. | unit: reader returns `{ rows, complete: false }` on either error; component: no "0" count and the unread line |
| 3 | A6-45 | money-signin | client › Payment · `vd/clients/[eventId]/page.tsx` | Same reads as A6-02: never "No payments to confirm yet…" over an unread list. | component: `complete: false` → no empty-state sentence |
| 4 | A6-43 | money-signin | client · `vd/clients/[eventId]/page.tsx` | The booking-row read binds its error; on failure the page says "Couldn't load" and does not treat change orders, asks, refunds and the recorded-payment card as empty. | component: `evRow` error → the unread body; none of the four sections renders as empty |
| 5 | A6-44 | money-signin | client · same page, `BookingFeeBills` | `FEE_BILLS_UNREADABLE` (due and waived) draws "Couldn't read your fees", never an empty list. | component: the sentinel draws the unread line, not `bills={[]}` |
| 6 | A6-31 | money-signin | Clients › Money · `money-segment.tsx`, `lib/vendor-money.ts`, `money-log.tsx` | An incomplete payday read makes "Log a payment" say "Couldn't load — try again", never "No booked customer yet". | unit: `moneyPicture(null)` carries `unread: true`; component: the sheet shows the retry line |
| 7 | A6-59 | money-signin | /vd/booking-fees · `vd/booking-fees/page.tsx` | A missing or failed shop-profile read draws "We couldn't load your waived fees just now.", not an absent section. | component: `profile` null → the unread line in the Waived place |
| 8 | A6-24 | money-signin | live › Papic · `lib/vendor-papic-grants.ts`, `portfolio-credits-card.tsx` | An unread credit balance means no number, no "out of credits" refusal on a guess, and no Buy form. | unit: `credits === null` → `left: null`, `offerPack: null`; component: no Buy form and no out-of-credits line |
| 9 | A6-60 | wrong | /vd/booking-fees/[orderId] · `page.tsx` | A refused payments or settings read draws the page's own `BookingFeeReadFailed`, not the dashboard error screen. | component: `fetchPaymentsForOrder` rejecting → `BookingFeeReadFailed` rendered |
| 10 | A6-B07 | money-signin | Clients › Money and Events rows · `money-segment.tsx`, `customers-roster.tsx`, `lib/vendor-money.ts` | A payment the couple logged and the supplier has not confirmed is said as waiting ("N payments logged — confirm them", each linking to its client's Payments), and the Events row never offers that same amount as "next". ⚠ This adds one line to Money: if the controller counts that as a look change it needs a small drawing first (see flags). | unit: a pending logged payment is excluded from "next" and counted in `toConfirm`; component: the line and its links render when `toConfirm > 0`, and not when 0 |
| 11 | A6-B06 | wrong | Clients › Money top strip · `money-view.tsx` / `money-figures.tsx` | The bar's words name what it measures: "N% of ₱X received", not "booked". | render test: the strip text contains "received" and not "booked" |
| 12 | A6-61 | wrong | `vd/booking-fees/page.tsx`, `[orderId]/page.tsx` | (a) No fee rate or peso bound typed in a comment; (b) the five reads run in one `Promise.all`; (c) the `booking_fee_charges` row is read once. No fee value changes. | source guard (raw source, comments included): no `%` rate or `₱` bound in the two files; unit: one batched read, one charges read |
| 13 | A6-B14 | look | /vd/booking-fees · `booking-fees-body.tsx` | The rule is said once, plainly, in words that come from the fee reader; the subtitle names a place the phone has. 🟠 Wording only. If the sentence changes what is promised (who books free, for how long, the rate), stop: that is lane C. | render test: the "first to bring the event" rule appears once; no typed rate in the file |

### Batch A3 · Client page, its sub-pages, the lock link

IDs (12): A6-26 · A6-47 · A6-54 · A6-55 · A6-56 · A6-29 · A6-B23 · A6-48 · A6-57 · A6-B19 · A6-B10 · A6-71

| # | ID | Sev | Where · file | Fix (the claim) | Test that holds it |
|---|---|---|---|---|---|
| 1 | A6-26 | money-signin | /vendor/lock/[token] · `app/vendor/lock/[token]/page.tsx` | A failed token or shop read says "Couldn't read this lock link — try again"; `notFound()` only for a token that truly is not there. | unit: read error → the unread body, no `notFound`; `data: null, error: null` → not found |
| 2 | A6-B23 | wrong | /vendor/lock/[token] · same page (+ `not-found.tsx` beside it) | An unknown or dead code gets the page's own words ("This Locked QR is no longer valid.") and the next step (ask the supplier for a new one), not the generic 404. | render test: the route's not-found draws the Locked QR sentence |
| 3 | A6-29 | wrong | /vendor/lock/[token] · same page | The date-option and shortlist reads bind their errors (no silent "changes your date", no vanished "may not be free then" warning); "wedding date" becomes the event type's word. The second lock door (`vendor_claim_locked_qr` vs `lib/chat-lock-booking.server.ts`) is noted for the owner, not changed. | unit: each read erroring → the unread line; render: a birthday event shows no "wedding" |
| 4 | A6-47 | wrong | client · `vd/clients/[eventId]/page.tsx` | (a) A failed brief read says couldn't load, no redirect; (b) a failed contracts read does not send "Contract" to /contracts/new; (c) schedule-block, cocktail-gate and poster reads say unread, not empty. | unit: each read erroring → no `redirect`, `hasContract` is "unknown" and the button does not point at /new |
| 5 | A6-54 | wrong | editorial-media · `lib/editorial-vendor-media.ts` | A failed eligibility read says "Couldn't read", never "Not available for this event yet". (Its shape half, page → full-screen popup, follows drawing 1 once approved; not in this batch.) | unit: read error → `{ eligible: null }`; component: the unread note, not the "not available" claim |
| 6 | A6-55 | wrong | mood-board · `vd/clients/[eventId]/mood-board/page.tsx` | Failed board, colour-grant and brief reads say so in place (no silent bounce, no missing swatches, no missing event line); the back link uses the routes builder; reads batched. | unit: board read error → no `redirect`; component: each failure draws its unread line |
| 7 | A6-56 | wrong | their-event/[part] · `page.tsx`, `lib/their-event.ts` | A failed brief read says couldn't load (no bounce to Clients); a failed slug read is not "have not published"; the word is "Event Hub". | unit: read errors → no `redirect`, the unread note; render: no bare "Hub" heading |
| 8 | A6-48 | wrong | client headcount card · `vd/clients/[eventId]/page.tsx` | The card shows the count by `events.headcount_basis` (the one headcount reader), the number the supplier's pax follows. Trace the RPC first; the finding is marked PLAUSIBLE. | unit: basis "confirmed" → the card shows the confirmed count from `headcountForBasis`, not attending/invited |
| 9 | A6-57 | wrong | their-event › Guests · migration after `20271357741892_the_their_event_door.sql` | The group count follows `countsTowardEvent`'s rules (declined, deleted, passed-away and represented guests do not count). New migration; the RPC shape stays. | db test: a group of 5 with 1 declined and 1 deleted counts 3 |
| 10 | A6-B19 | wrong | their-event › Numbers · `their-event-part-body.tsx` | The sheet adds up: "Can't come" is shown beside Coming · Maybe · No reply, so the four parts equal Invited. | unit: for any counts, coming + maybe + no-reply + declined = invited, and all four render |
| 11 | A6-B10 | wrong | client › Chat · the inquiry card and quick replies | A booked client shows no "An inquiry · Your turn · Reply with an offer" and no "Sending our price now"; booked comes from `BOOKED_EVENT_VENDOR_STATUSES`. | component: status `deposit_paid` → neither string renders |
| 12 | A6-71 | wrong | booked QR · `vd/invite/actions.ts` (`issueLockedQr`), `vendor_claim_locked_qr` (new migration) | 🟠 The claim checks the day's capacity and blocks at claim time; the second scan is told the date is no longer open and the supplier is told which one won; `issueLockedQr` fails closed on a read error. This is a booking rule (who wins a date): confirm with the owner before building (see flags). Build after SW-BOOKED so "booked" is one list. | db test: two tokens for one single-capacity date → the first claim books, the second is refused with the reason and books nothing |

### Batch A4 · Clients hub, chats, the rest

IDs (12): A6-03 · A6-35 · A6-36 · A6-13 · A6-05 · A6-07 · A6-08 · A6-38 · A6-B03 · A6-B21 · A6-15 · A6-B01

| # | ID | Sev | Where · file | Fix (the claim) | Test that holds it |
|---|---|---|---|---|---|
| 1 | A6-03 | money-signin | thread · `lib/pax.ts` (`liveHeadcount`) | The live count comes from the one headcount reader (`headcountForBasis` / `countsTowardEvent`, `lib/guests.ts`); a failed count is "unknown", never 0, and prices nothing. No price formula changes. | unit: count error → `null` and no delta offered; source guard: `lib/pax.ts` holds no basis filter of its own |
| 2 | A6-35 | wrong | Clients › Events · `vd/customers/page.tsx` | When the month tile says couldn't load, the list under it says so too (not "No events booked this month."); pool bookings keep `complete`; an unread `vendor_branches` is not "Main". | component: `complete: false` → no empty-month sentence; held dates keep an unread mark |
| 3 | A6-36 | wrong | Dates day sheet and month · `day-sheet.tsx`, `customers-calendar.tsx` | Failed schedules, pool-bookings or waitlist reads draw the "couldn't load" line the day already draws for blocks and holds; a booked day never looks open with 0 waiting. | component: each read erroring → the unread line, no "Still has room", no "0 waiting" |
| 4 | A6-13 | wrong | /vd/messages · `lib/chat.ts` | The archive-embed fallback never returns archived chats as active: it keeps the last-known state or says the archive state didn't load. | unit: fallback path does not map rows to `archived: false`; the result carries `archiveUnread: true` |
| 5 | A6-05 | wrong | thread · `vd/messages/[threadId]/page.tsx` | A failed live-quote read says "Couldn't load your last quotation"; the builder does not open blank. | component: read error → the unread line; the builder is not mounted with a null revision |
| 6 | A6-07 | wrong | thread · same page | The `vendor_service_links` read binds its error; a failure says so, never a card with nothing included. | unit: read error → `links: null`; component: the unread line on the card |
| 7 | A6-08 | wrong | `pay-confirm-actions.ts`, `pax-actions.ts` | Notification `relatedUrl`s come from `lib/routes.ts` builders. | source guard: no typed `/dashboard/${` string in the two files; unit: the built URL equals the old one |
| 8 | A6-38 | wrong | Clients · toast, Money locked line, hub addresses | (a) The toast carries no price word; (b) the locked line keeps to the one allowed commission sentence; (c) hub addresses come from a routes builder. 🟠 (a) and (b) are words only: if "free" there states a real rule, leave it and ask. | render test: toast text has no "free"; source guard: no typed `?gear=1` / `?door=asking` string |
| 9 | A6-B03 | wrong | chats list vs Clients · `lib/chat.ts`, the event-name reader | One event, one name: the chats list uses the same name reader as Clients and the thread header. | unit: for one event both lists return the identical `display_name` |
| 10 | A6-B21 | wrong | /vd/recaps → /vd/shop/promote#share | The forward lands with `#share` in view at 375. | Playwright at 375: after the forward, `#share` is inside the viewport |
| 11 | A6-15 | look | /vd/notifications · `lib/notifications.ts`, `notifications-list.tsx` | A missing-relation error says couldn't load (not "Nothing yet."); the title is `PageMasthead`. The masthead swap must look the same as other pages' titles; if it visibly moves anything, stop and ask for a drawing. | unit: missing-relation → `unread: true`; `lint-page-masthead` baseline shrinks by this page |
| 12 | A6-B01 | wrong | every area 6 page (worst: /vd/messages) | Measure on production first (the copy was shared by 8 checkers). Then: one batched read per screen, no read after the batch, target usable in 0.7 s and never over 2 s. Fix only what production shows. | perf budget test on /vd/messages and the thread (server timing under the budget); budgets only shrink |

### Area 6 members of shared sweeps (built by the area named first; not planned here)

- **SW-PHP** (areas 1…): A6-04 · A6-16 · A6-25 · A6-28 · A6-33 · A6-46
- **SW-BOOKED** (areas 1…): A6-06 · A6-32 · A6-37 · A6-B05 · A6-B12 · A6-B20. A3 #12 (A6-71) and A4 #3 (A6-36) should land after it.
- **SW-WORDS**: A6-49 · **SW-PLACE**: A6-67 · A6-B11 · **SW-NOPRICE**: A6-B18 · **SW-HYDR**: A6-B09
- Lane B sweeps: **SW-K2** A6-10 · A6-14 · A6-23 · A6-40 · A6-51 · A6-58 · A6-62 · A6-69 · **SW-K1** A6-09 · A6-50 · **SW-DIALOG** A6-20 · A6-30 · **SW-SKEL** A6-39 · **SW-DARK** A6-B02 · **SW-TAP** A6-B08
- Lane C (owner first, nothing built): A6-B17 · A6-27 · A6-B16 · A6-34

## Lane B · 8 screens · one drawing file

Drawing for every line: `prototypes/final-check-area-6_2026-11-25/final-check-area-6_2026-11-25.html` in the specs repo, the section number given. Nothing is built before the controller approves its section.

| # | ID | Screen | Change in one line | Drawing | Approval |
|---|---|---|---|---|---|
| 1 | A6-53 | /vd/clients/[eventId]/challenge-photos | Page → full-screen popup (RiseScreen); the old address forwards to the client page with it open. Also the shape for A6-54's page. | § 1 | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/EURzWw27SpWKbNDLtLVexF; Adds 28–29) |
| 2 | A6-70 | /vd/contracts/new | Page → full-screen popup; Cancel removed (✕ is the way out), one main button. | § 2 | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/EURzWw27SpWKbNDLtLVexF; Adds 28–29) |
| 3 | A6-41 | Clients › Add a booking from outside | Half sheet with 7 rows and a calendar on top → full-screen popup; the calendar opens inside its row. | § 3 | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/EURzWw27SpWKbNDLtLVexF; Adds 28–29) |
| 4 | A6-B24 | /vd/customers in dark, 768 and 1280 | Dark open-day tile; "Handled by" said once; one column at 768 (split from 1024). | § 4 | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/EURzWw27SpWKbNDLtLVexF; Adds 28–29) |
| 5 | A6-42 | /vd/customers?wallet=1 | Sheet with its own address → its own page; `?wallet=1` forwards. | § 5 | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/EURzWw27SpWKbNDLtLVexF; Adds 28–29) |
| 6 | A6-B15 | disputes · manpower · contracts/new · booking-fees | Two back buttons → the one 44 px tinted round with "Back to …". | § 6 | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/EURzWw27SpWKbNDLtLVexF; Adds 28–29) |
| 7 | A6-11 | thread › Answer their booking ask | Full-screen popup → small popup (Sheet). | § 7 | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/EURzWw27SpWKbNDLtLVexF; Adds 28–29) |
| 8 | A6-12 | thread › Send a quote · Deal or meeting | Tray under the composer → full-screen popup. | § 8 | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/EURzWw27SpWKbNDLtLVexF; Adds 28–29) |

Build notes for lane B (after approval): § 1, 2, 3 and 8 use the shipped `RiseScreen`; § 7 uses the shipped `Sheet`; none builds a new layer. § 6 is one change to the shared `BackButton` "tool" variant and reaches area 5's tool pages: build it once with area 5. § 4 changes the shared `--seat-top` token for supplier dark only and must update `app/v/[slug]/dates/check-a-date-is-a-seat-plan.test.ts`. § 7 and § 8 change `lib/vendor-thread-tools.ts` and its guard `lib/the-booking-ask-rises-full-screen.test.ts`. Every build proves 375 light, 390 dark with the glow, and 1280.

## Flags for the controller

**Money or fee (lane C if the fix goes past words or honesty):**

- 🟠 **A6-B14** (A2 #13): the booking-fees sentence restates the fee rule and a "free for 12 months" rule. Rewording is lane A; changing what is promised is lane C. No rate is typed anywhere.
- 🟠 **A6-71** (A3 #12): who wins a date when two booked QRs claim it is a booking rule, with a new database function. Recommend the owner confirms "first claim wins, the second is told" before it is built.
- 🟠 **A6-B07** (A2 #10): honest, but it adds a "payments to confirm" line to the Money screen. If that counts as a look change it needs a small drawing; none was asked for here.
- 🟠 **A6-38** (A4 #8): "Booking from outside added — free." and the "we never take a cut" line are price and commission words.
- 🟠 **A6-24** (A2 #8): touches a place that sells credits; the fix only hides the sale when the balance is unread. No pack or price changes.
- 🟠 **A6-42** (B #5): the wallet shows pack prices. The drawing shows no real price ("₱ from the catalogue"); the build reads the catalogue.

**Lane B items that look like another lane:**

- **A6-11 → lane C.** The full-screen shape was ruled on purpose (DECISION_LOG 10 Nov "RISE FULL SCREEN", walked 16 Nov) and a guard holds it. The panel also carries the booking fee disclosure and up to five extra states (gift picker, piece count, carried-over top-up, waiting list, turn-down reason), so it is not always "one short screen". The owner should rule before § 7 is built.
- **A6-B15, the Manpower part → lane R candidate.** `/vendor-dashboard/manpower` has had no door since the owner's 9 Nov ruling (`settings-rows.ts`, `shop/page.tsx`). If it is retired under Add 17 it drops out of § 6; do not fix its back button first.
- **A6-54 (lane A) has a lane B half.** Its finding also says editorial-media should be a full-screen popup. That half is covered by § 1's shape and waits for the same approval.
- **A6-B24, the 768 part** moves a breakpoint (split from 1024). If other Clients work depends on the two-pane at 768, treat that part as its own decision; the dark tile and the "Handled by" words can ship without it.
