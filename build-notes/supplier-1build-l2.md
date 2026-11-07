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
(none yet)

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

## Questions
- "Your next move" card (shipped desktop-only context rail, `lib/supplier-next-move.ts` + its guard) is NOT in v113.
  Kept, still `hidden lg:block`, on Details under the stage strip (reposition-only rule) — its two quick links
  (Chat · Payments) dropped since both are menu pages now. Owner: keep or retire?

## Request counts
(pending)

## Where I stopped
Item 2 (client page cleanup) written + guards; waiting on the heavy lock for install → tsc → tests → preflight → push.
⚠ Hour-0 push 1fd157a8fd went out WITHOUT tsc (node_modules not installed; lock held by 'preflight train-base').
