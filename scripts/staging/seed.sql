-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- THE STAGING SEED — sample data for the final check's 8 areas, on a STAGING copy and nowhere else.
--
-- Run by scripts/staging/seed.ts (psql, as the database owner) AFTER it has created the ten test accounts through
-- the Supabase admin API, so the real `on_auth_user_created` trigger made each `public.users` row exactly as a real
-- sign-up does. Proven on every pull request against the replayed schema
-- (apps/web/tests/db/the-staging-seed-runs-clean.db.test.ts), with the same settings preamble.
--
-- Settings it reads (the runner sets them; psql variables do not reach inside a DO block, settings do):
--   staging.accounts       JSON {account key → email}, from scripts/staging/accounts.ts
--   staging.terms_version  the app's TERMS_VERSION, so no account is met by the Terms re-ask
--   staging.tours_seen     every guided-tour key, so no welcome tour covers a control
--   staging.cover          the picture every seeded card and photo uses (an absolute https URL or an r2:// ref)
--
-- ⛔ TWO BELTS INSIDE THE SQL ITSELF, on top of the runner's guards:
--   · it refuses a database that holds real people (more than 25 sign-ins off the staging domain) — a staging
--     branch starts with none, production has thousands;
--   · it refuses a database that was already seeded (reset the branch to seed again).
--
-- 💰 NO MONEY NUMBER IS TYPED HERE. Setnayan's own prices (the orders) are READ from platform_retail_catalog_v2 by
-- service code. A sample supplier's asking prices are multiples of ONE unit read from that same catalogue (its
-- median active price), so nothing here invents a peso figure and the samples scale with the live price sheet.
--
-- 🏷 TAGGING. The code's "not a real row" flag is the demo pair (`events.is_sample` = `vendor_profiles.is_demo`,
-- lib/demo-scope.ts); `users.is_internal` is the §10a owner grant that opens every paid gate. Both CHANGE what a page
-- draws, so the main fixture keeps both FALSE (checkers see what a paying couple and a real supplier see — the same
-- rule as tests/rehearsal/seed.sql), and a separate demo pair (one sample event + two demo shops) checks the demo
-- path. Every seeded row is marked instead by the staging names: `stg-` slugs, the reserved `.test` sign-ins, and
-- ids minted from md5('stg:' || label), so the whole set can be listed (the summary at the end) and dropped.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

