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
- Details (partial, shipped parts relocated): ask answers · date-change/removal answers (`client-desk-answers.tsx`) ·
  badges · Open their event · stage strip · THREE NUMBERS (`details-numbers.ts`; guard
  `no-all-paid-without-a-booking.test.ts`) · next-move card (desktop only) · Hosts (typed stub) · fee panel · access
  ask · completion · brief · couple answers. NOT YET in v113 order: Suppliers · Decisions · Forms sent rows.
- Schedule: shipped schedule + the Script fold at its end (`?tab=script` scrolls there). v113 re-order NOT done.
- Clients: tab title + sr-only h1 say "Clients"; Auto-reply in Clients ⚙ (guard
  `customers/the-auto-reply-lives-in-clients-settings.test.ts`); list rows record their origin for the motion.

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
- §10 #23 layers: the picked client's overlay uses `zIndex: 'var(--sn-z-pop, 50)'` (fallback = the shipped Sheet's 50
  until `-foundation` lands); guarded by `customers/the-picked-client-opens-over-the-list.test.ts` (no raw z numbers).

## Generated-file / Ugat needs (controller)
- New intercept route `vendor-dashboard/customers/@client/(..)clients/[eventId]` → `pnpm ugat:screens`, port baseline.
- `pnpm --filter @setnayan/web port:baseline` — DELIBERATE removals on `/vendor-dashboard/clients/[eventId]`:
  `<FilesTab>` → `_pages/files.tsx` `<FilesPage>` · `<RelationshipTabShell>` → `<PickedClientShell>` · `<ShopEmpty>`
  (moved with the Files body) · the old rail's `?tab=payments` link (Payment is a menu page now).
- `lint:no-card` baseline: the 3 bordered lines of the shipped FilesTab MOVED verbatim from `clients/[eventId]/page.tsx`
  into `_pages/files.tsx` (net 0; page.tsx count drops by 3). C1 rebuilds that body as the Finder view anyway.

## Questions
- "Your next move" card (shipped desktop-only context rail, `lib/supplier-next-move.ts` + its guard) is NOT in v113.
  Kept, still `hidden lg:block`, on Details under the stage strip (reposition-only rule) — its two quick links
  (Chat · Payments) dropped since both are menu pages now. Owner: keep or retire?

## Request counts
(pending)

## Owner rulings §10 (v115) — status
- #26 page slide 700 ms / 44 px / cubic-bezier(.33,1,.68,1) / opacity full at 45 %, scroller overflow-x hidden,
  menu scrolls only its strip: DONE (3d3000e64d), guarded in `the-picked-client-opens-over-the-list` test 3–4.
- #27 return rule (picked day · day bar · schedule day → exact prior state, 520 ms): NOT BUILT — belongs to the list
  calendar/day bar (item 3), which is not built yet.
- #28 only the picked day filled · event days dots · today thin ring: NOT BUILT (item 3 calendar).
- #29 Accept-bookings switch animates the cell (squash+strike / pop+confetti, none under reduced motion): NOT BUILT.
- #34 ONE Booked QR form on `invite/_components/locked-qr-generator.tsx` + Booked QRs list (Waiting · Used · Deleted):
  NOT BUILT. Needs from C2: the void action + quote-line storage.

## Where I stopped
Items 2, 4 (shell/motion), Auto-reply, Clients wording, Details numbers/answers/hosts DONE + guarded. NEXT: item 3
(Clients list: calendar week strip + #27/#28/#29, tiles Booked · Schedules · Asked · To collect + Overdue/Unread buttons,
day bar + Book a client → #34 Booked QR form, sticky day headings, Show & sort + Handled by), then Details v113 order
(Suppliers · Decisions · Forms sent), then Schedule v113 order. No browser proof at 375 px yet.
tsc: clean for L2; ONE pre-existing error inherited from the base: `tests/db/one-source-buckets.db.test.ts(189)` (TS2345).
⚠ Hour-0 push 1fd157a8fd went out WITHOUT tsc (node_modules not installed; lock held by 'preflight train-base').
