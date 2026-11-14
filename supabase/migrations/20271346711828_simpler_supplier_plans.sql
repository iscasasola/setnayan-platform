-- simpler_supplier_plans
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ============================================================================
-- 💳 SIMPLER SUPPLIER PLANS — owner 2026-11-14, DECISION_LOG "SIMPLER SUPPLIER PLANS — APPROVED AS DRAWN, AND THE
-- PLANS ARE NAMED PLUS · PRO · ULTRA (NO "SUPPLIER")" (specs commit 01b7269e; drawing artifact Eiwc64wF1VHLfZ52Sjbs8c).
-- Owner, verbatim: *"maybe remove the Supplier and just label them as plus pro and ultra? approve the other proposed
-- on simpler supplier plans"*. This file carries items (2) (3) (4) (5) (11) of that row — the DATA half. The words
-- (1), (6), (7) are app copy.
--
-- 1 · PRICES (item 2). The only pesos typed are the owner's three 4-week figures — Plus ₱1,490 · Pro ₱4,990 · Ultra
--     ₱9,990. Each year is DERIVED in SQL as 10× its 4-week row ("a year = 10 blocks' price": ₱14,900 · ₱49,900 ·
--     ₱99,900), held by tests/db/a-year-is-ten-four-week-cycles.db.test.ts. Supersedes ₱990 · ₱2,490 · ₱5,990.
--     Titles drop "Supplier" (item 1): "Plus (4 weeks)" … sku_code, offering_type and every internal key
--     (solo / pro / enterprise) are untouched.
-- 2 · ADD-ONS FOLD INTO THE PLANS (items 3, 4, 11). Retired AS PURCHASES — by flag (is_active = FALSE, retired_at,
--     retirement_reason), NEVER deleted, so every order, receipt and paid window that names them keeps its row:
--       vendor_specialized_tools · vendor_specialized_tools_annual   (included from Plus)
--       vendor_ai_addon · vendor_ai_addon_entry                       (included on Pro; the smarter level on Ultra;
--                                                                      Plus cannot buy it)
--       vendor_extra_category · vendor_extra_service_card ·
--       vendor_extra_waitlist · vendor_extra_booking_per_date          (Ultra's higher limits are built in)
--     A shop that already bought one KEEPS IT UNTIL IT RUNS OUT (item 11): nothing here touches vendor_profiles, an
--     order, a window column or a paid count. The activation hook still recomputes the paid counts from the shop's own
--     paid orders, and the app still adds them on top of the plan.
--     LEFT TO BUY (item 4): vendor_deep_search ₱499 a search (every plan, unchanged) · vendor_extra_seat and
--     vendor_additional_branch ₱990 each every 4 weeks (Ultra only, unchanged — only their titles drop "Supplier").
-- 3 · ULTRA'S LIMITS (item 5) — all 16 main categories · 30 cards per category · 10 bookings a day per service at
--     each branch · waiting list 3 (unchanged). Plus and Pro keep today's numbers. Written to the admin-editable
--     `vendor_plan_contents` rows (20271344452857; its trigger records each change in vendor_plan_content_changes) AND
--     to `vendor_tier_limit()`'s code fallback (re-emitted VERBATIM from 20271344452857 but the one Ultra
--     bookings arm, 5 → 10). TIER_CAPS in apps/web/lib/vendor-tier-caps.ts moves in the same PR; the db tests that
--     derive from it hold the three equal.
-- 4 · BOOKINGS ARE COUNTED PER SERVICE PER BRANCH, NOT PER CARD (item 5). `service_card_bookings_on` is the ONE count
--     every reader uses (vendor_agree_to_lock · vendor_day_check · service_cards_unbookable_on · the couple's ask in
--     vendors/actions.ts). It now counts the bookings of every card of the SAME shop, SAME service (category) at the
--     SAME branch — or, for a card on halls, every card sharing one of its halls ("venues: per room"). Signature,
--     grants and every reader unchanged; `service_card_daily_limit` (the number it is compared with) is unchanged.
--     GRANDFATHERED by construction: bookings already held are never touched — only a NEW booking past the number is
--     refused, exactly as before.
--
-- 5 · SPECIALIZED TOOLS FROM PLUS (item 3): `vendor_specialized_tools_unlocked` includes 'solo' among the plans that
--     include it (VERBATIM from 20271331982978 otherwise). Mirror: SPECIALIZED_TOOLS_INCLUDED_TIERS.
--
-- RLS unchanged · no new table · no write to any shop's data · add/loosen only.
-- 🛑 NEVER APPLIED BY HAND. The pipeline (`supabase db push --include-all`) applies it.
-- ============================================================================

