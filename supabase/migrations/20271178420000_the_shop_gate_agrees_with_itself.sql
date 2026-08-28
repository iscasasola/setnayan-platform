-- ============================================================================
-- A shop's service cards are gated by the SAME column the shop is.
--
-- ── THE DEFECT, measured in prod 2026-08-28 ────────────────────────────────
-- Two columns decide whether a shop is public, and two different surfaces read
-- two different ones:
--
--   • `vendor_profiles.public_visibility` — the AUTHORITATIVE gate. The
--     marketplace, `/v/[slug]` and `vendor_profiles_public_read` all use it
--     (`= 'verified'` AND `verification_state = 'verified'`, narrowed by
--     20271013500000 after `coming_soon` was found publicly readable).
--   • `vendor_profiles.is_published` — the LEGACY boolean. `lib/vendor-
--     visibility.ts` says in terms that the new column "is authoritative for
--     marketplace + profile read paths", the explore page's own comment says
--     the legacy boolean "is no longer queried here", and the admin accounts
--     surface calls it **"the dead column"** in a comment after moving its two
--     tabs off it.
--
-- `vendor_services_public_read` never got that memo. It still gates every
-- service card on the dead column — so the shop and its cards disagree.
--
-- 🔢 BOTH PRODUCTION SHOPS SIT EXACTLY WHERE THEY DISAGREE:
--
--   SetnaProd  public_visibility=verified  verification_state=verified  is_published=FALSE
--   (fixture)  public_visibility=hidden    verification_state=verified  is_published=TRUE
--
-- So the real shop is listed in the marketplace while its service cards are
-- unreadable, and the hidden fixture is the mirror image. It bites nobody
-- TODAY only because SetnaProd has no cards yet — the moment it publishes one,
-- the shop is visible and the card is not, with nothing on screen saying why.
--
-- ── WHAT THIS IS NOT ───────────────────────────────────────────────────────
-- ⚠ NOT a leak, and I checked before writing that it was. Probed as
-- `authenticated` in prod: `vendor_services` returns **0 rows**, because the
-- policy's subquery runs under the CALLER'S RLS and `vendor_profiles` only ever
-- shows a stranger the verified-AND-verified set — so the hidden fixture's id
-- never reaches the IN-list. The hidden shop's cards were already unreachable,
-- **by accident of nested RLS rather than by the policy's own text.** This
-- migration makes the text say what the behaviour already is, and fixes the
-- half that is genuinely broken.
--
-- ── THE CHANGE ─────────────────────────────────────────────────────────────
-- Mirror `vendor_profiles_public_read` exactly, so a card is public on the same
-- condition its shop is. Written as an EXPLICIT predicate rather than left to
-- the nested RLS: a policy that is correct only because another policy happens
-- to filter its subquery is one `vendor_profiles` change away from being wrong,
-- and nothing would say so.
--
-- 🔒 A shop reading its OWN cards is unaffected — that is
-- `vendor_services_manage` (FOR ALL, own profile or assigned agent), a separate
-- PERMISSIVE policy. This one only ever decided the PUBLIC read.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS vendor_services_public_read ON public.vendor_services;

CREATE POLICY vendor_services_public_read
  ON public.vendor_services
  FOR SELECT TO authenticated
  USING (
    is_active = true
    AND vendor_profile_id IN (
      SELECT vp.vendor_profile_id
      FROM public.vendor_profiles vp
      WHERE vp.public_visibility = 'verified'::vendor_public_visibility
        AND vp.verification_state = 'verified'::vendor_verification_state
    )
  );

COMMENT ON POLICY vendor_services_public_read ON public.vendor_services IS
  'Public read of a service card. Gated on the SAME pair as vendor_profiles_public_read (public_visibility + verification_state), never on the legacy is_published boolean — a card must be public exactly when its shop is. 20271178420000.';

-- --- P1. the dead column is gone from this policy -------------------------
DO $$
DECLARE q text;
BEGIN
  SELECT pg_get_expr(polqual, polrelid) INTO q
  FROM pg_policy WHERE polrelid='public.vendor_services'::regclass
    AND polname='vendor_services_public_read';
  IF q IS NULL THEN
    RAISE EXCEPTION 'P1 FAILED: vendor_services_public_read is missing';
  END IF;
  IF q LIKE '%is_published%' THEN
    RAISE EXCEPTION 'P1 FAILED: the policy still reads the legacy is_published column: %', q;
  END IF;
  IF q NOT LIKE '%public_visibility%' OR q NOT LIKE '%verification_state%' THEN
    RAISE EXCEPTION 'P1 FAILED: the policy must gate on BOTH authoritative columns: %', q;
  END IF;
  IF q NOT LIKE '%is_active%' THEN
    RAISE EXCEPTION 'P1 FAILED: an inactive card must never be public: %', q;
  END IF;
END $$;

-- --- P2. the two gates now agree, expression for expression ---------------
-- Not a string comparison of the whole clause (they differ — one carries the
-- is_active leg and the IN-list) but of the SHOP condition inside it, which is
-- the thing that must never drift again.
DO $$
DECLARE shop_gate text; card_gate text;
BEGIN
  SELECT pg_get_expr(polqual, polrelid) INTO shop_gate
  FROM pg_policy WHERE polrelid='public.vendor_profiles'::regclass
    AND polname='vendor_profiles_public_read';
  SELECT pg_get_expr(polqual, polrelid) INTO card_gate
  FROM pg_policy WHERE polrelid='public.vendor_services'::regclass
    AND polname='vendor_services_public_read';
  IF shop_gate NOT LIKE '%public_visibility = ''verified''%'
     OR shop_gate NOT LIKE '%verification_state = ''verified''%' THEN
    RAISE EXCEPTION
      'P2 FAILED: vendor_profiles_public_read is no longer the verified-AND-verified pair this policy was written to mirror — reconcile both, do not silently diverge: %',
      shop_gate;
  END IF;
  IF card_gate NOT LIKE '%public_visibility = ''verified''%'
     OR card_gate NOT LIKE '%verification_state = ''verified''%' THEN
    RAISE EXCEPTION 'P2 FAILED: the card gate does not mirror the shop gate: %', card_gate;
  END IF;
END $$;

-- --- P3. a shop can still reach its OWN cards -----------------------------
-- The narrowing must not touch the shop's own management path.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid='public.vendor_services'::regclass
      AND polname='vendor_services_manage'
      AND polcmd = '*'
  ) THEN
    RAISE EXCEPTION 'P3 FAILED: vendor_services_manage is gone — a shop can no longer edit its own cards.';
  END IF;
END $$;

COMMIT;
