## 2026-07-11 · fix(appointments): recover the lost event_appointments + appointment_type_catalog migrations; add notification types (PR 2a)

**Recovery of a prod↔main drift.** The appointments schema was first committed as `20270713200000_event_appointments.sql` + `20270713200100_appointment_type_catalog.sql` (commit a8a923f03) with **hand-typed round prefixes**. It merged and auto-applied to prod (both tables live; `appointment_type_catalog` seeded with 28 presets; `event_appointments` empty), then the two migration files were **removed from main** (the round prefix violates the allocator rule) — but never re-added, and the changelog fragment survived. Result: **prod had the tables, main had no migration of record** (same failure mode as the 2026-07-11 AVIF re-land). Verified: `to_regclass` finds both tables on prod, 0 event_appointments / 28 catalog rows, and no appointments app code exists anywhere.

This PR re-adds the **exact original SQL** (recovered from git a8a923f03) under proper allocator prefixes, plus the two missing notification-enum values, closing the drift:

- `…_appointment_notification_types.sql` — `ALTER TYPE notification_type ADD VALUE` for `appointment_proposed` + `appointment_confirmed` (own file, committed before use). `appointment_reminder` already existed and is reused by the reminder email.
- `…_event_appointments.sql` — the two-sided appointment table (kind in_person|video|voice · type · custom_label · location · scheduled_at · duration_min · status proposed|confirmed|done|cancelled · initiated_by · thread_id link). RLS mirroring `event_schedule_suggestions`/`booking_handovers`: booked vendor insert/read/update own (`current_vendor_booked_event_ids ∩ current_vendor_profile_ids`); couple/host/coordinator via `current_event_ids`; admin read.
- `…_appointment_type_catalog.sql` — the category→meeting reference (authenticated SELECT / admin write), 28-preset seed. Seed `category` keys are ABSTRACT buckets (photo_video, caterer, hmua, couturier, officiant, any, …), NOT `event_vendors.category` slugs — the app layer maps a vendor's real slug onto these.

All three are **idempotent** (CREATE TABLE IF NOT EXISTS · DROP POLICY IF EXISTS · CREATE INDEX IF NOT EXISTS · per-row NOT EXISTS seed guard). **Validated by a rolled-back re-apply against live prod** (no error; catalog stays 28 rows) — so `db push` on merge is a safe no-op against prod, while a fresh CI/local/new-env DB gets the full schema + seed for the first time. `migration:check` green (allocator-sourced prefixes).

Foundation for the app layer (feed integration + two-sided scheduler UI + .ics + reminder email), which feeds these appointments onto the Journey/Preparation/Upcoming timelines.

SPEC IMPACT: Recovers the `event_appointments` + `appointment_type_catalog` tables from Relationship_Workspace_and_Appointments_2026-07-11.md § "New tables" into main's migration history (they were already live on prod). DECISION_LOG.md row appended.
