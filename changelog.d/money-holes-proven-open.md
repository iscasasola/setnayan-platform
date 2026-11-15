## 2026-11-16 · test(fees): four money holes proven OPEN — tests only, no fix

The owner approved the controller sweep's order: prove the top four with tests, then fix them one by one. This change adds only the proof. Each test **passes while its hole is open**; the fix PR flips each `HOLE OPEN` assertion to its closed form.

1. `tests/db/hole-1-a-couple-can-forge-a-booking-record.db.test.ts` — a couple's own session writes an `event_vendors` row with another shop (`marketplace_vendor_id`, `linked_vendor_profile_id`, `source`) straight to `complete`/`delivered` with no supplier yes; `vendor_public_completed_events_stats` and `shop_booked_loop_count` count it; relabelling `source` to `vendor_invite` turns a sourced fee into an import.
2. `tests/db/hole-2-the-invite-address-launders-a-found-couple.db.test.ts` — a couple Setnayan showed the shop to (`event_vendor_found` written) who then opens `/vendor-invite/<slug>` is a free import; a second shop's invite on the same couple is free too.
3. `tests/db/hole-3-the-fee-follows-the-event-not-the-couple.db.test.ts` — the same couple, sourced to a shop on event A, books it again on event B and B is an import.
4. `lib/hole-4-an-unpaid-pro-buys-the-ultra-difference.test.ts` — an unpaid Pro order earns the Ultra "pay the difference" credit, the Pro can then be cancelled, and nothing takes the credit back.

No migration, no app code, no price.

SPEC IMPACT: None
