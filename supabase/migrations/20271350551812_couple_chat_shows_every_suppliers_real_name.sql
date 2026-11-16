-- couple_chat_shows_every_suppliers_real_name
--
-- ── THE RULING (owner, 2026-11-16, ruling 15 — DECISION_LOG, specs 61e7a2fb) ────────────────────────────────────
-- "Real shop name everywhere." PR #7898 made `resolveVendorDisplayName` (lib/vendors.ts) return the stored business
-- name whenever one is on file. The couple's Chats list and thread head could not follow: they read the shop through
-- `couple_thread_supplier_names`, which sent business_name and logo_url as NULL until the reveal predicate said yes,
-- so an unverified shop still drew as "<City> <Category> #N" in chat while it was named on every other surface.
--
-- ── THE CHANGE ───────────────────────────────────────────────────────────────────────────────────────────────────
-- CREATE OR REPLACE against the ONLY prior definition (20271295352678_couple_sees_every_suppliers_chat_name.sql —
-- `grep -l couple_thread_supplier_names supabase/migrations` lists no other). Same signature, same columns, same
-- gate, same grants. ONE difference: business_name and logo_url are returned for every thread's shop, not only a
-- revealed one. `name_revealed` is kept and still computed exactly as before (the SQL twin of `isVendorNameRevealed`,
-- parity held by a-couple-sees-every-suppliers-chat-name.db.test.ts) — it still decides whether a shop's STAFF names
-- show in read receipts (lib/chat-thread-receipts.server.ts), which ruling 15 did not touch.
--
-- 🔒 THE GATE is unchanged: `t.event_id IN (SELECT current_couple_event_ids())` — only the threads the couple can
-- already list. `vendor_profiles` RLS is not widened. SECURITY DEFINER + pinned search_path; EXECUTE for
-- `authenticated` only.

CREATE OR REPLACE FUNCTION public.couple_thread_supplier_names(p_event_id uuid)
RETURNS TABLE (
  thread_id         uuid,
  vendor_profile_id uuid,
  name_revealed     boolean,
  business_name     text,
  logo_url          text,
  screen_name       text,
  primary_service   text,
  location_city     text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  WITH x AS (
    SELECT
      t.thread_id,
      t.vendor_profile_id,
      p.vendor_profile_id IS NOT NULL AS shop_exists,
      (
        COALESCE(p.services::text[] && ARRAY['religious_venue', 'venue']::text[], false)
        OR p.verification_state::text = 'verified'
        OR p.tier_state::text IN ('verified', 'solo', 'pro', 'enterprise', 'custom')
        OR p.name_revealed_at IS NOT NULL
      ) AS revealed,
      p.business_name::text   AS business_name,
      p.logo_url::text        AS logo_url,
      p.screen_name::text     AS screen_name,
      (p.services::text[])[1] AS primary_service,
      p.location_city::text   AS location_city
    FROM public.chat_threads t
    LEFT JOIN public.vendor_profiles p ON p.vendor_profile_id = t.vendor_profile_id
    WHERE t.event_id = p_event_id
      AND t.event_id IN (SELECT public.current_couple_event_ids())
  )
  SELECT
    x.thread_id,
    x.vendor_profile_id,
    x.shop_exists AND COALESCE(x.revealed, false),
    x.business_name,
    x.logo_url,
    x.screen_name,
    x.primary_service,
    x.location_city
  FROM x;
$fn$;

COMMENT ON FUNCTION public.couple_thread_supplier_names(uuid) IS
  'The name a couple sees for each supplier they chat with on one of their events. Since owner ruling 2026-11-16 (15) '
  'the real business_name and logo_url are returned for every shop; name_revealed (venue · verified · true-name tier · '
  'name_revealed_at — parity with lib/vendors.ts isVendorNameRevealed held by '
  'a-couple-sees-every-suppliers-chat-name.db.test.ts) now only decides staff names in receipts. Gated on '
  'current_couple_event_ids().';

REVOKE EXECUTE ON FUNCTION public.couple_thread_supplier_names(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.couple_thread_supplier_names(uuid) TO authenticated;
