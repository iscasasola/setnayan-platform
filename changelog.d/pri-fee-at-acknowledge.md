## 2026-08-04 · feat(booking-fee): the syncing fee and the schedule reservation move to vendor payment-acceptance (PR-I)

`Explore_Replan_BUILD_SPEC_2026-07-27.md` §7 + §12.2. The owner ruled on 2026-07-27 that a couple's Lock is a **REQUEST**, and the booking only becomes real when the vendor accepts the payment — *"when vendor accepts the payment, the schedule is now locked"*, and the vendor *"will be billed for the syncing fee alongside accepting it."* This moves both halves onto that transition.

**⚠ THE TRIGGER HAS BEEN RULED ON FIVE TIMES.** Ruling 4 (2026-07-24, "trigger = the lock") is what the code did — its own comment says so. Ruling 5 (2026-07-27, the handshake) is what this implements. Re-checked the log on 2026-08-04: **no ruling 6 exists.** The two later fee rows (2026-08-03) restate the RATE (5% then 1%) and the "Setnayan holds no money" posture; neither touches the trigger.

**The fee lived in THREE places and all three had to move together.** Leaving one behind bills at the lock *and* again at acknowledge — the same booking charged twice depending on which route the couple took:

| # | Call site | Route |
|---|---|---|
| 1 | `dashboard/[eventId]/vendors/actions.ts` (`finalizeVendor`) | the vendor page's Lock |
| 2 | `dashboard/[eventId]/vendors/packages/actions.ts` (`lockPackage`) | a package cascade lock |
| 3 | `lib/chat-lock-booking.server.ts` | **"🔒 Lock this deal" in CHAT** — the easily-missed one; a sweep of the vendors surface walks straight past it |

All three are now REMOVED, not gated, and a repo scan keeps it that way — see below.

**⛔ The migration is not optional — without it the reservation is a guaranteed silent no-op.** `public.acquire_schedule_pools` opens with `IF p_event_id NOT IN (SELECT public.current_couple_event_ids())`. The caller here is the **vendor**; service_role has no `auth.uid()` either — both resolve to the empty set, and every existing caller swallows `not_authorized` as degrade-open. So the vendor would accept the payment, the app would say the date is locked, and no `vendor_schedule_pool_bookings` row would ever be written — the date stays sellable to the next couple, invisibly. The migration widens the guard to **couple OR booked vendor (`current_vendor_event_vendor_ids`) OR admin**. Its body was reproduced from the **live prod function** (`pg_get_functiondef`, 2026-08-04), not the migration file — `20271028166046`'s `AND sp.is_active` fix lives only in the deployed body.

**The money must land on the anchor, never a cascade row.** New `resolveFeeAnchorRowId` (`lib/booking-fee-lock.server.ts`): covered → its anchor; anchor/ordinary → itself; **anything unresolvable → `null` = bill nothing.**

⚠ **CORRECTED 2026-08-04, before this text is collected into `CHANGELOG.md`.** An earlier draft of this entry (and of the PR body) said a covered cascade row could reach the new call site **and get billed**. **That is wrong.** Verified against the LIVE prod function, not a migration file: `booking_fee_open_lock_charge` selects `ev.package_role` and refuses immediately — `IF v_ev.package_role = 'covered' THEN RETURN jsonb_build_object('skipped','covered_row_no_fee')` — before any money logic, and every money path reaches the charge through that one RPC. The supporting facts were each true (the lock-request feed has no `package_role` filter; the "covered rows carry no money" CHECK covers amounts, not deposit markers; this module has no anchor logic of its own) and the **consequence drawn from them was invented** — the guard sat one layer below where the trace stopped. Caught by a parallel session that re-verified the claim instead of relaying it.

**What the anchor resolution is actually worth**, both confirmed on the live functions:
- **UNDER-billing, a revenue hole:** without it, a vendor acknowledging on a covered row collects **nothing at all** — the RPC skips and the anchor's fee is never opened by that path. Resolving to the anchor turns a silent ₱0 into the correct single charge.
- **The pool double-consume, which has NO backstop:** `acquire_schedule_pools` does not read `package_role` at all, and occupancy counts every `event_vendor_id <> ours` — so an anchor acquire plus an earlier covered-row acquire eats the vendor's daily capacity twice for one booking and tells a real second couple the date is full. Routing every acquire through one identity is the only thing preventing it.

**Also closed:** `fetchLockRequests` no longer offers covered or archived rows to a feed whose ids now move money (§12.2 step 9), and a `not_contracted` fee skip — the silent leak that makes a booking free forever — now logs loudly instead of passing (step 7).

**The move is UNCONDITIONAL, and guarded rather than flagged.** The ruling has been in force nine days and nothing has ever billed, so a flag here would only preserve the superseded behaviour. Instead, `lib/booking-fee-single-trigger.test.ts` asserts the collector has **exactly one** non-test call site and that it is `vendorAcknowledgeDeposit` — failing in **both** directions (two callers = double billing; zero callers = a fee that can never be charged) and additionally asserting the anchor is resolved *before* the charge. **Mutation-verified:** re-adding the fee to `finalizeVendor` turns it red and names both sites. (Scanning approach proposed by the parallel session on #4082 and adopted here — it is a better mechanism for this risk than a flag.)

**A second, existing guard caught the change too, correctly:** `order-price-authority.test.ts` pins *which* callers must pass `createMoneyWriterClient()` into the collector. It was hardcoded to the two lock sites and went red the moment they stopped being money paths — exactly the behaviour you want from a money guard. Updated to the one real caller, with the companion check named in-place.

**Live-money context, re-measured on prod 2026-08-04 (read-only) — and it has MOVED since the spec was written:** `booking_fee_charges` 0 · `booking_fee_ledger` 0 · `chat_threads` **0** · `event_vendors` with a marketplace link **1 (was 0)** · covered/anchor rows 0 · deposits recorded 0 · deposits acknowledged **0**. Nothing has billed and nothing can bill yet — with zero threads every attribution resolves to `import` = free. The acknowledge path has **never run in prod**, so its rails are untested there by definition.

Tests — new `lib/booking-fee-anchor.test.ts` (9 cases). Every one asserts a **positive post-condition** (the exact id, or explicitly `null`), never "it didn't throw" — §12.6.2's rule for calls whose failure mode is a silent non-fatal return. Full unit suite green (6383), typecheck clean, no new lint warnings, migration-timestamp check passes (prefix above the applied head `20271102810371`).

⚠ **Built in parallel with #4082, which implemented the same move.** The two were complementary rather than duplicate: #4082 had the single-trigger CI scan, this had the anchor resolution, the reservation and the migration. The other session was paused and its guard idea folded in here, so nothing from it is lost. #4082 can be closed.

SPEC IMPACT: None — executes §7 + §12.2 as written.

**Bonus, surfaced by CI:** the migration's `REVOKE ALL … FROM anon` on `acquire_schedule_pools` closed one of the **190 unreviewed anon-callable SECURITY DEFINER functions** in the anon-RPC debt register. The freeze test caught it as a NARROWING and demanded its baseline line be deleted — which is the guard working exactly as designed (a freeze that only fails on widenings would have let this drift). Debt register: **182 → 181**. The function was previously reachable with only the publishable key that ships in the public JS bundle; its couple-session gate short-circuited anon in practice, but the grant itself is now gone.
