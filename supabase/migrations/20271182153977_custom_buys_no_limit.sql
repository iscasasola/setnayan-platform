-- custom_buys_no_limit
-- ============================================================================
-- OWNER 2026-08-29, asked what going past the 10-customers-per-date ceiling
-- should cost: **"2500 for no limit."**
--
-- Every plan caps how many customers a shop may be CHASING for one single date
-- — accepted-but-not-yet-locked candidates (`vendor_tier_limit(…,
-- 'whitelist_per_date')`): Free 1 · Verified 2 · Solo 3 · Pro 5 · Enterprise 10
-- · Custom 10. A **Custom** shop can now buy that ceiling away for a flat
-- ₱2,500 per 28 days.
--
-- ⛔ SCOPE, DELIBERATELY NARROW AND WORTH READING BEFORE WIDENING IT.
--    This is the CHASING ceiling only. It does NOT touch the BOOKED-OUT
--    WAITLIST (couples queued on a date already taken, capped at 5 for
--    Enterprise/Custom). Two different lists share the word "limit": one is who
--    you are pursuing for a day, the other is who is waiting for a day you have
--    already sold. The owner was asked about the 10 and answered about the 10.
--    Widening the other would ALSO mean widening
--    `vendor_profiles_max_waitlist_0_10`, a CHECK constraint — a second change
--    with a second consequence, and his to ask for.
--
-- 🔑 RULE 0 PAID: THIS IS NOT A NEW MECHANISM. The Custom tier already sells
--    priced dials through `vendor_custom_plans.composition` — nationwide reach
--    (₱2,500), a custom domain (₱500), extra event slots (₱500 each), extra
--    seats — quoted by `computeCustomQuote` and applied to the caps by
--    `vendorEffectiveCaps`. This adds ONE MORE AXIS to that configurator. No new
--    table, no new purchase flow, no new entitlement store.
--
-- ⚠ AND ONE CORRECTION TO THE REASON THIS WAS ALMOST NOT BUILT. It was reported
--   to the owner that the dials would be pointless because "Custom is hidden
--   from every public page", a claim inherited from a session brief and never
--   measured. The catalogue says otherwise: `vendor_custom_base` is ACTIVE at
--   ₱11,000, and three of its dials are active and selling. **A brief's claim is
--   not a measurement**, and the correction is recorded here because the
--   decision nearly turned on it.
--
-- THREE PARTS, and the third is the one that makes it real:
--   1. The ₱2,500 catalogue row.
--   2. `vendor_pipeline_is_unlimited()` — does this shop hold an ACTIVE Custom
--      plan whose composition carries the flag?
--   3. `enforce_vendor_whitelist_per_date` asks it. Without part 3 the axis
--      would be sold, quoted, stored and displayed — and the database would go
--      on refusing the eleventh customer. That is the exact shape of every
--      "gate with no handle" in this schema, sold instead of switched off.
--
-- 🔑 A SEPARATE BOOLEAN, NOT A NULL CAP. The tempting shortcut is to make
--    `vendor_tier_limit` return NULL for an unlimited shop, since the trigger
--    already treats NULL as "do not block". It is refused: NULL there means
--    "unknown key, never silently block an inbox", and one value meaning two
--    things is how a typo becomes an entitlement. The question is asked plainly.
--
-- ⚠ The trigger body below is copied from the LIVE object (`pg_get_functiondef`,
--   read 2026-08-29), never from the migration that last touched it — the rule
--   this repo learned twice this week. Diff: the DECLARE gains one variable and
--   one early return is added after the cap is resolved. Nothing else moves.
--
-- Idempotent: guarded INSERT, CREATE OR REPLACE.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. The ₱2,500 axis, in the admin-managed catalogue.
--
--    ON CONFLICT DO NOTHING, never DO UPDATE: re-running this must not stomp an
--    admin's later price edit at /admin/pricing. Same shape as every sibling
--    Custom axis seed.
-- ----------------------------------------------------------------------------
INSERT INTO public.vendor_billing_catalog
  (sku_code, title, price_php, offering_type, token_grant_count, max_categories, max_sub_seats, display_order)
