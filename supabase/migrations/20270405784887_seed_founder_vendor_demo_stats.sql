-- ============================================================================
-- 20270405784887_seed_founder_vendor_demo_stats.sql
--
-- DEMO DATA — lights up every stat surface on the founder vendor's dashboard
-- (`/vendor-dashboard`) so the owner can dogfood "what the account looks like
-- with real activity."
--
-- Owner directive 2026-07-01: "populate my founder vendor account so I can see
-- what is happening on the account — I want to see stats."
--
-- TARGET VENDOR
--   Setnayan Founder · Ice  ·  vendor_profile_id 646c9457-3450-412e-8d60-7281224da157
--   (the sole published marketplace vendor · is_founder = TRUE)
--
-- WHAT THIS SEEDS (and which dashboard surface each row feeds)
-- ----------------------------------------------------------------------------
--   Home stat tiles (apps/web/app/vendor-dashboard/page.tsx):
--     · Open inquiries      = 10  ← 10 chat_threads
--     · Confirmed bookings  =  6  ← chat_threads.inquiry_status = 'accepted'
--     · Upcoming events     =  3  ← threads whose event_date is within 14 days
--     · Completed events    =  8  ← event_vendors (status complete/delivered)
--                                    linked to the founder · via the
--                                    vendor_public_completed_events_stats matview
--     · Token balance       = 150 ← vendor_wallets (100 earned + 50 purchased)
--     (Active services is left untouched — those are real config the owner
--      manages in /vendor-dashboard/services.)
--
--   Performance panel (_components/vendor-stats-panel.tsx · reads
--   vendor_activity_stats, which is service-role/admin write-only and does
--   NOT auto-derive — so it is set explicitly here, with values consistent
--   with the rows above):
--     · Quality score · Response rate · Avg reply time · Review score ·
--       Completion rate · Inquiry→booking · Experience badge
--
--   Public marketplace (/vendors + /v/[slug]):
--     · 8 vendor_reviews (avg ~4.6) feed the public review count / rating via
--       the vendor_review_stats matview.
--
-- IDEMPOTENCY + RETIRE-ABILITY
--   Every demo event is tagged `display_name LIKE 'FOUNDER-DEMO · %'`. The
--   script first DELETEs those events; ON DELETE CASCADE from events →
--   chat_threads / chat_messages / vendor_reviews / event_vendors wipes all
--   dependent demo rows, so a re-run (or a fresh DB rebuild) reconstructs a
--   clean set. vendor_activity_stats + vendor_wallets are UPSERTed.
--   To retire the demo entirely later:
--     DELETE FROM public.events WHERE display_name LIKE 'FOUNDER-DEMO · %';
--     -- then clear/adjust vendor_activity_stats + vendor_wallets for 646c9457…
--
-- SAFETY NOTES
--   · Demo events carry NO event_members (couple roster), so they never appear
--     in any host's dashboard and are not reachable via a public slug.
--   · Reviews use couple_user_id = NULL (anonymous) — this sidesteps the
--     self-review gate and needs no fabricated auth users.
--   · The event_vendors AFTER-STATEMENT trigger refreshes the completed-events
--     matviews CONCURRENTLY and swallows errors, so the INSERTs are safe inside
--     this migration's transaction; the matviews are refreshed explicitly
--     (non-concurrent) at the end so the counts reflect the seed immediately.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Guard — only run if the founder vendor actually exists on this DB.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_profiles
    WHERE vendor_profile_id = '646c9457-3450-412e-8d60-7281224da157'
  ) THEN
    RAISE EXCEPTION 'Founder vendor 646c9457-3450-412e-8d60-7281224da157 not found — aborting demo seed';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. Idempotency — remove any prior FOUNDER-DEMO events (cascades to threads,
--    messages, reviews, event_vendors).
-- ----------------------------------------------------------------------------
DELETE FROM public.events WHERE display_name LIKE 'FOUNDER-DEMO · %';

-- ----------------------------------------------------------------------------
-- 2. Demo events — 8 completed (past dates) + 10 inquiries (future dates).
--    The past/future split is load-bearing: step 3 gates completed bookings on
--    event_date < CURRENT_DATE, and the "Upcoming events" tile counts threads
--    whose event_date is within the next 14 days.
-- ----------------------------------------------------------------------------
INSERT INTO public.events
  (event_type, display_name, event_date, is_primary, archived, ceremony_type, venue_setting)
