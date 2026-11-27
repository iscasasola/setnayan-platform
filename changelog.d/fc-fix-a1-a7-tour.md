## 2026-11-25 · fix(tour): final check area 1, batch a1-a7-tour

Lane A fixes on the tour and the sample event. No price, number or rule changed.

- **A1-010, A1-009, A1-011:** the tour calls itself a sample wedding in titles and share text, makes no speed or count claims ("in minutes", "the instant", "hundreds of"), and no longer claims to rank by distance, which it never uses.
- **A1-002:** /tour/budget's Committed, Paid and Left to pay come from `resolveEventMoney`, the one money reader; a refused read says "Couldn't read". The "due in N days" window is read from `TRIGGER_THRESHOLDS`.
- **A1-013:** no made-up ±15% "typical range" on the tour planner.
- **A1-014:** "Bring Memory lane to life" brings in the four newest real photos that weren't shown yet, instead of cloning photos already on the wall; the counter ends on the real total.
- **A1-006:** Find your seat greets the guest who was picked, not the first guest at their table.
- **A1-007:** a failed read on /tour/vendors, /tour/gallery or /tour/seating is said, never "0 found", an empty wall or "for 0 guests". `getWallSnapshot` reports `feedRead` (additive).
- **A1-012:** the tour chat's date and couple come from the sample event row.
- **A1-015, A1-016:** the sample guest Hub says "Opens on the wedding day" (`SAMPLE_WORDS`). Its "Copy link" copies a full address, and a failed ticket picture no longer draws a real guest's cookie QR (`fallbackQrSrc`).
- **A1-004:** /sample offers only the personas with a built view, each as a door to its sample guest Hub. "Opening soon" is gone.
- **A1-168:** Home's example couple is named as a sample wedding.

SPEC IMPACT: None.
