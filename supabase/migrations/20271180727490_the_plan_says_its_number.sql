-- the_plan_says_its_number
-- ============================================================================
-- OWNER 2026-08-29 — two corrections to the per-tier pipeline ceilings shipped
-- (switched off) on 2026-08-09 by 20271121655918_vendor_tier_pipeline_caps.
--
--   1. VERIFIED GETS ITS OWN NUMBERS: 2 chasing / 1 waiting (was 1 / 0, cloned
--      from free). The owner's 2026-08-28 grid gives every tier its own pair;
--      `verified` was the one row the 2026-08-09 build had to invent, and it
--      invented "same as free". Asked directly on 2026-08-29 he answered
--      *"we already had a table for this"* — so the table wins.
--
--        NEW SHOP    1 / 0        SOLO        3 / 1        ENTERPRISE  10 / 5
--        VERIFIED    2 / 1        PRO         5 / 3        CUSTOM      10 / 5
--
--      This only ever WIDENS: no vendor loses a slot, and the ladder stays
--      monotonic (free ≤ verified ≤ solo ≤ pro ≤ enterprise ≤ custom), which
--      vendor-tier-pipeline-caps.db.test.ts asserts on both keys.
--      ⚠ The numbers are ALSO in apps/web/lib/vendor-tier-caps.ts (TIER_CAPS).
--      That db test DERIVES its expectations from the TypeScript matrix and
--      interrogates this function for every tier × key, so editing one side
--      alone fails CI. Both sides move in this PR.
--
--   2. GRANDFATHERING (owner 2026-08-28, verbatim: grandfather existing
--      suppliers). `clamp_vendor_waitlist_to_tier` clamped on EVERY write, so
--      the moment the ceilings are switched on, a supplier sitting at 3 on a
--      1-plan loses it to the next unrelated profile save — silently, with the
--      screen simply showing a different number than the one they chose. It now
--      clamps only when the number is ACTUALLY BEING CHANGED (or on INSERT):
--
--        • an unrelated profile edit leaves a grandfathered 3 alone;
--        • the moment they touch it, the ceiling binds — "the cap binds new
--          suppliers and anyone who lowers it";
--        • a brand-new shop is inside the ceiling from its first row.
--
--      🔑 GRANDFATHERING NEEDS NO NEW COLUMN AND NO NEW RECORD. "Keep what you
--      already chose" is exactly "do not touch a value nobody is touching".
--      A stored grandfathered ceiling would be a second copy of a fact the row
--      already holds, and every second copy in this schema has drifted.
--
--      ⛔ WHAT GRANDFATHERING DOES **NOT** DO: it protects a NUMBER, never a
--      FEATURE. A plan whose waitlist allowance is 0 (a shop that stopped
--      paying) still has no waitlist at all — that arm stays unconditional. A
--      shop keeping a waitlist it no longer pays for is not grandfathering, it
--      is a free upgrade granted by a downgrade.
--
--   THE WHITELIST HALF NEEDS NO GRANDFATHER CLAUSE AND THIS IS WHY: its trigger
--   fires only on the transition INTO 'accepted'. Customers a supplier is
--   already chasing are never counted against them retroactively and are never
--   dropped; the ceiling can only ever refuse the NEXT one. Switching the
--   ceilings on therefore cannot disturb work in flight. Stated here because
--   "why is there no grandfather arm on the other trigger" is the obvious
--   question a future reader will have, and the answer is structural.
--
-- ⚠ CORRECTION TO THE BRIEF THAT COMMISSIONED THIS WORK, recorded because it
--   cost a wrong diagnosis once already. It stated that
--   `platform_settings.vendor_tier_pipeline_caps_enabled` "exists in prod and
--   NOTHING in the entire repo references it — searched including migrations".
--   FALSE. The whole engine ships and is referenced by a migration, a library
--   and a db test; it has simply been switched OFF since 2026-08-09. The search
--   that produced that claim was run against a checkout ~700 commits behind
--   origin/main — the first trap that same brief warns about, on its own first
--   page. Nothing here is new machinery; it is two edits to shipped machinery.
--
-- STILL SHIP-DARK AT THE DATABASE LEVEL: both functions read
-- platform_settings.vendor_tier_pipeline_caps_enabled and return unchanged when
-- it is FALSE. The owner has asked for it ON; the flip is a separate,
-- deliberate act after this is served, never inside a migration.
--
-- Idempotent: CREATE OR REPLACE only. No schema change, no RLS change, no
-- grant change (vendor_tier_limit stays revoked from anon/authenticated —
-- the UI reads the grid from the TypeScript matrix and both triggers are
-- SECURITY DEFINER).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. The grid — `verified` gets the owner's own numbers.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_tier_limit(p_tier text, p_key text)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE p_key
    WHEN 'whitelist_per_date' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'free'       THEN 1
        WHEN 'verified'   THEN 2   -- owner 2026-08-29 (was 1, cloned from free)
        WHEN 'solo'       THEN 3
        WHEN 'pro'        THEN 5
        WHEN 'enterprise' THEN 10
        WHEN 'custom'     THEN 10
        ELSE 1                     -- unknown tier reads as free (asVendorTier)
      END
    WHEN 'waitlist_acceptances' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'free'       THEN 0
        WHEN 'verified'   THEN 1   -- owner 2026-08-29 (was 0, cloned from free)
        WHEN 'solo'       THEN 1
        WHEN 'pro'        THEN 3
        WHEN 'enterprise' THEN 5
        WHEN 'custom'     THEN 5
        ELSE 0
      END
    ELSE NULL                      -- unknown key: NULL, never a silent 0
  END;
