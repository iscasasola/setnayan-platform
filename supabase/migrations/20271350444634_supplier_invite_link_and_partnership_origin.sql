-- supplier_invite_link_and_partnership_origin
-- Created via `pnpm migration:new`. Idempotent (ADD COLUMN IF NOT EXISTS · CREATE OR REPLACE · DROP … IF EXISTS).
--
-- ── THE RULING ──────────────────────────────────────────────────────────────
-- Owner, 16 Nov 2026 (DECISION_LOG "Invite a supplier v3 APPROVED", "INVITE A SUPPLIER — THREE ANSWERS", "hand-added
-- partners need the other shop's accept"); prototype specs cb1affde
-- `prototypes/invite_a_supplier_2026-11-16/invite_a_supplier_2026-11-16_fable.html`.
--
--   · One invite link per shop (`/i/<business_slug>`), no cap. A shop CREATED through it and the inviter are partners
--     at once, both ways — joining is the accept (no request, no Accept button).
--   · A shop that ALREADY exists and joins through the link: the same handshake, but it does NOT count toward the
--     Invites badge (imports of NEW suppliers only).
--   · "+ Add" (by hand) is the SHIPPED propose → accept, with the served-together check lifted for it.
--   · Each partnership row says where it came from: worked together · added · invited (the ⓘ tag on Trusted by).
--
-- ── WHAT THIS ADDS ──────────────────────────────────────────────────────────
--   1. vendor_partnerships.origin ('worked_together' | 'added' | 'invited') and .brought_new_shop (the Invites record:
--      true ONLY on an invited row whose recommended shop was created through the link). Both are pinned by the
--      existing immutable-columns trigger, so nobody can relabel a tie or turn one into an Invite later.
--   2. The insert trigger that enforces "served the same event" skips 'added' and 'invited' rows (the two named ways
--      in). The propose path ('worked_together') keeps its check exactly as it was.
--   3. A BEFORE INSERT guard: an 'invited' row must be written ACCEPTED, and brought_new_shop needs 'invited'. A
--      supplier's own insert is forced to status 'proposed' by the shipped RLS policy, so a supplier can never write
--      an invited row — only the definer function below (or an admin) can.
--   4. public.supplier_invite_join(inviter, joiner, new_shop) — internal, service_role only: writes the one accepted
--      'invited' row. public.join_supplier_invite(slug) — the signed-in existing shop's door (never counted).
--   5. public.shop_worked_with_counts(vendor) — service_role only: the shops a supplier served a past event with, and
--      how many events, for the shop page's "Trusted by" ("Worked together", automatic). Reads the ONE definition,
--      vendor_served_together_rows (20271329352320).
--
-- ── ONE ROW PER HANDSHAKE, NOT TWO (a builder note, surfaced in the PR) ──────
-- The prototype's builder note says "two accepted rows … one each way". The shipped schema forbids that:
-- vendor_partnerships_unordered_pair_uidx (20270403305164) allows ONE row per unordered pair per kind. So the
-- handshake is one accepted row, and the shop page reads "Trusted by" in BOTH directions (lib/vendor-trusted-by.ts).
--
-- ── WHAT IT DOES NOT TOUCH ──────────────────────────────────────────────────
--   • RLS: no policy is changed. Remove (swipe left) uses the shipped proposer→withdrawn and recipient→declined
--     updates.
--   • Existing rows: they take origin 'worked_together' (the only way in until today, since 6 Nov).

BEGIN;

-- ── 1 · where each tie came from ───────────────────────────────────────────
ALTER TABLE public.vendor_partnerships
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'worked_together';
ALTER TABLE public.vendor_partnerships
  DROP CONSTRAINT IF EXISTS vendor_partnerships_origin_check;
ALTER TABLE public.vendor_partnerships
  ADD CONSTRAINT vendor_partnerships_origin_check
  CHECK (origin IN ('worked_together', 'added', 'invited'));

ALTER TABLE public.vendor_partnerships
  ADD COLUMN IF NOT EXISTS brought_new_shop boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.vendor_partnerships.origin IS
  'Where the tie came from (owner 16 Nov, Invite a supplier v3): worked_together (the shipped propose, after a shared '
  'event) · added (by hand, "+ Add" — still propose → accept) · invited (joined through the inviter''s link, written '
  'accepted). Immutable after insert.';
COMMENT ON COLUMN public.vendor_partnerships.brought_new_shop IS
  'The Invites record: true only on an invited row whose recommended shop was CREATED through the recommending shop''s '
  'link. An existing shop joining through the link makes the handshake but is not counted (owner 16 Nov, answer 2). '
  'Immutable after insert.';

CREATE INDEX IF NOT EXISTS vendor_partnerships_invites_idx
  ON public.vendor_partnerships (recommending_vendor_id)
  WHERE origin = 'invited' AND brought_new_shop;

-- ── 1b · the two new columns are pinned with the rest ──────────────────────
-- Byte-identical to 20270405381226 EXCEPT the two added comparisons (origin, brought_new_shop).
CREATE OR REPLACE FUNCTION public.vendor_partnerships_lock_immutable_cols()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Admins own the "admins manage vendor partnerships" policy; let them correct.
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.recommending_vendor_id  IS DISTINCT FROM OLD.recommending_vendor_id
     OR NEW.recommended_vendor_id   IS DISTINCT FROM OLD.recommended_vendor_id
     OR NEW.relationship_type       IS DISTINCT FROM OLD.relationship_type
     OR NEW.additional_fee_centavos IS DISTINCT FROM OLD.additional_fee_centavos
     OR NEW.discount_pct            IS DISTINCT FROM OLD.discount_pct
     OR NEW.covered_plan_groups     IS DISTINCT FROM OLD.covered_plan_groups
     OR NEW.origin                  IS DISTINCT FROM OLD.origin
     OR NEW.brought_new_shop        IS DISTINCT FROM OLD.brought_new_shop
  THEN
    RAISE EXCEPTION
      'IMMUTABLE_PARTNERSHIP_FIELDS: only status may change after a partnership is created (the counterparty, relationship type, and terms are locked to prevent forged endorsements)';
  END IF;

  RETURN NEW;
END;
$$;

-- ── 2 · the served-together check is for proposals only ────────────────────
-- Byte-identical to 20271329352320 EXCEPT the first IF (the two named ways in).
CREATE OR REPLACE FUNCTION public.vendor_partnerships_need_a_shared_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Invite a supplier v3 (owner 16 Nov): "+ Add" lifts the served-together check, and an invite is written on
  -- sign-up. Both are named ways in; the propose path keeps the check.
  IF NEW.origin IN ('added', 'invited') THEN
    RETURN NEW;
  END IF;

  -- Restating an existing link (Re-propose) is not a new link.
  IF EXISTS (
    SELECT 1
      FROM public.vendor_partnerships p
     WHERE p.accepted_at IS NOT NULL
       AND (   (p.recommending_vendor_id = NEW.recommending_vendor_id AND p.recommended_vendor_id = NEW.recommended_vendor_id)
            OR (p.recommending_vendor_id = NEW.recommended_vendor_id  AND p.recommended_vendor_id = NEW.recommending_vendor_id))
  ) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.vendor_served_together_rows(NEW.recommending_vendor_id) r
     WHERE r.other_vendor_profile_id = NEW.recommended_vendor_id
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'NOT_SERVED_TOGETHER'
    USING ERRCODE = 'P0001',
          HINT = 'Suppliers can link up after they have both served the same event (owner 2026-11-06).';
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_partnerships_need_a_shared_event() FROM PUBLIC, anon, authenticated;

-- ── 3 · an invited row is only ever written accepted ───────────────────────
CREATE OR REPLACE FUNCTION public.vendor_partnerships_origin_is_earned()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.origin = 'invited' AND NEW.status <> 'accepted' THEN
    RAISE EXCEPTION 'INVITED_IS_WRITTEN_ON_SIGN_UP'
      USING ERRCODE = 'P0001',
            HINT = 'An invited partnership is made when the shop joins through the link, never proposed.';
  END IF;
  IF NEW.brought_new_shop AND NEW.origin <> 'invited' THEN
    RAISE EXCEPTION 'INVITES_NEED_THE_LINK'
      USING ERRCODE = 'P0001',
            HINT = 'Only a shop created through the invite link counts toward Invites.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_partnerships_origin_is_earned() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_vendor_partnerships_origin_is_earned ON public.vendor_partnerships;
CREATE TRIGGER trg_vendor_partnerships_origin_is_earned
  BEFORE INSERT ON public.vendor_partnerships
  FOR EACH ROW
  EXECUTE FUNCTION public.vendor_partnerships_origin_is_earned();

-- ── 4 · joining through the link ───────────────────────────────────────────
-- Returns: 'joined' (a new handshake) · 'already' (they are partners already) · 'self' (their own link) ·
-- 'no_shop' (the inviter or the joiner is not a named shop).
CREATE OR REPLACE FUNCTION public.supplier_invite_join(p_inviter uuid, p_joiner uuid, p_new_shop boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_inviter IS NULL OR p_joiner IS NULL THEN
    RETURN 'no_shop';
  END IF;
  IF p_inviter = p_joiner THEN
    RETURN 'self';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vendor_profiles WHERE vendor_profile_id = p_inviter AND nullif(btrim(business_name), '') IS NOT NULL)
     OR NOT EXISTS (SELECT 1 FROM public.vendor_profiles WHERE vendor_profile_id = p_joiner) THEN
    RETURN 'no_shop';
  END IF;

  -- Already partners (any kind, either direction): the handshake exists — nothing new, nothing counted.
  IF EXISTS (
    SELECT 1 FROM public.vendor_partnerships p
     WHERE p.status = 'accepted' AND p.is_active
       AND LEAST(p.recommending_vendor_id, p.recommended_vendor_id) = LEAST(p_inviter, p_joiner)
       AND GREATEST(p.recommending_vendor_id, p.recommended_vendor_id) = GREATEST(p_inviter, p_joiner)
  ) THEN
    RETURN 'already';
  END IF;

  -- A pending, declined or removed 'general' row between the two would hold the unordered-pair UNIQUE. Joining is the
  -- yes, so that old row gives way (a pending "+ Add" is answered by the join itself).
  DELETE FROM public.vendor_partnerships p
   WHERE p.relationship_type = 'general'
     AND p.status <> 'accepted'
     AND LEAST(p.recommending_vendor_id, p.recommended_vendor_id) = LEAST(p_inviter, p_joiner)
     AND GREATEST(p.recommending_vendor_id, p.recommended_vendor_id) = GREATEST(p_inviter, p_joiner);
  -- …and an accepted-but-removed one (is_active = false) the same way.
  DELETE FROM public.vendor_partnerships p
   WHERE p.relationship_type = 'general'
     AND NOT p.is_active
     AND LEAST(p.recommending_vendor_id, p.recommended_vendor_id) = LEAST(p_inviter, p_joiner)
     AND GREATEST(p.recommending_vendor_id, p.recommended_vendor_id) = GREATEST(p_inviter, p_joiner);

  INSERT INTO public.vendor_partnerships
    (recommending_vendor_id, recommended_vendor_id, relationship_type, status, accepted_at, is_active, origin, brought_new_shop)
  VALUES
    (p_inviter, p_joiner, 'general', 'accepted', now(), true, 'invited', COALESCE(p_new_shop, false));

  RETURN 'joined';
END;
$$;

REVOKE ALL ON FUNCTION public.supplier_invite_join(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supplier_invite_join(uuid, uuid, boolean) TO service_role;

COMMENT ON FUNCTION public.supplier_invite_join(uuid, uuid, boolean) IS
  'Invite a supplier v3 (owner 16 Nov): the one write of a link join — one accepted "invited" vendor_partnerships row, '
  'inviter → joiner. p_new_shop marks the Invites record and is passed ONLY by the shop-creation action (service_role). '
  'Internal; the signed-in existing-shop door is join_supplier_invite(slug).';

-- The signed-in door: a shop that already exists joins through the link. Never counted toward Invites (answer 2).
CREATE OR REPLACE FUNCTION public.join_supplier_invite(p_inviter_slug text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inviter uuid;
  v_joiner uuid;
BEGIN
  SELECT vendor_profile_id INTO v_inviter
    FROM public.vendor_profiles
   WHERE business_slug = lower(btrim(p_inviter_slug))
   LIMIT 1;

  SELECT vp.vendor_profile_id INTO v_joiner
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
     AND nullif(btrim(vp.business_name), '') IS NOT NULL
   ORDER BY vp.created_at
   LIMIT 1;

  IF v_joiner IS NULL THEN
    RAISE EXCEPTION 'not_your_shop' USING ERRCODE = '42501';
  END IF;

  RETURN public.supplier_invite_join(v_inviter, v_joiner, false);
END;
$$;

REVOKE ALL ON FUNCTION public.join_supplier_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_supplier_invite(text) TO authenticated;

COMMENT ON FUNCTION public.join_supplier_invite(text) IS
  'A shop that already exists joins through another shop''s invite link (/i/<slug>): the handshake, never counted '
  'toward Invites. The joiner is always the caller''s own named shop.';

-- ── 5 · "Worked together" on the shop page ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.shop_worked_with_counts(p_vendor uuid)
RETURNS TABLE (other_vendor_profile_id uuid, events bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT r.other_vendor_profile_id, count(DISTINCT r.event_id) AS events
    FROM public.vendor_served_together_rows(p_vendor) r
   GROUP BY r.other_vendor_profile_id;
$$;

REVOKE ALL ON FUNCTION public.shop_worked_with_counts(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_worked_with_counts(uuid) TO service_role;

COMMENT ON FUNCTION public.shop_worked_with_counts(uuid) IS
  'The shops a supplier served a past event with, and how many events (never which events, never the couple) — the '
  'automatic "Worked together" kind on the shop page''s Trusted by (owner 16 Nov). service_role only.';

COMMIT;
