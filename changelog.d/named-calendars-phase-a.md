## 2026-06-20 · feat(vendor): Named Calendars — Phase A (data foundation + resolver, flag-gated)

Owner-chosen 2026-06-20: shift vendor scheduling from auto per-category pools to **vendor-named calendars** where the vendor picks **which services** a calendar covers. This is **Phase A** — the additive data foundation + the single resolver swap — fully inert behind `NEXT_PUBLIC_NAMED_CALENDARS_ENABLED` (default OFF). The create/name/pick-services Calendar UI is the next PR. Design: `Named_Calendars_Rework_Design_2026-06-20.md`.

**The safety property:** a "calendar" *is* a `vendor_schedule_pools` row. That table, `daily_booking_capacity`, `vendor_schedule_pool_bookings`, and the `acquire_schedule_pools` / `release_schedule_pools` SECURITY DEFINER RPCs are **unchanged**. Phase A only adds a vendor name on the pool + an explicit service→pool membership table, then backfills so every service maps to the **exact** pool it resolves to today. `pool_id`s never move → no booking touched, double-booking guarantee intact.

- **Migration `20270209750853`** (additive, idempotent, NOT applied) — `vendor_schedule_pools` + `calendar_name` + `is_vendor_created`; new `vendor_schedule_calendar_services` (`PK(vendor_service_id)` = one calendar per service, owner decision) with RLS mirroring `vendor_schedule_pool_categories`. Backfill: names every pool (joined category keys for merged pools) + pins every service to its current category pool (`ON CONFLICT DO NOTHING`). Includes a commented post-apply **conservation check** (no live booking left with an unreachable pool).
- **`lib/schedule-pools.ts` → `resolvePoolIdsForService`** — flag branch. ON: the service's own pool comes from `vendor_schedule_calendar_services`; an unassigned service **falls back to its category pool** (owner decision — never silently un-gated; logs a warning). Bundle "comes with" legs stay **category-resolved** in both modes so a bundle's lock footprint never narrows. OFF: today's exact behavior. After backfill, flag-on returns the **same `pool_id`s** as flag-off → the downstream `acquire` is identical.

Owner decisions baked in (2026-06-20): one calendar per service; unassigned stays bookable via category fallback; "merge" replaced by the service-picker (existing merged pools just become named calendars — UI removal lands with the UI PR). Pre-existing gap flagged separately, NOT touched here: the `vendor_packages` true-bundle SKU bypasses all capacity gates.

tsc clean. Rollout: apply migration → run conservation check → enable per-vendor → flip globally (after the UI PR).

SPEC IMPACT: booking schedule-pool model (0022). Logged in `DECISION_LOG.md`; design doc `Named_Calendars_Rework_Design_2026-06-20.md`.
