-- fake_proof_counts_only_arms_length_events
-- Created via `pnpm migration:new`. Idempotent: ADD COLUMN IF NOT EXISTS · CREATE OR REPLACE FUNCTION · DROP … IF EXISTS
-- then CREATE for the views (matviews have no CREATE OR REPLACE). Writes NO data except the stamps the new BEFORE DELETE
-- trigger writes on a celebration's own rows at the moment it is deleted.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 🛡 FAKE PROOF FIXES A–D (owner 2026-11-23, specs DECISION_LOG b89e2420 — "Go, all five"; E is a separate build).
--
-- The audit: a supplier can farm stars, medals and "events done" ALONE, by signing up extra couple accounts with their
-- own emails. Every gate asked only "is the reviewer the shop's owner or one of its team?" — a second account answers no.
--
-- (A) Quick Responder never counts the supplier's OWN offer. `offerServiceCore` writes a thread_service_interests row
--     (added_by_role 'vendor', source 'vendor_offered') and posts the shop's own message a moment later — so every
--     offer scored as an inquiry answered inside the hour. Trending Now read the same rows. Both now read only the
--     interests the COUPLE raised.
-- (B) "5 different couples" counts distinct COUPLE ACCOUNTS, not events: one account that books five events is one
--     couple. The key is `event_couple_key(event)` — the event's couple roster, its first account. Applied wherever the
--     badge facts say "couples" (Hot Booking · Generous Giver · Trending Now).
-- (C) A review moves stars, medals and "events done" only after an ARM'S-LENGTH event. ONE rule,
--     `vendor_event_proof_route(shop, event)`:
--       'found_on_setnayan' — the couple found the shop on Setnayan: a real Setnayan fact on THIS event
--                             (booking_fee_attribution_for_event = 'sourced', which already reads a Shortlist QR row as
--                             the supplier's), the fee rule agrees (booking_fee_attribution_for = 'sourced'), AND the
--                             shop was verified BEFORE its first contact with the event. The fee rule's own
--                             `WHEN (SELECT since FROM vs) IS NULL THEN 'sourced'` (99b6ab50: an unverified shop pays the
--                             flat fee on everything) made an unverified shop's imports read 'sourced'; that line is a
--                             BILLING rule and is left exactly as it is — proof asks for verification separately.
--       'real_guests'       — at least N distinct guests RSVP'd or captured Papic on the event. N is
--                             platform_settings.proof_real_guests_min: NULLABLE, seeded 20 (owner). While it is NULL this route
--                             never qualifies (fails toward not counting). An admin can change N.
--       NULL                — does not count. The review still SHOWS on the shop, labelled the supplier's own client
--                             (the shipped "Verified booking" pill), through `vendor_reviews_public.counts_as_proof`.
--     Readers covered: vendor_trusted_review_stats (the shop's stars) · vendor_service_trusted_review_stats (each card's)
--     · vendor_public_completed_events_stats ("events done"; also learns 'vendor_shortlist_qr' as supplier-brought) ·
--     vendor_completed_events (the /v/[slug] track record) · service_card_badge_facts (Rave Reviews).
--     The public views read the rule through ONE cached matview, `vendor_proof_events`, because a view granted to anon
--     cannot call a service-role function. The badge facts (service role) call the rule live.
--     A celebration the couple DELETED keeps its record (owner 2026-08-21) but loses the facts the rule reads, so the
--     new BEFORE DELETE trigger `events_arms_length_proof_stamp` answers the question once, while it still can, into
--     `proof_at_delete` on the review and the booking. A row orphaned BEFORE this migration has no stamp → it does not
--     count (fails toward not counting; said in the PR).
-- (D) A review the screener flags is HELD, not just flagged: while its integrity_flags row is 'open' or
--     'confirmed_fraud' it is out of every public count and every public list. Only an admin's Dismiss releases it.
--     The queue is the shipped /admin/integrity-watch — no second queue.
--
-- ⛔ FEE BILLING DOES NOT CHANGE. booking_fee_attribution_for / _for_event / _shop_verified_since / _first_contact_at
--    are READ, never replaced. Nothing here writes booking_fee_* rows.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ── 1 · N: the owner's number, 20 ────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS proof_real_guests_min INTEGER;
ALTER TABLE public.platform_settings DROP CONSTRAINT IF EXISTS platform_settings_proof_real_guests_min_range;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_proof_real_guests_min_range
  CHECK (proof_real_guests_min IS NULL OR (proof_real_guests_min > 0 AND proof_real_guests_min <= 100000));
COMMENT ON COLUMN public.platform_settings.proof_real_guests_min IS
  'Fake proof fixes (C), owner 2026-11-23 (DECISION_LOG b89e2420): how many distinct guests must RSVP or capture Papic on '
  'an event before a review from it moves the shop''s stars, medals and events done — when the couple did not find the '
  'shop on Setnayan. NULL = not set: that route never qualifies (fails toward not counting). Seeded at 20 (owner, '
  'DECISION_LOG "Seven open calls settled" item 5); an admin changes it on Admin › Settings. Read by '
  'public.vendor_event_proof_route. Migration 20271361301072.';
-- N = 20, the owner's number (DECISION_LOG "Seven open calls settled", item 5). Only where it is still unset; an admin
-- can change it later on Admin › Settings.
UPDATE public.platform_settings SET proof_real_guests_min = 20 WHERE id = 1 AND proof_real_guests_min IS NULL;

-- ── 2 · Stamps for a deleted celebration's surviving rows ────────────────────────────────────────────────────────────
ALTER TABLE public.vendor_reviews ADD COLUMN IF NOT EXISTS proof_at_delete BOOLEAN;
COMMENT ON COLUMN public.vendor_reviews.proof_at_delete IS
  'Fake proof fixes (C): whether this review''s celebration was arm''s length (vendor_event_proof_route not NULL), '
  'answered by the events_arms_length_proof_stamp trigger at the moment the couple deleted it. NULL while the event '
  'exists (read the rule then) and on a review orphaned before 20271361301072 — both count as NOT proven for an orphan.';
ALTER TABLE public.event_vendors ADD COLUMN IF NOT EXISTS proof_at_delete BOOLEAN;
-- event_vendors' browser SELECT is granted PER COLUMN (20271343340931): an ungranted column makes PostgREST refuse a
-- `select('*')` on the whole table. A non-secret boolean, so it is granted like every other non-amount column.
GRANT SELECT (proof_at_delete) ON public.event_vendors TO anon, authenticated;
COMMENT ON COLUMN public.event_vendors.proof_at_delete IS
  'Fake proof fixes (C): whether this booking''s celebration was arm''s length, stamped at the event''s delete by '
  'events_arms_length_proof_stamp. NULL while the event exists. An orphan without TRUE is not counted in events done.';

-- ── 3 · Who is "one couple" — the event's couple roster, its first account ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.event_couple_key(p_event_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT (min(em.user_id::TEXT))::UUID
    FROM public.event_members em
   WHERE em.event_id = p_event_id
     AND em.member_type = 'couple';
$$;
COMMENT ON FUNCTION public.event_couple_key(UUID) IS
  'Fake proof fixes (B): the couple ACCOUNT an event belongs to, for "N different couples" — the smallest user id on its '
  'couple roster. One account that holds five events is one couple. NULL when the roster is empty (counts as no couple). '
  'Limit, said once: two accounts co-hosting chains of events can still read as two. Service role only.';
REVOKE ALL ON FUNCTION public.event_couple_key(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.event_couple_key(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.event_couple_key(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.event_couple_key(UUID) TO service_role;

-- ── 4 · Real guests on an event — distinct people, never the shop's own or the hosts ────────────────────────────────
CREATE OR REPLACE FUNCTION public.event_real_guest_count(p_event_id UUID, p_vendor_profile_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH own_emails AS (
    -- The shop's owner and team, and the event's own hosts: none of them is a guest of the celebration.
    SELECT lower(u.email) AS email
      FROM public.vendor_profiles vp
      JOIN public.users u ON u.user_id = vp.user_id
     WHERE vp.vendor_profile_id = p_vendor_profile_id
    UNION
    SELECT lower(u.email)
      FROM public.vendor_team_members vtm
      JOIN public.users u ON u.user_id = vtm.user_id
     WHERE vtm.vendor_profile_id = p_vendor_profile_id
    UNION
    SELECT lower(u.email)
      FROM public.event_members em
      JOIN public.users u ON u.user_id = em.user_id
     WHERE em.event_id = p_event_id
       AND em.member_type = 'couple'
  )
  SELECT count(DISTINCT COALESCE(NULLIF(lower(btrim(g.email)), ''), g.guest_id::TEXT))::INTEGER
    FROM public.guests g
   WHERE g.event_id = p_event_id
     AND g.deleted_at IS NULL
     AND (
       (g.rsvp_responded_at IS NOT NULL AND g.rsvp_status::TEXT <> 'pending')
       OR EXISTS (
         SELECT 1 FROM public.papic_guest_captures c
          WHERE c.guest_id = g.guest_id
            AND c.event_id = p_event_id
       )
     )
     AND (g.email IS NULL OR lower(btrim(g.email)) NOT IN (SELECT email FROM own_emails WHERE email IS NOT NULL));
$$;
COMMENT ON FUNCTION public.event_real_guest_count(UUID, UUID) IS
  'Fake proof fixes (C): distinct guests of an event who RSVP''d (a reply on file) or captured Papic. One person = one '
  'email (else one guest row), so fifty rows typed with one address count once; the shop''s owner, its team and the '
  'event''s own hosts never count. Read only by vendor_event_proof_route. Service role only.';
REVOKE ALL ON FUNCTION public.event_real_guest_count(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.event_real_guest_count(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.event_real_guest_count(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.event_real_guest_count(UUID, UUID) TO service_role;

-- ── 5 · THE rule ─────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vendor_event_proof_route(p_vendor_profile_id UUID, p_event_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH vs AS (
    SELECT public.booking_fee_shop_verified_since(p_vendor_profile_id) AS since
  ),
  n AS (
    SELECT ps.proof_real_guests_min AS min_guests FROM public.platform_settings ps WHERE ps.id = 1
  )
  SELECT CASE
    WHEN p_vendor_profile_id IS NULL OR p_event_id IS NULL THEN NULL
    WHEN NOT EXISTS (SELECT 1 FROM public.events e WHERE e.event_id = p_event_id) THEN NULL
    -- The shipped self-dealing test (owner · team · internal · self-comp) still comes first.
    WHEN NOT public.vendor_booking_is_arms_length(p_vendor_profile_id, p_event_id) THEN NULL
    -- (1) Found on Setnayan, by a shop verified before it first touched this event.
    WHEN (SELECT since FROM vs) IS NOT NULL
     AND (SELECT since FROM vs) <= COALESCE(public.booking_fee_first_contact_at(p_vendor_profile_id, p_event_id), '-infinity'::TIMESTAMPTZ)
     AND public.booking_fee_attribution_for_event(p_vendor_profile_id, p_event_id) = 'sourced'
     AND public.booking_fee_attribution_for(p_vendor_profile_id, p_event_id) = 'sourced'
    THEN 'found_on_setnayan'
    -- (2) Real guests — only once the owner has set N.
    WHEN (SELECT min_guests FROM n) IS NOT NULL
     AND public.event_real_guest_count(p_event_id, p_vendor_profile_id) >= (SELECT min_guests FROM n)
    THEN 'real_guests'
    ELSE NULL
  END;
$$;
COMMENT ON FUNCTION public.vendor_event_proof_route(UUID, UUID) IS
  'Fake proof fixes (C), owner 2026-11-23 (b89e2420): THE one rule for whether a shop''s review / booking on an event '
  'moves its stars, medals and events done. found_on_setnayan = a Setnayan fact on this event, the fee rule agrees, '
  'and the shop was verified before its first contact · real_guests = at least platform_settings.proof_real_guests_min '
  'distinct guests RSVP''d or captured Papic (never while that is NULL) · NULL = does not count (the review still shows, '
  'as the supplier''s own client). Reads the fee functions, never changes them. Cached for public views in '
  'vendor_proof_events. Service role only. Migration 20271361301072.';
REVOKE ALL ON FUNCTION public.vendor_event_proof_route(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendor_event_proof_route(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.vendor_event_proof_route(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_event_proof_route(UUID, UUID) TO service_role;

-- ── 6 · The rule, cached for the public views (every shop × event that has a review or a finished job) ─────────────
-- Dependents are dropped first and rebuilt below.
DROP MATERIALIZED VIEW IF EXISTS public.vendor_trusted_review_stats;
DROP VIEW IF EXISTS public.vendor_service_trusted_review_stats;
DROP MATERIALIZED VIEW IF EXISTS public.vendor_public_completed_events_stats;
DROP VIEW IF EXISTS public.vendor_reviews_public;
DROP MATERIALIZED VIEW IF EXISTS public.vendor_proof_events;

CREATE MATERIALIZED VIEW public.vendor_proof_events AS
  WITH pairs AS (
    SELECT DISTINCT r.vendor_profile_id, r.event_id
      FROM public.vendor_reviews r
     WHERE r.event_id IS NOT NULL
    UNION
    SELECT DISTINCT ev.linked_vendor_profile_id, ev.event_id
      FROM public.event_vendors ev
     WHERE ev.event_id IS NOT NULL
       AND ev.linked_vendor_profile_id IS NOT NULL
       AND ev.status = ANY (ARRAY['delivered'::vendor_status, 'complete'::vendor_status])
  ),
  routed AS (
    SELECT p.vendor_profile_id, p.event_id, public.vendor_event_proof_route(p.vendor_profile_id, p.event_id) AS route
      FROM pairs p
  )
  SELECT vendor_profile_id, event_id, route
    FROM routed
   WHERE route IS NOT NULL;

CREATE UNIQUE INDEX vendor_proof_events_pk
  ON public.vendor_proof_events USING btree (vendor_profile_id, event_id);
REVOKE ALL ON public.vendor_proof_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.vendor_proof_events TO service_role;
COMMENT ON MATERIALIZED VIEW public.vendor_proof_events IS
  'Fake proof fixes (C): every (shop, event) whose review or finished job counts as proof — vendor_event_proof_route '
  'cached, because the public stats views cannot call a service-role function. Refreshed FIRST by every stats refresh '
  '(refresh_vendor_review_stats · refresh_vendor_completed_events_stats · fake_proof_refresh_counts). Server-only.';

-- ── 7 · The shop's headline stars — 20271341273990 verbatim + the two lines marked ⟵ PROOF and ⟵ HELD ──────────────
CREATE MATERIALIZED VIEW public.vendor_trusted_review_stats AS
 SELECT vp.vendor_profile_id,
    COALESCE(avg(vr.rating_overall)::numeric(3,2), 0::numeric) AS trusted_avg_rating,
    count(vr.review_id)::integer AS trusted_review_count
   FROM public.vendor_profiles vp
     LEFT JOIN public.vendor_reviews vr
       ON vr.vendor_profile_id = vp.vendor_profile_id
      AND vr.booked_through_setnayan = true
      AND vr.voided_by_fraud = false
      AND (vr.event_id IS NULL OR EXISTS (
            SELECT 1 FROM public.events e WHERE e.event_id = vr.event_id))
      -- ⟵ TOP-UP (owner 2026-11-12): a review from an event whose booking-fee top-up is OVERDUE is uncounted until settled.
      AND NOT public.booking_fee_top_up_overdue(vr.vendor_profile_id, vr.event_id)
      -- ⟵ PROOF (owner 2026-11-23, b89e2420 C): only an arm's-length event moves the stars.
      AND (CASE WHEN vr.event_id IS NULL THEN vr.proof_at_delete IS TRUE
                ELSE EXISTS (SELECT 1 FROM public.vendor_proof_events pe
                              WHERE pe.vendor_profile_id = vr.vendor_profile_id AND pe.event_id = vr.event_id) END)
      -- ⟵ HELD (owner 2026-11-23, b89e2420 D): a review the screener flagged waits for an admin's Dismiss.
      AND NOT EXISTS (SELECT 1 FROM public.integrity_flags f
                       WHERE f.kind = 'review_fraud' AND f.subject_review_id = vr.review_id
                         AND f.status IN ('open', 'confirmed_fraud'))
      AND NOT EXISTS (
            SELECT 1 FROM public.event_members em
             WHERE em.event_id = vr.event_id AND em.member_type = 'couple'
               AND em.user_id = vp.user_id)
      AND NOT EXISTS (
            SELECT 1 FROM public.event_members em
              JOIN public.vendor_team_members vtm
                ON vtm.user_id = em.user_id AND vtm.vendor_profile_id = vp.vendor_profile_id
             WHERE em.event_id = vr.event_id AND em.member_type = 'couple')
      AND NOT EXISTS (
            SELECT 1 FROM public.event_members em
              JOIN public.users u ON u.user_id = em.user_id
             WHERE em.event_id = vr.event_id AND em.member_type = 'couple'
               AND u.is_internal = true
               AND (u.user_id = vp.user_id OR EXISTS (
                     SELECT 1 FROM public.vendor_team_members vtm2
                      WHERE vtm2.vendor_profile_id = vp.vendor_profile_id
                        AND vtm2.user_id = u.user_id)))
      AND NOT EXISTS (
            SELECT 1 FROM public.comp_grants cg
             WHERE cg.vendor_profile_id = vp.vendor_profile_id
               AND cg.source = 'vendor_self_comp'
               AND EXISTS (
                     SELECT 1 FROM public.event_members em3
                      WHERE em3.event_id = vr.event_id AND em3.member_type = 'couple'
                        AND em3.user_id = cg.created_by_user_id))
  GROUP BY vp.vendor_profile_id;

CREATE UNIQUE INDEX vendor_trusted_review_stats_vendor_profile_id_uidx
  ON public.vendor_trusted_review_stats USING btree (vendor_profile_id);

REVOKE ALL ON public.vendor_trusted_review_stats FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vendor_trusted_review_stats TO anon, authenticated;
GRANT ALL    ON public.vendor_trusted_review_stats TO service_role;

COMMENT ON MATERIALIZED VIEW public.vendor_trusted_review_stats IS
  'THE public headline rating. Counts a review whose event still exists OR that '
  'was orphaned by the couple deleting their celebration (slice 1). Orphans are '
  'arm''s-length by construction: keep_only_arms_length_reviews_on_event_delete() '
  'destroys a self-dealt review before the FK can orphan it. Since 20271341273990 '
  'a review from an event whose booking-fee top-up is overdue is uncounted until settled. '
  'Since 20271361301072 only an ARM''S-LENGTH event counts (vendor_proof_events; an orphan by its proof_at_delete '
  'stamp) and a review the screener flagged is held until an admin dismisses the flag.';

-- ── 8 · Each service card's stars — the SAME added lines (held word for word by the mirror test) ─────────────────────
CREATE VIEW public.vendor_service_trusted_review_stats AS
SELECT vr.vendor_profile_id,
       vr.service_id,
       COALESCE(avg(vr.rating_overall)::numeric(3,2), 0::numeric) AS trusted_avg_rating,
       count(vr.review_id)::integer AS trusted_review_count
  FROM public.vendor_profiles vp
  JOIN public.vendor_reviews vr
    ON vr.vendor_profile_id = vp.vendor_profile_id
   AND vr.service_id IS NOT NULL
      AND vr.booked_through_setnayan = true
      AND vr.voided_by_fraud = false
      AND (vr.event_id IS NULL OR EXISTS (
            SELECT 1 FROM public.events e WHERE e.event_id = vr.event_id))
      -- ⟵ TOP-UP (owner 2026-11-12): a review from an event whose booking-fee top-up is OVERDUE is uncounted until settled.
      AND NOT public.booking_fee_top_up_overdue(vr.vendor_profile_id, vr.event_id)
      -- ⟵ PROOF (owner 2026-11-23, b89e2420 C): only an arm's-length event moves the stars.
      AND (CASE WHEN vr.event_id IS NULL THEN vr.proof_at_delete IS TRUE
                ELSE EXISTS (SELECT 1 FROM public.vendor_proof_events pe
                              WHERE pe.vendor_profile_id = vr.vendor_profile_id AND pe.event_id = vr.event_id) END)
      -- ⟵ HELD (owner 2026-11-23, b89e2420 D): a review the screener flagged waits for an admin's Dismiss.
      AND NOT EXISTS (SELECT 1 FROM public.integrity_flags f
                       WHERE f.kind = 'review_fraud' AND f.subject_review_id = vr.review_id
                         AND f.status IN ('open', 'confirmed_fraud'))
      AND NOT EXISTS (
            SELECT 1 FROM public.event_members em
             WHERE em.event_id = vr.event_id AND em.member_type = 'couple'
               AND em.user_id = vp.user_id)
      AND NOT EXISTS (
            SELECT 1 FROM public.event_members em
              JOIN public.vendor_team_members vtm
                ON vtm.user_id = em.user_id AND vtm.vendor_profile_id = vp.vendor_profile_id
             WHERE em.event_id = vr.event_id AND em.member_type = 'couple')
      AND NOT EXISTS (
            SELECT 1 FROM public.event_members em
              JOIN public.users u ON u.user_id = em.user_id
             WHERE em.event_id = vr.event_id AND em.member_type = 'couple'
               AND u.is_internal = true
               AND (u.user_id = vp.user_id OR EXISTS (
                     SELECT 1 FROM public.vendor_team_members vtm2
                      WHERE vtm2.vendor_profile_id = vp.vendor_profile_id
                        AND vtm2.user_id = u.user_id)))
      AND NOT EXISTS (
            SELECT 1 FROM public.comp_grants cg
             WHERE cg.vendor_profile_id = vp.vendor_profile_id
               AND cg.source = 'vendor_self_comp'
               AND EXISTS (
                     SELECT 1 FROM public.event_members em3
                      WHERE em3.event_id = vr.event_id AND em3.member_type = 'couple'
                        AND em3.user_id = cg.created_by_user_id))
 GROUP BY vr.vendor_profile_id, vr.service_id;

REVOKE ALL ON public.vendor_service_trusted_review_stats FROM PUBLIC;
REVOKE ALL ON public.vendor_service_trusted_review_stats FROM anon, authenticated;
GRANT SELECT ON public.vendor_service_trusted_review_stats TO service_role;

COMMENT ON VIEW public.vendor_service_trusted_review_stats IS
  'The hosts'' trusted average and count PER SERVICE CARD — the card''s own review line (prototype 6 Nov § 4). Same arm''s-length filter as vendor_trusted_review_stats (held by card-review-stats-mirror-the-shop.test.ts), including the overdue-top-up line (20271341273990) and the PROOF + HELD lines (20271361301072). Server-only.';

-- ── 9 · "Events done" — 20271348281460 verbatim + ⟵ PROOF and the fourth supplier-brought source ────────────────────
CREATE MATERIALIZED VIEW public.vendor_public_completed_events_stats AS
 SELECT vp.vendor_profile_id,
    count(ev.vendor_id)::integer AS public_completed_count
   FROM public.vendor_profiles vp
     LEFT JOIN public.event_vendors ev
       ON ev.linked_vendor_profile_id = vp.vendor_profile_id
      AND (ev.status = ANY (ARRAY['delivered'::vendor_status, 'complete'::vendor_status]))
      AND ev.voided_by_fraud = false
      -- A client the SUPPLIER brought in — their invite, their booked one-use code, a reused booking, their Shortlist
      -- QR (⟵ PROOF 2026-11-23: the badge reads it as theirs, as booking_fee_attribution_for_event already does) —
      -- does not count toward Completed bookings.
      AND COALESCE(ev.source, '') NOT IN ('vendor_invite', 'vendor_locked_qr', 'reuse_accept', 'vendor_shortlist_qr')
      AND (ev.event_id IS NULL OR EXISTS (
            SELECT 1 FROM public.events e WHERE e.event_id = ev.event_id))
      -- ⟵ PROOF (owner 2026-11-23, b89e2420 C): only an arm's-length event is an event done.
      AND (CASE WHEN ev.event_id IS NULL THEN ev.proof_at_delete IS TRUE
                ELSE EXISTS (SELECT 1 FROM public.vendor_proof_events pe
                              WHERE pe.vendor_profile_id = vp.vendor_profile_id AND pe.event_id = ev.event_id) END)
      AND NOT EXISTS (
            SELECT 1 FROM public.event_members em
             WHERE em.event_id = ev.event_id AND em.member_type = 'couple'
               AND em.user_id = vp.user_id)
      AND NOT EXISTS (
            SELECT 1 FROM public.event_members em
              JOIN public.vendor_team_members vtm
                ON vtm.user_id = em.user_id AND vtm.vendor_profile_id = vp.vendor_profile_id
             WHERE em.event_id = ev.event_id AND em.member_type = 'couple')
      AND NOT EXISTS (
            SELECT 1 FROM public.event_members em
              JOIN public.users u ON u.user_id = em.user_id
             WHERE em.event_id = ev.event_id AND em.member_type = 'couple'
               AND u.is_internal = true
               AND (u.user_id = vp.user_id OR EXISTS (
                     SELECT 1 FROM public.vendor_team_members vtm2
                      WHERE vtm2.vendor_profile_id = vp.vendor_profile_id
                        AND vtm2.user_id = u.user_id)))
      AND NOT EXISTS (
            SELECT 1 FROM public.comp_grants cg
             WHERE cg.vendor_profile_id = vp.vendor_profile_id
               AND cg.source = 'vendor_self_comp'
               AND (cg.order_id = ev.vendor_id OR EXISTS (
                     SELECT 1 FROM public.event_members em3
                      WHERE em3.event_id = ev.event_id AND em3.member_type = 'couple'
                        AND em3.user_id = cg.created_by_user_id)))
  GROUP BY vp.vendor_profile_id;

CREATE UNIQUE INDEX vendor_public_completed_events_stats_pk
  ON public.vendor_public_completed_events_stats USING btree (vendor_profile_id);
REVOKE ALL ON public.vendor_public_completed_events_stats FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vendor_public_completed_events_stats TO anon, authenticated;
GRANT ALL    ON public.vendor_public_completed_events_stats TO service_role;

COMMENT ON MATERIALIZED VIEW public.vendor_public_completed_events_stats IS
  'The public finished-jobs count behind the experience tier. Counts a booking '
  'whose event still exists OR that slice 2 preserved — and slice 2 only ever '
  'preserves an arm''s-length, really-booked, marketplace-linked row. A client the supplier brought in (vendor_invite · '
  'vendor_locked_qr · reuse_accept · vendor_shortlist_qr) is not counted (owner 2026-11-16, fd5814dc (3)). Since '
  '20271361301072 only an ARM''S-LENGTH event counts (vendor_proof_events; an orphan by its proof_at_delete stamp).';

-- ── 10 · The /v/[slug] track record — 20271153196986 verbatim + ⟵ PROOF ─────────────────────────────────────────────
-- CREATE OR REPLACE keeps the view's grants (anon, authenticated SELECT) and its columns; only the WHERE grows.
CREATE OR REPLACE VIEW public.vendor_completed_events AS
 SELECT vp.vendor_profile_id,
    ev.vendor_id,
    ev.event_id,
    COALESCE(e.event_type, ev.event_type_at_delete) AS event_type,
    COALESCE(e.event_date, ev.event_date_at_delete) AS event_date,
    COALESCE(ev.updated_at, COALESCE(e.event_date, ev.event_date_at_delete)::timestamp with time zone) AS completed_at
   FROM vendor_profiles vp
     JOIN event_vendors ev ON ev.linked_vendor_profile_id = vp.vendor_profile_id
       AND (ev.status = ANY (ARRAY['delivered'::vendor_status, 'complete'::vendor_status]))
       AND ev.voided_by_fraud = false
     LEFT JOIN events e ON e.event_id = ev.event_id
  WHERE NOT (EXISTS ( SELECT 1
           FROM event_members em
          WHERE em.event_id = ev.event_id AND em.member_type = 'couple'::member_type AND em.user_id = vp.user_id)) AND NOT (EXISTS ( SELECT 1
           FROM event_members em
             JOIN vendor_team_members vtm ON vtm.user_id = em.user_id AND vtm.vendor_profile_id = vp.vendor_profile_id
          WHERE em.event_id = ev.event_id AND em.member_type = 'couple'::member_type)) AND NOT (EXISTS ( SELECT 1
           FROM event_members em
             JOIN users u ON u.user_id = em.user_id
          WHERE em.event_id = ev.event_id AND em.member_type = 'couple'::member_type AND u.is_internal = true AND (u.user_id = vp.user_id OR (EXISTS ( SELECT 1
                   FROM vendor_team_members vtm2
                  WHERE vtm2.vendor_profile_id = vp.vendor_profile_id AND vtm2.user_id = u.user_id))))) AND NOT (EXISTS ( SELECT 1
           FROM comp_grants cg
          WHERE cg.vendor_profile_id = vp.vendor_profile_id AND cg.source = 'vendor_self_comp'::text AND (cg.order_id = ev.vendor_id OR (EXISTS ( SELECT 1
                   FROM event_members em3
                  WHERE em3.event_id = ev.event_id AND em3.member_type = 'couple'::member_type AND em3.user_id = cg.created_by_user_id)))))
    -- ⟵ PROOF (owner 2026-11-23, b89e2420 C): only an arm's-length event is on the track record.
    AND (CASE WHEN ev.event_id IS NULL THEN ev.proof_at_delete IS TRUE
              ELSE EXISTS (SELECT 1 FROM vendor_proof_events pe
                            WHERE pe.vendor_profile_id = vp.vendor_profile_id AND pe.event_id = ev.event_id) END);

-- ── 11 · The public review LIST's one read: held reviews never publish; each says whether it counts ─────────────────
CREATE VIEW public.vendor_reviews_public AS
SELECT vr.*,
       (vr.booked_through_setnayan
        AND (CASE WHEN vr.event_id IS NULL THEN vr.proof_at_delete IS TRUE
                  ELSE EXISTS (SELECT 1 FROM public.vendor_proof_events pe
                                WHERE pe.vendor_profile_id = vr.vendor_profile_id AND pe.event_id = vr.event_id) END)
       ) AS counts_as_proof
  FROM public.vendor_reviews vr
 WHERE NOT EXISTS (SELECT 1 FROM public.integrity_flags f
                    WHERE f.kind = 'review_fraud' AND f.subject_review_id = vr.review_id
                      AND f.status IN ('open', 'confirmed_fraud'));
REVOKE ALL ON public.vendor_reviews_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vendor_reviews_public TO service_role;
COMMENT ON VIEW public.vendor_reviews_public IS
  'Fake proof fixes (C + D): the reviews a PUBLIC page may list — every vendor_reviews row except one the screener '
  'flagged (integrity_flags open / confirmed_fraud: held for an admin''s Dismiss) — with counts_as_proof: TRUE when it '
  'moves the stars (a booked-through review from an arm''s-length event). FALSE on a booked review renders the shipped '
  '"Verified booking" pill (the supplier''s own client). Read by lib/reviews.ts fetchReviewsForVendor({ publicOnly }). '
  'Service role only.';

-- ── 12 · The badge facts — 20271348906302 verbatim + ⟵ A · ⟵ B · ⟵ C · ⟵ D ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.service_card_badge_facts(p_vendor_profile_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH shop AS (
    SELECT vp.vendor_profile_id AS vpid,
           vp.last_verified_at,
           (vp.fraud_suspended_at IS NULL AND vp.fraud_banned_at IS NULL) AS good_standing
      FROM public.vendor_profiles vp
     WHERE vp.vendor_profile_id = p_vendor_profile_id
  ),
  cards AS (
    SELECT vs.vendor_service_id AS id,
           (vs.is_active AND vs.taken_down_at IS NULL AND NOT vs.is_demo) AS published
      FROM public.vendor_services vs
      JOIN shop ON shop.vpid = vs.vendor_profile_id
  ),
  paid AS (
    SELECT ev.service_id AS id, ev.event_id, ev.vendor_id
      FROM public.event_vendors ev
      JOIN shop ON shop.vpid = ev.marketplace_vendor_id
      JOIN public.events e ON e.event_id = ev.event_id
     WHERE ev.service_id IN (SELECT id FROM cards)
       AND ev.status::TEXT IN ('deposit_paid', 'delivered', 'complete')
       AND ev.deposit_recorded_at >= NOW() - INTERVAL '30 days'
       AND ev.archived_at IS NULL
       AND ev.voided_by_fraud = FALSE
       AND e.archived = FALSE
       AND public.vendor_booking_is_arms_length(shop.vpid, ev.event_id, ev.vendor_id)
       -- An import is never a booking a badge counts (owner 16 Nov, DECISION_LOG fd5814dc): the shop's invite, Locked QR,
       -- a reused booking, or a couple who arrived on the shop's own link (?src=own). ONE rule, the booking fee's own.
       AND public.booking_fee_attribution_for(shop.vpid, ev.event_id) = 'sourced'
  ),
  paid_n AS (
    SELECT p.id,
           COUNT(*)::INT                  AS paid_bookings,
           -- ⟵ B (owner 2026-11-23, b89e2420): different couples are different couple ACCOUNTS, not events.
           COUNT(DISTINCT public.event_couple_key(p.event_id))::INT AS paid_couples,
           COUNT(*) FILTER (WHERE EXISTS (
             SELECT 1
               FROM public.vendor_proposals pr
               JOIN public.vendor_proposal_shop_gifts g ON g.proposal_id = pr.proposal_id
              WHERE pr.event_id = p.event_id
                AND pr.vendor_profile_id = p_vendor_profile_id
                AND pr.status = 'accepted'
                AND COALESCE(pr.service_card_ids, '[]'::JSONB) ? p.id::TEXT
           ))::INT                         AS paid_with_gift
      FROM paid p
     GROUP BY p.id
  ),
  rev AS (
    SELECT r.service_id AS id, r.event_id, r.rating_overall
      FROM public.vendor_reviews r
     WHERE r.vendor_profile_id = p_vendor_profile_id
       AND r.service_id IN (SELECT id FROM cards)
       AND r.created_at >= NOW() - INTERVAL '30 days'
       AND r.voided_by_fraud = FALSE
       AND r.booked_through_setnayan = TRUE
       -- …nor a review of an imported booking (DECISION_LOG fd5814dc).
       AND public.booking_fee_attribution_for(p_vendor_profile_id, r.event_id) = 'sourced'
       -- ⟵ C (owner 2026-11-23, b89e2420): only a review from an arm's-length event moves a medal — the one rule.
       AND public.vendor_event_proof_route(p_vendor_profile_id, r.event_id) IS NOT NULL
       -- ⟵ D: a review the screener flagged is held until an admin dismisses the flag.
       AND NOT EXISTS (SELECT 1 FROM public.integrity_flags f
                        WHERE f.kind = 'review_fraud' AND f.subject_review_id = r.review_id
                          AND f.status IN ('open', 'confirmed_fraud'))
  ),
  rev_n AS (
    SELECT x.id,
           SUM(LEAST(x.fives, 2))::INT AS five_star_capped,
           SUM(x.unders)::INT          AS under_four
      FROM (
        SELECT id, event_id,
               COUNT(*) FILTER (WHERE rating_overall = 5) AS fives,
               COUNT(*) FILTER (WHERE rating_overall < 4) AS unders
          FROM rev
         GROUP BY id, event_id
      ) x
     GROUP BY x.id
  ),
  asks AS (
    SELECT ti.vendor_service_id AS id, ti.thread_id, ti.created_at AS asked_at, ct.event_id,
           public.event_couple_key(ct.event_id) AS couple_key,
           (ti.status = 'withdrawn') AS withdrawn
      FROM public.thread_service_interests ti
      JOIN public.chat_threads ct ON ct.thread_id = ti.thread_id
     WHERE ct.vendor_profile_id = p_vendor_profile_id
       AND ti.vendor_service_id IN (SELECT id FROM cards)
       AND ti.created_at >= NOW() - INTERVAL '60 days'
       -- ⟵ A (owner 2026-11-23, b89e2420): only an interest the COUPLE raised is an inquiry. The shop's own offer
       --   (added_by_role 'vendor', source 'vendor_offered') is followed by its own message a moment later, so it
       --   scored as answered inside the hour — and it padded Trending Now too.
       AND ti.added_by_role = 'couple'
       AND ti.source <> 'vendor_offered'
  ),
  trend_n AS (
    SELECT id,
           -- ⟵ B: different couples are different couple ACCOUNTS.
           COUNT(DISTINCT couple_key) FILTER (WHERE asked_at >= NOW() - INTERVAL '30 days')::INT AS couples_now,
           COUNT(DISTINCT couple_key) FILTER (WHERE asked_at <  NOW() - INTERVAL '30 days')::INT AS couples_before
      FROM asks
     GROUP BY id
  ),
  replies AS (
    SELECT a.id,
           JSONB_AGG(JSONB_BUILD_OBJECT(
             'asked_at', a.asked_at,
             'replied_at', (
               SELECT MIN(m.created_at)
                 FROM public.chat_messages m
                WHERE m.thread_id = a.thread_id
                  AND m.sender_role::TEXT = 'vendor'
                  AND m.is_bot = FALSE
                  AND m.created_at >= a.asked_at
             ),
             'withdrawn', a.withdrawn
           ) ORDER BY a.asked_at) AS list
      FROM asks a
     WHERE a.asked_at >= NOW() - INTERVAL '30 days'
     GROUP BY a.id
  )
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM shop) THEN NULL ELSE JSONB_BUILD_OBJECT(
    'verified_since', (SELECT last_verified_at FROM shop),
    'good_standing', (SELECT good_standing FROM shop),
    'cards', COALESCE((
      SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
               'id', c.id,
               'published', c.published,
               'paid_bookings', COALESCE(pn.paid_bookings, 0),
               'paid_couples', COALESCE(pn.paid_couples, 0),
               'paid_with_gift', COALESCE(pn.paid_with_gift, 0),
               'five_star_capped', COALESCE(rn.five_star_capped, 0),
               'under_four', COALESCE(rn.under_four, 0),
               'couples_now', COALESCE(tn.couples_now, 0),
               'couples_before', COALESCE(tn.couples_before, 0),
               'inquiries', COALESCE(rp.list, '[]'::JSONB)
             ))
        FROM cards c
        LEFT JOIN paid_n  pn ON pn.id = c.id
        LEFT JOIN rev_n   rn ON rn.id = c.id
        LEFT JOIN trend_n tn ON tn.id = c.id
        LEFT JOIN replies rp ON rp.id = c.id
    ), '[]'::JSONB)
  ) END;
$$;

COMMENT ON FUNCTION public.service_card_badge_facts(UUID) IS
  'Badge build J3: the raw 30-day numbers per service card of one shop (paid bookings · distinct couple ACCOUNTS · bookings with a shop gift · five-star reviews capped at 2 per event · reviews under 4 · distinct inquiring couple accounts now and the 30 days before · each inquiry''s asked/replied time). No thresholds — apps/web/lib/card-badges.ts decides. NULL when the shop does not exist (a failed read, never zero). Since 20271361301072 (fake proof fixes A–D): an inquiry is one the COUPLE raised (never the shop''s own vendor_offered card), couples are accounts (event_couple_key), a review counts only from an arm''s-length event (vendor_event_proof_route) and never while the screener holds it. Reads other couples'' events: service_role only.';

REVOKE ALL ON FUNCTION public.service_card_badge_facts(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.service_card_badge_facts(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.service_card_badge_facts(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.service_card_badge_facts(UUID) TO service_role;

-- ── 13 · Answer the question once, while it can be answered: the delete stamp ───────────────────────────────────────
-- ⚠ NAMED `events_arms_length_proof_stamp` ON PURPOSE: BEFORE triggers fire alphabetically, and this must run before
-- `events_arms_length_reviews_on_delete` ('p' < 'r') and `events_keep_supplier_bookings_on_delete`, while the chat
-- threads, guests, captures and roster the rule reads still exist.
CREATE OR REPLACE FUNCTION public.stamp_proof_on_event_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.vendor_reviews vr
     SET proof_at_delete = (public.vendor_event_proof_route(vr.vendor_profile_id, OLD.event_id) IS NOT NULL)
   WHERE vr.event_id = OLD.event_id;
  UPDATE public.event_vendors ev
     SET proof_at_delete = (ev.linked_vendor_profile_id IS NOT NULL
                            AND public.vendor_event_proof_route(ev.linked_vendor_profile_id, OLD.event_id) IS NOT NULL)
   WHERE ev.event_id = OLD.event_id;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.stamp_proof_on_event_delete() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stamp_proof_on_event_delete() FROM anon;
REVOKE ALL ON FUNCTION public.stamp_proof_on_event_delete() FROM authenticated;

DROP TRIGGER IF EXISTS events_arms_length_proof_stamp ON public.events;
CREATE TRIGGER events_arms_length_proof_stamp
  BEFORE DELETE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.stamp_proof_on_event_delete();

-- 🔒 THE ROW IS YOURS, THE FIELD IS NOT. Both tables grant INSERT/UPDATE at TABLE level, so a column revoke is inert,
-- and `vendor_reviews_vendor_reply` lets a supplier update its own review with no `event_id IS NOT NULL` clause — so a
-- supplier could otherwise set its own ORPHANED review's proof_at_delete to TRUE and forge proof. A browser role
-- (current_user anon / authenticated — never auth.role(), which the PGlite shim cannot null) never writes the stamp:
-- an insert reads NULL, an update keeps the old value. The stamp's only writer is the definer-owned delete trigger.
-- Deliberately NOT SECURITY DEFINER: it must see the caller.
CREATE OR REPLACE FUNCTION public.proof_at_delete_is_not_yours()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.proof_at_delete := NULL;
    ELSE
      NEW.proof_at_delete := OLD.proof_at_delete;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.proof_at_delete_is_not_yours() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.proof_at_delete_is_not_yours() FROM anon;
REVOKE ALL ON FUNCTION public.proof_at_delete_is_not_yours() FROM authenticated;

DROP TRIGGER IF EXISTS vendor_reviews_proof_at_delete_is_not_yours ON public.vendor_reviews;
CREATE TRIGGER vendor_reviews_proof_at_delete_is_not_yours
  BEFORE INSERT OR UPDATE ON public.vendor_reviews
  FOR EACH ROW EXECUTE FUNCTION public.proof_at_delete_is_not_yours();
DROP TRIGGER IF EXISTS event_vendors_proof_at_delete_is_not_yours ON public.event_vendors;
CREATE TRIGGER event_vendors_proof_at_delete_is_not_yours
  BEFORE INSERT OR UPDATE ON public.event_vendors
  FOR EACH ROW EXECUTE FUNCTION public.proof_at_delete_is_not_yours();

-- ── 14 · Every stats refresh reads the rule fresh first ─────────────────────────────────────────────────────────────
-- 20270516600000 verbatim + the one line marked ⟵ PROOF in each.
CREATE OR REPLACE FUNCTION public.refresh_vendor_review_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.identity_clusters;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.vendor_proof_events;   -- ⟵ PROOF
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.vendor_review_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.vendor_trusted_review_stats;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'refresh_vendor_review_stats failed: %', SQLERRM;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_vendor_completed_events_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.identity_clusters;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.vendor_proof_events;   -- ⟵ PROOF
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.vendor_public_completed_events_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.vendor_full_completed_events_stats;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'refresh_vendor_completed_events_stats failed: %', SQLERRM;
  RETURN NULL;
END;
$$;

-- The daily top-up re-read (20271341273990) also re-reads the rule — it is what catches guests who RSVP'd since.
CREATE OR REPLACE FUNCTION public.booking_fee_top_up_refresh_stars()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.vendor_proof_events;   -- ⟵ PROOF
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.vendor_trusted_review_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.vendor_public_completed_events_stats;   -- ⟵ PROOF
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'booking_fee_top_up_refresh_stars: %', SQLERRM;
END;
$$;
REVOKE ALL ON FUNCTION public.booking_fee_top_up_refresh_stars() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_top_up_refresh_stars() TO service_role;

-- Setting N, or a held review being flagged or released, re-reads the counts at once.
CREATE OR REPLACE FUNCTION public.fake_proof_refresh_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.vendor_proof_events;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.vendor_trusted_review_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.vendor_public_completed_events_stats;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fake_proof_refresh_counts: %', SQLERRM;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.fake_proof_refresh_counts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fake_proof_refresh_counts() FROM anon;
REVOKE ALL ON FUNCTION public.fake_proof_refresh_counts() FROM authenticated;

DROP TRIGGER IF EXISTS platform_settings_proof_min_refreshes_counts ON public.platform_settings;
CREATE TRIGGER platform_settings_proof_min_refreshes_counts
  AFTER UPDATE OF proof_real_guests_min ON public.platform_settings
  FOR EACH STATEMENT EXECUTE FUNCTION public.fake_proof_refresh_counts();

DROP TRIGGER IF EXISTS integrity_flags_hold_refreshes_counts ON public.integrity_flags;
CREATE TRIGGER integrity_flags_hold_refreshes_counts
  AFTER INSERT OR DELETE OR UPDATE OF status ON public.integrity_flags
  FOR EACH STATEMENT EXECUTE FUNCTION public.fake_proof_refresh_counts();

COMMIT;
