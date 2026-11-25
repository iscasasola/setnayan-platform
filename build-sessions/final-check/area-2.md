# Final check · Area 2 · Couple: create an event and plan it

FIXER: batch 1 of 6 · PR #8309 · ready, full CI running · batches 2 (SW-RAWDB) · 3 · 4 · 5 built and committed, local preflight running before each PR · batch 6 next (SW-HYDR + the last area-2 items)

STATUS: phase B done · 77 entries walked at 375/768/1280 light + dark · 24 new findings (0 blocker · 4 money-signin · 4 broken · 5 wrong · 11 look) · buttons 2191 (375) / 2698 (1280) · pressed 1202 · failed 0

> Checker 2 of 8. Report only, no fixes. Main frozen at `fb3f72d`. Phase A = code pass (`SOURCE: CODE`);
> phase B = browser walk on staging (`SOURCE: SEEN`), not started (no staging address yet).
> Page list from `pnpm exec tsx scripts/staging/areas.ts --area 2` (67 pages + 6 forwards, same as kit § 4),
> plus `/signup/you`, which the task names for this area although `areas.ts` files it under Area 1.
> Marks on each line: **OFFLINE** (NEEDED + where signal is lost / READ-ONLY IS ENOUGH / NOT NEEDED) and
> **SHAPE** (TODAY → SHOULD; `=` when they agree).

## Lock proof

- **Sent:** 25 Nov 2026, **06:48:44 UTC (14:48 PHT)**, signed in as `couple_plan`.
- **Thread:** event **Bea & Paolo** (`stg-bea-paolo`, event `44c273b9-9c4a-4b92-8147-03c50ca46023`) × supplier
  **Kusina ni Aling Nena Catering** — the couple's chat, reached at
  `/dashboard/44c273b9-…/vendors/d4054370-577c-4187-84da-71c93b08517d/workspace?tab=chat`.
