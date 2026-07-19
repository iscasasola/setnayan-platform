-- Owner-comp the Maria & Jose SAMPLE event so the owner can shoot a real Papic
-- crew shoot whose photos reach the public tour gallery.
--
-- WHY this is needed (verified via the papic-shoot-wiring investigation):
-- a real capture only reaches the tour wall (wall_feed, read by getWallSnapshot)
-- when TWO independent gates pass:
--   1. recordSeatCapture()'s after() chain runs ingestToWall ONLY for non-sampler
--      ("paid") seats  → we must provision PAID seats (is_free_sampler = FALSE).
--   2. wall_ingest's G0 gate requires an event_software_activations_v2 row with
--      service_code = 'LIVE_WALL'  → we must activate LIVE_WALL for the event.
-- Provisioning paid seats itself is gated on an orders row (papic_event_owns_service),
-- so we also mint a comp PAPIC_SEATS order (status='paid', ₱0). This honors the
-- standing rule: events hosted by iscasasolaii@gmail.com get free/comped services.
--
-- Fully idempotent (NOT EXISTS guards; safe to re-run). Apply BLOCK 1 then read
-- the claim tokens with BLOCK 2:
--   cat scripts/comp-sample-papic-seats.sql | sed -n '/BLOCK 1/,/END \$\$;/p' | supabase db query --db-url "$SUPABASE_DB_URL"
--   (then run the BLOCK 2 SELECT to print the claim links)

-- ===== BLOCK 1: comp order + LIVE_WALL activation + 5 PAID seats =====
DO $$
DECLARE
  v_event uuid;
  v_owner uuid := '5599d399-b4f8-459d-9080-8069824dec96';     -- iscasasolaii@gmail.com
  v_vendor uuid := '646c9457-3450-412e-8d60-7281224da157';    -- founder vendor (stable; activation vendor_id is NOT NULL)
  i int;
BEGIN
  SELECT event_id INTO v_event FROM public.events WHERE slug='maria-and-jose' AND is_sample=TRUE LIMIT 1;
  IF v_event IS NULL THEN RAISE EXCEPTION 'Maria & Jose sample event not found'; END IF;

  -- (1) comp PAPIC_SEATS order — unlocks paid-seat provisioning ownership gate
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE event_id=v_event AND service_key='PAPIC_SEATS' AND status NOT IN ('cancelled','refunded','lapsed')) THEN
    INSERT INTO public.orders (event_id, user_id, service_key, description, requested_total_php, status, reference_code, admin_notes)
    VALUES (v_event, v_owner, 'PAPIC_SEATS', 'Owner comp — Maria & Jose sample Papic crew', 0, 'paid', 'COMP-MJ-PAPIC', 'is_sample owner comp (iscasasolaii free-services rule)');
  END IF;

  -- (2) LIVE_WALL activation — unlocks wall_ingest (capture → wall_feed → tour gallery)
  IF NOT EXISTS (SELECT 1 FROM public.event_software_activations_v2 WHERE event_id=v_event AND service_code='LIVE_WALL') THEN
    INSERT INTO public.event_software_activations_v2 (event_id, vendor_id, service_code)
    VALUES (v_event, v_vendor, 'LIVE_WALL');
  END IF;

  -- (3) provision 5 PAID (non-sampler) seats, indexes 1..5, fresh base64url claim tokens
  FOR i IN 1..5 LOOP
    IF NOT EXISTS (SELECT 1 FROM public.paparazzi_seats WHERE event_id=v_event AND seat_index=i AND is_free_sampler=FALSE) THEN
      INSERT INTO public.paparazzi_seats (event_id, seat_index, sku_code, is_free_sampler, claim_qr_token)
      VALUES (v_event, i, 'PAPIC_SEATS', FALSE,
              replace(replace(replace(encode(gen_random_bytes(24),'base64'),'+','-'),'/','_'),'=',''));
    END IF;
  END LOOP;

  RAISE NOTICE 'Comp + 5 paid seats ready for sample event %', v_event;
END $$;

-- ===== BLOCK 2: read the claim links to hand the owner =====
SELECT seat_index,
       'https://www.setnayan.com/papic/claim/' || claim_qr_token AS claim_link,
       claimed_at
FROM public.paparazzi_seats s
JOIN public.events e ON e.event_id = s.event_id
WHERE e.slug='maria-and-jose' AND s.is_free_sampler=FALSE
ORDER BY s.seat_index;