VALUES
  -- 8 completed weddings (past)
  ('wedding', 'FOUNDER-DEMO · Andrea & Paolo',   CURRENT_DATE - 240, FALSE, FALSE, 'catholic',  'garden'),
  ('wedding', 'FOUNDER-DEMO · Bianca & Miguel',  CURRENT_DATE - 205, FALSE, FALSE, 'catholic',  'heritage'),
  ('wedding', 'FOUNDER-DEMO · Camille & Rafael', CURRENT_DATE - 168, FALSE, FALSE, 'christian', 'beach'),
  ('wedding', 'FOUNDER-DEMO · Denise & Lorenzo', CURRENT_DATE - 132, FALSE, FALSE, 'catholic',  'banquet_hall'),
  ('wedding', 'FOUNDER-DEMO · Erika & Nathan',   CURRENT_DATE -  96, FALSE, FALSE, 'civil',     'destination'),
  ('wedding', 'FOUNDER-DEMO · Faith & Gabriel',  CURRENT_DATE -  61, FALSE, FALSE, 'catholic',  'garden'),
  ('wedding', 'FOUNDER-DEMO · Grace & Julian',   CURRENT_DATE -  38, FALSE, FALSE, 'christian', 'outdoor_tent'),
  ('wedding', 'FOUNDER-DEMO · Hannah & Sebas',   CURRENT_DATE -  21, FALSE, FALSE, 'catholic',  'banquet_hall'),
  -- 10 open inquiries (future) — first 3 are within 14 days
  ('wedding', 'FOUNDER-DEMO · Isabel & Marco',   CURRENT_DATE +   6, FALSE, FALSE, 'catholic',  'banquet_hall'),
  ('wedding', 'FOUNDER-DEMO · Jamie & Rico',     CURRENT_DATE +  10, FALSE, FALSE, 'civil',     'garden'),
  ('wedding', 'FOUNDER-DEMO · Kyla & Vince',     CURRENT_DATE +  13, FALSE, FALSE, 'christian', 'beach'),
  ('wedding', 'FOUNDER-DEMO · Lara & Diego',     CURRENT_DATE +  34, FALSE, FALSE, 'catholic',  'heritage'),
  ('wedding', 'FOUNDER-DEMO · Mika & Ethan',     CURRENT_DATE +  52, FALSE, FALSE, 'catholic',  'garden'),
  ('wedding', 'FOUNDER-DEMO · Nadine & Ryan',    CURRENT_DATE +  71, FALSE, FALSE, 'christian', 'destination'),
  ('wedding', 'FOUNDER-DEMO · Olivia & Sam',     CURRENT_DATE +  95, FALSE, FALSE, 'catholic',  'banquet_hall'),
  ('wedding', 'FOUNDER-DEMO · Patricia & Tom',   CURRENT_DATE + 128, FALSE, FALSE, 'civil',     'garden'),
  ('wedding', 'FOUNDER-DEMO · Queenie & Ube',    CURRENT_DATE + 160, FALSE, FALSE, 'catholic',  'outdoor_tent'),
  ('wedding', 'FOUNDER-DEMO · Rhea & Will',      CURRENT_DATE + 210, FALSE, FALSE, 'christian', 'beach');

-- ----------------------------------------------------------------------------
-- 3. Completed bookings — event_vendors linked to the founder on the 8 past
--    events (2 recent = 'delivered' + 6 older = 'complete'; both count).
-- ----------------------------------------------------------------------------
INSERT INTO public.event_vendors
  (event_id, category, vendor_name, status, linked_vendor_profile_id, total_cost_php, deposit_paid_php)
SELECT
  e.event_id,
  'photographer'::public.vendor_category,
  'Setnayan Founder · Ice',
  (CASE WHEN e.event_date >= CURRENT_DATE - 45 THEN 'delivered' ELSE 'complete' END)::public.vendor_status,
  '646c9457-3450-412e-8d60-7281224da157'::uuid,
  75000.00,
  30000.00
FROM public.events e
WHERE e.display_name LIKE 'FOUNDER-DEMO · %'
  AND e.event_date < CURRENT_DATE;

-- ----------------------------------------------------------------------------
-- 4. Reviews — 8, one per completed event. couple_user_id = NULL (anonymous).
--    Ratings skew high with light ±1 variance so they read like real input.
--    created_at ≈ event_date + 7 days (couples review shortly after the day).
-- ----------------------------------------------------------------------------
INSERT INTO public.vendor_reviews
  (vendor_profile_id, event_id, couple_user_id,
   rating_overall, rating_communication, rating_quality, rating_value, rating_on_time,
   body, vendor_reply, vendor_reply_at, created_at, updated_at)
SELECT
  '646c9457-3450-412e-8d60-7281224da157'::uuid,
  e.event_id,
  NULL::uuid,
  r.o, r.c, r.q, r.v, r.t,
  r.body, r.reply,
  (e.event_date + 9)::timestamptz,
  (e.event_date + 7)::timestamptz,
  (e.event_date + 7)::timestamptz
