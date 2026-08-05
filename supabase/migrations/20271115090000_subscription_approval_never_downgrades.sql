-- ============================================================================
-- Approving a STALE subscription must never DOWNGRADE a vendor.
--
-- 🚨 THE LIVE HAZARD. `approve_vendor_subscription` (and its webhook twin)
-- writes `tier_state = v_s.tier` unconditionally. A vendor who started a Pro
-- upgrade, never paid, then later bought and paid for Enterprise leaves the Pro
-- row sitting at `pending_payment` forever. One tap on that stale row sets them
-- back to **Pro** — they lose Enterprise features, and neither the admin nor the
-- vendor is told anything happened. The expiry stacks (GREATEST), so the clock
-- looks fine; only the TIER quietly drops.
--
-- 🔑 A STALE ROW IS NOT A DECISION ABOUT TODAY. It records what someone wanted
-- weeks ago. Applying it blind overwrites a LATER, PAID decision with an
-- earlier, unpaid one.
--
-- The rule: refuse when the vendor's CURRENT tier outranks the purchase's tier
-- and is still live. Raise, do not silently skip — a silent skip would leave the
-- purchase marked paid with nothing granted, which is the same class of bug
-- (something that looks done and is not).
--
-- ⚠ SAME-TIER RENEWALS AND GENUINE UPGRADES ARE UNTOUCHED. Renewing Enterprise
-- on Enterprise, or moving Pro → Enterprise, both still stack exactly as before.
-- An EXPIRED higher tier is also not protected: once it has lapsed the vendor is
-- not holding it any more, so approving a lower purchase is a real activation,
-- not a downgrade.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.vendor_tier_rank(p_tier public.vendor_tier_state)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  -- The ladder, in one place. Anything unrecognised ranks 0 so a NEW tier added
  -- above enterprise can never be silently treated as outranked by pro.
  SELECT CASE p_tier
           WHEN 'free'       THEN 1
           WHEN 'verified'   THEN 2
           WHEN 'pro'        THEN 3
           WHEN 'enterprise' THEN 4
           ELSE 0
         END;
$$;

COMMENT ON FUNCTION public.vendor_tier_rank(public.vendor_tier_state) IS
  'Orders vendor_tier_state so a subscription approval can tell an upgrade from a downgrade. Unknown tiers rank 0 deliberately: a newly added top tier must never be mistaken for something pro outranks.';

-- The guard itself, as a trigger on vendor_profiles, so EVERY writer is covered
-- — the admin action, the webhook entry point, and anything added later.
-- 🔑 PUTTING IT IN ONE OF THE TWO FUNCTIONS WOULD LEAVE THE OTHER OPEN, and the
-- webhook path is the one nobody is watching.
CREATE OR REPLACE FUNCTION public.guard_vendor_tier_no_silent_downgrade()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Only interested in a tier CHANGE that lowers the vendor's standing.
  IF NEW.tier_state IS NOT DISTINCT FROM OLD.tier_state THEN
    RETURN NEW;
  END IF;

  IF public.vendor_tier_rank(NEW.tier_state) >= public.vendor_tier_rank(OLD.tier_state) THEN
    RETURN NEW;
  END IF;

  -- A LAPSED higher tier is not a downgrade — the vendor is no longer holding
  -- it, so activating a lower purchase is a genuine activation.
  IF OLD.tier_expires_at IS NOT NULL AND OLD.tier_expires_at <= now() THEN
    RETURN NEW;
  END IF;

  -- An admin deliberately moving a vendor down (a refund, a correction) sets
  -- this first. It is a per-statement escape hatch, not a standing exemption,
  -- so the default stays closed.
  IF COALESCE(current_setting('setnayan.allow_tier_downgrade', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'TIER_DOWNGRADE_BLOCKED: this vendor is on % until %, and this would put them back to %. '
    'If that is really intended, do it deliberately rather than by approving an old request.',
    OLD.tier_state, OLD.tier_expires_at, NEW.tier_state
    USING ERRCODE = '23514';
END;
$$;

COMMENT ON FUNCTION public.guard_vendor_tier_no_silent_downgrade() IS
  'Blocks a tier change that LOWERS a vendor who is still inside a live higher tier. Exists because approve_vendor_subscription writes tier_state unconditionally, so approving a stale pending_payment row silently demoted a vendor who had since paid for more. Lapsed tiers and deliberate downgrades (setnayan.allow_tier_downgrade) pass.';

DROP TRIGGER IF EXISTS vendor_tier_no_silent_downgrade ON public.vendor_profiles;
CREATE TRIGGER vendor_tier_no_silent_downgrade
  BEFORE UPDATE OF tier_state ON public.vendor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_vendor_tier_no_silent_downgrade();

COMMIT;
