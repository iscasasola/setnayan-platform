-- trusted_shops_qualify_after_a_completed_paid_booking
-- Created via `pnpm migration:new`. Idempotent (CREATE OR REPLACE FUNCTION only — no table, no column, no policy).
--
-- ── THE RULINGS ─────────────────────────────────────────────────────────────
-- Specs DECISION_LOG, owner to the controller, 21 Nov 2026:
--   · "A SHOP SHOWS AS YOUR TRUSTED SHOP ONLY AFTER ONE COMPLETED, PAID BOOKING" — *"once they have completed 1 paid
--     booked event."* The link (vendor_partnerships row) is still made at once (16 Nov); the TRUST shows — in
--     "Trusted by", on the Partners list as trusted, and in the search count — only once THAT shop has a booking
--     delivered with its payment received, through Setnayan. Refunded, cancelled, internal or test bookings never
--     count. Each side follows the same rule, so trust stays mutual.
--   · "TRUSTED SHOPS RANK HIGHER IN SEARCH" — a trust counts when it is a live two-way partnership with a VERIFIED,
--     published shop that is not internal or test; a shop's own branches never count; each shop counts once. It can
--     never be bought or granted by a plan (nothing below reads a plan, a tier or a payment TO Setnayan).
--
-- ── WHAT THIS ADDS (two readers, one derivation) ────────────────────────────
--   1. public.shop_completed_paid_booking_counts(uuid[]) — per shop, its completed + paid bookings through Setnayan.
--      Built from the shipped definitions, not re-invented:
--        · delivered        = event_vendors.status IN ('delivered','complete'), not voided for fraud, completion not
--                             disputed — the vetted view vendor_public_completed_events_stats (20271348281460);
--        · through Setnayan = not a client the supplier brought (vendor_invite · vendor_locked_qr · reuse_accept) —
--                             the same three values as that view and booking_fee_attribution_for;
--        · not self-dealing = the couple is not the shop's own account, team, or a self-comp — that view again;
--        · payment received = a payment on the booking the supplier confirmed (or a dispute ruled it stands), not
--                             refused, not a declined deposit — vendor_payday_installments() arm 2
--                             (20271233896417) and lib/vendor-earnings.ts isEarnedPayment;
--        · not refunded     = no live event_vendor_refunds row on the booking (20271328327292);
--        · not cancelled    = no pending or agreed delete request (delete_request_state);
--        · not test         = events.is_sample is not true;
--        · not internal     = no couple on the event is an internal account (users.is_internal).
--   2. public.shop_qualified_trust(uuid[]) — THE ONE READER. For each given shop, the shops that trust it and qualify:
--        · a live two-way partnership: an ACCEPTED, ACTIVE vendor_partnerships row, either direction (one row per pair,
--          vendor_partnerships_unordered_pair_uidx — accepted means both shops said yes, or joined through a link);
--        · the other shop is verified and published (verification_state AND public_visibility 'verified'), its papers
--          are current, it is not a demo shop, and its owner is not an internal account;
--        · the other shop is not the same business (booking_fee_business_matches, owner 2026-11-06 — same registration,
--          phone or payout account: a shop's own branches/sister shops) and not run by the same people (same owner
--          account, or a team member of the shop);
--        · the other shop has at least one completed, paid booking (1 above);
--        · each shop once (GROUP BY the pair; the kinds and origins come back as arrays).
--      "Trusted by" (lib/vendor-trusted-by.ts), the supplier's Partners list, and the search trust count all read
--      THIS function through lib/vendor-trusted-by.ts. `lib/trust-has-one-reader.test.ts` fails on a second derivation.
--   3. public.shop_qualified_trust_counts(uuid[]) — the search signal: count(DISTINCT trusting shop) FROM (2). Derived
--      from the one reader, never beside it.
--
-- ── WHAT IT DOES NOT TOUCH ──────────────────────────────────────────────────
--   • No table, column, index, policy or trigger. vendor_partnerships, its insert triggers and its RLS are unchanged:
--     the link is still made at once. Only what COUNTS as trust changes.
--   • vendor_public_completed_events_stats and the badges are unchanged.
--   • Service role only (SECURITY DEFINER, EXECUTE revoked from PUBLIC/anon/authenticated) — the shape of
--     shop_worked_with_counts. Every caller is a server read on the admin client.

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ── 1 · a completed, paid booking through Setnayan ─────────────────────────
CREATE OR REPLACE FUNCTION public.shop_completed_paid_booking_counts(p_vendor_profile_ids uuid[])
RETURNS TABLE (vendor_profile_id uuid, bookings integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT vp.vendor_profile_id, count(DISTINCT ev.vendor_id)::integer
    FROM public.vendor_profiles vp
    JOIN public.event_vendors ev
      ON (ev.linked_vendor_profile_id = vp.vendor_profile_id OR ev.marketplace_vendor_id = vp.vendor_profile_id)
    LEFT JOIN public.events e
      ON e.event_id = ev.event_id
   WHERE vp.vendor_profile_id = ANY (p_vendor_profile_ids)
     -- delivered (the vetted view's own test)
     AND ev.status IN ('delivered', 'complete')
     AND ev.voided_by_fraud IS NOT TRUE
     AND ev.completion_status IS DISTINCT FROM 'disputed'
     -- through Setnayan: not a client the supplier brought in
     AND COALESCE(ev.source, '') NOT IN ('vendor_invite', 'vendor_locked_qr', 'reuse_accept')
     -- not cancelled
     AND COALESCE(ev.delete_request_state, '') NOT IN ('pending', 'agreed')
     -- not test
     AND COALESCE(e.is_sample, false) = false
     -- not internal: no couple on the event is an internal account
     AND NOT EXISTS (
           SELECT 1 FROM public.event_members em
             JOIN public.users u ON u.user_id = em.user_id
            WHERE em.event_id = ev.event_id AND em.member_type = 'couple' AND u.is_internal = true)
     -- not self-dealing: the couple is not the shop's own account or team, and not a self-comp
     AND NOT EXISTS (
           SELECT 1 FROM public.event_members em
            WHERE em.event_id = ev.event_id AND em.member_type = 'couple'
              AND (em.user_id = vp.user_id OR EXISTS (
                    SELECT 1 FROM public.vendor_team_members vtm
                     WHERE vtm.vendor_profile_id = vp.vendor_profile_id AND vtm.user_id = em.user_id)))
     AND NOT EXISTS (
           SELECT 1 FROM public.comp_grants cg
            WHERE cg.vendor_profile_id = vp.vendor_profile_id
              AND cg.source = 'vendor_self_comp'
              AND (cg.order_id = ev.vendor_id OR EXISTS (
                    SELECT 1 FROM public.event_members em3
                     WHERE em3.event_id = ev.event_id AND em3.member_type = 'couple'
                       AND em3.user_id = cg.created_by_user_id)))
     -- not refunded
     AND NOT EXISTS (
           SELECT 1 FROM public.event_vendor_refunds r
            WHERE r.event_vendor_id = ev.vendor_id AND r.removed_at IS NULL)
     -- payment received (vendor_payday_installments arm 2 · isEarnedPayment)
     AND EXISTS (
           SELECT 1 FROM public.event_vendor_payments p
            WHERE p.vendor_id = ev.vendor_id
              AND (p.vendor_confirmed_at IS NOT NULL OR p.payment_dispute_outcome IS NOT DISTINCT FROM 'payment_stands')
              AND (p.payment_refused_at IS NULL OR p.payment_dispute_outcome IS NOT DISTINCT FROM 'payment_stands')
              AND p.payment_dispute_outcome IS DISTINCT FROM 'not_received'
              AND NOT (p.is_deposit_record
                       AND ev.deposit_declined_at IS NOT NULL
                       AND ev.deposit_acknowledged_at IS NULL))
   GROUP BY vp.vendor_profile_id;
$$;

COMMENT ON FUNCTION public.shop_completed_paid_booking_counts(uuid[]) IS
  'Owner 21 Nov 2026 ("A SHOP SHOWS AS YOUR TRUSTED SHOP ONLY AFTER ONE COMPLETED, PAID BOOKING"): per shop, its '
  'bookings delivered with a payment received, through Setnayan — not refunded, cancelled, internal, test, '
  'supplier-brought or self-dealing. Shops with none are absent. Service role only; read by shop_qualified_trust.';

REVOKE ALL ON FUNCTION public.shop_completed_paid_booking_counts(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_completed_paid_booking_counts(uuid[]) TO service_role;

-- ── 2 · THE ONE READER: who trusts this shop, and qualifies ────────────────
CREATE OR REPLACE FUNCTION public.shop_qualified_trust(p_vendor_profile_ids uuid[])
RETURNS TABLE (
  vendor_profile_id          uuid,
  trusting_vendor_profile_id uuid,
  relationship_types         text[],
  origins                    text[],
  made_by_this_shop          boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH ties AS (
    -- a live two-way partnership, either direction (one row per pair)
    SELECT CASE WHEN p.recommending_vendor_id = ANY (p_vendor_profile_ids)
                THEN p.recommending_vendor_id ELSE p.recommended_vendor_id END AS me,
           CASE WHEN p.recommending_vendor_id = ANY (p_vendor_profile_ids)
                THEN p.recommended_vendor_id ELSE p.recommending_vendor_id END AS other,
           p.relationship_type::text AS relationship_type,
           p.origin,
           (p.recommending_vendor_id = ANY (p_vendor_profile_ids)) AS i_made
      FROM public.vendor_partnerships p
     WHERE p.status = 'accepted'
       AND p.is_active
       AND (p.recommending_vendor_id = ANY (p_vendor_profile_ids) OR p.recommended_vendor_id = ANY (p_vendor_profile_ids))
    UNION ALL
    -- both ends asked for: the same row read from the other side too
    SELECT p.recommended_vendor_id, p.recommending_vendor_id, p.relationship_type::text, p.origin, false
      FROM public.vendor_partnerships p
     WHERE p.status = 'accepted'
       AND p.is_active
       AND p.recommending_vendor_id = ANY (p_vendor_profile_ids)
       AND p.recommended_vendor_id = ANY (p_vendor_profile_ids)
  ),
  candidates AS (
    SELECT DISTINCT t.other FROM ties t
  ),
  qualified AS (
    -- the other shop is verified, published, current, not demo, not internal, and has a completed paid booking
    SELECT o.vendor_profile_id AS id, o.user_id
      FROM public.vendor_profiles o
      JOIN candidates c ON c.other = o.vendor_profile_id
      JOIN public.shop_completed_paid_booking_counts(ARRAY(SELECT other FROM candidates)) b
        ON b.vendor_profile_id = o.vendor_profile_id AND b.bookings > 0
      LEFT JOIN public.users ou ON ou.user_id = o.user_id
     WHERE o.verification_state = 'verified'
       AND o.public_visibility = 'verified'
       AND o.papers_current
       AND COALESCE(o.is_demo, false) = false
       AND COALESCE(ou.is_internal, false) = false
  ),
  same_business AS (
    SELECT m.vendor_profile_id AS me, m.other_vendor_profile_id AS other
      FROM public.booking_fee_business_matches(p_vendor_profile_ids) m
  )
  SELECT t.me,
         t.other,
         array_agg(DISTINCT t.relationship_type ORDER BY t.relationship_type),
         array_agg(DISTINCT t.origin ORDER BY t.origin),
         bool_or(t.i_made)
    FROM ties t
    JOIN qualified q ON q.id = t.other
    JOIN public.vendor_profiles mine ON mine.vendor_profile_id = t.me
   WHERE t.other <> t.me
     -- a shop's own branches / sister shops never count
     AND NOT EXISTS (SELECT 1 FROM same_business sb WHERE sb.me = t.me AND sb.other = t.other)
     AND q.user_id IS DISTINCT FROM mine.user_id
     AND NOT EXISTS (
           SELECT 1 FROM public.vendor_team_members vtm
            WHERE (vtm.vendor_profile_id = t.me AND vtm.user_id = q.user_id)
               OR (vtm.vendor_profile_id = t.other AND vtm.user_id = mine.user_id))
   GROUP BY t.me, t.other;
$$;

COMMENT ON FUNCTION public.shop_qualified_trust(uuid[]) IS
  'THE ONE READER of trust (owner 21 Nov 2026, both trust rulings). For each given shop, one row per shop that trusts '
  'it AND qualifies: an accepted, active vendor_partnerships row either way; the other shop verified, published, '
  'papers current, not demo, owner not internal; not the same business (booking_fee_business_matches) or the same '
  'people; and at least one completed, paid booking (shop_completed_paid_booking_counts). Read by "Trusted by", the '
  'Partners list and the search count through lib/vendor-trusted-by.ts only. Service role only.';

REVOKE ALL ON FUNCTION public.shop_qualified_trust(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_qualified_trust(uuid[]) TO service_role;

-- ── 3 · the search signal, derived from the one reader ─────────────────────
CREATE OR REPLACE FUNCTION public.shop_qualified_trust_counts(p_vendor_profile_ids uuid[])
RETURNS TABLE (vendor_profile_id uuid, trusted_by integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT q.vendor_profile_id, count(DISTINCT q.trusting_vendor_profile_id)::integer
    FROM public.shop_qualified_trust(p_vendor_profile_ids) q
   GROUP BY q.vendor_profile_id;
$$;

COMMENT ON FUNCTION public.shop_qualified_trust_counts(uuid[]) IS
  'The search trust signal (owner 21 Nov 2026, "TRUSTED SHOPS RANK HIGHER IN SEARCH"): distinct qualified trusting '
  'shops per shop, counted FROM shop_qualified_trust — never a second derivation. Shops with none are absent. '
  'Service role only.';

REVOKE ALL ON FUNCTION public.shop_qualified_trust_counts(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_qualified_trust_counts(uuid[]) TO service_role;

COMMIT;
