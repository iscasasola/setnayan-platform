## 2026-06-20 · feat(vendor): Named Calendars Phase B — vendor Calendar UI (create/name a calendar, pick its services, set its limit)

Phase A (#1951) shipped the additive schema + the flag-gated resolver. Phase B is the vendor-facing UI on `/vendor-dashboard/calendar`, all behind the existing `NEXT_PUBLIC_NAMED_CALENDARS_ENABLED` (default OFF → today's auto-per-category calendars render unchanged).

When the flag is ON:
- **Create a calendar** — name it, set its daily limit, and check which of your services it covers (`createCalendar`). A service lives on one calendar at a time (PK `vendor_service_id`); assigning it moves it off any prior calendar.
- **Edit a calendar** — rename, change the limit, re-pick services (`editCalendar`, set-diff reconciliation). Unchecking a service removes its membership → it falls back to its category pool (owner: never silently un-gated).
- Tabs show `calendar_name`; the header copy + empty state become calendar-first; the legacy "Which categories share this team?" merge block is hidden (the service-picker replaces it).

Files:
- **`lib/vendor-schedule.ts`** — `SchedulePool` gains `calendarName` / `isVendorCreated` / `serviceIds`; `fetchVendorPools` reads them + service memberships (flag-on only; the new columns/table are selected ONLY when the flag is on, so a pre-migration DB is never queried for them); new `fetchVendorServicesForPicker` for the picker.
- **`calendar/actions.ts`** — `createCalendar` + `editCalendar` (+ shared `clampCapacityToTier` / `ownedServiceIds` helpers; `updatePoolCapacity` refactored onto the shared clamp).
- **`calendar/page.tsx`** — flag-branched UI; flag-off path byte-unchanged.

**Safety:** a "calendar" *is* a `vendor_schedule_pools` row — `daily_booking_capacity`, `vendor_schedule_pool_bookings`, and the acquire/release RPCs are untouched, so double-booking stays impossible. No new migration (Phase A carries the schema). The new columns/membership are read only when the flag is on, so this is inert + safe pre-migration. Rollout per the design doc: apply Phase A migration → enable for the test/sample vendor (Phase B allowlist) → assert flag-on resolves the same pools → flip globally (Phase C). Retiring the category path is Phase D.

The UI isn't runtime-verifiable from the dev env (needs the flag + migration + an authed vendor session) — `tsc` + unit green; wants a vendor smoke-test on go-live.

SPEC IMPACT: 0022 vendor Calendar — named calendars + service membership. Logged in `DECISION_LOG.md`; design `Named_Calendars_Rework_Design_2026-06-20.md`.
