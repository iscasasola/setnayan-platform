## 2026-11-18 · fix(workspace): an unbooked accepted quote owes nothing — the Payment tab now says so on the page

Walk W4 on live f8f278f at 390 px, right after #7965 (TEST W1 · Eleven Florals, an accepted quote at `shortlisted`):

- **R12.** The card above "Schedule · not booked yet" still read "AMOUNT TO PAY ₱1,350 · First payment · Record payment", and the Final balance row said "that day has already passed" — while the Budget correctly said ₱0 owed and "Nothing is owed yet" sat only inside a closed ⓘ.
  - `DepositReservation` reads `nothingOwedYet(step, recorded)` (new, `lib/accepted-quote-terms.ts`): a `not_booked` step with nothing logged shows "Not booked yet · Nothing owed yet — your first payment starts once {supplier} confirms the booking." No amount, no Pay, no Record payment. A payment already logged keeps its own record as before.
  - The Schedule section prints `NOTHING_OWED_YET_LINE` (11 words) on the page when unbooked (`quoteScheduleFrame(...).line`).
  - `scheduleDueText(row, today, booked = true)`: unbooked rows read as the quote wrote them, never "that day has already passed".
  - Booked rows: every new condition reads `false` / the default — unchanged.
- **R13.** The Schedule ⓘ is the shared `InfoTip`; its 16-px circle presses at 46 through `.sn-dot-btn::after` (measured live at 390 px with `elementFromPoint` 20 px off-centre, all four sides). No change; pinned in the new test.

Tests: new `lib/an-unbooked-quote-owes-nothing.test.ts`; `lib/deposit-pay-step.test.ts` re-anchored on the owed rule's added clause.

SPEC IMPACT: None — implements the existing rule (an accepted quote is not a booking; BA2 / R10) on one more surface.
