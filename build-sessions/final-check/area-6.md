# Final check · Area 6 · Supplier: bookings, chat, payments, calendar

FIXER: batch 1 of ~3 · PR https://github.com/iscasasola/setnayan-platform/pull/8311 · draft, CI running · batches 2–3 built, preflight running

Checker 6 of 8. Checked commit: `fb3f72d` (the pinned check commit). Report only.
STATUS: phase B done

| | blocker | money-signin | broken | wrong | look | total |
|---|---|---|---|---|---|---|
| Phase A (code, A6-01…A6-71) | 0 | 18 | 8 | 23 | 21 | 70 (+1 no-issue note, A6-63) |
| Phase B (walk, A6-B01…A6-B24) | 0 | 3 | 3 | 12 | 6 | 24 |
| **Area 6** | **0** | **21** | **11** | **35** | **27** | **94** |

Walked: 18 of 22 pages and 12 of 12 forwards on the staging copy (preview `bd86936`). Not walkable on the copy, said so in
place: booking-fees/[orderId] (no bill), contracts/[contractId] (no contract, and upload is broken: A6-B13), on-the-day/live
and its Papic page (no booked event today). DARK: yes 1 page · no 21. Shots: `build-sessions/final-check/shots/area-6/`.
Known gap: the sensitive flags (`NEXT_PUBLIC_CHAT_LIVE_ENABLED` and the others) use the code default on the copy — no
finding here depends on them (chat findings are about what is drawn, not live updates).

Phase A = code pass (`SOURCE: CODE`). Phase B = browser walk on staging (`SOURCE: WALK`).

## BLOCKERS

