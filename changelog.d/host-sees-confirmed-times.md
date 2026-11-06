## 2026-11-02 · fix(schedule): the host sees a supplier's "Confirm my times" and "Seen"

Supplier gate audit G6 (owner 2026-11-02, "A SUPPLIER'S SCHEDULE BASICS FOR THIS WEEK"). A booked supplier's Confirm my times told them "The host sees your times are final" — and no host screen read `event_supplier_schedule_marks`.

- One rule, `lib/supplier-schedule-marks.ts`: Confirmed wins over Seen; nothing pressed says nothing.
- **Suppliers › Booked (Team row)**: "✓ Times confirmed · Nov 2" / "Seen · Nov 2" under the call time (`timesMarkFor`, keyed by the booking's shop; read by `readScheduleMarks` in the Booked slot; a refused read is said).
- **Schedule**: the moment's supplier line (`supplierOnItem`) reads "Kusina · Booked · Times confirmed" — `readScheduleSuppliers` reads the marks with the shop names.
- Guard `lib/the-host-sees-confirmed-times.test.ts`.

SPEC IMPACT: None. No migration — the couple and Schedule-helper read policies already existed.
