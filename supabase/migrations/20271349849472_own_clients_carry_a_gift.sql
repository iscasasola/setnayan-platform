-- own_clients_carry_a_gift
-- ============================================================================
-- OWN CLIENTS v3 + v4 — "Add a client", and every own client carries at least
-- one Setnayan gift from the supplier's stock (owner, 16 Nov 2026).
--
-- ⚖ DECISION_LOG 2026-11-16 (closed, do not re-ask):
--   · "EVERY SUPPLIER IMPORT CARRIES AT LEAST ONE SETNAYAN GIFT" — the gift is
--     used from stock only when the couple JOINS; an unused invite costs nothing.
--   · "GIFTS ARE ALWAYS BOUGHT AS STOCK FIRST" — the gift step offers ONLY the
--     supplier's stock; nothing is ever added to a booking fee bill.
--   · "A CLIENT WHO ARRIVES THROUGH THE SUPPLIER'S OWN LINK IS TREATED LIKE AN
--     IMPORT" — the own link (`?src=own`) carries a gift too, SET ONCE ON THE
--     CODE (Own clients v4 answer 1).
--   · Own clients v4 answer 3 — a gift paid by a BADGE REWARD does not count:
--     only the shop's bought stock meets the rule.
--   · Own clients v4 (stock-first) answer 2 — own link with no stock left: the
--     link keeps working; a couple who joins then is NOT yet an own client.
--
-- WHAT THIS FILE ADDS (nothing existing changes meaning):
--   1. `vendor_client_invites` — one row per "Add a client": who, how to reach
--      them, the gift lines picked from stock, and a random token the invite
--      link carries (`/vendor-invite/<slug>?ci=<token>`).
--   2. `vendor_own_link_gifts` — the ONE gift set on the shop's own link / QR.
--   3. `own_client_gifts` — one row per (shop, event) whose own-client gift was
--      GIVEN: the proof the couple is the shop's own client with a gift, and the
--      key the gift moment hangs off. UNIQUE (shop, event) is the whole
--      exactly-once mechanism.
--   4. Stock kind 'own_client' (−) on `shop_gift_stock_entries`. A NEW kind, not
--      'given', on purpose: every quote door counts 'given' rows per event, and
--      an own-client gift must never read as a quote's promise already kept.
--   5. `own_client_gift_give(...)` — the ONE door an own-client gift takes out of
--      stock and into the couple's event (Papic credits, a shared pool grant,
--      source 'shop_gift' — exactly where a quote's gift lands).
--   6. `gift_moments_for_event` / `gift_moment_claim` learn the own-client gift,
--      so the couple meets it through the SHIPPED moment ("A gift from <shop>").
--      The source stays 'shop_gift'; the ref is the own_client_gifts row.
--
-- KEEP IDEMPOTENT. 🛑 NEVER APPLIED BY HAND. The pipeline pushes this file.
-- ============================================================================

BEGIN;

