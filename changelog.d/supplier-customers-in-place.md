## 2026-10-28 · feat(supplier-customers): People ▾ · Asking · Talking · Booked · Done · ⚙ is the pinned row and filters in place · the Messages fold is gone (the event list IS the messages) · a booked-outside customer holds their one-time code · Customers ⚙

The second approved supplier page (owner 2026-10-28, corpus DECISION_LOG "SUPPLIER DASHBOARD APPROVED — EVERYTHING
IN PLACE, A ⚙ PER PAGE" (CUSTOMERS), "SUPPLIER CUSTOMERS ARE LISTED BY EVENT, NOT BY PERSON", "SUPPLIER CHAT TITLE =
USER'S EVENT (DATE)", "THREE KINDS OF CHAT"; prototype `prototypes/supplier_in_place_2026-10-28/interactive.html` v8).
Extends the shipped Customers page — rows, chat titles, the full-screen chat (#7004), Money and Dates are not redrawn.

- **The pinned row** (`CustomersPin`, the Today pattern from #7026): the view is ONE `PickMenu` (People ▾ · Dates ·
  Money — the pill track is gone), People's four counts are buttons that show THEIR list right under the row, in place
  (all four lists drawn, one shown — Asking = waiting · Talking = holding + talking · Booked = booked + outside
  bookings · Done = finished), and Customers ⚙ ends the row on all three views. A short read says "N+" / "couldn't
  load" — never 0. The old Filter ▾ eyebrow is gone; `?lane=` links still open the matching door; each door pages on
  its own (`?door=&page=`).
- **Messages is not a fold any more** (`messages/surface.tsx` deleted; `segments.ts` FOLD_KEYS). What only it held:
  per-chat archive → each supplier chat's ⋮ ("Archive this chat" / "Move back to your list", the shipped
  `archiveThread`/`unarchiveThread`); the Archived list + declined / released / withdrawn / older chats + the won/lost
  roll-up → "Archived and closed chats" at the foot of People (`OtherChatsFold`, `opage`), each chat opening full
  screen. An archived Talking/Holding chat leaves the list; Asking, Booked and Done never do. The envelope and every
  Messages link land on People's `#customers`.
- **Their one-time code** on a booked-outside row (`OutsideClientRows`): Not linked → "Send their code" (the shipped
  Locked-QR maker, the day filled and the booking named) · Code sent → "Send again" (the same code) · Linked. A refused
  codes read says so and offers nothing. Offered right after Add: `importExternalClient` comes back with `?block=` and
  that row opens under Booked. New migration `locked_qr_names_its_outside_booking` — `vendor_locked_qr_tokens.block_id`
  (nullable, ON DELETE SET NULL) + a trigger refusing any block that is not the shop's own outside booking; the maker
  skips the "date taken" refusal only for that booking's own day.
- **Customers ⚙** (`CustomersSettings`, menu `customers`, read only while open — `?gear=1`): Getting paid (the shipped
  payment-options editor, its saves coming back to the open ⚙ via `return_to=customers`) · Teams and days (Your halls ·
  How many a day · Exact time slots · Phone calendar — moved out of Dates' folds as `DaysSettings`, saves come back to
  the open ⚙ via `gear=1&gnotice=`).
- **Dates**: under the picked day's rows, "You can take bookings" (`DayOpenSwitch`) — off writes the shipped all-day
  closure, on removes that one-day closure, both in place (`return_to=inplace`, now also on `removeBlock`); a day closed
  by a repeat or a longer closure says by what and is changed on its own sheet.
- **Maximize the screen** (owner 2026-10-29): People uses the full width from a tablet; from lg the list and a side
  panel (archived/closed chats · kept notes) sit side by side; on a phone a row's stage stacks under the event's chat
  title instead of crushing it.
- **Fewest requests** (owner 2026-10-29): a count filter makes ZERO requests (it was one RSC round trip on main); the
  won/lost roll-up and kept notes now ride the first parallel round of reads instead of trailing it.
- Tours: the People spotlight gains its ⚙ stop; copy says the doors and the code.
- Dev lab: `/dev/supplier-lab?s=people[&door=booked&block=blk-1&gear=1]` · `?s=dates[&gear=1]` · `?s=money`.

NOT BUILT (data does not exist — owner's word + a build each): **Booking terms** shop defaults (downpayment % or ₱ ·
refund window · wording — no column; each card carries its own schedule) · the prototype's money lines on an outside
row (an outside booking stores no amounts) · Money's in-row "Remind" (the chat composer takes no prefilled message).

Guards: `customers/the-customers-counts-filter-in-place.test.ts` · `customers/the-messages-fold-left-no-control-behind.test.ts`
· `tests/db/locked-qr-names-its-outside-booking.db.test.ts` (9 + 1 sabotages, each RED, restored). Updated to the new
truth: `people-is-rows`, `the-roster-pages`, `the-roster-opens-on-who-is-waiting`, `dates-is-one-calendar`,
`the-supplier-app-lands-where-it-says`, `the-supplier-foundations-hold`, `each-supplier-page-has-its-tour`,
`spotlight-anchors-exist`, `pills-are-everywhere`, `one-event-one-chat-title`, `the-supplier-sees-who-is-asking`.
Regenerated: port-control baseline (MessagesSurface, CustomersSegments, the pill track leave Customers; the Messages
stub keeps no surface), Ugat screens, root-map baselines, exposure baseline.

SPEC IMPACT: DECISION_LOG "SUPPLIER CUSTOMERS — AS BUILT" row (corpus) — records the build, the new column, and the
three items waiting on data.
