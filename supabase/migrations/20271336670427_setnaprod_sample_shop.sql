-- SETNAPROD BECOMES THE PUBLIC SAMPLE SHOP — filled so a supplier sees what a full shop looks like.
--
-- Owner, 2026-11-10 (DECISION_LOG 🏪): *"we want to show that setnaprod is a sample shop also so suppliers can see
-- what it looks like to have a shop like setnaprod"* · *"supply sample data for setnaprod so i see what it looks like,
-- add photos, service cards, inspiration photos"* · *"add reviews about setnaprod as well"* (plan
-- `plans/supplier_build_5_2026-11-10/00-BUILD-5-PLAN.md`, Lane H items "Fill SetnaProd as a full sample shop" and
-- "SetnaProd = the public SAMPLE shop").
--
-- 🔒 SCOPE — ONE SHOP. Found by its slug AND its public id together (`setnaprod` · `S89B-RJ7TT7BWWQ`, the owner's own
-- test shop). Every write below is keyed on that one vendor_profile_id; no other shop, event or account is read or
-- written (cale-ice included). If the shop is not there (a fresh PGlite replay, a branch DB) this is a NOTICE and a
-- no-op. Its three service cards are found by their public ids inside this shop; a missing card is skipped.
--
-- 🔁 IDEMPOTENT. Profile fields are set only while still empty (a later edit by the owner is never overwritten);
-- inclusions are added only to a card that has none; review and inspiration rows carry fixed ids (md5 of a fixed
-- name) and use ON CONFLICT DO NOTHING; a card's photos are set only while it has no cover.
--
-- 🏷 WHAT MAKES IT A SAMPLE — no new column (Rule 0 · 3): `vendor_profiles.is_demo` already means "not a real
-- supplier". With it the shop page wears the shipped "(DEMO ONLY)" marker + its ⓘ ("It can't be booked, and its
-- photos are illustrations"), is noindex and out of the sitemap, every review on it reads "Sample couple" under a
-- "Sample review" chip (app/v/[slug]/page.tsx `ReviewRow`), its looks are withheld from couples' mood-board gallery
-- (lib/moodboard-gallery.ts `shapeGalleryPage`), and `refuse_demo_cross_booking` (20271316355263) refuses any NEW
-- booking, chat, proposal or order between it and a real event. The one old "considering" row on the owner's own
-- test event is not re-judged (that trigger leaves an unchanged pairing alone).
--
-- 🖼 PHOTOS — files ALREADY IN THE REPO (no new stock, no R2 upload: a migration cannot reach R2). Stored as SITE
-- PATHS (`/onboarding/refinements/…`), which both resolvers pass through (`publicAssetTarget` learned the site path in
-- this PR; `parseStoredAsset` / `galleryImageUrl` already did). When the owner's Higgsfield SetnaProd set lands
-- (plans/HIGGSFIELD_HAVE_NEED_2026-11-10.md "Demo shop · SetnaProd · photo 01–06"), swap them through the app.
--
-- ⭐ REVIEWS — SAMPLE reviews, no event and no couple (both columns are nullable). `stamp_review_provenance` leaves a
-- row with no event alone, so `booked_through_setnayan` / `via_vendor_import` stay FALSE: the trusted headline
-- (receipt-backed) does NOT count them — the shop still reads "New to Setnayan" — and no "Verified" pill is drawn.
--
-- 💰 PRICES — untouched. The three cards keep the prices the controller typed through the app on 9–10 Nov (sample
-- prices; the owner may change them). Nothing here is ever charged (a demo shop cannot be booked).
--
-- No DDL, so there is no ALTER-before-UPDATE ordering to keep (20271336539756's 55006 lesson).

DO $$
DECLARE
  v_shop   uuid;
  v_owner  uuid;
  v_booth  uuid;
  v_roving uuid;
  v_bar    uuid;
  v_now    timestamptz := now();
  r        record;
BEGIN
  SELECT vp.vendor_profile_id, vp.user_id
    INTO v_shop, v_owner
    FROM public.vendor_profiles vp
   WHERE vp.business_slug = 'setnaprod'
     AND vp.public_id = 'S89B-RJ7TT7BWWQ';

  IF v_shop IS NULL THEN
    RAISE NOTICE 'setnaprod_sample_shop: SetnaProd is not present — nothing to do';
    RETURN;
  END IF;

  /* ── 1 · THE SHOP: a sample, with its words and its page photos ─────────────────────────────────────────────── */
  UPDATE public.vendor_profiles
     SET is_demo = TRUE,
         tagline = COALESCE(NULLIF(btrim(tagline), ''),
           'Photo booths, a roving photoman and a mobile bar — a sample shop'),
         microsite_about = COALESCE(NULLIF(btrim(microsite_about), ''),
           'SetnaProd is Setnayan''s sample shop. It shows what a full shop looks like: service cards with their photos '
           || 'and what each one includes, a portfolio, the looks we style, and what couples say. Everything here is an '
           || 'illustration — it cannot be booked. Your own shop fills the same places with your work.'),
         location_city = COALESCE(NULLIF(btrim(location_city), ''), 'Quezon City'),
         portfolio_r2_keys = CASE
           WHEN COALESCE(cardinality(portfolio_r2_keys), 0) = 0 THEN ARRAY[
             '/onboarding/refinements/photo_booth/360-booth.webp',
             '/onboarding/refinements/mobile_bar/full-cocktail.webp',
             '/onboarding/refinements/photo_booth/magic-mirror.webp',
             '/onboarding/refinements/mobile_bar/champagne-tower.webp',
             '/onboarding/refinements/photo_booth/polaroid-instax.webp',
             '/onboarding/refinements/photo_booth/glam-booth.webp',
             '/onboarding/refinements/mobile_bar/gin-bar.webp',
             '/onboarding/refinements/photo_booth/_main.webp'
           ]::text[]
           ELSE portfolio_r2_keys
         END
   WHERE vendor_profile_id = v_shop;

  /* ── 2 · THE CARDS: covers, photos, what is included — then live ────────────────────────────────────────────── */
  SELECT vendor_service_id INTO v_booth  FROM public.vendor_services WHERE vendor_profile_id = v_shop AND public_id = 'S89S-59BZ88PX4R';
  SELECT vendor_service_id INTO v_roving FROM public.vendor_services WHERE vendor_profile_id = v_shop AND public_id = 'S89S-2KHH8T6JT5';
  SELECT vendor_service_id INTO v_bar    FROM public.vendor_services WHERE vendor_profile_id = v_shop AND public_id = 'S89S-HMPNEQ1K3D';

  FOR r IN
    SELECT * FROM (VALUES
      (v_booth,
       '/onboarding/refinements/photo_booth/traditional.webp',
       ARRAY['/onboarding/refinements/photo_booth/_main.webp',
             '/onboarding/refinements/photo_booth/magic-mirror.webp',
             '/onboarding/refinements/photo_booth/polaroid-instax.webp',
             '/onboarding/refinements/photo_booth/glam-booth.webp']::text[],
       ARRAY['3 hours of unlimited sessions', 'Unlimited 4R prints with your monogram',
             'Props table and backdrop', 'Online gallery the next day']::text[]),
      (v_roving,
       '/onboarding/refinements/photo_booth/flipbook.webp',
       ARRAY['/onboarding/refinements/photo_booth/polaroid-instax.webp',
             '/onboarding/refinements/photo_video/_main.webp',
             '/onboarding/refinements/photo_booth/360-booth.webp']::text[],
       ARRAY['A photographer who roams your tables', 'Prints handed out on the spot',
             'Up to 300 instant prints', 'Every shot in an online gallery']::text[]),
      (v_bar,
       '/onboarding/refinements/mobile_bar/full-cocktail.webp',
       ARRAY['/onboarding/refinements/mobile_bar/_main.webp',
             '/onboarding/refinements/mobile_bar/champagne-tower.webp',
             '/onboarding/refinements/mobile_bar/espresso-martini.webp',
             '/onboarding/refinements/mobile_bar/mocktail-only.webp']::text[],
       ARRAY['Two bartenders for 4 hours', 'Four signature cocktails and mocktails',
             'Bar counter, glassware and ice', 'Champagne toast for the couple']::text[])
    ) AS t(card, cover, gallery, lines)
  LOOP
    CONTINUE WHEN r.card IS NULL;

    -- What the price gets them — only on a card that lists nothing yet.
    IF NOT EXISTS (SELECT 1 FROM public.vendor_service_inclusions WHERE vendor_service_id = r.card) THEN
      INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label, sort_order)
      SELECT r.card, v_shop, l.label, l.ord::int
        FROM unnest(r.lines) WITH ORDINALITY AS l(label, ord);
    END IF;

    -- Photos only while the card has no cover (the owner's own upload is never replaced).
    UPDATE public.vendor_services
       SET primary_photo_r2_key   = r.cover,
           showcase_photo_r2_keys = r.gallery
     WHERE vendor_service_id = r.card
       AND vendor_profile_id = v_shop
       AND NULLIF(btrim(COALESCE(primary_photo_r2_key, '')), '') IS NULL;

    -- Live, now that it has a cover, a price and what is included (enforce_service_publish_gate*).
    UPDATE public.vendor_services
       SET is_active = TRUE
     WHERE vendor_service_id = r.card
       AND vendor_profile_id = v_shop
       AND is_active IS NOT TRUE
       AND taken_down_at IS NULL
       AND plan_hold IS NULL
       AND starting_price_php > 0;
  END LOOP;

  /* ── 3 · INSPIRATION: the looks this shop styles (only for parts that exist) ───────────────────────────────── */
  INSERT INTO public.moodboard_library_assets (
    asset_id, asset_type, asset_subtype, label, storage_path, source, uploaded_by, vendor_profile_id,
    vendor_service_id, approved_at, rights_warranted_at, rights_warranty_version
  )
  SELECT md5('setnaprod-sample-look-' || l.slot)::uuid, 'supplier_gallery', l.slot, l.label, l.path,
         'internet_placeholder', v_owner, v_shop, l.card, v_now, v_now, 'gallery-rights-v1-2026-09-04'
    FROM (VALUES
      ('booth_backdrop',      'Floral arch booth with a ring light',  '/onboarding/refinements/photo_booth/_main.webp',        v_booth),
      ('polaroid_guestbook',  'Instax guest book on the welcome table', '/onboarding/refinements/photo_booth/polaroid-instax.webp', v_roving),
      ('photo_wall',          'Gold mirror selfie corner',            '/onboarding/refinements/photo_booth/magic-mirror.webp', v_booth),
      ('signature_cocktails', 'Espresso martinis for the after-party', '/onboarding/refinements/mobile_bar/espresso-martini.webp', v_bar),
      ('champagne_tower',     'Champagne tower for the toast',        '/onboarding/refinements/mobile_bar/champagne-tower.webp', v_bar),
      ('bar_counter',         'Garden gin cart with fresh citrus',    '/onboarding/refinements/mobile_bar/gin-bar.webp',       v_bar)
    ) AS l(slot, label, path, card)
   WHERE EXISTS (SELECT 1 FROM public.inspiration_parts p WHERE p.slot_key = l.slot)
  ON CONFLICT (asset_id) DO NOTHING;

  /* ── 4 · SAMPLE REVIEWS: no event, no couple — shown only as "Sample review" on a demo shop ──────────────────── */
  INSERT INTO public.vendor_reviews (
    review_id, vendor_profile_id, service_id, event_id, couple_user_id,
    rating_overall, rating_communication, rating_quality, rating_value, rating_on_time,
    body, reviewer_display, created_at, updated_at
  )
  SELECT md5('setnaprod-sample-review-' || v.n)::uuid, v_shop, v.card, NULL, NULL,
         v.o, v.c, v.q, v.va, v.t, v.body, 'initials', v_now - make_interval(days => v.ago), v_now - make_interval(days => v.ago)
    FROM (VALUES
      (1, v_booth, 5, 5, 5, 5, 5, 41,
       'The booth was the busiest corner of the reception. Prints came out fast and the props were a hit with the titas.'),
      (2, v_roving, 5, 5, 4, 5, 5, 26,
       'Our guests loved getting a print at their table. We did not have to ask anyone to line up anywhere.'),
      (3, v_bar, 4, 5, 4, 4, 5, 12,
       'The calamansi cocktail was everyone''s favourite. Set up early and packed up clean.')
    ) AS v(n, card, o, c, q, va, t, ago, body)
  ON CONFLICT (review_id) DO NOTHING;

  RAISE NOTICE 'setnaprod_sample_shop: SetnaProd (%) filled as the sample shop', v_shop;
END;
$$;
