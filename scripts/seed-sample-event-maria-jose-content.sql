-- Maria & Jose sample event — CONTENT seed (guests, seating, budget, mood board, Papic).
-- Companion to scripts/seed-sample-event-maria-jose.sql (event + vendors).
-- Authored + adversarially-verified via the seed-maria-jose-content workflow, then
-- applied to prod 2026-06-20 (statement-by-statement: each is ONE idempotent DO block;
-- event resolved by slug 'maria-and-jose'; re-runnable — each block clears its own
-- event-scoped rows then re-inserts).
-- Verified: 42 guests · 7 tables/28 seats · 18 budget lines (₱810k) · 6-colour palette + 7 items · 8 Papic photos.

-- ============================================================
-- BLOCK 1: 
-- ============================================================
DO $$
DECLARE
  v_event uuid;
BEGIN
  -- Resolve the sample event (slug is unique -> exactly one row)
  SELECT event_id INTO v_event
  FROM public.events
  WHERE slug = 'maria-and-jose'
  LIMIT 1;

  IF v_event IS NULL THEN
    RAISE EXCEPTION 'Event with slug % not found', 'maria-and-jose';
  END IF;

  -- Idempotent: clear this event's prior seeded guests, then re-insert
  DELETE FROM public.guests WHERE event_id = v_event;

  INSERT INTO public.guests
    (event_id, first_name, last_name, display_name, side, group_category, role,
     plus_one_allowed, plus_one_name, plus_one_mode,
     email, mobile, meal_preference, dietary_restrictions,
     invited_to_blocks, rsvp_status, rsvp_responded_at, invitation_sent_at, notes)
  VALUES
    -- ===== Bridal party / sponsors (bride side) =====
    (v_event, 'Lourdes', 'Mercado', NULL, 'bride', 'family', 'maid_of_honor',
     FALSE, NULL, NULL,
     'lourdes.mercado@example.ph', '+639171234501', 'chicken', NULL,
     ARRAY['ceremony','reception','cocktails'], 'attending', now() - interval '20 days', now() - interval '40 days', 'Maid of honor; bride''s elder sister.'),
    (v_event, 'Carmela', 'Villanueva', NULL, 'bride', 'friends', 'bridesmaid',
     TRUE, 'Paolo Reyes', 'full',
     'carmela.villanueva@example.ph', '+639171234502', 'beef', NULL,
     ARRAY['ceremony','reception','cocktails'], 'attending', now() - interval '18 days', now() - interval '40 days', 'Bringing partner.'),
    (v_event, 'Bianca', 'Soriano', NULL, 'bride', 'friends', 'bridesmaid',
     FALSE, NULL, NULL,
     'bianca.soriano@example.ph', '+639171234503', 'fish', NULL,
     ARRAY['ceremony','reception','cocktails'], 'attending', now() - interval '15 days', now() - interval '40 days', NULL),
    (v_event, 'Don Eduardo', 'Mercado', 'Hon. Eduardo Mercado', 'bride', 'family', 'principal_sponsor',
     FALSE, NULL, NULL,
     'eduardo.mercado@example.ph', '+639171234504', 'beef', NULL,
     ARRAY['ceremony','reception'], 'attending', now() - interval '25 days', now() - interval '45 days', 'Ninong; bride''s uncle.'),
    (v_event, 'Aurora', 'Mercado', NULL, 'bride', 'family', 'principal_sponsor',
     FALSE, NULL, NULL,
     'aurora.mercado@example.ph', '+639171234505', 'fish', NULL,
     ARRAY['ceremony','reception'], 'attending', now() - interval '25 days', now() - interval '45 days', 'Ninang; bride''s aunt.'),
    (v_event, 'Sofia', 'Mercado', NULL, 'bride', 'family', 'flower_girl',
     FALSE, NULL, NULL,
     NULL, NULL, 'kids', NULL,
     ARRAY['ceremony','reception'], 'attending', now() - interval '22 days', now() - interval '45 days', 'Flower girl; niece, age 6.'),

    -- ===== Groom party / sponsors (groom side) =====
    (v_event, 'Rafael', 'Dela Cruz', NULL, 'groom', 'friends', 'best_man',
     FALSE, NULL, NULL,
     'rafael.delacruz@example.ph', '+639181234511', 'beef', NULL,
     ARRAY['ceremony','reception','cocktails'], 'attending', now() - interval '19 days', now() - interval '40 days', 'Best man.'),
    (v_event, 'Miguel', 'Aquino', NULL, 'groom', 'friends', 'groomsman',
     TRUE, 'Andrea Lim', 'full',
     'miguel.aquino@example.ph', '+639181234512', 'chicken', NULL,
     ARRAY['ceremony','reception','cocktails'], 'attending', now() - interval '17 days', now() - interval '40 days', 'Groomsman; bringing girlfriend.'),
    (v_event, 'Joaquin', 'Ramos', NULL, 'groom', 'work', 'groomsman',
     FALSE, NULL, NULL,
     'joaquin.ramos@example.ph', '+639181234513', 'fish', NULL,
     ARRAY['ceremony','reception','cocktails'], 'attending', now() - interval '14 days', now() - interval '40 days', 'Groomsman; college friend.'),
    (v_event, 'Don Ricardo', 'Dela Cruz', NULL, 'groom', 'family', 'principal_sponsor',
     FALSE, NULL, NULL,
     'ricardo.delacruz@example.ph', '+639181234514', 'beef', NULL,
     ARRAY['ceremony','reception'], 'attending', now() - interval '24 days', now() - interval '45 days', 'Ninong; groom''s godfather.'),
    (v_event, 'Teresita', 'Bautista', NULL, 'groom', 'family', 'principal_sponsor',
     FALSE, NULL, NULL,
     'teresita.bautista@example.ph', '+639181234515', 'vegetarian', 'No pork.',
     ARRAY['ceremony','reception'], 'attending', now() - interval '24 days', now() - interval '45 days', 'Ninang; groom''s aunt.'),

    -- ===== Officiant =====
    (v_event, 'Fr. Benigno', 'Santos', 'Fr. Benigno Santos', 'both', 'officiant', 'officiant',
     FALSE, NULL, NULL,
     'fr.santos@parish.example.ph', '+639190001000', 'no_preference', NULL,
     ARRAY['ceremony','reception'], 'attending', now() - interval '30 days', now() - interval '50 days', 'Parish priest officiating the ceremony.'),

    -- ===== Bride-side family =====
    (v_event, 'Esperanza', 'Mercado', NULL, 'bride', 'family', 'bride_parents',
     FALSE, NULL, NULL,
     'esperanza.mercado@example.ph', '+639171234521', 'fish', 'Low sodium.',
     ARRAY['ceremony','reception'], 'attending', now() - interval '21 days', now() - interval '45 days', 'Bride''s mother.'),
    (v_event, 'Antonio', 'Mercado', NULL, 'bride', 'family', 'bride_parents',
     FALSE, NULL, NULL,
     'antonio.mercado@example.ph', '+639171234522', 'beef', NULL,
     ARRAY['ceremony','reception'], 'attending', now() - interval '21 days', now() - interval '45 days', 'Bride''s father.'),
    (v_event, 'Lola Pacita', 'Mercado', 'Lola Pacita', 'bride', 'family', 'bride_immediate_family',
     FALSE, NULL, NULL,
     NULL, '+639171234523', 'chicken', 'Soft food, dentures.',
     ARRAY['ceremony','reception'], 'attending', now() - interval '20 days', now() - interval '45 days', 'Bride''s grandmother. Needs wheelchair access.'),
    (v_event, 'Reyna', 'Mercado', NULL, 'bride', 'family', 'guest',
     TRUE, 'Jericho Tan', 'full',
     'reyna.mercado@example.ph', '+639171234524', 'chicken', NULL,
     ARRAY['ceremony','reception'], 'attending', now() - interval '12 days', now() - interval '40 days', 'Bride''s cousin.'),
    (v_event, 'Lito', 'Mercado', NULL, 'bride', 'family', 'guest',
     FALSE, NULL, NULL,
     'lito.mercado@example.ph', '+639171234525', 'beef', NULL,
     ARRAY['ceremony','reception'], 'maybe', now() - interval '8 days', now() - interval '40 days', 'Bride''s cousin; travelling from Cebu, flight not yet booked.'),
    (v_event, 'Marites', 'Gonzales', NULL, 'bride', 'friends', 'guest',
     FALSE, NULL, NULL,
     'marites.gonzales@example.ph', '+639171234526', 'fish', NULL,
     ARRAY['ceremony','reception'], 'attending', now() - interval '11 days', now() - interval '38 days', 'College barkada.'),
    (v_event, 'Katrina', 'Lopez', NULL, 'bride', 'friends', 'guest',
     FALSE, NULL, NULL,
     'katrina.lopez@example.ph', '+639171234527', 'vegetarian', NULL,
     ARRAY['ceremony','reception'], 'pending', NULL, now() - interval '38 days', NULL),
    (v_event, 'Diwata', 'Pascual', NULL, 'bride', 'school', 'guest',
     FALSE, NULL, NULL,
     'diwata.pascual@example.ph', '+639171234528', 'chicken', NULL,
     ARRAY['ceremony','reception'], 'declined', now() - interval '6 days', now() - interval '38 days', 'Grade-school friend; abroad on the wedding date.'),
    (v_event, 'Patricia', 'Ocampo', NULL, 'bride', 'work', 'guest',
     FALSE, NULL, NULL,
     'patricia.ocampo@example.ph', '+639171234529', 'beef', NULL,
     ARRAY['reception'], 'attending', now() - interval '9 days', now() - interval '35 days', 'Officemate; reception only.'),
    (v_event, 'Janella', 'Cruz', NULL, 'bride', 'work', 'guest',
     FALSE, NULL, NULL,
     'janella.cruz@example.ph', '+639171234530', 'fish', NULL,
     ARRAY['reception'], 'pending', NULL, now() - interval '35 days', NULL),
    (v_event, 'Yolanda', 'Reyes', NULL, 'bride', 'friends', 'guest',
     FALSE, NULL, NULL,
     'yolanda.reyes@example.ph', '+639171234531', 'chicken', NULL,
     ARRAY['ceremony','reception'], 'attending', now() - interval '10 days', now() - interval '36 days', NULL),

    -- ===== Groom-side family =====
    (v_event, 'Corazon', 'Dela Cruz', NULL, 'groom', 'family', 'groom_parents',
     FALSE, NULL, NULL,
     'corazon.delacruz@example.ph', '+639181234541', 'fish', NULL,
     ARRAY['ceremony','reception'], 'attending', now() - interval '21 days', now() - interval '45 days', 'Groom''s mother.'),
    (v_event, 'Fernando', 'Dela Cruz', NULL, 'groom', 'family', 'groom_parents',
     FALSE, NULL, NULL,
     'fernando.delacruz@example.ph', '+639181234542', 'beef', NULL,
     ARRAY['ceremony','reception'], 'attending', now() - interval '21 days', now() - interval '45 days', 'Groom''s father.'),
    (v_event, 'Lolo Andres', 'Dela Cruz', 'Lolo Andres', 'groom', 'family', 'groom_immediate_family',
     FALSE, NULL, NULL,
     NULL, '+639181234543', 'chicken', 'Diabetic; no sugar dessert.',
     ARRAY['ceremony','reception'], 'attending', now() - interval '19 days', now() - interval '45 days', 'Groom''s grandfather.'),
    (v_event, 'Imelda', 'Dela Cruz', NULL, 'groom', 'family', 'guest',
     FALSE, NULL, NULL,
     'imelda.delacruz@example.ph', '+639181234544', 'chicken', NULL,
     ARRAY['ceremony','reception'], 'attending', now() - interval '13 days', now() - interval '42 days', 'Groom''s aunt.'),
    (v_event, 'Renato', 'Dela Cruz', NULL, 'groom', 'family', 'guest',
     TRUE, 'Cristina Flores', 'full',
     'renato.delacruz@example.ph', '+639181234545', 'beef', NULL,
     ARRAY['ceremony','reception'], 'attending', now() - interval '12 days', now() - interval '42 days', 'Groom''s cousin; bringing wife.'),
    (v_event, 'Dario', 'Manalo', NULL, 'groom', 'friends', 'guest',
     FALSE, NULL, NULL,
     'dario.manalo@example.ph', '+639181234546', 'fish', NULL,
     ARRAY['ceremony','reception'], 'maybe', now() - interval '7 days', now() - interval '40 days', 'High-school friend; awaiting work schedule.'),
    (v_event, 'Enrico', 'Salazar', NULL, 'groom', 'work', 'guest',
     FALSE, NULL, NULL,
     'enrico.salazar@example.ph', '+639181234547', 'beef', NULL,
     ARRAY['reception'], 'attending', now() - interval '9 days', now() - interval '35 days', 'Workmate; reception only.'),
    (v_event, 'Vincent', 'Tan', NULL, 'groom', 'work', 'guest',
     FALSE, NULL, NULL,
     'vincent.tan@example.ph', '+639181234548', 'chicken', NULL,
     ARRAY['reception'], 'pending', NULL, now() - interval '35 days', NULL),
    (v_event, 'Gerald', 'Navarro', NULL, 'groom', 'friends', 'guest',
     FALSE, NULL, NULL,
     'gerald.navarro@example.ph', '+639181234549', 'beef', NULL,
     ARRAY['ceremony','reception'], 'declined', now() - interval '5 days', now() - interval '38 days', 'Old friend; prior commitment.'),
    (v_event, 'Arvin', 'Castillo', NULL, 'groom', 'school', 'guest',
     FALSE, NULL, NULL,
     'arvin.castillo@example.ph', '+639181234550', 'fish', NULL,
     ARRAY['ceremony','reception'], 'attending', now() - interval '11 days', now() - interval '37 days', NULL),
    (v_event, 'Mark Joseph', 'Flores', NULL, 'groom', 'school', 'guest',
     FALSE, NULL, NULL,
     'markjoseph.flores@example.ph', '+639181234551', 'chicken', NULL,
     ARRAY['ceremony','reception'], 'pending', NULL, now() - interval '37 days', NULL),

    -- ===== Shared / mutual friends (both sides) =====
    (v_event, 'Angela', 'Domingo', NULL, 'both', 'friends', 'guest',
     TRUE, 'Bryan Uy', 'full',
     'angela.domingo@example.ph', '+639201234561', 'beef', NULL,
     ARRAY['ceremony','reception','cocktails'], 'attending', now() - interval '10 days', now() - interval '36 days', 'Mutual friend who introduced the couple.'),
    (v_event, 'Christian', 'Fernandez', NULL, 'both', 'friends', 'guest',
     FALSE, NULL, NULL,
     'christian.fernandez@example.ph', '+639201234562', 'fish', NULL,
     ARRAY['ceremony','reception'], 'attending', now() - interval '9 days', now() - interval '36 days', NULL),
    (v_event, 'Nadine', 'Garcia', NULL, 'both', 'friends', 'guest',
     FALSE, NULL, NULL,
     'nadine.garcia@example.ph', '+639201234563', 'vegetarian', NULL,
     ARRAY['ceremony','reception'], 'pending', NULL, now() - interval '36 days', NULL),
    (v_event, 'Paulo', 'Mendoza', NULL, 'both', 'friends', 'guest',
     FALSE, NULL, NULL,
     'paulo.mendoza@example.ph', '+639201234564', 'beef', NULL,
     ARRAY['ceremony','reception'], 'maybe', now() - interval '6 days', now() - interval '36 days', 'Travelling from Davao; tentative.'),
    (v_event, 'Hannah', 'Torres', NULL, 'both', 'school', 'guest',
     FALSE, NULL, NULL,
     'hannah.torres@example.ph', '+639201234565', 'chicken', NULL,
     ARRAY['ceremony','reception'], 'attending', now() - interval '8 days', now() - interval '35 days', NULL),
    (v_event, 'Jerome', 'Aguilar', NULL, 'both', 'work', 'guest',
     FALSE, NULL, NULL,
     'jerome.aguilar@example.ph', '+639201234566', 'fish', NULL,
     ARRAY['reception'], 'declined', now() - interval '4 days', now() - interval '34 days', 'Cannot attend; sends regards.'),
    (v_event, 'Camille', 'Rivera', NULL, 'both', 'friends', 'guest',
     FALSE, NULL, NULL,
     'camille.rivera@example.ph', '+639201234567', 'chicken', NULL,
     ARRAY['ceremony','reception'], 'pending', NULL, now() - interval '34 days', NULL),
    (v_event, 'Rommel', 'Cabrera', NULL, 'both', 'other', 'guest',
     FALSE, NULL, NULL,
     'rommel.cabrera@example.ph', '+639201234568', 'no_preference', NULL,
     ARRAY['ceremony','reception'], 'attending', now() - interval '7 days', now() - interval '33 days', 'Neighbor / family friend.');

