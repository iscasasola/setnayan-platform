-- onboarding_order_items — the couple may read their own bill's line items.
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
-- Measured state of the table: RLS **enabled**, **zero grants**, **zero
-- policies**. So the read was refused twice over, and a GRANT alone would still
-- have been refused — RLS with no policy denies everything.
--
-- 🔑 The failure is silent by construction. `lib/entitlements.ts` treats the
-- refusal as "does not own it", so a couple who BOUGHT Setnayan AI inside an
-- onboarding basket reads as not owning it. `data ?? []` on a refused query is
-- an empty result for a broken read, not an empty table.
--
-- ── WHY THE POLICY REACHES THROUGH `orders` ─────────────────────────────────
-- This table has `order_id` and NO `event_id`, so membership cannot be tested
-- on the row itself. `orders` has `event_id`, already carries
-- `orders_owner_read`, and already grants SELECT to `authenticated` — the
-- parent is reachable, only the child was not. The policy therefore mirrors the
-- parent's reach rather than inventing a second definition of "yours".
--
-- Canonical pattern: event-membership via `public.current_event_ids()`
-- (02_Specifications/RLS_Policy_Pattern.md § 5). No new pattern is introduced.
--
-- ⚠ SELECT ONLY. Line items are minted server-side with the service-role client
-- (`mintOnboardingServiceOrders`); nothing user-facing writes them, so no
-- INSERT/UPDATE/DELETE policy is granted. A couple may read what they were
-- billed — never author it.

-- Idempotent: safe to re-run, and safe if a later branch adds the same policy.
DROP POLICY IF EXISTS onboarding_order_items_couple_read ON public.onboarding_order_items;

CREATE POLICY onboarding_order_items_couple_read
  ON public.onboarding_order_items
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT o.order_id
      FROM public.orders o
      WHERE o.event_id IN (SELECT public.current_event_ids())
    )
  );

-- The grant is REQUIRED as well as the policy: PostgREST refuses the request at
-- the privilege layer before RLS is ever consulted, and that refusal reads as
-- exactly the same 42501.
GRANT SELECT ON public.onboarding_order_items TO authenticated;

COMMENT ON POLICY onboarding_order_items_couple_read ON public.onboarding_order_items IS
  'A couple reads the line items of orders on their own events, via orders.event_id '
  '→ current_event_ids(). SELECT only: items are minted service-side. Added 2026-09-07 '
  'after a 403 that had silenced Setnayan AI ownership since 2026-08-11.';
