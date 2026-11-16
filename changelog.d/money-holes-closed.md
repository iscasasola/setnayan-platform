## 2026-11-16 · fix(fees): the four money holes of the 16 Nov sweep — closed

#7841 proved four holes open with tests. This change flips each proof to assert the hole is CLOSED. Two holes were already closed on `main`; this change fixes the other two.

1. **A couple can forge a booking record — already closed on main by #7855** (`guard_event_vendor_provenance`). The OPEN proof fails 3/3 against main, and #7855's `tests/db/hole-1-a-couple-cannot-forge-a-booking-record.db.test.ts` passes 6/6, so the OPEN file is deleted.
2. **The public invite address launders a found couple — already closed on main by #7844** (`81d37c37`): `/vendor-invite/<slug>` → `importVendorToEventShortlist` writes `vendor_shortlist_qr`, which is a Setnayan save. The proof is renamed `tests/db/hole-2-the-invite-address-no-longer-launders-a-found-couple.db.test.ts`; 2a and 2b now read `sourced`, and a source scan pins the importer to `SHORTLIST_QR_SOURCE`. The 2b target ("only the first importer is free") was replaced the same day by the owner's "every supplier import carries at least one Setnayan gift" ruling.
3. **The booking fee follows the event, not the couple — fixed.** Migration `20271349691846_the_booking_fee_follows_the_couple.sql`:
   - keeps the per-event rule verbatim as `booking_fee_attribution_for_event`;
   - adds `booking_fee_first_contact_at`;
   - gives `booking_fee_attribution_for` one more arm: a couple member of this event who is a couple member of another event where the shop is sourced (that event's frozen ledger stamp, else its facts), with first contact there no later than here, makes this event sourced (owner LOCKED §3, "every repeat").

   Coordinators never carry a fee across events, a different couple changes nothing, and an earlier own client is not re-stamped. No data is written. Proof: `tests/db/hole-3-the-fee-follows-the-couple.db.test.ts`.
4. **An unpaid Pro buys the Ultra difference — fixed.** `readUltraUpgradeCharge` (`lib/order-charge-authority.ts`) counts a Plus / Pro order only in a paid status (`orderStatusConfersAccess`), and reads what was paid toward Pro in the `'active'` mode. An unpaid Pro earns no credit, and Ultra's row price applies (owner 2026-11-13, "an event that already PAID … pays the difference"). Proof: `lib/hole-4-an-unpaid-pro-cannot-buy-the-ultra-difference.test.ts`.

No UI change and no typed price.

SPEC IMPACT: None. The fixes implement existing rulings (Vendor_Monetization_Model_LOCKED_2026-07-25 §3; DECISION_LOG 2026-11-13 "EVENT ULTRA UPGRADE — PAY THE DIFFERENCE"; 2026-11-16 "THE SHORTLIST QR STAYS FREE BUT IS NOT AN IMPORT" and "EVERY SUPPLIER IMPORT CARRIES AT LEAST ONE SETNAYAN GIFT").