FROM (VALUES
  ('FOUNDER-DEMO · Andrea & Paolo',   5, 5, 5, 4, 5,
     'Absolutely amazing — every guest was still raving about the shots months later. Sulit na sulit!',
     'Maraming salamat, Andrea & Paolo! It was an honour to be part of your day.'),
  ('FOUNDER-DEMO · Bianca & Miguel',  5, 5, 5, 5, 5,
     'Sobrang professional from the first meeting to delivery. Communication was fast and clear. Highly recommend.',
     'Thank you so much — wishing you both a lifetime of happiness!'),
  ('FOUNDER-DEMO · Camille & Rafael', 4, 4, 5, 4, 4,
     'Beautiful output and very organized on the day. A couple of files came a little late but the quality made up for it.',
     'Thank you Camille & Rafael — noted on the turnaround, we appreciate the honest feedback.'),
  ('FOUNDER-DEMO · Denise & Lorenzo', 5, 5, 5, 5, 4,
     'Galing! Punctual, kind to our families, and captured exactly the feel we wanted. Would book again in a heartbeat.',
     NULL),
  ('FOUNDER-DEMO · Erika & Nathan',   5, 4, 5, 5, 5,
     'Worth every peso. The attention to detail was incredible — even our very hard-to-impress parents were blown away.',
     'Salamat, Erika & Nathan! So glad your parents loved it too.'),
  ('FOUNDER-DEMO · Faith & Gabriel',  4, 5, 4, 4, 5,
     'Responsive and lovely to work with. Handled our last-minute changes without any stress on our end. Thank you!',
     NULL),
  ('FOUNDER-DEMO · Grace & Julian',   5, 5, 5, 5, 5,
     'Best decision we made for the wedding. Clear pricing, seamless coordination, and the result exceeded expectations.',
     'Thank you Grace & Julian — you made it easy for us. Congratulations!'),
  ('FOUNDER-DEMO · Hannah & Sebas',   3, 3, 4, 3, 4,
     'Solid work overall and the final photos were nice. Wished for a bit more communication in the lead-up, but happy in the end.',
     'Thanks for the feedback, Hannah & Sebas — we are tightening our pre-event check-ins because of notes like this.')
) AS r(dn, o, c, q, v, t, body, reply)
JOIN public.events e ON e.display_name = r.dn;

-- ----------------------------------------------------------------------------
-- 5. Inquiry threads — 10 (one per inquiry event). 6 accepted, 4 pending.
--    created_at spread over the past ~30 days.
-- ----------------------------------------------------------------------------
INSERT INTO public.chat_threads
  (event_id, vendor_profile_id, created_by_user_id, inquiry_status, accepted_at, created_at, updated_at)
SELECT
  e.event_id,
  '646c9457-3450-412e-8d60-7281224da157'::uuid,
  NULL::uuid,
  th.status::public.chat_inquiry_status,
  (CASE WHEN th.status = 'accepted'
        THEN (NOW() - make_interval(days => th.days_ago) + interval '3 hours')
        ELSE NULL END),
  (NOW() - make_interval(days => th.days_ago)),
  (NOW() - make_interval(days => th.days_ago))
FROM (VALUES
  -- 3 upcoming (within 14 days) — 2 accepted, 1 pending
  ('FOUNDER-DEMO · Isabel & Marco',   'accepted', 18),
  ('FOUNDER-DEMO · Jamie & Rico',     'accepted', 12),
  ('FOUNDER-DEMO · Kyla & Vince',     'pending',   2),
  -- 7 further-out inquiries — 4 accepted, 3 pending
  ('FOUNDER-DEMO · Lara & Diego',     'accepted', 30),
  ('FOUNDER-DEMO · Mika & Ethan',     'accepted', 25),
  ('FOUNDER-DEMO · Nadine & Ryan',    'accepted', 21),
  ('FOUNDER-DEMO · Olivia & Sam',     'accepted', 14),
  ('FOUNDER-DEMO · Patricia & Tom',   'pending',   9),
  ('FOUNDER-DEMO · Queenie & Ube',    'pending',   4),
  ('FOUNDER-DEMO · Rhea & Will',      'pending',   1)
) AS th(dn, status, days_ago)
JOIN public.events e ON e.display_name = th.dn;

-- ----------------------------------------------------------------------------
-- 6. Messages.
--    (a) A couple inquiry message on every thread.
--    (b) A vendor reply on every ACCEPTED thread — this fires
--        stamp_vendor_first_reply(), which sets chat_threads.vendor_first_reply_at
--        = the reply's created_at (≈ inquiry + 90 min), giving a realistic
--        response-time signal.
-- ----------------------------------------------------------------------------
-- (a) couple inquiries
INSERT INTO public.chat_messages
  (thread_id, event_id, vendor_profile_id, sender_user_id, sender_role, body, created_at)
