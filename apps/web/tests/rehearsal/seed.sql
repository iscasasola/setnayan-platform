-- RELEASE REHEARSAL FIXTURE — one host, one event, 30 guests, 12 suppliers, 3 orders.
--
-- Run by tests/rehearsal/seed.mts as `postgres`, against the THROW-AWAY stack a
-- rehearsal run starts — never anywhere else (seed.mts refuses a non-local
-- database). RLS is bypassed; triggers, defaults and constraints all fire, so a
-- row this file could not insert is a row the app could not have either.
--
-- The host's auth account already exists: seed.mts created it through GoTrue,
-- and the real `on_auth_user_created` trigger made the `public.users` row.
--
-- Names and ids come from tests/rehearsal/fixture.ts as `rehearsal.*` settings
-- (psql variables do not reach inside a DO block; settings do).
--
-- The column lists follow the shapes the app itself writes
-- (app/onboarding/wedding/actions.ts) and the repo's own db fixtures
-- (tests/db/live-card-fixture.ts). Amounts are fixture numbers, not prices.

\o /dev/null
SELECT set_config('rehearsal.host_email',  :'host_email',  false),
       set_config('rehearsal.event_id',    :'event_id',    false),
       set_config('rehearsal.slug',        :'slug',        false),
       set_config('rehearsal.event_name',  :'event_name',  false),
       set_config('rehearsal.bride_name',  :'bride_name',  false),
       set_config('rehearsal.groom_name',  :'groom_name',  false),
       set_config('rehearsal.guest_id',    :'guest_id',    false),
       set_config('rehearsal.guest_first', :'guest_first', false),
       set_config('rehearsal.guest_last',  :'guest_last',  false),
       set_config('rehearsal.guest_token', :'guest_token', false),
       set_config('rehearsal.other_guests', :'other_guests', false),
       set_config('rehearsal.attending',   :'attending',   false);
\o

DO $seed$
DECLARE
  v_host  uuid;
  v_event uuid := current_setting('rehearsal.event_id')::uuid;
  v_slug  text := current_setting('rehearsal.slug');
  v_bride_name text := current_setting('rehearsal.bride_name');
  v_groom_name text := current_setting('rehearsal.groom_name');
  v_others int := current_setting('rehearsal.other_guests')::int;
  v_yes    int := current_setting('rehearsal.attending')::int;
  v_groom uuid;
  v_vp    uuid;
  v_vs    uuid;
  v_name  text;
  n       int;
  cats text[] := ARRAY['venue','catering','photographer','videographer','florist',
                       'cake_maker','host_emcee','band_dj','makeup_artist',
                       'lights_and_sound','photobooth','planner_coordinator'];
  firsts text[] := ARRAY['Jose','Gabriela','Emilio','Melchora','Apolinario','Gregoria','Marcelo',
                         'Teresa','Antonio','Josefa','Juan','Trinidad','Graciano','Marina'];
  lasts  text[] := ARRAY['Rizal','Silang','Aguinaldo','Aquino','Mabini','De Jesus','Del Pilar',
                         'Magbanua','Luna','Escoda','Ponce','Tecson','Lopez','Dizon'];
