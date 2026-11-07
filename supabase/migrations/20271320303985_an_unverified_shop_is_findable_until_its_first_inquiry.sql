-- an_unverified_shop_is_findable_until_its_first_inquiry
-- ============================================================================
-- 🔎 OWNER, DECISION_LOG 2026-11-07 "AN UNVERIFIED SHOP IS FINDABLE UNTIL ITS
-- FIRST INQUIRY — THEN LOCKED OUT OF FIND UNTIL VERIFIED. REVERSES THE
-- 2026-07-27 'ONLY SHOW SHOPS THAT ARE READY'."
--   (1) an unverified shop is shown in search, Suppliers › Find and suggestions
--       until its FIRST INQUIRY (a couple's first message — not a view, not a save);
--   (2) the first inquiry LOCKS it out of those lists until verified — permanent,
--       whether the inquiry books, ends or is deleted. Importing a customer
--       (creating that first event) locks it the same way;
--   (6) verified shops always show;
--   (7) an admin can lift a lock (e.g. a mistaken inquiry).
--
-- ── WHAT THIS ADDS ──────────────────────────────────────────────────────────
--   1. vendor_profiles.find_locked_at / find_lock_reason — the STAMP of the
--      first inquiry or import. Not a counter: one timestamp, written once by
--      the two triggers below from the records that already exist
--      (chat_messages, event_vendors). A STAMP rather than a live "does a thread
--      exist" read because the ruling says the lock holds "whether the inquiry
--      books, ends or is DELETED" — a derived read would unlock the shop the
--      moment the thread went away.
--   2. vendor_profiles.find_lock_lifted_at / find_lock_lifted_by — the admin
--      lift. Lifting clears the stamp; the NEXT inquiry stamps it again.
--   3. vendor_profiles.is_findable — THE ONE RULE, a stored generated column, so
--      every couple-facing list asks one column instead of re-typing the rule
--      (apps/web/lib/findable-shop.ts is the app's only door to it; the guard
--      apps/web/lib/every-listing-asks-findable.test.ts fails on a list that
--      skips it). Its verified half is EXACTLY isShopLive / vendor_profiles_public_read.
--   4. vendor_market_stats re-created with is_findable appended (the Explore grid
--      reads the view), and vendor_profiles_self re-projected so the shop's own
--      dashboard can read its lock.
--   4b. guard_vendor_profiles_find_lock — a BEFORE trigger refusing a browser
--      session writing the lock columns (a shop must not unlock itself).
--   5. Backfill: every shop that already had a couple's message or an imported
--      customer is stamped with the earliest one.
--
-- 🔒 RLS IS NOT WIDENED. `vendor_profiles_public_read` stays verified-only: an
-- unverified shop reaches a couple ONLY through server-side lists read on the
-- service-role client and gated by is_findable. No new browser-readable door.
--
-- ⚠ ORDER (memory "ALTER before UPDATE in one migration", 55006 in prod
-- 2026-11-01): every ALTER / view / trigger first, the backfill UPDATE LAST.
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS · CREATE OR REPLACE FUNCTION · DROP
-- TRIGGER IF EXISTS · DROP VIEW IF EXISTS + CREATE · the backfill only writes
-- rows whose stamp is NULL.
-- ============================================================================

BEGIN;

-- ── 1 · the stamp and the lift ──────────────────────────────────────────────
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS find_locked_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS find_lock_reason    TEXT,
  ADD COLUMN IF NOT EXISTS find_lock_lifted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS find_lock_lifted_by UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendor_profiles_find_lock_reason_check'
  ) THEN
    ALTER TABLE public.vendor_profiles
      ADD CONSTRAINT vendor_profiles_find_lock_reason_check
      CHECK (find_lock_reason IS NULL OR find_lock_reason IN ('inquiry', 'import'));
  END IF;
END $$;

COMMENT ON COLUMN public.vendor_profiles.find_locked_at IS
  'DECISION_LOG 2026-11-07 "FINDABLE UNTIL ITS FIRST INQUIRY": when the shop had its first inquiry (a couple/coordinator chat message) or its first imported customer (event_vendors.source = ''vendor_invite''). While set and the shop is not verified, is_findable is false: it leaves search, Suppliers › Find and suggestions; its own link and QR still open. Written ONCE by the triggers stamp_find_lock_on_inquiry / stamp_find_lock_on_import; cleared only by an admin lift (/admin/verify). Never re-derived from threads, so deleting the inquiry does not unlock the shop.';
