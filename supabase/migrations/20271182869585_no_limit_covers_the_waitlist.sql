-- no_limit_covers_the_waitlist
-- ============================================================================
-- OWNER 2026-08-29, verbatim: **"yes wait list add them"**.
--
-- The ₱2,500 "no limit" axis shipped hours earlier (20271182153977) covering ONE
-- of the two per-date ceilings — customers a shop may be CHASING. The BOOKED-OUT
-- WAITLIST was deliberately left out and the owner was told so in those words,
-- as a separate list and a separate decision. He has made it: **one axis, both
-- ceilings.**
--
-- ⇒ A Custom shop holding `composition->>'pipelineUnlimited'` may now also PICK
--   as many couples as are waiting on a date it is booked out on, instead of the
--   5 its tier includes.
--
-- 🔑 THE REASON THIS IS A ONE-LINE CHANGE AND NOT A SCHEMA ONE. The clamp exists
--    to stop a shop keeping an allowance it does not pay for. A shop holding the
--    axis PAYS for it, so the honest edit is "do not clamp", not "clamp to a
--    bigger number".
--
-- ⛔ `vendor_profiles_max_waitlist_0_10` IS DELIBERATELY NOT WIDENED, and this is
--    the part worth reading before somebody "finishes the job":
--
--      Under "no limit" the stored number STOPS BEING A CEILING AT ALL. The
--      enforcement lives in `pickWaitlistCouple`, which now skips the count
--      entirely for such a shop — so raising the CHECK to 999 would change
--      nothing except leave a bigger number sitting in a column, inviting the
--      next reader to treat it as a limit that is not enforced anywhere.
--      A ceiling nobody enforces is worse than no ceiling: it reads as a promise.
--
--      The column keeps its 0..10 range and its meaning: "the number this shop
--      chose, while it has a ceiling to choose within."
--
-- ⚠ Body copied from the LIVE object (`pg_get_functiondef`, read 2026-08-29),
--   never from the migration that last touched it. Diff: one DECLARE line and
--   one early return, placed AFTER the zero-allowance arm so a shop on a plan
--   with NO waitlist still gets none — buying "no limit" on a plan that includes
--   no waiting list at all would otherwise hand it one for free, and the axis is
--   Custom-only, where the base allowance is 5.
--
-- Idempotent: CREATE OR REPLACE only. No schema change, no grant change.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.clamp_vendor_waitlist_to_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_enabled   BOOLEAN;
  v_cap       INT;
  v_touched   BOOLEAN;
  v_unlimited BOOLEAN;
BEGIN
  SELECT COALESCE(ps.vendor_tier_pipeline_caps_enabled, FALSE)
    INTO v_enabled FROM public.platform_settings ps WHERE ps.id = 1;
  IF NOT COALESCE(v_enabled, FALSE) THEN
    RETURN NEW;
  END IF;

  v_cap := public.vendor_tier_limit(NEW.tier_state::text, 'waitlist_acceptances');
  IF v_cap IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_cap = 0 THEN
    -- No waitlist on this plan AT ALL: not a number, a feature. Unconditional —
    -- grandfathering protects a number a supplier chose, never an allowance
    -- they have stopped paying for. The switch cannot be left on, and the
    -- number goes to 0 so nothing downstream reads a stale 1..3 and offers a
    -- CTA the vendor's plan does not include.
    --
    -- ⚠ CHECKED BEFORE THE "no limit" ARM BELOW, ON PURPOSE. A plan that
    -- includes no waiting list gets none even if the axis is somehow present;
    -- the axis raises a ceiling, it does not conjure a feature. (Today it is
    -- Custom-only, whose base allowance is 5, so this ordering is belt and
    -- braces rather than a live path — which is exactly when orderings get
    -- written down wrong.)
    NEW.waitlist_enabled := FALSE;
    NEW.max_waitlist_acceptances := 0;
    RETURN NEW;
  END IF;

  -- Bought the ceiling away (owner 2026-08-29 — "2500 for no limit", extended
  -- the same day with "yes wait list add them"). Nothing to clamp to: the shop
  -- keeps whatever it set, and `pickWaitlistCouple` stops counting against it.
  v_unlimited := public.vendor_pipeline_is_unlimited(NEW.vendor_profile_id);
  IF COALESCE(v_unlimited, FALSE) THEN
    RETURN NEW;
  END IF;

  -- GRANDFATHER: only bind the ceiling to a number somebody is actually
  -- setting. TG_OP='UPDATE' with the column untouched leaves an above-ceiling
  -- value exactly as the supplier chose it.
  v_touched := (TG_OP <> 'UPDATE')
    OR (NEW.max_waitlist_acceptances IS DISTINCT FROM OLD.max_waitlist_acceptances);
  IF NOT v_touched THEN
    RETURN NEW;
  END IF;

  IF NEW.max_waitlist_acceptances > v_cap THEN
    NEW.max_waitlist_acceptances := v_cap;
  ELSIF NEW.max_waitlist_acceptances < 1 THEN
    -- A plan that HAS a waitlist always accepts at least one.
    NEW.max_waitlist_acceptances := 1;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.clamp_vendor_waitlist_to_tier() IS
  'Holds vendor_profiles.max_waitlist_acceptances inside the tier ceiling from vendor_tier_limit(). GRANDFATHERED 2026-08-29: the ceiling binds on INSERT and on an UPDATE that actually changes the number. NO-LIMIT 2026-08-29 (owner, "yes wait list add them"): a shop holding the ₱2,500 Custom axis (vendor_pipeline_is_unlimited) is not clamped at all — the enforcement that matters is pickWaitlistCouple, which stops counting for it. The zero-allowance arm is checked FIRST and stays unconditional: the axis raises a ceiling, it never conjures a waiting list onto a plan that has none, and grandfathering protects a number, never a feature. Inert until platform_settings.vendor_tier_pipeline_caps_enabled.';

COMMIT;
