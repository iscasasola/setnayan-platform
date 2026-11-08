# L2 · Clients — build notes (THE ONE BUILD, 8 Nov 2026)

STUBS PUSHED 1fd157a8fd (branch claude/supplier-1build-l2)

## Hour-0 contract for the other lanes (read this)
- Page bodies: `apps/web/app/vendor-dashboard/clients/[eventId]/_pages/{details,chat,schedule,quotation,payment,forms,files,hub,report}.tsx`.
  Each exports `<Name>Page(props: PickedPageProps)` — `{ ctx: PickedPageContext; shipped?: ReactNode }` from `_pages/context.ts`.
  `shipped` = the node the client page drew for that section before this build; a stub renders it unchanged.
  Owners: details/schedule = L2 · chat/quotation/hub = C2 · payment/files = C1 · forms/report = C3.
- The switch: `_pages/switch.tsx` → `pickedPageBodies(inputs)` (L2's file). Need a new prop? Write it under
  "NEEDS FROM OTHER LANES" in YOUR notes; L2 adds it to `PickedPageContext` or to `PickedPageInputs`.
- `files.tsx` already holds the shipped `FilesTab` MOVED verbatim (C1 builds the Finder view on it).
- `payment.tsx` already holds the shipped reservation-policy line (`ReservationLine`), moved out of `QuoteTab`.
- Page ids + `customerCardHref(eventId, page)`: `apps/web/lib/upcoming-schedule-door.ts`
  (`PICKED_CLIENT_PAGE_IDS` = details · chat · schedule · quote · payments · forms · files · hub · report).
  Labels, legacy aliases (`script→schedule`, `call→chat`, `overview→details`, `activity→report`) and
  `pickedPageOf(rawTab)`: `clients/[eventId]/_components/picked-client-menu.ts`.
- Payment and Hub are booked-only menu pages (v113 `miniKeys`).

## Done pages (+ screenshots)
- Picked client (flag ON): `PickedClientShell` over the still-mounted Clients list (intercept `customers/@client`),
  9-page menu (Payment/Hub booked-only), page switch = replaceState (0 requests), open rises from the row (520 ms),
  close = the same frames reversed, reduced motion 120 ms fade, Esc/✕. Guards: `the-picked-client-has-nine-pages`,
  `customers/the-picked-client-opens-over-the-list` (sabotaged once each). Proved in the browser at 375 px (shots below).
- Details in v113 order (a347f18034 + bde3e9d9fe), exactly as `detailsShipped` draws it: stage strip (`pipelineBlock`) ·
  THREE NUMBERS (`DetailsNumbersRow`, `details-numbers.ts`; guard `no-all-paid-without-a-booking.test.ts`) · ask answers ·
  date-change/removal answers (`client-desk-answers.tsx`) · badges · Open their event · "Your next move" card (desktop
  only, KEPT per controller) · Hosts (`HostsList`, typed stub) · the brief (`overviewNode`) + what the couple told you
  (`coupleAnswersNode`, kept beside the brief for the `questions-for-every-supplier` guard) · fee panel · access ask ·
  **Suppliers on this event** (`_components/suppliers-list.tsx`, from the brief's `vendor_roster`, booked only; absent
  roster draws nothing) · completion card · **Decisions** · **Forms · sent to this couple** door (`details-forms-door.tsx`).
  **Decisions = a door to Chat (Build 1, controller 8 Nov)**: `details-decisions-door.tsx` + `details-decisions.ts` —
  one line from the quote rows Details ALREADY reads ("Quote · ₱38,000 · Accepted" / "No quote sent yet" / a refused
  read says "Couldn't load your quote"), sub-line "Meetings, changes and payments are in Chat", tap = the Chat page
  (`nav.select('chat')`, 0 requests). The assembled decisions list is BUILD 2 (controller's list).
  Guard `clients/[eventId]/the-details-and-schedule-are-v113-order.test.ts` (6 tests, each sabotaged once).
- Schedule (c3a472e439 · ef2ac5cced): v113's month FIRST on the page = the SAME Clients calendar
  (`CustomersCalendar place="schedule"` via `_components/schedule-calendar.tsx`) — one part, not a second grid. The
  event's day is picked on arrival; month · week strip on scroll · legend (no "asking" mark in schedule place); it writes
  no URL (the picked client owns it), feeds no Clients figures, draws no day bar, lists no shop day rows (v113 draws the
  schedule straight under it). Data = ONE request on first view through the EXISTING Clients month action,
  `fetchCustomerCalendarMonth(month, { whole: true })` in `customers/actions.ts` (pools · bookings · blocks · day
  states · waitlist, the same trims as Dates via `customers/dates-wire.ts`) — an option, not a new export, so
  `lint-server-action-budget` stays at 1232/1232 (guarded: customers/actions.ts keeps ONE export); the page switch itself stays 0 requests; a refused read is SAID ("Your calendar couldn't
  load just now — the schedule below is unaffected"), never an empty month.
  Then `SupplierSchedule` in v113 order: how changes go · Where · the chapters (hours, crew clash) · Lock my times ·
  Asked of you · the rest. **I am `SupplierSchedule`'s only editor in this build (controller-authorized 8 Nov)** — a
  pure move of blocks (diff 75+/73−; a sorted-line diff shows only 3 comment lines changed). Appointments sit right after
  `<SupplierSchedule>` (before the handover), drawn once; Script fold at the end (`?tab=script`).
- Walk-found fixes (375-px proof): a week-strip step across a month's edge left the month grid on the old month
  (uncontrolled `CalendarGrid`, pre-existing in the base) → keyed by the month (e02bcb553e, guarded); sticky day/group
  headings did not run edge to edge (`.home-k2` margin overrode `-mx-4`) → explicit classes (fbe0516f3d).
- Clients list = item 3 (d655880253 · 05eb39d84a · 967d988e43): calendar folds to the week strip; a picked day can be
  let go (tap again) → every coming day with something on it under sticky day headings (`z-[3]`, top = pin height +
  folded strip); day bar = **Accept bookings** switch + **Book a client** → `/vendor-dashboard/invite?mode=locked&date=…`
  (the SHIPPED `locked-qr-generator.tsx`, unchanged, date prefilled), hidden on past days, disabled while closed.
  Tiles **Booked · Schedules · Asked · To collect** (filter in place) + **Overdue (n) ›** / **Unread (n) ›** buttons
  (hidden at 0, "couldn't load" on a refused read, × closes "Viewing all …"). Show & sort (⇅ on the thumb row):
  Show · Service · Status · Client · **Handled by** (owner/admin: All seats · Me · each seat · Not given to a seat;
  an agent sees "Your clients only" and is held to his seat server-side) · Group by (status · day · seat) · Sort
  (waiting · date · newest · name); applied server-side before counting/paging; sticky group headings. The sheet
  frame is extracted to `app/_components/show-sort-sheet.tsx` and the Guests panel re-mounted on it (byte-identical,
  probe-proved). Guard `customers/the-clients-list-is-v113.test.ts` (7 tests, each sabotaged once).
  "Service" narrows on the BOOKED `event_vendors.service_id` only, and the sheet says so in one line: **"Service shows
  booked clients only"** (controller 8 Nov, 318ae1abce, guarded).
## NEEDS FROM OTHER LANES
- C1: DONE BY L2 (spec §3.2 — only L2 edits `overview-sections.tsx`): `DateChangeBody` + `DeleteRequestBody` are now
  EXPORTED from `app/vendor-dashboard/_components/overview-sections.tsx`, and mounted on Details via
  `clients/[eventId]/_components/client-desk-answers.tsx` (Today's own reads narrowed to the event, inside
  `UndoableAnswers`, `data-today-ask` rows). Still C1's: `lib/supplier-today.ts` — `ANSWERED_ONLY_ON_TODAY` → `[]` and
  the two rows' targets → `customerCardHref(eventId,'details')`.
  ⚠ C1/controller: `vendorAnswerDateChange` / `vendorAgreeToDeletion` / `vendorDeclineDeletion`
  (`clients/[eventId]/actions.ts`) still `redirect('/vendor-dashboard?…')` — answered from the client, the supplier
  lands on Today with the outcome flag. A `return_to` (like `InquiryAnswers`' `returnTo`) is the fix; not L2's file.
- C2: `chat-thread-views.tsx` is not edited by L2. `_pages/chat.tsx` is still the door ("Open chat" → thread) until C2
  lands the in-place thread body; `lib/one-chat-box-everywhere.test.ts` tests 3–4 now say Chat is a page of the
  picked client with no second `ChatMessageStream` (updated honestly, workspace halves unchanged).
- L1: a `client` entry in the SettingsMenu (the picked client's ⚙ uses `MenuSettingsButton menu="customers"` door-only
  + its own Sheet until then); the bottom-nav label "Clients".
- C2: `brief.hosts` in `get_vendor_event_brief` (`-data`). L2 reads it through a typed stub until it lands.
- L1: `--sn-pin-h` token + 520 ms motion primitive + CollapsingTop (`-foundation`). L2 builds behind shipped chrome until then.
  The Clients group headings read `top: var(--sn-pin-h, 57px)`; the calendar's day headings measure the pin in JS.
- §10 #23 layers: the picked client's overlay uses `zIndex: 'var(--sn-z-pop, 50)'` (fallback = the shipped Sheet's 50
  until `-foundation` lands); guarded by `customers/the-picked-client-opens-over-the-list.test.ts` (no raw z numbers).

## Generated-file / Ugat needs (controller)
- New intercept route `vendor-dashboard/customers/@client/(..)clients/[eventId]` → `pnpm ugat:screens`, port baseline.
- `pnpm --filter @setnayan/web port:baseline` — DELIBERATE removals on `/vendor-dashboard/clients/[eventId]`:
  `<FilesTab>` → `_pages/files.tsx` `<FilesPage>` · `<RelationshipTabShell>` → `<PickedClientShell>` · `<ShopEmpty>`
  (moved with the Files body) · the old rail's `?tab=payments` link (Payment is a menu page now).
- `port:baseline` also loses `TopicHead` + Guests' own sheet markup (moved to `app/_components/show-sort-sheet.tsx`,
  byte-identical) and `CustomersDoorKey` (doors are string keys now).
- `lint:no-card` baseline: the 3 bordered lines of the shipped FilesTab MOVED verbatim from `clients/[eventId]/page.tsx`
  into `_pages/files.tsx` (net 0; page.tsx count drops by 3). C1 rebuilds that body as the Finder view anyway.

## Preflight (latest: b2e6bccb4e — 7 FAILED · 46 passed, every red below is baseline or inherited; tsc: only the
## inherited `one-source-buckets.db.test.ts(189)`; the server-action budget is 1232/1232 after folding the Schedule read)
## Earlier reading (b34fa5db90 + fixes)
- RED, baseline-only (controller regenerates; I may not): `port:baseline` (deliberate removals above) · `lint:no-card`
  (moved FilesTab lines) · `ugat:screens` stale (new intercept route + `_pages`).
- RED, inherited from the base (no L2 file involved): `lib/export-coverage-guardrail.test.ts` T12 (vendor_profiles
  find_lock_* / is_findable not exported) · `lib/shop-name-hold.test.ts` · `tests/db/ugat-both-ends` orphan
  `shop_name_is_held` · tsc `tests/db/one-source-buckets.db.test.ts(189)`.
- FIXED here: `every-menu-has-one-settings-button` (picked client now has its own gear; Clients ⚙ mounted once) ·
  `port-guard-reach` (`_pages` added to PRIVATE_SUBDIRS in `scripts/port-controls.mjs` — one line, not an L2 file).
- ~65 test files "timed out" under machine load 15; the supplier/chat/thread ones re-run alone: 68/68 pass.

## Questions
- (ANSWERED by controller 8 Nov) Decisions on Details: a door to Chat in Build 1, no new reads; the assembled list → BUILD 2.
- (ANSWERED by controller 8 Nov: KEEP) "Your next move" card (shipped desktop-only context rail, `lib/supplier-next-move.ts` + its guard) is NOT in v113.
  Kept, still `hidden lg:block`, on Details under the stage strip (reposition-only rule) — its two quick links
  (Chat · Payments) dropped since both are menu pages now. Owner: keep or retire?

## Request counts
- Clients › Events (server, one Promise.all + one follow-up): adds `event_appointments` (Schedules, ≤200 rows),
  `readUnreadChatCountsByThread`, then `fetchVendorTeam` · `fetchAgentServiceAssignments` · `fetchVendorServices`
  (each `.catch → null`) + one users read for seat names. Show & sort / tiles / Overdue / Unread: 0 requests
  (in place). A Show & sort choice = one navigation (URL params, scroll kept).
- Details adds 0 reads (Suppliers come from the brief already read; the Decisions line from the quote rows already read).
- Schedule page: +1 request on first view (`fetchCustomerCalendarMonth(month, { whole: true })` = 5 reads in one Promise.all; no
  asks, no threads); switching pages after that = 0.

## Owner rulings §10 (v115) — status
- #26 page slide 700 ms / 44 px / cubic-bezier(.33,1,.68,1) / opacity full at 45 %, scroller overflow-x hidden,
  menu scrolls only its strip: DONE (3d3000e64d), guarded in `the-picked-client-opens-over-the-list` test 3–4.
- #27 · #28 · #29 · #34: NOT BUILT — moved to BUILD 2 by the owner rule of 8 Nov (small adjustments after this build
  ships). "Book a client" opens the shipped Locked QR generator unchanged, as instructed.

## Browser proof at 375 px (dev lab, dummy env only — never `.env.local`)
Dev server via the `walk:` lock, `env -i` with `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:1`-style placeholders, its
process group killed after. Every shot: scrollWidth 375, no page errors. Labs: L1's `/dev/supplier-lab?s=dates`
(Clients › Dates, imported, not edited) and a NEW L2 lab `app/dev/clients-lab/page.tsx` (+ `lab-calendar.ts`;
`notFound()` first in production, never calls the server action — guard `the-lab-never-ships.test.ts`, sabotaged;
it pins the shared `ThumbRow` itself, because `SupplierThumbRow` is a supplier-route foundation that must not load
with a /dev route):
`?v=events` (tiles, quick buttons, Show & sort; `&agent=1`), `?v=pick&page=details|schedule` (`&cal=fail`).
Shots in `build-notes/shots/` (force-added; the folder is gitignored):
- Clients list: `build-clients-month` · `build-clients-no-day` · `build-clients-week-strip-sticky-headings` ·
  `build-clients-day-picked-day-bar` · `build-clients-strip-crosses-month` · `build-clients-tiles` ·
  `build-clients-overdue-open` · `build-clients-show-sort` · `build-clients-show-sort-handled-by` ·
  `build-clients-show-sort-agent`
- Picked client: `build-pick-details` · `build-pick-details-end` · `build-pick-slide-mid` (the page slide caught mid-way)
  · `build-pick-schedule` · `build-pick-schedule-scrolled` · `build-pick-schedule-end` · `build-pick-schedule-calendar-refused`
- v113 (`supplier-menu-r2.v113.html`): `v113-clients` (`?tab=clients`) · `v113-clients-scrolled` · `v113-pick-details`
  · `v113-pick-schedule`
- Side by side (v113 left, build right): `sbs-clients` · `sbs-clients-scrolled` · `sbs-pick-details` · `sbs-pick-schedule`

### Differences from v113 seen in the shots (flagged, not changed)
- The four Clients tiles sit on the shared pinned row (`PinDoors`), which slides under a fade at 375 ("To collect" is
  cut by the fade); v113 draws them as their own row under the calendar. The pinned row is a house template — moving
  the tiles off it is a controller/owner call.
- The picked day is the accent colour (shipped `CalendarGrid`), v113 draws it ink. Day headings read the shipped
  long date ("Saturday, October 3"), v113 "SUN 8 NOV".
- The Schedule month shows no "asking" marks (the action reads no asks/threads by design: one request, fewest reads).
- The lab's Details has no stage strip / brief data (lab stand-ins); the real page draws them (guard test 1).

## Where I stopped
All L2 items in Build 1 DONE + guarded + proved at 375 px: item 3 (Clients list), Details in v113 order with the
Decisions door, Schedule (shared month + SupplierSchedule order), Service line, the picked client's shell + slide.
NOT mine / open: baselines (controller regenerates: port, no-card, ugat:screens — the new `dev/clients-lab` route may
also show there) · NEEDS FROM OTHER LANES above · BUILD 2: assembled Decisions list, §10 #27 #28 #29 #34.
