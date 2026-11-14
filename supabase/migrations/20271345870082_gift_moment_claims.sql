-- gift_moment_claims
-- ============================================================================
-- THE GIFT MOMENT — pressing Redeem IS the claim, and it can never count twice
-- (owner, 14 Nov 2026).
--
-- ⚖ DECISION_LOG 2026-11-14 (closed, do not re-ask):
--   · "THE GIFT MOMENT — A POPUP, TAP TO OPEN" and "ONE PIECE, USED THREE WAYS":
--     a supplier's gift to a couple, a badge and its reward, a gift from
--     Setnayan — one popup, each plays once, then lives on as its row/notice.
--   · "PRESSING REDEEM IS THE CLAIM — AND IT CAN NEVER COUNT TWICE": the first
--     press that reaches the server marks the gift claimed; a double tap, a retry
--     after a timeout, two tabs or two devices all land on the SAME claim. Keyed
--     to the gift in the database — the `shop_badge_rewards_once` pattern.
--   · "GIFT DESIGN APPROVED — WITH FABLE'S EIGHT PICKS" (6) each host once,
--     guests never; (7) two shops' gifts play back to back.
--
-- 🔑 THE GIFT IS ALREADY THEIRS BEFORE THE PRESS. A supplier's gift lands in the
-- event's Papic pool / unlocks the plan when the first payment clears
-- (`shop_gift_deliver_for_booking`, `shop_gift_deliver_unlocks_for_booking`); a
-- badge reward lands in the shop's gift stock (`shop_badge_reward_grant`). A
-- claim GRANTS NOTHING — it records that the person pressed Redeem, so the
-- moment shows "Claimed" and the waiting line goes. Nothing here moves credits.
--
-- WHAT THIS FILE ADDS (adds only — nothing existing is changed):
--   1. `gift_moment_claims` — ONE row per claimed gift, UNIQUE (source, ref_id)
--      (`gift_moment_claims_once`). `source` names what the gift is and `ref_id`
--      the row it is keyed to:
--        shop_gift     → the accepted quote (`vendor_proposals.proposal_id`) whose
--                        gift was given to the event (its 'given' stock rows);
--        badge_reward  → `shop_badge_rewards.reward_id`.
--      G3 (Setnayan gifts to shops) LOOSENS `gift_moment_claims_source_allowed`
--      with its own source and adds its arm to the two functions below.
--   2. `gift_moment_claim(source, ref)` — the ONE door a claim takes. One
--      INSERT … ON CONFLICT DO NOTHING on the UNIQUE key: the first press writes
--      the row ('claimed'); every repeat reads it back ('already'). Refuses —
--      writing nothing — when the caller is not a host of that event (couple
--      member) or a manager of that shop, or the gift is not there.
--   3. `gift_moments_for_event(event)` · `gift_moments_for_shop(shop)` — what a
--      host / a shop has received, each with its claim (NULL = waiting). Return
--      nothing to anyone else. The app composes the words (lib/gift-moment.ts).
--
-- KEEP IDEMPOTENT. 🛑 NEVER APPLIED BY HAND. The pipeline pushes this file.
-- ============================================================================

BEGIN;

-- ── 1 · the claims ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gift_moment_claims (
  claim_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source            TEXT NOT NULL
                      CONSTRAINT gift_moment_claims_source_allowed
                      CHECK (source IN ('shop_gift', 'badge_reward')),
  -- The row the gift is keyed to (see the header). Not a foreign key on
  -- purpose: it points at a different table per source, and a claim must
  -- outlive a quote being archived.
  ref_id            UUID NOT NULL,
  -- Whose gift it is — for RLS and the admin, never for the key.
  event_id          UUID REFERENCES public.events(event_id) ON DELETE CASCADE,
  vendor_profile_id UUID REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  claimed_by        UUID,
  claimed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gift_moment_claims_has_owner CHECK (event_id IS NOT NULL OR vendor_profile_id IS NOT NULL)
);

-- 🔒 Exactly once: two presses, two tabs, two phones — one row.
CREATE UNIQUE INDEX IF NOT EXISTS gift_moment_claims_once
  ON public.gift_moment_claims (source, ref_id);

