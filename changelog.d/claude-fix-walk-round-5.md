## 2026-11-13 · fix(booking): round 5 of the fee walk — the record's source, a refused quote, bookings closed, one date (RW-22 · RW-24 · RW-26 · RW-30)

- **RW-22 (money)** An inquiry stamped its thread (`shop_page`, `website`, …) but wrote the supplier record with
  `source = NULL`, so the supplier's card could not tell a couple Setnayan brought from their own. The record now carries
  the thread's own stamp — on insert, and on an existing row only while its source is empty (a Find save or a
  supplier invite is never overwritten). Money-neutral: the fee reads the thread first. The card's Imported badge now
  reads the same sets the fee does (`SUPPLIER_BROUGHT_SOURCES`, plus an inquiry through the supplier's own link).
- **RW-24** Send quote before saying yes to the inquiry was refused and the notice was drawn only for an OPEN
  conversation — so nothing showed, and the redirect emptied the quote. The notice now shows on the pending inquiry
  ("Say yes to this inquiry first … your quote is kept on this device") and the maker keeps the quote as Send is pressed,
  putting it back after any refused send (forgotten once it went).
- **RW-26** While bookings are closed (`platform_settings.bookings_open`), the couple's "Ask … to confirm your booking"
  in the chat reads "Bookings open soon" before the press, with the shared closed-bookings sentence.
- **RW-30** The supplier Plan page said "12 Dec 2026" (the gift) and "Dec 11, 2026" (the plan's end, in UTC) for the
  same moment. Every date there is now the Manila day, in the gift's phrasing.
- Guard: `lib/the-walk-round-5.test.ts`.

SPEC IMPACT: None.
