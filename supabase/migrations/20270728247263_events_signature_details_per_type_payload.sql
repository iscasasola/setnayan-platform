-- events signature details per type payload
-- ─────────────────────────────────────────────────────────────────────────────
-- Per-event-type "signature" payload: a JSONB blob whose shape varies by
-- events.event_type (wedding love_story vs debut 18-roses vs christening
-- godparents vs birthday milestone vs corporate program …). This is the
-- generalised, per-type deep-signal store that the onboarding "specialty" of
-- each event type lands in — and that the Event Brief surfaces as its
-- `specialty` layer.
--
-- NULLABLE (not the usual NOT NULL DEFAULT '{}') is deliberate: NULL = "no
-- per-type signature captured yet" is a meaningful state the Brief's richness
-- gate reads, and the app's obj() normaliser coerces NULL → {} safely. Precedent
-- for a plain nullable add on events: 20270311811312_events_partner_birth_data.
--
-- Name avoids: (a) the `event_details` invitation-WIDGET-type string literal
-- (apps/web/lib/invitation-widgets.ts) and (b) the overloaded vendor "specialty"
-- taxonomy. Generalises events.love_story — the WEDDING instance stays in
-- love_story (the Brief aliases it); weddings leave signature_details NULL.
--
-- RLS: NONE needed. Plain column on public.events, already covered by the
-- existing row-level policies (event_member_can_read / couple_can_update_event /
-- couple_can_delete_event / events_moderator_read). Postgres RLS gates ROWS, not
-- columns; column privileges follow the table grant.
--
-- Idempotent · reversible (ALTER TABLE public.events DROP COLUMN IF EXISTS
-- signature_details; — no dependents).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS signature_details JSONB;

COMMENT ON COLUMN public.events.signature_details IS
  'Per-event-type signature payload (shape varies by events.event_type). Nullable: NULL = not captured. Generalises events.love_story (the wedding instance stays in love_story; the Event Brief aliases it). Distinct from the event_details invitation-widget type and the vendor "specialty" taxonomy.';
