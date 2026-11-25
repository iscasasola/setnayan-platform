## 2026-11-25 · fix(paperwork, seats, dates, refer, receipts, sponsors): ten final-check faults (area 2, batch 6)

- Paperwork: every save is a stay door, so a refused save is said under its form and the typed note stays — never the
  error screen (A2-I10). A replaced scan is deleted from the private bucket through the pinned cleanup path (A2-I11;
  an upload never saved is not yet swept).
- Nikah: "Save Nikah details" reads its write and says a refused save (A2-I19).
- Refer a couple: a refused read says "couldn't load", never "No referrals yet" (A2-F10).
- Event details: "Put this away" is drawn only for someone its writer lets put the event away (`mayPutAwayEvent`,
  one answer for both) (A2-H10).
- Pick your date: locking a date goes through the date's one writer (`updateEventDate`: calendars, Schedule,
  booked suppliers, the guest Event Hub); a refused booked-supplier count refuses; every refusal is said beside the
  date, never thrown (A2-H12).
- Seats and check-in: one still-to-seat count (`countStillToSeat`) for the desktop chip, its tooltip, the phone line
  and the entrance chart; the entrance chart drops "after party only" guests; reserved and expected come from
  `computeGuestStats` · `headcountForBasis` (A2-E4, A2-D2).
- Order slip: no pay rail of its own and no gone step — Pay shows where to send it (A2-F7).
- Sponsors: a walk's columns say "principal sponsor" and "Add sponsor", never ninong or ninang from the side (A2-I15).

Guard: `app/dashboard/[eventId]/saves-seats-and-slips-hold-final-check.test.ts`.

SPEC IMPACT: None (honest states, one reader per fact, house words).
