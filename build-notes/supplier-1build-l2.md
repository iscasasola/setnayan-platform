# L2 · Clients — build notes (THE ONE BUILD, 8 Nov 2026)

STUBS PUSHED <sha-pending>

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
- C1: `DateChangeBody` + `DeleteRequestBody` as exported components (A2 A8) — L2 mounts them on Details. Typed stub until then.
- C2: `brief.hosts` in `get_vendor_event_brief` (`-data`). L2 reads it through a typed stub until it lands.
- L1: `--sn-pin-h` token + 520 ms motion primitive + CollapsingTop (`-foundation`). L2 builds behind shipped chrome until then.

## Generated-file / Ugat needs (controller)
- New intercept route `vendor-dashboard/customers/@client/(..)clients/[eventId]` → `pnpm ugat:screens`, port baseline.

## Questions
(none yet)

## Request counts
(pending)

## Where I stopped
Hour-0 stubs written; next: strip FilesTab/reservation/chat redirect from `clients/[eventId]/page.tsx`, mount `pickedPageBodies`.
