-- ============================================================================
-- 20271359913146_one_registered_business_one_verified_shop.sql
-- 🔒 "UNLIMITED" = ONE REGISTERED BUSINESS.
--
-- ⚖ OWNER, 2026-11-22 (DECISION_LOG "SUPPLIER PLAN ANTI-ABUSE RULES LOCKED",
-- owner: "Lock all three"; build spec SUPPLIER_SUBSCRIPTIONS_BUILD_SPEC_2026-11-22
-- § ★ I): Pro and Ultra give unlimited cards, people and branches — for ONE
-- registered business (one DTI/SEC number) and its own staff.
--   · every branch carries the shop's DTI/SEC registration number;
--   · one verified shop per registration number;
--   · an agency cannot host other businesses as branches.
--
-- ── WHAT "THE SHOP'S NUMBER" IS ──────────────────────────────────────────
-- `vendor_profiles.registration_number_raw`, compared through the ONE SQL
-- normaliser that already exists: `booking_fee_registration_key` (UPPER,
-- alphanumerics only, ≥ 5 — the twin of `normalizeRegistrationNumber` in
-- lib/vendor-registration-number.ts). Raw, not `_normalized`: a shop whose
-- number COLLIDED keeps `_normalized` NULL (20270925937630), and that second
-- shop is exactly the one this rule is about. Demo shops (`is_demo`) are never
-- matched, on either side — the same reading as `booking_fee_business_matches`.
--
-- ── 1 · ONE VERIFIED SHOP PER REGISTRATION NUMBER ─────────────────────────
-- `registration_number_verified_holder(shop, raw)` answers "which OTHER real
-- shop is already verified under this number?" — the ONE predicate. The server
-- asks it before any approval writes (lib/one-registered-business.server.ts,
-- so the admin reads a plain sentence and nothing half-writes), and the
-- trigger below asks it again on the row itself, so no path — the admin desk,
-- the visibility approve, the verification bypass, the automatic approval or
-- a hand-written UPDATE — can make a second verified shop for one number.
--
-- The trigger fires only when a row BECOMES verified (insert, or a move into
-- 'verified'), when a verified row's number changes, or when a verified demo
-- shop becomes real. A pair that was already verified before this rule keeps
-- its badge (a renewal re-approval is verified → verified and is not refused):
-- nothing already given is taken back. The admin still sees both on the desk
-- (`booking_fee_business_matches`).
--
-- Errcode 23514 (check_violation), NOT 23505: the paper claim in
-- app/vendor-dashboard/shop/inline-docs-actions.ts reads 23505 as "the number
-- is on another shop, flag it for review", and that path must not loop here.
--
-- RACE: one transaction-scoped advisory lock per registration key, so two
-- approvals of two shops with one number at the same moment cannot both read
-- "nobody holds it".
--
-- ── 2 · EVERY BRANCH CARRIES THE SHOP'S NUMBER ────────────────────────────
-- A branch has no registration number of its own (no column): it IS the
-- parent shop's business, so it can never carry a different one, and an
-- agency cannot list another business as its branch. What is new is that a
-- branch cannot be opened (inserted live, re-parented or un-cancelled) under a
-- shop that holds no registration number — otherwise it would carry none.
-- Existing branches are untouched. The friendly answer is asked first in
-- app/vendor-dashboard/branches/actions.ts (`branchNeedsRegistrationRefusal`).
--
-- ── 3 · ONE SHOP PER PERSON (Free) ────────────────────────────────────────
-- Already held: `vendor_profiles.user_id` is NOT NULL UNIQUE (20260513120000),
-- so one account owns one shop. Pinned by the db test, not re-made here.
--
-- RLS: no new table. Functions are SECURITY DEFINER with a pinned
-- search_path (another shop's number is not session-readable,
-- 20271217955839); the holder lookup is service_role-only.
-- Idempotent: CREATE OR REPLACE · CREATE INDEX IF NOT EXISTS · DROP TRIGGER IF EXISTS.
-- ============================================================================

BEGIN;

-- The holder lookup scans verified real shops by key; keep it an index probe.
CREATE INDEX IF NOT EXISTS vendor_profiles_verified_registration_key_idx
  ON public.vendor_profiles (
    public.booking_fee_registration_key(COALESCE(registration_number_raw, registration_number_normalized))
  )
  WHERE verification_state = 'verified' AND is_demo IS NOT TRUE;

-- ── The ONE predicate ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.registration_number_verified_holder(
  p_vendor_profile_id UUID,
  p_registration_raw TEXT
)
 RETURNS UUID
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT o.vendor_profile_id
    FROM public.vendor_profiles o
   WHERE public.booking_fee_registration_key(p_registration_raw) IS NOT NULL
     AND public.booking_fee_registration_key(COALESCE(o.registration_number_raw, o.registration_number_normalized))
         = public.booking_fee_registration_key(p_registration_raw)
     AND o.verification_state = 'verified'
     AND o.is_demo IS NOT TRUE
     AND o.vendor_profile_id IS DISTINCT FROM p_vendor_profile_id
   ORDER BY o.last_verified_at NULLS LAST, o.vendor_profile_id
   LIMIT 1
