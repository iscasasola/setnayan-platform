-- Phase 2 of the test scenario: the couple sends an INQUIRY to the shortlisted
-- vendor. THIS is the first thing the vendor actually sees — a chat_threads row
-- (inquiry_status='pending') lands in their /vendor-dashboard Bookings/Messages
-- inbox (chat_threads has vendor-read RLS via current_vendor_profile_ids()).
--
-- Prereq: run seed-test-accounts.sql first. Idempotent (reuses an existing
-- thread + skips the opening message if one already exists).
--
-- Run:
--   ~/.local/bin/supabase db query --db-url "$SUPABASE_DB_URL" \
--     --file apps/web/scripts/seed-inquiry.sql
DO $$
DECLARE
  v_couple uuid;
  v_event  uuid;
  v_vpid   uuid;
  v_thread uuid;
BEGIN
  SELECT id            INTO v_couple FROM auth.users         WHERE email = 'couple.test@setnayan.com';
  SELECT event_id      INTO v_event  FROM public.events      WHERE slug = 'test-maria-and-jose';
  SELECT vendor_profile_id INTO v_vpid FROM public.vendor_profiles WHERE business_slug = 'test-liwanag-photography';

  IF v_couple IS NULL OR v_event IS NULL OR v_vpid IS NULL THEN
    RAISE EXCEPTION 'Run seed-test-accounts.sql first (couple/event/vendor not found).';
  END IF;

  -- Reuse the thread if it already exists (chat_threads is UNIQUE(event,vendor)).
  SELECT thread_id INTO v_thread
    FROM public.chat_threads WHERE event_id = v_event AND vendor_profile_id = v_vpid;

  IF v_thread IS NULL THEN
    INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
    VALUES (v_event, v_vpid, v_couple, 'pending')
    RETURNING thread_id INTO v_thread;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.chat_messages WHERE thread_id = v_thread) THEN
    INSERT INTO public.chat_messages
      (thread_id, event_id, vendor_profile_id, sender_user_id, sender_role, body)
    VALUES (v_thread, v_event, v_vpid, v_couple, 'couple',
      'Hi! We''re getting married on 2026-12-12 and we love your work. Are you available, and could you share a quote? — Maria & Jose');
  END IF;

  RAISE NOTICE 'Inquiry ready (pending) — thread=%', v_thread;
END $$;
