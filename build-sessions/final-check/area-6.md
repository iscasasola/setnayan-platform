# Final check · Area 6 · Supplier: bookings, chat, payments, calendar

Checker 6 of 8. Checked commit: `fb3f72d` (the pinned check commit). Report only.
Phase A = code pass (`SOURCE: CODE`). Phase B = browser walk on staging (later).

## BLOCKERS

None so far.

## Progress

Pages (22):

- [ ] /vendor-dashboard/booking-fees
- [ ] /vendor-dashboard/booking-fees/[orderId]
- [ ] /vendor-dashboard/calendar/[date]
- [ ] /vendor-dashboard/clients/[eventId]
- [ ] /vendor-dashboard/clients/[eventId]/challenge-photos
- [ ] /vendor-dashboard/clients/[eventId]/cocktail
- [ ] /vendor-dashboard/clients/[eventId]/editorial-media
- [ ] /vendor-dashboard/clients/[eventId]/mood-board
- [ ] /vendor-dashboard/clients/[eventId]/production-sheet
- [ ] /vendor-dashboard/clients/[eventId]/their-event/[part]
- [ ] /vendor-dashboard/contracts/[contractId]
- [ ] /vendor-dashboard/contracts/new
- [ ] /vendor-dashboard/customers
- [ ] /vendor-dashboard/disputes
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