COMMENT ON COLUMN public.vendor_profiles.find_lock_reason IS
  'What set find_locked_at: ''inquiry'' (first couple message) or ''import'' (first customer brought in by the shop''s own invite/QR).';
COMMENT ON COLUMN public.vendor_profiles.find_lock_lifted_at IS
  'When an admin last lifted the find lock (/admin/verify). The next inquiry stamps find_locked_at again.';
COMMENT ON COLUMN public.vendor_profiles.find_lock_lifted_by IS
  'The admin user who last lifted the find lock. Also written to admin_audit_log (action find_lock_lifted).';

-- ── 2 · THE ONE RULE ────────────────────────────────────────────────────────
-- Verified half = isShopLive = vendor_profiles_public_read, unchanged.
-- Unverified half = not yet decided by Setnayan ('unverified' | 'pending_review';
-- never 'rejected' / 'demoted'), not archived, no fraud freeze, no lock.
-- Demo shops are NOT decided here: they keep their own rule (is_demo, applied by
-- every caller exactly as before).
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS is_findable BOOLEAN GENERATED ALWAYS AS (
    COALESCE(
      (public_visibility = 'verified' AND verification_state = 'verified')
      OR (
        verification_state IN ('unverified', 'pending_review')
        AND public_visibility <> 'archived'
        AND find_locked_at IS NULL
        AND fraud_suspended_at IS NULL
        AND fraud_banned_at IS NULL
        AND fraud_tombstoned IS NOT TRUE
      ),
      FALSE
    )
  ) STORED;

COMMENT ON COLUMN public.vendor_profiles.is_findable IS
  'THE ONE RULE for every couple-facing list (search, Suppliers › Find, category pages, suggestions) — DECISION_LOG 2026-11-07. TRUE = verified (public_visibility AND verification_state verified), OR not yet decided (unverified / pending_review), not archived, no fraud freeze and no find lock (find_locked_at). Generated: nothing writes it. Demo shops are filtered separately by is_demo. The app reads it only through apps/web/lib/findable-shop.ts.';

CREATE INDEX IF NOT EXISTS vendor_profiles_is_findable_idx
  ON public.vendor_profiles (is_findable)
  WHERE is_findable;

-- anon never needs the lock columns; is_findable must be readable by every
-- role that reads vendor_market_stats, because that view is security_invoker and
-- checks the invoker's privilege on every column its definition names — without
-- this grant every session read of the marketplace view would fail 42501 whole.
GRANT SELECT (is_findable) ON public.vendor_profiles TO anon, authenticated;
-- The shop reads its own lock on Today (lib/supplier-today.server.ts, a session
-- read of its own row under vendor_profiles_owner / _member_read). Same shape as
-- self_published_at (20271303245624): authenticated yes, anon never. Who lifted
-- it stays service-role only.
-- One column per GRANT: lint-vendor-profiles-column-grants reads single-column grants.
GRANT SELECT (find_locked_at) ON public.vendor_profiles TO authenticated;
GRANT SELECT (find_lock_reason) ON public.vendor_profiles TO authenticated;
GRANT SELECT (find_lock_lifted_at) ON public.vendor_profiles TO authenticated;
REVOKE SELECT (find_locked_at, find_lock_reason, find_lock_lifted_at, find_lock_lifted_by)
  ON public.vendor_profiles FROM anon;

-- ── 2b · A SHOP CANNOT UNLOCK ITSELF ────────────────────────────────────────
-- `authenticated` holds TABLE-level INSERT/UPDATE on vendor_profiles (the shop
-- edits its own row), so a column-level REVOKE cannot take the lock columns back
-- — table-level privilege wins. Same answer the shop's verification and tier
-- columns already have (guard_vendor_profiles_entitlement, 20271221359289): a
-- BEFORE trigger that refuses a browser session writing them. The two stamp
-- triggers below are SECURITY DEFINER (current_user = their owner) and the admin
-- lift writes on the service role, so neither is a browser session; an admin's
-- own session (is_admin()) is let through, as there.
-- A separate function rather than a 40th line in the entitlement guard: that
-- function is re-defined whole by every migration that touches it, and a second
-- concurrent re-definition would silently drop one side's lines.
CREATE OR REPLACE FUNCTION public.guard_vendor_profiles_find_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.find_locked_at IS NOT NULL
         OR NEW.find_lock_reason IS NOT NULL
         OR NEW.find_lock_lifted_at IS NOT NULL
         OR NEW.find_lock_lifted_by IS NOT NULL THEN
        RAISE EXCEPTION 'A shop cannot set its own find lock.'
          USING ERRCODE = '42501',
                HINT = 'The find lock is stamped by a couple''s first inquiry or an imported customer, and lifted only by an admin.';
      END IF;
    ELSIF NEW.find_locked_at IS DISTINCT FROM OLD.find_locked_at
       OR NEW.find_lock_reason IS DISTINCT FROM OLD.find_lock_reason
       OR NEW.find_lock_lifted_at IS DISTINCT FROM OLD.find_lock_lifted_at
       OR NEW.find_lock_lifted_by IS DISTINCT FROM OLD.find_lock_lifted_by THEN
      RAISE EXCEPTION 'A shop cannot change its own find lock.'
        USING ERRCODE = '42501',
              HINT = 'The find lock is stamped by a couple''s first inquiry or an imported customer, and lifted only by an admin.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_vendor_profiles_find_lock() IS
  'DECISION_LOG 2026-11-07: refuses a browser session (authenticated/anon, non-admin) writing the find-lock columns. authenticated holds table-level INSERT/UPDATE on vendor_profiles, so a column REVOKE cannot do this.';

