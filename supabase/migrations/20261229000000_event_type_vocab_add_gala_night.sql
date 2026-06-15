-- ============================================================================
-- 20261229000000_event_type_vocab_add_gala_night.sql
--
-- Add "Gala Night" to the event-type roster (owner 2026-06-16 "also add Gala
-- Night"). `event_type_vocab` is the SINGLE SOURCE for the roster (migration
-- 20261205000000): this one row flows automatically to the create-event picker,
-- the vendor "event types you serve" checkboxes, the marketplace ?event_type=
-- filter, AND the /admin/taxonomy event-applicability checkboxes — no TS edit
-- (EVENT_TYPES_FALLBACK is the fail-open fallback only; new types are NOT added
-- there by design).
--
-- enabled=FALSE — Gala Night joins the ACTIVE roster (vendors may pre-tag
-- coverage, the taxonomy may scope categories to it) but does NOT yet appear in
-- the couple-side create-event picker, matching how anniversary / graduation /
-- reunion were staged. Flip enabled=TRUE from /admin/event-types (Setnayan HQ)
-- when launching it to couples. status/enabled/emoji also carry sensible column
-- defaults; named explicitly here for clarity. Idempotent.
-- ============================================================================

BEGIN;

INSERT INTO public.event_type_vocab
  (event_type, label_en, sort_order, status, enabled, emoji, description)
VALUES
  ('gala_night', 'Gala Night', 13, 'active', FALSE, '🌟',
   'A formal evening — awards nights, fundraisers, and black-tie celebrations.')
ON CONFLICT (event_type) DO NOTHING;

COMMIT;
