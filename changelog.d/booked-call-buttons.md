## 2026-11-05 · feat(chat): Call · Video call · Viber in the chat head, both sides — booked suppliers only, as hand-offs out of the app

Owner 2026-11-04, DECISION_LOG "SIX OWNER ANSWERS" item 2 (*"We can call and video call suppliers as well on the
chat"*), and 2026-11-05 (*"yes for the video and voice call, have a button for it"*; *"supplier side. only for
booked"*).

- The couple's thread page (`/dashboard/[eventId]/messages/[threadId]` — also the page a coordinator on the event
  opens) now shows, in the chat head's second row, **Call** (`tel:` the shop's business phone) and **Video call ·
  Viber** (`viber://chat?number=%2B…`, where Viber's video button is one tap) — ONLY when that shop has a confirmed
  booking on this event (`event_vendors.status` in `CONFIRMED_VENDOR_STATUSES`, not archived — the one meaning of
  "booked"). A landline gets Call only (Viber is a mobile app). A booked shop with no usable phone shows nothing.
- An unbooked, live conversation shows one muted line instead: *"Calls open once you've booked."* — no greyed-out
  button. A closed or blocked conversation shows neither; a refused read shows neither (never a false "not booked").
- These are NOT in-app calls. The WebRTC call stays removed (2026-10-28); `lib/the-chat-has-no-calls.test.ts` now
  says so and holds the new row to `tel:`/Viber hrefs mounted in the head only.
- The supplier's thread (`/vendor-dashboard/messages/[threadId]`) gets the same two buttons TO THE COUPLE, behind
  the same booking check: the phone on the account (`users.phone`) of the person who opened the conversation — only
  when that person HOSTS the event (`userHostsEvent`). A supplier can be a thread's creator (an invite claim seeds
  one), and must never be shown their own number as the couple's. No phone on the account → nothing. The hint reads
  *"Calls open once they've booked you."*
- New: `lib/booked-call.ts` (the links, pure) · `lib/booked-call.server.ts` (`readBookedSupplierCall` for the
  couple, `readBookedCoupleCall` for the supplier; booked first, and a phone is read on the service role only AFTER a
  booking answered — an unbooked thread never fetches one) · `app/_components/chat/booked-call-row.tsx` (house
  `ActionButton`s, tone `info`, with the house fit pass so the row never wraps at 390 px).
- `lib/no-door-out-of-the-app.test.ts`: a second owner-scoped Rule 1 bill, `BOOKED_CALL_BILL` (exactly two links, in
  one file), gate tests proving each reader's booked-then-phone order (and the supplier's host check), one read of
  each phone, and that `phoneCallLinks(` has no other caller; a Rule 3 bill line for the `contact_phone` read.
- `lib/only-a-booking-opens-a-call.test.ts`: executes the links, both readers (fake client; counts the tables read —
  including a supplier-opened thread, which reads no phone), the render on both sides (an unbooked thread draws no
  `tel:`/`viber:`), both pages, and the chat contact filter (the very number the Call button dials is still blocked
  in a message; the send gate consults no booking).
- Admin: no switch governs chat tools (the old `calls` plan capability was removed 2026-11-04), so nothing to respect.

SPEC IMPACT: None new — implements the 2026-11-04 "SIX OWNER ANSWERS" item 2 row already in the corpus DECISION_LOG.
Owner ruled 2026-11-05 on the supplier side ("only for booked") — this is the first place the couple's account phone
is shown to a supplier; worth a DECISION_LOG line if the corpus does not have it yet.
