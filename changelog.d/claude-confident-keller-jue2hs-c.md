## 2026-11-28 · feat(seat-plan): C — Find shows the seat on 2D

Owner approved seat plan C on 28 Nov (DECISION_LOG; `SEAT-PLAN-COMPLETE-2026-11-27.md` § 4.5; drawing
`prototypes/seating_later_2026-11-27/`). Enter in Seats' Search used to light only the TABLE on 2D. Now:
- **The seat lights:** the found guest's seat pulses twice, then stays lit.
- **A pill:** "Name · Table · Seat N" sits over the thumb row, and a tap opens their table.
- **The search field** says "1 of N", and Enter steps to the next one found. The count is a new optional `count` on the
  ONE thumb row's field (`components/thumb-row.tsx`).

SPEC IMPACT: None — builds § 4.5 and the approved drawing as written.
