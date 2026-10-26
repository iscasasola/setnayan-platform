-- retire_mood_board_render_pack
--
-- Mood Board "Make it real" renders are retired (owner 2026-10-26, verbatim:
-- "mood board render is no longer available. can we delete that? there is no
-- more button for this"). The UI, the server actions, the Gemini client, the
-- web and App Store pack doors and the credit grant/reversal in
-- lib/sku-activation.ts are deleted in the same PR. This migration only makes
-- sure nothing can SELL the pack on the web: the catalogue row stays (an order
-- row may name it; none does today) and is switched off.
--
-- Measured on prod 2026-10-26 before writing this (read-only):
--   orders WHERE service_key ILIKE '%RENDER%'           → 0
--   app_store_purchases for the render pack             → 0
--   event_renders / event_render_credit_usage            → 0 rows
--   event_render_credit_grants                           → 1 row (a free
--     'consent_bonus' credit on the owner's own event, no order)
--   event_render_share_consent                           → 1 row (owner, withdrawn)
--
-- 🔒 THE RENDER TABLES AND RPCs ARE LEFT IN PLACE ON PURPOSE. Two of the tables
-- hold rows, and the rule for this retirement was "drop only if no data
-- exists". Dropping them (and the RPCs that read them) is a separate owner call.
--
-- Idempotent: re-applying sets the same value.
--
-- ⚠ DO NOT APPLY THIS DIRECTLY TO PRODUCTION. `deploy-prod.yml` runs
-- `supabase db push --include-all --yes` on merge.

UPDATE public.platform_retail_catalog_v2
   SET is_active = FALSE, updated_at = NOW()
 WHERE service_code = 'MOODBOARD_RENDER_PACK';
