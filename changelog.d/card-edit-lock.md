## 2026-11-19 · feat(supplier): a service card a booked client is using cannot be edited

Owner ruling 19 Nov (DECISION_LOG "SERVICE CARD EDIT LOCK + SUPPLIER CLAIM JOURNEY"): *"you can only edit a service
card, if there are no booked client that you are working with."*

- **Server first.** Every card save — the maker's `commitVendorService` (before the gift clear and the
  `save_vendor_service` RPC, its only caller), `updateVendorService`, `setServiceLinks`, `setServicePaymentSchedule`,
  `addServiceTimeSlot`, `deleteServiceTimeSlot`, `setServiceAddons` — asks `refuseEditOfBookedCard`
  (`lib/service-open-bookings.ts`) before it writes, and refuses with the Problem, each open booking, and the Solution.
- **"Booked" is not new:** the same open set the delete and turn-off locks already read (`OPEN_BOOKING_STATUSES` =
  contracted · deposit_paid · delivered on a live event, via `readCardBookings`). Complete, cancelled and deleted-event
  bookings do not lock.
- **Fails closed:** a refused ownership or bookings read refuses the save (`CARD_EDIT_UNREAD`) and the maker says it
  could not check — locked, never "free to edit".
- **UI:** the maker shows the card read-only (`inert`) under a 🔒 row; tapping it (or the thumb row's Locked) rises the
  shared `LockExplainer` — Problem "A booked client is using this card", the Solution, the open booking, and one door:
  Start another from this. The explainer gained a `bookings` need for locks lifted by bookings, not papers or a plan.
- Lab: `/dev/card-maker-lab?s=edit&lock=booked|unread`.

SPEC IMPACT: None — implements the 19 Nov ruling as written.
