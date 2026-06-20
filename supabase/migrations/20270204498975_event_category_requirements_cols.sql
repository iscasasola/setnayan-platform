-- event category requirements cols
-- ============================================================================
-- Phase 1b · PR-1 — turn event_vendor_preferences into the couple's saved
-- per-category REQUIREMENTS TEMPLATE (the demand side of
-- canonical_service_schemas). It already stores the couple's per-category match
-- facets (attribute_payload, read by the preference-match sort, written by
-- nothing yet). This migration adds two requirement fields:
--
--   • special_request TEXT — a freeform per-category note from the couple
--     ("need a vegan station", "ceremony starts 3pm", …).
--   • auto_send BOOLEAN — the carry-forward flag: when set, this saved
--     requirements template is auto-attached to the couple's vendor inquiries
--     for that category.
--
-- Both are WRITTEN by the inquire pop-up in PR-3; nothing reads them yet
-- (additive + dormant, no behavior change). RLS is inherited from the table —
-- host-scoped via current_event_ids() + is_admin(), unchanged. Idempotent.
-- ============================================================================

ALTER TABLE public.event_vendor_preferences
  ADD COLUMN IF NOT EXISTS special_request TEXT;

ALTER TABLE public.event_vendor_preferences
  ADD COLUMN IF NOT EXISTS auto_send BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.event_vendor_preferences.special_request IS
  'Freeform per-category requirement note from the couple. Part of the saved requirements template; written by the inquire pop-up (Phase 1b PR-3), no reader yet.';

COMMENT ON COLUMN public.event_vendor_preferences.auto_send IS
  'Carry-forward flag: when TRUE the couple''s saved per-category requirements template is auto-attached to vendor inquiries for that category. Written by the inquire pop-up (Phase 1b PR-3), no reader yet.';
