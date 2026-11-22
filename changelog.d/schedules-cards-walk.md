## 2026-11-22 · fix(booking): every booking door asks the shop's window and the card's order lead; the days strip stops dating month-only events

Supplier-ready walk of schedules and service cards (controller, 22 Nov; owner: "service cards working … and schedules"). Result before the fix: service cards 5 of 7, schedules 3 of 5. This PR fixes three of the four breaks. The fourth (the supplier's yes cannot see a full or closed team/hall day) needs a migration and is flagged.

- **One window check for every door.** The shop's At least · At most (owner 2026-11-19) was refused only on the supplier-page ask (`finalizeVendor`). The chat's "Lock this deal" (`bookVendorAtChatLock`, new outcome `outside_window`), a package lock (`lockPackage`) and the wizard's [Lock this vendor] asked the supplier for a day Check a date had shown as Not bookable. All four now ask ONE helper, `bookingWindowRefusal` (`lib/booking-window.server.ts`), beside the closed-day check. It fails open on a read error, logged, like the closed-day check.
- **Made to order on every card.** "Order at least N days before" (`service_card_order_lead_days`) is now asked above the slot / daily-capacity split. A Made-to-order card that kept time slots was asked with no lead check.
- **The Schedule page's days strip** no longer draws a month- or year-only event (stored on the 1st) as "Event day" on the 1st. The precision rides the page's existing events read (no new read). An unread precision keeps the date as before.
- Guard: `lib/every-booking-door-asks-the-window.test.ts` (5 sabotages, each red). `lib/booking-window.test.ts` now points at the helper.
- Server actions: no new export.

SPEC IMPACT: None. It enforces the approved 2026-11-19 booking-window and Made-to-order rulings on every door. Open (needs a migration GO): `vendor_agree_to_lock` does not ask `schedule_pool_taken_on` or the pool's closed/locked days, so a supplier can say yes to a full team/hall day that only the deposit (`acquire_schedule_pools`) refuses.
