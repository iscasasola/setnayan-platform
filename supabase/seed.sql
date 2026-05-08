-- Tayo seed data for development.
-- Creates one event (Maria & Juan, October 24, 2026) for the founder's auth user,
-- plus 12 sample guests covering all role variations from the mockup at
-- docs/17_Couple_Dashboard_Guests_Mockup.html.
--
-- Idempotent: re-runnable. Wipes the event and its descendants first.

DO $$
DECLARE
  v_email          TEXT := 'iscasasolaii@gmail.com';
  v_user_id        UUID;
  v_event_id       UUID;
  v_slug           TEXT := 'maria-juan-2026';

  -- Households
  v_reyes_id       UUID;
  v_lim_id         UUID;
  v_tan_id         UUID;
  v_dlc_id         UUID;
  v_santos_id      UUID;

  -- Wedding tables
  v_table_sponsor  UUID;

  -- Paired guest IDs (need to be known up front to set pair_with_guest_id)
  v_cora      UUID := gen_random_uuid();
  v_boy       UUID := gen_random_uuid();
  v_ramon     UUID := gen_random_uuid();
  v_mia       UUID := gen_random_uuid();
  v_joaquin   UUID := gen_random_uuid();
  v_sofia_tan UUID := gen_random_uuid();
  v_paolo     UUID := gen_random_uuid();
  v_anna      UUID := gen_random_uuid();
