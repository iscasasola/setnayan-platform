## 2026-11-24 · feat(supplier offline): the engine — versioned schedule, expo holds, offline client QR, money and gifts re-checked at sync

Owner, 24 Nov (DECISION_LOG "The supplier dashboard works offline and catches up when back online"): the engine and server side; the screens follow the approved drawing.

- Every supplier action made with no signal (schedule, clients and leads, notes, message drafts, bookings, payment records, gifts) is kept in the SHIPPED offline queue (`lib/offline/`, a `supplier` store) and sent when the signal returns, through the one save door (`saveInPlace`, stay door `supOffline.supplierOffline`). No new server action.
- First save wins: schedule items carry a version (`vendor_calendar_blocks`, `vendor_calendar_day_states`); a stale or blocked write comes back as a typed clash `{why, by, at}`, never merged.
- Expo mode: one member holds dates; the others' writes into them are refused, offline and online, until the holder syncs or lets go.
- Money: the server re-reads every amount through `event_vendor_money_read` (and the payment row) before the shipped action runs; a moved amount comes back `needs_reconfirm {offline, live}`. Nothing is bought or paid offline (R15): no purchase is ever queued.
- Every row is versioned: a queued write that names a row is applied only if that row's `updated_at` is unchanged; otherwise "Couldn't save: … changed this while you were offline".
- Gifts: given from the live stock at sync; none left comes back "Gift not sent: no gifts left".
- R14: a booking made offline counts on that phone at once (`localSlot`): the time reads "Booked · not confirmed yet", a full day reads full, and the QR's free-time check, "To collect" and the gift balance read the same copy plus queue.
- Offline client QR, no stock (DECISION_LOG 7d618cb3): each phone makes a non-extractable ECDSA P-256 key once online and registers only its public half; offline every QR gets a new random code id signed by the phone, with no personal data. The client's scan puts the date on the supplier's calendar through the shipped invite claim; the server checks the signature against the phone's active key (node:crypto) and takes each code id once. "Stop QR codes from this phone" (a Shop Manager, or that branch's Branch Manager) refuses every unscanned code from it. Signing out wipes the phone's queue, keys and answers and stops its key rows.
- Teammates see "last seen" and held dates, never a count of another phone's changes (R5, corrected).
- Migration `20271363269436_supplier_offline_engine.sql`; PGlite test `tests/db/the-supplier-works-offline.db.test.ts`; guards `lib/supplier-offline/the-supplier-works-offline.test.ts`, `lib/supplier-offline/qr.test.ts`.

SPEC IMPACT: None. Builds the 24 Nov ruling as written; no product decision changed.
