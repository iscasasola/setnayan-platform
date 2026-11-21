-- cake_maker_parts_photos_and_letters
--
-- 🎂 THE CAKE MAKER (DECISION_LOG 2026-11-21 "CAKE MAKER — APPROVED TO BUILD", drawing
-- prototypes/cake_maker_2026-11-21/cake_maker_fable.html). Three ADDITIVE, NULLABLE columns — every
-- existing row reads exactly as before (NULL = not a cake line / no photo / no cap).
--
-- RULE 0 — what was checked before adding anything (supabase/security/prod-schema.snapshot.txt):
--   • Tiers · Finish · Design · Topper · Colours are SHIPPED choice lines (vendor_package_items +
--     vendor_package_item_options): Standard option at +0, extras in price_delta_centavos (>= 0),
--     "Choose 1–3" = pick_min/pick_max. No new storage for any of them.
--   • Flavour "asked for each tier" = SHIPPED follow-up lines (parent_option_id): under each size
--     option, one flavour line per tier. Each tier is its own line with its own pick, so the shipped
--     pricer (computePackageCredit / lockPackage) charges a flavour extra per tier with NO change.
--   • The message = a SHIPPED Form Maker short_answer question (vendor_questions on a vendor_forms row
--     linked to the card through vendor_form_service_links).
--   What NO existing column holds, and so is added here:
--   1. vendor_package_items.cake_part — which part of the cake a line is. Nothing on the row says it;
--      a line's name is supplier-typed and cannot be an identity.
--   2. vendor_package_item_options.photo_ref — the one portfolio photo on a Design option (ruling 4).
--      Options had no media column. The ref is re-checked against the shop's own portfolio on save.
--   3. vendor_questions.max_letters — the longest answer ("Up to 40 letters"). No question had a cap.
--
-- Grants: the tables' existing table-level grants cover new columns; nothing is revoked or widened.

BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.vendor_package_items
  ADD COLUMN IF NOT EXISTS cake_part TEXT;

ALTER TABLE public.vendor_package_items
  DROP CONSTRAINT IF EXISTS vendor_package_items_cake_part_ck;
ALTER TABLE public.vendor_package_items
  ADD CONSTRAINT vendor_package_items_cake_part_ck
  CHECK (cake_part IS NULL OR cake_part IN ('tiers', 'flavour', 'finish', 'colours', 'design', 'topper'));

COMMENT ON COLUMN public.vendor_package_items.cake_part IS
  'Cake Maker (2026-11-21): which part of a cake card''s "Your cake options" this line is. NULL = an ordinary line (every row before this migration). Flavour lines are follow-ups (parent_option_id) under a tiers option, one per tier, bottom tier first by display_order.';

ALTER TABLE public.vendor_package_item_options
  ADD COLUMN IF NOT EXISTS photo_ref TEXT;

ALTER TABLE public.vendor_package_item_options
  DROP CONSTRAINT IF EXISTS vendor_package_item_options_photo_ref_len_ck;
ALTER TABLE public.vendor_package_item_options
  ADD CONSTRAINT vendor_package_item_options_photo_ref_len_ck
  CHECK (photo_ref IS NULL OR char_length(photo_ref) BETWEEN 1 AND 500);

COMMENT ON COLUMN public.vendor_package_item_options.photo_ref IS
  'Cake Maker (2026-11-21): one photo from the shop''s OWN portfolio on a Design option (a readPortfolioPicks ref, re-checked on save). NULL = no photo.';

ALTER TABLE public.vendor_questions
  ADD COLUMN IF NOT EXISTS max_letters INT;

ALTER TABLE public.vendor_questions
  DROP CONSTRAINT IF EXISTS vendor_questions_max_letters_ck;
ALTER TABLE public.vendor_questions
  ADD CONSTRAINT vendor_questions_max_letters_ck
  CHECK (max_letters IS NULL OR max_letters BETWEEN 1 AND 200);

COMMENT ON COLUMN public.vendor_questions.max_letters IS
  'Cake Maker (2026-11-21): the longest answer a couple may write ("Message on the cake · up to 40 letters"). NULL = the shipped ANSWER_MAX.';

COMMIT;