VALUES
  ('vendor_custom_pipeline_unlimited',
   'Custom — No limit on customers per date (28-day)',
   2500.00, 'custom_addon', NULL, NULL, NULL, 93)
ON CONFLICT (sku_code) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Does this shop hold the axis?
--
--    Reads the ACTIVE composed plan, which is the same row `vendorEffectiveCaps`
--    overlays on the TypeScript side. `= 'true'` on the JSON text, so a plan
--    composed before this axis existed (key absent → NULL) reads as NOT granted.
--    Fail-closed by construction rather than by a COALESCE somebody can drop.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_pipeline_is_unlimited(p_vendor_profile_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.vendor_custom_plans cp
     WHERE cp.vendor_profile_id = p_vendor_profile_id
       AND cp.status = 'active'
       AND cp.composition ->> 'pipelineUnlimited' = 'true'
  );
$$;

COMMENT ON FUNCTION public.vendor_pipeline_is_unlimited(UUID) IS
  'Has this shop bought away the per-date ceiling on customers it may CHASE? Owner 2026-08-29 ("2500 for no limit"): a flat Custom-tier axis stored in vendor_custom_plans.composition->>pipelineUnlimited on the ACTIVE plan. Mirrors vendorEffectiveCaps on the TypeScript side; read by enforce_vendor_whitelist_per_date, which is the gate. Takes a vendor_profile_id and is therefore NOT granted to any user role — it would answer about another shop. ⛔ It does NOT lift the BOOKED-OUT WAITLIST cap, which is a different list and a different owner decision.';

REVOKE ALL ON FUNCTION public.vendor_pipeline_is_unlimited(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_pipeline_is_unlimited(UUID) TO service_role;

-- ----------------------------------------------------------------------------
-- 3. The gate asks it. Without this the axis is sold and does nothing.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_vendor_whitelist_per_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_enabled   BOOLEAN;
  v_tier      TEXT;
  v_cap       INT;
  v_date      DATE;
  v_count     INT;
  v_unlimited BOOLEAN;
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

  -- Bought the ceiling away (owner 2026-08-29, ₱2,500 flat). Asked AFTER the cap
  -- is resolved and BEFORE the count is taken: it is the only branch that can
  -- skip the count entirely, and an unlimited shop should not pay for the query.
  v_unlimited := public.vendor_pipeline_is_unlimited(NEW.vendor_profile_id);
  IF COALESCE(v_unlimited, FALSE) THEN
    RETURN NEW;
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

-- ----------------------------------------------------------------------------
-- 4. And the SCREEN stops counting down to a ceiling that no longer exists.
--
--    Without this, an unlimited shop would still read "You're chasing 3 of 10
--    for 14 Feb" and, at ten, the full-stop block naming the two ways out and
--    offering an upgrade — to a shop that has already bought the upgrade and
--    would NOT be refused. **A gate lifted in the database and not on the screen
--    is a refusal a person is told about and never receives**, which is worse
--    than either state on its own: it invites them to decline a real customer to
--    free a slot they do not need.
--
--    It returns NO ROWS rather than a large number: the component's whole
--    contract is that a null pressure draws nothing, and "of 999" is not a
--    ceiling, it is a lie with a big number in it.
--
--    ⚠ Body copied from the LIVE object; diff is one variable and one early
--    return, placed AFTER the caller-scoping so an unlimited shop still cannot
--    be used to probe another shop's thread.
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

  -- Bought the ceiling away: there is nothing to count down to, so the screen
  -- draws nothing at all rather than a number that will never bind.
  IF public.vendor_pipeline_is_unlimited(v_vendor) THEN
    RETURN;
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

COMMIT;
