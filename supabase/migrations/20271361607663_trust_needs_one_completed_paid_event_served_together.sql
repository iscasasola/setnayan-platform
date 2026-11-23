-- trust_needs_one_completed_paid_event_served_together
-- Created via `pnpm migration:new`. Idempotent: ADD COLUMN IF NOT EXISTS · DROP CONSTRAINT IF EXISTS · CREATE OR REPLACE
-- FUNCTION. No table, no policy, no trigger, and no data is written (the new setting is left blank for the owner).
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 🤝 THE RULINGS (specs DECISION_LOG, owner to the controller, 21 Nov 2026). Replaces closed #8087, which was built to
-- the earlier "any completed, paid booking" reading.
--
--   · "TRUST NEEDS ONE COMPLETED, PAID EVENT THE TWO SHOPS SERVED TOGETHER" — *"we need the both of you to be in the
--     same event."* A linked shop shows as trusted (Partners list, "Trusted by", the badge, the search count) only once
--     BOTH shops served the SAME event, completed and paid through Setnayan. "Served the same event" stays decided in
--     ONE place, `vendor_served_together_rows`, narrowed here to completed and paid. Until then the Partners list says
--     "Waiting for your first event together", on the shop's own page only.
--   · "PARTNERSHIPS — INVITE A SUPPLIER ON SHOP, APPROVED TO BUILD (drawing v7)" + the controller's call on its flagged
--     risk: a NEW shop created through the inviter's link (`brought_new_shop`) is trusted at once, but it counts toward
--     the search lift only after its first completed, paid booking through Setnayan.
--   · "TRUSTED SHOPS RANK HIGHER IN SEARCH" — only verified, published shops that are not internal or test count; a
--     shop's own branches never count; each shop counts once; more counts more with diminishing returns; any strength
--     number lives in an admin setting whose value is the owner's.
--
-- ── WHAT THIS DOES ──────────────────────────────────────────────────────────────────────────────────────────────────
--   1. platform_settings.trust_search_step — the diminishing-returns number, an admin setting. NULL (not set, the
--      seed) = trust lifts nobody yet. Set to b, each search step needs b times the trusted shops of the one below
--      (2 = steps at 1 · 2 · 4 · 8 …). The owner sets it on Admin › Settings.
--   2. public.booking_counts_for_trust(booking) — one booking counts when it is completed and paid through Setnayan:
--        · completed      = delivered/complete, not voided for fraud, completion not disputed, not archived;
--        · not cancelled  = no pending or agreed delete request;
--        · not test       = events.is_sample is not true;
--        · not internal   = no couple on the event is an internal account;
--        · a real event   = the ONE arm's-length rule, `vendor_event_proof_route` (owner 23 Nov, fake proof fixes C:
--                           found on Setnayan, or N real guests; it also refuses owner · team · self-comp);
--        · paid           = a payment the supplier confirmed (or a dispute ruled it stands), not refused, not a
--                           declined deposit (vendor_payday_installments arm 2 · lib/vendor-earnings.ts isEarnedPayment);
--        · not refunded   = no live event_vendor_refunds row.
--   3. public.vendor_served_together_rows — the shipped ONE definition, narrowed: both shops' bookings on the event
--      must count (2). Its readers move with it: the propose picker (partners_you_served_with), the insert trigger
--      (vendor_partnerships_need_a_shared_event), the automatic "Worked together" count (shop_worked_with_counts).
--   4. public.shop_trust(shops[]) — THE ONE READER of trust. One row per live partner of each given shop (an accepted,
--      active vendor_partnerships row, either direction): trusted (Trusted · or Waiting), counts (search and badges),
--      events together, the kinds and origins. lib/vendor-trusted-by.ts is its only caller.
--   5. public.shop_trust_counts(shops[]) — trusted · waiting · counted per shop, and the search step. Derived FROM (4),
--      never beside it.
--
-- ── WHAT IT DOES NOT TOUCH ──────────────────────────────────────────────────────────────────────────────────────────
--   • vendor_partnerships, its triggers' bodies and its RLS. Pending proposals made before today can still be accepted
--     (an UPDATE); only NEW worked-together proposals meet the narrowed check.
--   • The Trusted by BADGE counter (`shop_trusted_by_count`, clients who came back, owner 15 Nov) — said in the PR.
--   • Fee billing: booking_fee_* and vendor_event_proof_route are READ, never replaced.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ── 1 · the owner's number: how much more trust each search step needs ────────────────────────────────────────────
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS trust_search_step INTEGER;
ALTER TABLE public.platform_settings DROP CONSTRAINT IF EXISTS platform_settings_trust_search_step_range;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_trust_search_step_range
  CHECK (trust_search_step IS NULL OR (trust_search_step >= 2 AND trust_search_step <= 10));
