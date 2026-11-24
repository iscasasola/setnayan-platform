## 2026-11-24 · feat(supplier offline): the engine — versioned schedule, expo holds, offline client QR, money and gifts re-checked at sync

Owner, 24 Nov (DECISION_LOG "The supplier dashboard works offline and catches up when back online"): the engine and server side; the screens follow the approved drawing.

- Every supplier action made with no signal (schedule, clients and leads, notes, message drafts, bookings, payment records, gifts) is kept in the SHIPPED offline queue (`lib/offline/`, a `supplier` store) and sent when the signal returns, through the one save door (`saveInPlace`, stay door `supOffline.supplierOffline`). No new server action.
- First save wins: schedule items carry a version (`vendor_calendar_blocks`, `vendor_calendar_day_states`); a stale or blocked write comes back as a typed clash `{why, by, at}`, never merged.
- Expo mode: one member holds dates; the others' writes into them are refused, offline and online, until the holder syncs or lets go.
- Money: the server re-reads every amount through `event_vendor_money_read` (and the payment row) before the shipped action runs; a moved amount comes back `needs_reconfirm {offline, live}`. A purchase is never charged from the queue ("Pay when online").
- Gifts: given from the live stock at sync; none left comes back "Gift not sent: no gifts left".
- Offline client QR: one-time codes per member device (50, refilled online), each signed with its own secret, no personal data; the client's scan puts the date on the supplier's calendar through the shipped invite claim; one code makes one entry. Teammates can cancel a lost phone's codes. Signing out wipes the phone's queue, codes and answers.
- Migration `20271363269436_supplier_offline_engine.sql`; PGlite test `tests/db/the-supplier-works-offline.db.test.ts`; guards `lib/supplier-offline/the-supplier-works-offline.test.ts`, `lib/supplier-offline/qr.test.ts`.

SPEC IMPACT: None. Builds the 24 Nov ruling as written; no product decision changed.