END $$;

-- ============================================================
-- BLOCK 2: guests
-- ============================================================
DO $$
DECLARE
  v_event uuid;
  t_sweet uuid; t_ps1 uuid; t_ps2 uuid; t_famB uuid; t_famG uuid; t_friends uuid; t_entourage uuid;
  g_maria uuid; g_jose uuid;
  g uuid; r RECORD;
BEGIN
  SELECT event_id INTO v_event FROM public.events WHERE slug = 'maria-and-jose';
  IF v_event IS NULL THEN
    RAISE EXCEPTION 'Sample event slug % not found', 'maria-and-jose';
  END IF;

  -- IDEMPOTENT RESET (scoped to this event only). Delete children first.
  DELETE FROM public.event_seat_assignments WHERE event_id = v_event;
  DELETE FROM public.guests                 WHERE event_id = v_event;
  DELETE FROM public.event_tables           WHERE event_id = v_event;

  -- TABLES (normalized x_pos/y_pos in 0..1; garden-reception fan layout)
  INSERT INTO public.event_tables (event_id, table_label, capacity, table_type, x_pos, y_pos, sort_order, rotation_deg)
    VALUES (v_event, 'Sweetheart Table', 2, 'sweetheart_2', 0.500, 0.140, 0, 0) RETURNING table_id INTO t_sweet;
  INSERT INTO public.event_tables (event_id, table_label, capacity, table_type, x_pos, y_pos, sort_order, rotation_deg)
    VALUES (v_event, 'Principal Sponsors 1', 10, 'round_10', 0.300, 0.340, 1, 0) RETURNING table_id INTO t_ps1;
  INSERT INTO public.event_tables (event_id, table_label, capacity, table_type, x_pos, y_pos, sort_order, rotation_deg)
    VALUES (v_event, 'Principal Sponsors 2', 10, 'round_10', 0.700, 0.340, 2, 0) RETURNING table_id INTO t_ps2;
  INSERT INTO public.event_tables (event_id, table_label, capacity, table_type, x_pos, y_pos, sort_order, rotation_deg)
    VALUES (v_event, 'Family of the Bride', 14, 'family_head_14', 0.250, 0.580, 3, 0) RETURNING table_id INTO t_famB;
  INSERT INTO public.event_tables (event_id, table_label, capacity, table_type, x_pos, y_pos, sort_order, rotation_deg)
    VALUES (v_event, 'Family of the Groom', 14, 'family_head_14', 0.750, 0.580, 4, 0) RETURNING table_id INTO t_famG;
  INSERT INTO public.event_tables (event_id, table_label, capacity, table_type, x_pos, y_pos, sort_order, rotation_deg)
    VALUES (v_event, 'Friends — Barkada', 10, 'round_10', 0.380, 0.800, 5, 0) RETURNING table_id INTO t_friends;
  INSERT INTO public.event_tables (event_id, table_label, capacity, table_type, x_pos, y_pos, sort_order, rotation_deg)
    VALUES (v_event, 'Entourage', 10, 'round_10', 0.620, 0.800, 6, 0) RETURNING table_id INTO t_entourage;

  -- COUPLE (seated at Sweetheart Table; seats 0-indexed to match live data)
  INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, role, rsvp_status, rsvp_responded_at)
    VALUES (v_event, 'Maria', 'Santos', 'bride', 'family', 'bride', 'attending', now()) RETURNING guest_id INTO g_maria;
  INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, role, rsvp_status, rsvp_responded_at)
    VALUES (v_event, 'Jose', 'Dela Cruz', 'groom', 'family', 'groom', 'attending', now()) RETURNING guest_id INTO g_jose;
  INSERT INTO public.event_seat_assignments (event_id, table_id, guest_id, seat_number) VALUES (v_event, t_sweet, g_maria, 0);
  INSERT INTO public.event_seat_assignments (event_id, table_id, guest_id, seat_number) VALUES (v_event, t_sweet, g_jose, 1);

  -- REMAINING GUESTS: insert + seat in one pass
  FOR r IN
    SELECT * FROM (VALUES
      ('Eduardo','Reyes','bride','family','principal_sponsor', t_ps1, 0),
      ('Corazon','Reyes','bride','family','principal_sponsor', t_ps1, 1),
      ('Antonio','Bautista','bride','friends','principal_sponsor', t_ps1, 2),
      ('Lourdes','Bautista','bride','friends','principal_sponsor', t_ps1, 3),
      ('Ramon','Aquino','groom','family','principal_sponsor', t_ps2, 0),
      ('Teresita','Aquino','groom','family','principal_sponsor', t_ps2, 1),
      ('Fernando','Villanueva','groom','friends','principal_sponsor', t_ps2, 2),
      ('Imelda','Villanueva','groom','friends','principal_sponsor', t_ps2, 3),
      ('Rosa','Santos','bride','family','guest', t_famB, 0),
      ('Manuel','Santos','bride','family','guest', t_famB, 1),
      ('Angela','Santos','bride','family','guest', t_famB, 2),
      ('Carlo','Santos','bride','family','guest', t_famB, 3),
      ('Divina','Mercado','bride','family','guest', t_famB, 4),
      ('Rodrigo','Dela Cruz','groom','family','guest', t_famG, 0),
      ('Estrella','Dela Cruz','groom','family','guest', t_famG, 1),
      ('Miguel','Dela Cruz','groom','family','guest', t_famG, 2),
      ('Patricia','Dela Cruz','groom','family','guest', t_famG, 3),
      ('Benigno','Garcia','groom','family','guest', t_famG, 4),
      ('Joana','Cruz','bride','friends','guest', t_friends, 0),
      ('Paolo','Mendoza','groom','friends','guest', t_friends, 1),
      ('Bianca','Lim','bride','school','guest', t_friends, 2),
      ('Marco','Tan','groom','school','guest', t_friends, 3),
      ('Andrea','Flores','bride','friends','maid_of_honor', t_entourage, 0),
      ('Daniel','Ramos','groom','friends','best_man', t_entourage, 1),
      ('Sofia','Navarro','bride','friends','bridesmaid', t_entourage, 2),
      ('Gabriel','Castillo','groom','friends','groomsman', t_entourage, 3)
    ) AS x(first_name, last_name, side, grp, role, tbl, seat)
  LOOP
    INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, role, rsvp_status, rsvp_responded_at)
      VALUES (v_event, r.first_name, r.last_name, r.side::guest_side, r.grp::guest_group_category, r.role::guest_role, 'attending', now())
      RETURNING guest_id INTO g;
    INSERT INTO public.event_seat_assignments (event_id, table_id, guest_id, seat_number)
      VALUES (v_event, r.tbl, g, r.seat);
  END LOOP;

  RAISE NOTICE 'Seeded seating for event %: % tables, % guests, % assignments',
    v_event,
    (SELECT count(*) FROM public.event_tables WHERE event_id = v_event),
    (SELECT count(*) FROM public.guests WHERE event_id = v_event),
    (SELECT count(*) FROM public.event_seat_assignments WHERE event_id = v_event);