COMMENT ON COLUMN public.platform_settings.trust_search_step IS
  'Owner 21 Nov 2026 ("TRUSTED SHOPS RANK HIGHER IN SEARCH" (5)): diminishing returns for trust in supplier search. '
  'Each step needs this many times the trusted shops of the step below (2 = steps at 1 · 2 · 4 · 8 …). NULL = not set: '
  'trust lifts nobody (fails toward the order as it was). The owner''s number; an admin sets it on Admin › Settings. '
  'Read only by public.shop_trust_counts. Migration 20271361607663.';

-- ── 2 · one booking that counts for trust ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.booking_counts_for_trust(p_booking uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.event_vendors ev
      JOIN public.events e
        ON e.event_id = ev.event_id
     WHERE ev.vendor_id = p_booking
       AND ev.marketplace_vendor_id IS NOT NULL
       -- completed
       AND ev.status IN ('delivered', 'complete')
       AND ev.archived_at IS NULL
       AND ev.voided_by_fraud IS NOT TRUE
       AND ev.completion_status IS DISTINCT FROM 'disputed'
       -- not cancelled
       AND COALESCE(ev.delete_request_state, '') NOT IN ('pending', 'agreed')
       -- not test
       AND COALESCE(e.is_sample, false) = false
       -- not internal: no couple on the event is an internal account
       AND NOT EXISTS (
             SELECT 1
               FROM public.event_members em
               JOIN public.users u ON u.user_id = em.user_id
              WHERE em.event_id = ev.event_id
                AND em.member_type = 'couple'
                AND u.is_internal IS TRUE)
       -- not refunded
       AND NOT EXISTS (
             SELECT 1 FROM public.event_vendor_refunds r
              WHERE r.event_vendor_id = ev.vendor_id
                AND r.removed_at IS NULL)
       -- paid (vendor_payday_installments arm 2 · isEarnedPayment)
       AND EXISTS (
             SELECT 1 FROM public.event_vendor_payments p
              WHERE p.vendor_id = ev.vendor_id
                AND (p.vendor_confirmed_at IS NOT NULL OR p.payment_dispute_outcome IS NOT DISTINCT FROM 'payment_stands')
                AND (p.payment_refused_at IS NULL OR p.payment_dispute_outcome IS NOT DISTINCT FROM 'payment_stands')
                AND p.payment_dispute_outcome IS DISTINCT FROM 'not_received'
                AND NOT (p.is_deposit_record
                         AND ev.deposit_declined_at IS NOT NULL
                         AND ev.deposit_acknowledged_at IS NULL))
       -- a real, arm's-length event: the ONE rule (owner 23 Nov, fake proof fixes C). Last, as the costliest test.
       AND public.vendor_event_proof_route(ev.marketplace_vendor_id, ev.event_id) IS NOT NULL
  );
$$;

