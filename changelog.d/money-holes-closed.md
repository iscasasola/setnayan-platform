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

5. **Imported clients follow the owner's new rule** (16 Nov, specs `d4899cd5` amended by `9fe95ebe`, which supersedes "an imported client books free for life"). This is where holes 2 and 3 are decided, so the rule lands in the same `booking_fee_attribution_for`. Migration `20271350679653_imported_clients_free_one_year_or_first_import_on_the_event.sql`:
   - **(1)** An import that brought the client onto Setnayan is free with that supplier on every event for 12 months.
   - **(2)** For a client who already had an account, only the FIRST imported supplier on the event is free, whether the event is new or already on Setnayan.
   - **(3)** Every other supplier on that event pays, even when imported.
   - **(4)** An earlier Setnayan save or view now beats a supplier-brought row. The per-event mirror `bookingFeeAttributionFromFacts` and the fee case "the supplier invited the couple → free, even after a view" are flipped to match.
   - It reads only columns already on main (`event_vendors`, `event_members`, `events.created_at`, `chat_threads`, `vendor_profile_views`) and adds no schema. "The import created the account" is read structurally (the client's first event, and the import is the first thing on it), so it fails toward the fee.
   - Proof: `tests/db/imported-clients-free-one-year-or-first-import.db.test.ts`.

6. **The later 16 Nov fee rulings** (specs `34909f1`, `99b6ab5`, `993cdb9`, `1abf35b`). Migration `20271351371342_verified_shops_shortlist_qr_and_the_event_free_slot.sql`:
   - **Verified only:** an unverified shop pays on every booking. The free year and the first-import waiver count only for imports made after the shop was verified, dated from the newest approved initial or post-demotion verification.
   - **Bookings already made** keep their waiver: `booking_fee_ledger` freezes the attribution at the lock.
   - **The event's one free slot** is recorded in a new service-role-only table, `booking_fee_event_import_slots`, written by a trigger and backfilled. A first supplier who is removed (their row is hard-deleted) still uses the slot.
   - **The Shortlist QR is an import QR.** It moves from the Setnayan-save lists to the supplier-brought ones in SQL, in `booking-fee-gate.ts` and in `contact-shortlist-vendor.ts`.
   - **The couple's own Find invite** (`vendor_invites`) is free when claiming it created the shop, and pays the fee when an existing shop claimed it.
   - #7844's Shortlist QR tests and the fee cases are flipped to the new ruling. Fixtures that backdate imports now verify their shops earlier.
7. **Ultra while Pro is still being checked** (owner "Approved", 16 Nov): `readUltraUpgradeCharge` returns `plan_being_checked` for a `submitted` Pro, or a submitted Plus when no plan is paid, and the charge refuses it with one plain line (`plan_payment_being_checked`). Once Pro is verified, the difference is quoted as before.

No typed price. The only new words a person sees are the one refusal line in item 7.

SPEC IMPACT: None. The fixes implement existing rulings (DECISION_LOG 2026-11-16 d4899cd5 + 9fe95ebe "IMPORTED CLIENTS: A NEW ACCOUNT IS FREE FOR ONE YEAR…"; Vendor_Monetization_Model_LOCKED_2026-07-25 §3; DECISION_LOG 2026-11-13 "EVENT ULTRA UPGRADE — PAY THE DIFFERENCE"; 2026-11-16 "THE SHORTLIST QR STAYS FREE BUT IS NOT AN IMPORT" and "EVERY SUPPLIER IMPORT CARRIES AT LEAST ONE SETNAYAN GIFT").