END $$;

-- ============================================================
-- BLOCK 3: seating
-- ============================================================
DO $$
DECLARE
  v_event uuid;
  v_vendor uuid;
  v_li_main uuid;
BEGIN
  -- 1. Resolve the sample event
  SELECT event_id INTO v_event
  FROM public.events
  WHERE slug = 'maria-and-jose';
  IF v_event IS NULL THEN
    RAISE EXCEPTION 'Sample event maria-and-jose not found';
  END IF;

  -- 2. Idempotent reset: clear this event's prior budget rows (payments
  --    first because event_vendor_payments.line_item_id FKs line items).
  DELETE FROM public.event_vendor_payments WHERE event_id = v_event;
  DELETE FROM public.event_vendor_line_items WHERE event_id = v_event;

  -- Reset all this event's vendors to a clean baseline so re-running does
  -- not accumulate; the vendor-shortlist seed owns the rows, we only stamp
  -- the chosen-per-category headline + status below.
  UPDATE public.event_vendors
  SET total_cost_php = NULL,
      deposit_paid_php = NULL,
      status = 'considering'
  WHERE event_id = v_event;

  -- 3. Overall budget headline on the event (BIGINT centavos).
  --    ~150-pax garden Catholic classic wedding, PHP 930,000 working budget.
  UPDATE public.events
  SET estimated_budget_centavos = 93000000,  -- PHP 930,000.00
      estimated_pax = COALESCE(estimated_pax, 150)
  WHERE event_id = v_event;

  ----------------------------------------------------------------------------
  -- Per category: resolve the chosen vendor by (event_id, category,
  -- vendor_name), stamp headline total + status, then insert itemized lines.
  -- event_vendor_line_items.amount_php is NUMERIC PESOS (not centavos).
  ----------------------------------------------------------------------------

  -- CATERING -- Hain Catering -- PHP 225,000 (deposit_paid)
  SELECT vendor_id INTO v_vendor FROM public.event_vendors
   WHERE event_id = v_event AND category = 'catering' AND vendor_name = 'Hain Catering';
  IF v_vendor IS NOT NULL THEN
    UPDATE public.event_vendors
      SET total_cost_php = 225000, deposit_paid_php = 67500, status = 'deposit_paid'
      WHERE vendor_id = v_vendor;
    INSERT INTO public.event_vendor_line_items (event_id, vendor_id, label, amount_php, due_date, sort_order)
    VALUES (v_event, v_vendor, 'Plated dinner — 150 pax', 200000, DATE '2026-11-12', 0)
    RETURNING line_item_id INTO v_li_main;
    INSERT INTO public.event_vendor_line_items (event_id, vendor_id, label, amount_php, due_date, sort_order)
    VALUES (v_event, v_vendor, 'Service charge & rentals', 25000, DATE '2026-11-12', 1);
    INSERT INTO public.event_vendor_payments (event_id, vendor_id, line_item_id, amount_php, paid_at, method, reference, notes)
    VALUES (v_event, v_vendor, v_li_main, 67500, DATE '2026-06-01', 'GCash', 'HAIN-RES-0612', 'Reservation deposit (30%)');
  END IF;

  -- PHOTOGRAPHER -- Habi Photo Co. -- PHP 80,000 (deposit_paid)
  SELECT vendor_id INTO v_vendor FROM public.event_vendors
   WHERE event_id = v_event AND category = 'photographer' AND vendor_name = 'Habi Photo Co.';
  IF v_vendor IS NOT NULL THEN
    UPDATE public.event_vendors
      SET total_cost_php = 80000, deposit_paid_php = 24000, status = 'deposit_paid'
      WHERE vendor_id = v_vendor;
    INSERT INTO public.event_vendor_line_items (event_id, vendor_id, label, amount_php, due_date, sort_order)
    VALUES (v_event, v_vendor, 'Whole-day photo coverage', 65000, DATE '2026-11-12', 0)
    RETURNING line_item_id INTO v_li_main;
    INSERT INTO public.event_vendor_line_items (event_id, vendor_id, label, amount_php, due_date, sort_order)
    VALUES (v_event, v_vendor, 'Engagement / pre-nup shoot', 15000, DATE '2026-09-15', 1);
    INSERT INTO public.event_vendor_payments (event_id, vendor_id, line_item_id, amount_php, paid_at, method, reference, notes)
    VALUES (v_event, v_vendor, v_li_main, 24000, DATE '2026-06-05', 'Bank Transfer', 'HABI-DP-001', 'Booking retainer (30%)');
  END IF;

  -- VIDEOGRAPHER -- Alon Films -- PHP 95,000 (contracted)
  SELECT vendor_id INTO v_vendor FROM public.event_vendors
   WHERE event_id = v_event AND category = 'videographer' AND vendor_name = 'Alon Films';
  IF v_vendor IS NOT NULL THEN
    UPDATE public.event_vendors
      SET total_cost_php = 95000, status = 'contracted'
      WHERE vendor_id = v_vendor;
    INSERT INTO public.event_vendor_line_items (event_id, vendor_id, label, amount_php, due_date, sort_order)
    VALUES (v_event, v_vendor, 'Cinematic wedding film', 70000, DATE '2026-11-20', 0);
    INSERT INTO public.event_vendor_line_items (event_id, vendor_id, label, amount_php, due_date, sort_order)
    VALUES (v_event, v_vendor, 'Same-day edit (SDE)', 25000, DATE '2026-11-20', 1);
  END IF;

  -- PLANNER / COORDINATOR -- Araw Planners -- PHP 80,000 (deposit_paid)
  SELECT vendor_id INTO v_vendor FROM public.event_vendors
   WHERE event_id = v_event AND category = 'planner_coordinator' AND vendor_name = 'Araw Planners';
  IF v_vendor IS NOT NULL THEN
    UPDATE public.event_vendors
      SET total_cost_php = 80000, deposit_paid_php = 20000, status = 'deposit_paid'
      WHERE vendor_id = v_vendor;
    INSERT INTO public.event_vendor_line_items (event_id, vendor_id, label, amount_php, due_date, sort_order)
    VALUES (v_event, v_vendor, 'Full planning & coordination', 60000, DATE '2026-10-12', 0)
    RETURNING line_item_id INTO v_li_main;
    INSERT INTO public.event_vendor_line_items (event_id, vendor_id, label, amount_php, due_date, sort_order)
    VALUES (v_event, v_vendor, 'On-the-day coordination team', 20000, DATE '2026-12-01', 1);
    INSERT INTO public.event_vendor_payments (event_id, vendor_id, line_item_id, amount_php, paid_at, method, reference, notes)
    VALUES (v_event, v_vendor, v_li_main, 20000, DATE '2026-05-28', 'GCash', 'ARAW-DP-77', 'Signing deposit');
  END IF;

  -- FLORIST -- Bulaklak & Co. -- PHP 78,000 (contracted)
  SELECT vendor_id INTO v_vendor FROM public.event_vendors
   WHERE event_id = v_event AND category = 'florist' AND vendor_name = 'Bulaklak & Co.';
  IF v_vendor IS NOT NULL THEN
    UPDATE public.event_vendors
      SET total_cost_php = 78000, status = 'contracted'
      WHERE vendor_id = v_vendor;
    INSERT INTO public.event_vendor_line_items (event_id, vendor_id, label, amount_php, due_date, sort_order)
    VALUES (v_event, v_vendor, 'Ceremony & reception florals', 70000, DATE '2026-11-25', 0);
    INSERT INTO public.event_vendor_line_items (event_id, vendor_id, label, amount_php, due_date, sort_order)
    VALUES (v_event, v_vendor, 'Bridal bouquet & entourage', 8000, DATE '2026-11-25', 1);
  END IF;

  -- BAND / DJ -- DJ Indak -- PHP 35,000 (contracted)
  SELECT vendor_id INTO v_vendor FROM public.event_vendors
   WHERE event_id = v_event AND category = 'band_dj' AND vendor_name = 'DJ Indak';
  IF v_vendor IS NOT NULL THEN
    UPDATE public.event_vendors
      SET total_cost_php = 35000, status = 'contracted'
      WHERE vendor_id = v_vendor;
    INSERT INTO public.event_vendor_line_items (event_id, vendor_id, label, amount_php, due_date, sort_order)
    VALUES (v_event, v_vendor, 'Reception DJ & dance set', 35000, DATE '2026-12-01', 0);
  END IF;

  -- CAKE MAKER -- Matamis Bakeshop -- PHP 30,000 (contracted)
  SELECT vendor_id INTO v_vendor FROM public.event_vendors
   WHERE event_id = v_event AND category = 'cake_maker' AND vendor_name = 'Matamis Bakeshop';
  IF v_vendor IS NOT NULL THEN
    UPDATE public.event_vendors
      SET total_cost_php = 30000, status = 'contracted'
      WHERE vendor_id = v_vendor;
    INSERT INTO public.event_vendor_line_items (event_id, vendor_id, label, amount_php, due_date, sort_order)
    VALUES (v_event, v_vendor, '4-tier wedding cake', 18000, DATE '2026-12-05', 0);
    INSERT INTO public.event_vendor_line_items (event_id, vendor_id, label, amount_php, due_date, sort_order)
    VALUES (v_event, v_vendor, 'Dessert / kakanin table', 12000, DATE '2026-12-05', 1);
  END IF;

  -- HAIR STYLIST -- Buhok Bridal Hair -- PHP 35,000 (contracted)
  SELECT vendor_id INTO v_vendor FROM public.event_vendors
   WHERE event_id = v_event AND category = 'hair_stylist' AND vendor_name = 'Buhok Bridal Hair';
  IF v_vendor IS NOT NULL THEN
    UPDATE public.event_vendors
      SET total_cost_php = 35000, status = 'contracted'
      WHERE vendor_id = v_vendor;
    INSERT INTO public.event_vendor_line_items (event_id, vendor_id, label, amount_php, due_date, sort_order)
    VALUES (v_event, v_vendor, 'Bridal & entourage hair / makeup', 35000, DATE '2026-12-12', 0);
  END IF;

  -- HOST / EMCEE -- Kuya Mike Events -- PHP 25,000 (contracted)
  SELECT vendor_id INTO v_vendor FROM public.event_vendors
   WHERE event_id = v_event AND category = 'host_emcee' AND vendor_name = 'Kuya Mike Events';
  IF v_vendor IS NOT NULL THEN
    UPDATE public.event_vendors
      SET total_cost_php = 25000, status = 'contracted'
      WHERE vendor_id = v_vendor;
    INSERT INTO public.event_vendor_line_items (event_id, vendor_id, label, amount_php, due_date, sort_order)
    VALUES (v_event, v_vendor, 'Reception program hosting', 25000, DATE '2026-12-12', 0);
  END IF;

  -- LIGHTS & SOUND -- Ilaw Productions -- PHP 60,000 (contracted)
  SELECT vendor_id INTO v_vendor FROM public.event_vendors
   WHERE event_id = v_event AND category = 'lights_and_sound' AND vendor_name = 'Ilaw Productions';
  IF v_vendor IS NOT NULL THEN
    UPDATE public.event_vendors
      SET total_cost_php = 60000, status = 'contracted'
      WHERE vendor_id = v_vendor;
    INSERT INTO public.event_vendor_line_items (event_id, vendor_id, label, amount_php, due_date, sort_order)
    VALUES (v_event, v_vendor, 'Lights, sound & staging package', 60000, DATE '2026-11-28', 0);
  END IF;

  -- MOBILE BAR -- Barkada Bar -- PHP 45,000 (contracted)
  SELECT vendor_id INTO v_vendor FROM public.event_vendors
   WHERE event_id = v_event AND category = 'mobile_bar' AND vendor_name = 'Barkada Bar';
  IF v_vendor IS NOT NULL THEN
    UPDATE public.event_vendors
      SET total_cost_php = 45000, status = 'contracted'
      WHERE vendor_id = v_vendor;
    INSERT INTO public.event_vendor_line_items (event_id, vendor_id, label, amount_php, due_date, sort_order)
    VALUES (v_event, v_vendor, 'Open bar — 4 hours', 45000, DATE '2026-12-01', 0);
  END IF;

  -- PHOTOBOOTH -- Kuha Booth -- PHP 22,000 (contracted)
  SELECT vendor_id INTO v_vendor FROM public.event_vendors
   WHERE event_id = v_event AND category = 'photobooth' AND vendor_name = 'Kuha Booth';
  IF v_vendor IS NOT NULL THEN
    UPDATE public.event_vendors
      SET total_cost_php = 22000, status = 'contracted'
      WHERE vendor_id = v_vendor;
    INSERT INTO public.event_vendor_line_items (event_id, vendor_id, label, amount_php, due_date, sort_order)
    VALUES (v_event, v_vendor, '4-hour booth + unlimited prints', 22000, DATE '2026-12-01', 0);
  END IF;

