-- ============================================================================
-- supplier_store_tools_graphs_badges — the supplier Store: tools bought once, graphs and badges laid out (23 Nov 2026)
--
-- ⚖ DECISION_LOG 2026-11-23 (specs 5a8c6bf3 · eb51e640 · d019ce12 · 1aaedb5e · 022681cf · 6be18189 · 6a7db142 ·
--   85bcb51a · 46690f6d). Owner, verbatim: *"each specialized tools would be 499 pesos to unlock? so it is Free or
--   Paid."* · *"Yes, one-time"* · *"they have 30 days free trial for all the services once verified."* · *"Tools only"*.
--   Drawing: specs `prototypes/supplier_store_graphs_badges_2026-11-23/` (v12: Edit per row, tool tags).
--
-- WHAT CHANGES
--   1 · FOUR CATALOG ROWS — one per paid tool (Cake Maker · Song bank · Papic challenge · 3D plan), at the
--       owner's own number (specs 1aaedb5e), editable in admin like every other `vendor_billing_catalog` row. The app
--       reads the price from the row and never types it. A ONE-TIME purchase: no period, no renewal, no expiry.
--   2 · OWNED = A PAID ORDER. A shop owns a paid tool while it has an order for that tool's SKU in `paid` or
--       `fulfilled` (the orders-backed gate: a refund or a reject takes it back with no extra write). No new table.
--   3 · THE TRIAL CLOCK — `vendor_specialized_tools_access.store_trial_ends_at` (service role only: the table has RLS
--       on and no policy). Stamped ONCE, the first time a shop becomes Verified: verified + 30 days (owner 6a7db142,
--       tools only 85bcb51a). It replaces the 9 Nov first-booking trial for the paid tools; the old columns stay
--       untouched (nothing paid is taken back).
--   4 · `vendor_store_tool_open(shop, tool, event)` — THE answer for one paid tool: owned, or the trial still running,
--       or (never lock mid-event) the event falls on or before the trial's last day and has not ended yet.
--       The photo challenge and the branded 3D booth now ask it too (bodies from 20271356215288, one arm added each).
--   5 · THE SHOP'S LAYOUT — ONE column, `vendor_profiles.store_layout` (jsonb), for all three Shop rows (owner via
--       the controller, 23 Nov: add · remove · reorder, "in one place for all three rows"). Shape:
--         { "graphs": [...] | null, "badges": [...] | null, "tools": [...] | null, "tools_off": [...] }
--       Each row's list is its keys in the shop's order. A row that is absent or null = that row's default:
--         graphs — every graph the shop has, in the shipped order
--         badges — the three closest to done (no cap once chosen: the row shows what the shop picked, in its order)
--         tools  — Scanner + the tools suggested for its services, then the paid ones it holds
--       `tools_off` = paid tools taken off the page; a bought tool stays owned (removing never refunds or locks).
--
-- 🛑 NEVER APPLIED BY HAND. The pipeline pushes this file (CLAUDE.md §5), on the controller's go.
-- Idempotent: IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT DO NOTHING / guarded backfill.
-- ============================================================================

BEGIN;

-- ── 1 · THE FOUR PAID TOOLS IN THE CATALOG ──────────────────────────────────
-- ON CONFLICT DO NOTHING: a row the owner already edited in admin is never overwritten by a re-apply.
INSERT INTO public.vendor_billing_catalog (sku_code, title, price_php, offering_type, is_active, display_order, description)
VALUES
  ('vendor_tool_cake_tool',       'Cake Maker',      499, 'custom_addon', TRUE, 90, 'Specialized tool, one-time. Couples design their cake in your chat. Owned forever, never renews.'),
  ('vendor_tool_song_bank',       'Song bank',       499, 'custom_addon', TRUE, 91, 'Specialized tool, one-time. The songs you play; couples request and preview. Owned forever, never renews.'),
  ('vendor_tool_papic_challenge', 'Papic challenge', 499, 'custom_addon', TRUE, 92, 'Specialized tool, one-time. Photo games for the guests. Owned forever, never renews.'),
  ('vendor_tool_plan_3d',         '3D plan',         499, 'custom_addon', TRUE, 93, 'Specialized tool, one-time. Your booth inside the couple''s 3D plan. Owned forever, never renews.')
