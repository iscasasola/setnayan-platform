## 2026-07-11 · feat(appointments): event_appointments + appointment_type_catalog schema

Additive schema (no app code) for the appointments system — the two-sided
vendor↔couple scheduling backbone that generalizes the retired video-meeting
feature (in-person + video + voice, one row per meeting).

- `supabase/migrations/20270713200000_event_appointments.sql` — `event_appointments`
  table (kind in_person|video|voice · type · location · scheduled_at · duration ·
  status proposed|confirmed|done|cancelled · initiated_by), indexed on `event_id`
  and `vendor_profile_id`. RLS at CREATE time mirroring `event_schedule_suggestions`
  / `booking_handovers`: booked vendor org insert/read/update own
  (`current_vendor_booked_event_ids` ∩ `current_vendor_profile_ids`); couple/host/
  coordinator insert/read/update via `current_event_ids`; admin read via `is_admin`.
- `supabase/migrations/20270713200100_appointment_type_catalog.sql` —
  `appointment_type_catalog` reference table (category → meeting-type map), RLS
  mirroring `wedding_season_factors` (authenticated SELECT, admin-only write),
  seeded with 28 preset types from the corpus category→meeting map across 11
  categories. Free-text category-keyed; a 'custom' type is always available
  app-side regardless of catalog.

Migrations do NOT auto-apply — run via `supabase db push`. No behavior change until
the app layer (PR 11 scheduler) ships.

SPEC IMPACT: Relationship_Workspace_and_Appointments_2026-07-11.md (PR 11 — appointments schema)