END $$;

-- ============================================================
-- BLOCK 4: budget
-- ============================================================
DO $$
DECLARE
  v_event uuid;
  v_user  uuid;
  v_pal_alabaster char(7) := '#FBFBFA';
  v_pal_gold      char(7) := '#C5A059';
  v_pal_sage      char(7) := '#9CA98B';
  v_pal_blush     char(7) := '#C9A9A6';
  v_pal_obsidian  char(7) := '#1E2229';
  v_pal_sand      char(7) := '#D8C7B0';
BEGIN
  -- 1) Resolve the sample event once.
  SELECT event_id INTO v_event
  FROM public.events
  WHERE slug = 'maria-and-jose'
  LIMIT 1;

  IF v_event IS NULL THEN
    RAISE EXCEPTION 'Sample event with slug % not found', 'maria-and-jose';
  END IF;

  -- Resolve a host user to own the inspiration rows (NOT NULL FK -> users.user_id).
  -- Prefer the event's couple host; fall back to any member; final fallback any user.
  SELECT user_id INTO v_user
  FROM public.event_members
  WHERE event_id = v_event AND role = 'host'
  ORDER BY joined_at
  LIMIT 1;

  IF v_user IS NULL THEN
    SELECT user_id INTO v_user
    FROM public.event_members
    WHERE event_id = v_event
    ORDER BY joined_at
    LIMIT 1;
  END IF;

  IF v_user IS NULL THEN
    SELECT user_id INTO v_user FROM public.users ORDER BY created_at LIMIT 1;
  END IF;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No user available to own inspiration assets for event %', v_event;
  END IF;

  -- 2) PALETTE: write the ~6-colour mood-board palette onto events.role_palette
  --    (canonical palette store; shape mirrors a real populated event).
  --    Garden / catholic / classic Filipino feel:
  --    Alabaster, Champagne Gold, Sage, Blush, Obsidian, Warm Sand.
  --    mood_feel_key is CHECK-constrained to
  --    {timeless,modern,boho,rustic,glam,royalty,filipiniana,others};
  --    'timeless' = the elegant/simple/classic direction.
  UPDATE public.events
  SET role_palette = jsonb_build_object(
        'ceremony',           jsonb_build_array(v_pal_alabaster, v_pal_gold, v_pal_sage),
        'reception',          jsonb_build_array(v_pal_alabaster, v_pal_gold, v_pal_sage, v_pal_blush, v_pal_sand),
        'bride',              jsonb_build_array(v_pal_alabaster, v_pal_gold),
        'groom',              jsonb_build_array(v_pal_obsidian, v_pal_gold),
        'principal_sponsors', jsonb_build_array(v_pal_gold, v_pal_obsidian),
        'secondary_sponsors', jsonb_build_array(v_pal_sage, v_pal_gold),
        'wedding_party',      jsonb_build_array(v_pal_sage, v_pal_blush, v_pal_gold),
        'bearers_flower_girl',jsonb_build_array(v_pal_alabaster, v_pal_sage),
        'officiants',         jsonb_build_array(v_pal_alabaster, v_pal_gold),
        'guest',              jsonb_build_array(v_pal_alabaster, v_pal_gold, v_pal_sage, v_pal_blush)
      ),
      palette_finalized_at   = COALESCE(palette_finalized_at, now()),
      mood_board_updated_at  = now(),
      mood_feel_key          = COALESCE(mood_feel_key, 'timeless')
  WHERE event_id = v_event;

  -- 3) INSPIRATION ITEMS / NOTES: reset this event's rows (idempotent), then insert.
  DELETE FROM public.event_inspiration_assets WHERE event_id = v_event;

  INSERT INTO public.event_inspiration_assets
    (event_id, added_by_user_id, source_kind, image_url, caption,
     sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6,
     slot_key, slot_position, created_at)
  VALUES
    -- Overall mood: garden-classic Filipino direction
    (v_event, v_user, 'url_paste',
     'https://images.unsplash.com/photo-1519225421980-715cb0215aed',
     'Garden estate at golden hour — soft alabaster florals with champagne and sage. Our overall feel: elegant, simple, classic.',
     v_pal_alabaster, v_pal_gold, v_pal_sage, v_pal_blush, v_pal_obsidian, v_pal_sand,
     'overall', 1, now()),

    -- Venue / location feel: garden ceremony aisle
    (v_event, v_user, 'url_paste',
     'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3',
     'Open-air garden aisle under the trees — lush greenery, white blooms, dappled light.',
     v_pal_sage, v_pal_alabaster, v_pal_gold, v_pal_sand, v_pal_blush, v_pal_obsidian,
     'venue', 1, now()),

    -- Ceremony detail: Catholic church interior
    (v_event, v_user, 'url_paste',
     'https://images.unsplash.com/photo-1438032005730-c779502df39b',
     'Catholic church ceremony — warm stone, candlelight, and gold accents for the nuptial Mass.',
     v_pal_sand, v_pal_gold, v_pal_alabaster, v_pal_obsidian, v_pal_blush, v_pal_sage,
     'ceiling', 1, now()),

    -- Reception table styling
    (v_event, v_user, 'url_paste',
     'https://images.unsplash.com/photo-1530103862676-de8c9debad1d',
     'Long banquet tables — alabaster linen, champagne taper candles, sage and blush garden florals.',
     v_pal_alabaster, v_pal_gold, v_pal_sage, v_pal_blush, v_pal_sand, v_pal_obsidian,
     'table', 1, now()),

    -- Palette reference swatch
    (v_event, v_user, 'url_paste',
     'https://images.unsplash.com/photo-1490750967868-88aa4486c946',
     'Our colour story: Alabaster, Champagne Gold, Sage, Blush, Warm Sand, with Obsidian for the groom.',
     v_pal_alabaster, v_pal_gold, v_pal_sage, v_pal_blush, v_pal_sand, v_pal_obsidian,
     'palette', 1, now()),

    -- Bride attire direction
    (v_event, v_user, 'url_paste',
     'https://images.unsplash.com/photo-1525258946800-98cfd641d0de',
     'Maria''s look — ivory classic gown, champagne-gold embroidery, soft garden bouquet.',
     v_pal_alabaster, v_pal_gold, v_pal_sand, v_pal_blush, v_pal_sage, v_pal_obsidian,
     'bride', 1, now()),

    -- Groom attire direction
    (v_event, v_user, 'url_paste',
     'https://images.unsplash.com/photo-1521119989659-a83eee488004',
     'Jose''s look — deep obsidian barong-inspired formalwear with a gold lapel accent.',
     v_pal_obsidian, v_pal_gold, v_pal_alabaster, v_pal_sand, v_pal_sage, v_pal_blush,
     'groom', 1, now());