$$;

COMMENT ON FUNCTION public.vendor_tier_limit(text, text) IS
  'Owner-set per-tier pipeline limits (2026-08-09; verified retuned 2026-08-29 to 2/1 from the owner''s own grid). Keys: whitelist_per_date (accepted-but-not-yet-locked customers a vendor may hold for ONE date) · waitlist_acceptances (couples they may accept off the waitlist for one date). Mirrors TIER_CAPS in apps/web/lib/vendor-tier-caps.ts; the two are held in step by tests/db/vendor-tier-pipeline-caps.db.test.ts, which derives from the TS side. An unknown KEY returns NULL on purpose so a typo cannot read as an unlimited/zero cap.';

-- ----------------------------------------------------------------------------
-- 2. The clamp — grandfathered.
--
--    The ONLY change from 20271121655918 is the guard on the > 0 arm: it now
--    fires on INSERT, or on an UPDATE that actually moves the number. The
--    zero-allowance arm is deliberately left unconditional (see the header).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clamp_vendor_waitlist_to_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_cap     INT;
  v_touched BOOLEAN;
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
    NEW.waitlist_enabled := FALSE;
    NEW.max_waitlist_acceptances := 0;
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
  'Holds vendor_profiles.max_waitlist_acceptances inside the tier ceiling from vendor_tier_limit(). GRANDFATHERED 2026-08-29 (owner): the ceiling binds on INSERT and on an UPDATE that actually changes the number — an unrelated profile save never lowers a value the supplier already chose. The zero-allowance arm (a plan with no waitlist at all) stays unconditional and also forces waitlist_enabled off: grandfathering protects a number, never a feature. CLAMPS rather than raises so a downgraded vendor can still save their settings page. Inert until platform_settings.vendor_tier_pipeline_caps_enabled.';

