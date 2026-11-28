-- ============================================================================
-- 20271367965867_facebook_catch_up_29_nov.sql
--
-- The Facebook catch-up of 29 Nov 2026 (owner, 29 Nov: "move all schedules. we
-- want the posts that were supposed to be today" · "we can have 6 posts today.
-- so everything goes in sync").
--
-- The code side is the dated exception in apps/web/lib/social/governor.ts
-- (CATCH_UP_DAYS): on 2026-11-29 Manila only, the day carries up to 6 posts on
-- whole hours 08:00–22:00 (so ≥ 1 h apart). This migration puts the posts there.
--
--   1. Pulls the two test-shop badge posts (Liwanag Lights & Sound · Testnayan
--      W1 Lights: one test shop, source_ref '485d28a2-…:<badge>'). Pulled, never
--      retried.
--   2. Places the day's six posts, in this order, each on its own whole hour:
--        10:00  First public post                     (announcement)
--        12:00  Introduce Setnayan · Plan it, free     (library, planned 28 Nov 08:00, missed)
--        14:00  Articles · The bridal car and motorcade (already handed to Facebook for 14:00: left as is)
--        16:00  Introduce Setnayan · Live it, together (library, planned 29 Nov 08:00)
--        18:00  Comment Bait · unusual client request  (library, planned 28 Nov 20:00, missed)
--        20:00  Comment bait for suppliers · 5 words   (library, planned 29 Nov 20:00: its own slot)
--      Only a row that is still 'scheduled' and NOT yet handed to Facebook
--      (facebook_post_id IS NULL) is moved: a post Facebook already holds keeps
--      its Facebook time and counts toward the 6. A target hour that has passed
--      (or is under 15 minutes away, Facebook's hand-over floor) or is taken
--      moves the row to the next free whole hour up to 22:00; the day never
--      exceeds 6 posts. A row that finds no hour is left for the flush.
--
-- No-op where the rows are missing: the library rows come from #8528
-- (20271366752632_social_library_v2.sql), matched here by their stable
-- source_ref; a missing row is skipped. Nothing after 29 Nov moves: the catch-up
-- absorbs the missed 28 Nov posts, so every later day keeps exactly its own
-- planned posts and no slot doubles up.
--
-- Run after 29 Nov 22:00 Manila, step 2 finds no hour and moves nothing.
-- RLS: untouched (no new table). Ugat: no new table, column or RPC.
-- ============================================================================

BEGIN;

DO $catch_up$
DECLARE
  v_day_start CONSTANT timestamptz := '2026-11-29 00:00:00+08';
  v_day_end   CONSTANT timestamptz := '2026-11-30 00:00:00+08';
  v_cap       CONSTANT int := 6;
  v_last_hour CONSTANT int := 22;
  v_floor     timestamptz := now() + interval '15 minutes';
  r           record;
  v_count     int;
  v_hour      int;
  v_at        timestamptz;
BEGIN
  IF to_regclass('public.social_posts') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = 'social_posts' AND column_name = 'slot') THEN
    RETURN;
  END IF;

  -- 1 · pull the two test-shop badge posts (never retried).
  UPDATE public.social_posts
     SET status = 'pulled',
         platform_results = COALESCE(platform_results, '{}'::jsonb)
                            || jsonb_build_object('pulled', jsonb_build_object(
                                 'reason', 'Test shop badge post, pulled in the 29 Nov 2026 Facebook catch-up.',
                                 'at', now())),
         updated_at = now()
   WHERE source_type = 'supplier_badge'
     AND source_ref LIKE '485d28a2-c614-434f-993a-e3ae89b41853:%'
     AND status IN ('scheduled', 'failed');

  -- 2 · place the day's posts, in timetable order.
  FOR r IN
    SELECT p.post_id, p.slot, p.scheduled_for, o.target_hour
      FROM (VALUES
              (1, 'announcement', 'dfeb3c42-5d8d-4694-974e-4ddae83a68a4', 'First public post', 10),
              (2, 'library', 'lib-3ef2ffc3a7977c677cad609d', NULL, 12),
              (3, 'announcement', 'journal:bridal-car-and-motorcade-wedding', NULL, 14),
              (4, 'library', 'lib-11d11152b1d14c6ea5d25301', NULL, 16),
              (5, 'library', 'lib-60ee51dd8318fa11af6a2e24', NULL, 18),
              (6, 'library', 'lib-a89200ad9943ad2444ffe9d5', NULL, 20)
           ) AS o(ord, source_type, source_ref, title, target_hour)
      JOIN public.social_posts p
        ON p.source_type = o.source_type
       AND p.source_ref = o.source_ref
       AND (o.title IS NULL OR p.title = o.title)
     WHERE p.status = 'scheduled'
       AND p.facebook_post_id IS NULL
     ORDER BY o.ord
  LOOP
    SELECT count(*) INTO v_count
      FROM public.social_posts q
     WHERE q.status IN ('scheduled', 'scheduled_on_fb', 'publishing', 'published')
       AND q.scheduled_for >= v_day_start
       AND q.scheduled_for < v_day_end
       AND q.post_id <> r.post_id;
    IF v_count >= v_cap THEN
      EXIT; -- the day holds its 6
    END IF;

    v_at := NULL;
    FOR v_hour IN r.target_hour .. v_last_hour LOOP
      IF v_day_start + make_interval(hours => v_hour) >= v_floor
         AND NOT EXISTS (SELECT 1 FROM public.social_posts q
                          WHERE q.scheduled_for = v_day_start + make_interval(hours => v_hour)
                            AND q.status IN ('scheduled', 'scheduled_on_fb', 'publishing', 'published')
                            AND q.post_id <> r.post_id) THEN
        v_at := v_day_start + make_interval(hours => v_hour);
        EXIT;
      END IF;
    END LOOP;
    CONTINUE WHEN v_at IS NULL;          -- no hour left today: the flush handles it
    CONTINUE WHEN r.scheduled_for = v_at; -- already there

    UPDATE public.social_posts
       SET scheduled_for = v_at,
           slot = CASE WHEN r.slot IN ('morning', 'afternoon', 'evening') THEN r.slot ELSE 'afternoon' END,
           platform_results = COALESCE(platform_results, '{}'::jsonb)
                              || jsonb_build_object('catch_up', jsonb_build_object(
                                   'day', '2026-11-29', 'from', r.scheduled_for, 'to', v_at, 'at', now())),
           updated_at = now()
     WHERE post_id = r.post_id
       AND status = 'scheduled'
       AND facebook_post_id IS NULL;
  END LOOP;
END
$catch_up$;

COMMIT;
