## 2026-11-05 · feat(chat): Call · Video call · Viber in the chat head — booked suppliers only, as hand-offs out of the app

Owner 2026-11-04, DECISION_LOG "SIX OWNER ANSWERS" item 2 (*"We can call and video call suppliers as well on the
chat"*), and 2026-11-05 (*"yes for the video and voice call, have a button for it"*).

- The couple's thread page (`/dashboard/[eventId]/messages/[threadId]` — also the page a coordinator on the event
  opens) now shows, in the chat head's second row, **Call** (`tel:` the shop's business phone) and **Video call ·
  Viber** (`viber://chat?number=%2B…`, where Viber's video button is one tap) — ONLY when that shop has a confirmed
  booking on this event (`event_vendors.status` in `CONFIRMED_VENDOR_STATUSES`, not archived — the one meaning of
  "booked"). A landline gets Call only (Viber is a mobile app). A booked shop with no usable phone shows nothing.
- An unbooked, live conversation shows one muted line instead: *"Calls open once you've booked."* — no greyed-out
  button. A closed or blocked conversation shows neither; a refused read shows neither (never a false "not booked").
- These are NOT in-app calls. The WebRTC call stays removed (2026-10-28); `lib/the-chat-has-no-calls.test.ts` now
  says so and holds the new row to `tel:`/Viber hrefs mounted in the head only.
- New: `lib/booked-supplier-call.ts` (the links, pure) · `lib/booked-supplier-call.server.ts` (booked first; the phone
  is read on the service role only AFTER a booking answered — an unbooked thread never fetches it) ·
  `app/_components/chat/booked-call-row.tsx` (house `ActionButton`s, tone `info`).
- `lib/no-door-out-of-the-app.test.ts`: a second owner-scoped Rule 1 bill, `BOOKED_SUPPLIER_CALL_BILL` (exactly two
  links, in one file), a gate test proving the reader's booked-then-phone order and that `supplierCallLinks(` has no
  other caller, and a Rule 3 bill line for the reader's `contact_phone` read.
- `lib/a-booked-supplier-is-the-only-call.test.ts`: executes the links, the reader (fake client; counts the tables
  read), the render (an unbooked thread draws no `tel:`/`viber:`), and the chat contact filter (the very number the
  Call button dials is still blocked in a message; the send gate consults no booking).
- Supplier side: NOT built. Nothing in the app shares the couple's own phone with a booked supplier today, so there is
  no number to put behind a button — left as an owner question in the PR.
- Admin: no switch governs chat tools (the old `calls` plan capability was removed 2026-11-04), so nothing to respect.

SPEC IMPACT: None new — implements the 2026-11-04 "SIX OWNER ANSWERS" item 2 row already in the corpus DECISION_LOG.
Owner question (not a spec edit): should a booked supplier get the same two buttons to the couple, which would mean
sharing the couple's phone with their booked suppliers for the first time?
