## 2026-07-24 · fix(privacy): hide vendor booking-fee orders from the couple's view

A couple / co-host could see the VENDOR's booking-fee order. The vendor-payer fee
order (`lib/booking-fee-lock.server.collectBookingFeeAtLock`) is stamped with the
couple's `event_id` so the vendor's own pay screen can scope it — `user_id` = the
vendor's account, `service_key` = `vendor_booking_fee__{chargeId}`. The co-host
read policy (`orders_owner_read`, from `20270129279924_orders_cohost_read.sql`)
admits ANY order carrying the event's id, so the couple's event-order reads
(`lib/orders.fetchOrdersForEvent`, the budget page's paid/fulfilled sum, the event
dashboard Services card) surfaced it — the couple could see the fee amount,
reference code and status. A couple must never see what their vendor is charged.

Closed at BOTH layers (defense in depth), vendor + admin access intact:

- **RLS (the real guard):** `20271102603681_orders_exclude_vendor_payer_from_event_reads.sql`
  tightens the co-host branch so it only admits orders whose PAYER is themselves
  an `event_members` row of that event (new SECURITY DEFINER helper
  `public.is_event_member(event_id, user_id)`). Couple purchasers + co-hosts are
  members → their shared-planning orders stay fully visible; the vendor is not a
  member → the vendor-payer fee order is excluded from every event-scoped read at
  the row level. Non-brittle (keyed on membership, not on parsing the
  service_key). The VENDOR still reads their own fee order via
  `user_id = auth.uid()`; admins still see everything via `public.is_admin()`; the
  WRITE policy is untouched. The fee-charge lane
  (`finalizeVendor` / `collectBookingFeeAtLock`, written with the RLS-bypassing
  service-role client) is untouched.

- **App-side belt:** `lib/orders.COUPLE_ORDERS_HIDE_VENDOR_FILTER` — a null-safe
  PostgREST `.or()` predicate (`service_key IS NULL OR service_key NOT LIKE
  'vendor_%'`) applied to `fetchOrdersForEvent`, the budget page's paid/fulfilled
  orders read, and the event dashboard's paid/fulfilled orders read. Drops every
  vendor-billing order (none belong in a couple's event-order list) while keeping
  legacy NULL-service_key ad-hoc orders (a bare `.not(...like...)` would silently
  drop NULLs).

Tests: `tests/db/orders-hide-vendor-fee.db.test.ts` — replayed-migration RLS
verification (couple/co-host don't see the fee order incl. adversarial
direct-by-order_id and by-reference_code; couple still sees own + co-host + ad-hoc
orders; vendor still reads own fee order; admin sees all; stranger sees none) plus
the app-side belt predicate proven RLS-off.

SPEC IMPACT: None (privacy fix — vendor fee orders are no longer visible to the couple; no product-surface or pricing change).

---

## 2026-08-04 · the July migration was re-issued — it would have opened a bigger hole than it closed

This PR sat open since 2026-07-24 with auto-merge armed, 930 commits behind `main`. Refreshing
it surfaced two defects in the original migration, both of which would have shipped silently.

**1 · It would have WIDENED the policy it was fixing.** The draft was written against an older
`orders_owner_read` that used `current_event_ids()`. Prod has since narrowed that branch to
`current_couple_or_coordinator_event_ids()`. Because the migration is a
`DROP POLICY … ; CREATE POLICY …` pair, re-issuing it verbatim would have dropped the narrow
policy and recreated the **broad** one:

| helper | admits |
|---|---|
| `current_event_ids()` | every `event_members` row — **guests included** |
| `current_couple_or_coordinator_event_ids()` | `member_type IN ('couple','coordinator')` |

So the fix for "the couple can see the vendor's fee" would have handed **every guest at the
wedding** the couple's entire order history — amounts, reference codes, statuses. Verified
against live prod (`pg_policy` + `pg_get_functiondef`) before rewriting rather than inferred
from the migration text.

**2 · It would probably never have run.** Prefix `20270930140000` sits below **114**
already-applied migrations (head `20271102113000`). Re-allocated via the allocator to
`20271102603681`.

**The test suite could not have caught either.** It seeded only a `couple` and a `coordinator`
— the two member types both helpers admit — so the widening was invisible to all 9 tests.
Added a `guest` fixture and a `REGRESSION` case asserting a guest reads **zero** rows, then
**watched it fail**: re-widening the helper turns it red (`# fail 1`), restoring it turns it
green (`# pass 10`). A guard nobody has seen fail is not a guard.

**Live-defect status:** confirmed still open in prod on 2026-08-04 — `orders_owner_read`'s
middle branch admits any order carrying the event's id, and the booking fee is armed.

SPEC IMPACT: None. No pricing, SKU or scope change — an RLS narrowing plus its regression test.

### Follow-up the same day: the first narrowing was TOO strict

CI's full db suite caught what my own suite could not: `papic-guest-orders.db.test.ts` —
*"the HOST of the event does see their guests' orders — host visibility, unchanged"* — went red.

An **account-less guest purchase** (Papic pool top-up / own-camera reload) is written with
`user_id = NULL`. `is_event_member(event_id, NULL)` is FALSE, so a membership-only test removed
the host's view of guest purchases — breaking the owner-locked *"the host is NOTIFIED, not
asked"* (2026-07-29). The predicate is now
`(user_id IS NULL OR is_event_member(event_id, user_id))`. The vendor fee order always carries
a real vendor `user_id`, so the NULL arm never re-admits it.

Pinned in this file too (test 4), so the exclusion reads as **"not the VENDOR"** and never
hardens into **"members only"**. 11/11 here, 20/20 on the papic suite.

🔑 The lesson is the shape, not the line: **that test existed precisely to catch a future
narrowing of this arm, and it worked.** My suite passed 10/10 while the change was wrong,
because I only seeded the payers I was thinking about.