BEGIN;

-- ── 1 · the plan prices — the owner's three figures; each year derived 10× ───
UPDATE public.vendor_billing_catalog
   SET price_php  = v.price,
       title      = v.title,
       updated_at = NOW()
  FROM (VALUES
          ('solo_vendor_monthly',       1490.00, 'Plus (4 weeks)'),
          ('pro_vendor_monthly',        4990.00, 'Pro (4 weeks)'),
          ('enterprise_vendor_monthly', 9990.00, 'Ultra (4 weeks)')
       ) AS v(sku_code, price, title)
 WHERE vendor_billing_catalog.sku_code = v.sku_code
   AND (vendor_billing_catalog.price_php IS DISTINCT FROM v.price
        OR vendor_billing_catalog.title IS DISTINCT FROM v.title);

UPDATE public.vendor_billing_catalog y
   SET price_php  = m.price_php * 10,
       title      = v.title,
       updated_at = NOW()
  FROM (VALUES
          ('solo_vendor_annual',       'solo_vendor_monthly',       'Plus (1 year)'),
          ('pro_vendor_annual',        'pro_vendor_monthly',        'Pro (1 year)'),
          ('enterprise_vendor_annual', 'enterprise_vendor_monthly', 'Ultra (1 year)')
       ) AS v(year_sku, month_sku, title)
  JOIN public.vendor_billing_catalog m ON m.sku_code = v.month_sku
 WHERE y.sku_code = v.year_sku
   AND (y.price_php IS DISTINCT FROM m.price_php * 10 OR y.title IS DISTINCT FROM v.title);

-- Ultra's category count on its two plan rows follows the plan (all 16 main categories).
UPDATE public.vendor_billing_catalog
   SET max_categories = 16,
       updated_at     = NOW()
 WHERE sku_code IN ('enterprise_vendor_monthly', 'enterprise_vendor_annual')
   AND max_categories IS DISTINCT FROM 16;

-- What is left to buy keeps its price; only "Supplier" leaves the titles.
UPDATE public.vendor_billing_catalog
   SET title      = replace(title, 'Supplier Ultra only', 'Ultra only'),
       updated_at = NOW()
 WHERE sku_code IN ('vendor_extra_seat', 'vendor_extra_seat_annual',
                    'vendor_additional_branch', 'vendor_additional_branch_annual')
   AND title LIKE '%Supplier Ultra only%';

-- ── 2 · the folded add-ons stop being sold — by flag, never deleted ─────────
UPDATE public.vendor_billing_catalog
   SET is_active         = FALSE,
       retired_at        = COALESCE(retired_at, NOW()),
       retirement_reason = 'Folded into the plans 2026-11-14 (DECISION_LOG "SIMPLER SUPPLIER PLANS"): ' || v.why
                           || ' Shops that bought it keep it until it runs out.',
       updated_at        = NOW()
  FROM (VALUES
          ('vendor_specialized_tools',        'specialized tools are included from Plus.'),
          ('vendor_specialized_tools_annual', 'specialized tools are included from Plus.'),
          ('vendor_ai_addon',                 'the AI chatbot is included on Pro, the smarter level on Ultra; Plus cannot buy it.'),
          ('vendor_ai_addon_entry',           'the AI chatbot is included on Pro, the smarter level on Ultra; Plus cannot buy it.'),
          ('vendor_extra_category',           'Ultra includes all 16 main categories.'),
          ('vendor_extra_service_card',       'Ultra includes 30 cards per category.'),
          ('vendor_extra_waitlist',           'Ultra keeps a waiting list of 3 a date; no place is sold.'),
          ('vendor_extra_booking_per_date',   'Ultra includes 10 bookings a day per service at each branch.')
       ) AS v(sku_code, why)
 WHERE vendor_billing_catalog.sku_code = v.sku_code
   AND vendor_billing_catalog.is_active;

-- ── 3 · Ultra's limits ───────────────────────────────────────────────────────
UPDATE public.vendor_plan_contents c
   SET value = v.value
  FROM (VALUES
          ('enterprise', 'parent_categories', 16),
          ('enterprise', 'services_per_leaf', 30),
          ('enterprise', 'bookings_per_date_per_service', 10)
       ) AS v(plan, key, value)
 WHERE c.plan = v.plan
   AND c.key = v.key
   AND c.value IS DISTINCT FROM v.value;

