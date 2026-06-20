-- Idempotent prod-safe seed for the Maria & Jose public sample event.
-- Re-runnable: keyed to a fixed demo_batch_id (a1a1a1a1-0000-4000-8000-000000000a01),
-- vendor seed deletes-by-batch then re-inserts. All vendors AND services carry
-- is_demo=TRUE (hidden from every search surface) + are shortlisted to the event.
-- Apply (prod, statement-by-statement — db query runs ONE DO block per call):
--   for f in event vendors extra; do cat <block> | supabase db query --db-url "$SUPABASE_DB_URL"; done
-- Applied to prod 2026-06-20.

-- ===== BLOCK 1: event + owner host =====
DO $$
DECLARE
  v_event_id uuid;
  v_owner uuid := '5599d399-b4f8-459d-9080-8069824dec96';
BEGIN
  SELECT event_id INTO v_event_id FROM public.events WHERE slug = 'maria-and-jose' LIMIT 1;
  IF v_event_id IS NULL THEN
    INSERT INTO public.events (event_type, display_name, slug, is_sample, bride_name, groom_name, event_date, is_primary, ceremony_type, venue_setting)
    VALUES ('wedding', 'Maria & Jose', 'maria-and-jose', TRUE, 'Maria', 'Jose', DATE '2026-12-12', FALSE, 'catholic', 'heritage')
    RETURNING event_id INTO v_event_id;
  ELSE
    UPDATE public.events SET is_sample = TRUE WHERE event_id = v_event_id;
  END IF;

  INSERT INTO public.event_members (event_id, user_id, member_type, role)
  SELECT v_event_id, v_owner, 'couple'::member_type, 'host'
  WHERE NOT EXISTS (SELECT 1 FROM public.event_members WHERE event_id = v_event_id AND user_id = v_owner);
END $$;

-- ===== BLOCK 2: 36 single-service vendors across 12 categories =====
DO $$
DECLARE
  v_event uuid;
  v_batch uuid := 'a1a1a1a1-0000-4000-8000-000000000a01';
  r record; v_vp uuid;
BEGIN
  SELECT event_id INTO v_event FROM public.events WHERE slug='maria-and-jose';
  IF v_event IS NULL THEN RAISE EXCEPTION 'Maria & Jose event not found'; END IF;

  -- idempotent: clear any prior Maria&Jose vendor seed
  DELETE FROM public.event_vendors WHERE event_id=v_event AND marketplace_vendor_id IN (SELECT vendor_profile_id FROM public.vendor_profiles WHERE demo_batch_id=v_batch);
  DELETE FROM public.vendor_services  WHERE demo_batch_id=v_batch;
  DELETE FROM public.vendor_profiles  WHERE demo_batch_id=v_batch;

  FOR r IN
    SELECT row_number() OVER () AS rn, * FROM (VALUES
      ('photographer'::vendor_category,'photography','Liwanag Studios','Manila','Classic Day Coverage',8500000),
      ('photographer'::vendor_category,'photography','Habi Photo Co.','Cebu','Full Day + Album',12000000),
      ('photographer'::vendor_category,'photography','Sinag Frames','Tagaytay','Garden Wedding Package',9500000),
      ('videographer'::vendor_category,'videography','Alon Films','Manila','Cinematic Highlight',9000000),
      ('videographer'::vendor_category,'videography','Kislap Motion','Davao','Same-Day Edit',13500000),
      ('videographer'::vendor_category,'videography','Haraya Cinema','Cebu','Feature Film',16000000),
      ('catering'::vendor_category,'catering','Hain Catering','Manila','Plated · 150 pax',135000000),
      ('catering'::vendor_category,'catering','Salu-Salo Kitchen','Pampanga','Buffet · 200 pax',160000000),
      ('catering'::vendor_category,'catering','Kamayan Feast','Cebu','Filipino Spread · 150 pax',120000000),
      ('florist'::vendor_category,'garden_wedding_florist','Bulaklak & Co.','Manila','Ceremony + Reception',7500000),
      ('florist'::vendor_category,'garden_wedding_florist','Sampaguita Blooms','Tagaytay','Garden Full Florals',9800000),
      ('florist'::vendor_category,'garden_wedding_florist','Hardin Florals','Cavite','Bridal + Entourage',6500000),
      ('cake_maker'::vendor_category,'wedding_cake','Matamis Bakeshop','Manila','3-Tier Classic',2800000),
      ('cake_maker'::vendor_category,'wedding_cake','Tinapay Cakes','Cebu','Naked Garden Cake',3200000),
      ('cake_maker'::vendor_category,'wedding_cake','Pulot Patisserie','Quezon City','5-Tier Statement',5200000),
      ('host_emcee'::vendor_category,'host_emcee','Kuya Mike Events','Manila','Full Program Host',3500000),
      ('host_emcee'::vendor_category,'host_emcee','Tita Bea on the Mic','Cebu','Reception Host',3000000),
      ('host_emcee'::vendor_category,'host_emcee','Voz Hosting','Davao','Bilingual Host',3800000),
      ('band_dj'::vendor_category,'live_band','Saysay Live Band','Manila','5-Piece Reception Set',5500000),
      ('band_dj'::vendor_category,'live_band','Tugtog Collective','Cebu','Acoustic Trio',3800000),
      ('band_dj'::vendor_category,'dj','DJ Indak','Manila','Party DJ + Lights',3000000),
      ('hair_stylist'::vendor_category,'bridal_hair_stylist','Buhok Bridal Hair','Manila','Bride + 4 Entourage',2500000),
      ('hair_stylist'::vendor_category,'bridal_hair_stylist','Korona Hair Studio','Cebu','Bride Only',1200000),
      ('hair_stylist'::vendor_category,'bridal_hair_stylist','Ganda Glam Hair','Tagaytay','Full Entourage',4200000),
      ('planner_coordinator'::vendor_category,'wedding_coordination','Set & Done Coordination','Manila','Full Coordination',6500000),
      ('planner_coordinator'::vendor_category,'wedding_coordination','Araw Planners','Cebu','On-the-Day',4500000),
      ('planner_coordinator'::vendor_category,'day_of_coordinator','Kasal Crew','Davao','Day-of Team',4000000),
      ('lights_and_sound'::vendor_category,'lights_sound','Ilaw Productions','Manila','Reception AV',5000000),
      ('lights_and_sound'::vendor_category,'lights_sound','Tunog Lights & Sound','Cebu','Ceremony + Reception',6200000),
      ('lights_and_sound'::vendor_category,'outdoor_lighting_specialist','Sinag AV','Cavite','Garden Lighting',4800000),
      ('photobooth'::vendor_category,'photo_booth','Kuha Booth','Manila','3-Hour Booth',1800000),
      ('photobooth'::vendor_category,'booth_360','Snap! 360','Cebu','360 Video Booth',2500000),
      ('photobooth'::vendor_category,'polaroid_booth','Pose Box','Tagaytay','Polaroid Booth',1500000),
      ('mobile_bar'::vendor_category,'mobile_bar','Tagay Mobile Bar','Manila','Open Bar · 4 hrs',4500000),
      ('mobile_bar'::vendor_category,'tea_bar','Inuman Tea Cart','Cebu','Milk Tea Cart',2200000),
      ('mobile_bar'::vendor_category,'mocktail_bar','Barkada Bar','Davao','Mocktail Bar',2800000)
    ) AS t(coarse, leaf, biz, city, pkg, price)
  LOOP
    INSERT INTO public.vendor_profiles (business_name, business_slug, tagline, location_city, services, public_visibility, is_demo, demo_batch_id)
    VALUES (r.biz, 'mj-'||r.rn||'-'||lower(regexp_replace(r.biz,'[^a-z0-9]+','-','gi')), 'Sample vendor · Maria & Jose', r.city, ARRAY[r.leaf]::text[], 'verified', TRUE, v_batch)
    RETURNING vendor_profile_id INTO v_vp;

    INSERT INTO public.vendor_services (vendor_profile_id, category, title, starts_at_centavos, starting_price_php, package_inclusions, is_active, is_demo, demo_batch_id)
    VALUES (v_vp, r.leaf, r.pkg, r.price, (r.price/100)::int, '[]'::jsonb, TRUE, TRUE, v_batch);

    INSERT INTO public.event_vendors (event_id, category, vendor_name, marketplace_vendor_id, status)
    VALUES (v_event, r.coarse, r.biz, v_vp, 'considering');
  END LOOP;