ON CONFLICT (sku_code) DO NOTHING;

-- ── 3 · THE TRIAL CLOCK ─────────────────────────────────────────────────────
ALTER TABLE public.vendor_specialized_tools_access
  ADD COLUMN IF NOT EXISTS store_trial_ends_at TIMESTAMPTZ;

COMMENT ON COLUMN public.vendor_specialized_tools_access.store_trial_ends_at IS
  'Owner 23 Nov 2026 (specs 6a7db142, 85bcb51a): the four paid Store tools are free for 30 days from the day the shop first became Verified. Stamped ONCE by vendor_profiles_store_trial_on_verify, never moved. Read by vendor_store_tool_open() and lib/supplier-store.server.ts. Tools only: photo limits and storage stay by plan.';

-- Backfill, once: a shop already Verified gets the 30 days from its verification day (most have run out).
UPDATE public.vendor_specialized_tools_access a
   SET store_trial_ends_at = COALESCE(vp.last_verified_at, NOW()) + INTERVAL '30 days'
  FROM public.vendor_profiles vp
 WHERE vp.vendor_profile_id = a.vendor_profile_id
   AND vp.verification_state::TEXT = 'verified'
   AND a.store_trial_ends_at IS NULL;
INSERT INTO public.vendor_specialized_tools_access (vendor_profile_id, store_trial_ends_at)
SELECT vp.vendor_profile_id, COALESCE(vp.last_verified_at, NOW()) + INTERVAL '30 days'
  FROM public.vendor_profiles vp
 WHERE vp.verification_state::TEXT = 'verified'
ON CONFLICT (vendor_profile_id) DO NOTHING;

-- The stamp: the first time a shop's verification_state becomes 'verified'. Never moves an existing clock.
CREATE OR REPLACE FUNCTION public.vendor_profiles_store_trial_on_verify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.verification_state::TEXT = 'verified'
     AND (TG_OP = 'INSERT' OR OLD.verification_state IS DISTINCT FROM NEW.verification_state) THEN
    INSERT INTO public.vendor_specialized_tools_access (vendor_profile_id, store_trial_ends_at)
    VALUES (NEW.vendor_profile_id, NOW() + INTERVAL '30 days')
    ON CONFLICT (vendor_profile_id) DO UPDATE
      SET store_trial_ends_at = COALESCE(public.vendor_specialized_tools_access.store_trial_ends_at, EXCLUDED.store_trial_ends_at),
          updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_profiles_store_trial_on_verify() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vendor_profiles_store_trial_on_verify ON public.vendor_profiles;
CREATE TRIGGER vendor_profiles_store_trial_on_verify
  AFTER INSERT OR UPDATE OF verification_state ON public.vendor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.vendor_profiles_store_trial_on_verify();

-- ── 4 · THE ONE ANSWER FOR A PAID TOOL ──────────────────────────────────────
-- p_tool is the Store's key: cake_tool · song_bank · papic_challenge · plan_3d (SKU = 'vendor_tool_' || p_tool).
CREATE OR REPLACE FUNCTION public.vendor_store_tool_open(
  p_vendor_profile_id UUID,
  p_tool              TEXT,
  p_event_id          UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    -- Bought once: an order for this tool, paid (a refund or a reject takes it back).
    EXISTS (
      SELECT 1 FROM public.orders o
       WHERE o.vendor_profile_id = p_vendor_profile_id
         AND o.service_key = 'vendor_tool_' || p_tool
         AND o.status IN ('paid', 'fulfilled')
    )
    OR EXISTS (
      SELECT 1 FROM public.vendor_specialized_tools_access a
       WHERE a.vendor_profile_id = p_vendor_profile_id
         AND a.store_trial_ends_at IS NOT NULL
         AND (
           -- The 30 days after Verified are still running …
           a.store_trial_ends_at > NOW()
           -- … or this event fell inside them and has not ended: never lock mid-event (6a7db142).
           OR (p_event_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.events e
                 WHERE e.event_id = p_event_id
                   AND e.event_date IS NOT NULL
                   AND e.event_date <= (a.store_trial_ends_at AT TIME ZONE 'Asia/Manila')::DATE
                   AND COALESCE(e.event_end_date, e.event_date) >= (NOW() AT TIME ZONE 'Asia/Manila')::DATE))
         )
    );