BEGIN
  SELECT id INTO STRICT v_host FROM auth.users WHERE lower(email) = lower(current_setting('rehearsal.host_email'));

  -- 1 · THE HOST. Terms accepted and tours seen, so the dashboard is not
  -- replaced by the terms re-ask or covered by a welcome tour. is_internal
  -- stays FALSE on purpose: an internal account passes every paid gate, and a
  -- rehearsal must see what a paying couple sees.
  UPDATE public.users
     SET first_name = split_part(v_groom_name, ' ', 1),
         last_name = substr(v_groom_name, length(split_part(v_groom_name, ' ', 1)) + 2),
         display_name = v_groom_name,
         terms_accepted_at = now(), terms_version = '2026-06-30',
         tour_seen_keys = ARRAY[
           'couple_welcome_v1','customer_adaptive_theme_v1','customer_add_scene_v1',
           'customer_apply_pro_v1','customer_budget_v1','customer_details_bound_v1',
           'customer_details_guided_v1','customer_event_menu_v1','customer_galleries_v1',
           'customer_guest_invite_v1','customer_guest_list_v1','customer_hero_designs_v1',
           'customer_love_story_v1','customer_ombre_background_v1','customer_papic_v1',
           'customer_people_v1','customer_post_event_v1','customer_print_menu_v1',
           'customer_print_story_poster_v1','customer_pro_qr_v1','customer_schedule_v1',
           'customer_seat_plan_v1','customer_vendors_v1','discover_upcoming_v1']
   WHERE user_id = v_host;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'public.users row missing — on_auth_user_created did not fire for the host';
  END IF;

  -- 2 · THE EVENT. A wedding 60 days out, public page on.
  INSERT INTO public.events (
    event_id, event_type, display_name, slug, is_primary, landing_page_visibility,
    event_date, event_date_precision, date_mode,
    venue_name, venue_address, venue_latitude, venue_longitude, venue_setting,
    ceremony_type, is_mixed_ceremony, ceremony_type_locked_at, ceremony_type_locked_by,
    bride_name, groom_name, estimated_pax)
  VALUES (
    v_event, 'wedding', current_setting('rehearsal.event_name'), v_slug, true, 'public',
    current_date + 60, 'day', 'specific',
    'Rehearsal Garden Hall', '123 Rehearsal Street, Manila',
    14.5995, 120.9842, 'banquet_hall',
    'catholic', false, now(), v_host,
    v_bride_name, v_groom_name, 30);

  -- Ownership — what current_event_ids() reads.
  INSERT INTO public.event_members (event_id, user_id, member_type, joined_via)
  VALUES (v_event, v_host, 'couple', 'created_event');

  -- 3 · THE GUESTS. The couple's own rows first (the onboarding shape).
  INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, role,
                             rsvp_status, photo_consent, custom_tags)
  VALUES (v_event, split_part(v_bride_name, ' ', 1),
          substr(v_bride_name, length(split_part(v_bride_name, ' ', 1)) + 2),
          'bride', 'other', 'bride', 'pending', true, '{}');

  INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, role,
                             rsvp_status, photo_consent, custom_tags)
  VALUES (v_event, split_part(v_groom_name, ' ', 1),
          substr(v_groom_name, length(split_part(v_groom_name, ' ', 1)) + 2),
          'groom', 'other', 'groom', 'pending', true, '{}')
  RETURNING guest_id INTO v_groom;

  -- "The creator is their couple row" (20271264924551).
  UPDATE public.event_members SET guest_id = v_groom, role = 'groom'
   WHERE event_id = v_event AND user_id = v_host AND guest_id IS NULL;

  -- The ONE guest the walk invites: never invited, never replied, a known key.
  INSERT INTO public.guests (guest_id, event_id, first_name, last_name, side, group_category, role,
                             rsvp_status, photo_consent, custom_tags, qr_token)
  VALUES (current_setting('rehearsal.guest_id')::uuid, v_event,
          current_setting('rehearsal.guest_first'), current_setting('rehearsal.guest_last'),
          'groom', 'friends', 'guest', 'pending', true, '{}', current_setting('rehearsal.guest_token'));

  -- The rest: the first v_yes said yes, then 4 no, 3 maybe, the others have not answered.
  INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, role,
                             rsvp_status, rsvp_responded_at, invitation_sent_at,
                             meal_preference, mobile, photo_consent, custom_tags, qr_token)
  SELECT v_event,
         firsts[1 + (g - 1) % 14],
         lasts[1 + ((g - 1) / 2) % 14] || CASE WHEN g > 14 THEN ' ' || chr(64 + g - 14) || '.' ELSE '' END,
         (CASE WHEN g % 2 = 0 THEN 'bride' ELSE 'groom' END)::public.guest_side,
         ((ARRAY['family','friends','work'])[1 + g % 3])::public.guest_group_category,
         'guest'::public.guest_role,
         (CASE WHEN g <= v_yes THEN 'attending' WHEN g <= v_yes + 4 THEN 'declined'
               WHEN g <= v_yes + 7 THEN 'maybe' ELSE 'pending' END)::public.rsvp_status,
         CASE WHEN g <= v_yes + 7 THEN now() - interval '1 day' END,
         CASE WHEN g <= v_yes + 9 THEN now() - interval '3 days' END,
         CASE WHEN g <= v_yes THEN 'no_preference'::public.meal_preference END,
         CASE WHEN g <= v_yes THEN '+639170000' || lpad(g::text, 3, '0') END,
         true, '{}'::text[],
         md5('rehearsal-guest-' || g)
    FROM generate_series(1, v_others) AS g;

  -- 4 · THE SUPPLIERS. Twelve published shops, one live service each; five are
  -- on this event (three booked, two saved). A loop so each trigger sees the
  -- previous statement's rows.
  FOR n IN 1..12 LOOP
    v_name := 'Rehearsal ' || initcap(replace(cats[n], '_', ' ')) || ' Co.';

    INSERT INTO public.vendor_profiles (
      user_id, business_name, business_slug, tagline, services, location_city, event_types,
      is_published, public_visibility, verification_state, last_verified_at, contact_email)
    VALUES (
      NULL, v_name, 'rehearsal-shop-' || lpad(n::text, 2, '0'), 'Rehearsal fixture shop',
      ARRAY[cats[n]], (ARRAY['Manila','Quezon City','Cebu City','Davao City'])[1 + n % 4],
      ARRAY['wedding'], true, 'verified', 'verified', now(),
      'shop' || n || '@rehearsal.test')
    RETURNING vendor_profile_id INTO v_vp;

    INSERT INTO public.vendor_services (vendor_profile_id, category, title, starting_price_php,
                                        primary_photo_r2_key, is_active)
    VALUES (v_vp, cats[n], v_name || ' package', 20000 + n * 5000,
            'r2://media/test-fixtures/service-cover.webp', true)
    RETURNING vendor_service_id INTO v_vs;

    INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label)
    VALUES (v_vs, v_vp, 'Everything in the package');

    IF n <= 5 THEN
      INSERT INTO public.event_vendors (event_id, category, vendor_name, status,
                                        total_cost_php, marketplace_vendor_id)
      VALUES (v_event, cats[n]::public.vendor_category, v_name,
              (CASE WHEN n <= 3 THEN 'contracted' ELSE 'shortlisted' END)::public.vendor_status,
              20000 + n * 5000, v_vp);
    END IF;
  END LOOP;

  -- 5 · THE ORDERS. One paid, one waiting for payment, one cancelled.
  INSERT INTO public.orders (event_id, user_id, service_key, description,
                             requested_total_php, confirmed_total_php, status, reference_code)
  VALUES
    (v_event, v_host, 'LIVE_WALL',   'Rehearsal: Live Wall',   1000, 1000, 'paid',             'REHEARSAL-0001'),
    (v_event, v_host, 'SETNAYAN_AI', 'Rehearsal: Setnayan AI', 2000, NULL, 'awaiting_payment', 'REHEARSAL-0002'),
    (v_event, v_host, 'SETNAYAN_AI', 'Rehearsal: cancelled',   2000, NULL, 'cancelled',        'REHEARSAL-0003');
END
$seed$;

-- What was made — counts only, printed into the run log.
SELECT 'guests' AS made, count(*) FROM public.guests WHERE event_id = current_setting('rehearsal.event_id')::uuid
UNION ALL SELECT 'guests coming', count(*) FROM public.guests WHERE event_id = current_setting('rehearsal.event_id')::uuid AND rsvp_status = 'attending'
UNION ALL SELECT 'suppliers', count(*) FROM public.vendor_profiles WHERE business_slug LIKE 'rehearsal-shop-%'
UNION ALL SELECT 'suppliers on the event', count(*) FROM public.event_vendors WHERE event_id = current_setting('rehearsal.event_id')::uuid
UNION ALL SELECT 'orders', count(*) FROM public.orders WHERE event_id = current_setting('rehearsal.event_id')::uuid
UNION ALL SELECT 'page sections', count(*) FROM public.invitation_widgets WHERE event_id = current_setting('rehearsal.event_id')::uuid;
