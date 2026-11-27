## 2026-11-27 · fix(couple numbers): every booked count, Hub word and payment label from one reader (L5)

Walkthrough 27 Nov, Batch 2, lane L5 (C1 · C2 · C4 · C6 · C7 · C8 · C9 · C10). No layout change; the numbers and the words that carry them.

- **C1 · Build drops a booked supplier.** Photo and video booked separately sit in one category, and the Build line kept only the first, so Alon Films disappeared while the header still added its price. Every booked supplier is now a line (`buildLinesOf`); the category counts and the Compare rows stay one per category.
- **C2 / C7 · one booked reader.** New `lib/booked-tally.ts`: `isBookedStatus` (the `BOOKED_EVENT_VENDOR_STATUSES` set), `bookedSupplierCount` (suppliers) and `bookedCategoryTally` (the categories Find lists, and how many hold a booking). Home's "N of M booked" now counts Find's categories instead of the event type's whole plan ladder, so testnayan4 reads "1 of 1", not "0 of 25". Book's "N booked · N waiting for your first payment" is unchanged (owner Q10, 17 Nov).
- **C4 · couple "expired", supplier "Holding · Talking".** `customerLaneOf` now returns `askEnded`: how the couple's last booking ask ended, in the supplier card's own words (`askLine(…, 'supplier')`). Drawing it on the Clients roster is L6's file.
- **C6 · Unihome.** "N planning" leaves out events the account was only invited to (`planningCountOf`, used by both readers). The Home Event Hub tile says "live" only for a Public Hub; an Unlisted or Private one names itself (`hubReachOf`).
- **C8 · Create event.** The Wedding tile names every wedding in planning, soonest first (`inPlanningWeddingOf`, `inPlanningWeddingNames`).
- **C9 · Budget.** A payment past its due date reads "Overdue · since …", not "Next" (`NextPayment.overdue`, from the resolver's `dueState`).
- **C10 · Orders and receipts.** A plan the event holds with no order row (an admin grant, a founder seat, an internal host) is listed as "Your plan on this event · Active" (`planHeldWithoutOrder`, `readEventPlanHeld`), instead of "No orders yet".
- Guard: `lib/couple-numbers-one-reader.test.ts`, with fixture counts and source guards. Two fixes were sabotaged and the guard went red each time.

SPEC IMPACT: None. Implements the 27 Nov walkthrough findings as filed (MASTER-PLAN-2026-11-27 Batch 2, all "Dec: N"); no new rule. C3 and C5 are not in this PR.
