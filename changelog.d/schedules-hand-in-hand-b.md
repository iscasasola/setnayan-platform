## 2026-11-12 · feat(schedule): Schedules hand in hand, part (b) — the four owner rules

Owner ruling 2026-11-12 (DECISION_LOG "SCHEDULES HAND-IN-HAND part (b)"); prototype and audit in the specs repo,
`Build_Schedules_2026-11-12/`. Each rule extends a shipped piece — nothing re-drawn:

- **1 · A supplier's arrive / done STAY when the couple moves a chapter.** `move_schedule_chapter` takes a keep list
  (migration `20271340572060`, the two-argument call unchanged); the host action passes the supplier's own
  "<shop> arrives" / "<shop> is done" moments (`timesThatStay`, read by the same words `timesRequests` writes —
  `TIMES_SUFFIX`). After the move, each booked supplier on the chapter gets ONE chat line,
  "Schedule changed · Ceremony · 2:00 PM → 2:30 PM · 30 min later", drawn as the schedule card on both sides:
  "Ceremony is now 30 min later than you planned".
- **2 · A supplier's "done" WARNS before Save, never blocks.** The chapter sheet's Starts / Ends hold a new time that
  runs the chapter past a supplier's done: "Rosa Lens Studio is done at 10:30 PM — ask them?" · Ask Rosa (opens the
  shipped "Ask a supplier to change their times") · Save anyway. Only a new crossing warns. Lock my times still
  refuses in the database, as shipped (`refuseLockedPart` now runs on every moment that MOVES).
- **3 · The card PINS in the supplier's chat until Seen.** New pin kind `schedule_change` (due, never a blocker; the
  supplier's side only), read from the newest schedule line vs `event_supplier_schedule_marks.seen_at`. Seen is the
  shipped `supplier_mark_schedule('seen')`, from the card or the pin. The hosts' copy shows "✓ Seen · Nov 12".
- **4 · A venue's booked row shows only the chapter held in THAT hall.** A booked day's row on the supplier's Clients
  calendar now says the day's hours and the shop's own arrive · done (`readBookedDayHours` → `bookedRowHours`); a
  hall reads only the chapter whose `hours_vendor_id` is its booking (or, before the venue sent hours, the chapter
  it is linked to), and nothing rather than the whole event's hours when it has none.

Held by `lib/schedules-hand-in-hand.test.ts` and `tests/db/a-suppliers-times-stay-when-a-chapter-moves.db.test.ts`.
Screens: `build-sessions/shots-schedules-b/`.

SPEC IMPACT: None — implements the 2026-11-12 ruling already in DECISION_LOG; no decision changed.
