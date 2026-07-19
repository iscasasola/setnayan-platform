-- 20270726622326_enable_all_event_types.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Enable EVERY active event type in the couple-side create-event picker.
--
-- Owner decision (2026-07-11): "enable them all." Flips the four remaining
-- staged `event_type_vocab` rows — anniversary · graduation · reunion ·
-- gala_night — from enabled=FALSE to TRUE, so all fourteen active types appear
-- in /dashboard/create-event alongside the ten already live (wedding, debut,
-- gender_reveal, birthday, celebration, travel, corporate, tournament,
-- christening, simple_event).
--
-- `enabled` is the couple-side visibility lever (see 20261205000000_event_type
-- _vocab_dynamic.sql); `status` remains the active/retired lifecycle field. The
-- update is scoped to status='active' AND enabled=FALSE so it (a) touches only
-- rows that actually change, and (b) can never resurrect a retired type.
--
-- Behaviour of the newly-enabled types: they carry no dedicated onboarding_href,
-- so creation uses the generic inline create-event form, and the dashboard reads
-- GENERIC_PROFILE terminology via resolveProfile() (no seeded event-type profile
-- row required — the four types degrade gracefully). Tailored onboarding flows +
-- profiles for these types are a follow-up, not a prerequisite for this flip.
--
-- Idempotent · safe to re-run · reversible (set enabled=FALSE per type, or from
-- /admin/event-types at Setnayan HQ).
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.event_type_vocab
   SET enabled    = TRUE,
       updated_at = now()
 WHERE status  = 'active'
   AND enabled = FALSE;
