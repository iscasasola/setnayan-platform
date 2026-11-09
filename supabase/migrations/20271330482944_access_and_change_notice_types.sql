-- access_and_change_notice_types
-- ============================================================================
-- 🔔 THREE IN-APP NOTICES FOR THE 8 NOV 2026 ACCESS RULE (owner: *"only
-- coordinator and hosts has the final say. so any supplier that is not a
-- coordinator still has to request a host or coordinator to accept the
-- change"*). IN-APP ONLY — none is on EMAIL_ENABLED_TYPES (owner: in-app
-- notices only, never email).
--
--   access_answered  → the supplier whose area ask a host or the coordinator
--                      answered (`answer_area_access_request`).
--   change_requested → every host and the booked coordinator, when a supplier
--                      proposes a change to the guest list, the seat plan or the
--                      suppliers (`event_change_requests`).
--   change_answered  → the supplier, when their change is accepted (applied in
--                      place) or declined.
--
-- ⚠ ITS OWN FILE, AND NOTHING ELSE IN IT, ON PURPOSE. notification_type is a
-- Postgres ENUM and Postgres forbids USING a newly-added value in the same
-- transaction that adds it (same shape as 20271299515167).
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'access_answered';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'change_requested';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'change_answered';