-- ----------------------------------------------------------------------------
-- 3. ONE PREDICATE, TWO CALLERS — the count the trigger refuses on is now the
--    same count the screen shows.
--
--    Until today the whitelist number had ZERO readers in the entire app
--    (`vendorWhitelistPerDate` in lib/vendor-tier-caps.ts was imported by
--    nothing but its own test). The only way a supplier could learn their
--    number was to be refused by it. Wiring a screen to it is the point of
--    this PR — and the way to wire it WRONG is to re-write the count in
--    TypeScript, at which point the sentence on the screen and the sentence in
--    the refusal are two hand-maintained copies of one rule. This schema has
--    paid for that shape more than once.
--
--    So the counting moves into its own function, and BOTH the trigger and the
--    reader call it. Change the predicate once, both move.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_whitelist_used_for_date(
  p_vendor_profile_id UUID,
  p_date              DATE,
  p_exclude_thread_id UUID DEFAULT NULL
)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Live whitelist for this vendor on this DATE: accepted threads whose event
  -- is not yet locked in with them. Same predicate the vendor's own "Inquiring"
  -- list uses (clients/surface.tsx: accepted && not booked).
  SELECT COUNT(*)::int
    FROM public.chat_threads t
    JOIN public.events e ON e.event_id = t.event_id
   WHERE t.vendor_profile_id = p_vendor_profile_id
     AND (p_exclude_thread_id IS NULL OR t.thread_id <> p_exclude_thread_id)
     AND t.inquiry_status = 'accepted'::public.chat_inquiry_status
     AND e.event_date = p_date
     AND NOT EXISTS (
       SELECT 1 FROM public.event_vendors ev
        WHERE ev.marketplace_vendor_id = p_vendor_profile_id
          AND ev.event_id = t.event_id
          AND ev.status IN (
                'deposit_paid'::public.vendor_status,
                'delivered'::public.vendor_status,
                'complete'::public.vendor_status
              )
     );
$$;

COMMENT ON FUNCTION public.vendor_whitelist_used_for_date(UUID, DATE, UUID) IS
  'How many accepted-but-not-yet-locked customers a vendor currently holds for ONE date. The SINGLE definition of the whitelist count: called by enforce_vendor_whitelist_per_date() (which refuses on it) and by vendor_whitelist_pressure() (which shows it). Takes a vendor_profile_id and is therefore NOT granted to any user role — it would report another shop pipeline depth. Reach it through vendor_whitelist_pressure(), which scopes to the caller own shops.';