-- ── 1 · the invites ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_client_invites (
  invite_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token             TEXT NOT NULL
                      CONSTRAINT vendor_client_invites_token_shape
                      CHECK (token ~ '^[A-Za-z0-9_-]{16,64}$'),
  vendor_profile_id UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  client_name       TEXT NOT NULL
                      CONSTRAINT vendor_client_invites_name_shape
                      CHECK (length(btrim(client_name)) BETWEEN 1 AND 120),
  client_contact    TEXT NOT NULL
                      CONSTRAINT vendor_client_invites_contact_shape
                      CHECK (length(btrim(client_contact)) BETWEEN 3 AND 160),
  client_note       TEXT
                      CONSTRAINT vendor_client_invites_note_shape
                      CHECK (client_note IS NULL OR length(client_note) <= 500),
  -- [{service_code, title, kind:'papic', credits}] — read from the catalogue by
  -- the server when the invite was made; at least one (the rule), at most five.
  gift_lines        JSONB NOT NULL
                      CONSTRAINT vendor_client_invites_gift_lines_shape
                      CHECK (jsonb_typeof(gift_lines) = 'array'
                             AND jsonb_array_length(gift_lines) BETWEEN 1 AND 5),
  status            TEXT NOT NULL DEFAULT 'waiting'
                      CONSTRAINT vendor_client_invites_status_allowed
                      CHECK (status IN ('waiting', 'joined', 'void')),
  claimed_event_id  UUID REFERENCES public.events(event_id) ON DELETE SET NULL,
  claimed_at        TIMESTAMPTZ,
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS vendor_client_invites_token_unique
  ON public.vendor_client_invites (token);
CREATE INDEX IF NOT EXISTS vendor_client_invites_shop_idx
  ON public.vendor_client_invites (vendor_profile_id, created_at DESC);

COMMENT ON TABLE public.vendor_client_invites IS
  'Own clients v3/v4 (owner 2026-11-16): one row per "Add a client" — the client''s name and '
  'contact, the Setnayan gift(s) picked from the shop''s stock, and the random token the invite '
  'link carries. Joining through it makes the couple the shop''s OWN client (event_vendors source '
  'vendor_invite, no booking fee) once own_client_gift_give gives the gift. Written only by the server.';

ALTER TABLE public.vendor_client_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_client_invites_vendor_read ON public.vendor_client_invites;
CREATE POLICY vendor_client_invites_vendor_read
  ON public.vendor_client_invites
  FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (SELECT public.is_admin())
  );

REVOKE ALL ON TABLE public.vendor_client_invites FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.vendor_client_invites FROM authenticated;

-- ── 2 · the gift on the shop's own link ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_own_link_gifts (
  vendor_profile_id UUID PRIMARY KEY
                      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  service_code      TEXT NOT NULL
                      CONSTRAINT vendor_own_link_gifts_code_shape
                      CHECK (length(btrim(service_code)) > 0),
  title             TEXT NOT NULL,
  gift_kind         TEXT NOT NULL
                      CONSTRAINT vendor_own_link_gifts_kind_allowed
                      CHECK (gift_kind IN ('papic')),
  credits           INTEGER NOT NULL
                      CONSTRAINT vendor_own_link_gifts_credits_positive
                      CHECK (credits > 0),
  set_by            UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.vendor_own_link_gifts IS
  'The ONE Setnayan gift set on a shop''s own link / QR (?src=own — My page, Check a date, Reviews) '
  '(owner 2026-11-16, Own clients v4 answer 1: set once on the code). Each couple who first asks '
  'through it gets it from the shop''s stock; with too little stock they are not yet an own client.';

ALTER TABLE public.vendor_own_link_gifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_own_link_gifts_vendor_read ON public.vendor_own_link_gifts;
CREATE POLICY vendor_own_link_gifts_vendor_read
  ON public.vendor_own_link_gifts
  FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (SELECT public.is_admin())
  );

REVOKE ALL ON TABLE public.vendor_own_link_gifts FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.vendor_own_link_gifts FROM authenticated;