$function$;

COMMENT ON FUNCTION public.registration_number_verified_holder(UUID, TEXT) IS
  'The OTHER real (non-demo) shop already verified under this DTI/SEC registration number (compared by booking_fee_registration_key), or NULL. Owner 2026-11-22 "UNLIMITED = ONE REGISTERED BUSINESS": one verified shop per registration number. Asked by lib/one-registered-business.server.ts before an approval and by the vendor_profiles_one_verified_per_registration trigger on the row.';

REVOKE ALL ON FUNCTION public.registration_number_verified_holder(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registration_number_verified_holder(UUID, TEXT) TO service_role;

-- ── 1 · The row refuses a second verified shop ─────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_one_verified_shop_per_registration()
 RETURNS TRIGGER
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_key TEXT;
  v_holder UUID;
BEGIN
  IF NEW.verification_state IS DISTINCT FROM 'verified' OR NEW.is_demo IS TRUE THEN
    RETURN NEW;
  END IF;
  v_key := public.booking_fee_registration_key(
    COALESCE(NEW.registration_number_raw, NEW.registration_number_normalized));
  IF v_key IS NULL THEN
    RETURN NEW;
  END IF;
  -- Only a row BECOMING the verified holder of this number is asked; a pair
  -- verified before the rule keeps its badge (nothing given is taken back).
  IF TG_OP = 'UPDATE'
     AND OLD.verification_state = 'verified'
     AND OLD.is_demo IS NOT TRUE
     AND public.booking_fee_registration_key(
           COALESCE(OLD.registration_number_raw, OLD.registration_number_normalized)) IS NOT DISTINCT FROM v_key THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('one_verified_shop_per_registration:' || v_key, 0));

  v_holder := public.registration_number_verified_holder(NEW.vendor_profile_id, v_key);
  IF v_holder IS NOT NULL THEN
    RAISE EXCEPTION 'This registration number already belongs to another verified shop. One registered business has one verified shop.'
      USING ERRCODE = '23514',
            CONSTRAINT = 'vendor_profiles_one_verified_per_registration',
            DETAIL = format('held_by=%s', v_holder);
  END IF;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.enforce_one_verified_shop_per_registration() IS
  'Refuses (23514) a vendor_profiles row becoming verified — or a verified row taking a new number, or a verified demo shop becoming real — when another real shop is already verified under the same registration number (registration_number_verified_holder). Owner 2026-11-22, ONE VERIFIED SHOP PER REGISTRATION NUMBER.';

REVOKE ALL ON FUNCTION public.enforce_one_verified_shop_per_registration() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vendor_profiles_one_verified_per_registration ON public.vendor_profiles;
CREATE TRIGGER vendor_profiles_one_verified_per_registration
  BEFORE INSERT OR UPDATE OF verification_state, registration_number_raw, registration_number_normalized, is_demo
  ON public.vendor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_one_verified_shop_per_registration();

-- ── 2 · A branch opens only under a shop that holds a number ───────────────

CREATE OR REPLACE FUNCTION public.enforce_branch_carries_shop_registration()
 RETURNS TRIGGER
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_key TEXT;
BEGIN
  IF NEW.cancelled_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  -- Only a branch being OPENED is asked: a new one, one moved to another
  -- shop, or a cancelled one coming back. Existing branches are untouched.
  IF TG_OP = 'UPDATE'
     AND OLD.cancelled_at IS NULL
     AND OLD.parent_vendor_profile_id IS NOT DISTINCT FROM NEW.parent_vendor_profile_id THEN
    RETURN NEW;
  END IF;

  SELECT public.booking_fee_registration_key(
           COALESCE(vp.registration_number_raw, vp.registration_number_normalized))
    INTO v_key
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = NEW.parent_vendor_profile_id;

  IF v_key IS NULL THEN
    RAISE EXCEPTION 'A branch carries its shop''s DTI or SEC registration number, and this shop has none yet.'
      USING ERRCODE = '23514',
            CONSTRAINT = 'vendor_branches_carry_shop_registration';
  END IF;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.enforce_branch_carries_shop_registration() IS
  'Refuses (23514) opening a vendor_branches row (insert live, re-parent, or un-cancel) under a shop with no DTI/SEC registration number. A branch has no number of its own: it carries its parent shop''s, so it can never be another business. Owner 2026-11-22, EVERY BRANCH CARRIES THE SHOP''S REGISTRATION NUMBER.';

REVOKE ALL ON FUNCTION public.enforce_branch_carries_shop_registration() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vendor_branches_carry_shop_registration ON public.vendor_branches;
CREATE TRIGGER vendor_branches_carry_shop_registration
  BEFORE INSERT OR UPDATE OF parent_vendor_profile_id, cancelled_at
  ON public.vendor_branches
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_branch_carries_shop_registration();

COMMIT;