-- A deterministic, v4-SHAPED id for a label (some app validators accept only version-4 ids, e.g.
-- lib/upload-prefix-tenancy.ts): md5 of 'stg:' || label with the version and variant nibbles set. Temporary — it
-- lives only for this session.
CREATE OR REPLACE FUNCTION pg_temp.stg_id(label text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $fn$
  SELECT (substr(h, 1, 8) || '-' || substr(h, 9, 4) || '-4' || substr(h, 14, 3) || '-8' || substr(h, 18, 3) || '-' || substr(h, 21, 12))::uuid
    FROM (SELECT md5('stg:' || label) AS h) x
$fn$;

DO $seed$
DECLARE
  v_acc    jsonb := current_setting('staging.accounts')::jsonb;
  v_terms  text  := current_setting('staging.terms_version');
  v_tours  text[] := current_setting('staging.tours_seen')::text[];
  v_cover  text  := current_setting('staging.cover');
  v_domain text;
  v_uid    jsonb := '{}'::jsonb;
  v_key    text;
  v_id     uuid;
  v_unit   numeric;
  v_bookings_open boolean;
  v_real_people int;
  n int;
  ci int;
  -- events
  e_plan uuid;  e_debut uuid; e_lolo uuid; e_maker uuid; e_mika uuid; e_messy1 uuid; e_messy2 uuid; e_messy2_old uuid; e_sample uuid;
  -- shops
  s_photo uuid; s_cater uuid; s_coord uuid; s_venue uuid; s_flor uuid; s_cake uuid; s_emcee uuid; s_dj uuid; s_mua uuid; s_lights uuid; s_booth uuid; s_video uuid; s_pending uuid;
  s_demo1 uuid; s_demo2 uuid;
  v_vs uuid;
  v_thread uuid;
  v_ev uuid;
  v_guest uuid;
  v_bride_guest uuid;
  v_owner_side text;
  v_table uuid;
  r record;
  firsts text[] := ARRAY['Jose','Gabriela','Emilio','Melchora','Apolinario','Gregoria','Marcelo','Teresa','Antonio','Josefa','Juan','Trinidad','Graciano','Marina','Lapu','Tandang','Diego','Leona','Andres','Corazon'];
  lasts  text[] := ARRAY['Rizal','Silang','Aguinaldo','Aquino','Mabini','De Jesus','Del Pilar','Magbanua','Luna','Escoda','Ponce','Tecson','Lopez','Dizon','Santos','Reyes','Cruz','Bautista','Garcia','Mendoza'];
  -- the messy names: accents, apostrophes, hyphens, particles, emoji, very long, all-caps, odd spacing
  messy_firsts text[] := ARRAY['María-José','Ñino','D''Angelo','Ma. Lourdes','JOSÉ RIZALINO','Zoë','Mary Grace Anne Patricia','Bong-Bong','Lourdes 🌸','Ángel','Kristine Joy','J.R.','Precious Mae','Ruby  Ann','Dra. Imelda'];
  messy_lasts  text[] := ARRAY['Dela Paz-Santiago y González de los Reyes','Ñañez','O''Brien-Macaraeg','de la Cruz','SANTOS-VILLANUEVA','Buenaventura Jr.','Lim-Tan-Uy','Sy','Abad Santos III','Macapagal-Arroyo Dimaculangan','Ty','Pe','Villanueva-Ocampo-Lopez-Fernandez-Ramos','Yap','Del Rosario'];
BEGIN
  -- ── 0 · THE BELTS ────────────────────────────────────────────────────────────────────────────────────────────
  v_domain := split_part(v_acc->>'front', '@', 2);
  IF v_domain = '' THEN RAISE EXCEPTION 'staging seed: staging.accounts carries no front account'; END IF;
  SELECT count(*) INTO v_real_people FROM auth.users
   WHERE email IS NOT NULL AND lower(split_part(email, '@', 2)) <> lower(v_domain)
     AND NOT EXISTS (SELECT 1 FROM jsonb_each_text(v_acc) a WHERE lower(a.value) = lower(email));
  IF v_real_people > 25 THEN
    RAISE EXCEPTION 'staging seed REFUSED: this database holds % sign-ins that are not staging accounts — it is not a fresh staging copy. Nothing was written.', v_real_people;
  END IF;
  IF EXISTS (SELECT 1 FROM public.events WHERE slug LIKE 'stg-%') THEN
    RAISE EXCEPTION 'staging seed REFUSED: this database is already seeded (stg- events exist). Reset the branch to seed again.';
  END IF;

  -- ── 1 · THE ACCOUNTS ─────────────────────────────────────────────────────────────────────────────────────────
  FOR v_key IN SELECT jsonb_object_keys(v_acc) LOOP
    SELECT id INTO v_id FROM auth.users WHERE lower(email) = lower(v_acc->>v_key);
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'staging seed: the % account (%) has no sign-in — seed.ts creates them first', v_key, v_acc->>v_key;
    END IF;
    v_uid := v_uid || jsonb_build_object(v_key, v_id);
  END LOOP;

  -- Names, terms, tours. is_internal stays FALSE for everyone: an internal account passes every paid gate, and a
  -- checker must see what a paying couple sees. The admin is account_type 'admin' — the third admin clause.
  UPDATE public.users u
     SET first_name   = split_part(x.full_name, ' ', 1),
         last_name    = nullif(substr(x.full_name, length(split_part(x.full_name, ' ', 1)) + 2), ''),
         display_name = x.full_name,
         terms_accepted_at = now(), terms_version = v_terms,
         tour_seen_keys = v_tours,
         account_type = CASE WHEN x.key = 'admin' THEN 'admin'::public.account_type ELSE u.account_type END
    FROM (VALUES
      ('front', 'Lia Fronda'), ('couple_plan', 'Bea Villanueva'), ('couple_maker', 'Carla Mendoza'),
      ('guest', 'Andres Lim'), ('supplier_shop', 'Rafael Liwanag'), ('supplier_bookings', 'Nena Bautista'),
      ('coordinator', 'Tala Reyes'), ('admin', 'Admin Staging'),
      ('messy_one', 'María-José Dela Paz-Santiago y González de los Reyes'),
      ('messy_two', 'Ma. Concepción ''Connie'' Ñañez-O''Brien')
    ) AS x(key, full_name)
   WHERE u.user_id = (v_uid->>x.key)::uuid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 10 THEN RAISE EXCEPTION 'staging seed: % of 10 public.users rows found — on_auth_user_created did not fire for every account', n; END IF;

  -- ── 2 · THE MONEY UNIT (read, never typed) ───────────────────────────────────────────────────────────────────
  SELECT percentile_disc(0.5) WITHIN GROUP (ORDER BY retail_price_php) INTO v_unit
    FROM public.platform_retail_catalog_v2
   WHERE is_active AND retired_at IS NULL AND retail_price_php > 0;
  IF v_unit IS NULL THEN RAISE EXCEPTION 'staging seed: platform_retail_catalog_v2 has no active price — copy the catalogue first'; END IF;

  -- Bookings are CLOSED until the admin opens them (`platform_settings.bookings_open`); production still holds the
  -- bookings made before, and so must the copy — opened for the seed's own rows only, then put back as it was.
  SELECT bookings_open INTO v_bookings_open FROM public.platform_settings WHERE id = 1;
  UPDATE public.platform_settings SET bookings_open = TRUE WHERE id = 1;

  -- ── 3 · THE SHOPS ────────────────────────────────────────────────────────────────────────────────────────────
  -- Thirteen real-shaped shops (three owned by checker accounts, one waiting for verification) + two demo shops.
  FOR r IN SELECT * FROM (VALUES
      ('photo',   'Liwanag Photo & Film',          'photographer',        'Quezon City',  14.6760, 121.0437, 'supplier_shop',     'pro',  'verified', false),
      ('cater',   'Kusina ni Aling Nena Catering',  'catering',            'Pasig',        14.5764, 121.0851, 'supplier_bookings', 'verified', 'verified', false),
      ('coord',   'Tala Events Coordination',       'planner_coordinator', 'Makati',       14.5547, 121.0244, 'coordinator',       'solo', 'verified', false),
      ('venue',   'Hardin ng Tagaytay Events Place','venue',               'Tagaytay',     14.1153, 120.9621, NULL,                'pro',  'verified', false),
      ('flor',    'Sampaguita Florals',             'florist',             'Manila',       14.5995, 120.9842, NULL,                'verified', 'verified', false),
      ('cake',    'Mamon & Co. Cakes',              'cake_maker',          'Cebu City',    10.3157, 123.8854, NULL,                'verified', 'verified', false),
      ('emcee',   'Host Kuya Jun',                  'host_emcee',          'Davao City',    7.1907, 125.4553, NULL,                'verified', 'verified', false),
      ('dj',      'Tugtugan Sounds',                'band_dj',             'Quezon City',  14.6507, 121.0494, NULL,                'verified', 'verified', false),
      ('mua',     'Ganda Glam Studio',              'makeup_artist',       'Makati',       14.5605, 121.0182, NULL,                'verified', 'verified', false),
      ('lights',  'Ilaw at Tunog Productions',      'lights_and_sound',    'Pasay',        14.5378, 121.0014, NULL,                'verified', 'verified', false),
      ('booth',   'Kodak Moments Photobooth',       'photobooth',          'Taguig',       14.5176, 121.0509, NULL,                'verified', 'verified', false),
      ('video',   'Pelikula Wedding Films',         'videographer',        'Iloilo City',  10.7202, 122.5621, NULL,                'verified', 'verified', false),
      ('pending', 'Bagong Simula Styling',          'reception_decor',     'Baguio',       16.4023, 120.5960, NULL,                'free', 'pending_review', false),
      ('demo1',   'Demo Lechon House',              'catering',            'Manila',       14.5995, 120.9842, NULL,                'verified', 'verified', true),
      ('demo2',   'Demo Garden Pavilion',           'venue',               'Tagaytay',     14.1153, 120.9621, NULL,                'verified', 'verified', true)
    ) AS t(key, name, cat, city, lat, lng, owner, tier, vstate, demo)
  LOOP
    v_id := pg_temp.stg_id('shop:' || r.key);
    INSERT INTO public.vendor_profiles (
      vendor_profile_id, user_id, business_name, tagline, services, location_city, event_types,
      is_published, public_visibility, verification_state, last_verified_at, contact_email,
      hq_latitude, hq_longitude, hq_address, tier_state, is_demo)
    VALUES (
      v_id, (v_uid->>r.owner)::uuid, r.name, 'Staging sample shop — ' || r.city, ARRAY[r.cat], r.city,
      ARRAY['wedding','debut','birthday','reunion','christening'],
      r.vstate = 'verified', (CASE WHEN r.vstate = 'verified' THEN 'verified' ELSE 'hidden' END)::public.vendor_public_visibility,
      r.vstate::public.vendor_verification_state,
      CASE WHEN r.vstate = 'verified' THEN now() END,
      'shop-' || r.key || '@' || v_domain,
      r.lat, r.lng, r.city || ', Philippines', r.tier::public.vendor_tier_state, r.demo);

    -- The founder's seat (the Shop Manager) for an owned shop.
    IF r.owner IS NOT NULL THEN
      INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role, duty)
      VALUES (v_id, (v_uid->>r.owner)::uuid, 'owner', 'shop_manager')
      ON CONFLICT DO NOTHING;
    END IF;

    -- Its cards: every pricing basis the card maker offers, a cover and what is included (a live card needs both).
    FOR ci IN 1..CASE WHEN r.owner IS NOT NULL THEN 4 ELSE 2 END LOOP
      INSERT INTO public.vendor_services (
        vendor_service_id, vendor_profile_id, category, title, starting_price_php, pricing_basis,
        per_pax_price_php, min_pax, hour_base_php, min_hours, unit_base_php, initial_units, unit_word,
        primary_photo_r2_key, is_active, is_demo, description)
      VALUES (
        pg_temp.stg_id('card:' || r.key || ':' || ci), v_id, r.cat,
        r.name || ' — ' || (ARRAY['Classic package','Per-guest package','By the hour','By the piece'])[ci],
        round(v_unit * (8 + ci * 4)),
        (ARRAY['fixed','per_pax','per_hour','per_unit'])[ci],
        CASE WHEN ci = 2 THEN round(v_unit / 2) END, CASE WHEN ci = 2 THEN 50 END,
        CASE WHEN ci = 3 THEN round(v_unit * 2) END, CASE WHEN ci = 3 THEN 4 END,
        CASE WHEN ci = 4 THEN round(v_unit / 4) END, CASE WHEN ci = 4 THEN 100 END, CASE WHEN ci = 4 THEN 'piece' END,
        v_cover, true, r.demo,
        'Staging sample card ' || ci || ' of the ' || r.name || ' shop.');
      INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label)
      VALUES (pg_temp.stg_id('card:' || r.key || ':' || ci), v_id, 'Everything in the package'),
             (pg_temp.stg_id('card:' || r.key || ':' || ci), v_id, 'Set-up and clean-up');
    END LOOP;
  END LOOP;

  s_photo := pg_temp.stg_id('shop:photo');   s_cater := pg_temp.stg_id('shop:cater');  s_coord := pg_temp.stg_id('shop:coord');
  s_venue := pg_temp.stg_id('shop:venue');   s_flor  := pg_temp.stg_id('shop:flor');   s_cake  := pg_temp.stg_id('shop:cake');
  s_emcee := pg_temp.stg_id('shop:emcee');   s_dj    := pg_temp.stg_id('shop:dj');     s_mua   := pg_temp.stg_id('shop:mua');
  s_lights:= pg_temp.stg_id('shop:lights');  s_booth := pg_temp.stg_id('shop:booth');  s_video := pg_temp.stg_id('shop:video');
  s_pending := pg_temp.stg_id('shop:pending'); s_demo1 := pg_temp.stg_id('shop:demo1'); s_demo2 := pg_temp.stg_id('shop:demo2');

  -- The venue's size, so the 3D plan and Spaces have a hall to draw.
  UPDATE public.vendor_profiles SET venue_width_m = 30, venue_length_m = 45 WHERE vendor_profile_id = s_venue;
  -- The coordinator also holds a seat on the venue shop (Spaces, the map pin) — one sign-in, both consoles.
  INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role, duty)
  VALUES (s_venue, (v_uid->>'coordinator')::uuid, 'admin', 'account_manager')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'staging seed: shops done';

  -- ── 4 · THE EVENTS ───────────────────────────────────────────────────────────────────────────────────────────
  -- Several event types, past and future, public and private, one undated old-style event, and the demo sample.
  FOR r IN SELECT * FROM (VALUES
      ('plan',      'stg-bea-paolo',         'wedding',  'Bea & Paolo',                   'couple_plan',  90,   'Bea Villanueva',   'Paolo Garcia',  'catholic', 'garden',       150, 'public',  'venue'),
      ('debut',     'stg-sofia-debut',       'debut',    'Sofia''s 18th',                 'couple_plan',  45,   NULL,               NULL,            NULL,       NULL,            80, 'public',  NULL),
      ('lolo',      'stg-lolo-ben-80',       'birthday', 'Lolo Ben at 80',                'couple_plan',  20,   NULL,               NULL,            NULL,       NULL,            60, 'private', NULL),
      ('maker',     'stg-carla-miguel',      'wedding',  'Carla & Miguel',                'couple_maker', 120,  'Carla Mendoza',    'Miguel Torres', 'christian','banquet_hall', 180, 'public',  'venue'),
      ('mika',      'stg-mika-turns-7',      'birthday', 'Mika turns 7',                  'couple_maker', -30,  NULL,               NULL,            NULL,       NULL,            40, 'public',  NULL),
      ('messy1',    'stg-maria-jose-dela-paz','wedding', 'María-José & Juan Carlos — ang aming kasal sa Simbahan ng Barasoain at ang handaan pagkatapos', 'messy_one', 200, 'María-José Dela Paz-Santiago y González de los Reyes', 'Juan Carlos Ñañez-O''Brien III', 'catholic', 'heritage', 350, 'public', 'venue'),
      ('messy2',    'stg-nanez-reunion',     'reunion',  'ÑAÑEZ-O''BRIEN CLAN REUNION 2026 (all branches!!)', 'messy_two', 60, NULL,           NULL,            NULL,       NULL,           320, 'public',  NULL),
      ('messy2old', 'stg-nanez-old-party',   'birthday', 'old party',                     'messy_two',    NULL, NULL,               NULL,            NULL,       NULL,          NULL, 'private', NULL),
      ('sample',    'stg-sample-demo',       'wedding',  'Demo: Ana & Ben',               'couple_maker', 150,  'Ana Demo',         'Ben Demo',      'catholic', 'garden',        100, 'public',  'demo2')
    ) AS t(key, slug, etype, name, owner, days, bride, groom, ceremony, setting, pax, vis, venue)
  LOOP
    v_ev := pg_temp.stg_id('event:' || r.key);
    INSERT INTO public.events (
      event_id, event_type, display_name, slug, is_primary, landing_page_visibility,
      event_date, event_date_precision, date_mode,
      venue_name, venue_address, venue_latitude, venue_longitude, venue_setting,
      ceremony_type, ceremony_type_locked_at, ceremony_type_locked_by,
      bride_name, groom_name, estimated_pax, estimated_budget_centavos, is_sample)
    SELECT
      v_ev, r.etype, r.name, r.slug, r.key IN ('plan', 'maker', 'messy1', 'messy2'), r.vis,
      CASE WHEN r.days IS NOT NULL THEN current_date + r.days END,
      CASE WHEN r.days IS NOT NULL THEN 'day' ELSE 'year' END,
      CASE WHEN r.days IS NOT NULL THEN 'specific' END,
      vp.business_name, vp.hq_address, vp.hq_latitude, vp.hq_longitude,
      r.setting,
      r.ceremony, CASE WHEN r.ceremony IS NOT NULL THEN now() END, CASE WHEN r.ceremony IS NOT NULL THEN (v_uid->>r.owner)::uuid END,
      r.bride, r.groom, r.pax,
      -- the couple's own target: a multiple of the catalogue unit, in centavos
      CASE WHEN r.pax IS NOT NULL THEN round(v_unit * r.pax * 100)::bigint END,
      r.key = 'sample'
    FROM (SELECT 1) one
    LEFT JOIN public.vendor_profiles vp ON vp.vendor_profile_id = pg_temp.stg_id('shop:' || r.venue);

    INSERT INTO public.event_members (event_id, user_id, member_type, joined_via)
    VALUES (v_ev, (v_uid->>r.owner)::uuid, 'couple', 'created_event');

    -- The host's own guest row(s) — the onboarding shape: a wedding has the couple, any other event its host.
    IF r.etype = 'wedding' THEN
      INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, role, rsvp_status, photo_consent, custom_tags)
      VALUES (v_ev, split_part(r.bride, ' ', 1), coalesce(nullif(substr(r.bride, length(split_part(r.bride, ' ', 1)) + 2), ''), '—'),
              'bride', 'other', 'bride', 'attending', true, '{}')
      RETURNING guest_id INTO v_bride_guest;
      INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, role, rsvp_status, photo_consent, custom_tags)
      VALUES (v_ev, split_part(r.groom, ' ', 1), coalesce(nullif(substr(r.groom, length(split_part(r.groom, ' ', 1)) + 2), ''), '—'),
              'groom', 'other', 'groom', 'attending', true, '{}')
      RETURNING guest_id INTO v_guest;
    ELSE
      INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, role, rsvp_status, photo_consent, custom_tags)
      SELECT v_ev, u.first_name, coalesce(u.last_name, '—'), 'both', 'family', 'host', 'attending', true, '{}'
        FROM public.users u WHERE u.user_id = (v_uid->>r.owner)::uuid
      RETURNING guest_id INTO v_guest;
    END IF;
    -- "The creator is their couple row" (20271264924551) — the row that carries THEIR OWN name (final check A2-P6: the
    -- creator was always linked to the groom row, so Bea's account drew "Bea Villanueva" on Paolo's row too).
    v_owner_side := 'host';
    IF r.etype = 'wedding' THEN
      SELECT CASE WHEN trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')) = r.bride THEN 'bride' ELSE 'groom' END
        INTO v_owner_side
        FROM public.users u WHERE u.user_id = (v_uid->>r.owner)::uuid;
    END IF;
    UPDATE public.event_members
       SET guest_id = CASE WHEN v_owner_side = 'bride' THEN v_bride_guest ELSE v_guest END,
           role = v_owner_side
     WHERE event_id = v_ev AND user_id = (v_uid->>r.owner)::uuid AND guest_id IS NULL;
  END LOOP;

  e_plan   := pg_temp.stg_id('event:plan');   e_debut := pg_temp.stg_id('event:debut');  e_lolo := pg_temp.stg_id('event:lolo');
  e_maker  := pg_temp.stg_id('event:maker');  e_mika  := pg_temp.stg_id('event:mika');   e_messy1 := pg_temp.stg_id('event:messy1');
  e_messy2 := pg_temp.stg_id('event:messy2'); e_messy2_old := pg_temp.stg_id('event:messy2old'); e_sample := pg_temp.stg_id('event:sample');

  RAISE NOTICE 'staging seed: events done';

  -- ── 5 · THE GUESTS ───────────────────────────────────────────────────────────────────────────────────────────
  -- Every reply state (yes · no · maybe · not yet), each set by the guest or by the host, invited or not, with
  -- plus-ones, meals, entourage roles and Event Hub QR passes. The two messy events get the messy names, the old
  -- shapes (an invitation sent 400 days ago and never answered, a host-marked yes with no reply time, a refused
  -- photo consent, phone numbers typed every which way) and two guests with the very same name.
  FOR r IN SELECT * FROM (VALUES
      ('plan', 80, false), ('debut', 50, false), ('lolo', 40, false), ('maker', 90, false), ('mika', 25, false),
      ('messy1', 350, true), ('messy2', 320, true), ('messy2old', 5, true), ('sample', 20, false)
    ) AS t(key, how_many, messy)
  LOOP
    v_ev := pg_temp.stg_id('event:' || r.key);
    SELECT event_type INTO v_key FROM public.events WHERE event_id = v_ev;
    INSERT INTO public.guests (
      guest_id, event_id, first_name, last_name, side, group_category, role,
      rsvp_status, rsvp_set_by, rsvp_responded_at, invitation_sent_at,
      meal_preference, mobile, email, photo_consent, custom_tags, qr_token, notes)
    SELECT
      pg_temp.stg_id('guest:' || r.key || ':' || g), v_ev,
      CASE WHEN r.messy THEN messy_firsts[1 + (g - 1) % 15] ELSE firsts[1 + (g - 1) % 20] END,
      CASE WHEN r.messy AND g IN (7, 8) THEN messy_lasts[1]               -- the same full name, twice
           WHEN r.messy THEN messy_lasts[1 + ((g - 1) / 15) % 15] || CASE WHEN g > 225 THEN ' ' || chr(65 + g % 26) || '.' ELSE '' END
           ELSE lasts[1 + ((g - 1) / 20) % 20] || CASE WHEN g > 20 THEN ' ' || chr(64 + (g / 20)) || '.' ELSE '' END END,
      (CASE WHEN v_key <> 'wedding' THEN 'both' WHEN g % 2 = 0 THEN 'bride' ELSE 'groom' END)::public.guest_side,
      ((ARRAY['family','friends','work','school','other'])[1 + g % 5])::public.guest_group_category,
      (CASE WHEN v_key = 'wedding' AND g <= 4 THEN 'principal_sponsor'
            WHEN v_key = 'wedding' AND g <= 7 THEN 'bridesmaid'
            WHEN v_key = 'wedding' AND g <= 10 THEN 'groomsman'
            ELSE 'guest' END)::public.guest_role,
      (CASE WHEN g % 10 < 6 THEN 'attending' WHEN g % 10 = 6 THEN 'declined' WHEN g % 10 = 7 THEN 'maybe' ELSE 'pending' END)::public.rsvp_status,
      CASE WHEN g % 10 < 8 THEN (CASE WHEN g % 2 = 0 THEN 'guest' ELSE 'host' END) END,
      CASE WHEN g % 10 < 8 AND NOT (r.messy AND g % 2 = 1) THEN now() - make_interval(days => 1 + g % 20) END,
      CASE WHEN g % 10 = 9 AND g % 3 = 0 THEN NULL                        -- never invited
           WHEN r.messy AND g % 10 = 8 THEN now() - interval '400 days'    -- invited long ago, never answered
           ELSE now() - make_interval(days => 3 + g % 30) END,
      CASE WHEN g % 10 < 6 THEN ((ARRAY['beef','chicken','fish','vegetarian','no_preference'])[1 + g % 5])::public.meal_preference END,
      CASE WHEN g % 4 = 0 THEN NULL
           WHEN r.messy THEN (ARRAY['0917 123 ' || lpad(g::text, 4, '0'), '+63-918-' || lpad(g::text, 7, '0'), '(02) 8' || lpad(g::text, 7, '0')])[1 + g % 3]
           ELSE '+63917' || lpad(g::text, 7, '0') END,
      CASE WHEN g % 5 = 0 THEN 'guest-' || r.key || '-' || g || '@' || v_domain END,
      NOT (r.messy AND g % 13 = 0),
      CASE WHEN r.messy AND g % 9 = 0 THEN ARRAY['VIP', 'ninong side', 'needs wheelchair', 'from abroad', 'bring pasalubong'] ELSE '{}'::text[] END,
      md5('stg:qr:' || r.key || ':' || g),
      CASE WHEN r.messy AND g % 17 = 0 THEN repeat('Lola says please seat near the exit and away from the speakers. ', 8) END
    FROM generate_series(1, r.how_many) AS g;

    -- Plus-ones: their own rows, tied to who brings them (the counts follow the rows).
    INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, role, rsvp_status, photo_consent, custom_tags, plus_one_of_guest_id)
    SELECT v_ev, 'Kasama ni', h.first_name || ' ' || h.last_name, h.side, h.group_category, 'guest', 'attending', true, '{}', h.guest_id
      FROM public.guests h
     WHERE h.event_id = v_ev AND h.rsvp_status = 'attending' AND h.role = 'guest' AND h.qr_token IS NOT NULL
       AND (abs(hashtext(h.guest_id::text)) % 11) = 0;
  END LOOP;

  -- The plan wedding's groups.
  INSERT INTO public.guest_groups (event_id, label)
  SELECT e_plan, x FROM unnest(ARRAY['Bride''s family', 'Groom''s family', 'Barkada', 'Office', 'Ninongs & Ninangs']) AS x;

  RAISE NOTICE 'staging seed: guests done';

  -- ── 6 · THE SEAT PLANS ───────────────────────────────────────────────────────────────────────────────────────
  -- The plan wedding: 10 round tables, the attending guests seated in order, a few left for the couple to place.
  -- The messy wedding: 40 tables of every shape, half its guests seated.
  FOR r IN SELECT * FROM (VALUES ('plan', 10, 8, 0.9), ('maker', 12, 8, 0.7), ('messy1', 40, 10, 0.7)) AS t(key, tables, per, share) LOOP
    v_ev := pg_temp.stg_id('event:' || r.key);
    INSERT INTO public.event_tables (table_id, event_id, table_label, capacity, table_type, x_pos, y_pos, sort_order, is_vip)
    SELECT pg_temp.stg_id('table:' || r.key || ':' || t), v_ev,
           CASE WHEN t = 1 THEN 'Presidential table' WHEN r.key = 'messy1' AND t % 7 = 0 THEN 'Table ' || t || ' — Lola''s side (malapit sa CR)' ELSE 'Table ' || t END,
           CASE WHEN t = 1 THEN 12 ELSE r.per END,
           (CASE WHEN t = 1 THEN 'family_head_12' WHEN r.key = 'messy1' THEN (ARRAY['round_8','round_10','round_12','long_banquet_8','long_banquet_10'])[1 + t % 5] ELSE 'round_8' END)::public.table_type,
           100 + (t % 5) * 180, 120 + (t / 5) * 180, t, t = 1
      FROM generate_series(1, r.tables) AS t;

    WITH seated AS (
      SELECT g.guest_id, row_number() OVER (ORDER BY g.role DESC, g.last_name, g.first_name, g.guest_id) AS rn,
             count(*) OVER () AS total
        FROM public.guests g WHERE g.event_id = v_ev AND g.rsvp_status = 'attending'
    ), placed AS (
      SELECT s.guest_id, s.rn, tb.table_id, tb.capacity, tb.sort_order
        FROM seated s
        JOIN LATERAL (
          SELECT et.table_id, et.capacity, et.sort_order FROM public.event_tables et
           WHERE et.event_id = v_ev
           ORDER BY et.sort_order
           OFFSET ((s.rn - 1) / r.per)::int LIMIT 1
        ) tb ON true
       WHERE s.rn <= floor(s.total * r.share)
    )
    INSERT INTO public.event_seat_assignments (event_id, table_id, guest_id, seat_number, placed_by, placed_at)
    SELECT v_ev, p.table_id, p.guest_id, 1 + ((p.rn - 1) % r.per)::int, 'couple', now()
      FROM placed p
     WHERE 1 + ((p.rn - 1) % r.per) <= p.capacity;
  END LOOP;

  RAISE NOTICE 'staging seed: seat plans done';

  -- ── 7 · THE BOOKINGS ─────────────────────────────────────────────────────────────────────────────────────────
  -- Every funnel state on the plan wedding (considering → shortlisted → contracted → deposit_paid → delivered →
  -- complete), the bookings supplier on six events in six states, the coordinator booked on two weddings, the
  -- venue booked where the events sit, an old hand-typed supplier with no shop (the pre-marketplace shape), and
  -- the demo shops on the demo event only (a real event never meets a demo shop — lib/demo-scope.ts).
  FOR r IN SELECT * FROM (VALUES
      ('plan',   'cater',  'contracted'),  ('plan',   'photo',  'deposit_paid'), ('plan',  'coord', 'contracted'),
      ('plan',   'venue',  'deposit_paid'),('plan',   'flor',   'shortlisted'),  ('plan',  'cake',  'considering'),
      ('plan',   'emcee',  'delivered'),   ('plan',   'dj',     'complete'),     ('plan',  'mua',   'shortlisted'),
      ('debut',  'cater',  'deposit_paid'),('debut',  'lights', 'contracted'),   ('debut', 'booth', 'shortlisted'),
      ('lolo',   'cater',  'shortlisted'), ('lolo',   'video',  'considering'),
      ('maker',  'cater',  'considering'), ('maker',  'photo',  'contracted'),   ('maker', 'venue', 'contracted'),
      ('mika',   'cater',  'complete'),    ('mika',   'booth',  'complete'),
      ('messy1', 'cater',  'delivered'),   ('messy1', 'coord',  'deposit_paid'), ('messy1','venue', 'contracted'),
      ('messy1', 'photo',  'shortlisted'), ('messy1', 'video',  'considering'),
      ('messy2', 'cater',  'contracted'),  ('messy2', 'lights', 'shortlisted'),
      ('sample', 'demo1',  'shortlisted'), ('sample', 'demo2',  'contracted')
    ) AS t(ev, shop, status)
  LOOP
    v_ev := pg_temp.stg_id('event:' || r.ev);
    v_id := pg_temp.stg_id('shop:' || r.shop);
    v_vs := pg_temp.stg_id('card:' || r.shop || ':1');
    INSERT INTO public.event_vendors (vendor_id, event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id, service_id)
    SELECT pg_temp.stg_id('booking:' || r.ev || ':' || r.shop), v_ev, (vp.services[1])::public.vendor_category, vp.business_name,
           r.status::public.vendor_status,
           CASE WHEN r.status IN ('contracted','deposit_paid','delivered','complete') THEN vs.starting_price_php END,
           vp.vendor_profile_id, vs.vendor_service_id
      FROM public.vendor_profiles vp JOIN public.vendor_services vs ON vs.vendor_service_id = v_vs
     WHERE vp.vendor_profile_id = v_id;
  END LOOP;

  -- The old hand-typed supplier on the messy wedding: a name and a phone, no shop behind it.
  INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, contact_phone, notes)
  VALUES (e_messy1, 'band_dj', 'Kuya Boy''s Band (tinext ko lang)', 'contracted', round(v_unit * 6), '0917-555-0101',
          'Old record from before the marketplace: no shop, no card, agreed by text.');

  RAISE NOTICE 'staging seed: bookings done';

  -- ── 8 · THE PAYMENTS (what the couple recorded paying) ──────────────────────────────────────────────────────
  -- A reservation fee on every deposit_paid booking, the full amount on delivered and complete ones — each a share
  -- of that booking's own agreed amount, never a typed figure.
  INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, paid_at, method, reference, notes, is_deposit_record)
  SELECT v.event_id, v.vendor_id,
         CASE WHEN v.status = 'deposit_paid' THEN round(v.total_cost_php * 0.3) ELSE v.total_cost_php END,
         current_date - 14, 'bank_transfer', 'STG-' || upper(substr(v.vendor_id::text, 1, 8)),
         'Staging sample payment', v.status = 'deposit_paid'
    FROM public.event_vendors v JOIN public.events e USING (event_id)
   WHERE e.slug LIKE 'stg-%' AND v.status IN ('deposit_paid', 'delivered', 'complete') AND v.total_cost_php IS NOT NULL;

  RAISE NOTICE 'staging seed: payments done';

  -- ── 9 · THE CHATS ────────────────────────────────────────────────────────────────────────────────────────────
  -- One conversation per marketplace booking: answered for a booked supplier, waiting for a new ask, declined for
  -- one, and a 60-message thread on the messy reunion (the long-scroll shape).
  FOR r IN
    SELECT v.vendor_id, v.event_id, v.status, v.marketplace_vendor_id AS shop, vp.user_id AS shop_owner, vp.business_name,
           e.slug, m.user_id AS host, e.estimated_pax
      FROM public.event_vendors v
      JOIN public.events e USING (event_id)
      JOIN public.vendor_profiles vp ON vp.vendor_profile_id = v.marketplace_vendor_id
      JOIN public.event_members m ON m.event_id = v.event_id AND m.member_type = 'couple'
     WHERE e.slug LIKE 'stg-%'
     ORDER BY e.slug, vp.business_name
  LOOP
    v_thread := pg_temp.stg_id('thread:' || r.vendor_id);
    INSERT INTO public.chat_threads (thread_id, event_id, vendor_profile_id, created_by_user_id, kind, inquiry_status,
                                     accepted_at, declined_at, decline_reason, inquiry_source, pax_at_inquiry, pax_current)
    VALUES (v_thread, r.event_id, r.shop, r.host, 'supplier',
            (CASE WHEN r.status IN ('contracted','deposit_paid','delivered','complete') THEN 'accepted'
                  WHEN r.slug = 'stg-bea-paolo' AND r.business_name LIKE 'Ganda%' THEN 'declined'
                  ELSE 'pending' END)::public.chat_inquiry_status,
            CASE WHEN r.status IN ('contracted','deposit_paid','delivered','complete') THEN now() - interval '20 days' END,
            CASE WHEN r.slug = 'stg-bea-paolo' AND r.business_name LIKE 'Ganda%' THEN now() - interval '5 days' END,
            CASE WHEN r.slug = 'stg-bea-paolo' AND r.business_name LIKE 'Ganda%' THEN 'Fully booked that weekend — sorry!' END,
            'shop_page', r.estimated_pax, r.estimated_pax);

    INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, sender_user_id, sender_role, body, created_at)
    VALUES (v_thread, r.event_id, r.shop, r.host, 'couple',
            'Hi! Are you free on our date? We are about ' || coalesce(r.estimated_pax::text, 'a few') || ' guests.', now() - interval '21 days');
    IF r.status IN ('contracted','deposit_paid','delivered','complete') THEN
      INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, sender_user_id, sender_role, body, created_at)
      VALUES (v_thread, r.event_id, r.shop, r.shop_owner, 'vendor', 'Yes, we are free! Sending our package now.', now() - interval '20 days'),
             (v_thread, r.event_id, r.shop, r.host, 'couple', 'Salamat po! Booking it.', now() - interval '19 days');
    END IF;
    IF r.slug = 'stg-nanez-reunion' THEN
      INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, sender_user_id, sender_role, body, created_at)
      SELECT v_thread, r.event_id, r.shop,
             CASE WHEN i % 2 = 0 THEN r.host ELSE r.shop_owner END,
             (CASE WHEN i % 2 = 0 THEN 'couple' ELSE 'vendor' END)::public.chat_sender_role,
             CASE WHEN i % 10 = 0 THEN repeat('Pakiulit lang po ng menu para sa mga lolo at lola, walang maalat. ', 6)
                  ELSE 'Message ' || i || ' about the reunion: tables, menu, the program, the raffle 🎉' END,
             now() - make_interval(days => 18, mins => -i * 7)
        FROM generate_series(1, 60) AS i;
    END IF;
  END LOOP;

  RAISE NOTICE 'staging seed: chats done';

  -- ── 10 · THE ORDERS (Setnayan's own prices, READ from the catalogue by service code) ─────────────────────────
  -- Every order state the payments desk and the receipts show: waiting for payment, submitted, paid, fulfilled,
  -- cancelled, lapsed, refunded. A code the catalogue does not carry is skipped, never priced by hand.
  INSERT INTO public.orders (event_id, user_id, service_key, description, requested_total_php, confirmed_total_php, status, reference_code)
  SELECT pg_temp.stg_id('event:' || x.ev), (v_uid->>x.owner)::uuid, c.service_code, 'Staging: ' || c.title,
         c.retail_price_php,
         CASE WHEN x.status IN ('paid', 'fulfilled', 'refunded') THEN c.retail_price_php END,
         x.status::public.order_status, 'STG-' || lpad(x.n::text, 4, '0')
    FROM (VALUES
      (1, 'plan',   'couple_plan',  'EVENT_PLUS',         'awaiting_payment'),
      (2, 'plan',   'couple_plan',  'SETNAYAN_AI',        'submitted'),
      (3, 'maker',  'couple_maker', 'EVENT_PLUS',         'paid'),
      (4, 'maker',  'couple_maker', 'PAPIC_GUEST_150',    'paid'),
      (5, 'mika',   'couple_maker', 'COUPLE_WEBSITE_PRO', 'fulfilled'),
      (6, 'messy2', 'messy_two',    'LIVE_STUDIO',        'lapsed'),
      (7, 'messy2', 'messy_two',    'PAPIC_GUEST_1K',     'refunded'),
      (8, 'messy1', 'messy_one',    'EVENT_ULTRA',        'cancelled')
    ) AS x(n, ev, owner, code, status)
    JOIN public.platform_retail_catalog_v2 c ON c.service_code = x.code AND c.retail_price_php > 0;

  RAISE NOTICE 'staging seed: orders done';

  -- ── 11 · THE GUEST'S OWN SIGN-IN ─────────────────────────────────────────────────────────────────────────────
  -- A guest never needs one for the Event Hub, but the claim and join flows do: this account is a guest row on the
  -- plan wedding, linked the way an accepted invitation links it.
  INSERT INTO public.guests (guest_id, event_id, first_name, last_name, side, group_category, role, rsvp_status,
                             rsvp_set_by, rsvp_responded_at, invitation_sent_at, email, photo_consent, custom_tags, qr_token)
  VALUES (pg_temp.stg_id('guest:account'), e_plan, 'Andres', 'Lim', 'groom', 'friends', 'guest', 'attending',
          'guest', now() - interval '2 days', now() - interval '9 days', v_acc->>'guest', true, '{}', md5('stg:qr:guest-account'));
  INSERT INTO public.event_members (event_id, user_id, member_type, joined_via, guest_id)
  VALUES (e_plan, (v_uid->>'guest')::uuid, 'guest', 'invite_claim', pg_temp.stg_id('guest:account'));

  -- Bookings go back to exactly how the copy had them.
  UPDATE public.platform_settings SET bookings_open = v_bookings_open WHERE id = 1;
END
$seed$;
