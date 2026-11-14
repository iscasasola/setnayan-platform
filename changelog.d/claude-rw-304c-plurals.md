## 2026-11-14 · copy(couple): RW-304c — "You have 1 credit", and the schedule door says what it counts

- **Papic buy sheet (web and iPhone):** reads "You have 1 credit" at one and "credits" otherwise. Before, it read
  "You have 1 credits".
- **Home's Schedule door:** "N owe times" was garbled. It counts booked suppliers the schedule names on nothing yet,
  meaning they have no call time. It now reads "1 supplier without a time" or "N suppliers without a time".
  - Not "payment due": the door is about times, not money.
  - It still opens the same page.
- The two guards that pinned the old wording (`the-ladder-is-a-stepper`, `the-schedule-widget-reads-chapters`) now
  read the new words. Nothing else changed.

SPEC IMPACT: None — copy only.
