-- a_video_booth_chip
-- Created via `pnpm migration:new`. Idempotent — safe to re-apply.
--
-- 🎬 THE ONBOARDING PHOTO-BOOTH CHIP "Patiktok" READS "Video booth" (controller ruling 2026-11-22 on #8150;
-- Patiktok was retired 2026-11-20, DECISION_LOG "PATIKTOK AND MUSIC MAKER RETIRED").
--
-- Words only. ONE row of `onboarding_refinement_options`, found by its key (leaf `photo_booth`, option `Patiktok`):
-- only `label_en` changes. `option_key` stays 'Patiktok' on purpose — it is the value already stored in couples'
-- refinement answers, so changing it would orphan them. The photo stays.
-- The `label_en = 'Patiktok'` condition leaves the row alone if an admin has already renamed it through
-- /admin/categories, and makes a re-run a no-op.
-- No table, column, policy, grant or function. The code fallback (app/onboarding/wedding/_data/refinements.ts) says the same.

BEGIN;
SET LOCAL lock_timeout = '5s';

UPDATE public.onboarding_refinement_options
   SET label_en = 'Video booth',
       updated_at = NOW()
 WHERE leaf_key = 'photo_booth'
   AND option_key = 'Patiktok'
   AND label_en = 'Patiktok';

COMMIT;