-- It answers a question about ANY shop, so no user role may call it directly.
REVOKE ALL ON FUNCTION public.vendor_whitelist_used_for_date(UUID, DATE, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_whitelist_used_for_date(UUID, DATE, UUID)
  TO service_role;

-- ----------------------------------------------------------------------------
-- 4. The reader the screen calls. CALLER-SCOPED: it takes a THREAD, resolves
--    the shop from that thread, and answers only if the caller is that shop.
--    (A p_vendor_profile_id argument would let any signed-in vendor read any
--    other shop pipeline depth for any date — a competitive-intelligence leak
--    out of a helper that only exists to draw a progress line.)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_whitelist_pressure(p_thread_id UUID)
RETURNS TABLE(used int, cap int, event_date date, enforced boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile_ids UUID[];
  v_vendor      UUID;
  v_event       UUID;
  v_date        DATE;
  v_tier        TEXT;
  v_cap         INT;
  v_enabled     BOOLEAN;
BEGIN
  SELECT array_agg(v) INTO v_profile_ids FROM public.current_vendor_profile_ids() AS v;
  IF v_profile_ids IS NULL OR array_length(v_profile_ids, 1) IS NULL THEN
    RETURN;  -- not a vendor -> no rows, and the caller draws nothing
  END IF;

  SELECT t.vendor_profile_id, t.event_id
    INTO v_vendor, v_event
    FROM public.chat_threads t
   WHERE t.thread_id = p_thread_id
     AND t.vendor_profile_id = ANY(v_profile_ids);
  IF v_vendor IS NULL OR v_event IS NULL THEN
    RETURN;  -- not this caller thread -> no rows
  END IF;

  SELECT e.event_date INTO v_date FROM public.events e WHERE e.event_id = v_event;
  IF v_date IS NULL THEN
    RETURN;  -- no date chosen yet: the ceiling has nothing to scope to, and the
             -- trigger accepts freely, so the screen must promise nothing.
  END IF;

  SELECT vp.tier_state::text INTO v_tier
    FROM public.vendor_profiles vp WHERE vp.vendor_profile_id = v_vendor;
  v_cap := public.vendor_tier_limit(v_tier, 'whitelist_per_date');
  IF v_cap IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(ps.vendor_tier_pipeline_caps_enabled, FALSE)
    INTO v_enabled FROM public.platform_settings ps WHERE ps.id = 1;

  RETURN QUERY SELECT
    public.vendor_whitelist_used_for_date(v_vendor, v_date, p_thread_id),
    v_cap,
    v_date,
    COALESCE(v_enabled, FALSE);
END;
$$;

COMMENT ON FUNCTION public.vendor_whitelist_pressure(UUID) IS
  'How full is this shop pipeline for the date of THIS inquiry: used (excluding this thread), cap, the date, and whether the ceilings are switched on at all. Caller-scoped through current_vendor_profile_ids() so it can only ever answer about the caller own shop. Returns NO ROWS when the caller is not that shop, when the couple has not picked a date, or when the tier grid has no answer -- in every one of those cases the screen must draw nothing rather than invent a number.';

REVOKE ALL ON FUNCTION public.vendor_whitelist_pressure(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_whitelist_pressure(UUID) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. The trigger now calls the shared count instead of carrying its own copy.
--    Behaviour is byte-identical; the SELECT COUNT(*) block is replaced by the
--    function call and nothing else changes.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_vendor_whitelist_per_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_tier    TEXT;
  v_cap     INT;
  v_date    DATE;
  v_count   INT;
BEGIN
  SELECT COALESCE(ps.vendor_tier_pipeline_caps_enabled, FALSE)
    INTO v_enabled FROM public.platform_settings ps WHERE ps.id = 1;
  IF NOT COALESCE(v_enabled, FALSE) THEN
    RETURN NEW;
  END IF;

  IF NEW.inquiry_status IS DISTINCT FROM 'accepted'::public.chat_inquiry_status THEN
    RETURN NEW;
  END IF;
  -- Only the transition INTO accepted; re-saving an accepted thread is not a
  -- new candidate and must never be refused. This is also why the whitelist
  -- half needs no grandfather clause: a customer already being chased is never
  -- re-counted, so switching the ceilings on cannot disturb work in flight.
  IF TG_OP = 'UPDATE'
     AND OLD.inquiry_status = 'accepted'::public.chat_inquiry_status THEN
    RETURN NEW;
  END IF;
  IF NEW.vendor_profile_id IS NULL OR NEW.event_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT e.event_date INTO v_date FROM public.events e WHERE e.event_id = NEW.event_id;
  -- No date chosen yet => nothing to scope a per-date cap to. Accept freely; the
  -- cap re-applies to any later accept once the couple picks their day.
  IF v_date IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT vp.tier_state::text INTO v_tier
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = NEW.vendor_profile_id;
  v_cap := public.vendor_tier_limit(v_tier, 'whitelist_per_date');
  IF v_cap IS NULL THEN
    RETURN NEW;  -- unknown key can never silently block a vendor inbox
  END IF;

  v_count := public.vendor_whitelist_used_for_date(
    NEW.vendor_profile_id, v_date, NEW.thread_id
  );

  IF v_count >= v_cap THEN
    RAISE EXCEPTION
      'WHITELIST_DATE_LIMIT: this plan lets you pursue % client(s) at a time for % (currently %)',
      v_cap, to_char(v_date, 'DD Mon YYYY'), v_count
      USING ERRCODE = 'check_violation',
            HINT = 'Lock one of them in, or decline someone, to free a slot - or upgrade for more.';
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
