## 2026-11-16 · copy(supplier): "Clients who found you outside Setnayan never carry a fee."

Owner, 16 Nov 2026: *"yes change the wording"* (DECISION_LOG row "THE NO-FEE LINE ON A SUPPLIER'S CLIENT CARD…", following walk finding EB-289).

The old line said imported **and returning** clients never carry a fee. That is untrue: a client who first came through Setnayan pays the booking fee on the first booking and on every repeat (Vendor_Monetization_Model_LOCKED_2026-07-25 §3). Copy only. The fee logic, the rate and every price are untouched.

Changed in three places:
- **The supplier's client card** (`bookingFeeForecast`, not-sourced): "This client did not come from Setnayan, so they are yours free. Clients who found you outside Setnayan never carry a fee."
- **The For Suppliers page** and **the For Coordinators page**: "Your own clients, imported or returning, never carry a fee." → "Clients who found you outside Setnayan never carry a fee."

Lines that never mentioned returning clients ("the ones you bring or import", "your own clients never carry a fee") are correct and left alone.

Guard: `lib/no-fee-wording.test.ts` scans every file in `app/`, `lib/` and `components/` for the retired wording, and checks the new sentence is on the card and on both pages. Sabotage: the old sentence put back on the card, measured 1 → 0 on the new sentence, gives 2 red.

SPEC IMPACT: None. The ruling is already in DECISION_LOG.
