-- the_film_wears_the_main_background
-- Created via `pnpm migration:new`. Idempotent: ADD COLUMN IF NOT EXISTS, and every data step is guarded so a
-- second run finds nothing left to move (the film value is cleared in the same transaction it is copied in).
--
-- 🎞 LOOK RESTUDY ROW 6 — THE SAVE THE DATE FILM WEARS THE MAIN BACKGROUND; ITS OWN BACKGROUND RETIRES.
-- Owner-approved 2026-10-08 (spec corpus DECISION_LOG "APPROVED — THE LOOK RESTUDY: BACKGROUND · ELEMENTS · MUSIC";
-- BACKGROUND_RESTUDY_2026-10-08_fable.md § 4 and § 6 row 6). Owner, verbatim: "Save the date should adapt to the
-- main background as well. we stay 1 design for all."
--
-- ── WHAT IT DOES, IN ORDER (§ 4 "Migration") ────────────────────────────────────────────────────────────────
--   1. A 30-day copy: every film value that names a background of its own (`kind` set — plain · paper · realistic ·
--      upload) is copied VERBATIM into `events.std_background_retired`. A later migration drops it; nothing reads
--      the copy. NO GRANT, on purpose: `public.events` holds no table-level grant for anon or authenticated
--      (measured on prod 2026-10-18: SELECT · INSERT · UPDATE all false), so the new column is service-role only —
--      deny-listed with its reason in `apps/web/scripts/lint-events-column-grants.mjs`.
--   2. Nobody loses a chosen picture: a film that wore a ready-made scene (`realistic`) or the couple's own photo
--      (`upload`, a ref in the one public bucket) AND whose event's hero row has NO main background of its own gets
--      that picture as the main background — the shape `sanitizeHubMainGround` keeps (`{kind:'photo', media}`,
--      `apps/web/lib/hub-canvas.ts`). Rows with BOTH set: the main wins (owner: one design) — the film's value
--      lives on only in the copy.
--   3. The film value is cleared to its "follows" form: NULL, or `{follow:'theme', legibility}` when the couple
--      kept Lighten / Darken — the film's Readability is the one part of it that still means something (how the
--      film's words sit over the main background's picture; `stdFollowTheme`, `lib/std-backgrounds.ts`).
--
-- ── MEASURED BEFORE WRITING (prod, read-only, 2026-10-18) ────────────────────────────────────────────────────
--   `std_background->>'kind'` × "hero row has a main" → 2 events hold a film background of their own: 1 × plain,
--   1 × upload — and BOTH hero rows already carry a main background. So in production step 2 moves nothing (the
--   main wins on both) and step 1 keeps both values. The step is still written for the general case (a replay,
--   a restore, an event that picks one between this measure and the deploy).
--
-- ⚠ ANNOUNCED BEFORE ITS DEPLOY (DECISION_LOG 2026-10-08: "the migration PR (6) is announced before its deploy").
-- Applied ONLY by the pipeline (`supabase db push --include-all`), never by hand.

BEGIN;

-- ── 1 · THE 30-DAY COPY ──────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS std_background_retired JSONB;

COMMENT ON COLUMN public.events.std_background_retired IS
  'Look restudy row 6 (owner 2026-10-08): the Save the Date film''s OWN background as it was the day the film '
  'started wearing the main background — a verbatim copy of events.std_background, kept 30 days, read by nothing. '
  'Service role only (no grant). Dropped by a later migration.';

UPDATE public.events
   SET std_background_retired = std_background
 WHERE std_background IS NOT NULL
   AND jsonb_typeof(std_background) = 'object'
   AND std_background ? 'kind'
   AND std_background_retired IS NULL;

-- ── 2 · NOBODY LOSES A CHOSEN PICTURE ────────────────────────────────────────────────────────────────────────
-- A ready-made scene → its public path (the closed list `STD_REALISTIC_BACKGROUNDS`, apps/web/lib/std-backgrounds.ts).
UPDATE public.invitation_widgets w
   SET config_json = jsonb_set(
         COALESCE(w.config_json, '{}'::jsonb),
         '{main}',
         jsonb_build_object('kind', 'photo', 'media', '/std/backgrounds/' || (e.std_background->>'value') || '.webp')
       )
  FROM public.events e
 WHERE w.event_id = e.event_id
   AND w.widget_type = 'hero'
   AND NOT (COALESCE(w.config_json, '{}'::jsonb) ? 'main')
   AND jsonb_typeof(e.std_background) = 'object'
   AND e.std_background->>'kind' = 'realistic'
   AND e.std_background->>'value' IN (
     'aurora', 'golden-hour', 'peonies', 'rose-archway', 'seascape',
     'starlit', 'sunrise', 'bridgerton', 'ballroom', 'fairy-lights'
   );

-- The couple's own photo → its ref, only when it is in the ONE public bucket the guest page may serve
-- (`siteMediaServeRef`); anything else the sanitiser would drop, so it is not written.
UPDATE public.invitation_widgets w
   SET config_json = jsonb_set(
         COALESCE(w.config_json, '{}'::jsonb),
         '{main}',
         jsonb_build_object('kind', 'photo', 'media', e.std_background->>'value')
       )
  FROM public.events e
 WHERE w.event_id = e.event_id
   AND w.widget_type = 'hero'
   AND NOT (COALESCE(w.config_json, '{}'::jsonb) ? 'main')
   AND jsonb_typeof(e.std_background) = 'object'
   AND e.std_background->>'kind' = 'upload'
   AND (e.std_background->>'value') LIKE 'r2://setnayan-media/%';

-- ── 3 · THE FILM FOLLOWS ─────────────────────────────────────────────────────────────────────────────────────
UPDATE public.events
   SET std_background = CASE
         WHEN std_background->>'legibility' IN ('lighten', 'darken')
           THEN jsonb_build_object('follow', 'theme', 'legibility', std_background->>'legibility')
         ELSE NULL
       END
 WHERE std_background IS NOT NULL
   AND jsonb_typeof(std_background) = 'object'
   AND std_background ? 'kind';

-- ── POST-CONDITION — refuse to apply rather than ship a half-move ───────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.events WHERE jsonb_typeof(std_background) = 'object' AND std_background ? 'kind') THEN
    RAISE EXCEPTION 'a Save the Date film still holds a background of its own';
  END IF;
END $$;

COMMIT;