- **Text:** "Final check lock proof (area 2) — test message, please ignore."
- **What the app showed:** the bubble with "Delivered" under it (the chat's own delivery mark). Nothing on screen
  said an email was sent to the supplier. **No blocker.** Checker 8: please confirm in /admin/email-delivery that the
  notification went to the sink or was logged "not configured".

## Progress

### Create an event
- [x] /onboarding/[type] · OFFLINE: NOT NEEDED (disagree with plan: a create flow has nothing to read back, and its answers are already kept in the browser's own draft) · SHAPE: PAGE (bare full-height page, steps held in client state on one address) → FULL-SCREEN POPUP (A2-A1)
- [x] /onboarding/simple · OFFLINE: NOT NEEDED (same reason) · SHAPE: PAGE (one form, or setup cards paced on one address when the engine is on) → FULL-SCREEN POPUP (A2-A1)
- [x] /onboarding/wedding · OFFLINE: NOT NEEDED (same reason) · SHAPE: PAGE (bare full-height page, ~12 screens in client state) → FULL-SCREEN POPUP (A2-A1)
- [x] /dashboard/create-event (+ intercepting `@modal/(.)create-event`) · OFFLINE: NOT NEEDED · SHAPE: PAGE on a cold load / SIDE PANEL (`SidePanel phone="sheet"`: bottom sheet on a phone, wide right panel on desktop) when opened from the board → FULL-SCREEN POPUP, as screen 1 of the same create flow (A2-A1)
- [x] /signup/you · OFFLINE: NOT NEEDED · SHAPE: PAGE (sign-in-style card on a paper page) = PAGE (the sign-up and OAuth round trips land on it by address)
- [x] /host/accept/[token] · OFFLINE: NOT NEEDED · SHAPE: PAGE = PAGE (opened from an emailed link)

### Home and the event
- [x] /dashboard · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE   (findings A2-X4 … A2-B4; covers plain Home (Unihome v5) and the full board at `?seg=events`)
- [x] /dashboard/[eventId] · OFFLINE: READ-ONLY IS ENOUGH (saved copy already built, `OFFLINE_COPY_SHAPES`; the day-of console's own "Ready for no signal" block covers the venue) · SHAPE: PAGE = PAGE   (findings A2-X4, A2-B5 … A2-B8)
- [x] /dashboard/[eventId]/activity · OFFLINE: NOT NEEDED (disagree with plan: a history feed has no use without signal; nothing is acted on here) · SHAPE: PAGE = PAGE   (findings A2-X4, A2-B9, A2-B10)
- [x] /dashboard/year · OFFLINE: NOT NEEDED (forward only) · SHAPE: PAGE (forward) = PAGE (forward). `app/dashboard/(account)/year/page.tsx` · `redirect('/dashboard?seg=events#worth-planning')` — lands EXACTLY on the expected target. `?seg=events` resolves to the board (`resolveHomeSeg` → `EventsBoard`, which runs no landing jump), and the board renders `<section id="worth-planning" …>` ("Worth planning", `YearMomentsStrip`) in `app/(hub)/dashboard/page.tsx`. OK.
- [x] /dashboard/[eventId]/more · OFFLINE: NOT NEEDED (forward only) · SHAPE: PAGE (forward) = PAGE (forward). `app/dashboard/[eventId]/more/page.tsx` · `redirect(\`/dashboard/${eventId}\`)` — lands on the event home, which exists. OK.
- [x] /dashboard/[eventId]/progress · OFFLINE: NOT NEEDED (forward only) · SHAPE: PAGE (forward) = PAGE (forward). `app/dashboard/[eventId]/progress/page.tsx` · `redirect(\`/dashboard/${eventId}${suffix}\`)` — lands on `/dashboard/[eventId]` (the event home, exists), carrying `?sai=<value>` only when the old link had one. So the kit's `/dashboard/[…][…]` is really `/dashboard/[eventId]` (+ optional `?sai=`). OK.

### Account
- [x] /dashboard/notifications · way in: bell in the top bar (`(account)/layout.tsx` `UnreadBellBadge`) + command palette · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE
- [x] /dashboard/search · way in: palette step-out (`lib/shell-search.ts`), Unihome · OFFLINE: NOT NEEDED (live query; disagree with plan: a saved copy of a search is meaningless) · SHAPE: PAGE = PAGE
- [x] /dashboard/billing · way in: account menu "Billing & receipts" (`account-switcher.tsx`) + receipt slip · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE
- [x] /dashboard/api-keys · way in: Profile › Account row "API keys" (shown to every account) + `/api/v1` docs · OFFLINE: NOT NEEDED (disagree with plan: nothing to read offline) · SHAPE: PAGE = PAGE (A2-C3, A2-C4, A2-C5)
- [x] /dashboard/profile · way in: account menu, palette, settings rail · OFFLINE: NOT NEEDED (disagree with plan: settings forms only) · SHAPE: PAGE = PAGE (A2-C7, A2-C8, A2-C9, A2-C10)
- [x] /dashboard/profile/concierge · way in: NONE live (profile rows gated by `CONCIERGE_ENABLED = false`; only an admin notification link) · OFFLINE: NOT NEEDED · SHAPE: PAGE = PAGE (A2-C11: retire or give a door)
- [x] /dashboard/people · way in: rail (`rail-active.ts`); FORWARD → `/dashboard?seg=people&…` via `forwardToHome('people', …)` (all params carried; Home renders `PeopleSegment`) — confirmed · OFFLINE: READ-ONLY IS ENOUGH (on its Home target) · SHAPE: forward = forward
- [x] /dashboard/people/[dependentId] · way in: People › Loved ones cards (`dependents-section.tsx`) · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE (A2-C12)
- [x] /dashboard/clusters · way in: NONE (only door is its own child page's "All groups" button) · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE (A2-C13)
- [x] /dashboard/clusters/[clusterId] · way in: only from /dashboard/clusters (itself unreachable) and createCluster's redirect · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE (A2-C12, A2-C13)
- [x] /dashboard/samahan · way in: rail; FORWARD → `/dashboard?seg=people&view=samahan` (+`&left=1`/`&archived=1`) — confirmed: `/dashboard` resolves `seg=people` to `PeopleSegment`, `resolvePeopleView('samahan')` is never gated · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: forward = forward
- [x] /dashboard/samahan/[communityId] · way in: People › Groups rows, palette, Home, join-link redirect · OFFLINE: READ-ONLY IS ENOUGH (a group outing may lose signal; chat can wait) · SHAPE: PAGE = PAGE (A2-C14)
- [x] /dashboard/samahan/new · way in: People pinned row "＋ New", Groups section, palette, `/samahan` · OFFLINE: NOT NEEDED · SHAPE: PAGE → SMALL POPUP (A2-C15)

### Guests and seats
- [x] /dashboard/[eventId]/guests · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE   (the guest card opens over it as the `InspectorSheet` side peek at `?inspect=`; its inner layers: A2-D3, A2-D4)
- [x] /dashboard/[eventId]/guests/[guestId] · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE   (deep-link / print / failed-save landing for the same `GuestCard`; the in-app way in is already the `?inspect=` sheet)
- [x] /dashboard/[eventId]/guests/new · OFFLINE: NOT NEEDED (disagree with plan: an empty form has nothing to keep) · SHAPE: PAGE → FULL-SCREEN POPUP (A2-D9)
- [x] /dashboard/[eventId]/guests/quick · OFFLINE: NOT NEEDED (disagree with plan: an empty form has nothing to keep) · SHAPE: PAGE → FULL-SCREEN POPUP, or retire (A2-D9, A2-D10)
- [x] /dashboard/[eventId]/guests/import · OFFLINE: NOT NEEDED (disagree with plan: an upload needs the network) · SHAPE: PAGE → FULL-SCREEN POPUP (A2-D9)
- [x] /dashboard/[eventId]/guests/claims · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE   (the `guest_claim_pending` notification links to it, and it is also drawn in place inside Guests)
- [x] /dashboard/[eventId]/guests/checkin · OFFLINE: NEEDED (at the venue on the day) · SHAPE: PAGE = PAGE   (saved offline copy exists: `DeskSavedMark`, `OFFLINE_COPY_SHAPES`)
- [x] /dashboard/[eventId]/guests/souvenirs · OFFLINE: NEEDED (at the venue on the day; the desk is run by the couple's or coordinator's crew at the giveaway table, and it is not in `OFFLINE_COPY_SHAPES` today) · SHAPE: PAGE = PAGE (the crew reopens this station by its link on the day; Back and refresh must work)
- [x] /dashboard/[eventId]/guests/tea-ceremony · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE (printed and shared with both families)
- [x] /dashboard/[eventId]/seating · OFFLINE: READ-ONLY IS ENOUGH (the coordinator looking up a seat at the venue needs the saved copy; nobody edits the plan offline) · SHAPE: PAGE = PAGE (the address only forwards to Guests › Seats through `guestsViewHref(eventId, 'seats', …)`; Guests draws this same file with `host: 'guests'`, so the plan has one source)
- [x] /dashboard/[eventId]/seating/chart · OFFLINE: NOT NEEDED (disagree with plan: this prepares a print before the day) · SHAPE: PAGE → FULL-SCREEN POPUP (A2-E12)
- [x] /dashboard/[eventId]/seating/lab · OFFLINE: NOT NEEDED (disagree with plan: a heavy 3D room, no day-of use) · SHAPE: PAGE → FULL-SCREEN POPUP inside Guests › Seats, which already exists there (A2-E6)
- [x] /dashboard/[eventId]/seating/walkthrough · OFFLINE: NOT NEEDED (disagree with plan: an upload tool used before the day) · SHAPE: PAGE → FULL-SCREEN POPUP (A2-E12)
- [x] /dashboard/[eventId]/access-requests · OFFLINE: NOT NEEDED (disagree with plan: an answer needs the network to send) · SHAPE: PAGE = PAGE (notifications and the Home asks link here)
- [x] /dashboard/[eventId]/people · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE
- [x] /dashboard/[eventId]/hosts · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE (the couple and helpers who hold the guest list are forwarded to `/guests`; it draws only for a helper who does not hold the guest list)

### Money
- [x] /dashboard/[eventId]/budget · OFFLINE: READ-ONLY IS ENOUGH (on the road / at an expo, to see what is still owed; no saved copy is built today) · SHAPE: PAGE = PAGE (its sheets are `Sheet rise`; Supplier → Record replaces the sheet, never stacks)
- [x] /dashboard/[eventId]/orders · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE
- [x] /dashboard/[eventId]/orders/[orderId] · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE
- [x] /dashboard/[eventId]/orders/new · OFFLINE: NOT NEEDED · SHAPE: forward only (`redirect(routes.dashboard.eventServices(eventId))` → `/dashboard/[eventId]/studio/website-pro`, row exists as `studio/[addon]`) = forward
- [x] /pay/[reference] · OFFLINE: NOT NEEDED (paying needs a connection) · SHAPE: PAGE = PAGE (opened from emails and buy buttons by link; the enlarged screenshot uses `OverlayBackdrop` + `useModalA11y`)
- [x] /receipts/[receiptId] · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE
- [x] /receipts/order/[orderId] · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE
- [x] /receipts/payment/[paymentId] · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE
- [x] /dashboard/[eventId]/refer · OFFLINE: NOT NEEDED · SHAPE: PAGE = PAGE
- [x] /proposals/[publicId] · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE (shared by link, printed)

### Suppliers
- [x] /dashboard/[eventId]/vendors · OFFLINE: NEEDED (at an expo) — today a read-only last-seen copy only (`LastSeenCapture page="suppliers"`) · SHAPE: PAGE = PAGE
- [x] /dashboard/[eventId]/vendors/[vendorId] · forward only: `redirect(\`/dashboard/${eventId}/vendors/${vendorId}/workspace\`)` lands on `vendors/[vendorId]/workspace/page.tsx` (exists) · OFFLINE: NOT NEEDED · SHAPE: forward (no screen)
- [x] /dashboard/[eventId]/vendors/categories · OFFLINE: READ-ONLY IS ENOUGH (disagree with plan: the couple-at-an-expo case needs a live search anyway) · SHAPE: PAGE = PAGE
- [x] /dashboard/[eventId]/vendors/packages/[bookingId] · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE
- [x] /dashboard/[eventId]/vendors/[vendorId]/review · OFFLINE: NOT NEEDED · SHAPE: PAGE = PAGE (reached from the `review_request` notification link)
- [x] /dashboard/[eventId]/contracts · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE
- [x] /dashboard/[eventId]/contracts/[contractId] · OFFLINE: READ-ONLY IS ENOUGH (disagree a little: the contract is wanted at the venue on the day; a saved copy of this page plus the PDF would help) · SHAPE: PAGE = PAGE
- [x] /dashboard/[eventId]/disputes · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE
- [x] /dashboard/[eventId]/clearance · OFFLINE: READ-ONLY IS ENOUGH (it is pressed once, after the day; it needs the network to write) · SHAPE: PAGE = PAGE
- [x] /dashboard/[eventId]/messages · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE ("Message a supplier" is a `Sheet`, correct)
- [x] /dashboard/[eventId]/messages/[threadId] · OFFLINE: READ-ONLY IS ENOUGH (a saved copy of the quote and agreed terms; a queued send would help a couple at an expo, which the plan does not ask for) · SHAPE: PAGE = PAGE (full-screen takeover on a phone, list beside it from 701; notifications link to it). The `@supplier/(..)vendors/[vendorId]/workspace` door lands: it re-exports `vendors/[vendorId]/workspace/page`, and `?tab=chat|quote|payments|files|schedule|details|report` all resolve in `pickedSupplierPageOf`.
- [x] /dashboard/[eventId]/manpower · OFFLINE: READ-ONLY IS ENOUGH (the host checks the crew and cash on the day) · SHAPE: PAGE = PAGE

### Plan the day
- [x] /dashboard/[eventId]/details · OFFLINE: READ-ONLY IS ENOUGH (already has `LastSeenCapture page="details"`) · SHAPE: PAGE = PAGE. Note: a couple never sees this page. `viewer.isCouple` → `redirect(eventSettingsHref(...))` (Home with the ⚙ Event Settings sheet open). Only helpers and coordinators read it, read-only. So no row here opens a field (`opens()` is null for every non-couple), and the date, venue and headcount edits live in the Home sheet (`event-settings-rows.tsx` → `EventSettingsEditor` → `GovernedFields`). Their actions revalidate correctly: `updateEventDate` → `revalidatePath(/dashboard/${eventId}, 'layout')` + `revalidateGuestSite`, and `updateGuestCount`/`updateVenueSetting` → layout + details. A failed save returns `{ ok:false, error }`.
- [x] /dashboard/[eventId]/details/field/[row] (+ `@field/(.)field/[row]` popup) · OFFLINE: NOT NEEDED · SHAPE: TODAY: forward (couple → Home ⚙ sheet, top; helper → the record with nothing open, because `RecordFieldSlot` returns null when `!viewer.isCouple`) → SHOULD: SMALL POPUP on the named field (A2-H11). The intercepting popup (`RecordFieldSheet`/`MakerHalfSheet`) can never open from Details, since couples are redirected before the record draws and helpers' rows carry no `open`.
- [x] /dashboard/[eventId]/details/change · OFFLINE: NOT NEEDED · SHAPE: forward. Confirmed: `redirect(/dashboard/${eventId}/details/field/area)`. That address then takes a couple to `/dashboard/[eventId]?settings=1` (sheet top, `area` not opened) and a helper to the read-only record (A2-H11).
- [x] /dashboard/[eventId]/date-selection · OFFLINE: NOT NEEDED (disagree with plan: it ranks dates on live supplier calendars, and a stale copy would recommend a taken date) · SHAPE: PAGE = PAGE (the `?path=direct|guided` steps each have their own address)
- [x] /dashboard/[eventId]/find-date · OFFLINE: NOT NEEDED (disagree with plan: same live-calendar reason) · SHAPE: PAGE = PAGE (a couple whose event has an Event Hub is forwarded to `launch?tool=details&item=date&date=help`)
- [x] /dashboard/[eventId]/checklist · OFFLINE: READ-ONLY IS ENOUGH (the target Schedule already has a saved offline copy) · SHAPE: forward. Confirmed: `planningTodoHref` → `/dashboard/[eventId]/schedule?view=preparation&filter=todo`. `schedule/page.tsx` honours both (`viewParam === 'preparation'` → `active`, `filterParam === 'todo'` → `planFilter` → `PreparationAgendaView initialFilter`), and the browser carries a `#task-<id>` hash across the redirect.
- [x] /dashboard/[eventId]/schedule · OFFLINE: NEEDED (at the venue on the day: hosts and coordinator run the day; today's saved copy is read-only, which the plan accepts for the couple, not the coordinator) · SHAPE: PAGE = PAGE
- [x] /dashboard/[eventId]/documents · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE
- [x] /dashboard/[eventId]/paperwork · OFFLINE: READ-ONLY IS ENOUGH (at the parish or LGU office: tracking numbers and dates) · SHAPE: PAGE = PAGE
- [x] /dashboard/[eventId]/sponsors · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE
- [x] /dashboard/[eventId]/nikah · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE

## Phase A summary (code pass, done 25 Nov 2026)

- **74 of 74 entries done** (67 pages + 6 forwards + `/signup/you`). Every forward lands where the kit says
  (`/dashboard/[eventId]/progress` lands on `/dashboard/[eventId]`, keeping `?sai=`; `/checklist` lands on
  `/schedule?view=preparation&filter=todo`; `/orders/new` and `/dashboard/people` are forwards too).
- **131 findings:** 0 blocker · 14 money-signin · 16 broken · 60 wrong · 41 look. All `SOURCE: CODE`; the ones a
  browser must settle say PLAUSIBLE in ACTUAL.
- **OFFLINE:** 4 NEEDED (check-in and souvenir desk at the venue, Schedule on the day, Suppliers at an expo) ·
  39 READ-ONLY IS ENOUGH · 31 NOT NEEDED. 16 lines disagree with the plan (most: forms and live-data pages where a
  saved copy has nothing useful to show; the souvenir desk needs full offline like check-in).
- **SHAPE:** 53 PAGE = PAGE · 9 forwards (no screen) · **12 differ today:** 10 PAGE → FULL-SCREEN POPUP
  (the 3 onboarding flows + create-event, guests/new · quick · import, seating/chart · lab · walkthrough),
  1 PAGE → SMALL POPUP (samahan/new), 1 forward → SMALL POPUP on the named field (details/field/[row]).
  Onboarding's full entry is under group A (A2-A1 and "ONBOARDING SHAPE").
- **Question for the controller (not filed as a finding):** with anonymous drafts ON, a signed-out host's event is
  saved to an anonymous session and the account is asked LATER (`SecureAccountBanner`), not "at save" as CLAUDE.md §1
  says. Which is meant? It decides whether A2-A3/A2-A4 are the whole problem.
- Readers' notes: findings A2-B1, C2, D6, E15 and G20 (no dark glow) were folded into A2-X4; A2-A5 and A2-B10 were
  lowered from money-signin to wrong (a second peso formatter whose figure is right today).

## Phase B summary (browser walk on the staging copy, 25 Nov 2026)

- **77 entries walked** (67 pages + 6 forwards + `/signup/you`, plus 13 detail addresses: a seeded guest card,
  the second order's pay page, `/onboarding/debut`, and 10 unknown ids that check the not-found state, since the seed holds no
  contract, package, loved one, linked group, group, proposal, host invite, receipt row or payment receipt for this couple).
  Sizes: 375 · 768 · 1280 light on every page; dark at 375 on every page and at 768 · 1280 on the pages that go dark.
- **24 new findings (SEEN):** 0 blocker · 4 money-signin · 4 broken · 5 wrong · 11 look.
  12 phase-A findings confirmed in the browser (listed under the new ones).
- **Buttons (Add 6):** 2191 controls counted at 375 and 2698 at 1280 across the area; **pressed 1202 · failed 0**.
  Pressed = a button pressed and seen to act (a popup, a state, a new address), or a link whose destination page was opened
  in this walk. Left: anything that would pay, send, delete, archive, release or change seeded data; links into other areas'
  pages; and, on pages the press pass did not reach, the buttons themselves — the copy took 20–180 s per signed-in load for
  most of the day, which made a reload after each press impossible (each line says which).
- **DARK (Add 7):** yes 19 · no 45 · partly 0 · "—" = a detail address walked light only. No half-dark screen.
- **"No visible effect" in the press pass** (already-selected tabs such as "All" and "A to Z", canvas controls Rotate /
  Zoom on the seat plan, hidden sheet "Close" buttons, a Home task row the tour overlay was covering, the create-event tiles and People's
  "Add someone"): re-checked by hand. The task row expands; the tiles navigate after 2–3 s (longer than the pass waited);
  "Add someone" focuses the Find box at the foot of the screen (by design, though nothing visible happens on a desktop).
  Three rows on the guest card (Note, Name and contact, Notes) were not re-checked. None is filed, so **failed = 0**.
- **Offline (Add 10):** an open check-in desk keeps working with no signal; no dashboard page reopens offline (A2-P22).
- **Lock proof:** sent (above); nothing on screen said an email went out.

## Phase B progress (per page: sizes · dark · buttons · pressed · speed · CLEAN / BALANCED / EFFECTIVE)

- [x] /dashboard · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 46 (375) / 61 (1280) · pressed 26 (buttons 3+0 repeats, links 23 to pages opened in this walk) · failed 0 · left 20 (4 would change data / pay / timed out, 16 links to other areas' pages) · usable in 37–102 s · CLEAN ok · BALANCED: 1280 one 780 px column, right third empty · EFFECTIVE ok (profile line ends in an unexplained "· off")
- [x] /dashboard?seg=events · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 29 (375) / 43 (1280) · pressed 13 (buttons 6+1 repeats, links 6 to pages opened in this walk) · failed 0 (no visible effect on 1: 0 celebrated — re-checked or explained, not faults) · left 6 (3 would change data / pay / timed out, 3 links to other areas' pages) · usable in 101–115 s · CLEAN ok · BALANCED ok · EFFECTIVE: ⓘ "What is this row?" 16 px (A2-P14)
- [x] /dashboard/[eventId] · B: 375✓ 768✓ 1280✓ · DARK: yes · buttons 52 (375) / 62 (1280) · pressed 23 (buttons 1+0 repeats, links 22 to pages opened in this walk) · failed 0 · left 30 (22 would change data / pay / timed out, 8 links to other areas' pages) · usable in 16–113 s · CLEAN: EXAMPLE rows (A2-P12) · BALANCED: 1280 date cut (A2-P21) · EFFECTIVE: tour over the main tile (A2-P13); counts differ between loads (A2-P10); money counts up from ₱0 (A2-P1)
- [x] /dashboard/[eventId]/access-requests · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 11 (375) / 21 (1280) · pressed 3 (buttons 1+0 repeats, links 2 to pages opened in this walk) · failed 0 (no visible effect on 1: Close — re-checked or explained, not faults) · left 1 (0 would change data / pay / timed out, 1 links to other areas' pages) · usable in 15–19 s · CLEAN ok · BALANCED ok · EFFECTIVE: no visible title, one line "Nothing waiting on you."
- [x] /dashboard/[eventId]/activity · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 114 (375) / 124 (1280) · pressed 52 (buttons 2+1 repeats, links 49 to pages opened in this walk) · failed 0 · left 93 (1 would change data / pay / timed out, 92 links to other areas' pages) · usable in 25–28 s · CLEAN ok · BALANCED ok · EFFECTIVE: no visible title; 114 rows, no filter
- [x] /dashboard/[eventId]/budget · B: 375✓ 768✓ 1280✓ · DARK: yes · buttons 29 (375) / 39 (1280) · pressed 21 (buttons 15+0 repeats, links 6 to pages opened in this walk) · failed 0 · left 6 (5 would change data / pay / timed out, 1 links to other areas' pages) · usable in 11–27 s · CLEAN ok · BALANCED ok · EFFECTIVE: tour opens over the totals (A2-P13); totals agree with Home ✓
- [x] /dashboard/[eventId]/checklist · B: 375✓ 768✓ 1280✓ · DARK: yes · buttons 10 (375) / 20 (1280) · pressed 0 (buttons 0+0 repeats, links 0 to pages opened in this walk) · failed 0 · left 0 (0 would change data / pay / timed out, 0 links to other areas' pages) · usable in 24–110 s · lands on `/dashboard/[eventId]/schedule?view=preparation&filter=todo` · forward ✓ · lands on a "Syncing your day" splash for ~105 s (A2-P11)
- [x] /dashboard/[eventId]/clearance · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 14 (375) / 24 (1280) · pressed 10 (buttons 2+0 repeats, links 8 to pages opened in this walk) · failed 0 · left 4 (2 would change data / pay / timed out, 2 links to other areas' pages) · usable in 30–64 s · CLEAN ok · BALANCED ok · EFFECTIVE: the irreversible button is offered before the day (A2-P8)
- [x] /dashboard/[eventId]/contracts · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 11 (375) / 21 (1280) · pressed 9 (buttons 2+0 repeats, links 7 to pages opened in this walk) · failed 0 · left 2 (1 would change data / pay / timed out, 1 links to other areas' pages) · usable in 36–72 s · CLEAN ok · BALANCED ok · EFFECTIVE ok (empty state)
- [x] /dashboard/[eventId]/date-selection · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 14 (375) / 24 (1280) · pressed 11 (buttons 2+0 repeats, links 9 to pages opened in this walk) · failed 0 · left 3 (2 would change data / pay / timed out, 1 links to other areas' pages) · usable in 69–71 s · CLEAN ok · BALANCED ok · EFFECTIVE: restarts a locked date (A2-P9)
- [x] /dashboard/[eventId]/details · B: 375✓ 768✓ 1280✓ · DARK: yes · buttons 10 (375) / 61 (1280) · pressed 4 (buttons 0+0 repeats, links 4 to pages opened in this walk) · failed 0 · left 8 (8 would change data / pay / timed out, 0 links to other areas' pages) · usable in 105–109 s · lands on `/dashboard/[eventId]?settings=1` · forward ✓ (couple → Home ?settings=1)
- [x] /dashboard/[eventId]/details/field/area · B: 375✓ 768✓ 1280✓ · DARK: yes · buttons 85 (375) / 98 (1280) · pressed 17 (buttons 0+0 repeats, links 17 to pages opened in this walk) · failed 0 · left 19 (18 would change data / pay / timed out, 1 links to other areas' pages) · usable in 19–24 s · lands on `/dashboard/[eventId]?settings=1` · forward → Home ?settings=1, field not opened (A2-H11 SEEN); sheet's only Done is a lone ✓
- [x] /dashboard/[eventId]/details/change · B: 375✓ 768✓ 1280✓ · DARK: yes · buttons 85 (375) / 20 (1280) · pressed 0 (buttons 0+0 repeats, links 0 to pages opened in this walk) · failed 0 · left 0 (0 would change data / pay / timed out, 0 links to other areas' pages) · usable in 22–31 s · lands on `/dashboard/[eventId]?settings=1` · forward ✓ → field/area → Home ?settings=1
- [x] /dashboard/[eventId]/disputes · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 18 (375) / 28 (1280) · pressed 13 (buttons 3+4 repeats, links 6 to pages opened in this walk) · failed 0 · left 5 (4 would change data / pay / timed out, 1 links to other areas' pages) · usable in 22–69 s · CLEAN ok · BALANCED ok · EFFECTIVE: 13 px icon buttons (A2-P14)
- [x] /dashboard/[eventId]/documents · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 12 (375) / 22 (1280) · pressed 10 (buttons 2+0 repeats, links 8 to pages opened in this walk) · failed 0 · left 2 (1 would change data / pay / timed out, 1 links to other areas' pages) · usable in 6–58 s · CLEAN: two accent outlines (A2-I7) · BALANCED ok · EFFECTIVE ok
- [x] /dashboard/[eventId]/find-date · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 23 (375) / 35 (1280) · pressed 8 (buttons 1+0 repeats, links 7 to pages opened in this walk) · failed 0 · left 14 (13 would change data / pay / timed out, 1 links to other areas' pages) · usable in 32–43 s · lands on `/dashboard/[eventId]/launch?tool=details&item=date&date=help` · forward → /launch?tool=details&item=date&date=help; the Maker's tour covers the date help
- [x] /dashboard/[eventId]/guests · B: 375✓ 768✓ 1280✓ · DARK: yes · buttons 305 (375) / 315 (1280) · pressed 145 (buttons 135+4 repeats, links 6 to pages opened in this walk) · failed 0 · left 160 (158 would change data / pay / timed out, 2 links to other areas' pages) · usable in 6–144 s · CLEAN ok · BALANCED ok · EFFECTIVE: Bride & Groom shows one name twice (A2-P6)
- [x] /dashboard/[eventId]/guests/checkin · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 16 (375) / 26 (1280) · pressed 13 (buttons 5+0 repeats, links 8 to pages opened in this walk) · failed 0 · left 3 (2 would change data / pay / timed out, 1 links to other areas' pages) · usable in 18–99 s · CLEAN: helper paragraph · BALANCED ok · EFFECTIVE ok (0 / 60 attending)
- [x] /dashboard/[eventId]/guests/claims · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 12 (375) / 22 (1280) · pressed 10 (buttons 3+0 repeats, links 7 to pages opened in this walk) · failed 0 · left 2 (1 would change data / pay / timed out, 1 links to other areas' pages) · usable in 24–86 s · CLEAN ok · BALANCED ok · EFFECTIVE ok
- [x] /dashboard/[eventId]/guests/import · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 15 (375) / 25 (1280) · pressed 10 (buttons 3+0 repeats, links 7 to pages opened in this walk) · failed 0 · left 5 (1 would change data / pay / timed out, 4 links to other areas' pages) · usable in 28–114 s · CLEAN: launch story (A2-P5) · BALANCED ok · EFFECTIVE: contradicts itself
- [x] /dashboard/[eventId]/guests/new · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 31 (375) / 41 (1280) · pressed 23 (buttons 5+10 repeats, links 8 to pages opened in this walk) · failed 0 · left 8 (7 would change data / pay / timed out, 1 links to other areas' pages) · usable in 24–53 s · CLEAN ok · BALANCED ok · EFFECTIVE: required Side/Group below the fold
- [x] /dashboard/[eventId]/guests/quick · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 16 (375) / 26 (1280) · pressed 13 (buttons 4+0 repeats, links 9 to pages opened in this walk) · failed 0 · left 3 (2 would change data / pay / timed out, 1 links to other areas' pages) · usable in 7–43 s · CLEAN: key-chip instructions + helper paragraph · BALANCED ok · EFFECTIVE ok
- [x] /dashboard/[eventId]/guests/souvenirs · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 14 (375) / 24 (1280) · pressed 12 (buttons 5+0 repeats, links 7 to pages opened in this walk) · failed 0 · left 2 (1 would change data / pay / timed out, 1 links to other areas' pages) · usable in 7–35 s · CLEAN ok · BALANCED ok · EFFECTIVE: "0 / 92" counts every guest (A2-E1)
- [x] /dashboard/[eventId]/guests/tea-ceremony · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 2 (375) / 2 (1280) · pressed 2 (buttons 0+0 repeats, links 2 to pages opened in this walk) · failed 0 · left 0 (0 would change data / pay / timed out, 0 links to other areas' pages) · usable in 8–66 s · 404 by design for a Catholic wedding (no seeded Chinese wedding): not walked with data
- [x] /dashboard/[eventId]/hosts · B: 375✓ 768✓ 1280✓ · DARK: yes · buttons 305 (375) / 315 (1280) · pressed 146 (buttons 136+4 repeats, links 6 to pages opened in this walk) · failed 0 · left 159 (157 would change data / pay / timed out, 2 links to other areas' pages) · usable in 14–37 s · lands on `/dashboard/[eventId]/guests` · forward → /guests for the couple ✓
- [x] /dashboard/[eventId]/manpower · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 14 (375) / 24 (1280) · pressed 12 (buttons 5+0 repeats, links 7 to pages opened in this walk) · failed 0 · left 2 (1 would change data / pay / timed out, 1 links to other areas' pages) · usable in 8–123 s · CLEAN: "SETNAYAN NOTE" block · BALANCED ok · EFFECTIVE ok
- [x] /dashboard/[eventId]/messages · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 37 (375) / 67 (1280) · pressed 12 (buttons 5+0 repeats, links 7 to pages opened in this walk) · failed 0 (no visible effect on 1: All — re-checked or explained, not faults) · left 24 (14 would change data / pay / timed out, 10 links to other areas' pages) · usable in 22–36 s · CLEAN ok · BALANCED: list rows' white cards cut at the right edge at 375 (swipe rows) · EFFECTIVE ok; one load landed signed out (A2-P20)
- [x] /dashboard/[eventId]/messages/1c89e70c-d969-40f6-8f51-235a35ae3e89 · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 27 (375) / 66 (1280) · pressed 11 (buttons 4+0 repeats, links 7 to pages opened in this walk) · failed 0 · left 12 (11 would change data / pay / timed out, 1 links to other areas' pages) · usable in 18–73 s · CLEAN ok · BALANCED ok · EFFECTIVE ok (Tugtugan Sounds thread)
- [x] /dashboard/[eventId]/nikah · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 2 (375) / 2 (1280) · pressed 2 (buttons 0+0 repeats, links 2 to pages opened in this walk) · failed 0 · left 0 (0 would change data / pay / timed out, 0 links to other areas' pages) · usable in 8–109 s · 404 by design (not a Muslim wedding; none seeded): not walked with data
- [x] /dashboard/[eventId]/orders · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 14 (375) / 24 (1280) · pressed 11 (buttons 2+1 repeats, links 8 to pages opened in this walk) · failed 0 · left 3 (1 would change data / pay / timed out, 2 links to other areas' pages) · usable in 6–22 s · CLEAN ok · BALANCED ok · EFFECTIVE ok ("incl. VAT" vs order page, A2-P3)
- [x] /dashboard/[eventId]/orders/7c1e13f0-c95c-42b0-b52c-15eb1d465e55 · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 13 (375) / 23 (1280) · pressed 10 (buttons 2+0 repeats, links 8 to pages opened in this walk) · failed 0 · left 3 (2 would change data / pay / timed out, 1 links to other areas' pages) · usable in 6–21 s · CLEAN ok · BALANCED ok · EFFECTIVE: VAT wording and "₱2 , 990" (A2-P3)
- [x] /dashboard/[eventId]/orders/new · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 19 (375) / 29 (1280) · pressed 15 (buttons 8+0 repeats, links 7 to pages opened in this walk) · failed 0 (no visible effect on 1: Close — re-checked or explained, not faults) · left 3 (2 would change data / pay / timed out, 1 links to other areas' pages) · usable in 8–32 s · lands on `/dashboard/[eventId]/studio/website-pro` · forward ✓ → Event services · prices (A2-P2)
- [x] /dashboard/[eventId]/paperwork · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 13 (375) / 23 (1280) · pressed 10 (buttons 2+0 repeats, links 8 to pages opened in this walk) · failed 0 · left 3 (2 would change data / pay / timed out, 1 links to other areas' pages) · usable in 6–21 s · CLEAN ok · BALANCED ok · EFFECTIVE ok
- [x] /dashboard/[eventId]/people · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 16 (375) / 26 (1280) · pressed 13 (buttons 3+0 repeats, links 10 to pages opened in this walk) · failed 0 · left 3 (1 would change data / pay / timed out, 2 links to other areas' pages) · usable in 5–21 s · CLEAN ok · BALANCED ok · EFFECTIVE ok (99 = 92 + 6 + 1 ✓)
- [x] /dashboard/[eventId]/refer · B: 375✓ 768✓ 1280✓ · DARK: yes · buttons 52 (375) / 60 (1280) · pressed 37 (buttons 13+2 repeats, links 22 to pages opened in this walk) · failed 0 (no visible effect on 2: Share your rough timing preference — a window, not, Counter 2 of 2 — re-checked or explained, not faults) · left 13 (5 would change data / pay / timed out, 8 links to other areas' pages) · usable in 8–26 s · lands on `/dashboard/[eventId]` · forwards to the event Home (phase A had it as a page)
- [x] /dashboard/[eventId]/schedule · B: 375✓ 768✓ 1280✓ · DARK: yes · buttons 24 (375) / 41 (1280) · pressed 15 (buttons 9+0 repeats, links 6 to pages opened in this walk) · failed 0 · left 9 (8 would change data / pay / timed out, 1 links to other areas' pages) · usable in 6–166 s · CLEAN ok · BALANCED ok · EFFECTIVE: hydration error #418 (A2-P11); tour
- [x] /dashboard/[eventId]/seating · B: 375✓ 768✓ 1280✓ · DARK: yes · buttons 40 (375) / 23 (1280) · pressed 23 (buttons 17+0 repeats, links 6 to pages opened in this walk) · failed 0 (no visible effect on 4: 10 tables, Rotate, Zoom out, Zoom in — re-checked or explained, not faults) · left 13 (12 would change data / pay / timed out, 1 links to other areas' pages) · usable in 22–50 s · lands on `/dashboard/[eventId]/guests?gview=seats` · forward → /guests?gview=seats ✓ · table pins 26 px
- [x] /dashboard/[eventId]/seating/chart · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 16 (375) / 21 (1280) · pressed 12 (buttons 5+0 repeats, links 7 to pages opened in this walk) · failed 0 (no visible effect on 1: A to Z — re-checked or explained, not faults) · left 3 (2 would change data / pay / timed out, 1 links to other areas' pages) · usable in 26–66 s · CLEAN ok · BALANCED ok · EFFECTIVE ok (chart names are right)
- [x] /dashboard/[eventId]/seating/lab · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 14 (375) / 24 (1280) · pressed 6 (buttons 0+0 repeats, links 6 to pages opened in this walk) · failed 0 · left 8 (7 would change data / pay / timed out, 1 links to other areas' pages) · usable in 24–149 s · 3D draws at 375 ✓ (30 × 45 grid, 4 pills)
- [x] /dashboard/[eventId]/seating/walkthrough · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 14 (375) / 24 (1280) · pressed 11 (buttons 4+0 repeats, links 7 to pages opened in this walk) · failed 0 · left 3 (2 would change data / pay / timed out, 1 links to other areas' pages) · usable in 8–75 s · CLEAN ok · BALANCED: zone placeholder cut · EFFECTIVE ok
- [x] /dashboard/[eventId]/sponsors · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 31 (375) / 41 (1280) · pressed 28 (buttons 10+10 repeats, links 8 to pages opened in this walk) · failed 0 · left 3 (2 would change data / pay / timed out, 1 links to other areas' pages) · usable in 3–62 s · CLEAN ok · BALANCED ok · EFFECTIVE: second sponsor list (A2-I14)
- [x] /dashboard/[eventId]/vendors · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 46 (375) / 56 (1280) · pressed 31 (buttons 24+0 repeats, links 7 to pages opened in this walk) · failed 0 · left 16 (8 would change data / pay / timed out, 8 links to other areas' pages) · usable in 11–131 s · CLEAN ok · BALANCED ok · EFFECTIVE: tour over Find · Build · Book (A2-P13)
- [x] /dashboard/[eventId]/vendors/categories · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 67 (375) / 21 (1280) · pressed 65 (buttons 3+5 repeats, links 57 to pages opened in this walk) · failed 0 · left 2 (1 would change data / pay / timed out, 1 links to other areas' pages) · usable in 3–151 s · CLEAN ok · BALANCED ok · EFFECTIVE: "3 booked" (A2-P7); "Joining soon" row (A2-P19)
- [x] /dashboard/[eventId]/vendors/d4054370-577c-4187-84da-71c93b08517d · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 11 (375) / 21 (1280) · pressed 8 (buttons 2+0 repeats, links 6 to pages opened in this walk) · failed 0 · left 6 (5 would change data / pay / timed out, 1 links to other areas' pages) · usable in 22–57 s · lands on `/dashboard/[eventId]/vendors/d4054370-577c-4187-84da-71c93b08517d/workspace` · forward → /workspace ✓
- [x] /dashboard/[eventId]/more · B: 375✓ 768✓ 1280✗ · DARK: yes · buttons 52 (375) / — (1280) · pressed 7 (buttons 3+0 repeats, links 4 to pages opened in this walk) · failed 0 · left 1 (1 would change data / pay / timed out, 0 links to other areas' pages) · usable in 22–26 s · lands on `/dashboard/[eventId]` · forward → event Home ✓
- [x] /dashboard/[eventId]/progress · B: 375✓ 768✓ 1280✓ · DARK: yes · buttons 52 (375) / 62 (1280) · pressed 37 (buttons 13+2 repeats, links 22 to pages opened in this walk) · failed 0 (no visible effect on 2: Share your rough timing preference — a window, not, Counter 2 of 2 — re-checked or explained, not faults) · left 13 (5 would change data / pay / timed out, 8 links to other areas' pages) · usable in 30–131 s · lands on `/dashboard/[eventId]` · forward → event Home ✓
- [x] /dashboard/api-keys · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 9 (375) / 22 (1280) · pressed 7 (buttons 3+0 repeats, links 4 to pages opened in this walk) · failed 0 · left 2 (1 would change data / pay / timed out, 1 links to other areas' pages) · usable in 20–54 s · CLEAN: sample curl + endpoint list for a couple · EFFECTIVE: a closed feature (A2-C3)
- [x] /dashboard/billing · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 8 (375) / 21 (1280) · pressed 6 (buttons 2+0 repeats, links 4 to pages opened in this walk) · failed 0 · left 2 (1 would change data / pay / timed out, 1 links to other areas' pages) · usable in 10–60 s · CLEAN ok · BALANCED ok · EFFECTIVE ok
- [x] /dashboard/clusters · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 8 (375) / 21 (1280) · pressed 5 (buttons 2+0 repeats, links 3 to pages opened in this walk) · failed 0 · left 3 (3 would change data / pay / timed out, 0 links to other areas' pages) · usable in 5–51 s · CLEAN ok · BALANCED: no gutter (A2-P16) · EFFECTIVE: no door (A2-C13)
- [x] /dashboard/create-event · B: 375✓ 768✓ 1280✓ · DARK: yes · buttons 26 (375) / 39 (1280) · pressed 16 (buttons 12+0 repeats, links 4 to pages opened in this walk) · failed 0 (no visible effect on 8: Debut, Travel, Tournament, Reunion, Gala Night, Date, Hangout, Open house — re-checked or explained, not faults) · left 2 (2 would change data / pay / timed out, 0 links to other areas' pages) · usable in 3–44 s · CLEAN ok · BALANCED ok · EFFECTIVE ok (bottom bar covers the 3rd row of tiles at 375)
- [x] /dashboard/notifications · B: 375✓ 768✓ 1280✓ · DARK: yes · buttons 7 (375) / 20 (1280) · pressed 6 (buttons 2+0 repeats, links 4 to pages opened in this walk) · failed 0 · left 1 (1 would change data / pay / timed out, 0 links to other areas' pages) · usable in 3–42 s · CLEAN ok · BALANCED ok · EFFECTIVE ok (empty; seed has no notification rows)
- [x] /dashboard/people · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 17 (375) / 31 (1280) · pressed 13 (buttons 7+0 repeats, links 6 to pages opened in this walk) · failed 0 (no visible effect on 1: Add someone — re-checked or explained, not faults) · left 3 (2 would change data / pay / timed out, 1 links to other areas' pages) · usable in 5–55 s · lands on `/dashboard?seg=people` · forward ✓ · K1: two accent buttons (A2-P17)
- [x] /dashboard/profile · B: 375✓ 768✓ 1280✓ · DARK: yes · buttons 16 (375) / 28 (1280) · pressed 14 (buttons 2+0 repeats, links 12 to pages opened in this walk) · failed 0 · left 2 (1 would change data / pay / timed out, 1 links to other areas' pages) · usable in 3–47 s · CLEAN ok · BALANCED ok · EFFECTIVE ok
- [x] /dashboard/profile/concierge · B: 375✓ 768✓ 1280✓ · DARK: yes · buttons 10 (375) / 23 (1280) · pressed 7 (buttons 2+1 repeats, links 4 to pages opened in this walk) · failed 0 · left 3 (2 would change data / pay / timed out, 1 links to other areas' pages) · usable in 3–39 s · CLEAN: two Backs (A2-C11) · EFFECTIVE: "See pricing" with no price (A2-P18)
- [x] /dashboard/samahan · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 6 (375) / 27 (1280) · pressed 11 (buttons 5+0 repeats, links 6 to pages opened in this walk) · failed 0 · left 2 (1 would change data / pay / timed out, 1 links to other areas' pages) · usable in 4–32 s · lands on `/dashboard?seg=people&view=samahan` · forward lands on a BLANK screen (A2-P4)
- [x] /dashboard/samahan/new · B: 375✓ 768✓ 1280✓ · DARK: yes · buttons 7 (375) / 18 (1280) · pressed 5 (buttons 2+0 repeats, links 3 to pages opened in this walk) · failed 0 · left 2 (2 would change data / pay / timed out, 0 links to other areas' pages) · usable in 3–22 s · CLEAN ok · EFFECTIVE: no visible title, two fields (SMALL POPUP, A2-C15)
- [x] /dashboard/search · B: 375✓ 768✓ 1280✓ · DARK: — · buttons 51 (375) / 64 (1280) · pressed 22 (buttons 9+7 repeats, links 6 to pages opened in this walk) · failed 0 · left 29 (5 would change data / pay / timed out, 24 links to other areas' pages) · usable in 7–27 s · lands on `/?discover=1` · CLEAN ok · BALANCED ok · EFFECTIVE ok
- [x] /dashboard/year · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 6 (375) / 20 (1280) · pressed 23 (buttons 7+4 repeats, links 12 to pages opened in this walk) · failed 0 (no visible effect on 1: 0 celebrated — re-checked or explained, not faults) · left 5 (2 would change data / pay / timed out, 3 links to other areas' pages) · usable in 5–72 s · lands on `/dashboard?seg=events#worth-planning` · forward ✓ → /dashboard?seg=events#worth-planning (~100 s)
- [x] /onboarding/wedding · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 2 (375) / 2 (1280) · pressed 2 (links to pages opened in this walk) · failed 0 · left 0 (0 buttons not pressed: the copy took 20–180 s per signed-in load, too slow to reload after each press; the rest are links to other areas' pages) · usable in 3–48 s · blocked: "You're already planning a wedding" ✓ · bare page (A2-A1)
- [x] /onboarding/simple · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 9 (375) / 9 (1280) · pressed 4 (buttons 3+0 repeats, links 1 to pages opened in this walk) · failed 0 · left 5 (5 would change data / pay / timed out, 0 links to other areas' pages) · usable in 3–36 s · CLEAN ok · EFFECTIVE: US date format mm/dd/yyyy
- [x] /onboarding/birthday · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 11 (375) / 11 (1280) · pressed 1 (links to pages opened in this walk) · failed 0 · left 10 (9 buttons not pressed: the copy took 20–180 s per signed-in load, too slow to reload after each press; the rest are links to other areas' pages) · usable in 4–137 s · CLEAN ok · EFFECTIVE ok ("already have a birthday in planning" with a link)
- [x] /pay/STG-0001 · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 7 (375) / 7 (1280) · pressed 5 (buttons 2+1 repeats, links 2 to pages opened in this walk) · failed 0 · left 2 (2 would change data / pay / timed out, 0 links to other areas' pages) · usable in 4–116 s · CLEAN ok · BALANCED ok · EFFECTIVE ok (₱2,990.00 = order ✓, fixed To-pay bar)
- [x] /receipts/order/7c1e13f0-c95c-42b0-b52c-15eb1d465e55 · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 3 (375) / 3 (1280) · pressed 3 (buttons 1+0 repeats, links 2 to pages opened in this walk) · failed 0 · left 0 (0 would change data / pay / timed out, 0 links to other areas' pages) · usable in 3–75 s · CLEAN ok · EFFECTIVE: "₱2 , 990"; bronze Pay (A2-F8)
- [x] /signup/you · B: 375✓ 768✓ 1280✓ · DARK: yes · buttons 6 (375) / 6 (1280) · pressed 1 (links to pages opened in this walk) · failed 0 · left 5 (5 buttons not pressed: the copy took 20–180 s per signed-in load, too slow to reload after each press; the rest are links to other areas' pages) · usable in 3–78 s · CLEAN ok · EFFECTIVE: native select for Prefix (not PickMenu)
- [x] /dashboard/[eventId]/guests/d56b20cb-fbdf-4694-85bd-0feda93921bc · B: 375✓ 768✓ 1280✓ · DARK: no · buttons 81 (375) / 91 (1280) · pressed 50 (buttons 33+9 repeats, links 8 to pages opened in this walk) · failed 0 (no visible effect on 3: Note — Josefa Rizal, Name and contact +639170000010, Notes None — NOT re-checked: may be slow sheets; a builder should press them) · left 28 (25 would change data / pay / timed out, 3 links to other areas' pages) · usable in 9–87 s · CLEAN ok · BALANCED ok · EFFECTIVE ok (Josefa Rizal card)
- [x] /dashboard/[eventId]/contracts/00000000-0000-4000-8000-000000000000 · B: 375✓ 768✗ 1280✓ · DARK: — · buttons 2 (375) / 2 (1280) · pressed 2 (links to pages opened in this walk) · failed 0 · left 0 (0 buttons not pressed: the copy took 20–180 s per signed-in load, too slow to reload after each press; the rest are links to other areas' pages) · usable in 7–47 s · no contract seeded: an unknown id shows the generic 404
- [x] /dashboard/[eventId]/vendors/d4054370-577c-4187-84da-71c93b08517d/review · B: 375✓ 768✗ 1280✓ · DARK: — · buttons 12 (375) / 22 (1280) · pressed 8 (links to pages opened in this walk) · failed 0 · left 4 (4 buttons not pressed: the copy took 20–180 s per signed-in load, too slow to reload after each press; the rest are links to other areas' pages) · usable in 6–27 s · review page for a booked supplier (event not over)
- [x] /dashboard/[eventId]/vendors/packages/00000000-0000-4000-8000-000000000000 · B: 375✓ 768✗ 1280✓ · DARK: — · buttons 2 (375) / 2 (1280) · pressed 2 (links to pages opened in this walk) · failed 0 · left 0 (0 buttons not pressed: the copy took 20–180 s per signed-in load, too slow to reload after each press; the rest are links to other areas' pages) · usable in 6–27 s · no package seeded: generic 404
- [x] /dashboard/people/00000000-0000-4000-8000-000000000000 · B: 375✓ 768✗ 1280✓ · DARK: — · buttons 2 (375) / 2 (1280) · pressed 2 (links to pages opened in this walk) · failed 0 · left 0 (0 buttons not pressed: the copy took 20–180 s per signed-in load, too slow to reload after each press; the rest are links to other areas' pages) · usable in 3–7 s · no loved one seeded: generic 404
- [x] /dashboard/clusters/00000000-0000-4000-8000-000000000000 · B: 375✓ 768✗ 1280✓ · DARK: — · buttons 2 (375) / 2 (1280) · pressed 2 (links to pages opened in this walk) · failed 0 · left 0 (0 buttons not pressed: the copy took 20–180 s per signed-in load, too slow to reload after each press; the rest are links to other areas' pages) · usable in 3–4 s · no linked group seeded: generic 404
- [x] /dashboard/samahan/00000000-0000-4000-8000-000000000000 · B: 375✓ 768✗ 1280✓ · DARK: — · buttons 2 (375) / 2 (1280) · pressed 2 (links to pages opened in this walk) · failed 0 · left 0 (0 buttons not pressed: the copy took 20–180 s per signed-in load, too slow to reload after each press; the rest are links to other areas' pages) · usable in 3–3 s · no group seeded: generic 404
- [x] /proposals/S89PRP-0000000000 · B: 375✓ 768✗ 1280✓ · DARK: — · buttons 2 (375) / 2 (1280) · pressed 2 (links to pages opened in this walk) · failed 0 · left 0 (0 buttons not pressed: the copy took 20–180 s per signed-in load, too slow to reload after each press; the rest are links to other areas' pages) · usable in 2–3 s · no proposal seeded: generic 404
- [x] /host/accept/notarealtoken · B: 375✓ 768✗ 1280✓ · DARK: — · buttons 2 (375) / 2 (1280) · pressed 2 (links to pages opened in this walk) · failed 0 · left 0 (0 buttons not pressed: the copy took 20–180 s per signed-in load, too slow to reload after each press; the rest are links to other areas' pages) · usable in 3–3 s · bad token → generic 404, not "this invite expired" (A2-A10)
- [x] /receipts/00000000-0000-4000-8000-000000000000 · B: 375✓ 768✗ 1280✓ · DARK: — · buttons 2 (375) / 2 (1280) · pressed 2 (links to pages opened in this walk) · failed 0 · left 0 (0 buttons not pressed: the copy took 20–180 s per signed-in load, too slow to reload after each press; the rest are links to other areas' pages) · usable in 3–3 s · no receipt row seeded: generic 404
- [x] /receipts/payment/00000000-0000-4000-8000-000000000000 · B: 375✓ 768✗ 1280✓ · DARK: — · buttons 2 (375) / 2 (1280) · pressed 2 (links to pages opened in this walk) · failed 0 · left 0 (0 buttons not pressed: the copy took 20–180 s per signed-in load, too slow to reload after each press; the rest are links to other areas' pages) · usable in 3–5 s · no payment receipt id reachable: generic 404
- [x] /pay/STG-0002 · B: 375✓ 768✓ 1280✓ · DARK: — · buttons 7 (375) / 7 (1280) · pressed 4 (links to pages opened in this walk) · failed 0 · left 3 (4 buttons not pressed: the copy took 20–180 s per signed-in load, too slow to reload after each press; the rest are links to other areas' pages) · usable in 4–23 s · ₱2,790.00 = order ✓
- [x] /onboarding/debut · B: 375✓ 768✗ 1280✓ · DARK: — · buttons 11 (375) / 11 (1280) · pressed 1 (links to pages opened in this walk) · failed 0 · left 10 (9 buttons not pressed: the copy took 20–180 s per signed-in load, too slow to reload after each press; the rest are links to other areas' pages) · usable in 6–22 s · CLEAN ok · EFFECTIVE ok

## BLOCKERS

None found in the code pass (phase A).

**Phase B, 25 Nov ~07:20 UTC — copy health, NOT filed as a blocker (controller's call):** the staging copy is
very slow for a signed-in couple. Measured from this cloud container (not from the Philippines), with
`/api/health` answering in 0.7–0.9 s: `/dashboard` first byte 23–131 s; `/dashboard/[eventId]` (Bea & Paolo)
17–108 s to first byte; `/dashboard/[eventId]/guests` 104–144 s to usable, and several loads passed 150 s with no
answer; `/details` and `/checklist` ~105 s. A person would give up. Pages with lighter reads (`/budget`,
`/documents`, `/access-requests`) answer in 2–6 s. It looks like the copy's database (or eight checkers at once)
rather than the code, but production should be timed the same way before launch. I cut my own load to 2 tabs.
Later in the day (from roughly 08:20 UTC) the same pages answered in 3–7 s, which points at load on the copy
rather than at a page. The per-page "usable in" ranges on the Progress lines span both periods.

## Phase B · findings seen on the staging copy (`SOURCE: SEEN`, 25 Nov, commit bd86936)

> Walked signed in as `couple_plan` on **Bea & Paolo** (`stg-bea-paolo`), Sofia's 18th and Lolo Ben at 80. Shots are
> kept in the checker's scratchpad (not committed: they carry the preview address); the home shots for Add 7 are
> committed under `shots/area-2/`. Phase-A findings that the browser confirmed are listed after the new ones.
> Times are from a cloud container, not the Philippines, on a copy that was slow for every signed-in read (see BLOCKERS).

#### A2-P1 · Home's paid and owing figures count up from ₱0
```
PAGE      /dashboard/[eventId]   (event: stg-bea-paolo) — also under ?settings=1 (Details forwards there)
BUTTON    —
STEPS     1. Open the event home (or /details, which lands on Home ?settings=1). 2. Read the Budget line before it settles.
EXPECTED  The money line shows the real figures at once: "Paid ₱124,488 · still owing ₱165,782 · 43% paid of ₱290,270 agreed".
ACTUAL    The two peso figures and the % are a count-up (`home-control-row.tsx` → `<Count format="peso">`). Four loads were
          caught mid-count: "Paid ₱0 · still owing ₱0 · 0% paid of ₱290,270 agreed", "Paid ₱47,897 · still owing ₱57,760 · 24%",
          "Paid ₱81,599 · still owing ₱100,254 · 37%". On a slow phone a person reads ₱0 paid / ₱0 owed as a fact.
SHOTS     details-768-light (₱0), details-375-dark (₱47,897), details-1280-light (₱81,599) vs Home-375-light (settled)
RULE      CLAUDE.md §5 rule 4 (a money read never shows ₱0 that is not true) · MOTION_STANDARD (controls and facts don't dance)
SEVERITY  money-signin
SOURCE    SEEN
```

#### A2-P2 · Event services: Event Pro priced below Event Plus; Event Ultra "Couldn't read"
```
PAGE      /dashboard/[eventId]/orders/new → /dashboard/[eventId]/studio/website-pro ("Event services")   (event: stg-bea-paolo)
BUTTON    "Pick a pack" rows
STEPS     1. Orders › New order. 2. Read the three packs.
EXPECTED  Each pack shows its catalogue price, ladder rising Plus < Pro < Ultra, the same figure /pricing shows.
ACTUAL    Event Plus: "BEING CHECKED" (no price; its order STG-0001 is ₱2,990, read from the catalogue by the seed).
          Event Pro: "₱2,500" — lower than Event Plus, with no "pay the difference" line under it, so a person cannot tell
          whether it is the full price or an upgrade price. Event Ultra: "Couldn't read", while /pricing on the same copy
          reads Event Ultra ₱9,990. The honest state works, but the read behind it fails on this page only.
SHOTS     orders_new-375-light, orders_new-1280-light
RULE      CLAUDE.md §1 (prices read from platform_retail_catalog_v2, one reader) · Add 4 HONEST
SEVERITY  money-signin
SOURCE    SEEN
```

#### A2-P3 · Order page says VAT is added on top; the list says "incl. VAT"; figures print as "₱2 , 990"
```
PAGE      /dashboard/[eventId]/orders/[orderId] (STG-0001) · /dashboard/[eventId]/orders · /receipts/order/[orderId]
BUTTON    —
STEPS     1. Orders: the row reads "₱2,990 INCL. VAT". 2. Open it.
EXPECTED  One wording for tax on every money screen, and pesos printed as ₱2,990.
ACTUAL    The order tiles read "PRE-VAT BASE ₱2,990 · + VAT (0%) ₱0 · TOTAL TO PAY ₱2,990" and "Requested base = ₱2 , 990.
          PH VAT (0%) is added on top"; the list calls the same figure "incl. VAT". The body line and the receipt's big
          figure render with a gap and spaced comma ("₱2 , 990"), the mono figure style splitting the number.
SHOTS     orders_7c1e…-375-light, receipts_order_7c1e…-375-light, orders-375-light
RULE      CLAUDE.md §1 (money read, formatted through lib/php.ts) · brand.md (plain words)
SEVERITY  money-signin
SOURCE    SEEN
```

#### A2-P4 · "Groups" (/dashboard/samahan) lands on a blank screen
```
PAGE      /dashboard/samahan → /dashboard?seg=people&view=samahan
BUTTON    rail / any "Groups" door
STEPS     1. Open /dashboard/samahan as a couple with no groups. 2. Wait 60 s.
EXPECTED  The People › Groups view: "No group yet" and a New group action.
ACTUAL    Only the top bar and the Home · Discover bar; the content area stays empty (twice, 60 s+ each). In
          `people-segment.tsx` the view draws only `view === 'samahan' && groupRows ? … : nothing`, so an empty or failed
          rows read draws nothing at all. /dashboard/people (same segment, list view) draws fine.
SHOTS     re_dashboard_samahan (375 light)
RULE      Kit § 5 item 1 (no blank screen) · CLAUDE.md §5 rule 4 (empty and failure never look like nothing)
SEVERITY  broken
SOURCE    SEEN
```

#### A2-P5 · Import page says importing opens on 19 Dec, under working import steps
```
PAGE      /dashboard/[eventId]/guests/import   (event: stg-bea-paolo)
BUTTON    "Download for Excel / Numbers" · "Open in Google Sheets" · "CSV"
STEPS     1. Guests › Import.
EXPECTED  Either the import works (no notice) or it is closed (no steps). Never a launch story in the tool.
ACTUAL    Step 1 "Get the guest list file" with live download buttons, and under it a paragraph: "Thank you for planning
          with Setnayan! Our very first event is our founders' wedding on December 18, 2026 … Importing guests from a file
          opens on December 19, 2026. Until then, add your guests one at a time". The page contradicts itself and
          advertises a coming date.
SHOTS     guests_import-375-light
RULE      brand.md claims 9 (nothing coming) · Add 3 (placeholders / coming) · Add 2 CLEAN
SEVERITY  wrong
SOURCE    SEEN
```

#### A2-P6 · Guest list shows the bride's name on the groom's row
```
PAGE      /dashboard/[eventId]/guests (List)   (event: stg-bea-paolo)
BUTTON    —
STEPS     1. Guests › List › Bride & Groom.
EXPECTED  "Bea Villanueva" and "Paolo Garcia", as the seat chart and the guest rows hold them.
ACTUAL    "Bea Villanueva" twice. The seat chart (/seating/chart) prints Bea Villanueva AND Paolo Garcia at the
          Presidential table, so the rows are right and the list draws the linked account's name over the row's own
          name. The seed links the creator's account to the groom row (seed.sql "The creator is their couple row"),
          so the trigger here is seed-shaped, but the display rule (account name beats the row's name) would hit any
          couple where one partner's account is linked to the other row, or a guest who signed up with a nickname.
SHOTS     guests-375-light, seating_chart-375-light
RULE      CLAUDE.md §4 (Guest: one reader) · Kit § 5 item 3 (two pages disagree)
SEVERITY  wrong (PLAUSIBLE: needs a builder to confirm which name a linked row should show)
SOURCE    SEEN
```

#### A2-P7 · Find says "3 booked"; Home says "6 of 25 booked"
```
PAGE      /dashboard/[eventId]/vendors/categories · /dashboard/[eventId] (Suppliers tile) · /dashboard/[eventId]/people
BUTTON    —
STEPS     1. Suppliers › Find. 2. Read the photo chip. 3. Compare Home and People.
EXPECTED  One booked count everywhere (BOOKED_EVENT_VENDOR_STATUSES).
ACTUAL    Find's chip: "4 CATEGORIES · 3 BOOKED". Home: "6 of 25 booked · 19 still to book". People: "Booked to be there ·
          6 suppliers". The chip counts booked categories among the four "Popular for weddings", but says "booked" with
          no unit, beside a list where a person counts suppliers.
SHOTS     vendors_categories-375-light, Home-1280-light, people-375-light
RULE      CLAUDE.md §4 (booked = one reader) · Add 2 EFFECTIVE (plain labels)
SEVERITY  wrong
SOURCE    SEEN
```

#### A2-P8 · "Close out the day" offered 89 days before the event
```
PAGE      /dashboard/[eventId]/clearance   (event: stg-bea-paolo, Feb 23 2027)
BUTTON    "Close out the day" (NOT pressed: irreversible, seeded data)
STEPS     1. Open /clearance on an event 89 days away.
EXPECTED  Before the day: the page says it opens after the event, the main button is not offered.
ACTUAL    The terracotta "Close out the day" button is live, under the line "You can do this once the event is over. It
          can't be undone". With A2-G19 (no confirm) one stray tap ends a wedding that has not happened.
SHOTS     clearance-375-light
RULE      Kit § 5 item 2 · HOUSE_DESIGN_STANDARD (confirm only for the irreversible — here it is irreversible)
SEVERITY  broken
SOURCE    SEEN
```

#### A2-P9 · Date selection starts over on a locked date
```
PAGE      /dashboard/[eventId]/date-selection   (event: stg-bea-paolo)
BUTTON    "I have a date in mind" · "Help me pick a meaningful one" · "I'm not ready yet"
STEPS     1. Open date selection for an event whose date is set and locked (Event settings: "Your wedding date is set,
          because a supplier is booked on it").
EXPECTED  The page shows the locked date and why, with no path to pick a new one.
ACTUAL    "Congratulations. Let's start with your date." and the three start paths, as for a new event.
SHOTS     date_selection-375-light, details_field_area-375-light (the lock line)
RULE      Kit § 5 item 3 (two pages disagree about one fact) · see A2-H12
SEVERITY  wrong
SOURCE    SEEN
```

#### A2-P10 · Event home disagrees with itself between loads
```
PAGE      /dashboard/[eventId]   (event: stg-bea-paolo)
BUTTON    —
STEPS     1. Load Home at 768 (light). 2. Load it again minutes later (dark).
EXPECTED  Same facts each load.
ACTUAL    Load A: "4 things need you", a "Needs you today" list of tasks, Event Hub "9 of 18". Load B: "1 thing needs you",
          "Nothing needs you", Event Hub "8 of 18". Load B was the two earliest loads (768 and 1280 dark, ~06:55 UTC); the
          four later loads (07:20 UTC on) all read "4 things" and "9 of 18". This checker changed nothing on the event
          in between (one chat message). Load B carried no "last copy" banner. A slow or failed task read seems to be
          drawn as "Nothing needs you". PLAUSIBLE until a builder checks the reader's failure path. (Good, seen once:
          when Home's refresh failed it said "Couldn't update — showing your last copy from Nov 25, 7:44 AM … Try again".)
SHOTS     Home-768-light vs Home-768-dark
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    SEEN
```

#### A2-P11 · Schedule throws a hydration error on load
```
PAGE      /dashboard/[eventId]/schedule (and /checklist, which forwards there)   (event: stg-bea-paolo)
BUTTON    —
STEPS     1. Open Schedule at 375 light.
EXPECTED  No console error.
ACTUAL    "Minified React error #418" (server and browser HTML differ). /checklist at 375 stood on the full-screen
          "Syncing your day ···" splash after ~105 s.
SHOTS     checklist-375-light
RULE      Kit § 5 item 1
SEVERITY  broken
SOURCE    SEEN
```

#### A2-P12 · Home shows made-up people and places as "EXAMPLE"
```
PAGE      /dashboard/[eventId] (Schedule tile, Who's here)   (event: stg-bea-paolo)
BUTTON    —
STEPS     1. Open Home at 768 or 1280.
EXPECTED  The couple's own facts, or an empty state that says what to do.
ACTUAL    Rows tagged EXAMPLE: "Ceremony · 2:00 PM · Our Lady of Lourdes", "Reception · 6:00 PM · Casa Verde Gardens",
          "Miguel Santos · Host · Active now", "Tita Lu · Coordinator". A real couple sees strangers marked "Active now".
SHOTS     Home-768-dark, Home-1280-light
RULE      Add 3 (made-up people, demo data in place of the person's own)
SEVERITY  look (polish)
SOURCE    SEEN
```

#### A2-P13 · First-visit tours cover the page and its main button
```
PAGE      /dashboard/[eventId] · /budget · /vendors · /launch (find-date forward) · /schedule
BUTTON    "Skip" · "Next"
STEPS     1. Open each page for the first time on a phone.
EXPECTED  The page works without a tour (Add 5: a step that needs a tour is a finding).
ACTUAL    A coach mark ("STEP 1 OF 4 … Press Next") dims the page and sits over the bottom half, where the thumb and the
          main action are; Budget's tour also opens the Share menu behind it. Five pages, five tours.
SHOTS     -375-light of each
RULE      Add 5 (first-timer, one hand)
SEVERITY  look (polish)
SOURCE    SEEN
```

#### A2-P14 · ⓘ buttons are 16 px tap targets
```
PAGE      Home (About Guests · Budget · Schedule · Suppliers · Event Hub · Who's here), /budget (About Target, Agreed),
          /guests, /guests/quick, /guests/souvenirs, /manpower, /orders/new (What's in Event Plus/Pro/Ultra),
          /dashboard?seg=events ("What is this row?"), /disputes (13 px), Home's slide counter dots (18×6, 6×6)
BUTTON    the ⓘ beside each heading
STEPS     1. Measure the pressable box at 375.
EXPECTED  ≥ 44 px press area (40 px paint in a 44 px press).
ACTUAL    16 × 16 px (13 × 13 on Disputes).
SHOTS     —
RULE      CLAUDE.md §3 Button (44 px press) · Add 5 one hand
SEVERITY  look
SOURCE    SEEN
```

#### A2-P15 · Guest sub-pages: four kinds of Back, three kinds of title
```
PAGE      /guests/claims · /guests/import · /guests/checkin · /guests/new · /guests/quick · /guests/souvenirs ·
          /guests/[guestId] · /paperwork · /sponsors · /seating/chart
BUTTON    the Back control
STEPS     1. Open each from Guests.
EXPECTED  One Back look and one title look (Add 5 "same everywhere").
ACTUAL    "← Guest List" (text) · "‹ BACK TO GUEST LIST" (spaced caps) · "← Back to guest list" (grey chip) ·
          "← Back to guest list" (plain) · "← BACK TO EVENT HOME" · "← Back to Bea & Paolo" (accent) · "← Seats" (chip);
          titles at three sizes with and without an icon, under the "Guests ⌄" picker that already names the place.
SHOTS     guests_*-375-light
RULE      Add 5 · Add 2 CLEAN · A2-D8
SEVERITY  look (polish)
SOURCE    SEEN
```

#### A2-P16 · Linked events: the "Start a group" block has no side gutter
```
PAGE      /dashboard/clusters
BUTTON    "Create group"
STEPS     1. Open at 375.
EXPECTED  16 px gutters like the card above it.
ACTUAL    The "START A GROUP" label, the help line, the unframed name input and the button run edge to edge (0 px).
SHOTS     clusters-375-light
RULE      HOUSE_DESIGN_STANDARD spacing · Add 2 BALANCED
SEVERITY  look
SOURCE    SEEN
```

#### A2-P17 · People: two terracotta buttons on one screen
```
PAGE      /dashboard/people → /dashboard?seg=people
BUTTON    "Invite" (header) · "Add someone" (empty state)
STEPS     1. Open People with nobody yet.
EXPECTED  One main button (K1).
ACTUAL    Both are filled terracotta, 150 px apart.
SHOTS     people-375-light
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    SEEN
```

#### A2-P18 · Setnayan AI settings: "See pricing" with no price
```
PAGE      /dashboard/profile/concierge
BUTTON    "See pricing"
STEPS     1. Open the page.
EXPECTED  The ₱ price (read) before the button (Add 4 EVIDENT).
ACTUAL    "See pricing" and two "Back to profile" (A2-C11). The same product is priced on /pricing (wedding ₱2,790).
SHOTS     profile_concierge-375-light
RULE      Add 4 (price before pressing)
SEVERITY  look
SOURCE    SEEN
```

#### A2-P19 · "Joining soon" row can be pressed
```
PAGE      /dashboard/[eventId]/vendors/categories
BUTTON    "Hair & Make-up (HMUA) · Joining soon ›"
STEPS     1. Suppliers › Find › Popular for weddings.
EXPECTED  Nothing "soon" a person can press (Add 3).
ACTUAL    The row has a chevron and is a link, labelled "Joining soon" (no supplier in that category on the copy).
SHOTS     vendors_categories-375-light
RULE      Add 3 · brand.md claims 9
SEVERITY  look (polish)
SOURCE    SEEN
```

#### A2-P20 · Signed out mid-session once (not reproduced)
```
PAGE      /dashboard/[eventId]/messages
BUTTON    —
STEPS     1. Signed in (own session, one tab). 2. Open Messages; it took 87 s.
EXPECTED  Stay signed in.
ACTUAL    The page landed on the Sign in card (/login?next=…). A fresh sign-in worked. A two-session test (two browsers,
          same account, 70 s apart) kept both signed in, so this is not "one session per account". Earlier, six tabs
          sharing one saved session were all signed out at once (refresh-token reuse; a test artefact, not filed).
          PLAUSIBLE: a slow request crossing the token refresh.
SHOTS     messages-375-light
RULE      Kit § 6 money-signin (signing out)
SEVERITY  money-signin (PLAUSIBLE)
SOURCE    SEEN
```

#### A2-P21 · 1280: the event date is cut off in the left column
```
PAGE      /dashboard/[eventId] at 1280
BUTTON    —
STEPS     1. Open Home at 1280.
EXPECTED  "WEDDING · FEBRUARY 23, 2027" in full.
ACTUAL    "WEDDING · FEBRUARY 23, …" — the eyebrow is truncated in the 220 px left column while the right two
          columns have room.
SHOTS     Home-1280-light / dark
RULE      Add 7 (no cut-off text) · Add 2 BALANCED
SEVERITY  look
SOURCE    SEEN
```

#### A2-P22 · With no signal, a dashboard page cannot be reopened — not even the check-in desk
```
PAGE      /dashboard/[eventId]/guests/checkin (and Home, Schedule, Souvenirs, Budget, Suppliers)   (event: stg-bea-paolo)
BUTTON    — (reload / open the link)
STEPS     1. Signed in, open each page online (service worker registered: /sw.js active, caches filled). 2. Switch the
          browser offline (DevTools Network › Offline). 3. Reload, or open the same link again.
EXPECTED  Kit: check-in and Home have a saved copy (OFFLINE_COPY_SHAPES, DeskSavedMark). The desk phone that reloads,
          or a crew member who opens the desk link at the venue, gets the saved desk.
ACTUAL    Every dashboard page fails with the browser's own "no internet" error (ERR_INTERNET_DISCONNECTED); the
          `setnayan-offline-pages-v1` cache held 1 entry. The guest Event Hub (/stg-bea-paolo) does fall back to the
          service worker's "You're offline … pages you've already opened are still available" page.
          WHAT WORKS: a desk that is ALREADY OPEN keeps working when the signal drops — it shows "No signal · scans will
          be saved on this phone", and search still finds guests (typed "Josefa": 5 matches with tables). Back online it
          picks up without a reload. No guest was checked in (seeded data).
          PLAUSIBLE: Playwright's offline switch also governs the service worker; a phone test should confirm.
SHOTS     off-checkin-inpage (375), offline goto log
RULE      Owner 24 Nov: guests at the venue and the day-of desks are among the five FULL-offline places
SEVERITY  broken
SOURCE    SEEN
```

#### A2-P23 · Schedule on desktop: the run of show is crushed into a 300 px column
```
PAGE      /dashboard/[eventId]/schedule at 1280   (event: stg-bea-paolo)
BUTTON    —
STEPS     1. Open Schedule at 1280 (Event Day, 4 chapters).
EXPECTED  The timeline uses the page: times and moments on one line each, nothing cut.
ACTUAL    The chapters sit in a ~300 px left column; the Ceremony's moments are laid in two sub-columns inside it, so
          words stack one per line ("Liturgy / of / the / Word", "Vows / + / ring / exchange"), the 1:40 time overlaps
          "Procession", and the right sub-column is cut ("Ope…", "Hom…", "Veil cere…"). The middle third holds only
          "Open a chapter to see it here."
SHOTS     schedule-1280-light
RULE      Add 7 (desktop designed, no cut-off text) · Add 2 BALANCED
SEVERITY  look (major: it hides the couple's own run of show)
SOURCE    SEEN
```

#### A2-P24 · Suppliers: "Unlock" Setnayan AI with no price
```
PAGE      /dashboard/[eventId]/vendors (Find)   (event: stg-bea-paolo)
BUTTON    "Unlock"
STEPS     1. Open Suppliers.
EXPECTED  The ₱ price (read) and the plan name before the button (Add 4 EVIDENT).
ACTUAL    A tinted strip "See your ranked shortlist. Setnayan AI so[rts …]" with a filled "Unlock" button and no price.
          Not pressed (opens a purchase).
SHOTS     vendors-1280-light
RULE      Add 4 (price before pressing)
SEVERITY  look
SOURCE    SEEN
```

### Phase-A findings the browser confirmed (now `SEEN`)

- **A2-X2 / A2-X4** dark: only the account spokes, event Home, Budget, Guests and Schedule go dark; every other page
  stays light in dark mode; dark Home and Budget have no glowing top block (flat black).
- **A2-A1** onboarding is a bare page (no shell), steps on one address. **A2-A10** a bad host-invite token shows the
  generic "This page doesn't exist on Setnayan" 404.
- **A2-C3** API keys: "not open to any plan right now", Try-it curl names `setnayan-platform-web.vercel.app` and `sk_live_`.
- **A2-C11** Setnayan AI page: two "Back to profile".
- **A2-E1** souvenir desk "0 / 92" (every guest) while check-in reads "0 / 60 attending".
- **A2-F8** the receipt's Pay button is bronze, not the accent.
- **A2-G19** Close out the day: no confirm in the code, and (A2-P8) it is offered before the day.
- **A2-H11** /details/field/area opens Event settings at the top; the venue field is not opened.
- **A2-I7** Documents: two accent-outlined buttons in one empty card.
- **A2-I14** Sponsors: "0 of 16 slots filled" while the chat already has a "Principal Sponsors" group from the guest list.

## Findings

### Across the area (every page)

#### A2-X1 · Static cards still float on a shadow, light and dark
```
PAGE      every Area 2 page that draws a `.sn-frame` / `.sn-tile` / `.sn-row` card (Home, Budget, Guests, Suppliers, Schedule, Details, Profile …)   (event: Bea & Paolo)
BUTTON    —
STEPS     1. Open /dashboard/[eventId] in light, look at any card. 2. Settings › Appearance › Dark, open the same page.
EXPECTED  Light: a static card is a white surface with a 1 px hairline and NO shadow (Part I rule 4, 23 Nov). Dark: depth from a one-step-lighter card, NO shadow (K2, 24 Nov; DARK_MODE_STANDARD).
ACTUAL    The shared token still carries the 16 Nov "soft lift": light `--sn-frame-shadow: var(--m-shadow-md)` ("the soft lift — one value for tile, row and card"), and `.sn-tile` shares it via `--sn-frame-shadow-tile: var(--sn-frame-shadow)`. In `html.dark` the same token is a deep drop shadow (`0 14px 30px -14px rgb(0 0 0 / 0.85)`, "depth from light"). `.sn-frame` has no hairline border. One token fix in `apps/web/app/globals.css` (`--sn-frame-shadow`, `--sn-frame-shadow-tile`, the `.sn-frame` rule) changes every card at once; it also reaches other areas.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part I rule 4 (hairlines, not shadows) · Part K2 (no shadows in dark) · B6
SEVERITY  look
SOURCE    CODE
```

#### A2-X2 · Dark reaches 14 of 74 entries; the rest stay light
```
PAGE      every Area 2 page NOT listed here: /dashboard/[eventId] · /budget · /guests · /schedule (each exactly) · /dashboard/profile(+concierge) · /dashboard/people(+[dependentId]) · /dashboard/notifications · /dashboard/create-event · /dashboard/samahan(+children) · /signup/you
BUTTON    Settings › Appearance › "Dark"
STEPS     1. As couple_plan pick Dark. 2. Open /dashboard (the account home), then an event's Home, then Suppliers, then Budget, then /pay/[reference].
EXPECTED  Every signed-in screen follows the person's Dark choice with the flat page and the top-block glow (K2; kit § 5 item 7).
ACTUAL    Dark paints only on routes in `DARK_READY` (`apps/web/lib/appearance.ts`). Not on it, so they stay LIGHT for a person who chose Dark: the account home `/dashboard` itself, /onboarding/*, /dashboard/search, /billing, /api-keys, /clusters, and every event screen except Home, Budget, Guests and Schedule (Suppliers, Seating, Details, Messages, Orders, Documents, Paperwork, Check-in, every /guests/* sub-page …), plus /pay, /receipts, /proposals, /host/accept. Walking Home (dark) → Suppliers (light) → Budget (dark) flips the whole screen twice. This is the ruled roll-out ("area by area, only swept screens"), reported so the controller can decide how much dark must be done for launch. (Also stale: the `html.dark` comment in `globals.css` still says "Dark mode — INERT … LIGHT-LOCKED".)
SHOTS     none yet (phase B: 375 px dark on /dashboard and on an event's Suppliers)
RULE      HOUSE_DESIGN_STANDARD Part K2 · B4 ("dark is part of done") · kit § 5 item 7
SEVERITY  look
SOURCE    CODE
```

#### A2-X3 · Opening Create over the account home may darken the unswept home behind it
```
PAGE      /dashboard → /dashboard/create-event (the intercepted popup)   (signed in as couple_plan, Appearance = Dark)
BUTTON    "Create" / "New event" on the account home
STEPS     1. Pick Dark. 2. Open /dashboard (paints light: not on DARK_READY). 3. Press the create door: the create popup opens over the home and the address becomes /dashboard/create-event.
EXPECTED  Nobody meets a half-dark screen (appearance.ts call 3): either the home and the popup are both swept for dark, or neither paints dark.
ACTUAL    PLAUSIBLE. `/dashboard/create-event` is on `DARK_READY`; the intercepting route `app/(hub)/dashboard/@modal/(.)create-event/page.tsx` renders `CreateEventPanel` over the still-mounted /dashboard, and `app/_components/theme-provider.tsx` re-decides `.dark` on `usePathname()`. So the unswept home behind the panel should switch to dark tokens while the panel is up, and back to light when it closes. Phase B must look.
SHOTS     none yet (phase B: 375 px dark, before and after pressing create)
RULE      HOUSE_DESIGN_STANDARD Part K2 · lib/appearance.ts call 3 (no half-dark screen)
SEVERITY  look
SOURCE    CODE
```

#### A2-X4 · No glowing top block on the dark-ready event screens
```
PAGE      /dashboard/[eventId]/budget · /dashboard/[eventId]/guests · /dashboard/[eventId]/schedule (all on DARK_READY) · /dashboard/[eventId] on the event day and after · /dashboard · /dashboard/[eventId]/activity · every Area 2 page whose top is a bare `PageMasthead`   (event: Bea & Paolo, Appearance = Dark)
BUTTON    —
STEPS     1. Pick Dark. 2. Open Budget, Guests, Schedule. 3. Open the event Home inside the day-of window and after the day.
EXPECTED  Flat page; the screen's top block carries `--color-band-glow`, lit top-right (K2; DARK_MODE_STANDARD §3).
ACTUAL    In `apps/web/app/globals.css` the glow is read only by `.sn-band` (no component uses that class) and `.hc-ecard-plain` (the Home cover, `home-cover-band.tsx`); elsewhere only `papic-home-card.tsx` and the supplier/admin looks read it. `PageMasthead` renders its h1 `sr-only` and draws no band (`app/_components/page-masthead.tsx`), so Budget, Guests and Schedule — all three on `DARK_READY` — show a flat dark page with no lit top block. On the event Home the cover is drawn only by `HomeFirstScreen`; the `dayOfActive` and `afterActive` branches of `app/dashboard/[eventId]/page.tsx` draw no cover, so the day and after views are flat. The account home (`unihome.module.css`, `home-profile.module.css`) never reads the glow (it paints light today, A2-X2). The group readers each saw this on their own pages; it is written once here.
SHOTS     none yet (phase B: 390 px dark on Budget, Guests, Schedule)
RULE      HOUSE_DESIGN_STANDARD Part K2 · DARK_MODE_STANDARD §3
SEVERITY  look
SOURCE    CODE
```

### Money (group F)

Checked and fine (no finding): budget summary/list all come from `resolveEventMoneySettled` + `buildBudgetList`, a refused source draws "—" / a "+" floor (`ledgerRefused`, `owedFloor`); /pay amount comes from `orderGrossOwed` (voucher- and VAT-aware) and the receipt row is written by the same rule (`app/admin/payments/actions.ts` · `storedTotal` nets `voucher_discount_centavos`), so /pay and /receipts/[receiptId] agree; Maya approval re-asks Maya (`maya-return.ts` · `settleMaya`), the webhook is only a hint; ₱0 codes go to admin (`pay-code.ts` · `confirmFreeCode` → `notifyAdminsPaymentProofSubmitted`); the ordinary waiting state has its exit (`payable.back` main button). Only `/dashboard/*/budget$` of this group is on the dark ready-list (`lib/appearance.ts`), so no dark findings elsewhere.

#### A2-F1 · Second buttons not stepped down beside the main
```
PAGE      /dashboard/[eventId]/budget · /dashboard/[eventId]/orders/[orderId] · /proposals/[publicId]   (event: Bea & Paolo)
BUTTON    "Chat" (budget supplier sheet) · "Open receipt" + "Send your payment" (order) · "Accept quote" (quote)
STEPS     1. Budget → tap a booked supplier → the supplier sheet. 2. Open a paid order that still shows "still to send" (see A2-F2). 3. Open a sent quote as the host.
EXPECTED  One filled accent main per scope; every other button neutral (ink wash / hairline) or a text link.
ACTUAL    Budget supplier sheet: "Chat" is `tone="info"` (`actionButtonClass('info')` / `ActionButton tone="info"`), a blue outline on a blue wash, beside the main "Record a payment" — Code: `apps/web/app/dashboard/[eventId]/budget/_components/budget-sheets.tsx` · `SupplierSheet`. Order page: "Open receipt" is a hand-made filled green link (`bg-success-700 px-4 py-2 … text-cream`) and "Send your payment" is `button-primary`; both render together whenever a receipt exists and `totals.remaining > 0` — Code: `apps/web/app/dashboard/[eventId]/orders/[orderId]/page.tsx` · `Open receipt` / `Send your payment`. Quote page: the main "Accept quote" is a hand-made `bg-success-700 … text-white` button (green, not the accent, not `ActionButton`); "Send to couple" is hand-made `bg-ink` — Code: `apps/web/app/proposals/[publicId]/page.tsx` · `Accept quote`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part K1 (2, 3) · design-and-wiring D12 (one button primitive)
SEVERITY  look
SOURCE    CODE
```

#### A2-F2 · Order pages compute their own owed figure, disagree with /pay
```
PAGE      /dashboard/[eventId]/orders · /dashboard/[eventId]/orders/[orderId] · /receipts/order/[orderId]   (event: Bea & Paolo)
BUTTON    "Send your payment" · "Pay ₱X" (order slip) · — (list total)
STEPS     1. Buy an event service; on /pay apply a code (e.g. ₱500 off a ₱2,500 item) and pay the ₱2,000 the QR asks. 2. Open Orders, the order, and /receipts/order/<id> before and after HQ confirms.
EXPECTED  Every page names the same owed figure as the QR and the receipt: the ONE rule `orderGrossOwed` (nets the code off an unquoted order, honours VAT-inclusive keys, reads the effective VAT rate).
ACTUAL    Three private sums of `confirmed_total_php ?? requested_total_php`, none netting `voucher_discount_centavos` (`ORDER_SELECT` does not even read it): Orders list = `computeVatFromBase(Number(o.confirmed_total_php ?? o.requested_total_php), vatRatePct).gross`; order page = `computeOrderTotals(order, payments)` called WITHOUT a rate (defaults `vatRatePct = 0`, so it ignores `platform_settings` while the list and /pay read it, and today prints a "+ VAT (0%)" tile and "PH VAT (0%) is added on top" — the receipt rule says a non-VAT seller prints no VAT line); order slip = `stored = Number(order.confirmed_total_php ?? order.requested_total_php)` → "Pay {formatPhp(v.gross)}". So with a code applied the list, order page ("Total to pay", "Remaining", "₱2,500 still to send") and slip ask ₱2,500 while /pay asks ₱2,000; after HQ marks it paid the order page still shows "₱500 still to send" + "Send your payment" (`totals.remaining > 0 && order.status !== 'cancelled'` has no paid check) and /pay says settled. Code: `apps/web/app/dashboard/[eventId]/orders/page.tsx` · `computeVatFromBase(`; `apps/web/app/dashboard/[eventId]/orders/[orderId]/page.tsx` · `computeOrderTotals(order, payments)`; `apps/web/lib/orders.ts` · `vatRatePct = 0`; `apps/web/app/receipts/order/[orderId]/page.tsx` · `const stored =`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §4 (one reader; second copy is a defect) · design-and-wiring C8
SEVERITY  money-signin
SOURCE    CODE
```

#### A2-F3 · Orders empty state offers a retired "custom quote"
```
PAGE      /dashboard/[eventId]/orders   (event: Lolo Ben at 80)
BUTTON    "New order"
STEPS     1. Open Orders on an event with no orders. 2. Read the empty line. 3. Tap New order.
EXPECTED  The words say what New order does now: opens Event services to buy a service.
ACTUAL    "No orders yet. Use New order above to request a custom quote." — but `/orders/new` is retired and forwards to Event services (`RetiredNewOrderPage` → `routes.dashboard.eventServices`); custom requests no longer exist. The flash texts for `self_comp=1` ("Self-comp order created…", the self-comp path was deleted) and `created=1` ("…log the payment so the Setnayan team can match it", logging moved to /pay) are also stale. Code: `apps/web/app/dashboard/[eventId]/orders/page.tsx` · `to request a custom quote`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring B5/B6 (words match the real destination)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-F4 · A refused "Cancel order" says nothing
```
PAGE      /dashboard/[eventId]/orders/[orderId]   (event: Bea & Paolo)
BUTTON    "Cancel order"
STEPS     1. As a co-host who did not place the order (or on an order that just became paid), press Cancel order.
EXPECTED  The page says the order could not be cancelled and why.
ACTUAL    `cancelOrder` filters `.eq('user_id', user.id)`; zero rows → `redirect(…?cancel=refused)`. The page's `searchParams` only reads `created`, `paid_logged`, `error` — nothing reads `cancel`, so the page reloads unchanged with no message. Code: `apps/web/app/dashboard/[eventId]/orders/actions.ts` · `?cancel=refused`; `apps/web/app/dashboard/[eventId]/orders/[orderId]/page.tsx` · `searchParams: Promise<{`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring B6 (a failure must render as a failure)
SEVERITY  broken
SOURCE    CODE
```

#### A2-F5 · Maya "Checking your payment" is a dead end
```
PAGE      /pay/[reference]   (event: Bea & Paolo)
BUTTON    —
STEPS     1. Pay with Maya and come back while Maya has not settled (`?maya=success`, result `pending`). 2. Wait past 20 re-asks (~60 s).
EXPECTED  A way back to the event and a press to try again, as the ordinary waiting state has ("THE WAITING PAGE MUST NOT BE A DEAD END").
ACTUAL    The `maya.phase === 'checking'` early return renders only `summaryFor(true)` + `<MayaChecking />` — no `payable.back` link (that is drawn only in the main render) and no button. After `TRIES` it says "Maya is still confirming your payment. Refresh in a minute." with nothing to press; /pay carries no site chrome, so in the installed app there is no way out but closing it. Code: `apps/web/app/pay/[reference]/page.tsx` · `data-pay-maya-checking-page`; `apps/web/app/pay/[reference]/_components/maya-checking.tsx` · `Refresh in a minute`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring B5 (no dead end) · brief: waiting state is not a dead end
SEVERITY  broken
SOURCE    CODE
```

#### A2-F6 · Pesos formatted outside lib/php.ts on pay and receipts
```
PAGE      /pay/[reference] · /receipts/[receiptId] · /receipts/order/[orderId] · /receipts/payment/[paymentId]   (event: Bea & Paolo)
BUTTON    —
STEPS     1. Pay a whole-peso order. 2. Compare /pay, the order page and the receipt slip.
EXPECTED  Every peso through `formatPhp` / `formatPhpRounded`: one spelling per figure.
ACTUAL    Private formatters: `payAmount` (`apps/web/lib/pay-amount.ts`, always ".00": /pay's headline, Maya receipt "Amount"); `formatPhpFromString` (`apps/web/lib/receipts.ts`, always ".00"); `slipFigure` (`apps/web/app/receipts/_components/receipt-slip.tsx`); `figure` (`apps/web/lib/payment-receipt-slip.ts`); `peso` (`apps/web/lib/payable-by-reference.ts`, /pay's line rows). One slip shows both spellings: /receipts/[receiptId] passes `amount={formatPhp(Number(receipt.gross_total_php))}` ("₱12,500") and `total={formatPhpFromString(receipt.gross_total_php)}` ("₱12,500.00"); /pay says "₱12,500.00" while the order page says "₱12,500".
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §1 (format money only through lib/php.ts) · design-and-wiring C8
SEVERITY  money-signin
SOURCE    CODE
```

#### A2-F7 · Order slip names the wrong account and a gone step
```
PAGE      /receipts/order/[orderId]   (event: Sofia's 18th)
BUTTON    "Pay ₱X"
STEPS     1. Open an awaiting-payment order's slip from the account menu. 2. Read "Pay to" and "Then". 3. Open /pay for the same order.
EXPECTED  The slip names where /pay will actually take the money, and the next step that exists.
ACTUAL    "Pay to" = GCash whenever `settings.gcash_enabled && settings.gcash_number`, else BDO; /pay picks ONE rail by `pickPayerRail` (GCash only under this month's allowance, else BDO) and offers Maya first when open — so the slip can name GCash while /pay shows BDO or Maya. "Then: log the payment below" — there is nothing below on the slip, and the order page it links to no longer logs payments (it sends to /pay). Code: `apps/web/app/receipts/order/[orderId]/page.tsx` · `const payTo =` · `'log the payment below'`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §4 Payment (one reader for the pay route) · honest words
SEVERITY  wrong
SOURCE    CODE
```

#### A2-F8 · Receipt Pay button carries a raw hex colour
```
PAGE      /receipts/order/[orderId]   (event: Bea & Paolo)
BUTTON    "Pay ₱X"
STEPS     1. Open an awaiting-payment order slip.
EXPECTED  Token colours only; the button is the shared `ActionButton` / `actionButtonClass`.
ACTUAL    `RECEIPT_CTA = '… bg-terracotta-700 … text-[#FFFDF8] dark:text-cream'` — a hand-made filled button with a raw hex and a numbered palette class. Code: `apps/web/app/receipts/_components/receipt-slip.tsx` · `RECEIPT_CTA`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring D12/D13 · CLAUDE.md §3 Colour
SEVERITY  look
SOURCE    CODE
```

#### A2-F9 · Supplier receipt's "What is left" is a second money reader
```
PAGE      /receipts/payment/[paymentId]   (event: Bea & Paolo)
BUTTON    "PDF" (hosts' Receipt card) → —
STEPS     1. Book a supplier at a quote, accept a change order that adds to the price. 2. Pay the original total; supplier confirms. 3. Open the payment receipt, then the Budget page.
EXPECTED  "What is left" agrees with the budget's owed for that supplier (`resolveEventMoney` / `event_vendor_money_read`, which carries change-order deltas on top of the agreed price).
ACTUAL    The receipt reads `vendor_proposals.total_centavos` of the latest accepted quote directly and subtracts confirmed payments (`receiptOfPayment` → `leftCentavos: Math.max(0, agreed - paid)`); change orders are not in it, so it can print "Nothing · paid in full" while Budget still shows money owed. (The point-in-time rule — "as it stood when confirmed" — is intended; the agreed figure is the second copy.) PLAUSIBLE until walked with a change order. Code: `apps/web/app/receipts/payment/[paymentId]/page.tsx` · `.select('total_centavos')`; `apps/web/lib/deal-end.ts` · `receiptOfRow`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §4 Budget (amounts only via `event_vendor_money_read`) · design-and-wiring C8
SEVERITY  money-signin
SOURCE    CODE
```

#### A2-F10 · Failed referral read shows "No referrals yet"
```
PAGE      /dashboard/[eventId]/refer   (event: Bea & Paolo)
BUTTON    —
STEPS     1. Open Refer a couple while the `referral_redemptions` read is refused.
EXPECTED  "Couldn't load the couples you referred" (ReadFailed), never the empty state.
ACTUAL    `const { data: rows } = await supabase.from('referral_redemptions')…` — `error` is never read; `(rows ?? []).map(…)` makes a failed read draw "No referrals yet. Share your link above…" and hides earned perks. Code: `apps/web/lib/referral-actions.ts` · `getMyReferral`; `apps/web/app/dashboard/[eventId]/refer/page.tsx` · `No referrals yet`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

### Home and the event (group B)

#### A2-B2 · Home's Shop part says "none" when the shop read failed
```
PAGE      /dashboard   (a shop owner's account)
BUTTON    —
STEPS     1. Sign in as an account that owns a shop. 2. The switcher read throws (or `fetchUserRoleSummary` degrades). 3. Look at the Shop part on Home.
EXPECTED  "Couldn't read your shop" (or the part withheld), never a claim that you have no shop.
ACTUAL    `loadSwitcherData` catches any throw and returns `context: { …, canOpenShop: false, shops: [] }`; `readUnihomeShop` then returns `{ kind: 'none' }` (also when `switcher` is null), and `ShopPart` prints "Shops on Setnayan are run by suppliers. Yours shows here once you have one." — i.e. a failed read told to an owner as "you have none". The component's own comment admits the case ("or the shops read was refused"). The guard `unihome-is-the-drawing.test.ts` test 7 holds the owner-path figures, not this branch. Code: `apps/web/lib/unihome.server.ts` · `if (!switcher) return { kind: 'none' }`; `apps/web/app/dashboard/(launcher)/_components/unihome.tsx` · `Yours shows here once you have one.`; `apps/web/app/_components/account-switcher/get-switcher-data.ts` · `getSwitcherData threw unexpectedly`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-B3 · Board shows two main "Create" buttons when Planning is empty
```
PAGE      /dashboard?seg=events   (an account whose Planning shelf is empty, e.g. only finished events)
BUTTON    "＋ Event" (pinned row) and "Create an event" (empty Planning shelf)
STEPS     1. Open /dashboard?seg=events with nothing upcoming. 2. Look at the pinned row and the Planning shelf.
EXPECTED  One main (filled accent) per screen; the second door to the same verb is neutral or a link.
ACTUAL    The pinned row's action is `ActionButton tone="brand" main={!tight}` (`pinned-row.tsx`, fed `action={{ label: 'Event', … href: '/dashboard/create-event' }}` by `HomePinnedRow`), and the empty shelf's `CollectionEmptyState` action is another `ActionButton … tone="brand" main … label="Create an event"`. Two filled terracotta buttons for the same verb on one screen. Code: `apps/web/app/(hub)/dashboard/page.tsx` · `title="Start an event"`; `apps/web/app/_components/pinned-row/pinned-row.tsx` · `main={!tight}`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE
```

#### A2-B4 · Event card "⋯" menu has no dim, blur or lock
```
PAGE      /dashboard?seg=events   (event: Bea & Paolo)
BUTTON    "Options for Bea & Paolo" (⋯ on the card)
STEPS     1. Open /dashboard?seg=events. 2. Press ⋯ on an event card. 3. Try scrolling / reading the page behind.
EXPECTED  The menu draws the ONE shared backdrop (dim + blur), the page behind is inert and does not scroll, backdrop tap closes it.
ACTUAL    The menu draws its own transparent `<button … className="fixed inset-0 z-40 cursor-default" />` as a click-catcher and a `role="menu"` panel; it does not use `OverlayBackdrop` or `useModalA11y` (no dim, no blur, no scroll lock, page not inert). Code: `apps/web/app/dashboard/(launcher)/_components/event-card-menu.tsx` · `Backdrop — closes on any outside press`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part K3
SEVERITY  look
SOURCE    CODE
```

#### A2-B5 · Home recomputes "agreed" as paid + owing
```
PAGE      /dashboard/[eventId]   (event: Bea & Paolo)
BUTTON    —  (Budget card line "N% paid of ₱X agreed" and the phone tile "N% paid · ₱P of ₱X")
STEPS     1. Record a payment to a supplier that is larger than that supplier's agreed total (overpaid). 2. Open the event home. 3. Compare "agreed" with the Budget page.
EXPECTED  "Agreed" comes from the one reader (`resolveEventMoney` → `committed`, already fetched as `guard: read.money`, or `BudgetLiveSummary.budget`).
ACTUAL    Home builds its own: `const agreed = b.paidPhp + b.owingPhp; const pct = … b.paidPhp / agreed`, in both the card and the tile. `owingPhp` is `BudgetLiveSummary.remaining` = "budget − paid floored at 0", so with any overpayment `agreed` becomes the PAID figure, not the agreed total, and the share reads 100 %. The page only passes `{ paid, owing }` into `HomeMoneyRead` and drops `summary.budget`. A second copy of a money fact (agrees today only while nothing is overpaid). Code: `apps/web/app/dashboard/[eventId]/_components/home-control-row.tsx` · `const agreed = b.paidPhp + b.owingPhp`; `apps/web/app/dashboard/[eventId]/_components/home-control-faces.ts` · `const agreed = b.paidPhp + b.owingPhp`; `apps/web/app/dashboard/[eventId]/page.tsx` · `now: read.summary ? { paid: read.summary.paid, owing: read.summary.remaining }`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §4 (Budget: one reader) · design-and-wiring rule 8
SEVERITY  money-signin
SOURCE    CODE
```

#### A2-B6 · Budget card stacks several main and green Pay buttons
```
PAGE      /dashboard/[eventId]   (event: Bea & Paolo, with 2+ payments due, one overdue)
BUTTON    "Pay" (each payment row in the Budget card / phone tile)
STEPS     1. Have two overdue payments and one not yet due. 2. Open the event home. 3. Look at the Budget card.
EXPECTED  At most one main button in the card; every other Pay steps down to neutral.
ACTUAL    Each row renders `ActionButton tone={late ? 'brand' : 'ok'} main={late}`: every overdue row is a filled terracotta main (two overdue = two mains in one card) and every other row is a green-washed `ok` button (another bright colour). The phone tile does the same per face: `action: { … label: 'Pay', … main: late || (isToday && i === 0) }`. Code: `apps/web/app/dashboard/[eventId]/_components/home-control-row.tsx` · `tone={late ? 'brand' : 'ok'} main={late}`; `apps/web/app/dashboard/[eventId]/_components/home-control-faces.ts` · `main: late || (isToday && i === 0)`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part K1 (2, 3, 4: "Inside one card, the rule above holds")
SEVERITY  look
SOURCE    CODE
```

#### A2-B7 · Guests card's main button is blue, not the accent
```
PAGE      /dashboard/[eventId]   (event: Bea & Paolo, guests added, invitations not sent)
BUTTON    "Send the invitations"
STEPS     1. Add guests, send none. 2. Open the event home. 3. Look at the Guests card.
EXPECTED  The card's one main is the filled accent (terracotta); "Later" neutral.
ACTUAL    `ActionButton tone="info" main … label="Send the invitations"` — a filled main in the info (blue) tone beside terracotta mains on the other cards of the same screen. Code: `apps/web/app/dashboard/[eventId]/_components/home-control-row.tsx` · `tone="info" main`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part K1 (1: main = the filled accent; 2: never another bright colour)
SEVERITY  look
SOURCE    CODE
```

#### A2-B8 · Event-day and after Home use typed half-pixel sizes
```
PAGE      /dashboard/[eventId]   (event day / after the day)
BUTTON    "Open the live desk" · "Planning tools — still here if you need them"
STEPS     1. Open the event home inside the day-of window (or after the day). 2. Look at the live-desk tile and the Planning tools fold.
EXPECTED  Type from the `text-sn-*` scale only; never `text-[Npx]`, never half pixels.
ACTUAL    In `page.tsx` itself: `text-[15px]` and `text-[12.5px]` on the live-desk tile, `text-[13.5px]` on both `<summary>` lines (day-of and after). Code: `apps/web/app/dashboard/[eventId]/page.tsx` · `text-[12.5px] text-ink/55` · `text-[13.5px] font-semibold text-ink/70`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §3 Type · design-and-wiring rule 13
SEVERITY  look
SOURCE    CODE
```

#### A2-B9 · Activity shows "Nothing has happened yet" on a failed read
```
PAGE      /dashboard/[eventId]/activity   (event: Bea & Paolo)
BUTTON    —  (and "Add your first guest" in the empty state)
STEPS     1. Open Bea & Paolo › See all recent activity. 2. Let the guests / event_vendors / orders / event_schedule_blocks reads fail (RLS refusal or blip).
EXPECTED  A failed read says so (ReadFailed / "Couldn't read"), never the empty state; a partly failed read says which part is missing.
ACTUAL    `fetchEventActivity` never looks at `error`: it loops `guestsRes.data ?? []`, `vendorsRes.data ?? []`, `ordersRes.data ?? []`, `blocksRes.data ?? []`. All four failing → `activity.length === 0` → `QuietStart title="Nothing has happened yet."` plus "Add your first guest" to a couple with 180 guests; one failing silently drops that source from the feed. No honest-read guard covers `lib/activity.ts`. Code: `apps/web/lib/activity.ts` · `for (const g of guestsRes.data ?? [])`; `apps/web/app/dashboard/[eventId]/activity/page.tsx` · `Nothing has happened yet.`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-B10 · Activity formats pesos with its own toLocaleString
```
PAGE      /dashboard/[eventId]/activity   (event: Bea & Paolo, with an order)
BUTTON    —  (row "Order placed · … · ₱…")
STEPS     1. Place an order. 2. Open the activity feed.
EXPECTED  Peso amounts go through `lib/php.ts` (`formatPhp` / `formatPhpRounded`).
ACTUAL    `formatPeso` in `lib/activity.ts` builds `` `₱${n.toLocaleString('en-PH', { maximumFractionDigits: 0 })}` `` itself, and hides a 0 or missing total (`n <= 0` → no figure). (Lead: `wrong`, not money — the figure itself is right today.) Code: `apps/web/lib/activity.ts` · `function formatPeso`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §1 Money (format only through lib/php.ts) · design-and-wiring rule 8
SEVERITY  wrong
SOURCE    CODE
```

Notes (not findings): the forwards (/dashboard/year, /more, /progress) all land on targets that exist. Event home reads were spot-checked against its ~45 guard tests (honest money / guests / orders / Today / deep links). No banned words found in what a person reads on these pages. "Your photos are safe" (Memories read failure) is an allowed status line. Home's "Open shop dashboard" (supplier navy, filled) is drawn as in the approved Unihome v5 drawing, so it is not reported under K1. I did not report the rest of the typed-px and legacy-class debt on these pages (repo-wide counts are excluded).

### Seats, souvenirs and people (group E)

Notes on the lab (page 5), as asked:
- **What it is.** The 3D seat-plan room ("Sims build" plus walk-to-seat). The same component is streamed inside Guests › Seats as the 3D view: `seating/page.tsx` renders `<SeatingLabPage … searchParams={{ maker: '1' }}>`.
- **Can a couple reach the bare address?** Yes. The mood board's "Edit in Seat Plan →" link points there (`studio/mood-board/_components/mood-board-editor.tsx`, `href={`/dashboard/${eventId}/seating/lab`}`).
- **Who else links to it?** The seat editor's own `router.push(labUrl)` branches run only when `details` is not set. `seating/page.tsx` always passes `details`, so those pushes are never reached.
- **Should it exist as a person's page?** No. It should forward to Guests › Seats with the 3D view open (see A2-E6).
Connections, as asked:
- **Guests › Seats against the seating pages.** `?gview=seats` and `/seating` cannot disagree: they are the same `SeatingPage` file. The disagreement is inside the seat plan itself, and between it and the entrance chart (A2-E4).
- **A decline frees the seat.** This exists (`free_seat_on_decline`, migration `decline_frees_seat_assignment`).
- **Pending guests hold seats.** The capacity check counts every non-declined guest (`nonDeclinedCount`).
- **Hosts and helpers.** Invite and remove reach real couple-only actions:
  - `inviteHost` uses `requireCoupleMembership` and accepts the hired planner only.
  - `removeHost` and `setDelegateArea` are host-only.
  - The consent scopes are recorded as `vendor_lock: false, checkout: false`.
- **"Only a host books or pays."** I found no helper-facing control on these pages that books or pays:
  - The claim **Approve** (which can book) goes through `answer_claim_access_request`, which checks for the couple. A limited helper is refused by `limitedHelperRefusal`.
  - The `/hosts` helper view is read-only (`CoordinatorGrantChips`).

#### A2-E1 · Souvenir count counts declined and undecided guests as expected
```
PAGE      /dashboard/[eventId]/guests/souvenirs   (event: Bea & Paolo)
BUTTON    —  ("Souvenirs given  N / total")
STEPS     1. Open the Guests page, then Souvenir table. 2. Have some guests declined or pending. 3. Read the "Souvenirs given" count.
EXPECTED  The total counts the guests expected at the door, read through the one headcount reader (attending only, as the check-in desk's "expected" is).
ACTUAL    The total is every row on the list: declined, pending, maybe and every companion seat row. The page reads its own `guests` query and passes the whole roster. The desk then shows `received / formatCount(total)` with `const total = guests.length;`, so the bar can never reach "everyone" on a real event. The check-in desk on the same event uses `guests.filter((g) => g.rsvpStatus === 'attending')`. `countsTowardEvent` / `computeGuestStats` are not used. Code: `apps/web/app/dashboard/[eventId]/guests/souvenirs/_components/souvenir-desk.tsx` · `const total = guests.length;`; `.../souvenirs/page.tsx` · `const roster = (guestsRaw ?? []) as GuestRow[];`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §4 (Guest: check-in "expected" = attending only; one reader) · design-and-wiring C8
SEVERITY  wrong
SOURCE    CODE
```

#### A2-E2 · Souvenir desk opens normally when the guest list fails to load
```
PAGE      /dashboard/[eventId]/guests/souvenirs   (event: Bea & Paolo)
BUTTON    "Scan a guest QR"
STEPS     1. The `guests` read is refused or errors. 2. Open Souvenir table. 3. Scan any guest's QR.
EXPECTED  A refused guest read stops the desk and says it could not read the list. It never offers a scanner that turns every real guest away.
ACTUAL    The page shows only the partial `ReadRefusedNotice` ("a guest, their table, or who has already collected") and still renders `SouvenirDesk` with `guests = []`. The counter reads "0 / 0". Every scan then answers "That QR isn't a guest on this event's list.", which blames the guest at the table. The page's own comment warns about this exact effect for a delegate, but the read-failure path falls into it anyway. Code: `apps/web/app/dashboard/[eventId]/guests/souvenirs/page.tsx` · `somethingRefused` / `(guestsRaw ?? [])`; `souvenir-desk.tsx` · `That QR isn’t a guest on this event’s list.`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-E3 · Tea serving order lists declined guests and calls everyone an elder
```
PAGE      /dashboard/[eventId]/guests/tea-ceremony   (event: a Chinese wedding; not one of the seeded three)
BUTTON    —  ("N elders" per side)
STEPS     1. On a Chinese wedding, have guests on the groom's side who declined, plus friends and colleagues. 2. Open Paperwork › Tea ceremony.
EXPECTED  The serving order is the elders who are coming. The count beside each side counts those people.
ACTUAL    `served` drops only the bride, the groom and companion rows (`g.role !== 'bride' && g.role !== 'groom' && !g.plus_one_of_guest_id`). Every other accepted guest on a side is numbered into the printed order, including declined guests, friends and colleagues. Each side is labelled `${formatCount(guests.length)} elders`. Separately, a failed `events` read goes to `notFound()`, so a read error shows a 404 rather than "couldn't read". Code: `apps/web/app/dashboard/[eventId]/guests/tea-ceremony/page.tsx` · `const served = guests.filter(` · `elders` · `if (!eventRow || !isChineseWedding(eventRow))`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §4 (headcount via countsTowardEvent / attending) · CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-E4 · Seat plan and entrance chart give different unseated counts
```
PAGE      /dashboard/[eventId]/guests?gview=seats (= /seating) · /dashboard/[eventId]/seating/chart   (event: Bea & Paolo)
BUTTON    "N to seat" chip (desktop) · "Unseated: N" (phone) · chart notice "N guests have no seat yet"
STEPS     1. Have attending, pending and declined guests, some unseated, plus one "after party only" guest. 2. Open Guests › Seats on desktop and hover the "to seat" chip. 3. Open it on a phone. 4. Open Entrance seating chart.
EXPECTED  One unseated count, from one reader in `lib/seating.ts` (pending guests hold seats; declined guests do not), shown the same way everywhere.
ACTUAL    The same event shows four different "unseated" numbers:
          • Desktop chip "{toSeatReserved} to seat" counts attending guests only (`page.tsx` · `reservedGuests = seatingGuests.filter((g) => g.rsvp_status === 'attending')`).
          • That chip's own tooltip says "{unseatedCount} unseated" and counts every guest, declined included (`seating-editor.tsx` · `const unseatedCount = guests.length - seatedCount;`). The same tooltip's `totalCapacity` adds raw `t.capacity`, while the page's `totalSeats` uses `effectiveCapacity` (removed chairs).
          • The phone shows "Unseated: N" from `unseatedComing` (non-declined).
          • The entrance chart uses `unseatedCount()` in `lib/print-entrance-chart.ts` (non-declined). It also does not drop the guests `readNoSeatGuestIds` takes off the seat plan, so after-party-only guests are reported as "no seat yet".
          `computeSeatingStats` in `lib/seating.ts` exists and nothing uses it.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §4 (Seat: one reader, lib/seating.ts) · design-and-wiring C8/C9
SEVERITY  wrong
SOURCE    CODE
```

#### A2-E5 · Booked suppliers read from a second status list
```
PAGE      /dashboard/[eventId]/people · /dashboard/[eventId]/seating/lab   (event: Bea & Paolo)
BUTTON    —  ("Booked to be there · N suppliers"; the 3D room's booked-supplier zone suggestions)
STEPS     1. Open Who is here. 2. Read the suppliers count.
EXPECTED  "Booked" is read from `BOOKED_EVENT_VENDOR_STATUSES` (`lib/vendor-funnel.ts`), the one reader.
ACTUAL    Both pages filter on `CONFIRMED_VENDOR_STATUSES`, a separate literal list in `lib/events.ts`. It holds the same four values today, but it is a second copy that will drift the first time a booked status is added. Code: `apps/web/app/dashboard/[eventId]/people/page.tsx` · `.in('status', CONFIRMED_VENDOR_STATUSES as unknown as string[])`; `apps/web/app/dashboard/[eventId]/seating/lab/page.tsx` · same string; `apps/web/lib/events.ts` · `export const CONFIRMED_VENDOR_STATUSES = [`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §4 (booked = BOOKED_EVENT_VENDOR_STATUSES) · design-and-wiring C8
SEVERITY  wrong
SOURCE    CODE
```

#### A2-E6 · Mood board opens a standalone 3D room titled "prototype"
```
PAGE      /dashboard/[eventId]/seating/lab   (event: Bea & Paolo; also a helper on Lolo Ben at 80)
BUTTON    "Edit in Seat Plan →" (Mood Board)
STEPS     1. Open Studio › Mood Board (outside the Maker). 2. Press "Edit in Seat Plan →". 3. Read the browser tab title. Also: as a helper the couple did not share the seat plan with, open /seating/lab by address.
EXPECTED  The link opens Guests › Seats with the 3D view (where the 3D room lives since R4), behind the same gates as the seat plan.
ACTUAL    The link goes to the bare `/seating/lab` page, outside the Guests shell. Its tab title reads "Seating · 3D lab (prototype)".
          The bare route does not check `surfaceEnabled(…, 'seating')` or `isDelegateWithoutArea(viewer, 'guest_list' | 'seat_plan')`. `seating/page.tsx` and `seating/chart/page.tsx` both do.
          PLAUSIBLE: for a helper without the seat plan, the reads return zero rows, so the page would draw an empty room instead of "not shared with you". A browser walk must confirm.
          The editor's own `router.push(labUrl)` is unreachable (`details` is always passed), so the mood-board link is the only live door to this route.
          Code: `apps/web/app/dashboard/[eventId]/studio/mood-board/_components/mood-board-editor.tsx` · `Edit in Seat Plan →`; `apps/web/app/dashboard/[eventId]/seating/lab/page.tsx` · `title: 'Seating · 3D lab (prototype)'`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring A2/A4 (one shell; every way in moves with it) · SHAPE (3D room = FULL-SCREEN POPUP over Guests › Seats)
SEVERITY  broken
SOURCE    CODE
```

#### A2-E7 · Access requests says "Nothing waiting" when the check failed
```
PAGE      /dashboard/[eventId]/access-requests   (event: Bea & Paolo)
BUTTON    —
STEPS     1. `readClaimAccessAsks` fails (claimsRead.measured = false) while the areas read succeeds with no pending rows. 2. Open Access requests.
EXPECTED  Only the "could not check" line, never a claim that nothing is waiting.
ACTUAL    The page draws "We could not check for suppliers who joined from your link. Reload to try again." Below it, the empty branch (`pending.length === 0 && !(claimsRead.measured && claimsRead.asks.length > 0)`) still draws "Nothing waiting on you.", which contradicts it. A supplier waiting to be let in reads as no one waiting. Code: `apps/web/app/dashboard/[eventId]/access-requests/page.tsx` · `Nothing waiting on you.`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-E8 · Who is here: a failed read says "not shared with you"
```
PAGE      /dashboard/[eventId]/people   (event: Bea & Paolo)
BUTTON    —
STEPS     1. The viewer's own `event_members` read errors (memberRes.error). 2. Open Who is here as the couple.
EXPECTED  "Couldn't read", with a retry.
ACTUAL    The error is logged, then `isCouple` becomes false and `delegatePermissions` null. `buildPeopleGroups` returns nothing, and the page tells the couple "None of this event's lists are shared with you. Ask the couple if you need to see who is coming." A refused read is stated as a fact about their access. Code: `apps/web/app/dashboard/[eventId]/people/page.tsx` · `if (memberRes.error)` · `None of this event&rsquo;s lists are shared with you`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-E9 · Two filled main buttons on the souvenir desk
```
PAGE      /dashboard/[eventId]/guests/souvenirs   (event: Bea & Paolo)
BUTTON    "Scan a guest QR" · "Confirm souvenir given"
STEPS     1. Open Souvenir table. 2. Search a name and pick a guest (the scanner is off).
EXPECTED  One main button per screen (K1). Once a guest is picked, "Confirm souvenir given" is the main button and the scanner button steps down to neutral.
ACTUAL    Both are `ActionButton tone="brand" main`, and both show at once. Code: `apps/web/app/dashboard/[eventId]/guests/souvenirs/_components/souvenir-desk.tsx` · `label="Scan a guest QR"` · `label="Confirm souvenir given"`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE
```

#### A2-E10 · Bright filled answer buttons and spinners on access cards
```
PAGE      /dashboard/[eventId]/access-requests   (event: Bea & Paolo)
BUTTON    "Share" / "Decline" (per line) · "Send my answer" · "Approve" / "Decline" (joined-from-link card)
STEPS     1. Have a pending area request. 2. Press Share on one line and Decline on another.
EXPECTED  One main button per card (K1). The other choices are neutral, made with ActionButton / PillSelector. No spinners.
ACTUAL    • RequestCard: a chosen line turns hand-made `bg-success-500` (Share) or `bg-warn-600` (Decline) filled. These sit beside the main "Send my answer", so one card shows several bright fills.
          • ClaimAccessCard: hand-rolled `<button>`s (`bg-ink` filled Approve). It shows a `Loader2 … animate-spin` spinner while sending and uses `text-[12px]`.
          Code: `apps/web/app/dashboard/[eventId]/access-requests/_components/request-card.tsx` · `border-success-400 bg-success-500 text-cream`; `.../claim-access-card.tsx` · `animate-spin`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part K1 · CLAUDE.md §3 (Button = ActionButton; Loading: no spinners)
SEVERITY  look
SOURCE    CODE
```

#### A2-E11 · Walkthrough: accent buttons, white input, native confirm
```
PAGE      /dashboard/[eventId]/seating/walkthrough   (event: Bea & Paolo)
BUTTON    "Save name" · "Save tables" · "Showing to guests" · swipe delete / "Remove video"
STEPS     1. Open Seat plan ⋯ › Walkthrough videos. 2. Add a zone, rename it and tick tables (do not save). 3. Swipe the zone left; press Remove video.
EXPECTED  One main button per zone card, with the others neutral (K1). No `bg-white`. Confirms use the shared Sheet (K3).
ACTUAL    • Rename: "Save name" is `ActionButton tone="brand"`, which is accent-outlined. It sits in the same card as "Save tables" (`tone="brand" main`).
          • The "Showing to guests" toggle is a hand-made `bg-success-100` filled pill.
          • The new-zone input carries `bg-white dark:bg-raised`.
          • Delete and Remove video ask through the browser's `confirm(…)`, not a shared Sheet.
          Code: `apps/web/app/dashboard/[eventId]/seating/walkthrough/_components/walkthrough-manager.tsx` · `label="Save name"` · `bg-white dark:bg-raised` · `confirm('Remove this walk video?`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part K1 · K2 (no white surfaces) · K3
SEVERITY  look
SOURCE    CODE
```

#### A2-E12 · Chart and walkthrough are pages, should be full-screen popups
```
PAGE      /dashboard/[eventId]/seating/chart · /dashboard/[eventId]/seating/walkthrough   (event: Bea & Paolo)
BUTTON    Seat plan ⋯ menu rows "Entrance seating chart" · "Walkthrough videos"
STEPS     1. Open Guests › Seats. 2. Open ⋯ and pick either row.
EXPECTED  By the SHAPE tests, neither is shared or come back to by link. Each is more than one short screen: the chart has a paper preview plus layout, size and Save; the walkthrough records or uploads video. Both should be a FULL-SCREEN POPUP (`RiseScreen`) over Guests › Seats, where ✕ returns to the same place.
ACTUAL    Both are separate pages reached by `MenuRow … href`, leaving the seat plan.
          The chart page also draws its paper with `bg-raised shadow-[0_1px_8px_rgba(0,0,0,0.14)]` and a loading veil of `animate-pulse bg-white/70`, and the Save button shows a `Loader2 animate-spin` spinner.
          Code: `apps/web/app/dashboard/[eventId]/seating/_components/seating-editor.tsx` · `label="Walkthrough videos"` · `label="Entrance seating chart"`; `.../seating/chart/_components/entrance-chart.tsx` · `animate-pulse bg-white/70`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      SHAPE (owner 25 Nov) · CLAUDE.md §3 (Loading: no animate-pulse, no spinners) · Part K2 (no white, no static shadow)
SEVERITY  look
SOURCE    CODE
```

#### A2-E13 · Souvenir and tea pages load with the guest-list skeleton
```
PAGE      /dashboard/[eventId]/guests/souvenirs · /dashboard/[eventId]/guests/tea-ceremony   (event: Bea & Paolo)
BUTTON    —
STEPS     1. From the event Home or Paperwork, open Souvenir table (or Tea ceremony) on a slow connection.
EXPECTED  The skeleton draws only what the page draws.
ACTUAL    PLAUSIBLE: neither route has its own `loading.tsx`, so the nearest one is `guests/loading.tsx`. That draws the guest List's skeleton ("Guests · List" ghost, list rows) inside `GuestsLastCopy`, which may paint the saved guest list itself while the souvenir desk or the serving order loads. A browser walk must confirm what shows. Code: `apps/web/app/dashboard/[eventId]/guests/loading.tsx` · `Ghost known="Guests · List"` · `<GuestsLastCopy>`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §3 (Loading: the skeleton draws only what the page draws)
SEVERITY  look
SOURCE    CODE
```

#### A2-E14 · Souvenir title is hand-made; Who is here uses half-pixel text
```
PAGE      /dashboard/[eventId]/guests/souvenirs · /dashboard/[eventId]/people   (event: Bea & Paolo)
BUTTON    —
STEPS     1. Open each page.
EXPECTED  The page title comes from `PageMasthead`. Type uses the `text-sn-*` scale, never a typed or half pixel size.
ACTUAL    • Souvenirs hand-rolls `<header><h1 className="… text-2xl font-semibold">` with no `PageMasthead`. It is not in the lint's ALLOWED list; only `guests/tea-ceremony` is.
          • People uses `text-[12.5px]` (a half pixel), plus `text-[12px]` and `text-[13px]`, on every group row.
          Code: `apps/web/app/dashboard/[eventId]/guests/souvenirs/page.tsx` · `Souvenir table` h1; `apps/web/app/dashboard/[eventId]/people/page.tsx` · `text-[12.5px]`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §3 (Page title = PageMasthead; Type: never text-[Npx], never half pixels)
SEVERITY  look
SOURCE    CODE
```

### Create an event (group A)

#### A2-A1 · Create-an-event is a bare page, not a full-screen popup
```
PAGE      /onboarding/[type] · /onboarding/simple · /onboarding/wedding · /dashboard/create-event   (signed in, from the /dashboard board)
BUTTON    "+ New event" → a type tile → ✕ / Back
STEPS     1. On /dashboard tap "+ New event". 2. Pick "Debut" (or Wedding). 3. On the first question tap ✕. 4. Repeat, go 3 steps in, then use the phone's Back.
EXPECTED  The whole create flow rises as ONE RiseScreen over the page it was started from; ✕ (and phone Back on screen 1) falls back to that same page; a large centred dialog on desktop; never a popup on a popup.
ACTUAL    Three different shapes. (a) The picker opens in a SidePanel over the board (`app/dashboard/(launcher)/_components/create-event-panel.tsx` · `<SidePanel open={open} onClose={close} title="New event" size="wide" phone="sheet">`). (b) Tapping a type does `router.replace(withNext(route))` (`event-type-picker.tsx` · `handleSelect`), so the panel vanishes and a bare full page loads at /onboarding/<type> (no shell, no top bar, no bottom nav; generic flow draws its own `<main className="flex min-h-screen flex-col bg-page">`). (c) ✕ on screen 1 goes to a FIXED address, not where the person started: `app/onboarding/_shared/onboarding-exit.ts` · `ONBOARDING_EXIT_HREF = '/dashboard/create-event'` (full create-event page, not the board they came from); signed out it is `'/'`, not /start where the tiles live. (d) Phone Back differs per flow: the wedding traps it with a sentinel history entry and steps back (`onboarding-shell.tsx` · `snOnboarding: true`), while /onboarding/[type] and /onboarding/simple have no popstate handling, so Back on step 5 drops the person out of the flow (the generic flow keeps answers in its draft but restarts at step 0 — `if (resume) setStep(...)` only). /onboarding/simple's "‹ Back" goes to /dashboard/create-event while its Cancel goes to `/dashboard`. Desktop: generic is a `max-w-xl` column on a full page, wedding uses its own `onb-twopane` two-pane layout; RiseScreen itself today is `fixed inset-0 … h-[100dvh]` with no centred-dialog desktop form (`app/_components/rise/rise-screen.tsx`).
SHOTS     none yet (phase B: 375 px light + dark)
RULE      SHAPE (owner 25 Nov, test 2: more than one short screen → FULL-SCREEN POPUP; ✕ returns to the same place)
SEVERITY  look
SOURCE    CODE
```

#### A2-A2 · Get-together tile sends signed-out visitors to login
```
PAGE      /onboarding/simple   (reached from /start or the front door, signed out)
BUTTON    the "Get-together" tile
STEPS     1. Signed out, open /start (or the front-door tiles). 2. Tap "Get-together".
EXPECTED  Zero friction: the questions run with no account; the account is asked only at save (owner 2026-10-25, quoted in `startHrefFor`: "Yes they can create an event. But saving an event must link by logging in").
ACTUAL    The tile goes to the type's `onboarding_href` = /onboarding/simple (`event-types.ts` · `startHrefFor` → `onboardingRouteFor` returns `t.onboardingHref` first; seeded '/onboarding/simple' in migration `20270307127948_simple_event_type_role_set_and_profile.sql`). That page redirects before any question: `app/onboarding/simple/page.tsx` · `if (!user) redirect('/login?next=/onboarding/simple');` and its action does the same (`commitSimpleEvent` · `return redirect('/login?next=/onboarding/simple')`). Every other type runs signed out and mints an anonymous session at the commit; this one is a login wall at the door. (An existing anonymous session passes, since `getCurrentUser` returns it.)
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §1 zero friction (a host starts an event with no account)
SEVERITY  money-signin
SOURCE    CODE
```

#### A2-A3 · A rate-limited signed-out host cannot save, no way on
```
PAGE      /onboarding/[type] · /onboarding/wedding   (signed out, last screen)
BUTTON    "Create my debut" / the wedding's last "Continue"
STEPS     1. Signed out, on a shared network (mobile-carrier NAT, venue or expo wifi), walk any onboarding. 2. Press the final button after 5 other anonymous saves from the same IP that day.
EXPECTED  A plain reason and a way forward (sign in / create an account, the draft kept), never a "try again" that cannot succeed.
ACTUAL    Both commits refuse with `{ ok: false, error: 'rate_limited' }` when `allowAnonMint` says no (`app/onboarding/_shared/commit-event.ts` and `app/onboarding/wedding/actions.ts`; limit `MAX_PER_WINDOW = 5` per IP per `WINDOW_SECONDS = 60 * 60 * 24` in `lib/anon-mint-throttle.ts`). Neither client knows the code: generic shows `'Something went wrong saving your plan. Please try again.'` (only `'not_authenticated'` gets the sign-in link), and the wedding's `else` branch shows the same sentence; the account screen was dropped from the sequence (`id === 'account' && (authed || ANON_DRAFT_ENABLED)`), so there is no sign-in door on the screen. Retrying hits the same limit. The same dead end follows a failed anonymous mint in the wedding (`if (ANON_DRAFT_ENABLED) { setCommitError('Something went wrong saving your plan. Please try again.') }`). PLAUSIBLE how often it fires: whether many Filipino mobile users share one public IP must be confirmed from the `anon mint` throttle rows / logs.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §1 zero friction · §5 rule 4 (a failure gives a plain reason plus a way on)
SEVERITY  money-signin
SOURCE    CODE
```

#### A2-A4 · Securing an anonymous plan with Google or log-in loses it
```
PAGE      /signup and /login, reached from the dashboard's save prompt after a signed-out onboarding (event: Lolo Ben at 80, made signed out)
BUTTON    "Continue with Google" (Apple / Facebook) on /signup · "I already have an account"
STEPS     1. Signed out, finish /onboarding/birthday → the event is saved under an anonymous session. 2. On the dashboard, the save prompt → "Create a free account". 3. Choose Google instead of email + password (or choose "I already have an account" and log in).
EXPECTED  The event made in step 1 is on the account the person ends up signed into.
ACTUAL    Only the email + password sign-up converts the anonymous user in place (`app/signup/actions.ts` · `if (existingUser?.is_anonymous) { … admin.auth.admin.updateUserById(userId, { email, password, … }) }`). The OAuth buttons call `supabase.auth.signInWithOAuth` (`app/auth/oauth-actions.ts` · `signInWithProvider`), which signs in a different user; nothing in `app/auth/callback/route.ts` or `app/login/actions.ts` mentions the anonymous session, and no `linkIdentity` exists in the repo. The event stays on the anonymous user and is later deleted by `app/api/cron/anon-draft-sweep/route.ts`. Both doors are offered to anonymous users by `app/_components/anon-gate/save-to-continue.tsx` (`href={`/signup?next=${next}`}` · `href={`/login?next=${next}`}` "I already have an account"), and OAuth is ON in production (`NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED` etc., build-sessions/P0-b-SWITCHES.md). A browser walk must confirm the event is missing after the Google round trip.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §1 zero friction (the account is asked at save; nothing made before it is lost)
SEVERITY  money-signin
SOURCE    CODE
```

#### A2-A5 · Onboarding prices formatted by three home-made peso helpers
```
PAGE      /onboarding/wedding · /onboarding/[type] · /onboarding/simple   (the services step and the wedding budget card)
BUTTON    —
STEPS     1. Walk any onboarding to the services step (Papic, Setnayan AI, Event Pro cards). 2. On the wedding, open the budget card.
EXPECTED  Every peso goes through `lib/php.ts` (`formatPhp` / `formatPhpRounded`).
ACTUAL    Three copies of `const peso = (n: number) => `₱${Math.round(n).toLocaleString('en-PH')}`;` — in `app/onboarding/_shared/services-step.tsx` (the "You'll pay" / "You save" lines, `PriceLine`), `lib/onboarding/services-step-data.ts` (`priceLabel: peso(aiPricePhp)`), and `app/onboarding/wedding/_components/wedding-cards.tsx` (budget hints `about ${peso(r.pesos)}`). Same output today; a second formatter is the drift CLAUDE.md §1 forbids. (Lead: set to `wrong`, not money — no figure differs today.)
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §1 (money only through lib/php.ts) · design-and-wiring C8
SEVERITY  wrong
SOURCE    CODE
```

#### A2-A6 · "Free to start, always." in the share text
```
PAGE      /onboarding/[type] · /onboarding/wedding
BUTTON    — (page metadata: link previews, browser tab)
STEPS     1. Share an /onboarding/debut or /onboarding/wedding link in Messenger.
EXPECTED  No price promise.
ACTUAL    `app/onboarding/[type]/page.tsx` · `"A few quick questions and we'll shape a plan made for your event. Free to start, always."` and `app/onboarding/wedding/page.tsx` · `"… every supplier sorted to fit. Free to start, always."`. brand.md bans "always free"-type promises; "Free to start, always" reads as one.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      brand.md claims never made, rule 3 (price promises)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-A7 · A failed profile read shows a blank "You" card
```
PAGE      /signup/you
BUTTON    "Done"
STEPS     1. A returning person opens /signup/you while the `users` read fails. 2. They retype a display name and press Done.
EXPECTED  A failed read says it could not read, and never lets Done write blanks over saved values.
ACTUAL    `app/signup/you/page.tsx` · `const { data: profile } = await supabase.from('users').select('display_name, slug, … phone, …')` — the `error` is never read; `const me = (profile ?? {}) as YouCardMe;` draws empty fields as if nothing were saved. Done then posts the empty phone and formal-name fields through `planYouCard` → `planPersonalInfoPatch`, so saved values can be cleared. The action's own read is the same shape (`app/signup/you/actions.ts` · `const { data: mine } = … select('slug, account_type')`), so a failed read makes `existing.slug === null` and a posted @name is applied to an account that already has one (bypassing the rename cap the comment names). Brand-new accounts lose nothing; a returning person can.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-A8 · "Your wedding plan is saved" email for every event type
```
PAGE      /signup (the save of an anonymous plan, on the way to /signup/you)   (event: Sofia's 18th, made signed out)
BUTTON    "Create account" (email + password)
STEPS     1. Signed out, make a debut through /onboarding/debut. 2. Secure it with email + password on /signup.
EXPECTED  The email names the person's event, or says "event".
ACTUAL    `app/signup/actions.ts` (anonymous convert-in-place branch) sends `subject: 'Your Setnayan plan is secured'` with `` `Your Setnayan account is set — your wedding plan is now saved to it.` `` for any type. The comment above it assumes "Anon-draft users are always couples (they came through wedding onboarding)", but `commitOnboardingEvent` (`app/onboarding/_shared/commit-event.ts`) mints anonymous sessions for every non-wedding type too.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      brand.md word rules (app copy says "event")
SEVERITY  wrong
SOURCE    CODE
```

#### A2-A9 · Raw database error printed on the host invitation
```
PAGE      /host/accept/[token]
BUTTON    "Accept invitation"
STEPS     1. Open a valid co-host invite signed in with the matching email. 2. Press Accept while the write fails.
EXPECTED  One plain sentence and Try again; the database text goes to the log only (the create-event page fixed this exact defect: "AN UNRECOGNISED CODE NEVER RENDERS ITSELF").
ACTUAL    `app/host/accept/[token]/actions.ts` · `?error=accept_failed&msg=${encodeURIComponent(error.message.slice(0, 80))}` and the page prints it: `body={`Error: ${search.error}${search.msg ? ' — ' + search.msg : ''}. Try again, or ask the inviter to re-send.`}`. The person reads "Error: accept_failed — <Postgres message>". Because `msg` is read straight from the URL, anyone can also craft a link that shows any text under the Setnayan invitation card. There is no Try again control on that card (`TerminalCard` without `cta`).
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (failure = plain reason plus Try again)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-A10 · A failed invite read shows "not found"
```
PAGE      /host/accept/[token]
BUTTON    —
STEPS     1. Open a valid invite link while the `event_moderators` read fails (or the service key is missing).
EXPECTED  "We couldn't read this invitation — try again", distinct from an invalid link.
ACTUAL    `app/host/accept/[token]/page.tsx` · `const { data: inviteRaw } = await admin.from('event_moderators')…maybeSingle();` then `if (!inviteRaw) { notFound(); }` — the `error` is never read, so a failed read is shown as a 404 (the invite looks dead and the invitee is told nothing true). The event and inviter reads beside it are the same shape (`[{ data: eventRow }, { data: inviterRow }]`): a failed read silently falls back to "a debut" / "a host".
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### ONBOARDING SHAPE (owner asked) — the full entry for A2-A1

**What it is TODAY (code at `fb3f72d`)**

- **Every flow is its own page at its own address, not a popup.**
  - `/onboarding/wedding`, `/onboarding/<type>` (debut, birthday, wake …) and `/onboarding/simple` are top-level routes outside every shell. No `app-rail-shell`, no top bar, no bottom nav; `SiteChrome` only draws on marketing NAV routes. Each flow draws its own frame: the generic one draws `<main className="flex min-h-screen flex-col bg-page">` with a brand header, a progress bar and a sticky glass `StepBar`; the wedding draws its `.onbw` shell from `_styles/onboarding.css`; simple is a plain `max-w-xl` form page.
  - The steps inside a flow are client state on ONE address. Step changes do not change the URL. The draft is in `localStorage` (30-day TTL), and `?resume=1` restores it after sign-in.
- **How many screens:**
  - Wedding, with the setup engine on (approved order `WEDDING_FLOW_ORDER` in `lib/onboarding/wedding-cards.ts`): names, event name, kind, date, area, pax, budget, then the `setup_photo` and `setup_look` cards, colours, the services step, congrats. That is about 12 screens, with `account` dropped because anonymous drafts are on.
  - Generic: `genericFlowScreens(...)`, which varies by type, shows "n of N". The "What do you need?" needs-only path is ONE screen with its own create button.
  - Simple: one form, or setup cards paced inside it when the engine admits `simple_event`.
- **How the person gets in:**
  - Signed in: `/dashboard` → "+ New event" is intercepted by `app/(hub)/dashboard/@modal/(.)create-event/page.tsx`. It renders the real create-event page inside `CreateEventPanel` = `SidePanel` (`phone="sheet"`: a bottom sheet on a phone, a wide right panel on desktop; it does use `useModalA11y`).
  - Tapping a type does `router.replace('/onboarding/<type>')`. The panel is gone and a full page loads. It is not a popup on a popup, but the person leaves the board.
  - A cold load or refresh of `/dashboard/create-event` is a full page (`max-w-6xl`).
  - Signed out: `/start` or the front-door tiles go straight to `/onboarding/<type>` (`startHrefFor`).
- **✕ / Back / close:**
  - Screen 1, the top-left ✕ (`onboardingExit`): signed in it goes to `/dashboard/create-event` (the full picker page, not the board they came from); signed out it goes to `/` (not `/start`).
  - Later screens: ‹ steps back one.
  - Phone or browser Back: the wedding catches it and steps back (sentinel history entry `snOnboarding`). On screen 1 it does `history.back()`, which lands on the board because the picker entry was replaced. The generic and simple flows do not catch it, so Back on any step leaves the flow.
  - Simple has a "‹ Back" link to `/dashboard/create-event` AND a "Cancel" link to `/dashboard`.
  - So ✕ and Back can land in two different places.
- **Desktop:**
  - Generic: a centred `max-w-xl` column on a full white page.
  - Wedding: its own two-pane layout (`onb-twopane`).
  - Picker from the board: a right-hand side panel.
  - Nothing is a centred dialog.
- **Zero friction, checked in code:**
  - Wedding and generic run fully signed out. `OnboardingWeddingPage` and `GenericOnboardingPage` have no auth redirect. At the final button `commitOnboardingWedding` / `commitOnboardingEvent` mint a Supabase anonymous session (`signInAnonymously`, behind `NEXT_PUBLIC_ANON_ONBOARDING_ENABLED`, ON in prod per `build-sessions/P0-b-SWITCHES.md`). The event is written under that session and the person lands on the event dashboard with the draft cleared.
  - Between the last step and the account, nothing is lost on the main path. The draft lives in `localStorage` until the commit succeeds, and email + password sign-up on `/signup` converts the SAME user id (`updateUserById`), so `event_members` still points at it. That path ends at `/login?ready=…`, not at `/signup/you`.
  - Three breaks:
    - Get-together is a login wall at the door (A2-A2).
    - A rate-limited or failed anonymous mint leaves "try again" with no sign-in door (A2-A3).
    - Securing the plan with Google, Apple or Facebook, or "I already have an account", leaves the event on the anonymous user, to be swept (A2-A4).
  - Note for the lead, not a finding: with anonymous drafts ON, the account is NOT asked at save. The event is saved anonymously and the account is nudged later (`SecureAccountBanner` / `SaveToContinue`). The owner's 2026-10-25 words quoted in `startHrefFor` ("saving an event must link by logging in") and the CLAUDE.md line "the account is asked for at save" read the other way. Confirm which is meant.

**What it SHOULD be (owner, by the three tests)**

- One create flow, picker included, as ONE `RiseScreen` rising over the page it was started from (the board, Home, an event page, `/start`).
- ✕ (and phone Back on its first screen) falls back to exactly that page with its scroll kept. Inside, ‹ and phone Back step back one screen.
- A large centred dialog on desktop.
- Never a popup on a popup: the picker is screen 1 of the same RiseScreen, not a SidePanel that hands off to a page.
- A hard load or share of `/onboarding/<type>` still draws the full page, the way `RiseRoute` does today.

**What would change (files / components)**

1. Add an intercepting `@rise` slot where creation starts: `app/(hub)/dashboard/@rise/(.)create-event`, plus one for `/onboarding/[type]`, `/onboarding/wedding` and `/onboarding/simple`, with a catch-all `[...rest]` and a `default.tsx`. This copies `app/vendor-dashboard/@rise/*`. Wrap each in `RiseRoute` (`app/_components/rise/rise-route.tsx`). Retire `@modal/(.)create-event` and `CreateEventPanel` (`app/dashboard/(launcher)/_components/create-event-panel.tsx`).
2. `event-type-picker.tsx` `handleSelect`: move to the type's screen INSIDE the same rise (a soft `router.push` that the slot intercepts, or client state) instead of `router.replace` to a bare page.
3. `app/onboarding/_shared/onboarding-exit.ts`: drop the fixed `ONBOARDING_EXIT_HREF`. ✕ calls the rise's `onClose` (back to the opener). Signed out with no opener, it goes to `/start`. Update `first-screen-can-cancel.test.ts` to match.
4. `generic-onboarding.tsx`, `onboarding-shell.tsx` (wedding) and `app/onboarding/simple/page.tsx`: stop drawing their own full-page `<main>` / `min-h-screen` frame and the header ✕/‹ ring when inside the rise (RiseScreen owns the head and ✕). Put the step history on RiseScreen's Back (`useBackCloses`) in ALL three flows. Remove the wedding-only `snOnboarding` sentinel and add the same behaviour to generic and simple. Drop simple's duplicate "‹ Back" / "Cancel" pair.
5. `app/_components/rise/rise-screen.tsx`: a desktop form (a large centred dialog over a dim, `OverlayBackdrop`) instead of `fixed inset-0` at every width. This is shared, so it needs the owner's or a Fable drawing first (no drawing found in this pass).
6. Guard tests to update or extend: `app/onboarding/the-steps-wear-one-template.test.ts`, `first-screen-can-cancel.test.ts`, `app/dashboard/(account)/create-event/the-grid-opens-first.test.ts`, `app/_components/rise/the-rise-screen-is-one-full-screen.test.ts`. Also the Ugat doors in `screens.generated.json` (the ship controller regenerates them).
7. Already held, not touched by this: one commit per flow (`commitOnboardingEvent` / `commitOnboardingWedding` / `commitSimpleEvent`, `the-wedding-exists-only-when-it-does.test.ts`), `no-flow-hangs-forever.test.ts`, `every-onboarding-action-is-the-house-button.test.ts`, `the-walk-couple-c1.test.ts`, and the date-floor and entrance-block tests.

### Account (group C)

#### A2-C1 · Notifications skeleton draws cards, pills, buttons the page lacks
```
PAGE      /dashboard/notifications
BUTTON    —
STEPS     1. Open the bell › "View all" (or /dashboard/notifications) on a slow connection. 2. Watch the loading state, then the page.
EXPECTED  The skeleton draws only what the page draws: a visible "Notifications" title, then ONE card of plain rows (no type pills, no per-row buttons).
ACTUAL    loading.tsx draws 5 separate framed cards each with a pill (`h-5 w-16 rounded-full`) and a right button (`h-7 w-14`), and says "NOTHING AT THE TOP. The page has no back link, no title" — but the page now draws `NotificationsHead level="page"` with a visible `<h1>Notifications</h1>` and one `sn-notice-card` `<ul>` ("no cards, no type pills, no per-row buttons"). Code: `apps/web/app/dashboard/(account)/notifications/loading.tsx` · `Sk className="mt-0.5 h-5 w-16 shrink-0 rounded-full"`; `apps/web/app/_components/notifications/notifications-list.tsx` · `NotificationsHead`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part F1 (skeleton draws only what the page draws)
SEVERITY  look
SOURCE    CODE
```


#### A2-C3 · API keys offered to every couple: dead end, wrong domain, bad endpoint
```
PAGE      /dashboard/api-keys   (any couple, e.g. Bea & Paolo's host)
BUTTON    "API keys" (Profile › Account row)
STEPS     1. Profile › Account › "API keys". 2. Read the page.
EXPECTED  A couple is not offered a public-API surface (CLAUDE.md §6 "No public API endpoints in V1"; keys are an Ultra-supplier grant). If shown at all, only to accounts with the grant, with real endpoints on setnayan.com.
ACTUAL    The profile row is unconditional (`<Link href="/dashboard/api-keys" className={ACCOUNT_ROW}>` in both the Account pane and `indexExtras`). Without the grant the page says "It is not open to any plan right now, so keys cannot be made yet." yet still shows "No keys yet. Create one above to start calling the API." and a "Try it" block with `curl https://setnayan-platform-web.vercel.app/api/v1/me` (not setnayan.com) and lists `GET /api/v1/suppliers — browse published suppliers (public, no auth)`: there is no `app/api/v1/suppliers` route (the directory is `/api/v1/vendors`, and it 404s unless `PUBLIC_API_ENABLED`). Code: `apps/web/app/dashboard/(account)/api-keys/page.tsx` · `setnayan-platform-web.vercel.app` · `GET /api/v1/suppliers`; `apps/web/app/dashboard/(account)/profile/page.tsx` · `href="/dashboard/api-keys"`; `apps/web/lib/public-api-flag.ts` · `isPublicApiEnabled`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §6 (no public API in V1) · brand.md (setnayan.com only; no coming features) · design-and-wiring B5 (no dead ends)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-C4 · Refused API-keys read shows "Your keys (0)"
```
PAGE      /dashboard/api-keys
BUTTON    —
STEPS     1. Supplier with keys opens the page while the `api_keys` read is refused.
EXPECTED  "Couldn't read your keys" — never a zero list (the code's own comment: "they may create a duplicate").
ACTUAL    Error is only logged; `const keys = (data ?? []) as ApiKeyRow[]` → heading `Your keys ({keys.length})` = "(0)" and "No keys yet." — a live key that should be revoked is hidden. Code: `apps/web/app/dashboard/(account)/api-keys/page.tsx` · `logQueryError('ApiKeysPage.data'` · `Your keys ({keys.length})`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-C5 · New API secret travels in the page URL (security)
```
PAGE      /dashboard/api-keys
BUTTON    "Create key"
STEPS     1. Account with the grant creates a key. 2. Look at the address bar / history.
EXPECTED  The one-time secret is shown without being put in a URL (history, server/request logs, Referer).
ACTUAL    `redirect(\`/dashboard/api-keys?just_created=${encodeURIComponent(key)}\`)` — the full bearer key lands in the query string and stays in browser history and request logs; the page renders it from `search.just_created`. Also "Revoke" (irreversible) has no confirm. Code: `apps/web/app/dashboard/(account)/api-keys/actions.ts` · `just_created=`; `apps/web/app/dashboard/(account)/api-keys/page.tsx` · `revokeApiKey`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring B6 (trace to end) · CLAUDE.md §3 Floating surface "Confirm only for the irreversible"
SEVERITY  wrong
SOURCE    CODE
```

#### A2-C6 · Raw database error text shown to people
```
PAGE      /dashboard/api-keys, /dashboard/profile, /dashboard/clusters, /dashboard/clusters/[clusterId], /dashboard/samahan/new
BUTTON    "Create key" · "Save" (profile) · "Create group"/"Add"/"Rename"/"Save" (clusters) · "Create group" (samahan)
STEPS     1. Trigger any save failure (RLS, constraint, network).
EXPECTED  A plain reason plus Try again (CLAUDE.md §3 Toast row).
ACTUAL    Postgres/PostgREST `error.message` is echoed into the UI: api-keys `encodeURIComponent(error?.message ?? 'Could not create key')`; profile `updatePersonalInfo` → `?error=${encodeURIComponent(error.message)}`; clusters actions `return { ok: false, error: error.message }` (rendered `role="alert"`); samahan `createCommunity` → `'member_link_failed: ' + memberError.message`. Pages print `?error=` raw when not in their ERROR_COPY map. Code: `apps/web/app/dashboard/(account)/api-keys/actions.ts`, `.../profile/actions.ts` · `updatePersonalInfo`, `.../clusters/actions.ts`, `.../samahan/actions.ts` · `member_link_failed`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §3 (failure = plain reason + Try again)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-C7 · Refused profile read shows blank forms that Save will overwrite
```
PAGE      /dashboard/profile
BUTTON    "Save" (Profile / Guest details)
STEPS     1. Open Profile while the `users` read is refused. 2. Fields show empty. 3. Press Save.
EXPECTED  "Couldn't read your profile" and no editable form (or a locked one) — a refusal must not look like an empty profile.
ACTUAL    `profileErr` is only logged (`'graceful_degrade'`); every field renders `defaultValue={profile?.… ?? ''}`, switches fall to defaults, Account ID "—". `updatePersonalInfo` writes the fields the form carries, so Save writes the blanks over the saved name/phone/birthday/meal. A refused `account_deletion_requests` read likewise hides a pending request and re-offers "Delete my account" (duplicate filing). Code: `apps/web/app/dashboard/(account)/profile/page.tsx` · `logQueryError(\n      'ProfilePage (users)'` · `pendingDeletionErr`; `.../profile/actions.ts` · `planPersonalInfoPatch`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-C8 · Account pane prints raw enum and internal section codes
```
PAGE      /dashboard/profile   (?tab=account)
BUTTON    —
STEPS     1. Profile › Account (as a supplier-owner account, and as a couple).
EXPECTED  Plain words: "Supplier"/"Host"; no internal jargon.
ACTUAL    `<Row label="Account type" value={profile?.account_type ?? '—'} />` prints the enum as-is ("customer", "vendor", "admin" — `CREATE TYPE public.account_type AS ENUM ('customer', 'vendor', 'admin')`), so a supplier reads "vendor". "Internal account" shows to everyone with values like "Yes (§ 10a — owner)". Code: `apps/web/app/dashboard/(account)/profile/page.tsx` · `label="Account type"` · `§ 10a — owner`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      brand.md word rules (supplier, never vendor)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-C9 · Profile advertises "Legacy contact … Coming soon"
```
PAGE      /dashboard/profile   (?tab=privacy)
BUTTON    —
STEPS     1. Profile › Privacy › Your data.
EXPECTED  No coming feature shown in UI.
ACTUAL    A tile "Legacy contact — Choose, while living, who inherits your memories. Coming soon." with an inert "Not set" pill. Code: `apps/web/app/dashboard/(account)/profile/page.tsx` · `data-coming-soon` · `Coming soon.`
SHOTS     none yet (phase B: 375 px light + dark)
RULE      brand.md claims #9 (no coming feature) · design-and-wiring B5
SEVERITY  wrong
SOURCE    CODE
```

#### A2-C10 · White surfaces and a static shadow in feature files
```
PAGE      /dashboard/profile, /dashboard/samahan/[communityId]
BUTTON    —
STEPS     1. Profile › Privacy (Legacy contact pill). 2. A group's chatroom with an event card; Members view (photo badge).
EXPECTED  Token colours only; no `bg-white`; no shadow on a static element (K2 / Part I4).
ACTUAL    profile `bg-white/60 dark:bg-raised` on the "Not set" pill; group chatroom event card `rounded-2xl border border-ink/15 bg-white/70 … dark:bg-raised` (hand-made frame, `no-card-ok`); identity header camera badge `bg-mulberry text-white dark:text-cream shadow`. Code: `apps/web/app/dashboard/(account)/profile/page.tsx` · `bg-white/60`; `.../samahan/[communityId]/_components/group-chatroom.tsx` · `bg-white/70`; `.../samahan/[communityId]/_components/samahan-identity-header.tsx` · `bg-mulberry text-white dark:text-cream shadow`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring D13 · HOUSE_DESIGN_STANDARD Part K2 / Part I4
SEVERITY  look
SOURCE    CODE
```

#### A2-C11 · Setnayan AI settings page has no live door, two Backs
```
PAGE      /dashboard/profile/concierge
BUTTON    "Back to profile" (×2)
STEPS     1. Look for a way in from Profile. 2. Open the URL directly.
EXPECTED  A page is reachable (Ugat no-door) or retired; one back per screen.
ACTUAL    Both profile rows are wrapped in `{CONCIERGE_ENABLED ? (…) : null}` and `CONCIERGE_ENABLED = false` permanently, so no person reaches it (Ugat counts the gated profile link + an admin action as doors). Opened directly, the live branch draws "Back to profile" twice (top, and again beside "See pricing"), and no PageMasthead (raw `<h1>`). Code: `apps/web/app/dashboard/(account)/profile/concierge/page.tsx` · `if (!CONCIERGE_ENABLED)` · `label="Back to profile"`; `apps/web/lib/concierge.ts` · `CONCIERGE_ENABLED = false`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring A3 (registered and reachable) · CLAUDE.md §3 (PageMasthead every page)
SEVERITY  broken
SOURCE    CODE
```

#### A2-C12 · A refused read shows "page not found" (loved one, linked events)
```
PAGE      /dashboard/people/[dependentId], /dashboard/clusters/[clusterId]
BUTTON    —
STEPS     1. Open a loved one's page (or a linked-events group) while its first read is refused.
EXPECTED  "Couldn't read this — try again", never a 404 that says the record is gone.
ACTUAL    Dependent: `if (depError) logQueryError(...)` then `if (!depRow) notFound();` — the comment admits it "404s". Cluster: `fetchCluster` returns `null` on error, page does `if (!cluster) notFound();`. Code: `apps/web/app/dashboard/(account)/people/[dependentId]/page.tsx` · `DependentPage.dependent`; `apps/web/lib/clusters.ts` · `fetchCluster`; `.../clusters/[clusterId]/page.tsx` · `if (!cluster) notFound();`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-C13 · Linked events (/dashboard/clusters) has no way in
```
PAGE      /dashboard/clusters, /dashboard/clusters/[clusterId]
BUTTON    —
STEPS     1. From Home, the menu, an event, Profile or the palette, try to reach "Linked events".
EXPECTED  A menu row or a real door (Ugat no-door check).
ACTUAL    No file outside `app/dashboard/(account)/clusters/` links to `/dashboard/clusters` (grep finds none; not in `customer-menu.ts`, `account-rail-context.tsx` or `nav-registry-defaults.ts`). screens.generated.json lists its only door as its own child page; the child's extra "doors" (`lib/art-kits.ts`, `lib/wedding-essentials.ts`, `middleware.ts`, `nav-registry-defaults.ts`) look like `[param]` pattern matches, not real links (PLAUSIBLE — they contain no "clusters"). Code: `apps/web/app/dashboard/(account)/clusters/page.tsx` · `ClustersPage`; `apps/web/lib/ugat/screens.generated.json` · `"route":"/dashboard/clusters"`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring A3 (registered and reachable)
SEVERITY  broken
SOURCE    CODE
```

#### A2-C14 · Group page turns refused reads into "none" and "rotate"
```
PAGE      /dashboard/samahan/[communityId]   (?tab=events, ?tab=members, chatroom)
BUTTON    "Rotate link" (prompted by the false state)
STEPS     1. Open a group while the events / roster / invite-token read is refused. 2. Open ⋯ › All events, ⋯ › Members.
EXPECTED  Each list says it could not be read.
ACTUAL    `fetchCommunityEvents` and `fetchCommunityRoster` return `[]` on error → Events says "Walang event pa." and ⋯ "All events" trails `formatCount(eventCount)` = "0"; Members draws an empty roster (no "(you)" row, no "Leave group"). `fetchInviteToken` returns `null` on error → organizer reads "No active link — rotate to mint a fresh one.", and rotating kills the link that still works. (The reader test only holds that the token read logs + returns null; the render is not held.) Code: `apps/web/lib/communities.ts` · `fetchCommunityEvents` · `fetchCommunityRoster` · `fetchInviteToken`; `.../samahan/[communityId]/page.tsx` · `No active link — rotate to mint a fresh one.` · `Walang event pa.`
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-C15 · "Create a group" is a whole page for two fields
```
PAGE      /dashboard/samahan/new
BUTTON    "＋ New" (People › Groups pinned row) / "New group"
STEPS     1. People › Groups › ＋ New.
EXPECTED  SHAPE test 3: not shared by link, one short screen, 2 fields → SMALL POPUP (`Sheet`) over People › Groups.
ACTUAL    A full page (`PageMasthead title="Create a group"`, name + optional description, `button-primary` submit); errors round-trip by `?error=`. Also the name placeholder uses the owner's own first and family name as an example group. Code: `apps/web/app/dashboard/(account)/samahan/new/page.tsx` · `NewSamahanPage` · `placeholder="Barkada`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      SHAPE (owner 25 Nov)
SEVERITY  look
SOURCE    CODE
```

Checked and clean (no finding): /dashboard/billing honest states (`read.measured`, `receiptsMeasured`, supplier sections `Unread`), pesos via `formatPhp` (re-export of `lib/php.ts`), VAT from `getEffectiveVatRatePct` (falls to 0 by owner design = the setting's value); /dashboard/search forward on empty `q` → `DISCOVER_HREF`; /dashboard/people and /dashboard/samahan forwards land on Home › People as specified; profile `href="#slug"` / `#privacy` anchors switch group via `SettingsShell` `hashchange`; K3 layers in samahan use `OverlayBackdrop` + `useModalA11y` / `PickMenu`.

### Guests (group D)

Checked and clean, not findings: the guest list's own counts are honest (masthead, summary, empty state are gated on `guestsMeasured`; `computeGuestStats` / `rosterStats` both filter by `countsTowardEvent`); `GuestPopup` (`guest-popup.tsx`) uses `OverlayBackdrop` + `usePopupBehind` (= `useModalA11y` + `inertBehind`), and every guest-list sheet goes through it; `Drawer` in `overlay-primitives.tsx` is correct (`Scrim dim` → `OverlayBackdrop`, `useModalA11y`) but no page in this group uses it; `/claims` gates "Nobody is waiting" / the big `0` on `unlistedMeasured`; the seat view gates its room on `guestsRead.measured`; the guest card says "Couldn't read their seat" on a refused seat read. Not covered by `lib/guests-read-is-honest.test.ts`: the check-in desk (A2-D13) and the seat view's crash path (A2-D1).

#### A2-D1 · A failed seat read crashes the whole Guests page
```
PAGE      /dashboard/[eventId]/guests?gview=seats   (event: Bea & Paolo)
BUTTON    "Seats" (the List · Map · Seats view switch)
STEPS     1. Open Guests. 2. Switch to Seats (or open ?gview=seats) while the event_tables or event_seat_assignments read is refused (RLS blip, timeout).
EXPECTED  The List stays; the Seats view says it could not load the seat plan (the page's own rule: "this Promise.all must never take down the whole Guests tab over a transient seat-read blip").
ACTUAL    The page guards its OWN seat reads (`measuredOr(fetchAssignments(…))`, `measuredOr(fetchTables(…))`), but the Seats body is the shipped seat page rendered whole (`<SeatingPage params=… searchParams={{ host: 'guests' … }} />` inside `<Suspense fallback={viewLoading('seats')}>`), and that page calls `fetchTables` / `fetchAssignments` unguarded in its `Promise.all`; both `throw new Error('fetchTables failed: …')` / `'fetchAssignments failed: …'` (lib/seating.ts). The seat route's own boundary (`app/dashboard/[eventId]/seating/error.tsx`) does not wrap it when drawn inside Guests, and there is no error.tsx under `app/dashboard/[eventId]/` or `/guests/`, so the nearest boundary is `app/error.tsx`: the List, Map and the open card go too. PLAUSIBLE on the exact boundary: a browser walk with the seat read forced to fail must confirm. Code: `apps/web/app/dashboard/[eventId]/guests/page.tsx` · `<SeatingPage params={Promise.resolve({ eventId })}`; `apps/web/app/dashboard/[eventId]/seating/page.tsx` · `fetchTables(supabase, eventId),`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states: a failure renders as a failure, scoped)
SEVERITY  broken
SOURCE    CODE
```

#### A2-D2 · Seats and Check-in count replies with their own filters
```
PAGE      /dashboard/[eventId]/guests?gview=seats · /dashboard/[eventId]/guests/checkin   (event: Bea & Paolo)
BUTTON    — (the "to seat" / seat-shortfall numbers; the desk's "N / M attending")
STEPS     1. Open Guests › Seats and read the reserved / still-to-seat / need-more-tables numbers. 2. Open the check-in desk and read "Arrived N / M attending".
EXPECTED  Each number comes from the one reader: `computeGuestStats` then `headcountForBasis(stats,'attending')` for "attending" and `headcountForBasis(stats,'invited')` for "everyone not declined" (CLAUDE.md §4; check-in "expected" = attending only).
ACTUAL    Each page re-counts the rows itself. Seat view: `reservedGuests = seatingGuests.filter((g) => g.rsvp_status === 'attending')` and `nonDeclinedCount = seatingGuests.filter((g) => g.rsvp_status !== 'declined').length`. Check-in: `const expected = guests.filter((g) => g.rsvpStatus === 'attending').length;` over its own hand-written guests select (it repeats the `countsTowardEvent` filters as `.neq('entry_source', REQUEST_ENTRY_SOURCE).eq(PASSED_AWAY, false).is(REPRESENTED_BY, null)`). They agree today; they are second copies that drift (e.g. when a basis or a new "not counted" rule is added to `countsTowardEvent`). Code: `apps/web/app/dashboard/[eventId]/seating/page.tsx` · `reservedGuests`, `nonDeclinedCount`; `apps/web/app/dashboard/[eventId]/guests/checkin/page.tsx` · `const expected =`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §4 / design-and-wiring C8 (one reader per shared fact)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-D3 · Guest card's Invite menu has no dim, no lock
```
PAGE      /dashboard/[eventId]/guests (guest card, ?inspect=) · /dashboard/[eventId]/guests/[guestId]   (event: Bea & Paolo)
BUTTON    "Invite <first name>" (the Send-invite menu on the guest card: WhatsApp · Viber · Messenger · Copy message · Copy ticket · Mark as sent · Copy invitation link)
STEPS     1. Open a guest's card. 2. Press the invite control. 3. Try to scroll or tap the card behind the menu.
EXPECTED  K3: the layer draws the one shared backdrop (dim + blur), the page behind is inert and does not scroll, a backdrop tap closes it.
ACTUAL    It is the guest list's own `Popover` (`overlay-primitives.tsx`) with `role="dialog"`: its catcher is a clear `<button … className="gl-scrim fixed inset-0">` (`Scrim` without `dim`, so no `OverlayBackdrop`), and it calls `useModalA11y({ … lockScroll: false })`, which skips both the scroll lock and `isolateOverlay` (the inert page). So nothing dims or blurs and the page behind still scrolls. A tap outside does close it. On a phone this menu also opens over the card sheet (a layer on a layer; see A2-D4). Code: `apps/web/app/dashboard/[eventId]/guests/_components/guest-invite-cell.tsx` · `<Popover anchorRef={from === 'head' && pin.pinned ? pinRef : ref}`; `apps/web/app/dashboard/[eventId]/guests/_components/overlay-primitives.tsx` · `<Scrim onClose={onClose} z={78} label="Dismiss menu" />`, `useModalA11y({ open: true, onClose, containerRef: ref, lockScroll: false })`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part K3
SEVERITY  look
SOURCE    CODE
```

#### A2-D4 · Ticket view opens a confirm over itself
```
PAGE      /dashboard/[eventId]/guests (guest card) · /dashboard/[eventId]/guests/[guestId]   (event: Bea & Paolo)
BUTTON    "New QR" · "Unlink account" (inside "Their ticket"); "Delete guest" (on the card)
STEPS     1. On a phone, open a guest (the card is the side-peek sheet). 2. Tap "Their ticket", which opens a centred popup. 3. Tap "New QR".
EXPECTED  No popup on a popup: the confirm replaces the ticket view, or the ticket view's buttons act without a second layer.
ACTUAL    `GuestMoreMenu` (New QR · Unlink account) is passed as the ticket view's `tools`, and its confirm is a second `GuestPopup kind="confirm"` mounted while the ticket `GuestPopup` is still open. On a phone that is three layers: card `InspectorSheet` → ticket popup → confirm. The card's "Delete guest" confirm (`GuestDeleteControl` → `OpenDeleteGuestSheet`) is likewise a popup over the card sheet. Code: `apps/web/app/dashboard/[eventId]/guests/_components/guest-ticket-parts.tsx` · `{open && mounted ? (` + `{tools ? (` and `{confirm !== null ? (\n      <GuestPopup kind="confirm"`; `guest-card-body.tsx` · `tools={more}`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      SHAPE (never a popup on a popup)
SEVERITY  look
SOURCE    CODE
```

#### A2-D5 · Hand-typed shadows and white fills on guest layers
```
PAGE      /dashboard/[eventId]/guests · /dashboard/[eventId]/guests/[guestId] · /dashboard/[eventId]/guests/checkin   (event: Bea & Paolo)
BUTTON    — (the ticket view, the confirm box, the invite menu, the desk's "Next" button)
STEPS     1. Switch to dark. 2. Open a guest's ticket, a New QR confirm, the invite menu; on the desk scan a declined code.
EXPECTED  K2: no shadows and no white surfaces in dark; no raw colour in a component (tokens by job).
ACTUAL    Shadows with raw rgba and no dark variant: `CONFIRM_PANEL` `shadow-[0_24px_60px_-20px_rgba(26,26,26,0.45)]` and the ticket panel `shadow-[0_30px_80px_-30px_rgba(26,26,26,0.5)]`; `Popover` `shadow-lg`; `GuestPeek` `shadow-lg`. White fills: the invite menu's manual-copy `<textarea className="… bg-white dark:bg-raised …">` and the desk's declined-verdict button `className="… rounded-xl bg-white dark:bg-raised … shadow-sm"` (a hand-made button too, not `ActionButton`). Code: `apps/web/app/dashboard/[eventId]/guests/_components/guest-popup.tsx` · `CONFIRM_PANEL`; `guest-ticket-parts.tsx` · `shadow-[0_30px_80px_-30px_rgba(26,26,26,0.5)]`; `guest-invite-cell.tsx` · `bg-white dark:bg-raised p-2`; `checkin/_components/checkin-desk.tsx` · `{DOOR_WORDS.next}`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part K2 · design-and-wiring D13
SEVERITY  look
SOURCE    CODE
```


#### A2-D7 · Add forms print raw database errors
```
PAGE      /dashboard/[eventId]/guests/new · /guests/quick · /guests/import   (event: Bea & Paolo)
BUTTON    "Save guest" · "Upload to guest list" · "Add N guests"
STEPS     1. Submit a form while the insert is refused (RLS, expired session, constraint).
EXPECTED  One plain sentence plus Try again, as the guest list already does (`plainRefusal`, held by `a-host-never-reads-database-words.test.ts`).
ACTUAL    The database's text reaches the screen. /new: the action redirects `?error=${encodeURIComponent(friendly)}` where `friendly = … (error?.message ?? 'insert_failed')`, and `'plus_one_failed: ' + nameErr.message`; the page shows `ERROR_COPY[rawError] ?? rawError`. /quick: `?error=${encodeURIComponent(error.message)}`, shown by `ERROR_COPY[errorKey] ?? decodeURIComponent(errorKey)`. /import: `` `We could not add them: ${insertErr.message}` ``. E.g. "new row violates row-level security policy for table "guests"". Code: `apps/web/app/dashboard/[eventId]/guests/new/actions.ts` · `(error?.message ?? 'insert_failed')`; `new/page.tsx` · `ERROR_COPY[rawError] ?? rawError`; `quick/actions.ts` · `encodeURIComponent(error.message)`; `import/actions.ts` · `We could not add them:`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §3 Toast ("failure gives a plain reason plus Try again")
SEVERITY  wrong
SOURCE    CODE
```

#### A2-D8 · Four guest pages hand-roll their title
```
PAGE      /dashboard/[eventId]/guests/new · /guests/quick · /guests/import · /guests/checkin   (event: Bea & Paolo)
BUTTON    —
STEPS     1. Open each page.
EXPECTED  `PageMasthead` on every page (CLAUDE.md §3), as /guests and /claims do.
ACTUAL    Each draws its own `<h1 className="text-3xl font-semibold tracking-tight …">` ("Add a guest", "List your guests, one row at a time.", "Import guests from a file") or `<h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">` with a QrCode icon ("Check-in desk"), plus a hand-made back link in a different style on each (`font-mono text-xs uppercase`, `rounded-md bg-ink/5`, `text-sm text-ink/60`). `lint:masthead` only catches an eyebrow above an h1, so it passes. Code: `apps/web/app/dashboard/[eventId]/guests/new/page.tsx` · `Add a guest</h1>`; `quick/page.tsx` · `List your guests, one row at a time.`; `import/page.tsx` · `Import guests from a file`; `checkin/page.tsx` · `<QrCode className="h-6 w-6 text-terracotta" /> Check-in desk`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §3 (Page title) · design-and-wiring A2
SEVERITY  look
SOURCE    CODE
```

#### A2-D9 · The add forms are pages, not full-screen popups
```
PAGE      /dashboard/[eventId]/guests/new · /guests/quick · /guests/import   (event: Bea & Paolo)
BUTTON    "Add full guest" (from /quick) · "Import a file" (Guests › + › Add another way) · the /new links on Tea ceremony and Event Hub widgets
STEPS     1. From Guests, open Import a file (or any door to /new, /quick).
EXPECTED  SHAPE tests: nobody shares or returns to an add form by link (test 1 fails); each is more than one short screen (/new ~15 fields; /quick a growing row list; /import download → upload → preview) → FULL-SCREEN POPUP (`RiseScreen`/`RiseRoute`) over Guests, ✕ back to the same place.
ACTUAL    All three are plain routes with their own back links (`‹ Back to guest list`); the add sheet pushes to /import (`push(\`/dashboard/${eventId}/guests/import\`)`). Code: `apps/web/app/dashboard/[eventId]/guests/_components/add-guest-sheet.tsx` · `openAddWay`; `new/page.tsx` · `export default async function NewGuestPage`; `quick/page.tsx` · `QuickAddGuestsPage`; `import/page.tsx` · `ImportGuestsPage`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      SHAPE
SEVERITY  look
SOURCE    CODE
```

#### A2-D10 · Quick add page has no way in
```
PAGE      /dashboard/[eventId]/guests/quick   (event: Bea & Paolo)
BUTTON    —
STEPS     1. Look for any menu, row or link that opens /guests/quick.
EXPECTED  A page is registered and reachable (design-and-wiring A3), or retired when its job moved (owner 2026-10-27: "Paste many names" left; the search box adds).
ACTUAL    The Ugat map lists it as `"route":"/dashboard/[eventId]/guests/quick", … "status":"no-door"` with `"doors":[]`; the only code reference is the unused builder `quick: (eventId: string) => \`/dashboard/${eventId}/guests/quick\`` in lib/routes.ts. It still writes guests (`bulkAddGuests`) with no finalized-list pre-check (only the DB trigger stops it), and links on to /new and /import. Code: `apps/web/lib/ugat/screens.generated.json` · `"status":"no-door"`; `apps/web/app/dashboard/[eventId]/guests/quick/page.tsx` · `QuickAddGuestsPage`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring A3 (registered and reachable) · D11 (one source of truth)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-D11 · Import shows two main buttons
```
PAGE      /dashboard/[eventId]/guests/import   (event: Bea & Paolo; an account past the 19 Dec gate or exempt)
BUTTON    "Download for Excel / Numbers" · "Check the file"
STEPS     1. Open Import guests from a file.
EXPECTED  K1: one main button per screen; the other steps down to neutral.
ACTUAL    Both are `button-primary` (filled accent) on the same screen: `<SaveFileLink … className="button-primary inline-flex items-center gap-1.5">` in step 1 and `Submit` → `<button type="submit" className="button-primary">` ("Check the file") in step 2. Code: `apps/web/app/dashboard/[eventId]/guests/import/page.tsx` · `className="button-primary inline-flex items-center gap-1.5"`; `import/import-form.tsx` · `function Submit`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE
```

#### A2-D12 · Request card ranks Accept and Link both in accent
```
PAGE      /dashboard/[eventId]/guests/claims (also drawn in place in Guests › Asking to join)   (event: Bea & Paolo)
BUTTON    "Accept" · "Link" · "Add to my list"
STEPS     1. Have a request waiting. 2. Look at one request row. 3. Open Accept.
EXPECTED  K1: one main per card; the other is neutral, never accent-outlined.
ACTUAL    Accept and Link are both `actionButtonClass('brand', …)`. One gets `main`, the other is the non-main brand look, which is accent-outlined on an accent wash (`.ab` = `border … rgb(var(--ab-tone)) 45%` + `9%` wash). Opening Accept (when it is the main) then adds a third accent button, `<SubmitButton className="button-primary">` "Add to my list", under the still-filled Accept. Code: `apps/web/app/dashboard/[eventId]/guests/claims/page.tsx` · `actionButtonClass('brand', { main: !match })`, `actionButtonClass('brand', { main: Boolean(match) })`, `Add to my list`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE
```

#### A2-D13 · Check-in desk shows "0 / 0 attending" on a failed read
```
PAGE      /dashboard/[eventId]/guests/checkin   (event: Bea & Paolo, on the day)
BUTTON    — (the "Arrived N / M attending" headcount)
STEPS     1. Open the desk while the guests read is refused (signal drop at the venue, RLS, timeout).
EXPECTED  The headcount says it could not be read ("—"), never a confident 0. The house test does not cover this page.
ACTUAL    The error is logged and a `ReadRefusedNotice partial` is drawn, but `roster = (guestsRaw ?? [])` → `expected = 0`, and the same is true of `checkinsRaw ?? []` → arrived 0. The desk still prints "0 / 0 attending" with an empty bar, and `DOOR_WORDS.checkedLive(…, checkedCount, expected)` repeats the zeros after a scan. A name search finds nobody. Code: `apps/web/app/dashboard/[eventId]/guests/checkin/page.tsx` · `const roster = (guestsRaw ?? []) as GuestRow[];`, `const expected =`; `checkin/_components/checkin-desk.tsx` · `{expected} attending`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-D14 · Desk reads "booked" from a second copy of the list
```
PAGE      /dashboard/[eventId]/guests/checkin (Suppliers part)   (event: Bea & Paolo)
BUTTON    — (the suppliers on the arrivals board)
STEPS     1. Open the desk › Suppliers.
EXPECTED  Booked = `BOOKED_EVENT_VENDOR_STATUSES` from `lib/vendor-funnel.ts` (CLAUDE.md §4).
ACTUAL    The page imports `BOOKED_EVENT_VENDOR_STATUSES` from `@/lib/coordinator-trade`, which declares its own literal `['contracted', 'deposit_paid', 'delivered', 'complete']` rather than re-exporting the vendor-funnel one. Same four values today; a second copy that drifts. Other importers of the copy (outside this group): `vendor-dashboard/on-the-day/page.tsx`, `vendor-dashboard/clients/[eventId]/page.tsx`, `access-requests/page.tsx` and more. Code: `apps/web/lib/coordinator-trade.ts` · `export const BOOKED_EVENT_VENDOR_STATUSES: readonly string[] =`; `apps/web/app/dashboard/[eventId]/guests/checkin/page.tsx` · `import { BOOKED_EVENT_VENDOR_STATUSES } from '@/lib/coordinator-trade';`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §4 / design-and-wiring C8
SEVERITY  wrong
SOURCE    CODE
```

#### A2-D15 · Desk shows two main buttons at once
```
PAGE      /dashboard/[eventId]/guests/checkin   (event: Bea & Paolo, on the day)
BUTTON    "Scan a guest's QR" · "Mark arrived" · "Read a guest's tag" · "Open in Guest List → Pending"
STEPS     1. Search a guest's name and pick them (or scan a pending code).
EXPECTED  K1: one main per screen.
ACTUAL    "Scan a guest's QR" (`ActionButton tone="brand" main`) stays drawn while the picked guest shows "Mark arrived" (`ActionButton tone="brand" main`), in the same column on a phone. A pending scan adds a third filled accent link (`actionButtonClass('brand', { main: true })`, "Open in Guest List → Pending"). The NFC button is `actionButtonClass('info', …)`, a second bright colour. Code: `apps/web/app/dashboard/[eventId]/guests/checkin/_components/checkin-desk.tsx` · `label="Scan a guest’s QR"`, `label="Mark arrived"`, `actionButtonClass('info', { extra: 'my-2 w-full' })`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE
```

#### A2-D16 · Desk shows a raw reply word ("RSVP'd pending")
```
PAGE      /dashboard/[eventId]/guests/checkin   (event: Bea & Paolo, on the day)
BUTTON    — (the badge on the arriving guest)
STEPS     1. Pick a guest who has not replied, or replied maybe or no.
EXPECTED  The reply in the house words (`RSVP_LABELS` / the list's reply words).
ACTUAL    `<Badge tone="wait">RSVP&rsquo;d {selected.rsvpStatus}</Badge>` prints the database value: "RSVP’d pending", "RSVP’d maybe", "RSVP’d declined". Code: `apps/web/app/dashboard/[eventId]/guests/checkin/_components/checkin-desk.tsx` · `RSVP&rsquo;d {selected.rsvpStatus}`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      brand.md word rules (no database words to a person)
SEVERITY  wrong
SOURCE    CODE
```

### Suppliers (group G)

#### A2-G1 · Build "Ask to book" and Compare "book" shown to the coordinator
```
PAGE      /dashboard/[eventId]/vendors   (event: Bea & Paolo, viewed as the booked coordinator)
BUTTON    "Ask to book" (Build body line) · "book" (Compare, saved build row)
STEPS     1. Sign in as the event's coordinator. 2. Open Suppliers → Build. 3. A priced pick shows "Ask to book"; Compare shows "book" on a saved build. 4. Press it.
EXPECTED  A non-host sees no Book or Pay control (owner 21 Nov "no booking, no paying"; the page itself wraps everything in `ViewerBooksProvider books={viewer.isCouple}`).
ACTUAL    Only three components read the screen gate: `booked-row.tsx`, `book-this-build.tsx`, `bench-vendor-actions.tsx` (`useViewerBooks`). `build-body.tsx` draws `AccordionLockButton label="Ask to book"` whenever `askable(line)` is true, and `build-compare.tsx` draws the `aria-label={\`Book ${c.title}\`}` button calling `onApply(c.snapshot, 'lock', …)`, with no `useViewerBooks()` check. `buildBody` and `compareSlot` are passed to `ServicesTakeover` for every viewer. The server refuses (`coordinatorMoneyScopeAllowed` → `ONLY_A_HOST_BOOKS`), so the coordinator gets a main-coloured button whose only result is a refusal. Code: `apps/web/app/dashboard/[eventId]/vendors/_components/build-body.tsx` · `label="Ask to book"`; `.../_components/build-compare.tsx` · `aria-label={\`Book ${c.title}\`}`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §4 "Only a host books or pays" · design-and-wiring B5 (every press reaches a real action)
SEVERITY  broken
SOURCE    CODE
```

#### A2-G2 · Peso figures formatted by hand, not lib/php.ts
```
PAGE      /dashboard/[eventId]/vendors   (event: Bea & Paolo)
BUTTON    — (Build, Compare, Quote fill, reservation-terms and first-payment popups, Book again, remove-supplier refusal)
STEPS     1. Open Suppliers. 2. Look at the peso figures on Build / Compare / quote fill, and the first-payment and reservation-terms popups. 3. Try to remove a supplier with a logged payment.
EXPECTED  Every peso figure goes through `formatPhp` / `formatPhpRounded` (`lib/php.ts`), and an unknown amount never prints ₱0.
ACTUAL    Seven hand-made formatters: `_components/accordion-build.tsx` · `` `₱${Math.round(php).toLocaleString('en-PH')}` ``; `_components/quote-fill.tsx` (same); `_components/build-compare.tsx` (same); `_components/build-locked.tsx` · `const peso = (centavos: number) => \`₱${Math.round((centavos ?? 0) / 100)…` (a null coerces to ₱0; it draws the "Committed" tile and the "Book your build" total); `_components/accordion-lock.tsx` · `₱{minimumAmountPhp.toLocaleString('en-PH')}` and `` `₱${Math.round(policy.downpayment_amount_php).toLocaleString('en-PH')}` ``; `_components/reuse-bookings-panel.tsx` · `function peso(n` with `Intl.NumberFormat`; `vendors/actions.ts` · `(₱${total.toLocaleString('en-PH')})` in `refusalForLoggedPayments`, which also sums `event_vendor_payments.amount_php` itself.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §1 "Format money only through apps/web/lib/php.ts" · design-and-wiring C8
SEVERITY  money-signin
SOURCE    CODE
```

#### A2-G3 · "Your team" Committed and Buffer use their own sum
```
PAGE      /dashboard/[eventId]/vendors   (event: Bea & Paolo, 2+ booked suppliers, one with a change order or line items)
BUTTON    — ("Committed" / "Buffer" tiles in BuildLocked)
STEPS     1. Open Suppliers on the Build view that draws `BuildLocked`. 2. Note Committed / Buffer. 3. Open Budget and compare with Agreed / what is left.
EXPECTED  The committed money comes from the ONE reader, `resolveEventMoney` (`lib/budget-truth.ts`), as the Booked tab's own budget block does (`booked-slot.tsx` · `resolveEventMoneySettled`).
ACTUAL    `BuildLocked` draws `peso(model.chosenCentavos)` and a Buffer from `teamMoney` (`lib/your-team.ts`), where `chosenCentavos` is summed in `lib/vendors-plan-budget.ts` (`chosenCentavos += child.lockedTotal`) from the rows' `total_cost_php`. That is a second money reader. PLAUSIBLE that it disagrees with Budget whenever line items, overpayment or a hidden amount are involved; which branch is live depends on the build flag (`buildBody` vs `buildSlot`), so a browser walk must confirm the two numbers. Code: `apps/web/app/dashboard/[eventId]/vendors/_components/build-locked.tsx` · `<LockTile k="Committed" v={peso(model.chosenCentavos)} accent />`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §4 Budget row (one reader) · design-and-wiring C8
SEVERITY  money-signin
SOURCE    CODE
```

#### A2-G4 · Payment record says "Downpayment … awaiting vendor confirmation"
```
PAGE      /dashboard/[eventId]/vendors (written here) → shown on the budget's supplier itemisation card   (event: Bea & Paolo)
BUTTON    "Book & submit first payment" / record a reservation fee
STEPS     1. Book a supplier with a first payment from Suppliers. 2. Open Budget (or event home) → that supplier's payments.
EXPECTED  The person reads "reservation fee" and "supplier".
ACTUAL    The action writes the payment row's `notes` as a sentence, and `vendor-itemization-card.tsx` prints `p.notes` as the payment's line. Code: `apps/web/app/dashboard/[eventId]/vendors/actions.ts` · `notes: 'Downpayment (lock · awaiting vendor confirmation)'` and `notes: 'Deposit (date held · awaiting vendor confirmation)'`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      brand.md word rules (supplier, reservation fee)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-G5 · Booked statuses hand-copied instead of BOOKED_EVENT_VENDOR_STATUSES
```
PAGE      /dashboard/[eventId]/vendors · /dashboard/[eventId]/vendors/[vendorId]/review   (event: Bea & Paolo)
BUTTON    —
STEPS     Code read only. They agree today; they drift the day one changes.
EXPECTED  "Booked" is read from `BOOKED_EVENT_VENDOR_STATUSES` (`lib/vendor-funnel.ts`).
ACTUAL    Six local copies of `['contracted','deposit_paid','delivered','complete']`: `vendors/page.tsx` · `const PLAN_LOCKED = new Set(`; `_components/plan-budget-accordion.tsx` · `const LOCKED = new Set(`; `_components/build-locked.tsx` · `const LOCKED = new Set(`; `build-3state-actions.ts` · `COMMITTED_STATUSES`; `_actions/reuse-actions.ts` and `[vendorId]/review/page.tsx` + `review/actions.ts` · `.in('status', ['contracted', 'deposit_paid', 'delivered', 'complete'])`. Two more named twins are used on these pages: `CONFIRMED_VENDOR_STATUSES` (`lib/events.ts`) and `LOCKED_VENDOR_STATUSES` (`lib/shortlist-taxonomy.ts`). The two copies that already DIFFER are A2-G9 and A2-G16.
SHOTS     none
RULE      CLAUDE.md §4 Supplier booking row · design-and-wiring C8 (a second copy is a defect even when it agrees)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-G6 · Filter sheet opens over the full-screen search, own scrim
```
PAGE      /dashboard/[eventId]/vendors   (event: Bea & Paolo)
BUTTON    "Filter" (inside "Add <category> to your plan" search)
STEPS     1. Suppliers → open a category's search (the full-screen `.csov` overlay). 2. Press Filter.
EXPECTED  One layer at a time on the shared backdrop (`OverlayBackdrop` + `useModalA11y`); never a popup on a popup.
ACTUAL    The filter `role="dialog"` sheet (`.fsheet`) opens on top of the full-screen `role="dialog"` search, over a hand-made scrim `<div className="fscrim sn-popup-dark" aria-hidden onClick=…>`, not `OverlayBackdrop`. Code: `apps/web/app/dashboard/[eventId]/vendors/_components/category-search-overlay.tsx` · `aria-label="Filter suppliers"`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part K3 · SHAPE (never a popup on a popup)
SEVERITY  look
SOURCE    CODE
```

#### A2-G7 · Pay sheet's QR opens a second popup over the sheet
```
PAGE      /dashboard/[eventId]/vendors   (event: Bea & Paolo, a self-added supplier with a QR pay way)
BUTTON    "<method> QR — tap to see it full size"
STEPS     1. Suppliers → Booked → Pay on a self-added supplier (the `Sheet`). 2. Tap the QR thumbnail.
EXPECTED  No popup on a popup: enlarge in place inside the sheet, or move the sheet to a full screen.
ACTUAL    `OwnPayWays` (drawn inside `PaySheet`'s `<Sheet open … rise>`) opens a `GuestPopup` (`rootClassName="fixed inset-0 z-[96] …"`) on top of the open sheet. Code: `apps/web/app/dashboard/[eventId]/vendors/_components/own-pay-ways.tsx` · `onClick={() => setBig(w)}`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      SHAPE (never a popup on a popup) · HOUSE_DESIGN_STANDARD Part K3.4
SEVERITY  look
SOURCE    CODE
```

#### A2-G8 · Booking popups carry raw-rgba drop shadows
```
PAGE      /dashboard/[eventId]/vendors   (event: Bea & Paolo)
BUTTON    — (every booking-flow popup: reservation terms, first payment, slot, confirm; the pay-QR popup)
STEPS     1. Dark mode. 2. Start a booking that needs a first payment. 3. Look at the popup's edge.
EXPECTED  Dark has no shadows and no raw colour; popups use tokens.
ACTUAL    `LockPopup` panel: `shadow-[0_24px_60px_-20px_rgba(0,0,0,.5)]` (`_components/lock-milestone.tsx` · `export function LockPopup`); pay-QR panel: `shadow-[0_30px_80px_-30px_rgba(26,26,26,0.5)]` (`_components/own-pay-ways.tsx` · `panelClassName=`).
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part K2.1 · design-and-wiring D13 (no raw colour)
SEVERITY  look
SOURCE    CODE
```

#### A2-G9 · Find: a contracted supplier still offers "Ask for a quote"
```
PAGE      /dashboard/[eventId]/vendors/categories?c=<tile>   (event: Bea & Paolo, a supplier in status contracted)
BUTTON    "Ask for a quote" / "Save to bench"
STEPS     1. Book a supplier to `contracted` (not yet paid). 2. Find a supplier → open that category.
EXPECTED  The header and the row agree: the booked supplier's row says "Booked · Open chat".
ACTUAL    The header uses `openTile.booked` (from `readFindList`, `LOCKED_VENDOR_STATUSES`, includes contracted) → "Booked ✓". The row uses `r.relationshipDepth === 3`, and `searchCategoryVendors` sets depth 3 only for `s === 'deposit_paid' || s === 'complete'`, so a contracted or delivered supplier gets Save + "Ask for a quote" under a "Booked ✓" header. Code: `apps/web/app/dashboard/[eventId]/vendors/categories/page.tsx` · `const isBooked = r.relationshipDepth === 3`; `apps/web/app/dashboard/[eventId]/vendors/_actions/category-search.ts` · `s === 'deposit_paid' || s === 'complete'`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §4 booked = BOOKED_EVENT_VENDOR_STATUSES
SEVERITY  wrong
SOURCE    CODE
```

#### A2-G10 · Find: a failed category search reads "0 suppliers"
```
PAGE      /dashboard/[eventId]/vendors/categories?c=<tile>   (event: Sofia's 18th)
BUTTON    —
STEPS     1. Open a category while its search read is refused (event read, picks read or recommendations read fails). 2. Look at the count and the list.
EXPECTED  "Couldn't load suppliers" plus Try again, never "0 suppliers" / none listed.
ACTUAL    `searchCategoryVendors` returns `{ ...EMPTY, unreadable: true }` on a refused read, but the page never reads `res.unreadable`: it prints `` `${formatCount(rows.length)} suppliers` `` (0) and `findEmptyWords(…)` ("none listed"). The page checks `unreadable` only for the shops-by-name search (`shopsRead.unreadable`). Code: `apps/web/app/dashboard/[eventId]/vendors/categories/page.tsx` · `const empty = findEmptyState({`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-G11 · Find: a shop with no slug links to "#"
```
PAGE      /dashboard/[eventId]/vendors/categories?q=<shop name>   (event: Bea & Paolo)
BUTTON    the shop row under "Suppliers"
STEPS     1. Find a supplier → type a shop's name. 2. Tap a shop whose `business_slug` is null.
EXPECTED  Every row reaches the shop, or is not a link.
ACTUAL    `href={r.slug ? shopHrefForEvent(r.slug, eventId) : '#'}`, and `slug` is `business_slug ?? null` in `bench-marketplace-search.ts`. PLAUSIBLE that no listed shop lacks a slug today; the code still draws a dead link if one does. Code: `apps/web/app/dashboard/[eventId]/vendors/categories/page.tsx` · `: '#'`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring B5 (no href="#")
SEVERITY  broken
SOURCE    CODE
```

#### A2-G12 · "Release this package" un-books paid suppliers with no check
```
PAGE      /dashboard/[eventId]/vendors/packages/[bookingId]   (event: Bea & Paolo, a locked package with a first payment made)
BUTTON    "Release this package"
STEPS     1. Lock a package, then pay its reservation fee (supplier row reaches deposit_paid). 2. Open the package page. 3. Press "Release this package".
EXPECTED  The same rule as cancelling a booking: money that moved stops the release, or it goes to the dispute path (`cancelBookingAsHost` gates on `bookingMoneyMoved`); an irreversible step asks once.
ACTUAL    One press, no confirm. `releasePackage` sets every `event_vendors` row of the booking to `status: 'considering'` with `.eq('event_vendor_package_id', bookingId)` and no status or money filter, then marks the booking released. A deposit_paid/delivered supplier silently leaves Booked, the coordinator's seat and the budget's agreed money, and the supplier is not told. PLAUSIBLE budget effect (agreed drops while paid stays); a browser walk must confirm. Code: `apps/web/app/dashboard/[eventId]/vendors/packages/actions.ts` · `export async function releasePackage` · `.update({ status: 'considering' })`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §4 Supplier booking row (one booked state drives budget, supplier view, coordinator seat) · CLAUDE.md §3 Floating surface "Confirm only for the irreversible"
SEVERITY  money-signin
SOURCE    CODE
```

#### A2-G13 · Review page says "Vendor Agreement"
```
PAGE      /dashboard/[eventId]/vendors/[vendorId]/review   (event: Lolo Ben at 80, a delivered supplier)
BUTTON    —
STEPS     1. Open "Leave a review" for a delivered supplier. 2. Read the line under the title (and the already-reviewed state).
EXPECTED  "supplier", never "vendor", in words a person reads.
ACTUAL    "They’re permanent per the Vendor Agreement § 3.10" and "Reviews are one-per-event per the Vendor Agreement § 3.10". Code: `apps/web/app/dashboard/[eventId]/vendors/[vendorId]/review/page.tsx` · `per the Vendor Agreement`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      brand.md word rules
SEVERITY  wrong
SOURCE    CODE
```

#### A2-G14 · A failed contracts read shows "No contracts yet" / 404
```
PAGE      /dashboard/[eventId]/contracts · /dashboard/[eventId]/contracts/[contractId]   (event: Bea & Paolo, one sent contract)
BUTTON    —
STEPS     1. Open Supplier contracts while the `vendor_contracts` read is refused. 2. Open one contract while its read is refused.
EXPECTED  "Couldn't load your contracts" + Try again; the detail says it could not be read, not "not found".
ACTUAL    `fetchEventContracts` returns `[]` on error, so the list shows `ContractsEmptyState` "No contracts yet. Suppliers will upload PDFs here…". `fetchContract` returns null on error, so the detail page calls `notFound()`. `lib/contracts.ts` already has the honest `readContract` (`{ failed: true }`) that the supplier side uses. Code: `apps/web/lib/contracts.ts` · `fetchEventContracts` / `fetchContract`; `apps/web/app/dashboard/[eventId]/contracts/page.tsx` · `message="No contracts yet.`; `.../contracts/[contractId]/page.tsx` · `if (!contract || contract.event_id !== eventId) notFound();`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-G15 · A failed disputes read shows "No disputes on record"
```
PAGE      /dashboard/[eventId]/disputes   (event: Bea & Paolo, one open flag)
BUTTON    —
STEPS     1. Open Disputes while the `force_majeure_flags` read is refused.
EXPECTED  "Couldn't load your disputes" + Try again, not an empty record.
ACTUAL    `const flags = (flagsRes.data ?? []) as FlagRow[];` with `flagsRes.error` never checked, so it shows "Existing flags (0)" and "No disputes on record. Open one above…". The same goes for the supplier list (`vendorsRes.data ?? []` → "No contracted suppliers yet."). Code: `apps/web/app/dashboard/[eventId]/disputes/page.tsx` · `flagsRes.data ?? []`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-G16 · Disputes uses its own supplier status list
```
PAGE      /dashboard/[eventId]/disputes   (event: Bea & Paolo, a supplier in status complete)
BUTTON    "Affects which supplier?"
STEPS     1. Have one supplier at `complete` and one only `shortlisted`. 2. Open Disputes → Open a new dispute → the supplier picker. 3. Look at an existing flag about the complete supplier.
EXPECTED  The picker lists the booked suppliers (`BOOKED_EVENT_VENDOR_STATUSES`).
ACTUAL    `.in('status', ['contracted', 'deposit_paid', 'delivered', 'shortlisted'])`: it adds a supplier that is only shortlisted and drops a `complete` one, which is the supplier most likely to need an after-event dispute. A flag already filed about a `complete` supplier has no match in `vendorById`, so `FlagCard` says "Whole event". The picker label also shows the raw status (`v.status.replace(/_/g, ' ')` → "deposit paid", "shortlisted"). Code: `apps/web/app/dashboard/[eventId]/disputes/page.tsx` · `'shortlisted'])`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §4 booked = BOOKED_EVENT_VENDOR_STATUSES
SEVERITY  wrong
SOURCE    CODE
```

#### A2-G17 · "Close out the day" reports success when the save failed
```
PAGE      /dashboard/[eventId]/clearance   (event: Bea & Paolo, after the day)
BUTTON    "Close out the day"
STEPS     1. Press "Close out the day" while the `events` update fails.
EXPECTED  A plain reason plus Try again; the page stays.
ACTUAL    `closeOutTheDay` logs the update error (`logQueryError(… 'graceful_degrade')`) and then always `redirect(\`/dashboard/${eventId}\`)`, the same landing as success. The event stays un-cleared with nothing said. Code: `apps/web/app/dashboard/[eventId]/clearance/actions.ts` · `logQueryError('closeOutTheDay (events update)'`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring B6 (a failure must render as a failure)
SEVERITY  broken
SOURCE    CODE
```

#### A2-G18 · "Stop the livestream" opens the Event Hub Maker
```
PAGE      /dashboard/[eventId]/clearance   (event: Bea & Paolo)
BUTTON    "Stop the livestream"
STEPS     1. Open Close out the day. 2. Press "Stop the livestream".
EXPECTED  Lands on the live controller where the broadcast is ended (`liveStudioControllerHref(eventId)`, the same door `launch/page.tsx` gives "Go live").
ACTUAL    `href: \`${base}/launch\``. `/launch` is the Event Hub Maker (`metadata = { title: 'Event Hub Maker' }`), which only lists "Live Watch — livestream" with a "Go live" button, one more hop away. PLAUSIBLE the host can still find it; a walk must confirm. Code: `apps/web/app/dashboard/[eventId]/clearance/page.tsx` · `{ label: 'Stop the livestream', href: \`${base}/launch\``.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring B5 (a real destination)
SEVERITY  broken
SOURCE    CODE
```

#### A2-G19 · Irreversible close-out has no confirm
```
PAGE      /dashboard/[eventId]/clearance   (event: Bea & Paolo)
BUTTON    "Close out the day"
STEPS     1. Press "Close out the day" once.
EXPECTED  The page itself says "It can’t be undone from here", so one confirm sheet asks first (confirm only for the irreversible).
ACTUAL    A plain `<form action={closeOutTheDay.bind(null, eventId)}>` submits on the first press. It flips the whole event menu Day-of → After and stamps `cleared_at`. Code: `apps/web/app/dashboard/[eventId]/clearance/page.tsx` · `pendingLabel="Closing out…"`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §3 Floating surface "Confirm only for the irreversible"
SEVERITY  look
SOURCE    CODE
```

### Chat and event details (group H)

#### A2-H1 · "Suppliers" chip shows exactly the All list
```
PAGE      /dashboard/[eventId]/messages   (event: Bea & Paolo)
BUTTON    "Suppliers"
STEPS     1. Open Chats. 2. Tap All, note the rows. 3. Tap Suppliers.
EXPECTED  Suppliers narrows the list (for example, hides the Groups section), or the chip is not offered.
ACTUAL    The chip only changes its pressed state. `shown` filters on `filter === 'unread'` alone, so 'suppliers' draws the same rows as 'all'. The server-rendered Groups section (`EventGroups`) stays above under every chip. Code: `apps/web/app/dashboard/[eventId]/messages/_components/chat-inbox.tsx` · `rows.filter((r) => (filter === 'unread' ? r.unread : true))` · `chip('suppliers', peerFilter)`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring B5 (every press reaches a real action)
SEVERITY  broken
SOURCE    CODE
```

#### A2-H2 · Decisions show payment amounts to a money-hidden viewer
```
PAGE      /dashboard/[eventId]/messages/[threadId]   (event: Bea & Paolo, viewed by a coordinator/helper without Budget & payments)
BUTTON    — (Decisions list / pinned "waiting" payment rows)
STEPS     1. Sign in as a coordinator or helper whose money is hidden (`chat_money_hidden` = true). 2. Open a booked supplier's thread where a payment was logged. 3. Open Decisions, or look at the pins.
EXPECTED  Every amount reads "₱ — hosts only", like the stream (`moneyHidden`). Booking amounts are read only through `event_vendor_money_read` on a session.
ACTUAL    `decisionPayments` comes from `fetchThreadPayments`, which reads `event_vendors.total_cost_php` and `event_vendor_payments.amount_php` with the ADMIN client. That bypasses the per-column close in `lib/event-vendor-money.ts`. The amounts are passed to the stream whatever the viewer, and `threadDecisionFacts`/`buildThreadDecisions` print them (`formatPhp(p.amountPhp)`, `${formatPhp(p.amountPhp)} of ${formatPhp(p.ofTotalPhp)}`). `pinsFromDecisions` pins a "waiting" payment with that title. Only `initialMessages` is masked when `chatPins.streamMasked`. PLAUSIBLE also: the standing line "Quoted ₱X" (`fetchLiveQuoteTotalPhp`, session read of `vendor_proposals.total_centavos`) is not masked either; a browser walk as a money-hidden coordinator must confirm. Code: `apps/web/app/dashboard/[eventId]/messages/[threadId]/page.tsx` · `fetchThreadPayments({ adminClient: decisionAdmin` · `decisionPayments={decisionPayments}`; `apps/web/lib/thread-decision-sources.server.ts` · `.select(\`vendor_id, total_cost_php,`; `apps/web/lib/thread-decisions.ts` · `formatPhp(p.amountPhp)`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §4 (amounts only via event_vendor_money_read) · §5 rule 4
SEVERITY  money-signin
SOURCE    CODE
```

#### A2-H3 · Book and "Amount to pay" shown to non-hosts in thread
```
PAGE      /dashboard/[eventId]/messages/[threadId]   (event: Bea & Paolo, viewed by the coordinator or a helper)
BUTTON    "Book" (quote card lock) · the deposit "Amount to pay" card
STEPS     1. As the event's coordinator (or a helper), open a thread with an accepted quote / a booked supplier. 2. Look at the quote card and the payment card. 3. Press Book or record a payment.
EXPECTED  Only a host books or pays. A non-host sees no Book/Pay button, only the coordinator's verbs ("remind the hosts").
ACTUAL    The page never asks the viewer's role. It passes `lockTarget={quoteLockTarget}` and `couplePay` for every viewer, with `viewerRole="couple"` hard-wired, so the stream mounts `AccordionLockButton` and `DepositReservation` (`viewerRole === 'couple' && couplePay`). The server refuses afterwards: `finalizeVendor`/`recordDeposit` → `coordinatorMoneyScopeAllowed` → `ONLY_A_HOST_BOOKS` / `ONLY_A_HOST_PAYS`. That is a button that is refused on every press. A non-host reaching this page is PLAUSIBLE (the page's own comments say a coordinator whispers here); a browser walk as the coordinator must confirm. Code: `apps/web/app/dashboard/[eventId]/messages/[threadId]/page.tsx` · `lockTarget={quoteLockTarget}` · `couplePay={couplePay}` · `viewerRole="couple"`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §4 ("Only a host books or pays") · design-and-wiring B5
SEVERITY  broken
SOURCE    CODE
```

#### A2-H4 · Chat box does not mark the phone key "Send"
```
PAGE      /dashboard/[eventId]/messages/[threadId]   (event: Bea & Paolo)
BUTTON    the message box (phone keyboard's Enter key)
STEPS     1. On a phone, open a thread. 2. Tap the message box. 3. Look at the keyboard's Enter key.
EXPECTED  `enterKeyHint="send"` on the box (D3), because Enter now sends on every device (`shouldSendOnEnter`, "one rule for every device").
ACTUAL    The composer textarea sets no `enterKeyHint`, so the phone keyboard shows "return" while Enter sends. A stale comment in the same file still says "the phone's Enter is a new line". Enter-sends and Shift+Enter-new-line are correct (IME composing is exempt). Code: `apps/web/app/_components/chat-send-form.tsx` · `shouldSendOnEnter(` (no `enterKeyHint` in the file).
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD D3 (Enter sends, `enterKeyHint="send"`)
SEVERITY  look
SOURCE    CODE
```

#### A2-H5 · A failed gig read says "No open gigs"
```
PAGE      /dashboard/[eventId]/manpower   (event: Bea & Paolo)
BUTTON    —
STEPS     1. Open Manpower while the `manpower_gigs` read is refused. 2. Read the three groups.
EXPECTED  "Couldn't read your gigs" with Try again, never the empty lines.
ACTUAL    `gigsError` is only logged, then `gigs = (gigsRaw ?? [])`, so every group shows its empty line ("No open gigs. Post one above to start.", "No crews are confirmed yet."). The supplier-name read does the same (`vendorsError` → name falls back to 'Supplier'). Code: `apps/web/app/dashboard/[eventId]/manpower/page.tsx` · `const gigs = (gigsRaw ?? []) as ManpowerGigRow[];`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-H6 · Pesos formatted by page-local formatters, not lib/php
```
PAGE      /dashboard/[eventId]/manpower · /dashboard/[eventId]/date-selection (candidate cards)   (event: Bea & Paolo)
BUTTON    — (gig cash amount; candidate "Budget" line)
STEPS     1. Open Manpower with a posted gig, read its cash line. 2. Open Pick your date with candidate dates and suppliers, read the Budget line.
EXPECTED  Every peso through `formatPhp` / `formatPhpRounded` (`lib/php.ts`).
ACTUAL    Manpower defines its own `formatPhp(centavos)` with `toLocaleString('en-PH', { maximumFractionDigits: 0 })`, which rounds centavos away. The candidate picker defines `phpFormat` (`₱${(php / 1_000).toFixed(0)}K`, `₱…M`, bare `toLocaleString()`), and its "—" for `<= 0` does not tell "nothing" from "unread". Code: `apps/web/app/dashboard/[eventId]/manpower/page.tsx` · `function formatPhp(centavos: number)`; `apps/web/app/dashboard/[eventId]/date-selection/_components/candidate-date-picker.tsx` · `function phpFormat(centavos: number)`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §1 / §4 (pesos only via lib/php.ts)
SEVERITY  money-signin
SOURCE    CODE
```

#### A2-H7 · Static cards carry shadows
```
PAGE      /dashboard/[eventId]/manpower · /dashboard/[eventId]/date-selection (candidate cards)   (event: Bea & Paolo)
BUTTON    —
STEPS     1. Open Manpower with a gig; look at a gig row. 2. Open Pick your date with candidates; look at the "best" card and hover any card. 3. Repeat in dark.
EXPECTED  Hairlines on static cards; shadows only on floating layers. In dark, no shadows.
ACTUAL    Each gig `.sn-row` gets `style={{ boxShadow: 'var(--m-shadow-sm)' }}`. Each candidate card has `hover:shadow-md`, and the best one `shadow-sm`. (Not the system `.sn-frame` shadow.) Code: `apps/web/app/dashboard/[eventId]/manpower/page.tsx` · `boxShadow: 'var(--m-shadow-sm)'`; `apps/web/app/dashboard/[eventId]/date-selection/_components/candidate-date-picker.tsx` · `bg-terracotta/[0.04] shadow-sm`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part I.4 · Part K2
SEVERITY  look
SOURCE    CODE
```

#### A2-H8 · Booked read from a second status list
```
PAGE      /dashboard/[eventId]/details · /dashboard/[eventId]/date-selection   (event: Bea & Paolo)
BUTTON    — ("N booked", locked rows, "Booked suppliers"; date-lock gate and candidate narrowing)
STEPS     1. Book a supplier. 2. Open Details (as a helper) and Pick your date.
EXPECTED  Booked = `BOOKED_EVENT_VENDOR_STATUSES` (`lib/vendor-funnel.ts`), the one reader.
ACTUAL    Both pages use `CONFIRMED_VENDOR_STATUSES` from `lib/events.ts`, a separate copy of the same four statuses. It agrees today, but it will drift. Code: `apps/web/app/dashboard/[eventId]/details/page.tsx` · `new Set<string>(CONFIRMED_VENDOR_STATUSES`; `apps/web/app/dashboard/[eventId]/date-selection/page.tsx` · `(CONFIRMED_VENDOR_STATUSES as readonly string[]).includes(v.status)`; `date-selection/actions.ts` · `.in('status', CONFIRMED_VENDOR_STATUSES`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §4 / design-and-wiring C8 (one reader)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-H9 · Details row says "monogram"
```
PAGE      /dashboard/[eventId]/details   (event: Bea & Paolo, viewed by a helper)
BUTTON    "Logo / monogram" (row label)
STEPS     1. Open Event Details as a helper. 2. Open How it looks.
EXPECTED  "Logo" (Logo Maker), never "monogram".
ACTUAL    Code: `apps/web/app/dashboard/[eventId]/details/page.tsx` · `label="Logo / monogram"`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      brand.md word rules (Logo Maker, never Monogram)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-H10 · Helpers get "Put this away" on Details
```
PAGE      /dashboard/[eventId]/details   (event: Bea & Paolo, viewed by a helper / the coordinator)
BUTTON    "Put this away" → "Yes, put Bea & Paolo away"
STEPS     1. Sign in as a view-only helper. 2. Open Event Details. 3. Press Put this away, then Yes.
EXPECTED  The control is shown only to someone who may archive the event. A helper sees nothing, or a plain line.
ACTUAL    Couples are redirected away from this page (`if (viewer.isCouple) redirect(...)`), so only non-couples ever see `PutAwayCard`, which renders unconditionally. A view-only helper gets a pressable button that `setEventArchived` refuses ("Only a host of this event can put it away."). PLAUSIBLE product question: `setEventArchived` counts `member_type` 'coordinator' and edit-level moderators as hosts, so the coordinator can put the couple's event away (cameras and Memory lane go quiet) from this page; the owner should confirm that is meant. Code: `apps/web/app/dashboard/[eventId]/details/page.tsx` · `<PutAwayCard`; `apps/web/app/dashboard/[eventId]/archive-actions.ts` · `.in('member_type', ['couple', 'coordinator'])`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring B5 / B7 (honest controls)
SEVERITY  broken
SOURCE    CODE
```

#### A2-H11 · Details field links drop the field
```
PAGE      /dashboard/[eventId]/details/field/[row] · /dashboard/[eventId]/details/change   (event: Bea & Paolo)
BUTTON    — (a bookmark / old link such as …/details/field/date, …/details/change)
STEPS     1. As the couple, open /dashboard/<id>/details/field/date (or /details/change). 2. See where you land.
EXPECTED  The Event Settings sheet opens ON that row (`?settings=1&row=date`; `date`, `names` and `venues` are `EVENT_SETTINGS_ROWS`).
ACTUAL    `RecordFieldPage` renders `EventDetailsPage`, which for a couple calls `redirect(eventSettingsHref(eventId, keep.host_removed || keep.invite_error ? 'access' : undefined, keep))`. The row is never passed, so the sheet opens at its top. Only `papic-answer` has a forward (`COUPLE_RECORD_FIELD_FORWARD`). A helper lands on the record with nothing open (`RecordFieldSlot`: `if (!viewer.isCouple) return null`). Code: `apps/web/app/dashboard/[eventId]/details/page.tsx` · `redirect(eventSettingsHref(`; `apps/web/app/dashboard/[eventId]/details/field/[row]/page.tsx` · `<EventDetailsPage params=`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring A4 (every way in moves with it) · SHAPE
SEVERITY  broken
SOURCE    CODE
```

#### A2-H12 · Locking a date here skips the date's real writer
```
PAGE      /dashboard/[eventId]/date-selection   (event: Bea & Paolo)
BUTTON    "Lock in <date>" (candidate cards) · the date picker's lock · the guided flow's pick
STEPS     1. Open Pick your date (?path=direct) on an event that already has a date and suppliers on the shortlist. 2. Lock a new date. 3. Open the guest Event Hub, the Schedule and a supplier's view.
EXPECTED  The same rules and fan-out as the date's writer `updateEventDate`: supplier-calendar clash check, Schedule moved with the date, booked suppliers told (`afterDateApplied`), `revalidatePath(.., 'layout')` + `revalidateGuestSite`.
ACTUAL    `lockEventDate` writes `events.event_date` itself. It calls `revalidatePath(/dashboard/${eventId})` (Home only, no 'layout', no guest Event Hub), never moves the Schedule, and checks no supplier calendar. Its booked-supplier gate ignores a failed count (`const { count } = …; if ((count ?? 0) > 0)`), so a refused read lets the date change over booked suppliers. The candidate picker's `lockThisDate` has no try/catch, so a thrown refusal ("Date is locked — …", a DB error) goes to the error page instead of under the card. Code: `apps/web/app/dashboard/[eventId]/date-selection/actions.ts` · `export async function lockEventDate` · `revalidatePath(\`/dashboard/${eventId}\`);`; `candidate-date-picker.tsx` · `async function lockThisDate`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring C9 (a change to a shared fact updates every page) · CLAUDE.md §5 rule 4
SEVERITY  wrong
SOURCE    CODE
```

#### A2-H13 · "Long weekend" claimed for any date near a holiday
```
PAGE      /dashboard/[eventId]/date-selection (candidate cards)   (event: Bea & Paolo)
BUTTON    — (holiday line on a candidate card)
STEPS     1. Have a candidate date on a Wednesday two days before a fixed PH holiday that falls on a Friday (e.g. Rizal Day). 2. Open Pick your date.
EXPECTED  The long-weekend line only when the gap really touches a weekend.
ACTUAL    `touchesWeekend = candDow === 0 || … || Math.abs(delta) <= 2`. The loop only runs `delta` in ±1, ±2, so the last arm is always true, and every date within two days of a holiday reads "… — a long weekend gives guests time to travel". Holidays and season notes are also hand-typed data arrays inside `page.tsx` (`PH_HOLIDAYS`, `SEASON_NOTES`), not `lib/`. Code: `apps/web/app/dashboard/[eventId]/date-selection/page.tsx` · `function holidayNote` · `Math.abs(delta) <= 2`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part I.5 (exact words; never invent) · design-and-wiring D15
SEVERITY  wrong
SOURCE    CODE
```

#### A2-H14 · Icon tiles and a self-made title
```
PAGE      /dashboard/[eventId]/find-date · /dashboard/[eventId]/date-selection (candidate cards)   (event: Sofia's 18th, or a coordinator on Bea & Paolo)
BUTTON    —
STEPS     1. Open Find your date. 2. Open Pick your date with candidates.
EXPECTED  No icon in a pastel box; typography leads. The page title through `PageMasthead` like its siblings.
ACTUAL    Find your date draws its own header: a `CalendarSearch` icon in `rounded-lg bg-terracotta/10` plus a hand-made `<h1 className="text-3xl …">` (no `PageMasthead`). Each candidate fact row puts its icon in `rounded-full bg-terracotta/10`. The same file also uses `text-red-500`/`text-red-600` palette classes. Code: `apps/web/app/dashboard/[eventId]/find-date/_components/find-your-date.tsx` · `function Shell` · `bg-terracotta/10 text-terracotta`; `candidate-date-picker.tsx` · `h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracotta/10`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part I.2 · CLAUDE.md §3 (PageMasthead on every page; no numbered palette class)
SEVERITY  look
SOURCE    CODE
```

#### A2-H15 · A failed date read shows "Set your dates first"
```
PAGE      /dashboard/[eventId]/find-date   (event: Sofia's 18th, or a coordinator on Bea & Paolo)
BUTTON    —
STEPS     1. Open Find your date while the event row read fails.
EXPECTED  "Couldn't read your date" with Try again.
ACTUAL    `eventRes.error` is logged, then `eventDate = ev?.event_date ?? null`, so `matrix.hasDate` is false and the page tells a couple who HAS a date to "Set the dates you're considering first". The comment above it says a failed read "is not 'no date'". Code: `apps/web/app/dashboard/[eventId]/find-date/page.tsx` · `if (eventRes.error) {` · `const eventDate = ev?.event_date ?? null;`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-H16 · Find-your-date doors 404 for its own viewers
```
PAGE      /dashboard/[eventId]/find-date   (event: a coordinator on Bea & Paolo; Sofia's 18th if its type has no Event Hub)
BUTTON    "Set your wedding date" · "Lock it in your date settings" · "Set a month or a date range"
STEPS     1. As the coordinator, open Find your date. 2. Press any of the three links.
EXPECTED  A door the viewer can open, in the event's own word.
ACTUAL    A couple whose event has an Event Hub is forwarded away (`redirect(detailsItemHref(eventId, 'date', '&date=help'))`), so this page is read by coordinators and by couples of a type with no Event Hub. All three links go to `/dashboard/${eventId}/date-selection`, which calls `notFound()` for anyone not `member_type === 'couple'`, so a coordinator gets a 404. The CTA says "wedding" for every event type (PLAUSIBLE that a non-wedding type with no Event Hub reaches it; confirm in a browser). Code: `apps/web/app/dashboard/[eventId]/find-date/_components/find-your-date.tsx` · `Set your wedding date` · `Lock it in your date settings`; `apps/web/app/dashboard/[eventId]/date-selection/page.tsx` · `membership.member_type !== 'couple'`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring B5 (no link to a route the viewer cannot open) · CLAUDE.md §1 (event, not wedding, unless it is one)
SEVERITY  broken
SOURCE    CODE
```

### Plan the day (group I)

Checked and fine (no finding): `/checklist` forwards via `planningTodoHref` to `/schedule?view=preparation&filter=todo`, which is correct. The couple's schedule and the supplier's `clients/[eventId]?tab=schedule` read the same table, `event_schedule_blocks`: the couple through `fetchScheduleBlocks` (`lib/schedule.ts`), the supplier through its own select in `vendor-dashboard/clients/[eventId]/page.tsx`. `emcee-script-button.tsx` hand-rolls `role="dialog"` + `aria-modal`, but it uses `OverlayBackdrop` + `useModalA11y`, so K3 passes. Inside ⚙ Schedule settings it carries `data-settings-closes`, so it never opens on top of a popup. Every other schedule layer uses `Sheet`. The nikah page returns 404 unless `isMuslimWedding`. Sponsors redirects a Muslim-primary wedding to Guests. Nikah counts come from `fetchGuestsByEventMeasured`, and a failed read is said in words (`measured` false).

#### A2-I1 · Failed supplier-requests read shows "Nothing waiting"
```
PAGE      /dashboard/[eventId]/schedule   (event: Bea & Paolo)
BUTTON    "N need you ›" / Home's "N to approve" door (?sheet=requests)
STEPS     1. The event_schedule_suggestions read (direction to_host) is refused. 2. Open Schedule, or come in from Home's "N to approve".
EXPECTED  The requests sheet says it could not read the requests and offers Try again. It never says "Nothing waiting".
ACTUAL    The `error` is never checked: `const openSuggestions = (suggestionsRes.data ?? []) as VendorSuggestion[];`. With no rows, the "need you" control does not draw, and `RequestsSheet` shows "Nothing waiting. Suppliers' requests land here…". Home can say "N to approve" while this sheet says nothing is waiting. The sibling `asksRes` read on the same page IS checked (`asksRes && !asksRes.error ? … : null`). Code: `apps/web/app/dashboard/[eventId]/schedule/page.tsx` · `suggestionsRes.data ?? []`; `schedule/_components/day-sheets.tsx` · `Nothing waiting.`
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-I2 · Planning list works out owed money itself
```
PAGE      /dashboard/[eventId]/schedule?view=preparation   (event: Bea & Paolo)
BUTTON    —   (payment rows "₱N due to <supplier>")
STEPS     1. Book a supplier with dated payment lines. 2. Open Schedule › Planning Stage.
EXPECTED  The amounts and paid status come from the one money reader (`resolveEventMoney`, amounts via `event_vendor_money_read`). Booked comes from `BOOKED_EVENT_VENDOR_STATUSES`. Pesos are formatted by `lib/php.ts`.
ACTUAL    `fetchPaymentItems` reads `event_vendor_line_items.amount_php` and `event_vendor_payments` directly. It sums paid per line itself (`paidByLine`) and decides booked with a second list, `CONFIRMED_VENDOR_STATUSES` from `lib/events.ts`. It prints pesos with its own `formatPhpShort` (`₱${Math.round(php).toLocaleString('en-PH')}`). The row repeats this in the view: `₱{Math.round(item.amountPhp).toLocaleString('en-PH')}`. Hidden amounts never pass through the RPC, so an amount the budget page hides ("—") can show here. Code: `apps/web/lib/preparation.ts` · `fetchPaymentItems`, `formatPhpShort`, `CONFIRMED_VENDOR_STATUSES`; `apps/web/app/dashboard/[eventId]/schedule/_components/preparation-agenda.tsx` · `toLocaleString('en-PH')`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §4 Budget row + design-and-wiring C8 (one reader)
SEVERITY  money-signin
SOURCE    CODE
```

#### A2-I3 · Planning list silently drops paperwork and meetings on a failed read
```
PAGE      /dashboard/[eventId]/schedule?view=preparation   (event: Bea & Paolo)
BUTTON    —
STEPS     1. The event_paperwork read or the event_appointments read is refused. 2. Open Planning Stage.
EXPECTED  The page says the paperwork deadlines or meetings could not be read, as it already does for tasks, steps and payments.
ACTUAL    `fetchPaperworkItems` and `fetchAppointmentItems` log the error and `return []`. Only task, manual and payment are pushed into `unread`. A refused paperwork read therefore removes every "complete by" deadline with no notice. If nothing else is dated, the page shows "Nothing to prepare yet." Code: `apps/web/lib/preparation.ts` · `console.error('[preparation] paperwork:'` then `return [];` · `unread.push`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-I4 · Planning rows use pastel icon tiles and numbered colours
```
PAGE      /dashboard/[eventId]/schedule?view=preparation   (event: Bea & Paolo)
BUTTON    —
STEPS     1. Open Planning Stage with a payment, paperwork and meeting row.
EXPECTED  No coloured icon boxes (Part I rule 2), and token colours by job only.
ACTUAL    Every non-tick row draws a 36 px icon in a tinted box (`inline-flex h-9 w-9 … rounded-lg ${iconStylesFor(display)}`). The boxes use numbered palette classes `bg-blue-50`, `bg-indigo-50`, `bg-warn-100`, `bg-mulberry/10`. Row frames use `border-blue-200/70 … bg-blue-50/30` (`containerStylesFor`). Code: `apps/web/app/dashboard/[eventId]/schedule/_components/preparation-agenda.tsx` · `iconStylesFor`, `containerStylesFor`, `chipStylesFor`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part I rule 2 (no icon tiles) · design-and-wiring D13
SEVERITY  look
SOURCE    CODE
```

#### A2-I5 · Failed document and receipt reads show "No documents yet"
```
PAGE      /dashboard/[eventId]/documents   (event: Bea & Paolo)
BUTTON    —
STEPS     1. Any of the paperwork, contracts, orders or receipts reads is refused. 2. Open Documents.
EXPECTED  The section says it could not read ("Couldn't read" + Try again). It never shows "No paid orders yet", "No transaction receipts yet" or the whole-page "No documents yet".
ACTUAL    `fetchEventPaperwork` and `fetchEventContracts` return `[]` on error (`lib/paperwork.ts`, `lib/contracts.ts`). The page adds `.catch(() => [])` to all three, which also swallows the throw from `fetchOrdersForEvent`. Receipts use `(receiptsRes.data ?? [])` with no error check. When all of them fail, `totalDocs === 0` draws `EmptyState` ("No documents yet…"). Order and receipt rows carry ₱ amounts, so paid money disappears as if it never existed. Code: `apps/web/app/dashboard/[eventId]/documents/page.tsx` · `fetchOrdersForEvent(supabase, eventId).catch(() => [])`, `receiptsRes.data ?? []`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  money-signin
SOURCE    CODE
```

#### A2-I6 · Documents says "Monogram" (Logo Maker) and a stale door
```
PAGE      /dashboard/[eventId]/documents   (event: Bea & Paolo)
BUTTON    "Browse add-ons" (Setnayan creations empty line)
STEPS     1. Open Documents with no creation orders, or with a `monogram_hero_upgrade` order.
EXPECTED  The page says "Logo Maker". The empty line names a place that exists.
ACTUAL    `CREATION_SKU_LABEL` prints "Monogram Hero". The empty message reads "No Setnayan creations yet. Design a monogram from the YOUR PLAN section on Today." The creation SKU list (`CREATION_SKU_KEYS`) is also typed into the page. Code: `apps/web/app/dashboard/[eventId]/documents/page.tsx` · `monogram_hero_upgrade: 'Monogram Hero'`, `Design a monogram from the YOUR PLAN section on Today.`
SHOTS     none yet (phase B: 375 px light + dark)
RULE      brand.md word rules (Logo Maker, never Monogram) · design-and-wiring D15
SEVERITY  wrong
SOURCE    CODE
```

#### A2-I7 · Several accent-outlined buttons in one scope
```
PAGE      /dashboard/[eventId]/documents ; /dashboard/[eventId]/paperwork   (event: Bea & Paolo)
BUTTON    "Start your paperwork" + "See contract uploads"; "Mark as requested" / "Mark as received" + "Open PSA portal" + "Save" + "Save scan" + "Save note"; "Plan your tea-ceremony serving order" + "Find a date / feng-shui specialist"
STEPS     1. Documents with nothing on file. 2. Paperwork: open one document card (PSA birth cert, status not_started, then requested). 3. A Chinese wedding: the traditions guide.
EXPECTED  At most one main button per scope. Every other button is neutral or a text link, never accent-outlined and never another bright colour.
ACTUAL    The Documents empty state shows two `ab ab-brand` (accent-outlined) links side by side, with no main. Each paperwork card has the main `ab ab-brand ab-main` "Mark as requested" plus four or five `ab ab-brand` outlined buttons ("Open PSA portal", tracking "Save", "Save scan", "Save note", "Reset status"). In the requested state, a filled green `bg-success-700` "Mark as received" sits beside them. The Chinese guide puts two `ab ab-brand` outlined links side by side. Code: `apps/web/app/dashboard/[eventId]/documents/page.tsx` · `EmptyState`; `apps/web/app/dashboard/[eventId]/paperwork/page.tsx` · `ActionsBlock`, `UploadBlock`, `NotesForm`, `TrackingReferenceForm`, `TraditionsGuide`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE
```

#### A2-I8 · Failed paperwork read shows "Start your checklist"
```
PAGE      /dashboard/[eventId]/paperwork   (event: Bea & Paolo)
BUTTON    "Build my checklist"
STEPS     1. The event_paperwork read is refused. 2. Open Paperwork.
EXPECTED  The page says the paperwork could not be read. It never asks the couple to start over.
ACTUAL    `fetchEventPaperwork` logs the error and returns `[]`. `rows.length === 0` sets `needsSeed`, so the page offers "Start your checklist · Build my checklist". The summary strip is hidden, and every card says "This document will appear once you build your checklist above." Paperwork already marked received reads as never started. Code: `apps/web/lib/paperwork.ts` · `fetchEventPaperwork` (`return [];` on error); `apps/web/app/dashboard/[eventId]/paperwork/page.tsx` · `needsSeed`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-I9 · Paperwork is a blank page for non-wedding events
```
PAGE      /dashboard/[eventId]/paperwork   (event: Sofia's 18th · Lolo Ben at 80)
BUTTON    "Start your paperwork" (Documents) · "Open paperwork" (Planning Stage empty state)
STEPS     1. On Sofia's 18th, open Documents with nothing on file and press "Start your paperwork", or open Schedule › Planning Stage while empty and press "Open paperwork".
EXPECTED  Either no door to Paperwork for an event with no statutory paperwork, or a page that says plainly that this event needs none.
ACTUAL    For `event_type !== 'wedding'` the page renders only the back link and `<PageMasthead title="Paperwork" />`, with no text below. The comment promises "a generic 'no statutory paperwork' state". Both doors are drawn for every event type. Code: `apps/web/app/dashboard/[eventId]/paperwork/page.tsx` · `!== 'wedding'` branch; `documents/page.tsx` · `Start your paperwork`; `schedule/_components/preparation-agenda.tsx` · `Open paperwork`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring A3/B5 (every press reaches something real) · F3 empty state
SEVERITY  wrong
SOURCE    CODE
```

#### A2-I10 · Paperwork save failures go to the error screen
```
PAGE      /dashboard/[eventId]/paperwork   (event: Bea & Paolo)
BUTTON    "Save scan" · "Save note" · "Mark as requested" · "Mark as received" · "Save"
STEPS     1. Type a note, or upload a scan. 2. Press Save while the update is refused (RLS, network).
EXPECTED  An inline failure in plain words ("Didn't save · Try again" / "Didn't upload · Try again"), with the typed note kept.
ACTUAL    Every action in `paperwork/actions.ts` does `throw new Error('Could not …')` from a plain `<form action>`. Nothing on the page catches it, and `dashboard/[eventId]` has no `error.tsx` of its own, so the root `app/error.tsx` replaces the whole page. In production Next strips the thrown message, so the friendly text never shows, and the typed note is lost. The upload widget itself does show its own failure line (`FileUpload`). Code: `apps/web/app/dashboard/[eventId]/paperwork/actions.ts` · `throw new Error(` in `uploadPaperworkScan`, `setPaperworkNotes`, `markPaperworkRequested`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring B6 (a failure must render as a failure) · CLAUDE.md §3 Toast row
SEVERITY  wrong
SOURCE    CODE
```

#### A2-I11 · Replaced or unsaved paperwork scans are never removed
```
PAGE      /dashboard/[eventId]/paperwork   (event: Bea & Paolo)
BUTTON    "Upload scan" → "Save scan"
STEPS     1. Upload a PSA scan and press Save scan. 2. Upload a different file for the same document and save again. 3. Or upload a file and leave without pressing Save scan.
EXPECTED  The old or abandoned object in the private bucket is deleted, or swept later.
ACTUAL    `uploadPaperworkScan` overwrites `document_r2_key` and never deletes the previous key. A file uploaded but never saved (`unsavedHint="press Save scan below"`) stays in the bucket under `paperwork/<eventId>/…`. I found no sweep or `cleanup-delete` path that reads `event_paperwork.document_r2_key` or the `paperwork/` prefix. PLAUSIBLE: the absence of a sweep is from grep only (`lib/cleanup-delete.ts`, `lib/*sweep*`). Ops should confirm in the bucket. Code: `apps/web/app/dashboard/[eventId]/paperwork/actions.ts` · `document_r2_key: documentR2Key`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      group brief (every upload surface needs a cleanup) · CLAUDE.md §7 private buckets
SEVERITY  wrong
SOURCE    CODE
```

#### A2-I12 · Paperwork summary is four equal KPI tiles
```
PAGE      /dashboard/[eventId]/paperwork   (event: Bea & Paolo)
BUTTON    —
STEPS     1. Open Paperwork with at least one row.
EXPECTED  One hero number, with the rest quieter in one hairline row. Static cards are neutral.
ACTUAL    `SummaryStrip` draws four equal `sn-row` tiles (Received · In progress · Overdue · License status) in green, amber or red text. Document cards are tinted by state with numbered palette classes (`border-success-300/50 bg-success-50/40`, `bg-danger-50/40`, `bg-warn-50/40`) on a hand-made `rounded-xl border` frame. Code: `apps/web/app/dashboard/[eventId]/paperwork/page.tsx` · `SummaryStrip`, `borderClass`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part I rules 3 and 4 · design-and-wiring D13
SEVERITY  look
SOURCE    CODE
```

#### A2-I13 · Failed sponsor read shows "0 of N slots filled"
```
PAGE      /dashboard/[eventId]/sponsors   (event: Bea & Paolo)
BUTTON    "Add ninong" / "Add ninang" slots
STEPS     1. The event_sponsors read is refused. 2. Open Sponsors.
EXPECTED  The page says it could not read the sponsors. It never shows an empty list a couple could re-fill with duplicates.
ACTUAL    `sponsorRowsError` is logged (`graceful_degrade`), then `const sponsors = (sponsorRows ?? []) as SponsorRow[];`. Progress reads "0 of N slots filled · 0 accepted" and every slot draws an Add button. Code: `apps/web/app/dashboard/[eventId]/sponsors/page.tsx` · `sponsorRows ?? []`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-I14 · Sponsors page is a second sponsor list, not the guest list
```
PAGE      /dashboard/[eventId]/sponsors   (event: Bea & Paolo; also Sofia's 18th by URL)
BUTTON    —
STEPS     1. On Guests, tag two guests "Principal sponsor". 2. Open /sponsors.
EXPECTED  Sponsors are counted from the one guest reader (`guests.role`), the source the guest list, the entourage and the printed invitation use. The page is reachable only where it makes sense (weddings).
ACTUAL    The page reads only `event_sponsors` (admin client) and counts its own "N of M slots filled · N accepted". Guests tagged as sponsors on the guest list do not appear, so the two pages disagree. `lib/entourage.ts` and `app/[slug]/_lib/loaders.ts` state that roles come "from the guest list and nowhere else" and that `event_sponsors` held zero rows. The only real door is the AI cockpit nudge (`lib/setnayan-ai-cockpit.ts`, which fires only when sponsor rows already exist). Guests and the menu only "alsoMatch" it. The page has no `event_type` gate: only a Muslim-primary wedding is redirected, so a debut or birthday that opens the URL gets "Ninong & ninang" and cord/veil/coin/candle sponsors. Code: `apps/web/app/dashboard/[eventId]/sponsors/page.tsx` · `.from('event_sponsors')`, `totalSlotsTarget`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §4 Guest row (one reader) · design-and-wiring A3 (registered and reachable), C8
SEVERITY  wrong
SOURCE    CODE
```

#### A2-I15 · Sponsors guesses ninong or ninang from the family side
```
PAGE      /dashboard/[eventId]/sponsors   (event: Bea & Paolo)
BUTTON    "Add ninong" · "Add ninang"
STEPS     1. Open Sponsors and look at any Walk row.
EXPECTED  Godfather or godmother is chosen by the couple, never inferred from side (owner ruling 2026-09-15, quoted in `lib/event-sponsors.ts` `sponsorRoleHonorific`).
ACTUAL    Each walk labels the groom's column "<Groom's side> · ninong" with "Add ninong", and the bride's column "· ninang" with "Add ninang". A bride-side godfather is therefore filed under "ninang". This is the inference `lib/event-sponsors.ts` calls "always wrong". Code: `apps/web/app/dashboard/[eventId]/sponsors/page.tsx` · `{SPONSOR_SIDE_LABEL.groom} · ninong`, `triggerLabel="Add ninang"`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      wrong word (owner ruling in lib/event-sponsors.ts)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-I16 · Sponsor invite sheet advertises a coming feature
```
PAGE      /dashboard/[eventId]/sponsors   (event: Bea & Paolo)
BUTTON    the sponsor's name (opens "Invite <name>")
STEPS     1. Add a sponsor. 2. Press their invite button.
EXPECTED  No mention of features that are not live.
ACTUAL    The sheet says "Automated email delivery ships in a future update — for now you send the message yourself." Code: `apps/web/app/dashboard/[eventId]/sponsors/_components/invitation-template-modal.tsx` · `Automated email delivery ships in a future update`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      brand.md claims never made, item 9 (coming features)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-I17 · Sponsor card and invite sheet break button rank
```
PAGE      /dashboard/[eventId]/sponsors   (event: Bea & Paolo)
BUTTON    invite trigger + "Marked yes" + "Declined"; sheet "Copy to clipboard" + "Mark invitation sent"
STEPS     1. Mark a sponsor's invitation sent (status invited). 2. Look at their card. 3. Open the invite sheet.
EXPECTED  One main per card or sheet; the others neutral.
ACTUAL    In the invited state, one card shows a hand-made accent-outlined invite trigger (`border-terracotta/40 … text-terracotta-700-700`; that last class does not exist, so the word falls back to the inherited colour), a green outlined `actionButtonClass('ok')` "Marked yes", and a neutral "Declined". That is two bright buttons and no main. In the sheet, `ActionButton tone="info"` "Copy to clipboard" (bright) sits beside the main "Mark invitation sent". Code: `apps/web/app/dashboard/[eventId]/sponsors/_components/sponsor-card.tsx` · `actionButtonClass('ok')`; `invitation-template-modal.tsx` · `tone="info"`, `text-terracotta-700-700`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE
```

#### A2-I18 · Sponsors shows raw database errors, and the URL can forge them
```
PAGE      /dashboard/[eventId]/sponsors   (event: Bea & Paolo)
BUTTON    "Save" in the Add / Edit sponsor sheets
STEPS     1. An add or update fails, or anyone opens /sponsors?error=anything.
EXPECTED  A plain reason in house words plus Try again. A hand-edited URL cannot put text on the page (the schedule page guards this with `parseNoteFlash`).
ACTUAL    The actions redirect with `?error=${encodeURIComponent((e as Error).message.slice(0, 120))}`, which is the Postgres or Supabase message. The page prints `search.error` verbatim in a `role="alert"` banner. Code: `apps/web/app/dashboard/[eventId]/sponsors/actions.ts` · `sponsors?error=`; `sponsors/page.tsx` · `const errorMessage = search.error ?? null;`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring B6 · Part F4 (error in plain words)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-I19 · "Save Nikah details" ignores a failed save
```
PAGE      /dashboard/[eventId]/nikah   (event: a Muslim wedding; none seeded, so use one with ceremony_type muslim)
BUTTON    "Save Nikah details"
STEPS     1. Type a mahr. 2. Press Save while the events update is refused.
EXPECTED  The failure is said ("Didn't save · Try again"), and success gets a small toast.
ACTUAL    `updateNikahDetails` does `await sb.from('events').update({...}).eq('event_id', eventId);` and never reads `{ error }`. It then revalidates as if it saved. A refused write gives no feedback, and on reload the mahr is gone. "Mahr set" stays at todo with no explanation. Code: `apps/web/app/dashboard/[eventId]/nikah-actions.ts` · `updateNikahDetails`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring B6 (a failure must render as a failure)
SEVERITY  broken
SOURCE    CODE
```

#### A2-I20 · Nikah card uses a hand-made emerald frame and typed px
```
PAGE      /dashboard/[eventId]/nikah   (event: a Muslim wedding)
BUTTON    —
STEPS     1. Open the Nikah page in light and dark.
EXPECTED  The card is `.sn-frame` with token colours by job and the `text-sn-*` scale.
ACTUAL    The card is `rounded-2xl border-2 border-emerald-200/70 … bg-emerald-50/30` (a hand-made tinted frame). Icons, labels and the mood-board link use numbered `text-emerald-700/800`. Small print uses `text-[11px]`, the heading `font-mono text-[11px] … tracking-[0.25em]`. The inputs are hand-styled rather than `.input-field`. Code: `apps/web/app/dashboard/[eventId]/_components/nikah-essentials-card.tsx` · `border-emerald-200/70`, `text-[11px]`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring D13 · CLAUDE.md §3 Card/Type/Form rows
SEVERITY  look
SOURCE    CODE
```

## Owner's additions (Adds 1–10b) · area 2

### Add 1 · Popup, full-screen popup or page — only the ones that differ (TODAY → SHOULD)

The full per-page marks are on the Progress lines (phase A, SHAPE). Seen on the copy, unchanged:

| Route / flow | TODAY | SHOULD | Why |
|---|---|---|---|
| /onboarding/[type] · /simple · /wedding | PAGE, bare, steps in one address | FULL-SCREEN POPUP (phone) · centred popup (desktop) | Add 1 names onboarding; several steps (A2-A1) |
| /dashboard/create-event | PAGE cold / side panel from the board | FULL-SCREEN POPUP, screen 1 of the create flow | same flow as onboarding |
| /guests/new · /guests/quick · /guests/import | PAGE | FULL-SCREEN POPUP | several fields / upload; return to the list (A2-D9) |
| /seating/chart · /seating/walkthrough · /seating/lab | PAGE | FULL-SCREEN POPUP over Guests › Seats | print / media / 3D, launched from Seats (A2-E12, A2-E6) |
| /dashboard/samahan/new | PAGE (two fields, no title) | SMALL POPUP | two fields (A2-C15) |
| /details/field/[row] | forward to Home ⚙ sheet, field not opened | SMALL POPUP on the named field | A2-H11 |
| Event settings (Home ?settings=1) | full-height sheet whose top holds a lone ✓ | = FULL-SCREEN POPUP (many fields) — ok, but the ✓ should be a labelled "Done" | top-right ✓ with no word |

Never-rules seen: none broken on the copy at 375 (the pay sheet's QR-over-sheet, A2-G7, was not opened: it sits behind a payment step).

### Add 2 · Clean · balanced · effective

Each page's mark is on its Progress line. The repeated failures across the area:
- **CLEAN:** helper paragraphs under titles (quick add, check-in, souvenirs, manpower "SETNAYAN NOTE", import's launch story A2-P5); two accent buttons (People A2-P17, Documents A2-I7).
- **BALANCED:** desktop Home (/dashboard) is one 780 px column with the right third empty; event Home's date eyebrow is cut in a narrow left column (A2-P21); Linked events has no gutter (A2-P16).
- **EFFECTIVE:** the title is screen-reader-only on most pages (owner's "start at the content" call in `page-masthead.tsx`), so Access requests ("Nothing waiting on you."), Activity, Linked events and Groups new open with no visible name: a first-timer cannot tell where they are. Not filed per page (owner decision); flagged once here.

### Add 3 · Placeholders a real couple could see

| Where | What |
|---|---|
| /guests/import | founders' wedding launch story and "opens on December 19, 2026" (A2-P5) |
| Home (Schedule tile, Who's here) | EXAMPLE rows with made-up people and venues (A2-P12) |
| /vendors/categories | "Joining soon" pressable row (A2-P19) |
| /dashboard/profile | "Legacy contact … Coming soon" (A2-C9, code) |
| /dashboard/api-keys | sample `sk_live_…` key and a vercel.app address (A2-C3) |
| /sponsors invite sheet | a coming feature advertised (A2-I16, code) |
Hint text in fields ("Maria — or paste the whole name", "de la Cruz", "Pasig · our place") reads as hints: not findings.

### Add 4 · Every place area 2 sells or asks for money

| # | Route | What is sold | Price shown | How a person reaches it | Evident · Clean · Honest |
|---|---|---|---|---|---|
| 1 | /dashboard/[eventId]/orders/new → studio/website-pro "Event services" | Event Plus · Pro · Ultra (couple plans) | Plus "being checked" · Pro ₱2,500 · Ultra "Couldn't read" | Orders › New order (2 taps from Home via menu) | Evident: yes, price beside each. Clean: plan list first, no "show it working" before it. Honest: **no** (A2-P2) |
| 2 | /dashboard/[eventId]/orders/[orderId] | the order (Event Plus STG-0001) | ₱2,990 | Orders › row | Honest wording conflict (A2-P3) |
| 3 | /pay/[reference] | pay an order (GCash / bank QR, then upload proof) | ₱2,990.00 / ₱2,790.00 = order = receipt ✓ | order › "Send your payment"; billing › Pay; receipt › Pay | Evident ✓ price before button, fixed "To pay … Continue" bar ✓ |
| 4 | /dashboard/billing | all orders, Pay | ₱2,990 (waiting) · ₱2,790 (submitted) ✓ | account menu › Billing & receipts | ✓ ("₱0 paid" is true: nothing paid) |
| 5 | /receipts/order/[orderId] | Pay from the slip | ₱2,990 ✓ (rendered "₱2 , 990") | billing › row | Pay button bronze (A2-F8) |
| 6 | /dashboard/profile/concierge | Setnayan AI | **none** ("See pricing") | no live door (A2-C11) | Evident: no (A2-P18) |
| 7 | /schedule › "Release ›" (each guest's full schedule) and View as (◆ Pro) | Event Pro upgrade | none on the row | Schedule's right rail at 1280 | Evident: the row says "Release", not that it is a Pro upgrade or its price; not pressed (opens a purchase) |
| 7b | /vendors (Find) › "Unlock" strip | Setnayan AI (ranked shortlist) | **none** | Suppliers, top of Find | Evident: no price (A2-P24) |
| 8 | Supplier money: /vendors/[vendorId]/workspace?tab=payments, Budget › Pay, Home "Pay ₱… to …" | reservation fee and booking payments to suppliers | from the agreed lines (₱124,488 paid / ₱165,782 owed ✓ budget = Home) | Home Budget card, Budget, Suppliers | Home's line counts up from ₱0 (A2-P1); several green Pay buttons on Home (A2-B6) |
| 9 | /onboarding services step | add-ons picked during create | "No payment in this step" (by design) | onboarding | ✓ no checkout in onboarding |

**Taps from the wall to "payment logged"** (Event Plus): Home ☰ › Orders (2) › order (3) › Send your payment (4) › Continue (5) › Continue (6) › upload proof + log (7). Pay page step 1 (reference, "Have a code?") › Continue › step 2 ("Pay this exact amount", QR, bank details, Share) › "Upload Payment Receipt" › step 3. **7 taps to the upload, plus picking the file — over 4, a finding for the buy flow** (Add 4). Seen on step 2: the step header repeats ("2 PAY THIS EXACT AMOUNT … 2 PAY THIS EXACT AMOUNT") and "Upload Payment Receipt" shows twice (body and bottom bar). Not completed: logging proof was not pressed (it would move the seeded order out of "awaiting payment", which the admin checker counts).

### Add 5 · Main jobs, as a first-timer on a phone

| Job | Rating | The step that makes it hard |
|---|---|---|
| Create an event | OK | a bare page with no way back to where you were (A2-A1); date field is the browser's US "mm/dd/yyyy" |
| Add a guest | OK | a full page of 8+ fields before Side and Group, which are required, sit below the fold |
| Import guests | HARD | the page says import opens 19 Dec under working buttons (A2-P5) |
| Seat guests | OK | table pins are 26 px; the chart and walkthrough leave Guests for their own pages |
| Book / pay a supplier | OK | the Find tour covers the first screen; "3 booked" vs "6 booked" (A2-P7) |
| Reply to a chat | EASY | box at the thumb, send inside the box ✓ (the phone key is not "Send", A2-H4) |
| Log a payment (to Setnayan) | HARD | 7 taps (Add 4) |
| Check a guest in | EASY | big Scan button, search below ✓ |
Across all: ⓘ targets are 16 px (A2-P14); five first-visit tours (A2-P13); seven Back styles (A2-P15).

### Add 6 · Buttons pressed

Each page line carries **buttons N (375) / N (1280)** counted on the copy, and **pressed** = links whose destination
was opened in this walk + buttons pressed by the press pass. The press pass ran at 375 on the first pages only: the
copy answered a signed-in page in 20–180 s, so a reload after each press was not possible for every page (see BLOCKERS).
Where pressed < buttons, the line says which were left and why.

### Add 7 · Three sizes, light and dark

- Walked at 375 · 768 · 1280 light, and 375 dark on every page; 768 and 1280 dark on the pages that go dark.
- **DARK: yes** only on the routes in `DARK_READY`: the account spokes (/dashboard/people · profile · notifications ·
  create-event · samahan) and event Home, Budget, Guests, Schedule. **DARK: no** on every other area-2 page (they stay
  light with the switch on Dark; A2-X2). No half-dark page was seen: the ready pages had no white surface in dark
  (the only white block found is the QR slot, which must stay white).
- Home shots: `build-sessions/final-check/shots/area-2/home-{375,768,1280}-{light,dark}.png` (event Home, Bea & Paolo, tour skipped).
- 768: the event pages switch to the side rail + top bar (desktop shape) at 768, with no bottom bar: designed, not a stretched phone. Account pages keep the phone bottom bar (Home · Discover) at 768.

### Add 8 · Reveals — area 3. Add 9 — areas 1 and 8. Not in this area.

### Add 10 · Offline — beyond the five (event host / couple)

| Part (route) | Moment the signal drops | Level | Why |
|---|---|---|---|
| Guests list + guest card (/guests, ?inspect=) | at the venue on the day; at the parish | READ-ONLY | the host must find a guest's table, phone, plus-ones without signal |
| Souvenir desk (/guests/souvenirs) | at the venue on the day | SAVE AND SYNC | the giveaway table runs like check-in; today it has no saved copy (not in OFFLINE_COPY_SHAPES) |
| Schedule / run of show (/schedule) | at the venue on the day | READ-ONLY (couple) · SAVE AND SYNC for "done" ticks | hosts follow the timeline; ticks can wait |
| Budget (/budget) + supplier payment record | on the road; at an expo; paying a supplier in a province | READ-ONLY, + SAVE AND SYNC for "record a cash payment" | a host pays cash at the venue and must log it before forgetting |
| Supplier chat (/messages/[threadId]) | at an expo | READ-ONLY + SAVE AND SYNC send | the quote and agreed terms must open at the booth; a typed message can queue |
| Contract (/contracts/[contractId]) | at the venue on the day | READ-ONLY | to settle "what was agreed" with a supplier |
| Paperwork (/paperwork) | at the parish / LGU office | READ-ONLY | tracking numbers and dates at the window |
| Event home (/dashboard/[eventId]) | anywhere | READ-ONLY (built) | already has a saved copy |
**Tried offline on the copy (browser offline, service worker active, bypass cookie set):**
- **Check-in desk, already open:** keeps working. The bar says "No signal · scans will be saved on this phone"; search
  still finds guests with their tables. Back online it carries on without a reload. (No scan was made: seeded data.)
- **Reopening any dashboard page with no signal** (check-in, Home, Schedule, Souvenirs, Budget, Suppliers): the
  browser's own "no internet" error. The saved copies are not served on a reload or a fresh open (A2-P22).
- **Event Hub (/stg-bea-paolo):** the service worker's page "You're offline — We can't reach Setnayan right now. Any
  pages and event details you've already opened are still available — reconnect to load the rest. Set na 'yan. Try again".
- **Souvenir desk:** not tried in-page (it has no saved copy in OFFLINE_COPY_SHAPES; reload fails like the rest).

**Add 10b (supplier QR) — areas 5, 6, 7.** For a couple the only QR moment in area 2 is scanning a supplier's QR at an
expo; that lands on the supplier's shop (area 5/1), not on an area-2 page. Nothing to add here.

## Second pass (25 Nov)

Pages touched by fix batch 1, checked against Adds 11, 11b, 12, 13, 15, 17 and 18. Only the lane A lines are fixed.

- **A2-P4 not reproduced (copy health).** Re-walked after the copy sped up: `/dashboard?seg=people&view=samahan` draws
  "Groups · No group yet · New" in 20 s. The blank screen was the copy's slow stream, not the code. No fix.
- [A] A2-S1 (fixed in batch 2, folded into SW-RAWDB) · /dashboard/[eventId]/disputes and /sponsors · both print `?error=` from the address bar as the alert
  text (`{search.error}` / `search.error ?? null`), so a crafted link shows any words under Setnayan's name → map
  fixed message keys to plain sentences, ignore anything else (the SW-URI rule; area 2's pages are not in that sweep).
- [B] A2-S2 · /activity, /disputes, /contracts, /documents, /people (list pages) · no pull to refresh on a phone
  (Add 11.3) · Reference: the iOS Mail list pull-to-refresh, header stays put.
- [B] A2-S3 · /vendors/categories (category list) · hand-typed `text-[13px]`, `text-[15px]`, `text-[12.5px]` sizes and
  45 px initials circles; rows are phone-sized on desktop too (Add 11b) · Reference: Gmail's denser desktop rows.
- [B] A2-S4 · /guests/checkin, /guests/souvenirs · the desk title is a hand-made `<h1>` with a QR / gift icon, not
  `PageMasthead` (already A2-D8 / A2-P15, noted again for the drawing).
- Add 12 (motion), 13 (icons), 15 (logo), 17 (retired), 18 (reveals): nothing new on these pages. None of the touched
  pages is in lane R.

### Fixer notes (25 Nov) — skipped or not reproduced, with the reason
- **A2-P4** not reproduced: once the copy was fast, Groups drew "No group yet · New". Copy slowness, not code.
- **A2-P6** seed-shaped: the seed links Bea's account to the groom's row; the list then shows the linked account's
  name. Not changed until a builder confirms which name a linked row should show.
- **A2-P1** 🟠 needs-owner: money on Home counts up from ₱0 because of the owner's 7 Oct rule "all numbers animate"
  (held by `home-numbers-count.test.ts`). Should money figures be exempt from the count-up?
- **A2-P5** by design: the import notice is the owner's own words (DECISION_LOG 2 Nov "Guest import opens December 19").
- **A2-D2 / A2-E4** (one counting reader for seats and check-in) left for batch 6: they change how numbers are
  derived and need care.
- **A2-F7** (order slip names a rail /pay may not use) and **A2-F10** (referral page, behind a switched-off flag): batch 6.

