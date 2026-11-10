## 2026-11-11 · chore(data): permanently delete the Saysay demo shop

Owner, 11 Nov, in chat: "delete say say shop" · "we do not need it anymore" · "Delete permanently". Migration `20271336539756_delete_saysay_demo_shop` deletes "Saysay Host and Band" (`vendor_profile_id` d266c234-3aca-46c3-b1c8-6a5c78e3f310, `S89B-THD5QCKPWM`, `is_demo = true`, owned by the testnayan2 fixture) and every row that exists only because of it: its cards, team seat, songs, schedule pools, proposals, follows, profile views, booking-fee ledger and charges, verification rows, its 3 conversations, an old booking row that has no event, its business dependent and its card price history.

It finds the shop by its uuid only, does nothing if the shop is already gone, and stops with an error if that uuid is ever not a demo shop. Kept: the testnayan2 account, every event, the two bookings on couples' events (each has a logged payment, so `event_vendors_refuse_delete_with_payments` / SUP-67 applies; they are only unlinked from the shop), the paid booking-fee order (ON DELETE SET NULL) and the admin audit log.

New `tests/db/the-saysay-demo-shop-is-deleted.db.test.ts` covers: a non-demo row with this uuid makes the migration refuse; the shop and its rows are deleted while a second shop, the owner and the event stay; running it again changes nothing. R2 files are not touched.

SPEC IMPACT: None — a data delete. No schema, product rule or decision changes.