BEGIN
  -- ─── Locate founder ─────────────────────────────────────────
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Founder auth user (%) not found. Sign in to the app first.', v_email;
  END IF;

  -- ─── Idempotency: wipe any existing event with our slug ─────
  DELETE FROM events WHERE LOWER(slug) = LOWER(v_slug);

  -- ─── Create the event ──────────────────────────────────────
  INSERT INTO events (
    slug, couple_user_id_1, couple_user_id_2,
    bride_first_name, bride_last_name, groom_first_name, groom_last_name,
    event_date, ceremony_type, ceremony_venue, reception_venue,
    guest_count_estimate, status, tier, rsvp_deadline
  ) VALUES (
    v_slug, v_user_id, NULL,
    'Maria', 'Reyes', 'Juan', 'De la Cruz',
    DATE '2026-10-24', 'catholic',
    'Sto. Domingo Parish, Quezon City', 'Ardilla Garden Estate, Tagaytay',
    212, 'planning', 'premium', DATE '2026-08-15'
  ) RETURNING event_id INTO v_event_id;

  -- ─── Households ────────────────────────────────────────────
  INSERT INTO households (event_id, name, address) VALUES
    (v_event_id, 'Reyes household',     '{"city":"Quezon City","region":"NCR","country":"PH"}'::jsonb)
    RETURNING household_id INTO v_reyes_id;
  INSERT INTO households (event_id, name) VALUES (v_event_id, 'Lim household')
    RETURNING household_id INTO v_lim_id;
  INSERT INTO households (event_id, name) VALUES (v_event_id, 'Tan household')
    RETURNING household_id INTO v_tan_id;
  INSERT INTO households (event_id, name) VALUES (v_event_id, 'De la Cruz household')
    RETURNING household_id INTO v_dlc_id;
  INSERT INTO households (event_id, name) VALUES (v_event_id, 'Santos household')
    RETURNING household_id INTO v_santos_id;

  -- ─── Wedding tables (one example for FK reference) ────────
  INSERT INTO wedding_tables (event_id, table_name, capacity)
    VALUES (v_event_id, 'Sponsor table', 12)
    RETURNING table_id INTO v_table_sponsor;

  -- ─── Guests (12 covering all role categories from mockup) ──
  -- Insert all rows in one statement so the cross-row pair_with_guest_id FKs
  -- resolve at statement end.
  INSERT INTO guests (
    guest_id, event_id, household_id, pair_with_guest_id,
    first_name, last_name, display_name,
    side, group_category, role,
    plus_one_allowed, plus_one_name,
    email, mobile, address,
    meal_preference, dietary_restrictions, photo_consent,
    table_assignment_id,
    invited_to_blocks, custom_tags,
    rsvp_status, rsvp_responded_at, invitation_sent_at,
    notes
  ) VALUES
    -- Cora & Boy Reyes (paired principal sponsors, bride side)
    (v_cora, v_event_id, v_reyes_id, v_boy,
     'Cora', 'Reyes', 'Tito Boy & Tita Cora',
     'bride', 'family', 'principal_sponsor',
     FALSE, NULL,
     'cora.reyes@gmail.com', '+639171234421', '{"city":"Quezon City"}'::jsonb,
     'fish', NULL, TRUE,
     v_table_sponsor,
     ARRAY['ceremony','reception','cocktails']::TEXT[],
     ARRAY['VIP','Tito barkada']::TEXT[],
     'attending', NOW() - INTERVAL '12 days', NOW() - INTERVAL '20 days',
     'Tita Cora is Mama''s eldest sister. Will sign the contract first. They''ll bring lola — pencil her in for table 1 too if her health permits.'),
    (v_boy, v_event_id, v_reyes_id, v_cora,
     'Boy', 'Reyes', NULL,
     'bride', 'family', 'principal_sponsor',
     FALSE, NULL,
     NULL, NULL, NULL,
     'beef', 'low-sodium', TRUE,
     v_table_sponsor,
     ARRAY['ceremony','reception','cocktails']::TEXT[],
     ARRAY['VIP','Tito barkada']::TEXT[],
     'attending', NOW() - INTERVAL '12 days', NOW() - INTERVAL '20 days',
     NULL),

    -- Ramon & Mia Lim (paired principal sponsors, groom side)
    (v_ramon, v_event_id, v_lim_id, v_mia,
     'Ramon', 'Lim', 'Tito Ramon & Tita Mia',
     'groom', 'family', 'principal_sponsor',
     FALSE, NULL,
     'ramon.lim@example.com', '+639172345678', NULL,
     'beef', NULL, TRUE,
     v_table_sponsor,
     ARRAY['ceremony','reception','cocktails']::TEXT[],
     ARRAY['VIP']::TEXT[],
     'attending', NOW() - INTERVAL '8 days', NOW() - INTERVAL '20 days',
     NULL),
    (v_mia, v_event_id, v_lim_id, v_ramon,
     'Mia', 'Lim', NULL,
     'groom', 'family', 'principal_sponsor',
     FALSE, NULL,
     NULL, NULL, NULL,
     'fish', NULL, TRUE,
     v_table_sponsor,
     ARRAY['ceremony','reception','cocktails']::TEXT[],
     ARRAY['VIP']::TEXT[],
     'attending', NOW() - INTERVAL '8 days', NOW() - INTERVAL '20 days',
     NULL),

    -- Carla Mendoza (solo, maid of honor, college)
    (gen_random_uuid(), v_event_id, NULL, NULL,
     'Carla', 'Mendoza', NULL,
     'bride', 'school', 'maid_of_honor',
     TRUE, 'Andres T.',
     'carla.mendoza@example.com', '+639175557788', NULL,
     'chicken', NULL, TRUE,
     NULL,
     ARRAY['ceremony','reception','cocktails','after_party','rehearsal_dinner']::TEXT[],
     ARRAY['College','VIP']::TEXT[],
     'attending', NOW() - INTERVAL '5 days', NOW() - INTERVAL '20 days',
     NULL),

    -- Marco Reyes (best man, brother of bride)
    (gen_random_uuid(), v_event_id, v_reyes_id, NULL,
     'Marco', 'Reyes', NULL,
     'bride', 'family', 'best_man',
     FALSE, NULL,
     'marco.reyes@example.com', '+639179988776', NULL,
     'beef', NULL, TRUE,
     NULL,
     ARRAY['ceremony','reception','cocktails','after_party','rehearsal_dinner']::TEXT[],
     ARRAY['Family']::TEXT[],
     'attending', NOW() - INTERVAL '15 days', NOW() - INTERVAL '20 days',
     NULL),

    -- Lola Adela Reyes (veil sponsor, grandmother)
    (gen_random_uuid(), v_event_id, v_reyes_id, NULL,
     'Adela', 'Reyes', 'Lola Adela Reyes',
     'bride', 'family', 'veil_sponsor',
     FALSE, NULL,
     NULL, NULL, NULL,
     'no_preference', 'soft food', TRUE,
     NULL,
     ARRAY['ceremony','reception']::TEXT[],
     ARRAY['Family','VIP']::TEXT[],
     'pending', NULL, NOW() - INTERVAL '20 days',
     'Health permitting. Coordinate transport.'),

    -- Joaquin & Sofia Tan (paired, groomsman+bridesmaid, both)
    (v_joaquin, v_event_id, v_tan_id, v_sofia_tan,
     'Joaquin', 'Tan', 'Joaquin & Sofia Tan',
     'both', 'school', 'groomsman',
     FALSE, NULL,
     'joaquin.tan@example.com', '+639182223344', NULL,
     'chicken', NULL, TRUE,
     NULL,
     ARRAY['ceremony','reception','cocktails','after_party']::TEXT[],
     ARRAY['College']::TEXT[],
     'attending', NOW() - INTERVAL '7 days', NOW() - INTERVAL '20 days',
     NULL),
    (v_sofia_tan, v_event_id, v_tan_id, v_joaquin,
     'Sofia', 'Tan', NULL,
     'both', 'school', 'bridesmaid',
     FALSE, NULL,
     NULL, NULL, NULL,
     'fish', NULL, TRUE,
     NULL,
     ARRAY['ceremony','reception','cocktails','after_party']::TEXT[],
     ARRAY['College']::TEXT[],
     'attending', NOW() - INTERVAL '7 days', NOW() - INTERVAL '20 days',
     NULL),

    -- Sofia Reyes (5 yrs, flower girl, niece)
    (gen_random_uuid(), v_event_id, v_reyes_id, NULL,
     'Sofia', 'Reyes', NULL,
     'bride', 'family', 'flower_girl',
     FALSE, NULL,
     NULL, NULL, NULL,
     'kids', NULL, TRUE,
     NULL,
     ARRAY['ceremony','reception']::TEXT[],
     ARRAY['Family']::TEXT[],
     'attending', NOW() - INTERVAL '15 days', NOW() - INTERVAL '20 days',
     '5 yrs old — niece of bride.'),

    -- Liam De la Cruz (7 yrs, ring bearer, nephew)
    (gen_random_uuid(), v_event_id, v_dlc_id, NULL,
     'Liam', 'De la Cruz', NULL,
     'groom', 'family', 'ring_bearer',
     FALSE, NULL,
     NULL, NULL, NULL,
     'kids', NULL, TRUE,
     NULL,
     ARRAY['ceremony','reception']::TEXT[],
     ARRAY['Family']::TEXT[],
     'attending', NOW() - INTERVAL '15 days', NOW() - INTERVAL '20 days',
     '7 yrs old — nephew of groom.'),

    -- Jenny Bautista (solo, office colleague, plus-one TBA, pending)
    (gen_random_uuid(), v_event_id, NULL, NULL,
     'Jenny', 'Bautista', NULL,
     'bride', 'work', 'guest',
     TRUE, NULL, -- Plus-one allowed but TBA
     'jenny.bautista@example.com', '+639186677889', NULL,
     NULL, NULL, TRUE,
     NULL,
     ARRAY['ceremony','reception']::TEXT[],
     ARRAY['Office','Plus-one TBA']::TEXT[],
     'pending', NULL, NOW() - INTERVAL '20 days',
     NULL),

    -- Paolo & Anna Santos (paired, friends, declined)
    (v_paolo, v_event_id, v_santos_id, v_anna,
     'Paolo', 'Santos', 'Paolo & Anna Santos',
     'both', 'friends', 'guest',
     FALSE, NULL,
     'paolo.santos@example.com', '+639199990001', NULL,
     NULL, NULL, TRUE,
     NULL,
     ARRAY['ceremony','reception']::TEXT[],
     ARRAY['Friends']::TEXT[],
     'declined', NOW() - INTERVAL '3 days', NOW() - INTERVAL '20 days',
     'Anna due 1 week before — they regretfully decline.'),
    (v_anna, v_event_id, v_santos_id, v_paolo,
     'Anna', 'Santos', NULL,
     'both', 'friends', 'guest',
     FALSE, NULL,
     NULL, NULL, NULL,
     NULL, NULL, TRUE,
     NULL,
     ARRAY['ceremony','reception']::TEXT[],
     ARRAY['Friends']::TEXT[],
     'declined', NOW() - INTERVAL '3 days', NOW() - INTERVAL '20 days',
     NULL),

    -- Fr. Jose Aquino (officiant)
    (gen_random_uuid(), v_event_id, NULL, NULL,
     'Jose', 'Aquino', 'Fr. Jose Aquino',
     'both', 'officiant', 'officiant',
     FALSE, NULL,
     'parish.stodomingo@example.com', NULL, '{"city":"Quezon City"}'::jsonb,
     NULL, NULL, FALSE, -- officiant typically opts out of photos
     NULL,
     ARRAY['ceremony']::TEXT[],
     ARRAY['Officiant']::TEXT[],
     'attending', NOW() - INTERVAL '30 days', NOW() - INTERVAL '40 days',
     'Sto. Domingo Parish · ceremony only.'),

    -- Patricia Cruz (solo, bridesmaid, college, plus-one TBA, pending)
    (gen_random_uuid(), v_event_id, NULL, NULL,
     'Patricia', 'Cruz', NULL,
     'bride', 'school', 'bridesmaid',
     TRUE, NULL,
     'patricia.cruz@example.com', '+639174445566', NULL,
     NULL, NULL, TRUE,
     NULL,
     ARRAY['ceremony','reception','cocktails','after_party','rehearsal_dinner']::TEXT[],
     ARRAY['College','Plus-one TBA']::TEXT[],
     'pending', NULL, NOW() - INTERVAL '20 days',
     NULL);

  RAISE NOTICE 'Seed complete: event_id=%, 14 guests, 5 households, 1 wedding table.', v_event_id;
END $$;
