-- ============================================================================
-- 20260607000000_seed_vendor_reviews.sql
--
-- TEST DATA — populates vendor_reviews + supporting events so the public
-- marketplace `/vendors` cards + per-vendor `/v/[slug]` pages show realistic
-- review counts, average ratings, and review-body copy.
--
-- Owner directive 2026-05-22 (CLAUDE.md decision log forthcoming):
--   "populate the reviews of the vendor, and their services."
--
-- Co-dispatched alongside two sibling PRs:
--   (a) vendor card + badges redesign on /vendors — reads avg_rating_overall
--       and review_count from `vendor_market_stats` view, which LEFT JOINs
--       `vendor_review_stats` (the materialized view this seed flows into).
--   (b) Top Nav + Bottom Nav → Side Nav on desktop — independent.
--
-- WHAT THIS SEED CREATES
-- ----------------------
-- 1. ~50 anonymized fictional `events` rows with display_name like
--    "Maria & Juan" / "Charisse & Mark" — `display_name LIKE 'TEST-REVIEW · %'`
--    so they're easy to find + retire. event_date spread across last
--    18 months. is_primary = FALSE, archived = TRUE so they don't pollute
--    any host's dashboard (no event_members rows reference them anyway —
--    they exist purely as FK targets for the `event_id` column on
--    `vendor_reviews`).
-- 2. ~500-800 reviews seeded against the ~960 verified test vendors created
--    by `20260601000000_marketplace_test_seed_960_vendors.sql`. Distribution
--    follows the directive — ~70% of vendors get 1-5 reviews, ~30% remain
--    reviewless (realistic for a curated new marketplace).
-- 3. Rating skew per directive: 60% 5-star · 25% 4-star · 10% 3-star ·
--    4% 2-star · 1% 1-star. Five rating axes per row (overall, communication,
--    quality, value, on_time) — generally clustered around overall but with
--    ±1 variance so they read like real human input.
-- 4. ~80 distinct body copy variants in Filipino-couple voice (EN-primary
--    with light Taglish touches). ~10% of reviews have NULL body (rated only,
--    no write). ~25% have a `vendor_reply` populated.
-- 5. `created_at` spread across last 12 months with weighted recency (more
--    recent reviews than older).
--
-- WHY couple_user_id IS NULL ON EVERY SEEDED ROW
-- ----------------------------------------------
-- The `block_related_account_review` BEFORE INSERT trigger
-- (20260515030000_self_review_gate.sql) checks 5 signals against the vendor's
-- owner. Test vendors created by the 960-vendor seed all have user_id = NULL
-- (per 20260528000000_admin_owned_unclaimed_vendor_profiles.sql which relaxed
-- the column), so:
--   - `v_owner_id` resolves to NULL in the trigger
--   - The owner_self check `NEW.couple_user_id = v_owner_id` evaluates to
--     NULL (never TRUE) — passes
--   - All other checks short-circuit on `IF NEW.couple_user_id IS NOT NULL`
-- Result: NULL couple_user_id is the cleanest way to seed reviews without
-- creating fictional `auth.users` rows (which would require auth schema
-- access we don't have in a migration). The vendor_review_stats materialized
-- view refresh trigger fires on the statement-level AFTER INSERT and
-- aggregates correctly regardless of NULL couple_user_ids.
--
-- The UNIQUE constraint `(vendor_profile_id, event_id, couple_user_id)` does
-- NOT collide on NULL couple_user_ids — Postgres treats NULL as distinct in
-- unique indexes by default (NULLS NOT DISTINCT was added in PG15 but the
-- default behavior here is NULLS DISTINCT). So multiple seeded reviews per
-- (vendor, event) tuple are allowed.
--
-- IDEMPOTENCY
-- -----------
-- Re-running this migration is a no-op:
--   - Events: WHERE NOT EXISTS on display_name LIKE 'TEST-REVIEW · %'
--   - Reviews: WHERE NOT EXISTS subquery that checks for any existing
--     vendor_review row sourced from our seed events
-- Both are atomic INSERT … SELECT patterns matching the 960-vendor seed
-- migration style.
--
-- WIPE COMMAND (manual cleanup if ever needed)
-- --------------------------------------------
--   DELETE FROM public.vendor_reviews
--   WHERE event_id IN (
--     SELECT event_id FROM public.events
--     WHERE display_name LIKE 'TEST-REVIEW · %'
--   );
--   DELETE FROM public.events WHERE display_name LIKE 'TEST-REVIEW · %';
--
-- ENTRY POINTS for the data this seed creates (orphan-prevention):
--   - /vendors marketplace cards (read from vendor_market_stats view → reads
--     from vendor_review_stats materialized view which aggregates this data)
--   - /v/[slug] per-vendor public profile (existing 0006 implementation)
--   - admin /admin/reviews if/when that surface lands (it currently doesn't
--     in V1 per spec — review moderation is V1.x)
-- No new routes added by this migration.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Seed events — 50 fictional anonymized weddings
-- ----------------------------------------------------------------------------
--
-- These events exist solely as FK targets for vendor_reviews.event_id. They
-- are NOT linked to any real user via event_members, are archived = TRUE so
-- the auto-jump login rule never lands on them, and use 'TEST-REVIEW · '
-- prefix so they're easy to identify and wipe.

WITH couple_names (rn, label) AS (
  VALUES
    ( 1, 'Maria & Juan'),
    ( 2, 'Charisse & Mark'),
    ( 3, 'Bea & Liam'),
    ( 4, 'Anna & Carlos'),
    ( 5, 'Sofia & Miguel'),
    ( 6, 'Isabella & Diego'),
    ( 7, 'Camille & Rafael'),
    ( 8, 'Lara & Joaquin'),
    ( 9, 'Patricia & Antonio'),
    (10, 'Rachel & Vincent'),
    (11, 'Andrea & Gabriel'),
    (12, 'Cristina & Marco'),
    (13, 'Therese & Paolo'),
    (14, 'Janine & Daniel'),
    (15, 'Mikaela & Lorenzo'),
    (16, 'Erika & Sebastian'),
    (17, 'Karla & Adrian'),
    (18, 'Yvette & Nicolas'),
    (19, 'Reese & Mateo'),
    (20, 'Pia & Alessandro'),
    (21, 'Bianca & Enzo'),
    (22, 'Nicole & Andres'),
    (23, 'Carla & Emilio'),
    (24, 'Trisha & Vicente'),
    (25, 'Hannah & Iñigo'),
    (26, 'Mae & Christian'),
    (27, 'Joanna & Ezekiel'),
    (28, 'Trina & Lucas'),
    (29, 'Stephanie & Joshua'),
    (30, 'Athena & Rico'),
    (31, 'Liza & Renz'),
    (32, 'Aubrey & Jericho'),
    (33, 'Krystal & Aldrin'),
    (34, 'Faye & Bryan'),
    (35, 'Ria & Patrick'),
    (36, 'Jamie & Carlo'),
    (37, 'Trixie & Ramon'),
    (38, 'Margaux & Franco'),
    (39, 'Ysabel & Gio'),
    (40, 'Denise & Kiko'),
    (41, 'Maan & JR'),
    (42, 'Frances & Iñaki'),
    (43, 'Tisha & Manolo'),
    (44, 'Belle & Lance'),
    (45, 'Robyn & Caloy'),
    (46, 'Issa & Migs'),
    (47, 'Pam & Ace'),
    (48, 'Cara & Topher'),
    (49, 'Tin & Joaqui'),
    (50, 'Lyn & Bo')
)
INSERT INTO public.events (
  event_type,
  display_name,
  event_date,
  is_primary,
  archived
)
SELECT
  'wedding'::public.event_type,
  format('TEST-REVIEW · %s', cn.label),
  -- Spread event_date across last 18 months. Most weddings happened
  -- 1-12 months ago (review-eligible window).
  (CURRENT_DATE - (30 + (cn.rn * 11) % 540)::INT)::DATE,
  FALSE,
  TRUE
FROM couple_names cn
WHERE NOT EXISTS (
  SELECT 1 FROM public.events e
  WHERE e.display_name = format('TEST-REVIEW · %s', cn.label)
);

-- ----------------------------------------------------------------------------
-- 2. Body copy library — ~80 variants in Filipino-couple voice
-- ----------------------------------------------------------------------------
--
-- These get randomly distributed across all seeded reviews. Mix EN-primary
-- with light Taglish phrases (sobrang, galing, sana, salamat) so the tone
-- matches actual Filipino wedding-review voice without being costume.
--
-- Roughly grouped:
--   - 5-star: 50 variants
--   - 4-star: 15 variants
--   - 3-star: 8 variants
--   - 2-star: 4 variants
--   - 1-star: 3 variants
-- The body-picker logic uses rating_overall to bias which subset gets picked,
-- so 1-star reviews never accidentally read "amazing!" and 5-star reviews
-- never read like complaints.

CREATE TEMP TABLE _review_bodies_5star (idx INT, body TEXT);
INSERT INTO _review_bodies_5star (idx, body) VALUES
  ( 1, 'Absolutely amazing — they made our wedding day so much smoother. Everyone was talking about the service the whole reception.'),
  ( 2, 'Sobrang professional · we felt taken care of from the first meeting all the way to the actual event. Highly recommend.'),
  ( 3, 'Quality was exceptional, communication was responsive · they really understood what we wanted. Would book again in a heartbeat.'),
  ( 4, 'Galing! The team showed up on time, set up everything beautifully · our guests are still raving about it months later.'),
  ( 5, 'Worth every peso · the attention to detail was incredible. Salamat sa lahat!'),
  ( 6, 'Beyond expectations. We had so many last-minute changes and they handled all of them without complaint. True professionals.'),
  ( 7, 'I cannot recommend them enough. From the planning calls to the day itself, everything was seamless. Maraming salamat.'),
  ( 8, 'They genuinely cared about making our day special. You can feel the passion in their work. Sulit na sulit.'),
  ( 9, 'Sobrang ganda ng output! The team was punctual, organized, and incredibly kind to our families. We are forever grateful.'),
  (10, 'Best decision we made for the wedding. Communication was clear, pricing was honest, and the result blew everyone away.'),
  (11, 'They turned our vision into reality and then some. Every guest commented on how perfect the setup was. 10/10.'),
  (12, 'Truly world-class service in the Philippines. We compared so many vendors and so glad we picked them.'),
  (13, 'The team felt like family by the end of the planning process. They listened, adjusted, and delivered above and beyond.'),
  (14, 'Ang galing nila — even our parents (who are very hard to impress) were blown away. Salamat po sa serbisyo.'),
  (15, 'From start to finish, they made everything easy. We had zero stress on the day itself because of how prepared they were.'),
  (16, 'Honestly the best in their category. Professional, friendly, on-time, and the quality is just unmatched. Book them.'),
  (17, 'They captured exactly what we hoped for and more. Worth every single peso. Highly recommended sa lahat ng couples.'),
  (18, 'We were nervous about how it would all come together but they exceeded every expectation. Sobrang grateful kami.'),
  (19, 'Such a positive experience from inquiry to delivery. They are responsive, talented, and genuinely lovely people to work with.'),
  (20, 'Our guests still send us messages saying it was the best wedding they have ever attended. Big part of that was this team.'),
  (21, 'Magaling, mabait, on-time. Three things that matter most for a wedding vendor — they nailed all three.'),
  (22, 'Five stars is not enough. They went above and beyond at every step. We are recommending them to all our friends.'),
  (23, 'Smooth coordination, beautiful execution, no hidden fees. This is what every couple should look for in a vendor.'),
  (24, 'They made what could have been a stressful day feel effortless. Salamat sa team — you all made our wedding unforgettable.'),
  (25, 'Their professionalism + creativity is a rare combination. We felt heard throughout the process and the result was stunning.'),
  (26, 'Incredible value for the quality they deliver. We had a few comparisons and this team was clearly the most thoughtful.'),
  (27, 'Ang dami naming pinili at sila pinaka-best na choice. They listened to our story and made everything personal.'),
  (28, 'We knew within the first meeting that we had to book them. That gut feeling was 100% correct. Sobrang saya namin.'),
  (29, 'Punctual, kind, talented · everything you could ask for. Our wedding would not have been the same without them.'),
  (30, 'They are not just vendors, they are partners in making your day perfect. Cannot say enough good things.'),
  (31, 'We worried about the budget but they delivered premium quality at a fair price. No regrets at all.'),
  (32, 'They communicated through every step of planning — no questions left unanswered. Day of, perfection.'),
  (33, 'Mabilis sumagot sa messages, malinaw sa pricing, walang last-minute surprises. Trustworthy team talaga.'),
  (34, 'The team felt our excitement and matched it. They genuinely care about every couple they work with.'),
  (35, 'Absolutely flawless execution. Our guests asked us for their contact info — that is the highest compliment we can give.'),
  (36, 'From booking to delivery, everything was smooth and professional. The quality of their work speaks for itself.'),
  (37, 'They saved us multiple times during the prep — adjusting timelines, suggesting alternatives, all with patience and grace.'),
  (38, 'Photos / videos / setup — all delivered beyond our expectations. Sobra na yung "we got more than what we paid for".'),
  (39, 'A genuinely talented team with the kindest hearts. We made friends, not just hired vendors. Salamat sa pagiging kasama.'),
  (40, 'They worked closely with our coordinator and other vendors so everything flowed beautifully. Highly highly recommend.'),
  (41, 'Quality so good we are framing some of the keepsakes. Cannot thank them enough for the memories they helped create.'),
  (42, 'We picked them based on a friend recommendation and now we are paying it forward. Excellent in every way.'),
  (43, 'They were responsive even on weekends when we had last-minute questions. That level of care is rare. Maraming salamat.'),
  (44, 'Pro lahat — from the principal down to the assistants. Cohesive team, clear hierarchy, smooth execution. 5 stars.'),
  (45, 'Our families and friends keep complimenting the work months after the wedding. They left a lasting impression.'),
  (46, 'They were so flexible with our last-minute changes. Never once did we feel like we were inconveniencing them. Pure class.'),
  (47, 'Worth every centavo. We compared 5 other vendors and this team had the best portfolio + best vibes by far.'),
  (48, 'They understood our culture and brought it to life. Every Filipino touch was thoughtful and tasteful.'),
  (49, 'Stress-free is the only way to describe working with them. We highly recommend them to any couple. Salamat ulit!'),
  (50, 'Above and beyond does not even begin to describe it. Future couples — book them without hesitation.');

CREATE TEMP TABLE _review_bodies_4star (idx INT, body TEXT);
INSERT INTO _review_bodies_4star (idx, body) VALUES
  ( 1, 'Really happy with the service overall. A few small hiccups during prep but they recovered well on the day itself.'),
  ( 2, 'Great quality, communication was good, just a bit slower in the final week before the event. End result was lovely.'),
  ( 3, 'Wonderful team and the output was beautiful. Would book again. Minor delays in deliverables but they made it right.'),
  ( 4, 'Solid work and very professional. Pricing was fair for the quality we got. Salamat sa team.'),
  ( 5, 'Happy customer here. Communication could have been a bit faster but the actual work was excellent.'),
  ( 6, 'The team is talented and friendly. Some minor coordination issues with other vendors but nothing major.'),
  ( 7, 'Good experience overall. The output exceeded what we expected even if the planning process had small bumps.'),
  ( 8, 'Talented and professional. We had a few alignment calls to get on the same page but they were always patient with us.'),
  ( 9, 'Magaling sila at maganda yung trabaho. Maybe a touch slow in responding sometimes but the final product is great.'),
  (10, 'Would recommend. Minor things to iron out in their process but their craft is genuinely excellent.'),
  (11, 'Very happy with the result. Some communication gaps in the prep period but day-of execution was flawless.'),
  (12, 'Lovely team, lovely output. We had to follow up a couple times but overall a great vendor to work with.'),
  (13, 'Quality work and a kind team. The booking process took a bit longer than expected but worth the wait.'),
  (14, 'Great value, beautiful work. Just a small note that we wished they had been more proactive with updates.'),
  (15, 'Excellent end product and overall great experience. Highly likely to recommend with small caveats on planning pace.');

CREATE TEMP TABLE _review_bodies_3star (idx INT, body TEXT);
INSERT INTO _review_bodies_3star (idx, body) VALUES
  ( 1, 'Good service overall but had some communication delays in the final week. End result was lovely though.'),
  ( 2, 'Okay experience. The work was solid but the planning process had more friction than we expected.'),
  ( 3, 'Decent vendor. Quality met expectations but did not exceed them. Pricing was a bit on the higher side for what we got.'),
  ( 4, 'The team is talented but coordination with other suppliers was challenging. End product was still nice.'),
  ( 5, 'Mixed experience. Beautiful work in the end but the lead-up was stressful with slow replies and changing details.'),
  ( 6, 'Average. Not bad, not amazing — somewhere in between. Maybe we expected more based on the portfolio.'),
  ( 7, 'Output was okay. Communication needed improvement — we had to chase for updates several times.'),
  ( 8, 'It was fine. Met the bare expectations but did not feel premium for the price we paid.');

CREATE TEMP TABLE _review_bodies_2star (idx INT, body TEXT);
INSERT INTO _review_bodies_2star (idx, body) VALUES
  ( 1, 'Arrived late and did not fully match what we discussed in the briefing. Followed up after but disappointed.'),
  ( 2, 'Service did not live up to the portfolio. Communication was slow and final delivery had several issues we had to flag.'),
  ( 3, 'Not the experience we hoped for. Multiple last-minute changes from their side and the output had visible quality gaps.'),
  ( 4, 'Disappointed honestly. The team was friendly but the execution did not match what was promised in the briefing.');

CREATE TEMP TABLE _review_bodies_1star (idx INT, body TEXT);
INSERT INTO _review_bodies_1star (idx, body) VALUES
  ( 1, 'Would not recommend. Major no-shows on the day, delayed delivery, and poor communication when we tried to follow up.'),
  ( 2, 'Very disappointing. We paid for premium service and got something that felt like an afterthought. Not okay for a wedding.'),
  ( 3, 'The worst vendor experience we had for our wedding. Hoping no other couple goes through what we did.');

-- ----------------------------------------------------------------------------
-- 3. Vendor reply copy library — populated on ~25% of reviews
-- ----------------------------------------------------------------------------

CREATE TEMP TABLE _vendor_replies (idx INT, reply TEXT);
INSERT INTO _vendor_replies (idx, reply) VALUES
  ( 1, 'Maraming salamat for the kind words! It was our honor to be part of your special day. Wishing you both a lifetime of love.'),
  ( 2, 'Thank you so much for trusting us with this milestone. Your wedding was truly one of our favorites this year!'),
  ( 3, 'Salamat po — your warmth as a couple made our job easy. Sending you both all the best for your journey ahead.'),
  ( 4, 'We are so grateful for your trust and the chance to be part of such a beautiful celebration. Salamat ulit!'),
  ( 5, 'Your kind review made our whole team smile. Thank you for letting us be part of your story.'),
  ( 6, 'Reading this means everything to us. Salamat for choosing us and for sharing such a thoughtful review.'),
  ( 7, 'Thank you for the wonderful feedback. We genuinely loved working with you both!'),
  ( 8, 'Maraming salamat sa inyo! Your wedding was magical and we are honored to have captured it.'),
  ( 9, 'Wishing you many blessings as you start this new chapter. Salamat sa pagtitiwala niyo.'),
  (10, 'Thank you for the trust and for being such a joy to work with. Sana magkita pa tayo ulit in the future!'),
  (11, 'Your review made our day. Thank you for taking the time to share your experience with future couples.'),
  (12, 'Salamat for the love! It was a pleasure being part of your celebration.'),
  (13, 'Thank you for the kind words. We hope your married life is as beautiful as your wedding day was.'),
  (14, 'Your support means the world to our small business. Maraming salamat sa lahat!'),
  (15, 'It was truly our pleasure. Your love story is beautiful and we are honored to be a small part of it.'),
  (16, 'Thanks for taking time to write this. Best of luck on the next chapter — and salamat sa beautiful experience.'),
  (17, 'We really appreciate the review. Working with kind couples like you is what makes this work fulfilling.'),
  (18, 'Salamat from the whole team. We poured our heart into your wedding and we are so glad it showed.'),
  (19, 'Thank you for trusting us. We will treasure being part of your day for years to come.'),
  (20, 'Reading your review reminded us why we love what we do. Maraming salamat!');

-- ----------------------------------------------------------------------------
-- 4. Generate reviews
-- ----------------------------------------------------------------------------
--
-- Strategy:
--   - Sample ~70% of verified test vendors (verification_status = 'verified'
--     OR public_visibility = 'verified'; the test seed uses 'coming_soon'
--     but we treat ALL test vendors as the target population since
--     vendor_market_stats reads ALL vendor_profiles via LEFT JOIN — the
--     review counts surface whether the vendor is verified or not).
--   - For each picked vendor, assign 1-5 reviews (random weighted toward 2-3).
--   - For each review, pick one of the 50 seeded events (mod by vendor row
--     number so different vendors point at different events — realistic).
--   - Rating overall via weighted random: 60/25/10/4/1.
--   - Other 4 ratings clustered around overall ±1, clamped to [1,5].
--   - Body picked from the rating-bucket pool. ~10% NULL body.
--   - Vendor_reply on ~25% of reviews, picked from reply library.
--   - created_at spread across last 12 months with recency weighting:
--     biased toward last 4 months via `random()^2 * 365` distribution.
--
-- Each (vendor, event, NULL) tuple is unique in Postgres default unique
-- index semantics, so multiple reviews per (vendor, event) are allowed.

WITH target_vendors AS (
  -- Pick 70% of test vendors at random. ORDER BY random() gives us the
  -- random subset; LIMIT to ~672 = round(960 * 0.7).
  -- Filter to test vendors only (business_slug LIKE 'test-%') so we never
  -- accidentally seed reviews against real vendors that land later.
  SELECT
    vp.vendor_profile_id,
    ROW_NUMBER() OVER (ORDER BY random()) AS rn,
    -- Reviews-per-vendor: weighted random 1-5, biased toward 2-3.
    -- floor(random() * 5) + 1 → uniform 1-5. We weight via:
    --   roll < 0.20 → 1 review
    --   roll < 0.45 → 2 reviews
    --   roll < 0.75 → 3 reviews
    --   roll < 0.92 → 4 reviews
    --   else        → 5 reviews
    (
      CASE
        WHEN random() < 0.20 THEN 1
        WHEN random() < 0.45 THEN 2
        WHEN random() < 0.75 THEN 3
        WHEN random() < 0.92 THEN 4
        ELSE 5
      END
    )::INT AS review_count
  FROM public.vendor_profiles vp
  WHERE vp.business_slug LIKE 'test-%'
    -- Idempotency guard: only target vendors that don't already have a
    -- review from one of our seed events.
    AND NOT EXISTS (
      SELECT 1 FROM public.vendor_reviews vr
      JOIN public.events e ON e.event_id = vr.event_id
      WHERE vr.vendor_profile_id = vp.vendor_profile_id
        AND e.display_name LIKE 'TEST-REVIEW · %'
    )
  ORDER BY random()
  LIMIT 672
),

-- Expand each vendor into N rows (one per review)
review_slots AS (
  SELECT
    tv.vendor_profile_id,
    tv.rn,
    gs AS review_idx
  FROM target_vendors tv
  CROSS JOIN LATERAL generate_series(1, tv.review_count) AS gs
),

-- Materialize the events list once. We pick by index = (rn * 7 + review_idx)
-- so different vendors land on different events — avoids all reviews
-- piling up on the same event_id.
seed_events AS (
  SELECT
    event_id,
    ROW_NUMBER() OVER (ORDER BY id) AS event_rn
  FROM public.events
  WHERE display_name LIKE 'TEST-REVIEW · %'
),

events_count AS (
  SELECT COUNT(*)::INT AS total FROM seed_events
),

-- Assign each review slot a rating, body, reply, timestamp
prepared_reviews AS (
  SELECT
    rs.vendor_profile_id,
    -- Map review_slot → event via modulo. Different vendors hit different
    -- starting events (rn-based offset).
    se.event_id,
    -- Rating overall: weighted random for the 60/25/10/4/1 distribution.
    (
      CASE
        WHEN random() < 0.60 THEN 5
        WHEN random() < 0.85 THEN 4
        WHEN random() < 0.95 THEN 3
        WHEN random() < 0.99 THEN 2
        ELSE 1
      END
    )::SMALLINT AS rating_overall_pick,
    -- random() once per row, reused for body + reply + null-body decision
    random() AS roll_body,
    random() AS roll_reply,
    random() AS roll_null_body,
    -- Spread created_at across last 365 days with recency bias.
    -- random()^2 puts more density near 0 → more recent dates.
    (NOW() - (power(random(), 2) * 365 * INTERVAL '1 day'))::TIMESTAMPTZ AS created_at_pick
  FROM review_slots rs
  CROSS JOIN events_count ec
  JOIN seed_events se ON se.event_rn = (((rs.rn * 7 + rs.review_idx - 1) % ec.total) + 1)
),

-- Compute the other 4 ratings clustered around overall ±1, clamped to [1,5].
rated_reviews AS (
  SELECT
    pr.vendor_profile_id,
    pr.event_id,
    pr.rating_overall_pick AS rating_overall,
    GREATEST(1, LEAST(5, pr.rating_overall_pick + (floor(random() * 3) - 1)::INT))::SMALLINT AS rating_communication,
    GREATEST(1, LEAST(5, pr.rating_overall_pick + (floor(random() * 3) - 1)::INT))::SMALLINT AS rating_quality,
    GREATEST(1, LEAST(5, pr.rating_overall_pick + (floor(random() * 3) - 1)::INT))::SMALLINT AS rating_value,
    GREATEST(1, LEAST(5, pr.rating_overall_pick + (floor(random() * 3) - 1)::INT))::SMALLINT AS rating_on_time,
    pr.roll_body,
    pr.roll_reply,
    pr.roll_null_body,
    pr.created_at_pick
  FROM prepared_reviews pr
)

INSERT INTO public.vendor_reviews (
  vendor_profile_id,
  event_id,
  couple_user_id,
  rating_overall,
  rating_communication,
  rating_quality,
  rating_value,
  rating_on_time,
  body,
  vendor_reply,
  vendor_reply_at,
  created_at,
  updated_at
)
SELECT
  rr.vendor_profile_id,
  rr.event_id,
  NULL::UUID AS couple_user_id,
  rr.rating_overall,
  rr.rating_communication,
  rr.rating_quality,
  rr.rating_value,
  rr.rating_on_time,
  -- Body picker: ~10% NULL, else pick from rating-bucket pool by roll_body.
  CASE
    WHEN rr.roll_null_body < 0.10 THEN NULL
    WHEN rr.rating_overall = 5 THEN (
      SELECT body FROM _review_bodies_5star
      WHERE idx = (1 + (floor(rr.roll_body * 50)::INT % 50))
    )
    WHEN rr.rating_overall = 4 THEN (
      SELECT body FROM _review_bodies_4star
      WHERE idx = (1 + (floor(rr.roll_body * 15)::INT % 15))
    )
    WHEN rr.rating_overall = 3 THEN (
      SELECT body FROM _review_bodies_3star
      WHERE idx = (1 + (floor(rr.roll_body * 8)::INT % 8))
    )
    WHEN rr.rating_overall = 2 THEN (
      SELECT body FROM _review_bodies_2star
      WHERE idx = (1 + (floor(rr.roll_body * 4)::INT % 4))
    )
    ELSE (
      SELECT body FROM _review_bodies_1star
      WHERE idx = (1 + (floor(rr.roll_body * 3)::INT % 3))
    )
  END AS body,
  -- Vendor reply on ~25% of reviews (typically only on 4-5 star ratings —
  -- vendors don't usually reply publicly to 1-2 star reviews in V1).
  CASE
    WHEN rr.roll_reply < 0.25 AND rr.rating_overall >= 4 THEN (
      SELECT reply FROM _vendor_replies
      WHERE idx = (1 + (floor(rr.roll_reply * 80)::INT % 20))
    )
    ELSE NULL
  END AS vendor_reply,
  -- vendor_reply_at: set when vendor_reply is present, NULL otherwise
  CASE
    WHEN rr.roll_reply < 0.25 AND rr.rating_overall >= 4 THEN rr.created_at_pick + INTERVAL '3 days'
    ELSE NULL
  END AS vendor_reply_at,
  rr.created_at_pick AS created_at,
  rr.created_at_pick AS updated_at
FROM rated_reviews rr;

-- ----------------------------------------------------------------------------
-- 5. Cleanup temp tables
-- ----------------------------------------------------------------------------
--
-- Temp tables auto-drop at session end, but explicit drops keep the migration
-- self-contained and idempotent if re-applied via psql (where the session
-- might persist).

DROP TABLE IF EXISTS _review_bodies_5star;
DROP TABLE IF EXISTS _review_bodies_4star;
DROP TABLE IF EXISTS _review_bodies_3star;
DROP TABLE IF EXISTS _review_bodies_2star;
DROP TABLE IF EXISTS _review_bodies_1star;
DROP TABLE IF EXISTS _vendor_replies;

COMMIT;

-- ----------------------------------------------------------------------------
-- 6. Refresh vendor_review_stats materialized view explicitly
-- ----------------------------------------------------------------------------
--
-- The AFTER INSERT statement-level trigger from 20260514100000_vendor_reviews
-- catches OTHERS exceptions and only warns, so a bulk insert can silently
-- leave vendor_review_stats stale. We force a clean refresh outside the
-- transaction (REFRESH MATERIALIZED VIEW CONCURRENTLY runs in its own
-- implicit transaction and cannot share the BEGIN/COMMIT block above) so the
-- view is guaranteed to reflect the seed data immediately after apply.
--
-- vendor_market_stats (the marketplace read-path view consumed by /vendors)
-- LEFT JOINs vendor_review_stats USING (vendor_profile_id), so refreshing
-- the materialized view automatically updates the marketplace cards.

REFRESH MATERIALIZED VIEW CONCURRENTLY public.vendor_review_stats;