CREATE INDEX IF NOT EXISTS gift_moment_claims_event_idx
  ON public.gift_moment_claims (event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS gift_moment_claims_shop_idx
  ON public.gift_moment_claims (vendor_profile_id) WHERE vendor_profile_id IS NOT NULL;

COMMENT ON TABLE public.gift_moment_claims IS
  'The gift moment''s claim (owner 2026-11-14: "once the redeem is pressed they already claimed it … '
  'redeem cannot duplicate"): one row per claimed gift, UNIQUE (source, ref_id) — shop_gift = the '
  'accepted quote whose gift reached the event; badge_reward = shop_badge_rewards.reward_id. A claim '
  'grants nothing (the gift already landed); it ends the waiting line. Written only by gift_moment_claim.';

ALTER TABLE public.gift_moment_claims ENABLE ROW LEVEL SECURITY;

-- A host reads the claims of their event; a shop reads its own; admin reads all. No write policy.
DROP POLICY IF EXISTS gift_moment_claims_read ON public.gift_moment_claims;
CREATE POLICY gift_moment_claims_read
  ON public.gift_moment_claims
  FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (SELECT public.is_admin())
  );

REVOKE ALL ON TABLE public.gift_moment_claims FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.gift_moment_claims FROM authenticated;
GRANT SELECT ON TABLE public.gift_moment_claims TO authenticated;

-- ── 2 · the one door a claim takes ───────────────────────────────────────────
-- Returns jsonb:
--   {status:'claimed', claimed_at}   — this press is the claim
--   {status:'already', claimed_at}   — it was claimed before (another tap, tab, phone, host)
--   {status:'refused'}               — not yours, or no such gift; nothing written
CREATE OR REPLACE FUNCTION public.gift_moment_claim(p_source TEXT, p_ref UUID)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid   UUID := auth.uid();
  v_event UUID;
  v_shop  UUID;
  v_at    TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL OR p_ref IS NULL THEN
    RETURN jsonb_build_object('status', 'refused');
  END IF;

  IF p_source = 'shop_gift' THEN
    -- A gift that REACHED the event (its 'given' rows), on an event the caller hosts.
    SELECT e.event_id, e.vendor_profile_id INTO v_event, v_shop
      FROM public.shop_gift_stock_entries e
     WHERE e.proposal_id = p_ref
       AND e.kind = 'given'
       AND e.event_id IN (SELECT public.current_couple_event_ids())
     LIMIT 1;
  ELSIF p_source = 'badge_reward' THEN
    SELECT r.vendor_profile_id INTO v_shop
      FROM public.shop_badge_rewards r
     WHERE r.reward_id = p_ref
       AND r.revoked_at IS NULL
       AND r.vendor_profile_id IN (SELECT public.current_vendor_profile_ids());
  END IF;

  IF v_event IS NULL AND v_shop IS NULL THEN
    RETURN jsonb_build_object('status', 'refused');
  END IF;

  -- ONE statement decides: the first press inserts; every other lands on the key.
  INSERT INTO public.gift_moment_claims (source, ref_id, event_id, vendor_profile_id, claimed_by)
  VALUES (p_source, p_ref, v_event, CASE WHEN p_source = 'shop_gift' THEN NULL ELSE v_shop END, v_uid)
  ON CONFLICT (source, ref_id) DO NOTHING
  RETURNING claimed_at INTO v_at;

  IF v_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'claimed', 'claimed_at', v_at);
  END IF;

  SELECT c.claimed_at INTO v_at
    FROM public.gift_moment_claims c
   WHERE c.source = p_source AND c.ref_id = p_ref;
  RETURN jsonb_build_object('status', 'already', 'claimed_at', v_at);
END;
$function$;

COMMENT ON FUNCTION public.gift_moment_claim(TEXT, UUID) IS
  'Pressing Redeem on a gift moment (owner 2026-11-14). One INSERT … ON CONFLICT DO NOTHING on '
  'gift_moment_claims_once, so a repeat — double tap, retry after a lost connection, another tab, '
  'phone or host — answers ''already'' and writes nothing. Grants nothing: the gift already landed. '
  'Refuses unless the caller hosts the event (couple member) or manages the shop.';

