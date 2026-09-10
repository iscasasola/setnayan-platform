-- onboarding_order_items — the couple learns what their own bill covers,
-- WITHOUT the table ever becoming readable by a session role.
--
-- ── THE DEFECT, MEASURED IN PRODUCTION ──────────────────────────────────────
-- `403 /rest/v1/onboarding_order_items` — 42501 — every hit since 2026-08-11,
-- on `/dashboard/[eventId]/studio/setnayan-ai`. Captured live 2026-09-07
-- 12:35 for a brand-new event, query string verbatim:
--
--   ?select=order_id,order:orders!inner(event_id,status)
--   &service_code=eq.SETNAYAN_AI
--   &order.event_id=eq.cc47d373-…
--
-- That is the OWNERSHIP reader in `lib/onboarding-order-items.ts`, whose own
-- docblock says: "every function takes the caller's Supabase client — so it
-- inherits whatever authority the caller has." Called from a page rendered for
-- the couple, it goes out as `authenticated`.
--
-- 🔑 The failure is silent by construction. `lib/entitlements.ts` treats the
-- refusal as "does not own it", so a couple who BOUGHT Setnayan AI inside an
-- onboarding basket reads as not owning it. `data ?? []` on a refused query is
-- an empty result for a broken read, not an empty table.
--
-- ── WHY THIS IS AN RPC AND NOT A GRANT + POLICY ─────────────────────────────
-- The first draft of this migration granted `SELECT` to `authenticated` and
-- added a policy reaching through `orders`. Two shipped guards refused it, both
-- correctly, and both are worth more than the shortcut:
--
--   · `onboarding-basket-one-bill.db.test.ts` — "no session role can read or
--     write a bill's contents". RLS on, ZERO policies, grants revoked: only
--     service_role touches this table. That is a deliberate decision about a
--     billing table, not an oversight to be corrected by the first reader that
--     trips over it.
--   · `couple-host-policy-scope.db.test.ts` T1/T7c — a policy named
--     `*_couple_*` must not resolve through the MEMBER-wide
--     `current_event_ids()`. The draft's did, which would have shown every
--     invited guest what the couple was billed for.
--
-- So the table stays shut and the QUESTION gets an answer instead. This
-- function is the repo's ordinary shape for exactly that (several hundred
-- `GRANT EXECUTE … TO authenticated` RPCs precede it), and it is narrower than
-- the policy would have been in both directions: it answers one boolean-shaped
-- question about ONE event, and it resolves membership through
-- `current_couple_event_ids()` — the couple, never any member.
--
-- ⚠ READ-ONLY AND `STABLE`. Line items are minted server-side by
-- `mintOnboardingServiceOrders`; nothing user-facing writes them. A couple may
-- learn what they were billed — never author it.

CREATE OR REPLACE FUNCTION public.event_basket_orders_granting(
  p_event_id     UUID,
  p_service_code TEXT
)
RETURNS TABLE (order_id UUID, status TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_event_id IS NULL OR p_service_code IS NULL OR p_service_code = '' THEN
    RETURN;
  END IF;

  -- The authority check, ahead of any read. A caller who is not the couple on
  -- this event, not an admin, and not the elevated server client gets an empty
  -- result — the same value an event with no basket returns, which is the
  -- correct answer to "does this event own X?" for someone who may not ask.
  IF NOT (
    p_event_id IN (SELECT public.current_couple_event_ids())
    OR public.is_admin()
    OR coalesce(auth.role(), '') = 'service_role'
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT i.order_id, o.status::TEXT
  FROM public.onboarding_order_items i
  JOIN public.orders o ON o.order_id = i.order_id
  WHERE i.service_code = p_service_code
    AND o.event_id = p_event_id;
END;
$$;

COMMENT ON FUNCTION public.event_basket_orders_granting(UUID, TEXT) IS
  'Which orders on THIS event carry a basket line for this service_code, and their status. '
  'SECURITY DEFINER because onboarding_order_items is deliberately unreadable by any session '
  'role; authority is the couple (current_couple_event_ids), an admin, or service_role. '
  'Added 2026-09-07 after a 403 that had silenced Setnayan AI ownership since 2026-08-11.';

REVOKE ALL ON FUNCTION public.event_basket_orders_granting(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_basket_orders_granting(UUID, TEXT)
  TO authenticated, service_role;
