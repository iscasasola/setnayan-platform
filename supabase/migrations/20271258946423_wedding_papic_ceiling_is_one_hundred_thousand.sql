-- ============================================================================
-- 20271258946423_wedding_papic_ceiling_is_one_hundred_thousand.sql
--
-- Two owner answers, 2026-10-02, both on public.papic_event_pool_config (the
-- table Admin › Pricing › Papic shot prices › "Credits recommended, by kind of
-- celebration" writes — `savePapicTypeSizing`):
--
--   1. a wedding's "At most" (`ceiling_points`) is 100,000. It read 30,000.
--   2. the recommendation FLOOR (`recommend_floor_points`) is 5,000 for a
--      wedding and 0 for every other event type
--      (DECISION_LOG 2026-10-02 "FIVE AUDIT QUESTIONS ANSWERED" #3).
--
-- THE ROWS THIS TOUCHES
--   • config_key = 'wedding' → ceiling_points = 100000; recommend_floor_points
--     = 5000 (already so — written only if it differs).
--   • every other event-type row → recommend_floor_points = 0 (already so on a
--     healthy database — written only where it differs).
--
-- WHAT IT NEVER TOUCHES
--   • the 'default' row (the GLOBAL fallback, not an event type) — its ceiling
--     stays 30,000 and its floors are untouched;
--   • `floor_points` — that is the ENTITLEMENT (5,000 for every type, see
--     20271239794268) and is NOT the recommendation floor;
--   • `points_per_guest`, and any other type's `ceiling_points`.
--
-- ⚠ `ceiling_points` is the clamp on both the recommendation and the pool a
-- celebration is metered against (`papic_event_pool_sizing`), so a wedding may
-- now hold up to 100,000. That is the intent.
--
-- Guarded: the ceiling is only raised while `< 100000` (a later admin edit
-- above is never lowered by a re-run); a snapshot proves nothing else moved.
-- ============================================================================

BEGIN;

CREATE TEMP TABLE _papic_sizing_before ON COMMIT DROP AS
  SELECT config_key, points_per_guest, floor_points, recommend_floor_points, ceiling_points
    FROM public.papic_event_pool_config;

-- 1 · the wedding's "at most"
UPDATE public.papic_event_pool_config
   SET ceiling_points = 100000,
       updated_at     = NOW()
 WHERE config_key = 'wedding'
   AND ceiling_points < 100000;

-- 2 · the recommendation floor: 5,000 for a wedding, 0 for every other TYPE
--     (the 'default' row is the global fallback and is left alone).
UPDATE public.papic_event_pool_config
   SET recommend_floor_points = CASE WHEN config_key = 'wedding' THEN 5000 ELSE 0 END,
       updated_at             = NOW()
 WHERE config_key <> 'default'
   AND recommend_floor_points IS DISTINCT FROM CASE WHEN config_key = 'wedding' THEN 5000 ELSE 0 END;

DO $guard$
DECLARE
  v_moved INTEGER;
  v_bad   INTEGER;
BEGIN
  IF (SELECT ceiling_points FROM public.papic_event_pool_config WHERE config_key = 'wedding') < 100000 THEN
    RAISE EXCEPTION 'refusing to apply: the wedding Papic ceiling is below 100000';
  END IF;

  -- The recommendation floor is exactly 5,000 / 0.
  SELECT count(*) INTO v_bad
    FROM public.papic_event_pool_config
   WHERE config_key <> 'default'
     AND recommend_floor_points IS DISTINCT FROM CASE WHEN config_key = 'wedding' THEN 5000 ELSE 0 END;
  IF v_bad <> 0 THEN
    RAISE EXCEPTION 'refusing to apply: % event-type rows have the wrong recommendation floor', v_bad;
  END IF;

  -- Nothing else moved: the entitlement floor, per-head figure and every
  -- ceiling except the wedding's — on EVERY row — and the whole 'default' row.
  SELECT count(*) INTO v_moved
    FROM _papic_sizing_before b
    LEFT JOIN public.papic_event_pool_config c ON c.config_key = b.config_key
   WHERE c.config_key IS NULL
      OR (c.points_per_guest, c.floor_points) IS DISTINCT FROM (b.points_per_guest, b.floor_points)
      OR (c.config_key <> 'wedding' AND c.ceiling_points IS DISTINCT FROM b.ceiling_points)
      OR (c.config_key = 'default'  AND c.recommend_floor_points IS DISTINCT FROM b.recommend_floor_points);
  IF v_moved <> 0 THEN
    RAISE EXCEPTION 'refusing to apply: % Papic sizing rows changed beyond the wedding ceiling and the recommendation floor', v_moved;
  END IF;
END;
$guard$;

COMMIT;