DROP TRIGGER IF EXISTS guard_vendor_profiles_find_lock ON public.vendor_profiles;
CREATE TRIGGER guard_vendor_profiles_find_lock
  BEFORE INSERT OR UPDATE ON public.vendor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_vendor_profiles_find_lock();

REVOKE ALL ON FUNCTION public.guard_vendor_profiles_find_lock() FROM PUBLIC, anon, authenticated;

-- ── 3 · the stamp writers ───────────────────────────────────────────────────
-- Same shape as reveal_vendor_name_on_first_reply (20260530010000): AFTER INSERT,
-- one idempotent UPDATE gated on IS NULL, so every later message is a no-op.
-- 🔑 A COUPLE'S MESSAGE MUST NEVER FAIL BECAUSE OF THIS. The stamp is wrapped:
-- if the UPDATE is refused, the message still sends and the refusal is RAISEd as
-- a WARNING into the Postgres log, never swallowed silently.
CREATE OR REPLACE FUNCTION public.stamp_find_lock_on_inquiry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sender_role::text IN ('couple', 'coordinator')
     AND NEW.is_bot IS NOT TRUE
     AND NEW.vendor_profile_id IS NOT NULL THEN
    BEGIN
      UPDATE public.vendor_profiles
         SET find_locked_at = NOW(),
             find_lock_reason = 'inquiry'
       WHERE vendor_profile_id = NEW.vendor_profile_id
         AND find_locked_at IS NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'stamp_find_lock_on_inquiry: could not stamp vendor % (%): %',
        NEW.vendor_profile_id, SQLSTATE, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.stamp_find_lock_on_inquiry() IS
  'DECISION_LOG 2026-11-07: a couple''s (or their coordinator''s) first message to a shop stamps vendor_profiles.find_locked_at once (IS NULL gate). Never blocks the message: a refused stamp is a WARNING.';

DROP TRIGGER IF EXISTS stamp_find_lock_on_inquiry ON public.chat_messages;
CREATE TRIGGER stamp_find_lock_on_inquiry
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_find_lock_on_inquiry();

CREATE OR REPLACE FUNCTION public.stamp_find_lock_on_import()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source = 'vendor_invite' AND NEW.marketplace_vendor_id IS NOT NULL THEN
    BEGIN
      UPDATE public.vendor_profiles
         SET find_locked_at = NOW(),
             find_lock_reason = 'import'
       WHERE vendor_profile_id = NEW.marketplace_vendor_id
         AND find_locked_at IS NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'stamp_find_lock_on_import: could not stamp vendor % (%): %',
        NEW.marketplace_vendor_id, SQLSTATE, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.stamp_find_lock_on_import() IS
  'DECISION_LOG 2026-11-07: a customer the shop brings in through its own invite/QR (event_vendors.source = ''vendor_invite'') counts as its first booking and stamps vendor_profiles.find_locked_at once, exactly like a first inquiry. Never blocks the insert.';

DROP TRIGGER IF EXISTS stamp_find_lock_on_import ON public.event_vendors;
CREATE TRIGGER stamp_find_lock_on_import
  AFTER INSERT ON public.event_vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_find_lock_on_import();

REVOKE ALL ON FUNCTION public.stamp_find_lock_on_inquiry() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stamp_find_lock_on_import() FROM PUBLIC, anon, authenticated;

-- ── 4 · the views ───────────────────────────────────────────────────────────
-- vendor_market_stats: the 20271221366210 body, every column in its order, with
-- is_findable APPENDED. DROP + CREATE (no object depends on it — same as there).
DROP VIEW IF EXISTS public.vendor_market_stats;