END $$;

-- ===== BLOCK 3: multi-service studio + bundle =====
DO $$
DECLARE
  v_event uuid; v_batch uuid := 'a1a1a1a1-0000-4000-8000-000000000a01'; v_vp uuid;
BEGIN
  SELECT event_id INTO v_event FROM public.events WHERE slug='maria-and-jose';

  -- MULTI-SERVICE studio: one vendor offering BOTH photography + videography
  INSERT INTO public.vendor_profiles (business_name, business_slug, tagline, location_city, services, public_visibility, is_demo, demo_batch_id)
  VALUES ('Sulyap Studios','mj-multi-sulyap-studios','Photo + video, one team','Manila',ARRAY['photography','videography']::text[],'verified',TRUE,v_batch)
  RETURNING vendor_profile_id INTO v_vp;
  INSERT INTO public.vendor_services (vendor_profile_id, category, title, starts_at_centavos, starting_price_php, package_inclusions, is_active, is_demo, demo_batch_id) VALUES
    (v_vp,'photography','Combo · Photo Coverage',9000000,90000,'[]'::jsonb,TRUE,TRUE,v_batch),
    (v_vp,'videography','Combo · Video Coverage',9500000,95000,'[]'::jsonb,TRUE,TRUE,v_batch);
  INSERT INTO public.event_vendors (event_id, category, vendor_name, marketplace_vendor_id, status) VALUES
    (v_event,'photographer','Sulyap Studios',v_vp,'considering'),
    (v_event,'videographer','Sulyap Studios',v_vp,'considering');

  -- BUNDLE: one vendor, an all-in package (inclusions list the bundled items)
  INSERT INTO public.vendor_profiles (business_name, business_slug, tagline, location_city, services, public_visibility, is_demo, demo_batch_id)
  VALUES ('Buong Kasal Co.','mj-bundle-buong-kasal','Everything in one package','Manila',ARRAY['wedding_coordination']::text[],'verified',TRUE,v_batch)
  RETURNING vendor_profile_id INTO v_vp;
  INSERT INTO public.vendor_services (vendor_profile_id, category, title, starts_at_centavos, starting_price_php, package_inclusions, is_active, is_demo, demo_batch_id)
  VALUES (v_vp,'wedding_coordination','All-in Wedding Bundle',18000000,180000,
    '["Full coordination","Host / emcee","Lights & sound","Photo + video","Bridal car"]'::jsonb,TRUE,TRUE,v_batch);
  INSERT INTO public.event_vendors (event_id, category, vendor_name, marketplace_vendor_id, status)
  VALUES (v_event,'planner_coordinator','Buong Kasal Co.',v_vp,'considering');
END $$;