-- ── 3 · the gifts given to own clients ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.own_client_gifts (
  own_gift_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  event_id          UUID NOT NULL
                      REFERENCES public.events(event_id) ON DELETE CASCADE,
  via               TEXT NOT NULL
                      CONSTRAINT own_client_gifts_via_allowed
                      CHECK (via IN ('invite', 'own_link')),
  invite_id         UUID REFERENCES public.vendor_client_invites(invite_id) ON DELETE SET NULL,
  gift_lines        JSONB NOT NULL
                      CONSTRAINT own_client_gifts_lines_shape
                      CHECK (jsonb_typeof(gift_lines) = 'array' AND jsonb_array_length(gift_lines) >= 1),
  credits           INTEGER NOT NULL
                      CONSTRAINT own_client_gifts_credits_positive
                      CHECK (credits > 0),
  pool_grant_id     UUID REFERENCES public.papic_event_point_grants(grant_id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS own_client_gifts_once
  ON public.own_client_gifts (vendor_profile_id, event_id);
CREATE INDEX IF NOT EXISTS own_client_gifts_event_idx
  ON public.own_client_gifts (event_id);

COMMENT ON TABLE public.own_client_gifts IS
  'One row per (shop, event) whose own-client Setnayan gift was GIVEN (owner 2026-11-16 '
  '"every supplier import carries at least one Setnayan gift"): via an Add a client invite or the '
  'shop''s own link. Written only by own_client_gift_give. UNIQUE (shop, event) = exactly once.';

ALTER TABLE public.own_client_gifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS own_client_gifts_read ON public.own_client_gifts;
CREATE POLICY own_client_gifts_read
  ON public.own_client_gifts
  FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR event_id IN (SELECT public.current_couple_event_ids())
    OR (SELECT public.is_admin())
  );

REVOKE ALL ON TABLE public.own_client_gifts FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.own_client_gifts FROM authenticated;

-- ── 4 · the stock kind an own-client gift leaves as ──────────────────────────
ALTER TABLE public.shop_gift_stock_entries
  ADD COLUMN IF NOT EXISTS own_client_gift_id UUID
    REFERENCES public.own_client_gifts(own_gift_id) ON DELETE SET NULL;

ALTER TABLE public.shop_gift_stock_entries
  DROP CONSTRAINT IF EXISTS shop_gift_stock_entries_kind_allowed;
ALTER TABLE public.shop_gift_stock_entries
  ADD CONSTRAINT shop_gift_stock_entries_kind_allowed
  CHECK (kind IN ('bought', 'given', 'reversal', 'badge_reward', 'own_client'));

ALTER TABLE public.shop_gift_stock_entries
  DROP CONSTRAINT IF EXISTS shop_gift_stock_entries_sign_matches_kind;
ALTER TABLE public.shop_gift_stock_entries
  ADD CONSTRAINT shop_gift_stock_entries_sign_matches_kind CHECK (
    (kind IN ('bought', 'badge_reward') AND delta > 0)
    OR (kind IN ('given', 'reversal', 'own_client') AND delta < 0)
  );

COMMENT ON COLUMN public.shop_gift_stock_entries.own_client_gift_id IS
  'On an own_client row: the own_client_gifts row this stock became (Own clients v4, 2026-11-16).';

-- ── 5 · the ONE door an own-client gift takes ────────────────────────────────
-- Returns jsonb:
--   {status:'ok', own_gift_id, credits}   — given now
--   {status:'already', own_gift_id}       — this shop already gave this event its own-client gift
--   {status:'short', wanted, free}        — not enough BOUGHT stock; nothing written
--   {status:'bad_input'}
-- Only BOUGHT stock counts (v4 answer 3): free = balance − held (live quotes),
-- less what is still badge reward. Under the per-shop gift lock.
CREATE OR REPLACE FUNCTION public.own_client_gift_give(
  p_vendor_profile_id UUID,
  p_event_id          UUID,
  p_via               TEXT,
  p_invite_id         UUID,
  p_lines             JSONB
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_total    INTEGER := 0;
  v_line     JSONB;
  v_credits  INTEGER;
  v_balance  INTEGER;
  v_held     INTEGER;
  v_earned   INTEGER;
  v_used     INTEGER;
  v_free     INTEGER;
  v_reward   INTEGER;
  v_bought   INTEGER;
  v_existing UUID;
  v_name     TEXT;
  v_grant    UUID;
  v_gift     UUID;
BEGIN
  IF p_vendor_profile_id IS NULL OR p_event_id IS NULL
     OR p_via IS NULL OR p_via NOT IN ('invite', 'own_link')
     OR p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array'
     OR jsonb_array_length(p_lines) < 1 OR jsonb_array_length(p_lines) > 5 THEN
    RETURN jsonb_build_object('status', 'bad_input');
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    IF COALESCE(v_line->>'kind', '') <> 'papic' THEN
      RETURN jsonb_build_object('status', 'bad_input');
    END IF;
    v_credits := NULLIF(v_line->>'credits', '')::INTEGER;
    IF v_credits IS NULL OR v_credits <= 0 OR length(btrim(COALESCE(v_line->>'title', ''))) = 0 THEN
      RETURN jsonb_build_object('status', 'bad_input');
    END IF;
    v_total := v_total + v_credits;
  END LOOP;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('shop_gift_stock:' || p_vendor_profile_id::text, 0));

  SELECT o.own_gift_id INTO v_existing
    FROM public.own_client_gifts o
   WHERE o.vendor_profile_id = p_vendor_profile_id
     AND o.event_id = p_event_id;
  IF v_existing IS NOT NULL THEN
    IF p_invite_id IS NOT NULL THEN
      UPDATE public.vendor_client_invites
         SET status = 'joined', claimed_event_id = p_event_id, claimed_at = NOW()
       WHERE invite_id = p_invite_id AND vendor_profile_id = p_vendor_profile_id AND status = 'waiting';
    END IF;
    RETURN jsonb_build_object('status', 'already', 'own_gift_id', v_existing);
  END IF;

  SELECT s.balance, s.held INTO v_balance, v_held
    FROM public.shop_gift_stock_status(p_vendor_profile_id) s
   WHERE s.gift_kind = 'papic';
  SELECT r.earned, r.used INTO v_earned, v_used
    FROM public.shop_gift_reward_stock_status(p_vendor_profile_id) r
   WHERE r.gift_kind = 'papic';
  v_free   := GREATEST(0, COALESCE(v_balance, 0) - COALESCE(v_held, 0));
  v_reward := GREATEST(0, LEAST(v_free, COALESCE(v_earned, 0) - COALESCE(v_used, 0)));
  v_bought := v_free - v_reward;
  IF v_bought < v_total THEN
    RETURN jsonb_build_object('status', 'short', 'wanted', v_total, 'free', v_bought);
  END IF;

  SELECT vp.business_name INTO v_name
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = p_vendor_profile_id;

  INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
  VALUES (p_event_id, v_total, 'shop_gift',
          'Gift from ' || COALESCE(NULLIF(btrim(v_name), ''), 'your supplier') || ' · your own supplier')
  RETURNING grant_id INTO v_grant;

  INSERT INTO public.own_client_gifts
    (vendor_profile_id, event_id, via, invite_id, gift_lines, credits, pool_grant_id)
  VALUES (p_vendor_profile_id, p_event_id, p_via, p_invite_id, p_lines, v_total, v_grant)
  RETURNING own_gift_id INTO v_gift;

  INSERT INTO public.shop_gift_stock_entries
    (vendor_profile_id, gift_kind, delta, kind, event_id, pool_grant_id, own_client_gift_id, note)
  VALUES (p_vendor_profile_id, 'papic', -v_total, 'own_client', p_event_id, v_grant, v_gift,
          CASE WHEN p_via = 'invite' THEN 'Own client · Add a client' ELSE 'Own client · your own link' END);

  IF p_invite_id IS NOT NULL THEN
    UPDATE public.vendor_client_invites
       SET status = 'joined', claimed_event_id = p_event_id, claimed_at = NOW()
     WHERE invite_id = p_invite_id AND vendor_profile_id = p_vendor_profile_id;
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'own_gift_id', v_gift, 'credits', v_total);
END;
$function$;

