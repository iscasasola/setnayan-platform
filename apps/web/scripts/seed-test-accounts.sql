-- Setnayan virtual/scenario test accounts — single-DO-block seed (one command).
-- No service-role key needed. Idempotent: cleans the 3 tagged accounts first.
--
-- BASELINE STATE = "shortlist only": the couple has SAVED/shortlisted the
-- vendor (private event_vendors row, status='considering', linked via
-- marketplace_vendor_id — exactly what the /vendors "Save" button creates).
-- There is intentionally NO inquiry thread yet, so you can observe that a
-- shortlist is invisible to the vendor. Run seed-inquiry.sql to add the
-- vendor-visible inquiry (phase 2).
--
-- Run:
--   ~/.local/bin/supabase db query --db-url "$SUPABASE_DB_URL" \
--     --file apps/web/scripts/seed-test-accounts.sql
DO $$
DECLARE
  couple_id uuid := gen_random_uuid();
  vendor_id uuid := gen_random_uuid();
  admin_id  uuid := gen_random_uuid();
  pw_hash   text := extensions.crypt('SetnayanTest!2026', extensions.gen_salt('bf'));
  v_event_id uuid;
  v_vpid     uuid;
BEGIN
  -- 0. Idempotent cleanup (no-op on first run) -----------------------------
  DELETE FROM public.events WHERE slug = 'test-maria-and-jose';
  DELETE FROM public.vendor_profiles
    WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'vendor.test@setnayan.com');
  DELETE FROM public.users
    WHERE email IN ('couple.test@setnayan.com','vendor.test@setnayan.com','admin.test@setnayan.com');
  DELETE FROM auth.users
    WHERE email IN ('couple.test@setnayan.com','vendor.test@setnayan.com','admin.test@setnayan.com');

  -- 1. auth.users (token varchars '' to dodge GoTrue NULL-scan login bug) ---
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, reauthentication_token, phone_change, phone_change_token
  ) VALUES
    ('00000000-0000-0000-0000-000000000000', couple_id, 'authenticated', 'authenticated',
      'couple.test@setnayan.com', pw_hash, now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"account_type":"customer"}'::jsonb,
      '', '', '', '', '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', vendor_id, 'authenticated', 'authenticated',
      'vendor.test@setnayan.com', pw_hash, now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"account_type":"vendor"}'::jsonb,
      '', '', '', '', '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated',
      'admin.test@setnayan.com', pw_hash, now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"account_type":"customer"}'::jsonb,
      '', '', '', '', '', '', '', '');

  -- 2. auth.identities (email provider — required for password login) -------
  -- NOTE: auth.identities.email is GENERATED (from identity_data->>'email') — do not insert it.
  INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data,
    last_sign_in_at, created_at, updated_at) VALUES
    (gen_random_uuid(), couple_id, couple_id::text, 'email',
      jsonb_build_object('sub', couple_id::text, 'email', 'couple.test@setnayan.com',
        'email_verified', true, 'phone_verified', false), now(), now(), now()),
    (gen_random_uuid(), vendor_id, vendor_id::text, 'email',
      jsonb_build_object('sub', vendor_id::text, 'email', 'vendor.test@setnayan.com',
        'email_verified', true, 'phone_verified', false), now(), now(), now()),
    (gen_random_uuid(), admin_id, admin_id::text, 'email',
      jsonb_build_object('sub', admin_id::text, 'email', 'admin.test@setnayan.com',
        'email_verified', true, 'phone_verified', false), now(), now(), now());

  -- on_auth_user_created → public.users (x3); on_users_vendor_created → vendor_profiles.

  -- 3. Role/display tweaks --------------------------------------------------
  -- account_type='admin' so public.is_admin() (which checks ONLY account_type)
  -- passes for the test admin — without it every is_admin() RLS policy returns
  -- empty even though the /admin layout gate (is_internal OR is_team_member OR
  -- account_type='admin') lets the account in. is_internal stays FALSE on
  -- purpose: that flag carries §10a payment-skip semantics that must not
  -- silently attach to a test account.
  UPDATE public.users SET account_type = 'admin', is_team_member = true, display_name = '[TEST] Setnayan Team' WHERE user_id = admin_id;
  UPDATE public.users SET display_name = '[TEST] Maria & Jose' WHERE user_id = couple_id;

  -- 4. Couple wedding event -------------------------------------------------
  INSERT INTO public.events (event_type, display_name, slug, event_date, is_primary,
    ceremony_type, venue_setting, bride_name, groom_name)
  VALUES ('wedding', '[TEST] Maria & Jose', 'test-maria-and-jose', DATE '2026-12-12', true,
    'catholic', 'garden', 'Maria', 'Jose')
  RETURNING event_id INTO v_event_id;

  INSERT INTO public.event_members (event_id, user_id, member_type, joined_via)
  VALUES (v_event_id, couple_id, 'couple', 'created_event');

  -- 5. Vendor listing (profile auto-created by trigger) ---------------------
  SELECT vendor_profile_id INTO v_vpid FROM public.vendor_profiles WHERE user_id = vendor_id;

  UPDATE public.vendor_profiles SET
    business_name = '[TEST] Liwanag Photography',
    business_slug = 'test-liwanag-photography',
    tagline       = 'Candid, light-drenched Filipino wedding stories.',
    services      = ARRAY['photographer'],
    location_city = 'Manila',
    hq_region     = 'NCR',
    contact_email = 'vendor.test@setnayan.com',
    is_published  = true,
    is_demo       = true,
    -- ⚠ `verification_state = 'verified'` MUST arrive with its side-effects, in
    -- THIS statement. This seed is documented (header) as runnable against PROD
    -- via --db-url, and the un-stamped version of this line is the most likely
    -- origin of the prod row that carried the public "Verified" badge with a
    -- NULL last_verified_at and no vendor_tier_history entry — a shop that
    -- looked human-checked to couples while nobody had checked it.
    -- `vendor_profiles_verified_requires_stamp` (migration 20271017100000) now
    -- REJECTS the un-stamped shape outright, so omitting these would fail loudly
    -- rather than seed another lie.
    verification_state  = 'verified',
    last_verified_at    = NOW(),
    next_renewal_due_at = NOW() + INTERVAL '1 year',
    compatible_ceremony_types = ARRAY['catholic','civil'],
    compatible_venue_settings = ARRAY['garden','banquet_hall'],
    event_types   = ARRAY['wedding']
  WHERE vendor_profile_id = v_vpid;

  -- The audit row a real admin approval would have written. Without it the
  -- seeded shop is verified with no history explaining why.
  INSERT INTO public.vendor_tier_history
    (vendor_profile_id, from_state, to_state, admin_user_id, reason, metadata)
  VALUES
    (v_vpid, 'unverified', 'verified', admin_id, 'Seeded test vendor',
     jsonb_build_object('source', 'seed-test-accounts.sql', 'is_demo', true));

  -- 'verified', NOT the retired 'coming_soon'. Migration 20271013500000 retired
  -- that value (owner: "we only show shops that are ready") and narrowed
  -- `vendor_profiles_public_read` to require public_visibility = 'verified' AND
  -- verification_state = 'verified' — so a 'coming_soon' seed row is invisible
  -- in the marketplace, which defeats the point of seeding a browsable vendor.
  UPDATE public.vendor_profiles SET public_visibility = 'verified', is_demo = true
    WHERE vendor_profile_id = v_vpid;

  INSERT INTO public.vendor_services
    (vendor_profile_id, category, starting_price_php, crew_size, crew_meal_required, is_active)
  VALUES (v_vpid, 'photographer', 60000, 3, true, true);

  -- 6. SHORTLIST (phase 1): couple saves the vendor -------------------------
  --    Mirrors saveVendorToPicks: private event_vendors row, status
  --    'considering', linked via marketplace_vendor_id, source 'host_manual'.
  --    INVISIBLE to the vendor (couple-only RLS on event_vendors).
  INSERT INTO public.event_vendors
    (event_id, marketplace_vendor_id, category, vendor_name, contact_email, status, source, notes)
  VALUES (v_event_id, v_vpid, 'photographer', '[TEST] Liwanag Photography',
    'vendor.test@setnayan.com', 'considering', 'host_manual',
    'Shortlisted via test seed — no inquiry yet (run seed-inquiry.sql for phase 2).');

  RAISE NOTICE 'Seed OK (shortlist-only) — couple=% vendor=% admin=% event=% vendor_profile=%',
    couple_id, vendor_id, admin_id, v_event_id, v_vpid;
END $$;