END $$;

-- ============================================================
-- BLOCK 5: moodboard
-- ============================================================
DO $$
DECLARE
  v_event   uuid;
  v_seat    uuid;
  v_seat_idx int := 990;                          -- high sentinel index, unlikely to collide with real seats
  v_qr_token text := 'SAMPLE-PAPIC-MARIA-JOSE-SEAT01';  -- sentinel claim token used for idempotent re-runs
  v_base    timestamptz := timestamptz '2026-12-12 15:30:00+08';  -- wedding day, Asia/Manila
  rec       record;
  v_photo   uuid;
  v_tagged  int := 0;
BEGIN
  -- 1. Resolve the sample event (fail loudly if the slug is missing)
  SELECT event_id INTO v_event
  FROM public.events
  WHERE slug = 'maria-and-jose';

  IF v_event IS NULL THEN
    RAISE EXCEPTION 'Sample event with slug % not found', 'maria-and-jose';
  END IF;

  -- 2. Idempotent teardown of THIS event's prior sample rows (children first).
  --    photo_tags has no direct FK to the photo row, so clear this event's
  --    papic_photos-sourced tags whose source_id points at our sample photos.
  DELETE FROM public.photo_tags pt
  USING public.papic_photos pp
  WHERE pt.event_id = v_event
    AND pt.source_table = 'papic_photos'
    AND pt.source_id = pp.photo_id
    AND pp.event_id = v_event
    AND pp.r2_object_key LIKE 'sample/papic/maria-jose/%';

  DELETE FROM public.papic_photos
  WHERE event_id = v_event
    AND r2_object_key LIKE 'sample/papic/maria-jose/%';

  -- Remove any prior sample seat for this event (by sentinel token), which
  -- ON DELETE CASCADE would also wipe its photos -- done above already, but
  -- delete the seat itself so we re-create it cleanly.
  DELETE FROM public.paparazzi_seats
  WHERE event_id = v_event
    AND claim_qr_token = v_qr_token;

  -- 3. Create the placeholder paparazzi seat that owns the sample photos.
  --    papic_photos.paparazzi_seat_id is NOT NULL with an FK to this table.
  INSERT INTO public.paparazzi_seats
    (event_id, seat_index, sku_code, claim_qr_token, is_free_sampler, claimed_at)
  VALUES
    (v_event, v_seat_idx, 'papic_seat_5', v_qr_token, TRUE, v_base)
  RETURNING seat_id INTO v_seat;

  -- 4. Insert ~8 placeholder gallery photos. Clearly-placeholder R2 keys.
  --    moderation_state='clean' so they surface in the gallery; photo_type='photo'.
  FOR rec IN
    SELECT * FROM (VALUES
      (1, 'sample/papic/maria-jose/01.jpg', 'Garden ceremony aisle walk',        1600, 2400),
      (2, 'sample/papic/maria-jose/02.jpg', 'First look under the arbor',         2400, 1600),
      (3, 'sample/papic/maria-jose/03.jpg', 'Maria and Jose exchanging vows',     1600, 2400),
      (4, 'sample/papic/maria-jose/04.jpg', 'Ring exchange close-up',             2400, 1600),
      (5, 'sample/papic/maria-jose/05.jpg', 'Confetti recessional',              2400, 1600),
      (6, 'sample/papic/maria-jose/06.jpg', 'Family portrait by the fountain',    2400, 1600),
      (7, 'sample/papic/maria-jose/07.jpg', 'Reception toast under string lights',1600, 2400),
      (8, 'sample/papic/maria-jose/08.jpg', 'First dance candids',                2400, 1600)
    ) AS t(seq, key, caption, w, h)
  LOOP
    INSERT INTO public.papic_photos
      (event_id, paparazzi_seat_id, r2_object_key, photo_type, mime_type,
       width_px, height_px, captured_at, device_model, moderation_state, created_at)
    VALUES
      (v_event, v_seat, rec.key, 'photo', 'image/jpeg',
       rec.w, rec.h,
       v_base + (rec.seq * interval '4 minutes'),
       'Sample Device (placeholder)', 'clean',
       v_base + (rec.seq * interval '4 minutes'))
    RETURNING photo_id INTO v_photo;

    -- 5. Tag the first two sample photos to the first guest (manual_pick)
    --    ONLY if guests exist for this event, respecting the
    --    UNIQUE (source_table, source_id, guest_id) constraint.
    IF rec.seq IN (1, 2) THEN
      INSERT INTO public.photo_tags
        (event_id, source_table, source_id, guest_id, source, created_at)
      SELECT v_event, 'papic_photos', v_photo, g.guest_id, 'manual_pick',
             v_base + (rec.seq * interval '4 minutes')
      FROM public.guests g
      WHERE g.event_id = v_event
      ORDER BY g.id
      LIMIT 1
      ON CONFLICT (source_table, source_id, guest_id) DO NOTHING;

      GET DIAGNOSTICS v_tagged = ROW_COUNT;
    END IF;
  END LOOP;

  RAISE NOTICE 'Seeded sample Papic gallery for event % (seat %).', v_event, v_seat;
END $$;