SELECT
  ct.thread_id, ct.event_id, ct.vendor_profile_id, NULL::uuid, 'couple'::public.chat_sender_role,
  'Hi! We love your work and would like to check your availability + package details for our wedding. Salamat!',
  ct.created_at
FROM public.chat_threads ct
JOIN public.events e ON e.event_id = ct.event_id
WHERE e.display_name LIKE 'FOUNDER-DEMO · %';

-- (b) vendor replies on accepted threads
INSERT INTO public.chat_messages
  (thread_id, event_id, vendor_profile_id, sender_user_id, sender_role, body, created_at)
SELECT
  ct.thread_id, ct.event_id, ct.vendor_profile_id,
  (SELECT user_id FROM public.vendor_profiles WHERE vendor_profile_id = '646c9457-3450-412e-8d60-7281224da157'),
  'vendor'::public.chat_sender_role,
  'Thank you for reaching out — we would love to be part of your day! Your date is open. Sending our packages now.',
  ct.created_at + interval '90 minutes'
FROM public.chat_threads ct
JOIN public.events e ON e.event_id = ct.event_id
WHERE e.display_name LIKE 'FOUNDER-DEMO · %'
  AND ct.inquiry_status = 'accepted';

-- ----------------------------------------------------------------------------
-- 7. Performance panel — vendor_activity_stats (write-only for admin/service
--    role; set explicitly, values consistent with the seeded rows above).
--      inquiry→booking = 6 booked / 10 inquiries = 60%
--      review_count = 8 · avg ~4.6 · finalized_booking_count = 8
-- ----------------------------------------------------------------------------
INSERT INTO public.vendor_activity_stats (
  vendor_profile_id,
  avg_response_minutes, response_rate_pct, booking_completion_rate_pct,
  vendor_cancellation_count, inquiry_to_booking_pct, finalized_booking_count,
  review_avg_raw, review_avg_bayesian, review_count,
  last_active_at, profile_completeness_pct,
  quality_score, couple_trust_score, platform_health_score, updated_at
) VALUES (
  '646c9457-3450-412e-8d60-7281224da157'::uuid,
  95, 95, 92,
  0, 60, 8,
  4.60, 4.50, 8,
  NOW(), 90,
  88, 90, 92, NOW()
)
ON CONFLICT (vendor_profile_id) DO UPDATE SET
  avg_response_minutes        = EXCLUDED.avg_response_minutes,
  response_rate_pct           = EXCLUDED.response_rate_pct,
  booking_completion_rate_pct = EXCLUDED.booking_completion_rate_pct,
  vendor_cancellation_count   = EXCLUDED.vendor_cancellation_count,
  inquiry_to_booking_pct      = EXCLUDED.inquiry_to_booking_pct,
  finalized_booking_count     = EXCLUDED.finalized_booking_count,
  review_avg_raw              = EXCLUDED.review_avg_raw,
  review_avg_bayesian         = EXCLUDED.review_avg_bayesian,
  review_count                = EXCLUDED.review_count,
  last_active_at              = EXCLUDED.last_active_at,
  profile_completeness_pct    = EXCLUDED.profile_completeness_pct,
  quality_score               = EXCLUDED.quality_score,
  couple_trust_score          = EXCLUDED.couple_trust_score,
  platform_health_score       = EXCLUDED.platform_health_score,
  updated_at                  = EXCLUDED.updated_at;

-- ----------------------------------------------------------------------------
-- 8. Token balance — vendor_wallets (100 earned on verification + 50 bought).
-- ----------------------------------------------------------------------------
INSERT INTO public.vendor_wallets (vendor_id, purchased_tokens, earned_tokens, updated_at)
VALUES ('646c9457-3450-412e-8d60-7281224da157'::uuid, 50, 100, NOW())
ON CONFLICT (vendor_id) DO UPDATE SET
  purchased_tokens = EXCLUDED.purchased_tokens,
  earned_tokens    = EXCLUDED.earned_tokens,
  updated_at       = EXCLUDED.updated_at;

-- ----------------------------------------------------------------------------
-- 9. Refresh the completed-events + review matviews (non-concurrent — safe
--    inside this transaction) so the tiles/cards reflect the seed immediately.
-- ----------------------------------------------------------------------------
REFRESH MATERIALIZED VIEW public.vendor_public_completed_events_stats;
REFRESH MATERIALIZED VIEW public.vendor_full_completed_events_stats;
REFRESH MATERIALIZED VIEW public.vendor_review_stats;