REVOKE ALL ON FUNCTION public.own_client_gift_give(UUID, UUID, TEXT, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.own_client_gift_give(UUID, UUID, TEXT, UUID, JSONB) TO service_role;

COMMENT ON FUNCTION public.own_client_gift_give(UUID, UUID, TEXT, UUID, JSONB) IS
  'The one door an own-client Setnayan gift takes (owner 2026-11-16): from the shop''s BOUGHT gift '
  'stock (badge reward never counts) into the couple''s event Papic pool, once per (shop, event). '
  'Refuses — writing nothing — when stock is short. Service role only; the app gates the caller.';

-- ── 6 · the couple meets it through the shipped gift moment ──────────────────
-- Copied from 20271345870082_gift_moment_claims.sql; the only change is the
-- own-client arm (same source 'shop_gift', ref = own_client_gifts.own_gift_id).
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
  SELECT * FROM (
    WITH given AS (
      SELECT e.proposal_id, e.vendor_profile_id, MIN(e.created_at) AS landed_at
        FROM public.shop_gift_stock_entries e
       WHERE e.event_id = p_event_id
         AND e.kind = 'given'
         AND e.proposal_id IS NOT NULL
         AND p_event_id IN (SELECT public.current_couple_event_ids())
       GROUP BY e.proposal_id, e.vendor_profile_id
    )
    SELECT 'shop_gift'::TEXT AS source,
           g.proposal_id AS ref_id,
           g.vendor_profile_id,
           vp.business_name AS giver_name,
           vp.logo_url AS giver_logo,
           COALESCE((
             SELECT jsonb_agg(jsonb_build_object('title', l.title, 'kind', l.gift_kind, 'credits', l.credits)
                              ORDER BY l.created_at, l.gift_line_id)
               FROM public.vendor_proposal_shop_gifts l
              WHERE l.proposal_id = g.proposal_id
           ), '[]'::jsonb) AS lines,
           g.landed_at,
           c.claimed_at
      FROM given g
      JOIN public.vendor_profiles vp ON vp.vendor_profile_id = g.vendor_profile_id
      LEFT JOIN public.gift_moment_claims c ON c.source = 'shop_gift' AND c.ref_id = g.proposal_id
    UNION ALL
    SELECT 'shop_gift'::TEXT,
           o.own_gift_id,
           o.vendor_profile_id,
           vp.business_name,
           vp.logo_url,
           COALESCE((
             SELECT jsonb_agg(jsonb_build_object('title', x->>'title', 'kind', x->>'kind',
                                                 'credits', NULLIF(x->>'credits', '')::INTEGER))
               FROM jsonb_array_elements(o.gift_lines) x
           ), '[]'::jsonb),
           o.created_at,
           c.claimed_at
      FROM public.own_client_gifts o
      JOIN public.vendor_profiles vp ON vp.vendor_profile_id = o.vendor_profile_id
      LEFT JOIN public.gift_moment_claims c ON c.source = 'shop_gift' AND c.ref_id = o.own_gift_id
     WHERE o.event_id = p_event_id
       AND p_event_id IN (SELECT public.current_couple_event_ids())
  ) m
  ORDER BY m.landed_at DESC, m.ref_id
  LIMIT 50;
$function$;
COMMENT ON FUNCTION public.gift_moments_for_event(UUID) IS
  'The supplier gifts that reached one event: one row per shop''s accepted quote that gave, plus one '
  'per own-client gift (own_client_gifts, 2026-11-16), each with its lines and its claim (NULL = '
  'waiting). Hosts (couple members) only — anyone else, guests included, gets no rows.';

REVOKE ALL ON FUNCTION public.gift_moments_for_event(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gift_moments_for_event(UUID) TO authenticated, service_role;

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
    -- 🎁 Own clients v4: an own-client gift (own_client_gifts) is a shop gift too.
    IF v_event IS NULL THEN
      SELECT o.event_id, o.vendor_profile_id INTO v_event, v_shop
        FROM public.own_client_gifts o
       WHERE o.own_gift_id = p_ref
         AND o.event_id IN (SELECT public.current_couple_event_ids())
       LIMIT 1;
    END IF;
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
  'gift_moment_claims_once, so a repeat answers ''already'' and writes nothing. Grants nothing: the '
  'gift already landed. A shop gift is a quote''s given rows or an own-client gift (2026-11-16). '
  'Refuses unless the caller hosts the event (couple member) or manages the shop.';

REVOKE ALL ON FUNCTION public.gift_moment_claim(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gift_moment_claim(TEXT, UUID) TO authenticated, service_role;

COMMIT;
