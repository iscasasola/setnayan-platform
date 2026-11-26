## 2026-11-25 · fix(guests, seats, supplier chat): ten final-check faults (area 2, batch 3)

- Check-in desk: the reply in the list's own words ("No reply", "Can’t come"), never "RSVP’d pending" (A2-D16).
- Chat box: the phone key says Send, since Enter sends on every device (A2-H4).
- Inbox: the "Suppliers" chip drew exactly the All list; it is no longer offered (A2-H1).
- Find: a shop with no address is left out, never a link to "#" (A2-G11).
- Build / Compare: "Ask to book" and "book" are drawn only for a viewer who books (A2-G1), like the rest of the page.
- Payment lines: the two stored notes read "Reservation fee · waiting for the supplier to confirm" via
  `lib/payment-note-words.ts`; the notes themselves stay as they are (a trigger matches them) (A2-G4).
- Supplier thread: Book and the reservation-fee payment are handed only to a host (`fetchEventViewer` → `isCouple`,
  failing closed) (A2-H3); a money-hidden viewer gets no payment facts in Decisions (A2-H2).
- Tea ceremony: declined guests are not served, the count says "to serve", and a refused event read is said, not a
  404 (A2-E3).
- Seats inside Guests: a refused table or seat read is said in the Seats view instead of crashing the Guests page (A2-D1).

Guard: `app/dashboard/[eventId]/guests-seats-and-supplier-chat-hold-final-check.test.ts`.

SPEC IMPACT: None (each fix applies a rule already decided: house words, only a host books or pays, honest reads).
