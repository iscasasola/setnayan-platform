-- order_basket_lines — the payer sees what their onboarding bill covers, and
-- the bill's contents table stays shut to every session role.
--
-- ── THE DEFECT, MEASURED 2026-10-13 ─────────────────────────────────────────
-- The Papic end-to-end tester replayed the real schema and rendered
-- /pay/[reference] as the couple who owned the order. Every render logged:
--
--   [onboarding-order-items] read failed:
--     permission denied for table onboarding_order_items
--
-- `lib/payable-by-reference.ts` lists a basket's lines by reading
-- `onboarding_order_items` on the PAYER'S OWN session (it is session-scoped on
-- purpose — see its header). That table is RLS on, zero policies, grants
-- revoked, so the read is refused for everybody — and the refusal returned
-- `[]`, which the page drew as "no lines". A bill made during sign-up (Papic +
-- Setnayan AI + Pro on one reference) showed the payer one total and nothing
-- under it. The same shape `event_basket_orders_granting` fixed for the
-- OWNERSHIP question on 2026-09-07; this is the LISTING question, still open.
--
-- ── WHY AN RPC, AGAIN, AND NOT A GRANT ──────────────────────────────────────
-- `onboarding-basket-one-bill.db.test.ts` fails the moment any session role can
-- read the table, and `couple-host-policy-scope.db.test.ts` refuses a couple
-- policy that resolves through the MEMBER-wide `current_event_ids()` — an
-- invited guest must never learn what the couple was billed. So the table stays
-- shut and ONE question gets answered: "what is on THIS order?", for:
--
--   · the person who made the order (`orders.user_id = auth.uid()`),
--   · the couple on the order's event (`current_couple_event_ids()`, never any
--     member),
--   · an admin, or the elevated server client.
--
-- Anyone else gets an empty result — the same value an ordinary single-item
-- order returns, so this can never be used to test whether a reference is real.
--
-- 🔑 THE TITLE COMES BACK IN THE SAME ROUND TRIP. The page used to follow the
-- (refused) item read with a second read of `platform_retail_catalog_v2` for
-- the customer-facing names. Joining it here keeps a basket bill at the request
-- count it had while it was broken (prod is on the free plan — least requests
-- per screen), and every ordinary order now skips the read entirely.
--
-- ⚠ READ-ONLY AND `STABLE`. Lines are minted server-side by
-- `mintOnboardingServiceOrders`; nothing user-facing writes them.

CREATE OR REPLACE FUNCTION public.order_basket_lines(p_order_id UUID)
RETURNS TABLE (
  service_code   TEXT,
  title          TEXT,
  quantity       INTEGER,
  unit_price_php NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id  UUID;
  v_event_id UUID;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN;
  END IF;

  SELECT o.user_id, o.event_id
    INTO v_user_id, v_event_id
    FROM public.orders o
   WHERE o.order_id = p_order_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- The authority check, ahead of any read of the lines.
  --
  -- 🪤 WRAPPED IN coalesce(…, false) ON PURPOSE. For a signed-out caller
  -- `auth.uid()` is NULL, so `v_user_id = auth.uid()` is NULL, the whole OR is
  -- NULL, `NOT NULL` is NULL — and `IF NULL` does not take the branch. Without
  -- the coalesce this gate let a caller with NO identity read every line (the
  -- first draft did exactly that; the db test's signed-out case caught it).
  IF NOT coalesce(
    v_user_id = auth.uid()
    OR v_event_id IN (SELECT public.current_couple_event_ids())
    OR public.is_admin()
    OR coalesce(auth.role(), '') = 'service_role',
    false
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT i.service_code,
         NULLIF(btrim(c.title), '')::TEXT,
         i.quantity::INTEGER,
         i.unit_price_php::NUMERIC
    FROM public.onboarding_order_items i
    LEFT JOIN public.platform_retail_catalog_v2 c ON c.service_code = i.service_code
   WHERE i.order_id = p_order_id
   ORDER BY i.service_code;
END;
$$;

COMMENT ON FUNCTION public.order_basket_lines(UUID) IS
  'The lines on ONE onboarding basket order, with each line''s catalog title. '
  'SECURITY DEFINER because onboarding_order_items is deliberately unreadable by any session '
  'role; authority is the order''s own buyer, the couple on its event '
  '(current_couple_event_ids), an admin, or service_role. Added 2026-10-13: /pay showed a '
  'sign-up bill with no lines because the session read was refused.';

REVOKE ALL ON FUNCTION public.order_basket_lines(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.order_basket_lines(UUID) TO authenticated, service_role;