REVOKE ALL ON FUNCTION public.gift_moment_claim(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gift_moment_claim(TEXT, UUID) TO authenticated, service_role;

-- ── 3 · what a host / a shop has received ────────────────────────────────────
-- A supplier's gift to one event, one row per shop's accepted quote that gave
-- something. `lines` = that quote's gift lines (title · kind · credits), the
-- words the couple was promised. Hosts (couple members) only; anyone else gets
-- no rows.
CREATE OR REPLACE FUNCTION public.gift_moments_for_event(p_event_id UUID)
 RETURNS TABLE (
   source            TEXT,
   ref_id            UUID,
   vendor_profile_id UUID,
   giver_name        TEXT,
   giver_logo        TEXT,
   lines             JSONB,
   landed_at         TIMESTAMPTZ,
   claimed_at        TIMESTAMPTZ
 )
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH given AS (
    SELECT e.proposal_id, e.vendor_profile_id, MIN(e.created_at) AS landed_at
      FROM public.shop_gift_stock_entries e
     WHERE e.event_id = p_event_id
       AND e.kind = 'given'
       AND e.proposal_id IS NOT NULL
       AND p_event_id IN (SELECT public.current_couple_event_ids())
     GROUP BY e.proposal_id, e.vendor_profile_id
  )
  SELECT 'shop_gift'::TEXT,
         g.proposal_id,
         g.vendor_profile_id,
         vp.business_name,
         vp.logo_url,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object('title', l.title, 'kind', l.gift_kind, 'credits', l.credits)
                            ORDER BY l.created_at, l.gift_line_id)
             FROM public.vendor_proposal_shop_gifts l
            WHERE l.proposal_id = g.proposal_id
         ), '[]'::jsonb),
         g.landed_at,
         c.claimed_at
    FROM given g
    JOIN public.vendor_profiles vp ON vp.vendor_profile_id = g.vendor_profile_id
    LEFT JOIN public.gift_moment_claims c ON c.source = 'shop_gift' AND c.ref_id = g.proposal_id
   ORDER BY g.landed_at DESC, g.proposal_id
   LIMIT 50;
$function$;

COMMENT ON FUNCTION public.gift_moments_for_event(UUID) IS
  'The supplier gifts that reached one event, one row per shop''s accepted quote, with its gift lines '
  'and its claim (NULL = waiting). Hosts (couple members) only — anyone else, guests included, gets no '
  'rows (owner 2026-11-14: each host once, guests never).';

REVOKE ALL ON FUNCTION public.gift_moments_for_event(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gift_moments_for_event(UUID) TO authenticated, service_role;

-- A shop's badge rewards (not revoked), newest first (the newest 50), each with its claim.
CREATE OR REPLACE FUNCTION public.gift_moments_for_shop(p_vendor_profile_id UUID)
 RETURNS TABLE (
   source      TEXT,
   ref_id      UUID,
   reward_key  TEXT,
   badge       TEXT,
   reward_kind TEXT,
   units       INTEGER,
   landed_at   TIMESTAMPTZ,
   claimed_at  TIMESTAMPTZ
 )
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT 'badge_reward'::TEXT,
         r.reward_id,
         r.reward_key,
         r.badge,
         r.reward_kind,
         r.units,
         r.granted_at,
         c.claimed_at
    FROM public.shop_badge_rewards r
    LEFT JOIN public.gift_moment_claims c ON c.source = 'badge_reward' AND c.ref_id = r.reward_id
   WHERE r.vendor_profile_id = p_vendor_profile_id
     AND r.revoked_at IS NULL
     AND p_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
   ORDER BY r.granted_at DESC, r.reward_id
   LIMIT 50;
$function$;

COMMENT ON FUNCTION public.gift_moments_for_shop(UUID) IS
  'A shop''s badge rewards (not revoked) with their gift-moment claim (NULL = waiting). The shop''s '
  'own managers only; anyone else gets no rows.';

REVOKE ALL ON FUNCTION public.gift_moments_for_shop(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gift_moments_for_shop(UUID) TO authenticated, service_role;

COMMIT;