COMMENT ON FUNCTION public.booking_counts_for_trust(uuid) IS
  'Owner 21 Nov 2026 ("TRUST NEEDS ONE COMPLETED, PAID EVENT THE TWO SHOPS SERVED TOGETHER"): TRUE when this '
  'event_vendors booking is completed and paid through Setnayan — delivered, not voided or disputed, not cancelled, '
  'not on a sample event, no internal couple, not refunded, a payment received, and arm''s length '
  '(vendor_event_proof_route). Read by vendor_served_together_rows and shop_trust only. Internal.';

REVOKE ALL ON FUNCTION public.booking_counts_for_trust(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_counts_for_trust(uuid) TO service_role;

-- ── 3 · "served the same event" — the shipped ONE definition, narrowed to completed and paid ────────────────────────
-- 20271329352320 verbatim, plus the two lines marked ⟵ TRUST. Same signature, so every reader moves with it.
CREATE OR REPLACE FUNCTION public.vendor_served_together_rows(p_vendor uuid)
RETURNS TABLE (
  other_vendor_profile_id uuid,
  event_id uuid,
  event_type text,
  event_date date,
  event_date_precision text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT
         theirs.marketplace_vendor_id AS other_vendor_profile_id,
         e.event_id,
         e.event_type,
         e.event_date,
         e.event_date_precision
    FROM public.event_vendors mine
    JOIN public.events e
      ON e.event_id = mine.event_id
    JOIN public.event_vendors theirs
      ON theirs.event_id = mine.event_id
   WHERE mine.marketplace_vendor_id = p_vendor
     AND theirs.marketplace_vendor_id IS NOT NULL
     AND theirs.marketplace_vendor_id <> p_vendor
     AND mine.status   IN ('contracted', 'deposit_paid', 'delivered', 'complete')
     AND theirs.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
     AND mine.archived_at IS NULL
     AND theirs.archived_at IS NULL
     AND COALESCE(mine.voided_by_fraud, false) = false
     AND COALESCE(theirs.voided_by_fraud, false) = false
     AND COALESCE(e.is_sample, false) = false
     AND e.event_date IS NOT NULL
     -- "Has passed" = the LAST day the stored date could mean is before today
     -- in Manila. A month- or year-precision date is not over until its whole
     -- month / year is.
     AND (CASE e.event_date_precision
            WHEN 'day'   THEN e.event_date
            WHEN 'month' THEN (date_trunc('month', e.event_date) + interval '1 month' - interval '1 day')::date
            WHEN 'year'  THEN (date_trunc('year',  e.event_date) + interval '1 year'  - interval '1 day')::date
          END) < (now() AT TIME ZONE 'Asia/Manila')::date
     -- Owner 21 Nov 2026: both shops' bookings on it completed and paid through Setnayan.
     AND public.booking_counts_for_trust(mine.vendor_id)     -- ⟵ TRUST
     AND public.booking_counts_for_trust(theirs.vendor_id);  -- ⟵ TRUST
$$;

REVOKE ALL ON FUNCTION public.vendor_served_together_rows(uuid) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.vendor_served_together_rows(uuid) IS
  'THE one definition of "served the same event" (owner 2026-11-06; narrowed 21 Nov 2026, "TRUST NEEDS ONE COMPLETED, '
  'PAID EVENT THE TWO SHOPS SERVED TOGETHER"). One row per (other shop, event) where both shops were booked on a '
  'non-sample event whose date has passed (Manila) AND both bookings count for trust (booking_counts_for_trust: '
  'completed, paid, arm''s length, not refunded, cancelled, internal or test). Internal — read through '
  'partners_you_served_with(), shop_worked_with_counts(), shop_trust() and the vendor_partnerships insert trigger.';

-- ── 4 · THE ONE READER: each live partner of a shop, Trusted or Waiting, and whether it counts ─────────────────────
CREATE OR REPLACE FUNCTION public.shop_trust(p_vendor_profile_ids uuid[])
RETURNS TABLE (
  vendor_profile_id       uuid,
  other_vendor_profile_id uuid,
  relationship_types      text[],
  origins                 text[],
  made_by_this_shop       boolean,
  brought_new_shop        boolean,
  events_together         integer,
  trusted                 boolean,
  counts                  boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH ties AS (
    -- One accepted, active row per pair (vendor_partnerships_unordered_pair_uidx), read from each given end.
    SELECT p.recommending_vendor_id AS me,
           p.recommended_vendor_id  AS other,
           p.relationship_type::text AS relationship_type,
           p.origin,
           true AS i_made,
           -- The invite that CREATED the other shop (the joiner is always the recommended end).
           (p.origin = 'invited' AND p.brought_new_shop) AS new_shop_tie,
           p.recommended_vendor_id AS joiner
      FROM public.vendor_partnerships p
     WHERE p.status = 'accepted'
       AND p.is_active
       AND p.recommending_vendor_id = ANY (p_vendor_profile_ids)
    UNION ALL
    SELECT p.recommended_vendor_id,
           p.recommending_vendor_id,
           p.relationship_type::text,
           p.origin,
           false,
           (p.origin = 'invited' AND p.brought_new_shop),
           p.recommended_vendor_id
      FROM public.vendor_partnerships p
     WHERE p.status = 'accepted'
       AND p.is_active
       AND p.recommended_vendor_id = ANY (p_vendor_profile_ids)
  ),
  pairs AS (
    SELECT t.me,
           t.other,
           array_agg(DISTINCT t.relationship_type ORDER BY t.relationship_type) AS relationship_types,
           array_agg(DISTINCT t.origin ORDER BY t.origin) AS origins,
           bool_or(t.i_made) AS i_made,
           bool_or(t.new_shop_tie AND t.i_made) AS brought_new_shop,
           bool_or(t.new_shop_tie) AS new_shop_tie,
           -- The shop a new-shop tie waits on: the joiner (one per pair).
           min(t.joiner::text) FILTER (WHERE t.new_shop_tie)::uuid AS joiner
      FROM ties t
     WHERE t.other <> t.me
     GROUP BY t.me, t.other
  ),
  together AS (
    -- "Served the same event, completed and paid" — the ONE definition, only for shops that have a partner.
    SELECT m.me, r.other_vendor_profile_id AS other, count(DISTINCT r.event_id)::integer AS events
      FROM (SELECT DISTINCT me FROM pairs) m
     CROSS JOIN LATERAL public.vendor_served_together_rows(m.me) r
     GROUP BY m.me, r.other_vendor_profile_id
  ),
  same_business AS (
    SELECT m.vendor_profile_id AS me, m.other_vendor_profile_id AS other
      FROM public.booking_fee_business_matches(ARRAY(SELECT DISTINCT me FROM pairs)) m
  ),
  judged AS (
    SELECT pr.*,
           COALESCE(tg.events, 0) AS events,
           -- The other shop may count: verified, published, papers current, not demo, owner not internal; not the same
           -- business (a shop's own branches · sister shops) and not run by the same people.
           (    o.verification_state = 'verified'
            AND o.public_visibility = 'verified'
            AND COALESCE(o.papers_current, false)
            AND COALESCE(o.is_demo, false) = false
            AND COALESCE(ou.is_internal, false) = false
            AND NOT EXISTS (SELECT 1 FROM same_business sb WHERE sb.me = pr.me AND sb.other = pr.other)
            AND o.user_id IS DISTINCT FROM mine.user_id
            AND NOT EXISTS (
                  SELECT 1 FROM public.vendor_team_members vtm
                   WHERE (vtm.vendor_profile_id = pr.me    AND vtm.user_id = o.user_id)
                      OR (vtm.vendor_profile_id = pr.other AND vtm.user_id = mine.user_id))
           ) AS eligible,
           -- A new shop's first completed, paid booking (the controller's call on drawing v7's flagged risk).
           (pr.new_shop_tie AND EXISTS (
              SELECT 1 FROM public.event_vendors jb
               WHERE jb.marketplace_vendor_id = pr.joiner
                 AND public.booking_counts_for_trust(jb.vendor_id))) AS new_shop_booked
      FROM pairs pr
      JOIN public.vendor_profiles mine ON mine.vendor_profile_id = pr.me
      JOIN public.vendor_profiles o    ON o.vendor_profile_id = pr.other
      LEFT JOIN public.users ou        ON ou.user_id = o.user_id
      LEFT JOIN together tg            ON tg.me = pr.me AND tg.other = pr.other
  )
  SELECT j.me,
         j.other,
         j.relationship_types,
         j.origins,
         j.i_made,
         j.brought_new_shop,
         j.events,
         (j.events > 0 OR j.new_shop_tie)                                AS trusted,
         (j.eligible AND (j.events > 0 OR (j.new_shop_tie AND j.new_shop_booked))) AS counts
    FROM judged j;
$$;

COMMENT ON FUNCTION public.shop_trust(uuid[]) IS
  'THE ONE READER of trust (owner 21 Nov 2026: "TRUST NEEDS ONE COMPLETED, PAID EVENT THE TWO SHOPS SERVED TOGETHER", '
  '"TRUSTED SHOPS RANK HIGHER IN SEARCH", drawing v7 + the controller''s call). One row per live partner of each given '
  'shop (an accepted, active vendor_partnerships row, either direction). trusted = the two served the same event, '
  'completed and paid (vendor_served_together_rows), or the partner is a NEW shop created through the link; otherwise '
  'Waiting. counts (search and badges) = trusted by a verified, published, current, non-demo, non-internal shop that is '
  'not the same business or the same people, and — for a new shop — only after its first completed, paid booking. '
  'Read through lib/vendor-trusted-by.ts only. Service role only. Migration 20271361607663.';

REVOKE ALL ON FUNCTION public.shop_trust(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_trust(uuid[]) TO service_role;

-- ── 5 · the counts and the search step, derived from the one reader ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.shop_trust_counts(p_vendor_profile_ids uuid[])
RETURNS TABLE (
  vendor_profile_id uuid,
  trusted           integer,
  waiting           integer,
  counted           integer,
  search_step       integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH c AS (
    SELECT t.vendor_profile_id,
           count(DISTINCT t.other_vendor_profile_id) FILTER (WHERE t.trusted)::integer     AS trusted,
           count(DISTINCT t.other_vendor_profile_id) FILTER (WHERE NOT t.trusted)::integer AS waiting,
           count(DISTINCT t.other_vendor_profile_id) FILTER (WHERE t.counts)::integer      AS counted
      FROM public.shop_trust(p_vendor_profile_ids) t
     GROUP BY t.vendor_profile_id
  ),
  s AS (
    SELECT ps.trust_search_step AS base FROM public.platform_settings ps WHERE ps.id = 1
  )
  SELECT c.vendor_profile_id,
         c.trusted,
         c.waiting,
         c.counted,
         -- Diminishing returns: how many of 1 · b · b² · … the count reaches. Not set, or nothing counted → 0.
         CASE
           WHEN (SELECT base FROM s) IS NULL OR c.counted < 1 THEN 0
           ELSE (SELECT count(*)::integer
                   FROM generate_series(0, 30) k
                  WHERE c.counted::numeric >= power((SELECT base FROM s)::numeric, k))
         END AS search_step
    FROM c;
$$;

COMMENT ON FUNCTION public.shop_trust_counts(uuid[]) IS
  'Per shop, from shop_trust (never a second derivation): trusted and waiting partners (the Partners list and the Shop '
  'button''s "N trusted · N waiting"), counted (the search signal and the badges), and search_step — how many of '
  '1 · b · b² · … the counted trust reaches, b = platform_settings.trust_search_step (NULL → 0: trust lifts nobody). '
  'Shops with no partner are absent. Service role only. Migration 20271361607663.';

REVOKE ALL ON FUNCTION public.shop_trust_counts(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_trust_counts(uuid[]) TO service_role;

COMMIT;
