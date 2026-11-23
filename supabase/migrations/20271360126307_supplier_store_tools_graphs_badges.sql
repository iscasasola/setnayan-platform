-- ============================================================================
-- supplier_store_tools_graphs_badges — the supplier Store: tools bought once, graphs and badges laid out (23 Nov 2026)
--
-- ⚖ DECISION_LOG 2026-11-23 (specs 5a8c6bf3 · eb51e640 · d019ce12 · 1aaedb5e · 022681cf · 6be18189 · 6a7db142 ·
--   85bcb51a · 46690f6d). Owner, verbatim: *"each specialized tools would be 499 pesos to unlock? so it is Free or
--   Paid."* · *"Yes, one-time"*. The 30-day trial after Verified (6a7db142) was dropped the same day — owner, via the
--   controller: *"Yes, guides only"* (no trial; each widget gets a "How to use it" guide instead).
--   Drawing: specs `prototypes/supplier_store_graphs_badges_2026-11-23/` (v12: Edit per row, tool tags).
--
-- WHAT CHANGES
--   1 · FOUR CATALOG ROWS — one per paid tool (Cake Maker · Song bank · Papic challenge · 3D plan), at the
--       owner's own number (specs 1aaedb5e), editable in admin like every other `vendor_billing_catalog` row. The app
--       reads the price from the row and never types it. A ONE-TIME purchase: no period, no renewal, no expiry.
--   2 · OWNED = A PAID ORDER. A shop owns a paid tool while it has an order for that tool's SKU in `paid` or
--       `fulfilled` (the orders-backed gate: a refund or a reject takes it back with no extra write). No new table.
--   3 · NO TRIAL (owner 23 Nov, "guides only"): nothing is stamped on Verified; the old 9 Nov columns stay untouched.
--   4 · `vendor_store_tool_open(shop, tool, event)` — THE answer for one paid tool from the Store: bought once.
--       A plan that includes the tool still answers through `vendor_pro_tools_included` in each caller. The photo
--       challenge and the branded 3D booth now ask it too (bodies from 20271356215288, one arm added each).
--   5 · THE SHOP'S LAYOUT — ONE column, `vendor_profiles.store_layout` (jsonb), for all three Shop rows (owner via
--       the controller, 23 Nov: add · remove · reorder, "in one place for all three rows"). Shape:
--         { "graphs": [...] | null, "badges": [...] | null, "tools": [...] | null, "tools_off": [...] }
--       Each row's list is its keys in the shop's order. A row that is absent or null = that row's default:
--         graphs — every graph the shop has, in the shipped order
--         badges — the three closest to done (no cap once chosen: the row shows what the shop picked, in its order)
--         tools  — Scanner + the tools suggested for its services, then the paid ones it holds
--       `tools_off` = paid tools taken off the page; a bought tool stays owned (removing never refunds or locks).
--   6 · ONE TOOL KEY (owner via the controller, 23 Nov: "one SpecializedToolKey"). The usage log's 3D key `3d_plan`
--       becomes `plan_3d`, the key the Store's SKU (`vendor_tool_plan_3d`) and `vendor_store_tool_open` already use.
--       Rows move first, then the CHECK is swapped. No row can clash on the UNIQUE shape: `plan_3d` was not allowed.
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

-- ── 4 · THE ONE ANSWER FOR A PAID TOOL ──────────────────────────────────────
-- p_tool is the Store's key: cake_tool · song_bank · papic_challenge · plan_3d (SKU = 'vendor_tool_' || p_tool).
-- p_event_id is kept so every caller passes the event it asks about; a one-time buy is open at every event.
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
    );
$$;

COMMENT ON FUNCTION public.vendor_store_tool_open(UUID, TEXT, UUID) IS
  'Is this paid Store tool open for this shop? TRUE when the shop bought it once (an order for vendor_tool_<tool> in paid/fulfilled) — owned forever; a refund or a reject takes it back. No trial (owner 23 Nov 2026, "guides only"). Plans that include the tool answer through vendor_pro_tools_included in each caller. Mirror: storeToolOpenFrom (apps/web/lib/supplier-store.ts). service_role only.';

REVOKE ALL ON FUNCTION public.vendor_store_tool_open(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_store_tool_open(UUID, TEXT, UUID) TO service_role;

-- The photo challenge — body from 20271356215288; ONE arm added: bought once in the Store.
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
  -- ⟵ ADDED (owner 23 Nov): bought once in the Store.
  OR public.vendor_store_tool_open(p_vendor_profile_id, 'papic_challenge', p_event_id);
$$;

COMMENT ON FUNCTION public.vendor_papic_challenge_entitled(UUID, UUID) IS
  'May this shop run a Papic Challenge at this event? TRUE for a live legacy 28-day subscription, vendor_pro_tools_included (the plan, or grandfathered), OR vendor_store_tool_open(…,''papic_challenge'',…) — bought once in the Store (owner 23 Nov 2026). THE SINGLE definition — called by papic_create_vendor_challenge and papic_vendor_challenge_photos.';

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
        -- ⟵ ADDED (owner 23 Nov): bought once in the Store.
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
  'Which vendors brand their 3D booth at this event beyond the legacy 28-day window: a PAID per-event 3D Booth order (retired 2026-11-09, paid orders honoured) OR a booked shop for which vendor_pro_tools_included is true OR that bought the 3D plan once in the Store (vendor_store_tool_open, owner 23 Nov 2026). service_role ONLY — read by lib/seating.ts fetchBooths. Ids only — never amounts.';

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


-- ── 6 · ONE TOOL KEY: the usage log says `plan_3d`, like the Store ──────────
ALTER TABLE public.specialized_tool_usage DROP CONSTRAINT IF EXISTS specialized_tool_usage_tool_key_known;
UPDATE public.specialized_tool_usage SET tool_key = 'plan_3d' WHERE tool_key = '3d_plan';
ALTER TABLE public.specialized_tool_usage ADD CONSTRAINT specialized_tool_usage_tool_key_known CHECK (tool_key IN (
  -- the free tier (owner 2026-11-09, "The six" + the Scanner)
  'scanner', 'headcount', 'run_of_show', 'emcee_script', 'song_desk',
  'floor_command', 'march', 'live_watch',
  -- the paid tools (the 3D key is the Store's: vendor_tool_plan_3d)
  'papic_challenge', 'plan_3d',
  -- a tool the shop made itself (Tools Maker, Thu 12 Nov) — its template says which shape
  'custom'
));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.specialized_tool_usage WHERE tool_key = '3d_plan') THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: a usage row still says 3d_plan';
  END IF;
END $$;

COMMIT;
