## 2026-08-04 · feat(booking-fee): the syncing fee and the schedule reservation move to vendor payment-acceptance (PR-I, flag-dark)

`Explore_Replan_BUILD_SPEC_2026-07-27.md` §7 + §12.2. The owner ruled on 2026-07-27 that a couple's Lock is a **REQUEST**, and the booking only becomes real when the vendor accepts the payment — *"when vendor accepts the payment, the schedule is now locked"*, and the vendor *"will be billed for the syncing fee alongside accepting it."* This moves both halves onto that transition.

**⚠ THE TRIGGER HAS BEEN RULED ON FIVE TIMES.** Ruling 4 (2026-07-24, "trigger = the lock") is what the code did — its own comment says so. Ruling 5 (2026-07-27, the handshake) is what this implements. Re-checked the log on 2026-08-04: **no ruling 6 exists.** The two later fee rows (2026-08-03) restate the RATE (5% then 1%) and the "Setnayan holds no money" posture; neither touches the trigger.

**The fee lived in THREE places and all three had to move together.** Leaving one behind bills at the lock *and* again at acknowledge — the same booking charged twice depending on which route the couple took:

| # | Call site | Route |
|---|---|---|
| 1 | `dashboard/[eventId]/vendors/actions.ts` (`finalizeVendor`) | the vendor page's Lock |
| 2 | `dashboard/[eventId]/vendors/packages/actions.ts` (`lockPackage`) | a package cascade lock |
| 3 | `lib/chat-lock-booking.server.ts` | **"🔒 Lock this deal" in CHAT** — the easily-missed one; a sweep of the vendors surface walks straight past it |

The flag registry in `lib/flag-chokepoint-scan.test.ts` now names all three plus the acknowledge action as gates, so a future edit that drops one turns that line red.

**⛔ The migration is not optional — without it the reservation is a guaranteed silent no-op.** `public.acquire_schedule_pools` opens with `IF p_event_id NOT IN (SELECT public.current_couple_event_ids())`. The caller here is the **vendor**; service_role has no `auth.uid()` either — both resolve to the empty set, and every existing caller swallows `not_authorized` as degrade-open. So the vendor would accept the payment, the app would say the date is locked, and no `vendor_schedule_pool_bookings` row would ever be written — the date stays sellable to the next couple, invisibly. The migration widens the guard to **couple OR booked vendor (`current_vendor_event_vendor_ids`) OR admin**. Its body was reproduced from the **live prod function** (`pg_get_functiondef`, 2026-08-04), not the migration file — `20271028166046`'s `AND sp.is_active` fix lives only in the deployed body.

**The money must land on the anchor, never a cascade row.** New `resolveFeeAnchorRowId` (`lib/booking-fee-lock.server.ts`): covered → its anchor; anchor/ordinary → itself; **anything unresolvable → `null` = bill nothing.** It never falls back to the covered row's own id — skipping a fee is recoverable, but billing the wrong row freezes a ledger ordinal (`ON CONFLICT … DO UPDATE` never rewrites `attribution`) and burns one of the vendor's five free bookings, permanently. Same identity now scopes the **pool acquire** (`acquireSchedulePoolsForBooking`), because occupancy counts every `event_vendor_id <> ours`: an anchor acquire plus an earlier covered-row acquire would eat the vendor's daily capacity twice for one booking and tell a real second couple the date is full.

**Also closed:** `fetchLockRequests` no longer offers covered or archived rows to a feed whose ids now move money (§12.2 step 9), and a `not_contracted` fee skip — the silent leak that makes a booking free forever — now logs loudly instead of passing (step 7).

**Flag:** new `NEXT_PUBLIC_LOCK_HANDSHAKE_ENABLED`, default OFF. It is deliberately NOT `NEXT_PUBLIC_BOOKING_FEE_ENABLED`, which is **armed in prod** and answers "may we bill at all" — it cannot also answer "bill at which step" without switching billing off to move it. Flag OFF ⇒ every lock path bills exactly where it does today and the acknowledge path is a pure no-op.

**Live-money context, re-measured on prod 2026-08-04 (read-only) — and it has MOVED since the spec was written:** `booking_fee_charges` 0 · `booking_fee_ledger` 0 · `chat_threads` **0** · `event_vendors` with a marketplace link **1 (was 0)** · covered/anchor rows 0 · deposits recorded 0 · deposits acknowledged **0**. Nothing has billed and nothing can bill yet — with zero threads every attribution resolves to `import` = free. The acknowledge path has **never run in prod**, so its rails are untested there by definition.

Tests — new `lib/booking-fee-anchor.test.ts` (9 cases). Every one asserts a **positive post-condition** (the exact id, or explicitly `null`), never "it didn't throw" — §12.6.2's rule for calls whose failure mode is a silent non-fatal return. Full unit suite green (6383), typecheck clean, no new lint warnings, migration-timestamp check passes (prefix above the applied head `20271102810371`).

SPEC IMPACT: None — executes §7 + §12.2 as written. The one addition the spec did not name is the dedicated `NEXT_PUBLIC_LOCK_HANDSHAKE_ENABLED` flag, added because §12.2's own correction forbids a second key on the fee flag and a live-money trigger move must be reversible by env var. **Surfaced for owner sign-off, not applied silently.**