-- The code fallback — VERBATIM from 20271344452857 but the Ultra bookings arm (5 → 10).
CREATE OR REPLACE FUNCTION public.vendor_tier_limit(p_tier text, p_key text)
RETURNS int
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    -- The admin-edited number (owner 2026-11-13). An unknown tier reads as Free, like the arms below.
    (SELECT c.value
       FROM public.vendor_plan_contents c
      WHERE c.plan = CASE WHEN COALESCE(p_tier, 'free') IN ('free', 'verified', 'solo', 'pro', 'enterprise')
                          THEN COALESCE(p_tier, 'free') ELSE 'free' END
        AND c.key = p_key),
    -- The code values — the fallback when no row exists.
    CASE p_key
    WHEN 'whitelist_per_date' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'free'       THEN 5   -- owner 2026-10-23: the same on every plan (was 1)
        WHEN 'verified'   THEN 5   -- (was 2)
        WHEN 'solo'       THEN 5   -- (was 3)
        WHEN 'pro'        THEN 5
        WHEN 'enterprise' THEN 5   -- (was 10)
        ELSE 5                     -- unknown tier reads as free (asVendorTier)
      END
    WHEN 'waitlist_acceptances' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'free'       THEN 0
        WHEN 'verified'   THEN 0   -- owner 2026-11-04 "waitlist 0,0,1,5" (was 1)
        WHEN 'solo'       THEN 0   -- (was 1)
        WHEN 'pro'        THEN 1   -- (was 3)
        WHEN 'enterprise' THEN 3   -- Ultra trimmed 2026-11-04 (was 5)
        ELSE 0
      END
    WHEN 'branches_included' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'free'       THEN 0   -- owner 2026-11-04 "branches 0,0,3,10"
        WHEN 'verified'   THEN 0
        WHEN 'solo'       THEN 0
        WHEN 'pro'        THEN 3
        WHEN 'enterprise' THEN 6   -- Ultra trimmed 2026-11-04 ("branches 0,0,3,10" said 10)
        ELSE 0
      END
    WHEN 'bookings_per_date_per_service' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'free'       THEN 1    -- owner click 2026-11-06 "FREE AND VERIFIED": "1 each, like Solo"
        WHEN 'verified'   THEN 1    -- same ruling
        WHEN 'solo'       THEN 1    -- owner 2026-11-06: "Solo has 1 per date/service"
        WHEN 'pro'        THEN 3    -- "pro has 3 per date/service"
        WHEN 'enterprise' THEN 10   -- owner 2026-11-14 "SIMPLER SUPPLIER PLANS": 10 a day per service, each branch (was 5)
        ELSE 1                      -- unknown tier reads as Free (asVendorTier)
      END
    WHEN 'storage_gb' THEN
      CASE COALESCE(p_tier, 'free')
        WHEN 'solo'       THEN 5    -- owner 2026-11-13 "plan storage": Solo 5 GB
        WHEN 'pro'        THEN 10   -- Pro 10 GB
        WHEN 'enterprise' THEN 15   -- Ultra 15 GB
        ELSE NULL                   -- Free · Verified (and an unknown tier, read as Free): no allowance ruled — no cap
      END
    ELSE NULL                      -- unknown key: NULL, never a silent 0
    END
  );
$$;

COMMENT ON FUNCTION public.vendor_tier_limit(text, text) IS
  'Per-plan limits. Reads public.vendor_plan_contents first (admin-editable since 2026-11-13, two-admin approval), falling back to the code values when no row exists. Keys: whitelist_per_date · waitlist_acceptances · branches_included · bookings_per_date_per_service (per SERVICE per BRANCH since 2026-11-14 — service_card_bookings_on) · storage_gb (the table also holds services_per_leaf · parent_categories · agent_accounts, which the app reads). STABLE since 2026-11-13 (was IMMUTABLE — it reads a table now). An unknown TIER reads as Free; an unknown KEY returns NULL on purpose so a typo cannot read as an unlimited/zero cap. Fallback mirrors TIER_CAPS in apps/web/lib/vendor-tier-caps.ts.';

