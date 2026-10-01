## 2026-09-30 · fix(seating): Auto arrange adds tables until everyone has a seat, and its message tells the truth

Owner, on the live plan: *"it did not add tables"*. On that event, 82 guests
who hadn't declined (not counting the couple) had 16 chairs. Auto arrange seated
nobody and said "Everyone who hasn't declined already has a seat." That was two
bugs.

- **No tables were ever added.** `autoArrange` only filled the tables the room
  already had. It now counts open chairs (sweetheart and deleted chairs don't
  count) against the guests it must seat, using `autoSeatRoom`, which uses the
  same bookkeeping as `computeAutoSeat`. When chairs run short it creates
  `tablesToAddForAutoSeat`: Round (10 seats) tables that continue the room's
  "Table N" numbering (skipping 4 for a Chinese wedding, capped at 60). It then
  seats guests by the existing rules. Existing tables stay, hand-seated guests
  are never moved, and the sweetheart table is left alone. The editor lays the
  new tables out in the stage-out rings with the rest (sent under
  `autoArrangeNewTableKey(label)`). The server decides the count from fresh
  data, and any table the editor didn't foresee is created with no position
  rather than stacked.
- **The toast could lie.** The "Everyone … already has a seat" line appeared
  whenever `seated === 0`, including when the room was full. `autoArrange` now
  returns `tablesAdded` and `unseated` (the true count still without a chair),
  and `autoArrangeSummary` builds the message: tables added, then "N guests who
  haven't declined still have no seat" whenever N > 0. The 3D lab's fixed
  "Tidied every table and seated your guests." line uses the same builder.
- Auto Arrange's confirm dialog says tables are added when needed. No
  migration, no new server action, and 6 new pure tests in `lib/seating.test.ts`
  (each caught its sabotage).

SPEC IMPACT: `DECISION_LOG.md` row 2026-09-30 "AUTO ARRANGE ADDS TABLES UNTIL
EVERYONE WHO HASN'T DECLINED HAS A SEAT…" records the rule and the measured case.