$$;

COMMENT ON FUNCTION public.vendor_store_tool_open(UUID, TEXT, UUID) IS
  'Is this paid Store tool open for this shop (at this event)? TRUE when the shop bought it once (an order for vendor_tool_<tool> in paid/fulfilled), while its 30-day trial after Verified runs, or on an event that fell inside the trial until that event ends (owner 23 Nov 2026). Plans that include the tool answer through their own gates. Mirror: storeToolOpenFrom (apps/web/lib/supplier-store.ts). service_role only.';

REVOKE ALL ON FUNCTION public.vendor_store_tool_open(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_store_tool_open(UUID, TEXT, UUID) TO service_role;

-- The photo challenge — body from 20271356215288; ONE arm added: bought, or in the trial.
CREATE OR REPLACE FUNCTION public.vendor_papic_challenge_entitled(
  p_vendor_profile_id UUID,
  p_event_id          UUID
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_profiles vp
     WHERE vp.vendor_profile_id = p_vendor_profile_id
       AND vp.papic_challenge_expires_at IS NOT NULL
       AND vp.papic_challenge_expires_at > NOW()
  )
  OR public.vendor_pro_tools_included(p_vendor_profile_id, p_event_id)
  -- ⟵ ADDED (owner 23 Nov): bought once in the Store, or in the 30 days after Verified.
  OR public.vendor_store_tool_open(p_vendor_profile_id, 'papic_challenge', p_event_id);
$$;

COMMENT ON FUNCTION public.vendor_papic_challenge_entitled(UUID, UUID) IS
  'May this shop run a Papic Challenge at this event? TRUE for a live legacy 28-day subscription, vendor_pro_tools_included (the plan, or grandfathered), OR vendor_store_tool_open(…,''papic_challenge'',…) — bought once in the Store or in the 30-day trial after Verified (owner 23 Nov 2026). THE SINGLE definition — called by papic_create_vendor_challenge and papic_vendor_challenge_photos.';

-- The branded 3D booth — body from 20271356215288; ONE arm added to the booked-shop half.
CREATE OR REPLACE FUNCTION public.event_branded_booth_vendor_ids(p_event_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT x.vendor_profile_id FROM (
    SELECT o.vendor_profile_id
    FROM public.orders o
    WHERE o.event_id = p_event_id
      AND o.service_key = 'vendor_3d_booth_event'
      AND o.status IN ('paid', 'fulfilled')
      AND o.vendor_profile_id IS NOT NULL
    UNION
    SELECT ev.marketplace_vendor_id
    FROM public.event_vendors ev
    WHERE ev.event_id = p_event_id
      AND ev.marketplace_vendor_id IS NOT NULL
      AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
      AND ev.archived_at IS NULL
      AND (
        public.vendor_pro_tools_included(ev.marketplace_vendor_id, p_event_id)
        -- ⟵ ADDED (owner 23 Nov): bought once in the Store, or in the 30 days after Verified.
        OR public.vendor_store_tool_open(ev.marketplace_vendor_id, 'plan_3d', p_event_id)
      )
  ) x
  WHERE (
      public.is_admin()
      OR p_event_id IN (SELECT public.current_event_ids())
      OR auth.role() = 'service_role'
    );
$$;

COMMENT ON FUNCTION public.event_branded_booth_vendor_ids(UUID) IS
  'Which vendors brand their 3D booth at this event beyond the legacy 28-day window: a PAID per-event 3D Booth order (retired 2026-11-09, paid orders honoured) OR a booked shop for which vendor_pro_tools_included is true OR that bought the 3D plan once in the Store / is in its 30-day trial (vendor_store_tool_open, owner 23 Nov 2026). service_role ONLY — read by lib/seating.ts fetchBooths. Ids only — never amounts.';

REVOKE ALL ON FUNCTION public.event_branded_booth_vendor_ids(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_branded_booth_vendor_ids(UUID) TO service_role;

-- ── 5 · THE SHOP'S LAYOUT (one column for the three rows) ──────────────────
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS store_layout JSONB;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_profiles_store_layout_shape') THEN
    ALTER TABLE public.vendor_profiles
      ADD CONSTRAINT vendor_profiles_store_layout_shape CHECK (
        store_layout IS NULL
        OR (jsonb_typeof(store_layout) = 'object' AND pg_column_size(store_layout) <= 8192));
  END IF;
END $$;

COMMENT ON COLUMN public.vendor_profiles.store_layout IS
  'Owner 23 Nov 2026 (specs 5a8c6bf3 · b6ff3e4c): the Shop''s three Store rows in one place — {graphs, badges, tools, tools_off}, each an ordered list of keys. Absent/null row = its default (graphs: every graph it has; badges: the three closest to done; tools: Scanner + suggested + paid held). tools_off = paid tools taken off the page (still owned). Written ONLY by storeAction op layout (service role, after the shop-manager check); read by lib/supplier-store.server.ts readStoreLayout.';

-- Born readable by the shop (and its console) the way every post-lockdown column is (20271217955839's column
-- allowlist — lint-vendor-profiles-column-grants.mjs): a SELECT grant to `authenticated`, none to anon (the public shop
-- page never reads the layout). Written by the Store's action on the service-role client after the shop-manager check,
-- so no UPDATE grant is added.
GRANT SELECT (store_layout) ON public.vendor_profiles TO authenticated;
REVOKE SELECT (store_layout) ON public.vendor_profiles FROM anon;

-- ── The shop's own view re-projected (its projection is frozen at CREATE) ──
-- The 20271354345662 block verbatim, with the layout column added to its anti-vacuity check.
DROP VIEW IF EXISTS public.vendor_profiles_self;

DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg('vp.' || quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'vendor_profiles';
  IF cols IS NULL THEN
    RAISE EXCEPTION 'refusing to apply: computed vendor_profiles_self projection is empty';
  END IF;
  IF position('find_locked_at' IN cols) = 0 OR position('is_findable' IN cols) = 0
     OR position('gallery_video_titles' IN cols) = 0
     OR position('papers_lapsed_at' IN cols) = 0 OR position('papers_current' IN cols) = 0
     OR position('paused_at' IN cols) = 0 OR position('paused_by' IN cols) = 0
     OR position('booking_min_days' IN cols) = 0 OR position('booking_max_months' IN cols) = 0
     OR position('store_layout' IN cols) = 0 THEN
    RAISE EXCEPTION 'ANTI-VACUITY FAILED: vendor_profiles_self would not carry the find-lock, video-title, papers, pause, booking-window or Store layout columns';
  END IF;
  EXECUTE format($v$
    CREATE VIEW public.vendor_profiles_self
      WITH (security_invoker = false) AS
      SELECT %s
        FROM public.vendor_profiles vp
       WHERE vp.user_id = auth.uid()
          OR vp.vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
  $v$, cols);
END $$;

ALTER VIEW public.vendor_profiles_self OWNER TO postgres;
REVOKE ALL ON public.vendor_profiles_self FROM PUBLIC;
REVOKE ALL ON public.vendor_profiles_self FROM anon;
REVOKE ALL ON public.vendor_profiles_self FROM authenticated;
GRANT SELECT ON public.vendor_profiles_self TO authenticated, service_role;

COMMENT ON VIEW public.vendor_profiles_self IS
  'Definer view: the caller''s OWN shops (owner via user_id = auth.uid(), or a '
  'team member via current_vendor_ids(''viewer'')), projecting every '
  'vendor_profiles column INCLUDING the eleven tax/registration/owner-identity '
  'columns that 20271217955839 revoked from `authenticated` at table level. '
  'Predicate mirrors policies vendor_profiles_owner + vendor_profiles_member_read '
  'exactly -- it widens nothing. SELECT ONLY: an auto-updatable definer view '
  'would let a teammate write past vendor_profiles_owner. Admin and public '
  'surfaces do NOT use this -- they read the table on the service-role client.';

COMMIT;