-- ── 4 · one count, per service per branch (venues: per room) ────────────────
CREATE OR REPLACE FUNCTION public.service_card_bookings_on(
  p_service_id        uuid,
  p_day               date,
  p_exclude_vendor_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT s.vendor_service_id, s.vendor_profile_id, s.category, s.branch_id
      FROM public.vendor_services s
     WHERE s.vendor_service_id = p_service_id
  ),
  -- The cards that share this card's count: on halls → every card of the shop on one of its halls (a room holds so
  -- many events a day whichever package is booked); otherwise → every card of the same shop, same service
  -- (category), same branch. Always includes the card itself.
  sharing AS (
    SELECT me.vendor_service_id AS sid FROM me
    UNION
    SELECT h2.vendor_service_id
      FROM me
      JOIN public.vendor_service_halls h1 ON h1.vendor_service_id = me.vendor_service_id
      JOIN public.vendor_service_halls h2 ON h2.pool_id = h1.pool_id
                                          AND h2.vendor_profile_id = me.vendor_profile_id
    UNION
    SELECT s2.vendor_service_id
      FROM me
      JOIN public.vendor_services s2
        ON s2.vendor_profile_id = me.vendor_profile_id
       AND s2.category = me.category
       AND s2.branch_id IS NOT DISTINCT FROM me.branch_id
     WHERE me.category IS NOT NULL AND length(me.category) > 0
       AND NOT EXISTS (SELECT 1 FROM public.vendor_service_halls h WHERE h.vendor_service_id = me.vendor_service_id)
  )
  SELECT count(*)::integer
    FROM public.event_vendors ev
    JOIN public.events e ON e.event_id = ev.event_id
   WHERE ev.service_id IN (SELECT sid FROM sharing)
     AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
     AND ev.archived_at IS NULL
     AND e.event_date = p_day
     AND e.event_date_precision = 'day'
     AND (p_exclude_vendor_id IS NULL OR ev.vendor_id <> p_exclude_vendor_id);
$function$;

COMMENT ON FUNCTION public.service_card_bookings_on(uuid, date, uuid) IS
  'Read-only: how many bookings (contracted · deposit_paid · delivered · complete, not archived) the SERVICE this card '
  'belongs to holds on a DAY-PRECISE event that day, optionally excluding one booking row. Counted per service per '
  'branch since 2026-11-14 (DECISION_LOG "SIMPLER SUPPLIER PLANS"): every card of the same shop, same category, same '
  'branch shares the count; a card on halls shares it with every card on one of its halls (venues: per room). The one '
  'count behind the daily limit (service_card_daily_limit) — vendor_agree_to_lock, vendor_day_check, '
  'service_cards_unbookable_on and the couple''s ask (vendors/actions.ts). Server-only (service_role).';

REVOKE ALL ON FUNCTION public.service_card_bookings_on(uuid, date, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_card_bookings_on(uuid, date, uuid) TO service_role;

-- ── 5 · Specialized tools are included from Plus (item 3) ──────────────────
-- VERBATIM from 20271331982978 but the included plans: ('pro', 'enterprise') → ('solo', 'pro', 'enterprise').
-- The paid window (a) and the trial (c) still count, so a Verified shop that bought it keeps it until it runs out.
CREATE OR REPLACE FUNCTION public.vendor_specialized_tools_unlocked(
  p_vendor_profile_id UUID,
  p_event_id          UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((
    SELECT
      -- (b) Plus, Pro and Ultra include it (owner 2026-11-14 "SIMPLER SUPPLIER PLANS"; Pro and Ultra since 2026-11-09).
      (vp.tier_state::TEXT IN ('solo', 'pro', 'enterprise')
         AND (vp.tier_expires_at IS NULL OR vp.tier_expires_at > NOW()))
      OR (
        vp.verification_state::TEXT = 'verified'
        AND vp.tier_state::TEXT IN ('verified', 'solo', 'pro', 'enterprise')
        AND (
          -- (a) a live paid window.
          (a.unlock_expires_at IS NOT NULL AND a.unlock_expires_at > NOW())
          -- (c) the trial, on its event, until it ends.
          OR (p_event_id IS NOT NULL
              AND a.trial_event_id = p_event_id
              AND a.trial_ends_at IS NOT NULL
              AND a.trial_ends_at > NOW())
        )
      )
    FROM public.vendor_profiles vp
    LEFT JOIN public.vendor_specialized_tools_access a
      ON a.vendor_profile_id = vp.vendor_profile_id
    WHERE vp.vendor_profile_id = p_vendor_profile_id
  ), FALSE);
$$;

COMMENT ON FUNCTION public.vendor_specialized_tools_unlocked(UUID, UUID) IS
  'May this shop use the PAID specialized tools (Papic challenge, 3D plan branding, every future tool) at this event? TRUE for (a) a live paid Specialized tools window on a verified Verified-and-up shop (no longer sold since 2026-11-14 — a bought window runs to its end), (b) a live Plus, Pro or Ultra plan (included: Pro/Ultra owner 2026-11-09, Plus owner 2026-11-14), or (c) the one-time first-booked-event trial on THAT event until it ends. The FREE tools never call this. Mirror: specializedToolsUnlockFrom (apps/web/lib/specialized-tools-access.ts). service_role only; the SECURITY DEFINER gates that call it run as the owner.';

REVOKE ALL ON FUNCTION public.vendor_specialized_tools_unlocked(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_specialized_tools_unlocked(UUID, UUID) TO service_role;

COMMIT;
