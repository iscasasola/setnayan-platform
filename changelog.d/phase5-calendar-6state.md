## 2026-07-01 · feat(vendor-calendar): 6-state day taxonomy + net-new locked/whitelist storage + month→day drill-down

Phase 5 of the vendor-dashboard reorg. The shipped calendar already had
server-enforced per-date capacity (the atomic `acquire_schedule_pools` RPC gates
double-booking, tier `slotsPerDay` clamps capacity) and a FREE Booked-Out
Waitlist (couple "Join waitlist" CTA + vendor queue + auto-notify on cancel), so
this PR adds the genuinely-missing piece: the two day states with no prior
storage, wired end-to-end.

- **New migration `20270403356945_vendor_calendar_day_states_6_state_taxonomy.sql`:**
  - New table `vendor_calendar_day_states` (RLS at CREATE: vendor-owner via
    `current_vendor_profile_ids()` + `is_admin()`; NO couple/public read — the
    privacy lock holds). Holds the two vendor-set states with no home before:
    `locked` (hard hold) and `whitelist` (approve-first). `open`/`booked`/`full`/
    `blocked` stay derived; `waitlist` stays in `vendor_date_waitlist`.
  - New SECURITY DEFINER `set_vendor_calendar_day_state()` — owner-authenticated
    upsert/clear, org-wide (NULL pool) or pool-scoped, validates ownership +
    pool membership. Idempotent (partial-unique folded via COALESCE sentinel).
  - `acquire_schedule_pools()` re-defined (byte-identical to the base except the
    new gate) to honor the two states server-side: precedence closure → **locked**
    → **whitelist** → capacity. A locked/whitelist day can no longer be
    double-booked out from under the vendor by the atomic booking-accept path.

- **App:** `PoolAcquireResult` gains `locked`/`whitelist`; both deposit paths in
  `dashboard/[eventId]/vendors/actions.ts` surface a couple-safe message (never
  who/why). New `setCalendarDayState` server action. New `fetchVendorDayStates`
  reader (fail-soft → 4-state view on a pre-migration DB). Month grid now renders
  🔒/✓? chips + a new `calendar/[date]` month→day drill-down (per-schedule state,
  set/clear day-state controls org-wide or per-schedule, booked list, waitlist
  notify). Deferred (allowed): heat-map + per-agent/type filters.

Verified: typecheck · ESLint (all changed files) · lint:retired · lint:navicon ·
lint:botnav · lint:entitlement-gates · migration timestamp guard · unit tests ·
production build.

SPEC IMPACT: None (code-canonical per the 2026-06-07 source-of-truth flip; this
implements the Phase 5 build-plan slice — the corpus is reference/archive). The
6-state taxonomy names (open/booked/blocked/locked/whitelist + waitlist) are now
concrete in schema; a decision-log note can be appended if desired.
