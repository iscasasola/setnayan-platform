-- ════════════════════════════════════════════════════════════════════════════
-- event_service_figures — every number Home's "Your services" rows need, in ONE
-- round trip.
--
-- ⚖ OWNER "APPROVE ALL", 2026-10-14 (DECISION_LOG ✅ "THE SERVICES PROTOTYPE —
-- HOME ROWS + TOP BANDS FOR ALL SIX"; prototype
-- `prototypes/services_home_rows_and_bands_2026-10-14_fable.html`): the Planner
-- row says how many suppliers it watches, Live stream how many cameras are set
-- up and whether it is live or recorded, Video booth how many reels — and a
-- service not added yet shows its PRICE, from the catalog.
--
-- 🔑 WHY ONE FUNCTION (least requests — owner 2026-10-08; production is on the
-- free database plan). Home is the most-opened screen. Asked table by table
-- these are five reads (event_vendors · live_studio_roam_zones ·
-- panood_broadcasts · live_studio_roam_streams · patiktok_render_jobs) plus the
-- catalog; here they are one request, and Home asks it once per render.
--
-- 🔒 WHO MAY ASK: the couple or a coordinator of the event (the same widening
-- Home's Papic counts got on 2026-07-30), an admin, or the service role. Anyone
-- else — an invited guest, a stranger — gets NULL, which the app draws as "—"
-- (unread), never as zero. SECURITY DEFINER for exactly that reason: under the
-- caller's own RLS a refused table counts 0 with no error, and Home would tell a
-- couple with seven suppliers "0 suppliers watched" (S41b: a refused read is not
-- a zero).
--
-- ⚠ READ-ONLY AND `STABLE`. Prices are read with `is_active = true`: a SKU an
-- admin takes off sale has no price, and the row says so rather than quote it.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.event_service_figures(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_main_live     BOOLEAN := false;
  v_main_since    TIMESTAMPTZ;
  v_main_done     BOOLEAN := false;
  v_main_done_min INTEGER;
  v_roam_live     BOOLEAN := false;
  v_roam_since    TIMESTAMPTZ;
  v_roam_done     BOOLEAN := false;
  v_roam_done_min INTEGER;
BEGIN
  IF p_event_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- The authority check, ahead of any read. coalesce(…, false): a signed-out
  -- caller's auth.uid() is NULL, and IF NULL would not take the refusal.
  IF NOT coalesce(
    EXISTS (
      SELECT 1
        FROM public.event_members m
       WHERE m.event_id = p_event_id
         AND m.user_id = auth.uid()
         AND m.member_type IN ('couple', 'coordinator')
    )
    OR public.is_admin()
    OR coalesce(auth.role(), '') = 'service_role',
    false
  ) THEN
    RETURN NULL;
  END IF;

  -- The main broadcast (Live Watch's one-camera / program output).
  SELECT true, b.went_live_at
    INTO v_main_live, v_main_since
    FROM public.panood_broadcasts b
   WHERE b.event_id = p_event_id
     AND b.status = 'live'
   ORDER BY b.went_live_at DESC NULLS LAST
   LIMIT 1;

  SELECT true,
         CASE WHEN b.went_live_at IS NOT NULL AND b.ended_at > b.went_live_at
              THEN floor(extract(epoch FROM (b.ended_at - b.went_live_at)) / 60)::INTEGER END
    INTO v_main_done, v_main_done_min
    FROM public.panood_broadcasts b
   WHERE b.event_id = p_event_id
     AND b.status = 'complete'
   ORDER BY b.ended_at DESC NULLS LAST
   LIMIT 1;

  -- The per-camera streams of the multi-camera studio.
  SELECT count(*) > 0, min(s.went_live_at)
    INTO v_roam_live, v_roam_since
    FROM public.live_studio_roam_streams s
   WHERE s.event_id = p_event_id
     AND s.status = 'live';

  SELECT count(*) > 0,
         max(CASE WHEN s.went_live_at IS NOT NULL AND s.ended_at > s.went_live_at
                  THEN floor(extract(epoch FROM (s.ended_at - s.went_live_at)) / 60) END)::INTEGER
    INTO v_roam_done, v_roam_done_min
    FROM public.live_studio_roam_streams s
   WHERE s.event_id = p_event_id
     AND s.status = 'complete';

  RETURN jsonb_build_object(
    -- Planner · the suppliers it watches: every supplier on the event's list
    -- that is not archived (the AI page's own `vendorsTracked`).
    'suppliers', (
      SELECT count(*)::INTEGER
        FROM public.event_vendors v
       WHERE v.event_id = p_event_id
         AND v.archived_at IS NULL
    ),
    -- Live stream · the cameras set up (the readiness check's `cameraCount`:
    -- every channel not switched off).
    'cameras', (
      SELECT count(*)::INTEGER
        FROM public.live_studio_roam_zones z
       WHERE z.event_id = p_event_id
         AND z.status <> 'disabled'
    ),
    'live', coalesce(v_main_live, false) OR coalesce(v_roam_live, false),
    'live_since', coalesce(v_main_since, v_roam_since),
    'recorded', coalesce(v_main_done, false) OR coalesce(v_roam_done, false),
    'recorded_minutes', coalesce(v_main_done_min, v_roam_done_min),
    -- Video booth · the reels it has finished.
    'reels', (
      SELECT count(*)::INTEGER
        FROM public.patiktok_render_jobs j
       WHERE j.event_id = p_event_id
         AND j.status = 'completed'
    ),
    -- The price of each paid service, from the ONE billing source. Off-sale
    -- rows are left out — no price, never a stale one.
    'prices', coalesce((
      SELECT jsonb_object_agg(c.service_code, c.retail_price_php)
        FROM public.platform_retail_catalog_v2 c
       WHERE c.is_active = true
         AND c.service_code IN (
           'SETNAYAN_AI', 'LIVE_STUDIO', 'LIVE_STUDIO_HOSTED_CHANNEL',
           'PAKANTA', 'PATIKTOK_COMPILER', 'COUPLE_WEBSITE_PRO'
         )
    ), '{}'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.event_service_figures(UUID) IS
  'Home''s "Your services" figures in one round trip: suppliers watched, cameras set up, '
  'live / recorded, reels made, and the catalog price of each paid service. SECURITY DEFINER '
  'so a refused table never reads as zero; authority is the event''s couple or coordinator, '
  'an admin, or service_role — anyone else gets NULL. Added 2026-10-14 (services rows).';

REVOKE ALL ON FUNCTION public.event_service_figures(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_service_figures(UUID) TO authenticated, service_role;