CREATE VIEW public.vendor_market_stats
WITH (security_invoker = true) AS
SELECT
  vp.vendor_profile_id,
  vp.public_id,
  vp.business_name,
  vp.business_slug,
  vp.tagline,
  vp.logo_url,
  vp.services,
  vp.location_city,
  vp.hq_latitude,
  vp.hq_longitude,
  vp.public_visibility,
  vp.event_types,
  vp.compatible_ceremony_types,
  vp.compatible_venue_settings,
  vp.created_at,
  COALESCE(vrs.avg_rating_overall, 0)::NUMERIC(3,2) AS avg_rating_overall,
  COALESCE(vrs.total_count, 0)::INT                 AS review_count,
  CASE
    WHEN vaa.tier = 'sponsored' THEN 2
    WHEN vaa.tier = 'boosted'   THEN 1
    ELSE 0
  END::INT                                           AS ad_rank,
  vaa.tier        AS ad_tier,
  vaa.sku_code    AS ad_sku_code,
  vaa.radius_km   AS ad_radius_km,
  vaa.expires_at  AS ad_expires_at,
  (vp.services && ARRAY[
    'setnayan_concierge',
    'setnayan_papic',
    'setnayan_panood',
    'setnayan_patiktok',
    'setnayan_pakanta',
    'setnayan_pailaw',
    'setnayan_custom_monogram',
    'setnayan_save_the_date_mp4',
    'setnayan_ai_edited_highlight',
    'setnayan_ai_video_highlight'
  ]::TEXT[]) AS is_setnayan_service,
  vp.hq_region,
  vp.tier_state,
  vp.verification_state,
  vp.is_findable
FROM public.vendor_profiles vp
LEFT JOIN public.vendor_review_stats vrs USING (vendor_profile_id)
LEFT JOIN public.vendor_active_ads   vaa USING (vendor_profile_id);

ALTER VIEW public.vendor_market_stats OWNER TO postgres;
REVOKE ALL ON public.vendor_market_stats FROM PUBLIC;
REVOKE ALL ON public.vendor_market_stats FROM anon, authenticated;
GRANT SELECT ON public.vendor_market_stats TO anon, authenticated;
GRANT ALL ON public.vendor_market_stats TO service_role;

COMMENT ON VIEW public.vendor_market_stats IS
  'Marketplace read-path consolidation: vendor_profiles + vendor_review_stats '
  '+ vendor_active_ads with precomputed ad_rank for SQL-side sort. '
  'security_invoker = true. Carries NO contact column since 20271221366210 '
  '(a shop is reached through Setnayan, never around it). Carries is_findable '
  'since 20271320303985 (the one listing rule). Used by /vendors + Explore + '
  'Concierge wizard vendor-pick cards.';

-- vendor_profiles_self: re-projected from information_schema exactly as
-- 20271303245624 did, so the four new columns (and is_findable) reach the
-- shop's own dashboard. Same predicate, same grants — it widens nothing.
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
  IF position('find_locked_at' IN cols) = 0 OR position('is_findable' IN cols) = 0 THEN
    RAISE EXCEPTION 'ANTI-VACUITY FAILED: vendor_profiles_self would not carry the find-lock columns';
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

-- ── 5 · backfill (LAST — after every ALTER) ─────────────────────────────────
-- Each shop's EARLIEST couple/coordinator message or imported customer, once.
WITH firsts AS (
  SELECT vendor_profile_id, MIN(at) AS at,
         (ARRAY_AGG(reason ORDER BY at))[1] AS reason
    FROM (
      SELECT m.vendor_profile_id, m.created_at AS at, 'inquiry'::text AS reason
        FROM public.chat_messages m
       WHERE m.sender_role::text IN ('couple', 'coordinator')
         AND m.is_bot IS NOT TRUE
         AND m.vendor_profile_id IS NOT NULL
      UNION ALL
      SELECT ev.marketplace_vendor_id, ev.created_at, 'import'::text
        FROM public.event_vendors ev
       WHERE ev.source = 'vendor_invite'
         AND ev.marketplace_vendor_id IS NOT NULL
    ) x
   GROUP BY vendor_profile_id
)
UPDATE public.vendor_profiles vp
   SET find_locked_at = f.at,
       find_lock_reason = f.reason
  FROM firsts f
 WHERE vp.vendor_profile_id = f.vendor_profile_id
   AND vp.find_locked_at IS NULL;

COMMIT;
