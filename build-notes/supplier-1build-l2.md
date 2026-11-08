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
  `customers/the-picked-client-opens-over-the-list` (sabotaged once each). Proved in browser: NOT YET.
- Details in v113 order (a347f18034): stage strip · THREE NUMBERS (`details-numbers.ts`; guard
  `no-all-paid-without-a-booking.test.ts`) · ask answers · date-change/removal answers (`client-desk-answers.tsx`) ·
  badges · Open their event · next-move card (desktop only, KEPT per controller) · Hosts (typed stub) · brief ·
  fee panel · access ask · **Suppliers on this event** (`_components/suppliers-list.tsx`, from the brief's
  `vendor_roster`, booked only; absent roster draws nothing) · completion · couple answers · **Forms · sent to this
  couple** door (`details-forms-door.tsx` → the Forms page). Guard `clients/[eventId]/the-details-and-schedule-are-v113-order.test.ts`
  (3 tests, each sabotaged once). **Decisions NOT built** — see Questions.
- Schedule: Appointments moved INTO `ScheduleTab` right after `<SupplierSchedule>` (before the handover), drawn once;
  Script fold at the end (`?tab=script`). NOT done: v113's own calendar on the Schedule page (calC) and the reorder
  inside `SupplierSchedule` (Where · Hours · Asked) — that component is not an L2 file.
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
  Limits: "Service" narrows on the BOOKED `event_vendors.service_id` only (an asking event has no service yet).
  Proved in browser at 375 px: NOT YET.
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

## Preflight (b34fa5db90 + fixes), honest reading
- RED, baseline-only (controller regenerates; I may not): `port:baseline` (deliberate removals above) · `lint:no-card`
  (moved FilesTab lines) · `ugat:screens` stale (new intercept route + `_pages`).
- RED, inherited from the base (no L2 file involved): `lib/export-coverage-guardrail.test.ts` T12 (vendor_profiles
  find_lock_* / is_findable not exported) · `lib/shop-name-hold.test.ts` · `tests/db/ugat-both-ends` orphan
  `shop_name_is_held` · tsc `tests/db/one-source-buckets.db.test.ts(189)`.
- FIXED here: `every-menu-has-one-settings-button` (picked client now has its own gear; Clients ⚙ mounted once) ·
  `port-guard-reach` (`_pages` added to PRIVATE_SUBDIRS in `scripts/port-controls.mjs` — one line, not an L2 file).
- ~65 test files "timed out" under machine load 15; the supplier/chat/thread ones re-run alone: 68/68 pass.

## Questions
- Decisions on Details (v113 `dec`): not built. It needs the thread's decision facts built on the SERVER (proposal
  cards → quotes, meetings, `proposal_amendments`, `fetchThreadPayments`, `paxProposalsToGuestCounts`,
  `fetchLiveQuoteTotalPhp`) and a ReplyContext with the supplier's actions — ~6 more reads on Details and the
  same reads the chat thread already makes. Controller: build it here, or wait for C2's in-place thread and read
  its facts?
- (ANSWERED by controller 8 Nov: KEEP) "Your next move" card (shipped desktop-only context rail, `lib/supplier-next-move.ts` + its guard) is NOT in v113.
  Kept, still `hidden lg:block`, on Details under the stage strip (reposition-only rule) — its two quick links
  (Chat · Payments) dropped since both are menu pages now. Owner: keep or retire?

## Request counts
- Clients › Events (server, one Promise.all + one follow-up): adds `event_appointments` (Schedules, ≤200 rows),
  `readUnreadChatCountsByThread`, then `fetchVendorTeam` · `fetchAgentServiceAssignments` · `fetchVendorServices`
  (each `.catch → null`) + one users read for seat names. Show & sort / tiles / Overdue / Unread: 0 requests
  (in place). A Show & sort choice = one navigation (URL params, scroll kept).
- Details adds 0 reads (Suppliers come from the brief already read).

## Owner rulings §10 (v115) — status
- #26 page slide 700 ms / 44 px / cubic-bezier(.33,1,.68,1) / opacity full at 45 %, scroller overflow-x hidden,
  menu scrolls only its strip: DONE (3d3000e64d), guarded in `the-picked-client-opens-over-the-list` test 3–4.
- #27 · #28 · #29 · #34: NOT BUILT — moved to BUILD 2 by the owner rule of 8 Nov (small adjustments after this build
  ships). "Book a client" opens the shipped Locked QR generator unchanged, as instructed.

## Where I stopped
Item 3 DONE + guarded; Details in v113 order (minus Decisions) + Schedule's Appointments placement DONE + guarded.
NOT done: Decisions (question above) · Schedule page calendar + the inside-SupplierSchedule order · browser proof at
375 px · baselines (controller's). tsc: L2 clean; the one inherited base error `tests/db/one-source-buckets.db.test.ts(189)`.