None. (The copy's slowness, A6-B01, made every page slow but stopped no flow.)

## Progress

Pages (22):

- [x] /vendor-dashboard/booking-fees — OFFLINE: READ-ONLY IS ENOUGH · SHAPE: today page → should page · same
- [x] /vendor-dashboard/booking-fees/[orderId] — OFFLINE: NOT NEEDED (paying needs the server) · SHAPE: today page → should page (a notification links to it) · same
- [x] /vendor-dashboard/calendar/[date] — a forward to Customers › Dates day sheet · OFFLINE: see Dates · SHAPE: the day sheet is a SMALL POPUP over Dates · same
- [x] /vendor-dashboard/clients/[eventId] — OFFLINE: NEEDED (on the day: booking status, Your booking, client details) — only `?tab=schedule` is saved today · SHAPE: today page (rises over the list on a soft tap) → should page · same
- [x] /vendor-dashboard/clients/[eventId]/challenge-photos — OFFLINE: NOT NEEDED · SHAPE: today page → should FULL-SCREEN POPUP (a photo/video grid, nothing links to it by address) · DIFFERS (A6-53)
- [x] /vendor-dashboard/clients/[eventId]/cocktail — OFFLINE: READ-ONLY IS ENOUGH · SHAPE: today page → should page (routes.ts builder, linked from the client page, multi-screen editor) · same
- [x] /vendor-dashboard/clients/[eventId]/editorial-media — OFFLINE: NOT NEEDED · SHAPE: today page → should FULL-SCREEN POPUP (photo/clip capture, no deep link) · DIFFERS (A6-54)
- [x] /vendor-dashboard/clients/[eventId]/mood-board — OFFLINE: READ-ONLY IS ENOUGH (a stylist checks the palette on the day; none saved today) · SHAPE: today page → should page · same
- [x] /vendor-dashboard/clients/[eventId]/production-sheet — OFFLINE: NEEDED (on the day: the caterer works from it at the venue) — NOT saved today (not in `OFFLINE_COPY_SHAPES`); print is the only fallback · SHAPE: today page → should page · same
- [x] /vendor-dashboard/clients/[eventId]/their-event/[part] — OFFLINE: NEEDED (on the day) for Schedule and Numbers; READ-ONLY for Guests and Event Hub; none saved today · SHAPE: today page → should page · same
- [x] /vendor-dashboard/contracts/[contractId] — OFFLINE: READ-ONLY IS ENOUGH · SHAPE: today page → should page · same
- [x] /vendor-dashboard/contracts/new — OFFLINE: NOT NEEDED · SHAPE: today page → should FULL-SCREEN POPUP (a 4-field fill-in with a file pick; the person came from a client or Contracts) · DIFFERS (A6-70)
- [x] /vendor-dashboard/customers — OFFLINE: NEEDED (at an expo: Dates — "is this date open?"; on the day: the bookings list). No saved copy today; Money segment READ-ONLY IS ENOUGH · SHAPE: today page → should page · same (but 2 of its sheets differ: A6-41, A6-42)
- [x] /vendor-dashboard/disputes — OFFLINE: NOT NEEDED · SHAPE: today page → should page · same
- [x] /vendor-dashboard/manpower — OFFLINE: NOT NEEDED (no door by owner ruling 9 Nov; accepting a gig needs the server) · SHAPE: today page → should page · same
- [x] /vendor-dashboard/messages — OFFLINE: READ-ONLY IS ENOUGH · SHAPE: today page (full-screen chats) → should page · same
- [x] /vendor-dashboard/messages/[threadId] — OFFLINE: NEEDED (on the day: replying from the venue; composer should queue, money cards re-checked on reconnect) · SHAPE: today page → should page · same (but 2 of its tools differ: A6-12)
- [x] /vendor-dashboard/notifications — OFFLINE: READ-ONLY IS ENOUGH · SHAPE: today page → should page · same
- [x] /vendor-dashboard/on-the-day — OFFLINE: NEEDED (on the day and at an expo: bookings, schedule, crew/review QR). Saved copy exists today (`SupplierSavedStrip`, `lib/offline-copies.ts`) · SHAPE: today page → should page · same
- [x] /vendor-dashboard/on-the-day/live/[eventId] — OFFLINE: NEEDED (on the day: schedule, headcount, scanner). In `supplierOfflinePaths` today · SHAPE: today page → should page · same
- [x] /vendor-dashboard/on-the-day/live/[eventId]/papic — OFFLINE: NOT NEEDED (capture and look-back read/write storage) — I disagree with nothing here · SHAPE: today page → should page (the look-back is returned to by link; test 1 wins over the camera) · same
- [x] /vendor/lock/[token] — OFFLINE: NOT NEEDED (locking is a server action; the expo piece is the supplier's QR, not this page) · SHAPE: today page → should page (shared by link/QR) · same

Forwards (12), checked in code. Each `redirect()` target exists and the anchor is drawn by the target:

- [x] /vendor-dashboard/bookings → /vendor-dashboard/customers?tab=bookings&seg=money#bookings (`id="bookings"` drawn when seg=money) — lands
- [x] /vendor-dashboard/calendar → /vendor-dashboard/customers?tab=calendar#calendar (bare) / keeps params — lands (`id="calendar"` in customers-pin.tsx)
- [x] /vendor-dashboard/clients → /vendor-dashboard/customers?tab=clients — lands (Events)
- [x] /vendor-dashboard/contracts → /vendor-dashboard/customers?tab=contracts#customer-tools — lands
- [x] /vendor-dashboard/demand → /vendor-dashboard/shop#analytics — lands (`id="analytics"` in the carousel)
- [x] /vendor-dashboard/earnings → /vendor-dashboard/customers?tab=…#payday — lands
- [x] /vendor-dashboard/events → /vendor-dashboard/on-the-day — lands
- [x] /vendor-dashboard/locked-qr → /vendor-dashboard/invite?mode=locked&ledger=1#issued — lands (`id="issued"` in qr-codes.tsx)
- [x] /vendor-dashboard/payday → /vendor-dashboard/customers?tab=…#payday — lands
- [x] /vendor-dashboard/payment-options → /vendor-dashboard/profile#pay — lands (Fold `anchor="pay"`)
- [x] /vendor-dashboard/proposals → /vendor-dashboard/customers?tab=…#customer-tools — lands
- [x] /vendor-dashboard/recaps → /vendor-dashboard/shop/promote#share — lands (`<section id="share">`)

## Findings

Numbered A6-NN. Every phase A finding is `SOURCE: CODE`; the browser pass will confirm or strike it. Event / thread names
are the seeded ones (§ 3 of the kit: Kusina ni Aling Nena Catering, booked on 6 events).

### /vendor-dashboard/messages/[threadId]

```
A6-01
PAGE      /vendor-dashboard/messages/[threadId]   (any booked thread with a payment plan)
BUTTON    the "Plan · ₱… of ₱… received" fold · "Mark payment cleared"
STEPS     1. Open a booked thread whose plan has payments. 2. The payments read fails (RLS / network).
EXPECTED  "Couldn't read payments" — the reader's own docblock says a "₱0 paid" drawn from a failed read is a lie.
ACTUAL    `fetchPlanProgressForVendor` (lib/vendor-service-payment-schedules.server.ts) returns `.plans` and throws away
          `complete`; the card draws "₱0 of ₱X received" with every step due (vendor-payment-live.tsx `{peso(rollup.received)} of {peso(rollup.total)} received`).
SHOTS     375 light + dark
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  money-signin
SOURCE    CODE
```

```
A6-02
PAGE      /vendor-dashboard/messages/[threadId]
BUTTON    "Confirm received" / "Not received" cards ("The couple logged a ₱… payment")
STEPS     1. The couple logs a payment. 2. The supplier opens the thread while the pending-payments read fails.
EXPECTED  "Couldn't read logged payments".
ACTUAL    The two reads in lib/vendor-service-payment-schedules.server.ts (`event_vendors`, `event_vendor_payments`) bind no
          `error`; page.tsx catches with `console.error(…); return []`. The cards vanish, and the tools sheet says 0 payments to confirm.
RULE      CLAUDE.md §5 rule 4
SEVERITY  money-signin
SOURCE    CODE
```

```
A6-03
PAGE      /vendor-dashboard/messages/[threadId]
BUTTON    "Guest count changed" card · "Apply +₱…" / "Hold price"
STEPS     1. The host's guest count changes. 2. The thread prices the change.
EXPECTED  The live count comes from the ONE headcount reader (`headcountForBasis` / `countsTowardEvent`, lib/guests.ts); a failed count is "unknown".
ACTUAL    lib/pax.ts `liveHeadcount` re-implements the basis filters itself and ends `const { count } = await q; return count ?? 0;`
          — a second headcount rule, and a failed count becomes 0, so the price delta silently falls back to the estimate.
RULE      design-and-wiring C8 (one reader) · CLAUDE.md §5 rule 4
SEVERITY  money-signin
SOURCE    CODE
```

```
A6-04
PAGE      /vendor-dashboard/messages/[threadId]
BUTTON    every ₱ amount in the chat money cards
EXPECTED  `formatPhp` from lib/php.ts.
ACTUAL    Hand-rolled formatters: page.tsx `const peso = (n) => \`₱${Math.abs(Math.round(n)).toLocaleString('en-PH')}\``,
          the same in vendor-payment-live.tsx, and pay-confirm-actions.ts `₱${Number(pay.amount_php ?? 0).toLocaleString('en-PH')}`.
          `Math.abs` hides a negative; `?? 0` can tell the couple "confirmed receiving your ₱0 payment".
RULE      CLAUDE.md §1 (money only through lib/php.ts)
SEVERITY  money-signin
SOURCE    CODE
```

```
A6-05
PAGE      /vendor-dashboard/messages/[threadId]
BUTTON    "Send a new quotation" (expired-quote blocker)
STEPS     1. A quote expired. 2. The live-quote read fails. 3. Press "Send a new quotation".
EXPECTED  "Couldn't load your last quotation".
ACTUAL    page.tsx logs `'[vendor thread] live quote read for revision refused'` and leaves `quoteRevision` null — the builder opens blank.
RULE      CLAUDE.md §5 rule 4
SEVERITY  wrong
SOURCE    CODE
```

```
A6-06
PAGE      /vendor-dashboard/messages/[threadId]
BUTTON    the "locked suppliers" count
EXPECTED  booked = `BOOKED_EVENT_VENDOR_STATUSES` (lib/vendor-funnel.ts).
ACTUAL    page.tsx imports `CONFIRMED_VENDOR_STATUSES` from lib/events; lib/pax.ts has its own `BOOKED_STATUSES` set. Same values today — copies drift.
RULE      design-and-wiring C8
SEVERITY  wrong
SOURCE    CODE
```

```
A6-07
PAGE      /vendor-dashboard/messages/[threadId]
BUTTON    quote cards' "comes with" rows
ACTUAL    The `vendor_service_links` read never binds its error (`(linkRows …).data ?? []`); a failure shows cards with nothing included. PLAUSIBLE.
RULE      CLAUDE.md §5 rule 4
SEVERITY  wrong
SOURCE    CODE
```

```
A6-08
PAGE      /vendor-dashboard/messages/[threadId]  (notifications sent to the couple)
ACTUAL    pay-confirm-actions.ts and pax-actions.ts write `relatedUrl: \`/dashboard/${…}/vendors/${…}/workspace?tab=payments\`` and
          `/dashboard/${eventId}/budget` as typed strings. Targets exist; the `lib/routes.ts` builder rule is broken.
RULE      design-and-wiring A3
SEVERITY  wrong
SOURCE    CODE
```

```
A6-09
PAGE      /vendor-dashboard/messages/[threadId]
BUTTON    "Confirm received" + "Mark payment cleared" (opened plan fold)
EXPECTED  One main button per screen.
ACTUAL    vendor-payment-live.tsx: `SupplierSubmit tone="brand" main` "Confirm received" and a filled `bg-success-700 … text-cream` "Mark payment cleared",
          beside the composer's Send. The unfolded branch already uses the outlined `actionButtonClass('ok')`.
RULE      HOUSE_DESIGN_STANDARD K1 · CLAUDE.md §3 colour (numbered palette class)
SEVERITY  look
SOURCE    CODE
```

```
A6-10
PAGE      /vendor-dashboard/messages/[threadId]
ACTUAL    Raw skin: send-proposal-card.tsx and inquiry-outcome-capture.tsx `bg-white`; chat-info-rail.tsx and thread-tools-sheet.tsx
          `text-[11.5px]` (half pixel); many `text-[13px]`/`[14px]`/`[15px]`.
RULE      CLAUDE.md §3 colour / type
SEVERITY  look
SOURCE    CODE
```

```
A6-11
PAGE      /vendor-dashboard/messages/[threadId]
BUTTON    ＋ tools → "Answer their booking ask"
ACTUAL    Opens full screen (`rise: true` in lib/vendor-thread-tools.ts) but is one short screen (fee line + Agree / Turn down).
EXPECTED  SMALL POPUP (Sheet).
RULE      SHAPE (owner 25 Nov)
SEVERITY  look
SOURCE    CODE
```

```
A6-12
PAGE      /vendor-dashboard/messages/[threadId]
BUTTON    ＋ tools → "Send a quote" · "Deal or meeting"
ACTUAL    No `rise`: they open as a `<details>` tray under the composer (app/_components/chat/thread-tool-panel.tsx). "Send a quote" is the
          multi-step quote builder; "Deal or meeting" is a multi-field proposal (PLAUSIBLE — fields not counted).
EXPECTED  FULL-SCREEN POPUP (RiseScreen); a proposal is multi-step.
RULE      SHAPE (owner 25 Nov)
SEVERITY  look
SOURCE    CODE
```

### /vendor-dashboard/messages

```
A6-13
PAGE      /vendor-dashboard/messages
STEPS     The archive-aware thread read fails.
EXPECTED  Archived chats stay archived, or the list says the archive state didn't load.
ACTUAL    lib/chat.ts fallback after `logQueryError('fetchVendorThreads (archive embed)' …)` maps every row to `archived: false` —
          archived chats come back among the active ones, silently.
RULE      CLAUDE.md §5 rule 4
SEVERITY  wrong
SOURCE    CODE
```

```
A6-14
PAGE      /vendor-dashboard/messages
ACTUAL    supplier-chats.tsx `text-[17px]`, `text-[14px]`, `text-[13px]`; page.tsx row door is a typed
          `/vendor-dashboard/clients/${r.eventId}?tab=chat` string, not a `lib/routes.ts` builder.
RULE      CLAUDE.md §3 type · design-and-wiring A3
SEVERITY  look
SOURCE    CODE
```

### /vendor-dashboard/notifications

```
A6-15
PAGE      /vendor-dashboard/notifications
ACTUAL    lib/notifications.ts returns `[]` on a missing-relation error → "Nothing yet." (PLAUSIBLE: schema lag only; other errors throw to error.tsx).
          The title is a hand-made `<h1 className="text-[22px] …">Notifications</h1>` (app/_components/notifications/notifications-list.tsx), not `PageMasthead`.
RULE      CLAUDE.md §5 rule 4 · §3 page title
SEVERITY  look
SOURCE    CODE
```

### /vendor-dashboard/manpower

```
A6-16
PAGE      /vendor-dashboard/manpower
BUTTON    "Accept gig"
ACTUAL    (a) gig-card.tsx defines its own `formatPhp(centavos)` that shadows lib/php.ts; (b) lib/vendor-manpower-reads.ts has its own
          `GIG_BOOKED_STATUSES` copy of the booked list; (c) surface.tsx comment types a price ("cash ₱15k");
          (d) every open gig row carries `tone="brand" main` "Accept gig" → 2+ mains on one screen;
          (e) the failed-shop-read branch is a hand-made `rounded-2xl border-t-[3px] border-mulberry/70` box, not `ToolFail`/error-state.
RULE      CLAUDE.md §1 money · C8 one reader · §5 rule 3 no typed price · K1 · §3 empty/error pieces
SEVERITY  wrong
SOURCE    CODE
```

### /vendor-dashboard/on-the-day

```
A6-17
PAGE      /vendor-dashboard/on-the-day
BUTTON    "See your customers"
STEPS     1. A booked supplier opens On the day. 2. The bookings read is refused.
EXPECTED  "Couldn't read your events".
ACTUAL    page.tsx `const bookings = await fetchVendorRoomEvents(…)` drops the `complete` flag that `fetchVendorRoomEventsDetailed` gives
          (and the events-you-run read drops `measured`) → the empty Hub, "No events yet".
RULE      CLAUDE.md §5 rule 4
SEVERITY  broken
SOURCE    CODE
```

```
A6-18
PAGE      /vendor-dashboard/on-the-day
STEPS     The completion, handover and media reads fail.
EXPECTED  "Couldn't load".
ACTUAL    `completionRes.data`, `(handoverRes.data ?? [])`, `(mediaRes.data ?? [])` — errors never checked; draws "0% done · Not started yet",
          "0 clips", "0 photos", "Not yet".
RULE      CLAUDE.md §5 rule 4
SEVERITY  broken
SOURCE    CODE
```

```
A6-19
PAGE      /vendor-dashboard/on-the-day
ACTUAL    `const MAX_MEDIA_PER_TYPE = 3; // mirrors editorial-vendor-media MAX_PER_TYPE` (a second copy) and `sub="5s each · up to 3"` typed in UI;
          typed routes `href="/vendor-dashboard/subscription"`, `href="/vendor-dashboard/customers"`.
RULE      design-and-wiring C8 / A3
SEVERITY  wrong
SOURCE    CODE
```

```
A6-20
PAGE      /vendor-dashboard/on-the-day
BUTTON    fullscreen control on "Instant reviews from guests" · Crew card "Allow" / "Share"
ACTUAL    (a) _components/guest-review-qr.tsx is a hand-rolled `aria-modal="true"` `fixed inset-0 z-[60]` overlay — the crew QR already uses `<Sheet … rise>`;
          (b) crew-panel.tsx: `tone="brand" main` "Allow" once per waiting phone plus `main` "Share" → several mains;
          (c) raw skin: `QR_COLOURS` hex, `rgba(251,251,250,0.82)`, `text-[13.5px]`/`[11.5px]` (half pixels) in page.tsx and hub-screen.tsx,
          `bg-white` in hub-event-menu.tsx, guest-review-qr.tsx, requests-inbox.tsx; `animate-spin` in access-grants.tsx and module-configurator.tsx.
RULE      K3 · K1 · CLAUDE.md §3 colour / type / loading (no spinners)
SEVERITY  look
SOURCE    CODE
```

### /vendor-dashboard/on-the-day/live/[eventId]

```
A6-21
PAGE      /vendor-dashboard/on-the-day/live/[eventId]
BUTTON    the headcount row
STEPS     The `get_vendor_event_brief` RPC fails on the day.
EXPECTED  "—" / couldn't load (as the count tile on the same page already does).
ACTUAL    `const { data: briefData } = await supabase.rpc('get_vendor_event_brief', …)` (no error) → `brief?.pax.invited ?? 0` /
          `attending ?? 0` → "0 / 0" on the venue floor.
RULE      CLAUDE.md §5 rule 4
SEVERITY  broken
SOURCE    CODE
```

```
A6-22
PAGE      /vendor-dashboard/on-the-day/live/[eventId]
STEPS     1. The bookings read is refused → `redirect(…&live=not-yet)` back to the Hub with a false "opens on <date>".
          2. The crew-grant RPC `current_vendor_dayof_grant_event_ids` error is ignored → a crew member with no shop is sent to `/vendor-dashboard/profile#docs`.
EXPECTED  A read failure says so (the Papic sub-page already does).
RULE      CLAUDE.md §5 rule 4
SEVERITY  broken
SOURCE    CODE
```

```
A6-23
PAGE      /vendor-dashboard/on-the-day/live/[eventId]
ACTUAL    `animate-pulse` in supplier-scan/your-numbers.tsx and supplier-scanner.tsx; `bg-white` inputs in song-desk/sets-panel.tsx.
          (The booked-service RPC ignoring its error is commented "Best-effort" — noted, not counted.)
RULE      CLAUDE.md §3 loading / colour
SEVERITY  look
SOURCE    CODE
```

### /vendor-dashboard/on-the-day/live/[eventId]/papic

```
A6-24
PAGE      /vendor-dashboard/on-the-day/live/[eventId]/papic
BUTTON    "Buy" (portfolio pack) · import
STEPS     The supplier's credit balance cannot be read.
EXPECTED  No number, import not refused on a guess, no sale.
ACTUAL    lib/vendor-papic-grants.ts `left: credits === null ? 0 : …` and `offerPack: offerPack(credits ?? 0)` → the card says "Couldn't load your
          balance" while the album below refuses import as out of credits and offers the Buy form.
RULE      CLAUDE.md §5 rule 4
SEVERITY  money-signin
SOURCE    CODE
```

```
A6-25
PAGE      /vendor-dashboard/on-the-day/live/[eventId]/papic
BUTTON    the "Pack" dropdown
ACTUAL    portfolio-credits-card.tsx `const peso = (n) => '₱' + n.toLocaleString('en-PH')` for the pack price; `${left} left to spend` without `formatCount`.
          PLAUSIBLE: this meter is lib/vendor-papic-grants.ts, not the one photo-credit reader lib/papic-event-pool.ts — needs an owner/corpus call.
RULE      CLAUDE.md §1 money (lib/php.ts) · §4 photo credit
SEVERITY  money-signin
SOURCE    CODE
```

### /vendor/lock/[token]

```
A6-26
PAGE      /vendor/lock/[token]
STEPS     1. A host scans a valid lock QR. 2. The token or shop read fails.
EXPECTED  "Couldn't read this lock link — try again".
ACTUAL    `const { data: tok } = await admin.from('vendor_locked_qr_tokens')…maybeSingle(); if (!tok) notFound();` (same for `vendor_profiles`)
          → a 404, so a real QR looks fake.
RULE      CLAUDE.md §5 rule 4
SEVERITY  money-signin
SOURCE    CODE
```

```
A6-27
PAGE      /vendor/lock/[token]
BUTTON    "Set up your event"
STEPS     1. Signed in as a host with events. 2. The host-events read in lib/vendor-couple-invite.ts fails (errors not bound, `?? []`).
EXPECTED  Couldn't read your events.
ACTUAL    "Create your event first". Also: signed in with an account that hosts nothing (e.g. the supplier's own login on a shared phone) the page
          offers only "Set up your event" — no "Not you? Switch account".
RULE      CLAUDE.md §5 rule 4 · sign-in
SEVERITY  money-signin
SOURCE    CODE
```

```
A6-28
PAGE      /vendor/lock/[token]
BUTTON    "First payment received" line
ACTUAL    `const paid = Number(tok.initial_paid_php ?? 0)` drawn in the success colour → "First payment received ₱0" when the amount is missing;
          schedule rows `Number(r.amount_value ?? 0)` show ₱0. PLAUSIBLE that null means nothing paid, but a green "received ₱0" still claims a fact.
          `formatPhp` is imported from `@/lib/orders` (a re-export) instead of `@/lib/php`.
RULE      CLAUDE.md §5 rule 4 · §1 money
SEVERITY  money-signin
SOURCE    CODE
```

```
A6-29
PAGE      /vendor/lock/[token]
ACTUAL    The date-option (`events`) and shortlist (`event_vendors`) reads bind no error: the message falls back to "changes your date" and
          the "may not be free then" warning silently disappears. "Wedding date" / "sets your wedding date" is typed for every event type.
          PLAUSIBLE: the lock is `vendor_claim_locked_qr` (its own RPC), not lib/chat-lock-booking.server.ts — owner call on a second lock door.
RULE      CLAUDE.md §5 rule 4 · §4 one lock reader
SEVERITY  wrong
SOURCE    CODE
```

```
A6-30
PAGE      /vendor/lock/[token]
BUTTON    "Lock it in" (event picker)
ACTUAL    Hand-made `<fieldset>` of `<input type="radio" … accent-mulberry>` (should be `PickMenu`); `text-[13px]`/`[15px]`/`[14px]`/`[11.5px]`,
          `rounded-[var(--m-r-lg)]`, `rounded-2xl`; loading.tsx uses `animate-pulse rounded-3xl bg-ink/5` blocks, not `Sk`/`Ghost`.
RULE      CLAUDE.md §3 choices / type / radius / loading
SEVERITY  look
SOURCE    CODE
```

### /vendor-dashboard/customers (My Customers hub: Events · Dates · Money · @client)

```
A6-31
PAGE      /vendor-dashboard/customers?seg=money   (Log a payment sheet)
BUTTON    "Log a payment"
STEPS     1. Money. 2. The payday read is incomplete. 3. Press "Log a payment".
EXPECTED  "Couldn't load — try again".
ACTUAL    money-segment.tsx `moneyPicture(paydayIncomplete ? null : paydayRead.rows, …)` → lib/vendor-money.ts `if (payday === null) return { …, customers: [] }`
          → money-log.tsx "No booked customer yet. A payment is logged on a booking…".
RULE      CLAUDE.md §5 rule 4
SEVERITY  money-signin
SOURCE    CODE
```

```
A6-32
PAGE      /vendor-dashboard/customers?seg=money
BUTTON    "Log a payment" → "Whose payment?"
ACTUAL    The pick list is `picture.customers` built from instalment rows, not from bookings in `BOOKED_EVENT_VENDOR_STATUSES` — a booked customer
          with no payment plan is missing (PLAUSIBLE: depends on whether every booking gets a plan).
RULE      design-and-wiring C8
SEVERITY  money-signin
SOURCE    CODE
```

```
A6-33
PAGE      /vendor-dashboard/customers?seg=money
ACTUAL    (a) money-segment.tsx `const waived = waivedRead === FEE_BILLS_UNREADABLE ? [] : waivedRead;` — waived fees vanish on a failed read, with no line;
          (b) the pinned Received / To come in figures use `formatPesoCompact` (lib/vendors-plan-budget.ts), a second ₱ formatter, not lib/php.ts.
RULE      CLAUDE.md §5 rule 4 · §1 money
SEVERITY  money-signin
SOURCE    CODE
```

```
A6-34
PAGE      /vendor-dashboard/customers (Events rows "₱… paid") vs /vendor-dashboard/clients/[eventId] ("Your booking")
STEPS     Compare the paid figure on a roster row with the same client's card.
EXPECTED  One reader (`event_vendor_money_read` / `resolveEventMoney`).
ACTUAL    The row: page.tsx `computeEventMoneyPositions(paydayRows)` sums confirmed `vendor_payday_installments`. The card:
          lib/booked-money-step.server.ts reads `event_vendor_payments` directly and folds it locally (`clientPaymentView` / `yourBookingView`).
          Two sources for one "paid"; neither is the house reader (rg finds no `resolveEventMoney` / `event_vendor_money_read` in clients/[eventId]).
RULE      design-and-wiring C8 · CLAUDE.md §4 Budget row
SEVERITY  money-signin
SOURCE    CODE
```

```
A6-35
PAGE      /vendor-dashboard/customers (Events)
BUTTON    Booked tile → "This month"
ACTUAL    `fetchVendorRoomEventsDetailed(…).catch(() => ({ events: [], complete: false }))`: the tile says couldn't load (monthCount null) while the
          list under it says "No events booked this month." The pool-bookings read uses `fetchVendorPoolBookings` (drops `complete`), so held dates lose
          their booked marks silently. The `vendor_branches` read error is never checked → everyone grouped as "Main".
RULE      CLAUDE.md §5 rule 4
SEVERITY  wrong
SOURCE    CODE
```

```
A6-36
PAGE      /vendor-dashboard/customers?seg=dates&day=YYYY-MM-DD
STEPS     The schedules, pool-bookings or waitlist read fails.
EXPECTED  A "couldn't load" line, as the same day already draws for blocks and holds.
ACTUAL    Uses `fetchVendorPools` (`?? []`), `fetchVendorPoolBookings`, `fetchVendorWaitlist` → `pendingCount ?? 0`: a booked day looks open with 0 waiting
          — at an expo this is the answer a supplier gives a couple. The month view has the same waitlist gap. A failed plan read
          (`tierProbe.error` unchecked) falls back to the entry plan's ceiling (PLAUSIBLE).
RULE      CLAUDE.md §5 rule 4
SEVERITY  wrong
SOURCE    CODE
```

```
A6-37
PAGE      /vendor-dashboard/customers
ACTUAL    lib/lock-request-state.ts `const CONFIRMED = new Set(['contracted', 'deposit_paid', 'delivered', 'complete'])` drives the roster lanes —
          a copy of `BOOKED_EVENT_VENDOR_STATUSES`.
RULE      design-and-wiring C8
SEVERITY  wrong
SOURCE    CODE
```

```
A6-38
PAGE      /vendor-dashboard/customers
ACTUAL    (a) toast "Booking from outside added — free." (a price word in UI; PLAUSIBLE); (b) Money's locked line "Couples pay you directly and we
          never take a cut — Setnayan bills you a booking fee…" — a commission claim beyond the one allowed sentence (PLAUSIBLE: supplier-facing);
          (c) typed hub addresses (`?gear=1`, `?door=asking`, `?seg=dates&m=…`) instead of a lib/routes.ts builder.
RULE      brand.md claims 2–3 · design-and-wiring A3
SEVERITY  wrong
SOURCE    CODE
```

```
A6-39
PAGE      /vendor-dashboard/customers
ACTUAL    No loading.tsx under customers/: the page borrows app/vendor-dashboard/loading.tsx ("Loading supplier dashboard", 6 stat tiles) — the skeleton draws
          what this page never draws. The @client slot's loading.tsx returns `null` (a tap shows nothing until the card arrives).
RULE      CLAUDE.md §3 loading (skeleton draws only what the page draws)
SEVERITY  look
SOURCE    CODE
```

```
A6-40
PAGE      /vendor-dashboard/customers
ACTUAL    `text-[13.5px]`, `text-[9.5px]`, `text-[12.5px]` (half pixels) in page.tsx / customers-roster / customers-calendar / customers-pin; `!bg-white` in
          customers-calendar; `text-danger-700` in shop-wallet-sheet; many `text-[13px]`/`[15px]`/`[17px]` in money-view / money-log.
RULE      CLAUDE.md §3 type / colour
SEVERITY  look
SOURCE    CODE
```

```
A6-41
PAGE      /vendor-dashboard/customers
BUTTON    "Add a booking from outside"
ACTUAL    A half `Sheet` (outside-client-add.tsx) with 7 rows (Name · Schedule/Halls · Date · Time · To · Contact · Note), whose date rows open their own picker
          — a tall half-sheet and a popup on a popup.
EXPECTED  FULL-SCREEN POPUP (RiseScreen).
RULE      SHAPE (owner 25 Nov)
SEVERITY  look
SOURCE    CODE
```

```
A6-42
PAGE      /vendor-dashboard/customers?wallet=1
BUTTON    Shop wallet
ACTUAL    A `Sheet`, but it is opened by its own address and linked from a client uploader (`SHOP_WALLET_HREF`).
EXPECTED  Test 1 (returned to by link) → its own PAGE.
RULE      SHAPE (owner 25 Nov)
SEVERITY  look
SOURCE    CODE
```

### /vendor-dashboard/clients/[eventId]

```
A6-43
PAGE      /vendor-dashboard/clients/[eventId]
BUTTON    "Confirm payment received" (hidden) · Asks · Change orders
STEPS     The booking-row read (`evRow`) fails.
EXPECTED  "Couldn't load".
ACTUAL    page.tsx `{ data: evRow }` (error unbound) → `eventVendorId = completion?.vendor_id ?? null` → change orders become `{ data: null, error: null }`
          (counted as measured), asks `{ rows: [], complete: true }`, refunds `: 0`, and the recorded-payment card is hidden (`depositRecorded && eventVendorId`).
RULE      CLAUDE.md §5 rule 4
SEVERITY  money-signin
SOURCE    CODE
```

```
A6-44
PAGE      /vendor-dashboard/clients/[eventId]
STEPS     The booking-fee bills read fails.
EXPECTED  "Couldn't read your fees".
ACTUAL    `clientFeeBillsRead === FEE_BILLS_UNREADABLE ? [] : …` (same for waived) → `<BookingFeeBills bills={[]}>` — a fee owed for this couple disappears silently.
RULE      CLAUDE.md §5 rule 4
SEVERITY  money-signin
SOURCE    CODE
```

```
A6-45
PAGE      /vendor-dashboard/clients/[eventId] (Payment)
STEPS     The pending-payments read fails (the same unbound reads as A6-02).
ACTUAL    "No payments to confirm yet…" / "Nothing waiting on you…" over a payment the couple really logged.
RULE      CLAUDE.md §5 rule 4
SEVERITY  money-signin
SOURCE    CODE
```

```
A6-46
PAGE      /vendor-dashboard/clients/[eventId]
ACTUAL    Pesos by local functions: page.tsx `fmtDelta`, `fmtPeso` (`₱${php.toLocaleString('en-PH'…`), `fmtPesoCentavos`; payment-asks-panel.tsx `peso()`;
          booking-money-summary.tsx imports `formatPhp` from `@/lib/orders` (re-export).
RULE      CLAUDE.md §1 money (lib/php.ts)
SEVERITY  money-signin
SOURCE    CODE
```

```
A6-47
PAGE      /vendor-dashboard/clients/[eventId]
BUTTON    "Contract"
ACTUAL    (a) A failed brief read: `if (error || !data) redirect('/vendor-dashboard/clients')` — looks like "not your client";
          (b) a failed contracts read → `hasContract = false` → "Contract" goes to `/vendor-dashboard/contracts/new?event=…`;
          (c) schedule-block, cocktail-gate and poster reads ignore errors → an empty day, "no poster yet".
RULE      CLAUDE.md §5 rule 4
SEVERITY  wrong
SOURCE    CODE
```

```
A6-48
PAGE      /vendor-dashboard/clients/[eventId]
ACTUAL    The headcount card shows `brief.pax.attending … of … invited` (and invited before booking), not the count by `events.headcount_basis` the supplier's pax
          follows (CLAUDE.md §4). PLAUSIBLE — the RPC internals were not traced.
RULE      CLAUDE.md §4 Guest row
SEVERITY  wrong
SOURCE    CODE
```

```
A6-49
PAGE      /vendor-dashboard/clients/[eventId]
ACTUAL    "Their monogram & palettes, pulled from the mood board." — the word is Logo Maker / logo.
RULE      brand.md word rules
SEVERITY  wrong
SOURCE    CODE
```

```
A6-50
PAGE      /vendor-dashboard/clients/[eventId]
BUTTON    "Confirm payment received" + "Mark service complete" · Schedule: "Accept" per change order + "Send to couple"
ACTUAL    Both legacy `.button-primary` buttons draw on Details at once (booked, payment recorded, service not yet complete); the Schedule tab has a primary
          "Accept" on every change-order row plus "Send to couple".
RULE      HOUSE_DESIGN_STANDARD K1 · CLAUDE.md §3 button (`.button-primary` legacy)
SEVERITY  look
SOURCE    CODE
```

```
A6-51
PAGE      /vendor-dashboard/clients/[eventId]
ACTUAL    Hand-made buttons (`rounded-lg bg-ink px-3 py-2 … text-cream` "Open chat" and 5 more), hand frames (`rounded-2xl border border-terracotta/30 …`),
          a hand-rolled input, `shopInputClass` (legacy), numbered palette classes (`bg-success-100`, `text-success-600`, `text-terracotta-700`,
          `border-danger-300 bg-danger-50`), `text-[12.5px]`; typed routes to production-sheet / seat-plan / cocktail / mood-board / editorial-media
          where `lib/routes.ts` builders exist.
RULE      CLAUDE.md §3 · design-and-wiring A3 / D12–13
SEVERITY  look
SOURCE    CODE
```

### /vendor-dashboard/clients/[eventId] sub-pages

```
A6-52
PAGE      /vendor-dashboard/clients/[eventId]/their-event/[part]
BUTTON    "View" on each schedule row
ACTUAL    their-event-part-body.tsx `<span className="shrink-0 text-sn-md text-ink/55">View</span>` inside a plain `<li>` — looks pressable, does nothing (PLAUSIBLE).
RULE      design-and-wiring B5
SEVERITY  broken
SOURCE    CODE
```

```
A6-53
PAGE      /vendor-dashboard/clients/[eventId]/challenge-photos
ACTUAL    Today a page; a photo/video grid that nothing links to by address → should be a FULL-SCREEN POPUP. Also `bg-black/20`, `text-white`,
          `rounded-[var(--m-r-sm)]`; a photo whose link fails to sign is skipped (`if (!tileUrl) continue`) so "N shared" undercounts (PLAUSIBLE).
RULE      SHAPE · CLAUDE.md §3 colour · §5 rule 4
SEVERITY  look
SOURCE    CODE
```

```
A6-54
PAGE      /vendor-dashboard/clients/[eventId]/editorial-media
STEPS     The eligibility read fails (lib/editorial-vendor-media.ts `const { data: evRows } = await admin…`, error unbound).
EXPECTED  "Couldn't read".
ACTUAL    "Not available for this event yet … Once you're the couple's confirmed pick here" — a false claim; the same read drives the client page's
          "Add to their editorial" tile. SHAPE: today a page; photo/clip capture with no deep link → should be FULL-SCREEN POPUP.
          Also `rounded-[var(--m-r-md)]`, `text-[13px]`.
RULE      CLAUDE.md §5 rule 4 · SHAPE
SEVERITY  wrong
SOURCE    CODE
```

```
A6-55
PAGE      /vendor-dashboard/clients/[eventId]/mood-board
BUTTON    "Back to event brief"
ACTUAL    (a) a failed board read: `if (error || !data) redirect(vendorClientSurfaceHref(eventId, 'brief', …))` — silent bounce;
          (b) a failed colour-grant read is only `console.error`ed → no swatches; (c) `briefRes.error` never checked → the event line disappears;
          (d) typed `/vendor-dashboard/clients/${eventId}?tab=details`; `text-[14px]`; no PageMasthead; two reads after the batch (PLAUSIBLE rule 16).
RULE      CLAUDE.md §5 rule 4 · A3 · D16
SEVERITY  wrong
SOURCE    CODE
```

```
A6-56
PAGE      /vendor-dashboard/clients/[eventId]/their-event/[part]
ACTUAL    (a) a failed brief read: `redirect('/vendor-dashboard/customers')` — silent; (b) the Event Hub slug read ignores its error →
          "The hosts have not published their Hub yet."; (c) the heading and copy say "Hub" (lib/their-event.ts `hub: 'Hub'`), not "Event Hub".
RULE      CLAUDE.md §5 rule 4 · brand.md word rules
SEVERITY  wrong
SOURCE    CODE
```

```
A6-57
PAGE      /vendor-dashboard/clients/[eventId]/their-event/[part]   (Guests: "N in your group", "Matches the X booked")
ACTUAL    The group count is `group.guests.length` from the their-event RPC (migration `20271357741892_the_their_event_door.sql`), which filters only by group
          and event — declined, deleted, passed-away and represented guests all count, while the catering RPC applies `countsTowardEvent`'s rules.
EXPECTED  The headcount comes from the ONE reader's rules.
RULE      design-and-wiring C8 · CLAUDE.md §4 Guest row
SEVERITY  wrong
SOURCE    CODE
```

```
A6-58
PAGE      /vendor-dashboard/clients/[eventId]/cocktail · /production-sheet · /their-event/[part]
ACTUAL    Reads are honest on cocktail and production-sheet (`partReadOutcome`). Look only: typed `text-[10px]`…`[17px]`, `px-[14px] py-[10px]`,
          `h-[22px] border-[3px]`, `bg-[rgb(var(--sn-frame-bg))]`, `shadow-[inset_0_0_0_1.5px_…]`, `rounded-[var(--m-r-*)]`; their-event uses hand-made `<h1>`s
          (no PageMasthead), `text-terracotta-700`, and typed `/vendor-dashboard/clients/${eventId}` / `/dashboard/${eventId}` routes.
RULE      CLAUDE.md §3 type / radius / colour / page title
SEVERITY  look
SOURCE    CODE
```

### /vendor-dashboard/booking-fees · /booking-fees/[orderId]

```
A6-59
PAGE      /vendor-dashboard/booking-fees   (Kusina ni Aling Nena Catering)
BUTTON    the "Waived — nothing owed" section
STEPS     1. Open Booking fees while the shop-profile read (`fetchOwnVendorProfile`) answers null or fails.
EXPECTED  "We couldn't load your waived fees just now."
ACTUAL    `fetchWaivedFeeCharges(admin, profile?.vendor_profile_id)` returns `[]` for a missing id, so the section is simply
          absent — it reads as "you had no free bookings", the exact case the page's own comment says it must never draw.
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  money-signin
SOURCE    CODE
```

```
A6-60
PAGE      /vendor-dashboard/booking-fees/[orderId]
BUTTON    (page load)
STEPS     1. Open one fee. 2. The payments read (`fetchPaymentsForOrder`) or the settings read is refused.
EXPECTED  The page's own "We couldn't load this fee right now" (BookingFeeReadFailed), as the order read already does.
ACTUAL    `fetchPaymentsForOrder` throws inside `Promise.all` with no catch → the vendor-dashboard error screen. Only the
          FIRST read is honest-in-place.
RULE      CLAUDE.md §5 rule 4
SEVERITY  wrong
SOURCE    CODE
```

```
A6-61
PAGE      /vendor-dashboard/booking-fees · /booking-fees/[orderId]
ACTUAL    (a) page.tsx's docblock types the fee rate and peso bounds ("5% … 3% beyond ₱…, never more than ₱…, minimum ₱…") —
          a price in a comment; (b) /booking-fees runs 5 reads one after another (orders, profile, waived, schedule,
          launch offer) — not one `Promise.all`; (c) [orderId] reads the same `booking_fee_charges` row twice with the
          service role (found-you, then top-up), sequentially, after the batch.
RULE      CLAUDE.md §1 (never write a price into a comment) · design-and-wiring D16 (one batched read)
SEVERITY  wrong
SOURCE    CODE
```

```
A6-62
PAGE      /vendor-dashboard/booking-fees/[orderId]
ACTUAL    Look only: typed `text-[17px]`, `text-[rgb(var(--color-link))]` on the Screenshot link, `!text-[13px]`; the
          payment log prints the raw `paid_at` string ("Paid 2026-11-20") while every other date on the page is formatted.
RULE      CLAUDE.md §3 type / colour
SEVERITY  look
SOURCE    CODE
```

### /vendor-dashboard/calendar/[date]

```
A6-63
PAGE      /vendor-dashboard/calendar/[date]
ACTUAL    A redirect stub, not a page: a valid date → `daySheetHref(date)` (Customers › Dates day sheet, `notice` kept when it
          is a plain word); anything else → 404. Nothing to report in code; the browser pass checks it lands on the day.
SEVERITY  —
SOURCE    CODE
```

### /vendor-dashboard/contracts/[contractId] · /contracts/new

```
A6-64
PAGE      /vendor-dashboard/contracts/new · /contracts/[contractId] (Cancel · Make visible)
BUTTON    "Upload draft" · "Cancel contract" · "Make visible to couple"
STEPS     1. Upload a PDF over the size limit, or a non-PDF renamed .pdf (or publish a contract another tab just cancelled).
EXPECTED  The reason next to the field, in plain words, the form kept (Add 5 "Clear errors").
ACTUAL    contracts/actions.ts answers every bad input with `throw new Error('…')` ("Title must be 1–200 characters.",
          `validation.reason`, "Cancelled contracts cannot be re-published."). In production Next hides a thrown
          server-action message, so the person gets the dashboard error screen and loses what they typed.
RULE      FINAL-CHECK Add 5 (clear errors · forgiving)
SEVERITY  broken
SOURCE    CODE
```

```
A6-65
PAGE      /vendor-dashboard/contracts/[contractId] · /contracts/new · /disputes
BUTTON    (signed out)
STEPS     1. Open a contract link (from a notification) while signed out. 2. Sign in.
EXPECTED  Back on the contract (`loginRedirectPath(...)`, as booking-fees does).
ACTUAL    `redirect('/login')` with no return address on all three pages — the person lands on the dashboard, not the contract.
RULE      kit § 5.1 (Back / deep links) · Law 9
SEVERITY  broken
SOURCE    CODE
```

```
A6-66
PAGE      /vendor-dashboard/contracts/[contractId]
ACTUAL    Publish and Cancel `revalidatePath('/vendor-dashboard/contracts')` — a redirect stub — but not the hub where the
          contracts list is drawn (`/vendor-dashboard/customers`) nor the couple's page that shows the contract.
RULE      design-and-wiring C9 (revalidate every affected route)
SEVERITY  wrong
SOURCE    CODE
```

```
A6-67
PAGE      /vendor-dashboard/contracts/new · /contracts/[contractId]
ACTUAL    Look / words: the title hint is a photographer's example ("Wedding photography package — June 14, 2027") on every
          shop, including a caterer; the cancel reason hint is "Couple changed terms / pricing renegotiated / etc.";
          typed `/vendor-dashboard/messages` and `/vendor-dashboard` routes (not `lib/routes.ts`); typed `text-[11px]`,
          `text-[13px]`; "their dashboard" (couples call it their event).
RULE      CLAUDE.md §3 type · design-and-wiring A3 (routes.ts) · Add 3 (placeholders)
SEVERITY  look
SOURCE    CODE
```

### /vendor-dashboard/disputes

```
A6-68
PAGE      /vendor-dashboard/disputes
BUTTON    "Submit my response" / "Update my response"
STEPS     1. Open an open dispute. 2. The team rules on it in another tab. 3. Press Update my response.
EXPECTED  "This dispute has already been reviewed …" next to the box, the words kept.
ACTUAL    `submitDisputeContest` throws that sentence; production hides it → the error screen, the typed response is lost.
RULE      FINAL-CHECK Add 5 (clear errors · forgiving)
SEVERITY  broken
SOURCE    CODE
```

```
A6-69
PAGE      /vendor-dashboard/disputes
ACTUAL    Look: the contest button is the legacy `button-primary text-sm` (no icon, no `ActionButton`); typed `text-[14px]`,
          `text-[15px]`, `text-[13px]`; the no-profile state is a bare `<p>` with no empty-state piece.
RULE      CLAUDE.md §3 Button / Type / Empty
SEVERITY  look
SOURCE    CODE
```

```
A6-70
PAGE      /vendor-dashboard/contracts/new
ACTUAL    Shape (Add 1): today its own page; four fields plus a file pick, reached from a client or Contracts → should be a
          FULL-SCREEN POPUP that returns to where the supplier started. Change ships only after a drawing.
RULE      FINAL-CHECK Add 1
SEVERITY  look
SOURCE    CODE
```

### QR codes made in area 6 (Add 10b, code side)

```
A6-71
PAGE      /vendor-dashboard/customers (Dates › "Book a client" · day sheet "Show a QR" · client "Send their code") → /vendor/lock/[token]
BUTTON    the booked (Locked) QR for a date
STEPS     1. Issue a booked QR for Sat 9 Jan to couple A. 2. Before A scans, issue another for the same date to couple B
          (or block the day). 3. A and B both scan.
EXPECTED  The second scan is told the date is no longer open; the supplier is told which one won.
ACTUAL    `issueLockedQr` (invite/actions.ts) checks the day only when the code is MADE — and fails OPEN on a read error
          ("fail-open on a query error"). `vendor_claim_locked_qr` (latest: migration …_booked_qr_client_and_quote_on_claim…)
          checks only the token's own state (void / taken) and never the day's capacity or blocks, so both claims book the
          same date. This is exactly the "same date held twice" case #8284's sync must catch, and it is open today online too.
RULE      FINAL-CHECK Add 10b (3) · CLAUDE.md §5 rule 4 (fail-open read)
SEVERITY  wrong
SOURCE    CODE
```

## Phase B · the walk on the staging copy

Signed in as the area 6 supplier (Kusina ni Aling Nena Catering). Preview commit `bd86936` (`/api/health`, env preview).
Every load done with Playwright Chromium at 375 × 812, 768 × 900 and 1280 × 900; dark set through the `sn-theme` cookie
(the switch's own cookie). Third-party hosts this container cannot reach (vercel.live, the captcha) were blocked so they
do not count against a page's time.

### Across the area

```
A6-B01
PAGE      every area 6 page (worst: /vendor-dashboard/messages)
STEPS     1. Open the page signed in. 2. Time the server's first byte with curl (no browser).
EXPECTED  Usable in about 0.7 s; never over 2 s.
ACTUAL    /api/health answers in 0.6 s, but signed-in pages take 3 s to 110 s: /vendor-dashboard/messages first byte 108 s
          (curl), Clients 3–90 s, a thread 10–90 s, many loads past Playwright's 90 s limit. Health is fast, so it is the
          database side. CAVEAT: the staging branch is shared by 8 checkers at once; production may not show this. The
          controller should measure the same routes on production before counting it.
RULE      kit § 5.10 (speed)
SEVERITY  wrong (blocks nothing; every flow ends, just slowly)
SOURCE    WALK
```

```
A6-B02
PAGE      21 of the 22 area 6 pages (all but /vendor-dashboard/customers)
STEPS     1. Choose Dark. 2. Open Clients (dark). 3. Open Chats, a thread, Booking fees, On the day, a client.
EXPECTED  DARK: yes on every signed-in page (Add 7), or the switch says where dark is not ready.
ACTUAL    `lib/appearance.ts` `DARK_READY` lists only `/vendor-dashboard/clients$` and `/vendor-dashboard/customers$` for
          the supplier; every other page paints light. Leaving Clients for Chats or a client flips the whole screen from
          navy to white. DARK: yes = 1 page · DARK: no = 21 pages.
          Also (Add 7, one design for four roles): the supplier's dark is "its own navy" (`supplier-look.css`), not the
          couple's dark — a role with its own dark shade, which Add 7 counts as a finding.
SHOTS     customers-375-dark vs booking-fees-375-dark (light) — kept by the checker, not committed
RULE      FINAL-CHECK Add 7 · DARK_MODE_STANDARD
SEVERITY  look
SOURCE    WALK + CODE
```

```
A6-B03
PAGE      /vendor-dashboard/messages · /vendor-dashboard/customers · the thread header
STEPS     1. Open Clients. 2. Open Chats.
EXPECTED  One event, one name everywhere.
ACTUAL    Clients: "Lolo Ben at 80 · Birthday", "ÑAÑEZ-O'BRIEN CLAN REUNION 2026 (all branches!!)"; Chats list:
          "Lolo's Birthday (Dec 15)", "ÑAÑEZ-O'BRIEN's Reunion …"; the thread header uses the Clients name again. Two
          readers name one event two ways.
RULE      design-and-wiring C8 (one reader per shared fact)
SEVERITY  wrong
SOURCE    WALK
```

```
A6-B04
PAGE      /vendor-dashboard/messages/[threadId] → /vendor-dashboard/clients/[eventId]?tab=chat
STEPS     1. Open the reunion thread at 768 dark.
EXPECTED  No failed request.
ACTUAL    The page reported a client fault and `POST /api/telemetry/client-fault` answered 500 — so the fault itself was
          lost. (May be the copy's write locks; the controller should check the route on production.)
RULE      kit § 5.1 (no 5xx)
SEVERITY  broken
SOURCE    WALK
```

### /vendor-dashboard/customers (Clients · Events · Money · Dates)

```
A6-B05
PAGE      /vendor-dashboard/customers?tab=bookings&seg=money › Bookings
STEPS     1. Clients › Money. 2. Open Bookings.
EXPECTED  Each row shows its event date and the booking's own state, the same as the Events list.
ACTUAL    All 7 rows read "NO DATE SET" although every event has a date (Clients: Dec 15, Jan 9, Jan 24, Feb 23, Mar 25 …).
          States disagree with Events: Sofia's 18th, the reunion and Bea & Paolo are "Booked" on Events but
          "IN CONVERSATION" on Bookings; filter chips say "All 7 · New 2 · In progress 3 · Closed 2" while the header says
          "Booked 3 · Asked 2". The list is drawn from threads, not from `BOOKED_EVENT_VENDOR_STATUSES` (A6-37, now seen).
RULE      design-and-wiring C8 · CLAUDE.md §4 (booked = BOOKED_EVENT_VENDOR_STATUSES)
SEVERITY  wrong
SOURCE    WALK
```

```
A6-B06
PAGE      /vendor-dashboard/customers?seg=money (the top strip)
ACTUAL    "₱0 received · ₱239K to come in · 0 overdue" and "0% of ₱239,400 booked". The bar measures what is COLLECTED, but
          the words say "booked" — a supplier with three bookings reads "0% booked". Should read "0% of ₱239,400 received".
RULE      brand.md (plain words) · Add 2 EFFECTIVE
SEVERITY  wrong
SOURCE    WALK
```

```
A6-B07
PAGE      /vendor-dashboard/customers?seg=money · Clients › Events rows
STEPS     1. The seed logged three couple payments to this shop (a reservation fee on Sofia's 18th; the full amount on Mika's
          and on one delivered booking). 2. Open Clients, then Money.
EXPECTED  The money hub says "3 payments logged — confirm them" and links to each (it is the supplier's next money job).
ACTUAL    Money says "Nothing due this month", "0 overdue", "This year · Nothing confirmed yet". The Events row for Sofia reads
          "₱0 paid · next ₱14,364" — ₱14,364 is the reservation fee the couple ALREADY logged, shown as if still to be asked
          for. The logged payment and its "Confirm received" only appear inside the client's Payments tab.
          (₱0 received itself is honest: nothing is confirmed yet.)
RULE      Add 2 EFFECTIVE (the job is obvious) · Add 5 (fewest taps to "log a payment")
SEVERITY  money-signin
SOURCE    WALK
```

```
A6-B08
PAGE      /vendor-dashboard/customers (all segments)
ACTUAL    Every ⓘ is a 16 × 16 px tap target (8 to 30 per screen); the Money top has an empty tinted band above the strip; the
          floating ✓ button (bottom right) on Money has no label and its job is unclear; the Bookings fold draws a frame
          inside a frame.
RULE      Add 5 (44 px targets) · Add 2 CLEAN
SEVERITY  look
SOURCE    WALK
```

### /vendor-dashboard/clients/[eventId]

```
A6-B09
PAGE      /vendor-dashboard/clients/[eventId]   (Bea & Paolo, at 375)
STEPS     1. Open the client from Clients.
EXPECTED  The page draws with no error.
ACTUAL    First load: React error #418 (hydration mismatch) then "Cannot read properties of null (reading 'parentNode')";
          the chat sat at "Loading the chat…" and DECISIONS at "Checking…" past the 90 s mark. A second load drew it after
          ~3 minutes. `POST /api/telemetry/client-fault` answered 500 on both loads (A6-B04).
RULE      kit § 5.1
SEVERITY  broken
SOURCE    WALK
```

```
A6-B10
PAGE      /vendor-dashboard/clients/[eventId]?tab=chat   (Bea & Paolo — Booked)
ACTUAL    A booked client still shows the inquiry card "An inquiry · Your turn · Reply with an offer", and the quick replies
          offer "Sending our price now" — on a booking that is already agreed. The header says Booked; the card says it is
          the supplier's turn to quote.
RULE      design-and-wiring C8 (booked state from one reader)
SEVERITY  wrong
SOURCE    WALK
```

```
A6-B11
PAGE      /vendor-dashboard/clients/[eventId]?tab=payments (Book & Budget)
ACTUAL    The logged payment's method prints the raw code "bank_transfer"; "Payment · awaiting your confirmation · ₱47,880"
          is said three times on one screen (Next row, plan row, logged row); Agreed / Paid / To collect use three colours
          for three amounts; the floating wallet button covers the "Asks" heading at 375.
RULE      Add 2 (plain labels, never internal codes · CLEAN)
SEVERITY  look
SOURCE    WALK
```

### /vendor-dashboard/on-the-day

```
A6-B12
PAGE      /vendor-dashboard/on-the-day
STEPS     1. Open On the day (the shop is Booked on Sofia's 18th, the reunion and Bea & Paolo per Clients).
EXPECTED  The booked events, soonest first.
ACTUAL    "No events yet" + "See your customers". On the day reads `fetchVendorRoomEvents` (schedule pool / claimed QR / …),
          not `BOOKED_EVENT_VENDOR_STATUSES`, so bookings Clients calls Booked do not exist here. (Caveat: the seed set
          `event_vendors.status` directly; if bookings made the real way always pass the room rule, this is a seed shape —
          but then the two readers still disagree for any booking made outside chat.) The reader also drops `complete`, so
          a failed read shows the same "No events yet".
          Desktop: the empty line sits in a narrow column with the rest of the 1280 page empty; two blue main buttons
          ("+ Create service card" in the top bar and "See your customers").
RULE      CLAUDE.md §4 (booked) · §5 rule 4 · K1
SEVERITY  wrong
SOURCE    WALK + CODE
```

### /vendor-dashboard/contracts/new

```
A6-B13
PAGE      /vendor-dashboard/contracts/new
STEPS     1. Clients › Money › Contracts › Upload (or open /vendor-dashboard/contracts/new). The shop has 7 chats.
EXPECTED  The event picker lists the 7 couples.
ACTUAL    "You need to be in conversation with a couple before uploading a contract. Open a chat with a couple from your
          messages first." No form. A supplier with seven open chats cannot upload a contract at all.
          (Likely the thread → event join (`t.event`) comes back empty for the supplier, so every thread is filtered out.)
RULE      kit § 5.2 (control reaches a real action)
SEVERITY  broken
SOURCE    WALK
```

### Booking fees · Disputes · Manpower · Notifications

```
A6-B14
PAGE      /vendor-dashboard/booking-fees
ACTUAL    Words: "Be the first to bring the event — your booking is free. Otherwise: 5% … — unless you are the first to bring
          the event." says the same rule twice in one sentence, under a separate "New to Setnayan through you? They book you
          free for 12 months." line — two free rules stacked, neither plain. Subtitle "Back to Plan" names a place the
          phone's bottom bar does not have (Plan is only in the desktop rail). No Waived section although the shop has
          5 booked events (cannot tell from the screen whether none were waived or the read is off — see A6-59).
RULE      Add 2 CLEAN · brand.md tone
SEVERITY  look
SOURCE    WALK
```

```
A6-B15
PAGE      /vendor-dashboard/disputes · /manpower · /contracts/new · /booking-fees
ACTUAL    Two back buttons: disputes and manpower use a white circle with "<"; contracts/new and booking-fees use a tinted
          circle with "←" plus a "Back to …" subtitle. One thing, two looks.
RULE      Add 5 "Same everywhere"
SEVERITY  look
SOURCE    WALK
```

### Signing in

```
A6-B16
PAGE      any /vendor-dashboard/* (seen on the 12 forwards)
STEPS     1. Stay signed in until the session needs a refresh. 2. Open several supplier pages in tabs at the same moment.
EXPECTED  All stay signed in.
ACTUAL    6 of 14 tabs landed on /login?next=…. Each tab refreshed the same session at once while the server took ~95 s to
          answer. Seen twice: once with 14 tabs at once, and once with one tab opening pages one after another
          (/vendor-dashboard/locked-qr bounced to sign-in; the next page was signed in again). Both on the slow copy; the
          controller should retry it on production before counting it.
RULE      kit § 6 (signing in)
SEVERITY  money-signin
SOURCE    WALK
```

### Client sub-pages (Sofia's 18th — Booked on Clients, `deposit_paid`)

```
A6-B17
PAGE      /vendor-dashboard/clients/[eventId]/production-sheet · /cocktail · /mood-board · /challenge-photos · /editorial-media
STEPS     1. Clients › Sofia's 18th (Booked). 2. Open Production sheet (or any of the four others).
EXPECTED  The sheet opens: the booking is Booked, and Booking fees says "Nothing to pay yet".
ACTUAL    A lock card: "This booking is not confirmed on Setnayan yet — The rest of this event — and this event's day-of tools —
          open once you accept this booking on Setnayan and its booking fee is settled." There is no Accept button and no fee
          to settle (Booking fees: "Nothing to pay yet"), so the supplier cannot get past it. Meanwhile the same booking's
          Their event › Schedule · Numbers · Guests open normally, and Clients calls it Booked. Three readers, three answers
          about one booking.
          (Caveat as A6-B12: the seed set the status directly, not through the chat lock; a real booking may pass the gate.
          Either way the lock names a fee that does not exist and offers no way forward.)
RULE      design-and-wiring B7 (honest 🔒: Problem → one button) · C8 · CLAUDE.md §4 (booked)
SEVERITY  money-signin
SOURCE    WALK
```

```
A6-B19
PAGE      /vendor-dashboard/clients/[eventId]/their-event/numbers
ACTUAL    "Invited 55 · Coming 35 · Maybe 5 · No reply 10" — the four numbers add to 50 of 55; the 5 who said no are not
          shown, so the sheet does not add up for the person reading it.
RULE      Add 2 EFFECTIVE
SEVERITY  wrong
SOURCE    WALK
```

### Calendar day and the forwards

```
A6-B20
PAGE      /vendor-dashboard/calendar/2027-01-09 → /vendor-dashboard/customers?seg=dates&day=2027-01-09 (the day sheet)
STEPS     1. Open the day of Sofia's 18th (Booked on Clients, Sat 9 Jan 2027).
EXPECTED  "1 booked · Sofia's 18th".
ACTUAL    "Saturday, January 9, 2027 · in 6 weeks · Catering schedule · Still has room · 0 booked". The date a booked event
          sits on reads as open — the supplier could sell it again (and a booked QR can be made for it, A6-71).
RULE      CLAUDE.md §4 (booked = BOOKED_EVENT_VENDOR_STATUSES) · design-and-wiring C8
SEVERITY  wrong
SOURCE    WALK
```

```
A6-B21
PAGE      /vendor-dashboard/recaps → /vendor-dashboard/shop/promote#share
ACTUAL    Lands on Promote with `#share` drawn but NOT scrolled into view at 375 (the page opens at its top). Every other
          forward with an anchor landed in view.
RULE      Law 9 (every way in lands)
SEVERITY  wrong
SOURCE    WALK
```

### Offline (Add 10, tried on the copy)

```
A6-B22
PAGE      /vendor-dashboard/on-the-day · /vendor-dashboard/clients/[eventId]?tab=chat
STEPS     1. Open the page online (a service worker is registered). 2. DevTools offline. 3. Reload.
EXPECTED  The saved copy, or Setnayan's own offline page that says what still works.
ACTUAL    Without a reload the open page stays and shows "You're offline". On reload both give the browser's own
          "no internet" error (ERR_INTERNET_DISCONNECTED) — no Setnayan offline page, no saved copy. (On the day had no
          booked event to save — A6-B12 — so its saved copy could not be tried; a chat is not saved by design today.)
          Back online the page has to be reloaded by hand.
RULE      FINAL-CHECK Add 10
SEVERITY  wrong
SOURCE    WALK
```

### Lock link · Clients in dark

```
A6-B23
PAGE      /vendor/lock/[token]
STEPS     1. Open a lock link whose token is unknown (an old, mistyped or deleted code).
EXPECTED  The page's own words for a code that does not work ("This Locked QR is no longer valid.") and what to do next.
ACTUAL    The generic 404: "This page doesn't exist on Setnayan." A couple who scans a dead booked QR at an expo is not told
          it was a QR from this shop, nor to ask the supplier for a new one. (A real token could not be walked: none exists
          on the copy, and making one would hold a date on a seeded event.)
RULE      kit § 5.9 (honest states) · Add 5 (clear errors)
SEVERITY  wrong
SOURCE    WALK
```

```
A6-B24
PAGE      /vendor-dashboard/customers (the one dark-ready page) at 768 and 1280, dark
ACTUAL    The open days on the month grid are pastel-green tiles on the navy page — a light surface on a dark page (Add 7
          "half dark"); "Handled by" is printed twice in the client panel (the label, then a button reading "Handled by");
          at 768 the two-pane split leaves the list ~330 px wide, so every row wraps to 3–4 lines and "Open the chat" is cut
          off at the bottom of the panel.
RULE      DARK_MODE_STANDARD · Add 2 CLEAN / BALANCED · Add 7 (tablet designed for)
SEVERITY  look
SOURCE    WALK
```

### Phase B progress — every page (Add 6 counts · Add 7 · Add 2)

Button counts are the controls a person can press on the page as drawn (the top bar's 4 and the bottom bar's 4 included),
at 375 / 768 / 1280. "Pressed" counts real presses that were checked (a press, its result, then Escape or Back). The
copy answered in 3–200 s per load (A6-B01), so not every control could be pressed in the session; the ones left are
named. Nothing was paid, sent, confirmed, declined or deleted.

| Page | Buttons 375 / 768 / 1280 | Pressed | Failed | Left, and why | DARK | CLEAN · BALANCED · EFFECTIVE |
|---|---|---|---|---|---|---|
| /vendor-dashboard/customers (Events · Dates) | 97 / 68 / 77 | 14 | 5? (week-strip days S 22, M 23, T 24, F 27, S 28 showed no visible change at 375 — may only move a marker) | 56 links (row doors, bottom bar) checked by where they lead, not pressed; 22 row/ⓘ presses blocked by an open sheet in the script; "Archived and closed chats" (would change data) | yes (partly: A6-B24) | CLEAN: ⓘ on every block, "Handled by" twice · BALANCED: ok at 375, squeezed at 768 · EFFECTIVE: no — Booked dates read open (A6-B20) |
| …?seg=money | 42 / – / – | 16 | 1 ("Bookings" fold: no change on first press) | 24 links; "This year" and "Contracts" folds (left by the script's safe list) | yes | EFFECTIVE: no — logged payments not surfaced (A6-B07), "0% … booked" (A6-B06) |
| /vendor-dashboard/messages | 26 / 11* / 37 | 1 (a chat row → the client chat) | 0 | All/Unread, search | no | ok · ok · ok (*768 opens the first chat in a pane) |
| /vendor-dashboard/messages/[threadId] → client ?tab=chat | ~170 at 1280 | 0 | — | the composer, quick replies, Ask for ₱…, Confirm received: would send or confirm on a shared seeded thread | no | CLEAN: inquiry card on a booked client (A6-B10) |
| /vendor-dashboard/notifications | 12 / 13 / (load timed out) | 0 | — | the one notification (opens area 2's message) | no | ok · ok · ok |
| /vendor-dashboard/booking-fees | 12 / 13 / 22 | 0 | — | 2 ⓘ (16 px) | no | CLEAN: the free rule said twice (A6-B14) |
| /vendor-dashboard/booking-fees/[orderId] | — | — | — | NOT WALKED: no fee bill exists for this shop on the copy | — | — |
| /vendor-dashboard/calendar/[date] | forward | 1 | 0 | — | (Dates) | lands on the day sheet; wrong count (A6-B20) |
| /vendor-dashboard/clients/[eventId] | 17–19 while loading · ~170 drawn | 2 (open, tab=payments) | 1 (first load stuck, A6-B09) | Confirm received / Not received / Record a refund / Ask: money on seeded data | no | EFFECTIVE: payments to confirm are three screens deep |
| …/challenge-photos · /cocktail · /editorial-media · /mood-board · /production-sheet | 9 each (Back + shell) | 1 (Back to the booking) | 0 | — | no | EFFECTIVE: no — a lock with no way forward (A6-B17) |
| …/their-event/[part] (schedule · numbers · guests · hub) | 9–10 | 0 | 0 | hub load timed out at 150 s | no | numbers do not add up (A6-B19) |
| /vendor-dashboard/contracts/[contractId] | — | — | — | NOT WALKED: no contract exists, and none can be uploaded (A6-B13) | — | — |
| /vendor-dashboard/contracts/new | 12 / 13 / 22 | 1 ("messages" link) | 0 | the form never draws (A6-B13) | no | EFFECTIVE: no |
| /vendor-dashboard/disputes | 11 / 12 / 21 | 0 | — | ⓘ; no dispute rows to open | no | ok · ok · ok |
| /vendor-dashboard/manpower | 11 / 12 / 21 | 0 | — | no gigs on the copy | no | ok · ok · ok |
| /vendor-dashboard/on-the-day | 11 / 12 / 21 | 0 | — | "See your customers" | no | BALANCED: a lone line in a wide page at 1280 · EFFECTIVE: no (A6-B12) |
| /vendor-dashboard/on-the-day/live/[eventId] · /papic | — | — | — | NOT WALKABLE: both redirect away unless a booked event is today; none is on the copy | — | — |
| /vendor/lock/[token] | 2 (404 page) | 0 | — | a real token needs a date hold on a seeded event | light only (public) | A6-B23 |

Forwards: 12 of 12 land (11 at their anchor in view; `/recaps` lands but not in view, A6-B21).

### Add 5 · the area's main jobs, on a phone, as a first-timer

| Job | Rating | The step that makes it hard |
|---|---|---|
| Reply to a chat | OK | the chat takes 10–170 s to draw on the copy; a booked client still shows "Reply with an offer" (A6-B10) |
| Confirm a payment the couple logged | HARD | nothing on Clients or Money says one is waiting (A6-B07); it is Clients › a client › Payments (3 taps) and the method reads "bank_transfer" |
| See whether a date is open | HARD | the day sheet says "0 booked · Still has room" on a booked date (A6-B20) |
| Upload a contract | HARD (cannot) | the form never appears for a shop with 7 chats (A6-B13) |
| Open the caterer's production sheet | HARD (cannot) | the fee lock with no button (A6-B17) |
| Make a booked QR for a couple | OK | 3 taps to the invite page (area 5); nothing warns the date is already booked (A6-71, A6-B20) |
| Pay a booking fee | not walked | no bill on the copy |

## Add 4 · Where area 6 sells (buy and upgrade points)

| # | Route · where | What is sold | Price shown before the button | How a person reaches it | Taps from the wall |
|---|---|---|---|---|---|
| 1 | /vendor-dashboard/booking-fees/[orderId] → /pay/[reference] | the booking fee on a booking | yes — the order's own amount (`formatPhp(headlineTotal)`), from the bill | Clients › Money › Booking fees › a bill › "Send your payment" (or a fee-gate "pay" link) | 4 to the pay page; NOT WALKED: the copy holds no fee bill for this shop ("Nothing to pay yet") |
| 2 | Clients › Dates › Waiting list (Free shop) | a paid plan (waiting list on full dates) | **no** — "See the plans · A waiting list on full dates comes with the paid plans" | Clients › Dates › Waiting list fold | 2 to /vendor-dashboard/subscription, then the plan page (area 5) |
| 3 | Clients › Money › This year (when locked) | Plus / Pro ("Plus and Pro carry the year") | **no** — "See plans" | Clients › Money › This year | 2 |
| 4 | Client › Files (storage full) | a plan with more storage | **no** — a status line + "See plans" | client page › Files › add a file at the limit | 1 + the plan page |
| 5 | On the day › live › album share switch | a plan that shares the album | **no** — "See plans" | On the day › an event's live console | 1 + the plan page |
| 6 | On the day (after the free day-of window ends) | a plan to keep day-of tools | **no** — "Upgrade to keep using the day-of tools · See plans" | On the day | 1 + the plan page |
| 7 | Event fee gate (production sheet, their event, day tools of a booking with an unsettled fee) | the booking fee | **no**, and on the copy no bill exists to pay (A6-B17) | client › Production sheet / Their event | dead end today |
| 8 | Clients › Money › "Shop wallet · 0 Papic credits" | Papic packs | the wallet page (area 5) | Clients › Money › Shop wallet | 2 |

```
A6-B18
PAGE      Clients › Dates (Waiting list) · Clients › Money (This year) · client › Files · live › album share · On the day
ACTUAL    Five upgrade doors in area 6 are a bare "See plans" / "See the plans" link: no plan name with its ₱ price before the
          press, no "what you get" lines, no current plan beside it, and a plain text link instead of ONE upgrade button.
EXPECTED  Add 4 EVIDENT: at the wall, one line + the plan name and its price from `vendor_billing_catalog` + one button
          opening the plan's checkout.
RULE      FINAL-CHECK Add 4 (price before pressing · at the wall) · design-and-wiring B7 (honest 🔒)
SEVERITY  wrong
SOURCE    WALK + CODE
```

## Offline — beyond the five (Add 10 · Add 10b)

The five full-offline places (owner 24 Nov) are not repeated here. Area 6 covers the **supplier** role only.

### Supplier

| Part (route · what it does) | When the signal drops | Level | Why (what breaks) |
|---|---|---|---|
| /vendor-dashboard/messages/[threadId] (client › Chat) — reply to a couple | at the venue on the day; on the road | SAVE AND SYNC | A reply typed in a dead zone is lost today; the composer should queue it and send on reconnect. Money cards (Ask for ₱…, Confirm received) must NOT queue — re-checked online. |
| /vendor-dashboard/messages — the chat list | on the road; a province with weak data | READ-ONLY | Seeing who wrote last and the event dates without a signal; nothing to change offline. |
| /vendor-dashboard/customers › Dates — "is this date open?" | at an expo booth | READ-ONLY | A supplier answers a walk-up couple from the last copy of the month; the answer is marked "as of …". |
| /vendor-dashboard/customers › Events — the bookings list | at the venue; on the road | READ-ONLY | Which events this week, the couple's name, the agreed amount — the supplier's day plan. |
| /vendor-dashboard/clients/[eventId] (Booking status · Your booking · Details) | at the venue on the day | READ-ONLY | The contact, the venue, the headcount and the agreed amount when the venue has no data. |
| /vendor-dashboard/clients/[eventId]/production-sheet | at the venue on the day | READ-ONLY | The caterer cooks and plates from it; today only print saves it (A6 phase A). |
| /vendor-dashboard/clients/[eventId]/their-event/schedule · numbers | at the venue on the day | READ-ONLY | The run of show and the final pax. |
| /vendor-dashboard/clients/[eventId]/cocktail · mood-board | at the venue on the day | READ-ONLY | The stylist's palette and the bar menu at set-up. |
| /vendor-dashboard/booking-fees · contracts/[contractId] | a province with weak data | READ-ONLY | See what is owed and the contract PDF; paying and publishing stay online. |
| client › Payments "Confirm received" | at the venue (couple pays cash on the day) | SAVE AND SYNC | The supplier marks the cash received on the spot; it syncs and the couple's budget updates when back online. Must re-check the amount at sync. |

### QR codes made in area 6 (Add 10b)

| QR | What it is | Where it is made | What the scanner sees | No signal today (code) | Back online: what can go wrong | Caught today? |
|---|---|---|---|---|---|---|
| Booked (Locked) QR — "Book a client" / "Show a QR" / "Send their code" | a date hold + booking for one couple (with the quote) | Clients › Dates day bar and day sheet; client › people "Send their code" → /vendor-dashboard/invite?mode=locked (area 5 makes the code) | /vendor/lock/[token]: the shop, the date, the quote, "Lock it in" | cannot be made: `issueLockedQr` is a server action | **the same date held twice**: two codes for one date both claim (A6-71); a price changed between issue and claim (the quote rides the token — unchanged, so the old price books); a code shown twice → `taken` ("This Locked QR has already been used.") | double hold NO · shown twice YES · removed phone n/a (codes are not per phone today) |
| Crew QR (Hub › Crew) | a crew member's pass into the supplier's event hub | On the day › an event › Crew | a join page; the phone waits for Allow | the QR is drawn server-side; shown only if the page was saved (On the day is in `supplierOfflinePaths`) | a forwarded QR admits nobody until Allow — safe | yes |
| Guest review QR | the shop's review form for today's event | On the day › Reviews card (Print · Show fullscreen) | the guest review form | shown from the saved On the day copy if saved; the guest needs a signal to send | a review sent twice | not checked |
| QR scanner (live console) | scans guests' passes / seats | On the day › live › Scanner | — | the live console is in `supplierOfflinePaths` | a guest checked in twice from two phones | (area 3/7 check-in) |

Taps from the supplier's home to a booked QR: Clients (1) › a date (2) › "Show a QR" (3) → the invite page (area 5).

## Second pass (25 Nov)

Fixer pass over the pages touched in fix batches 1–3, against Adds 11, 11b, 12, 13, 15, 17, 18. Lane A ones are fixed in
the batch named; the rest wait for their lane.

- [A · fixed, batch 3] **"Pull to refresh" told to a person, with the gesture switched off.** `app/globals.css` sets
  `overscroll-behavior: none` on `html` (owner, native feel) and no in-app pull-to-refresh exists, yet the supplier Schedule
  tab (4 lines), the locks section and the chat's "what is agreed" said "pull to refresh". Now "Nothing is lost — try again
  in a moment." (Add 11.3)
- [B] **No pull to refresh on any supplier list** (Clients, Chats, Disputes, Booking fees, On the day). The site turns the
  gesture off on purpose, so this is a drawing and an owner call: a list page refreshes by pulling down with the header
  staying, a spinner, no white gap. Reference: Instagram's feed pull-to-refresh; iOS Mail. (Add 11.3)
- [B] **Tap targets under 44 px:** every ⓘ on Clients is 16 × 16 (A6-B08, already in SW-TAP). (Add 11.8)
- [B] **Desktop On the day is a phone column in a wide page** at 1280 (A6-B12). Should use the width: the list of booked
  days on the left, the picked day on the right. Reference: iPad Mail split view. (Add 11b)
- [B] **Upload a contract is its own page**; Add 1 says a FULL-SCREEN POPUP on a phone and a centred dialog on desktop
  (A6-70). (Add 1 / 11b)
- [Icons] page `/vendor-dashboard/disputes` · control "Submit my response" · shows no icon (legacy `button-primary`) ·
  should mean "send your side" (a send or speech icon, the house `ActionButton`). (Add 13)
- [R] **`/vendor-dashboard/manpower`** — retired candidate: no door by owner ruling (9 Nov), and no gigs exist to claim on
  the copy; nothing in the supplier menu links to it (phase A note). Delete with a forward, or the owner keeps it. (Add 17)
- Add 12 (motion), Add 15 (logo), Add 18 (reveals): nothing new on these pages. The lock link's new "not valid / couldn't
  read" state uses the house terminal block (no logo copy, no reveal).

Skipped in lane A, with the reason (🟠 = needs the owner):
- 🟠 **A6-B07** (Money hub should say "N payments logged — confirm them"): adds a new count and row to Money — a look change
  (lane B), not a wording fix.
- 🟠 **A6-71** (two booked QRs for one date both book it): the fix is a date-capacity check inside the claim RPC — a
  booking rule and a migration; it changes who can book a date, so it waits for the owner.
- **A6-B01** (speed on the copy): the copy's setup (Add 14), not proven in code.
- **A6-B22** (offline reload shows the browser's error): needs a Setnayan offline page in the service worker — a look change.
