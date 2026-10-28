-- couple_sees_every_suppliers_chat_name
--
-- ── THE BUG (owner, live, 2026-10-28) ────────────────────────────────────────────────────────────────────────────
-- The couple's Chats › Suppliers list drew one thread as "Supplier" (avatar "S") beside another drawn as its shop
-- name; the thread head inside it said "Supplier" too. Owner: "the 1 supplier is not named on chat. Why did she
-- not show properly".
--
-- ── THE CAUSE (proven in apps/web/tests/db/a-couple-sees-every-suppliers-chat-name.db.test.ts) ──────────────────
-- The list and the head read the supplier through a `vendor_profiles` embed under the COUPLE's own session. The only
-- policy that lets a couple read somebody else's shop is `vendor_profiles_public_read`:
--     public_visibility = 'verified' AND verification_state = 'verified'
-- Every other shop — a free shop not yet verified, one pending review, a verified shop that is hidden/coming soon/
-- archived — is a row RLS refuses. PostgREST returns a refused embed as NULL, and both pages printed the literal
-- 'Supplier' for NULL: a refused read rendered as a plausible name. Chatting is not gated on verification, so the
-- couple can hold a live conversation with a shop they are not allowed to read.
--
-- ── THE FIX ──────────────────────────────────────────────────────────────────────────────────────────────────────
-- `couple_thread_supplier_names(p_event_id)` returns, for every chat thread on an event the CALLER is a couple
-- member of, the anonymity inputs for the thread's supplier — and nothing the anonymity rule hides:
--   · name_revealed — the SAME predicate as TS `isVendorNameRevealed` (lib/vendors.ts): venue exemption · verified ·
--     a true-name tier (`isTrueNameTier`: every tier but 'free') · name_revealed_at stamped. Parity with the TS
--     predicate across every enum value is held by the db test above.
--   · business_name and logo_url — ONLY when name_revealed. An unrevealed shop's real name and logo never leave the
--     database through this door (a logo is exactly as identifying as the name it stands for).
--   · screen_name · primary_service · location_city — the inputs of the anonymised name ("<screen name>" or
--     "<Service> · <City>"), which are what a couple is MEANT to see pre-reveal.
-- The server feeds these to the same `resolveVendorDisplayName`, so the label is the one the resolver gives on every
-- other surface. `vendor_profiles` RLS is NOT widened: the couple still cannot read a hidden shop's row.
--
-- 🔒 THE GATE: `t.event_id IN (SELECT current_couple_event_ids())` — the couple branch of `chat_threads_member_read`
-- verbatim, so this returns exactly the threads the couple can already list, and nothing for anyone else.
-- (`current_thread_ids()` is not used: it is still the base migration's empty stub and would return nothing.)
-- SECURITY DEFINER + pinned search_path; EXECUTE for `authenticated` only — anon and PUBLIC hold nothing.

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
    CASE WHEN x.shop_exists AND COALESCE(x.revealed, false) THEN x.business_name END,
    CASE WHEN x.shop_exists AND COALESCE(x.revealed, false) THEN x.logo_url END,
    x.screen_name,
    x.primary_service,
    x.location_city
  FROM x;
$fn$;

COMMENT ON FUNCTION public.couple_thread_supplier_names(uuid) IS
  'The name a couple may see for each supplier they chat with on one of their events (owner bug 2026-10-28: a shop RLS '
  'hides from the couple drew as "Supplier"). Returns the anonymity inputs only; business_name and logo_url are NULL '
  'unless the name is revealed (venue · verified · true-name tier · name_revealed_at — parity with lib/vendors.ts '
  'isVendorNameRevealed held by a-couple-sees-every-suppliers-chat-name.db.test.ts). Gated on current_couple_event_ids().';

REVOKE EXECUTE ON FUNCTION public.couple_thread_supplier_names(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.couple_thread_supplier_names(uuid) TO authenticated;
