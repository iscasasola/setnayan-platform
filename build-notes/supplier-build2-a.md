# Supplier Build 2 · lane B2-A — Clients + Schedule

Branch `claude/supplier-build2-a` (from `origin/claude/supplier-1build`). Row order from the brief:
**#43 → #38 → #37 → #28 → #36 → #27 → #29 → #34 → #42**. No PR, no merge, no deploy.

Lab: `/dev/clients-lab` (L2's), dummy env only (`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:1`), never `.env.local`.
Shots: `build-notes/shots/b2a/sbs-<row>-<view>-<light|dark>.png` — v118 on the left, the build on the right, 375 px.

⚠ **Dark shots are forced.** The app paints dark only through `html.dark`, and `/vendor-dashboard` is NOT on
`DARK_READY` (`lib/appearance.ts`) — production shows the supplier dashboard in light only. The build's dark shots
add the class by hand so the dark rules can be judged before the area is listed.

## Done

### #43 — one Clients screen (commit `564748d68c`)
- (a) Events and Dates draw ONE screen: `CustomersPin` mounts the month on top (`oneScreen`), the tiles as their own
  row, Overdue / Unread, then every client under its day. `CustomersDates` is gone; `?seg=dates` lands on the same
  screen (`?seg=dates&day=` still opens the day page).
- (b) Pinned row: `Clients · N booked · ₱X to collect · ⚙` (`formatPhp`; ₱1M+ compact on the tile only).
- (c) Tiles: their own row under the month (v113 `.tot.t4`), dot · word · figure; pressed = ink fill.
- (d) Thumb row: Search clients · ⇅ · ＋. Check a date folded into the month's day bar.
- (e) Day heads read `SUN 8 NOV` (`dayHeadWords`, uppercased by CSS) on the list, the month and the picked day. The
  plain list is day-grouped (`DEFAULT_CLIENTS_GROUP = 'day'`): coming days soonest first → No date yet → past days.
- (f) Details: the numbers inline (dot · word · figure · small line), no box. The stage strip was already on top of
  the real Details page (`pipelineBlock`); the lab does not draw it.
- (g) Schedule month asking marks: read inside the SAME `whole` request (threads in the same `Promise.all`, then the
  asks' events). An unread ask stays `null` (no marks drawn), never "nobody asked".
- Picking a day: the day head + "Open the day ›" + ×, that day's rows; the whole list and Overdue/Unread hide.
  × or a tile lets the day go (`CLIENTS_LET_GO_DAY_EVENT`).
- Guard: `app/vendor-dashboard/customers/clients-is-one-screen.test.ts` (a)–(g). Sabotaged (b) PickMenu in the title
  row, (e) default group → status, (g) dropped the `measured` gate — each failed, each restored.
- Existing guards updated with reasons in place (anchors-land, customers-are-events, dates-is-one-calendar,
  money-is-rows, people-is-rows, the-customers-figures-are-the-pinned-row, the-roster-opens-on-who-is-waiting,
  lib/every-thumb-row-is-the-one-row). Clients guard set: **307 pass · 0 fail**.
- **Requests:** the Clients screen = the list's reads (unchanged) + the month's 5 reads started in parallel with them
  (dayStates · month waitlist · upcoming waitlist · settings · picked rows) + 1 asks events read; pools, bookings,
  blocks, threads, services and team are handed in, never read twice. Fewer than Events + Dates were together.
  Schedule month: still **1 request** (the `whole` action), with 2 more DB reads inside it.
- Shots: `sbs-43-clients`, `sbs-43-day-picked`, `sbs-43-list`, `sbs-43-details`, `sbs-43-schedule` (light + dark).

### #38 — one open path
- `lib/upcoming-schedule-door.ts`: `clientLandingPage(facts)` + `openClientHref` beside `customerCardHref` — the
  prototype's `startPage` order: explicit page → money due (Payment; Quotation before booking) → unread → Chat →
  asking → Chat → quoted → Quotation → event today → Hub → Details. Chat only when a thread exists.
- Clients rows (`customers-roster.tsx` `hrefFor`): Asking (inquiry, hold) → Chat · booking ask → Details (v116
  "Booking" falls to Details, where Today's Agree already lands) · Talking/Quoted → Quotation · Booked/Done → Details
  (Hub on the event day) · no chat → Details. The row's door is worded by its landing (Open the chat · Open the
  quotation · Open their details · Open their Hub); the step label "See the day" → "See details".
- Tile rows (`clientPageHref`) go through the same path. Today's Reply cards (inquiry with an event, unread message)
  open the client's Chat page instead of the bare thread.
- `visiblePickedPage`: an unbooked client asked for Payment draws the Quotation (was Details) — covers every old door
  and every `?tab=payments` notification.
- Guard: `customers/one-open-path.test.ts`. Sabotaged: unbooked Payment → Details, `hasChat: true`, quoted before
  unread — each caught. Old pins re-anchored with reasons (one-event-one-chat-title, the-picked-client-has-nine-pages,
  the-customers-counts-filter-in-place, the-upcoming-row-opens-the-customer-card, people-is-rows, the-roster-pages,
  supplier-today). Wide guard set **337 pass · 0 fail**.
- **Requests:** 0 added — the landing is decided from what each row already carries.
- Shots: `sbs-38-asking-opens-chat`, `sbs-38-booked-opens-details` (lab's picked client is always its stand-in).

### #37 — one picked mark + one swipe
- `app/_components/calendar-day-box.tsx` (new): `DayBox` — the v118 `.dn` mark (30×30, 10 px corners, ink fill, paper
  text, pops .55→1 in 0.3 s, fades out 0.22 s, no motion under reduced motion) — and `useCalendarSwipe` (sideways only,
  past 40 px old + new days slide together 320 ms, under 40 px snap back, the release's click swallowed so a swipe
  never picks a day; reduced motion = instant).
- `CalendarGrid` gains an opt-in `mark="box"` (dots keep their colours on the box, a blocked day is struck instead of
  hatched, today's ring 1.5 px); every other calendar in the app keeps its circle. `CalendarLegend mark="box"` says
  "struck" instead of the hatch.
- `CustomersCalendar` (the Clients month, the week strip AND the client's Schedule page — one component): the month
  wears the box; the week strip draws the same `DayBox` (no accent fill, no hatch, today ringed, dots kept on the picked
  day); both swipe. A week swipe moves the week on show (± 7 days), never the picked day.
- Picking in another month: a week-strip day outside the month goes to that month with that day picked (already so);
  the day head reads that month.
- Tour: the Dates tour's "Check a date" stop pointed at nothing after #43 — folded into the month stop; its "Add" stop
  now points at the one ＋ (`customers-add`); copy "Striped days are off" → "Struck-through days are off".
- Guard: `app/_components/calendar-day-box.test.ts` (renders both modes). Sabotaged: the month without `mark="box"`,
  a hatched blocked day in box mode, the swallowed click removed — each caught. Pins re-anchored with reasons:
  each-supplier-page-has-its-tour, the-columns-are-the-system, claimed-records-asking, spotlight-anchors-exist.
  Every test reading a touched file: **906 pass · 0 fail**.
- **Requests:** 0 added (a swipe to a month not yet read uses the month's existing one `fetchMonth`).
- Shots: `sbs-37-month-picked` (+ reduced), `sbs-37-month-picked-12`, `sbs-37-swiped-to-december`, `sbs-37-schedule`.

### #28 — one filled day only
- Box mode (the Clients month, week strip, Schedule month): the picked day is the ONLY fill — a part-booked day lost
  its soft square (dots + words remain), a blocked day is struck (no hatch), today is a 1.5 px ring, nothing picked =
  nothing filled. A closure row's lead is the day's struck number (was a hatched swatch), so the list says it the way
  the calendar does. The couple's calendars (circle mode) are unchanged — #28 names the supplier calendars' lane (L2).
- Guard: `calendar-day-box.test.ts` "only the picked day is filled" (reads each day's own button tag). Sabotaged
  (the part fill back) — caught. Touched-file tests **906 pass · 0 fail**.
- **Requests:** 0. Shots: `sbs-28-nothing-picked`, `sbs-28-blocked-day-picked`.

### #36 — the page menu centres the picked page
- New `app/_components/centre-in-strip.ts` (`centreScrollLeft` · `centreInStrip` · `pageSwipeStep`, v116 `centerMk`):
  the picked client's menu strip keeps its picked page in the MIDDLE after a tap, a body swipe, a deep link and the
  first open (instant then); at either end it stays at the end (clamped). Only the strip scrolls — never
  `scrollIntoView`, which also slid the body sideways (§10 #26). Replaces the shell's keep-in-view (not centred).
- A swipe across the page body (≥ 60 px, 1.5× more sideways than down) turns the page in the menu's order. It never
  starts on the menu, a calendar, the week strip, a field or `[data-no-page-swipe]`.
- Guard: `clients/[eventId]/the-page-menu-centres-the-picked-page.test.ts` (3). Sabotaged twice (the clamp removed;
  deps `[page]` without `host`, so the portal landing is not centred) — both caught.
- **Requests:** 0. Shots: `sbs-36-deep-link-payment` (centred), `sbs-36-deep-link-report` (at its end, scrollWidth 375).

### #27 — the return rule
- `calendar-day-box.tsx` gains `RETURN_MOTION` (520 ms, `cubic-bezier(.33,1,.68,1)`), `cubicBezier`, `scrollerOf` and
  `glideScrollTo`. The Clients month and the client's Schedule month (one component) remember where their scroller
  stood when a day opens from none, and letting it go — ×, the same day again, a tile — glides back there; stepping
  day → day keeps the first memory. Reduced motion: one instant step.
- ⚠ **Measured, and the first version did nothing:** a picked day shrinks the page to the viewport (992 → 812 px, so
  the scroll clamps to 0), and the list grows back only some frames AFTER the let-go. Clamped up front (or on the
  first frame) the target was 0. The glide now WAITS until the spot is reachable (capped 400 ms), then glides, then
  holds the spot 400 ms while the page settles (an instant return landed 8 px off: 1000 → 992 px + scroll
  anchoring) — letting go on any wheel / touch / pointer / key so it never fights the person.
  🔑 Checked in headless Chromium, NOT the browser pane: a hidden pane runs no `requestAnimationFrame`, so any glide
  "fails" there.
- Measured: scrolled 180 → pick → page at 0 → × → 33 · 80 · 118 · 147 · 163 · 172 · 178 · **180** (≈ 500 ms);
  reduced motion **180** on the first sample.
- Guard: `calendar-day-box.test.ts` #27 (the ease, remember / give back, the wait, the hold, the input let-go).
  Sabotaged twice (record on every change; no wait) — both caught. Touched-file tests **982 pass · 0 fail**.
- **Requests:** 0. Shots: `sbs-27-scrolled-before`, `sbs-27-returned` (+ reduced). v118's frame scrolls inside a
  phone mock that the wheel did not move, so its two shots look alike for a different reason.

## Not done / differs from v118 (for the controller)
- v118's picked day swaps the tiles for that day's figures and shows "Accept bookings" + "Book a client"; the build
  keeps the month's tiles. The picked fill is still the accent — that is row #37.
- DatesFolds (closures, caps, waitlist tools) now sit at the FOOT of the one screen — a placement call to confirm.
- The "Events ⓘ" heading over the list is still drawn; the scope dropdown stays for shops with several schedules.
- #38 not done — controller calls:
  · **Messages + Notifications sheets.** The envelope opens the full-screen inbox (`SUPPLIER_CHATS_HREF`), whose rows
    and every `relatedUrl: /vendor-dashboard/messages/<thread>` notification open the full-screen chat — kept by the
    6 Nov ruling ("the full-screen route stays for the envelope doors"). #38 asks for them through the one path too;
    the two rulings disagree, so I left them. If #38 wins: map a thread → its event at read time (one batched read).
  · "Schedule/appointment → Schedule with that day picked" needs a day param on the client's Schedule page.
  · "While a client is open the list ignores the view filter" — on a phone the list is off screen while a client is
    open (a route). #27 covers the calendars' return; closing an opened CLIENT returns through the router (the
    @client intercept from the base), which keeps the list's scroll — not re-measured here.
- Forced dark: the opened-event pane (Schedule / Details) keeps a white ground — not dark-swept yet (not live).

## Needs
- tsc: the #43 run was green (rc 0, 0 errors). The #37 run was killed by a signal (exit 144) while QUEUED for the
  heavy lock — it never compiled. Not re-run; CI's typecheck is the gate on the controller's PR.

## Generated files (not edited — the controller regenerates)
- `port:baseline` (`lint:port-controls` lists exactly these, all deliberate):
  /vendor-dashboard/customers — `<CheckADate>`, `<CustomersDates>` (#43), `/vendor-dashboard/clients/[seg]?tab=details`
  (#38: the row's link now comes from `openClientHref`); /dev/clients-lab — `?v=pick&page=details`, runs `null`.
- `ugat:screens` — page.tsx lost `CustomersDates` and moved `readOpenAsks` to `open-asks.ts`.
- Server-action budget: unchanged (no new exported action).

## Where I stopped
- #43, #38, #37, #28, #36, #27 committed + pushed. Next: #29 (Accept bookings off/on is felt).
