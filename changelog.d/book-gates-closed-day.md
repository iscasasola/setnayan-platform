## 2026-11-14 · fix(booking): a day the supplier closed takes no ask and no yes

Owner, 14 Nov: *"Grey: no ask, no book"* (DECISION_LOG "A DAY THE SUPPLIER CLOSED IS GREY — NO ASKING, NO BOOKING").
Until now a card with no time slots was refused on a closed day only when the deposit was recorded
(`acquire_schedule_pools`). The approved date sheet already showed that day as "Not bookable".

- **One source.** `lib/closed-day.server.ts` reads the date sheet's own six reads (now one exported loader,
  `readShopDateFacts`, which the public page also reads through, unchanged) and its month builder (`checkDateAnswer`).
  The rule is pure, in `lib/closed-day.ts`:
  - **Closed, not full.** A full day is not refused here: the waiting list needs an ask on it, and the yes already
    refuses it on capacity (`checkDateAnswer` gains `closedOnly`).
  - **Only blocks the supplier chose close a day:** `manual` and `synced_calendar`, plus a held day. The automatic
    booked-date block and an outside-client block mean full, not closed.
- **The couple's ask is refused at all four doors**, before any write, with the slot path's own words ("The supplier
  has closed this date on their calendar …"): `finalizeVendor` (the no-slot path), `lockPackage`, the wizard's
  [Lock this vendor], and the chat lock (`bookVendorAtChatLock` → new outcome `date_closed`, said by `lockDeal`). A
  package and the wizard name no card, so for them the day must be closed for the shop as a whole.
- **The supplier's yes is refused** before `vendor_agree_to_lock` (`closedDayOfAsk` → `?lock_agree=day_closed`, with a
  door to Dates). It catches an ask made before the day was closed. The ask is read through the supplier's own session.
- Day-precise events only (a month-only event is stored as the 1st). Fails open, logged, on a read error; the deposit
  gate still refuses the day after.
- Guard: `lib/a-closed-day-takes-no-ask-and-no-yes.test.ts` (7 tests; 8 sabotages, each seen red).

SPEC IMPACT: None. This implements the 2026-11-14 DECISION_LOG row.
