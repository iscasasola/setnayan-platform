-- 20270806100000_event_host_internal_entitlement.sql
--
-- §10a internal-hosted events own every SKU on the render.
--
-- The problem
-- -----------
-- Internal (§10a) accounts are the Setnayan team/owner accounts. Their events
-- (showcase / demo weddings like "Cale & Ice") are meant to display fully — the
-- admin "Issue a comp grant" form even BLOCKS per-SKU comps on internal accounts
-- because they "already carry a permanent grant" (app/admin/users/actions.ts).
-- But NOTHING conferred that grant on the render: every couple-SKU gate funnels
-- through apps/web/lib/entitlements.ts (eventSkuActive), which only reads
-- `orders` + comp_grants. An internal host who never placed an order therefore
-- renders as owning nothing — e.g. the Save-the-Date film stripped its own
-- music + video + gallery, because
--   ownsStdReveal = eventStdOpeningsActive = eventSkuActive('STD_PREMIUM_OPENINGS')
-- was false even for the owner's own showcase wedding.
--
-- The fix
-- -------
-- A read helper — mirroring event_has_comp_for_sku's SAFE host-scoping — that
-- answers: does any HOST of this event have users.is_internal = TRUE?
-- eventSkuActive() ORs it in, so an internal-hosted event resolves as owning
-- ANY sku on the public page and every feature gate, with no per-event order or
-- comp. Real (external) couples are unaffected.
--
-- Why SECURITY DEFINER (same reasoning as event_has_comp_for_sku)
-- --------------------------------------------------------------
-- The gates run with the service-role admin client on public event pages.
-- Resolving host -> is_internal server-side in one definer function keeps the
-- check correct regardless of caller and strictly scoped to this event's hosts,
-- so it never leaks internal status across accounts.
--
-- Host definition mirrors event_has_comp_for_sku EXACTLY: a couple member
-- (event_members.member_type = 'couple') OR an accepted, non-removed primary-host
-- moderator (event_moderators). Guest / viewer / coordinator memberships do NOT
-- count. Additive + idempotent (CREATE OR REPLACE). No table changes.

BEGIN;

CREATE OR REPLACE FUNCTION public.event_host_is_internal(
  p_event_id UUID
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.users u
     WHERE u.is_internal = TRUE
       AND u.user_id IN (
            -- Legacy couple host.
            SELECT em.user_id
              FROM public.event_members em
             WHERE em.event_id = p_event_id
               AND em.member_type = 'couple'
            UNION
            -- Iteration 0048 primary-host moderator (accepted, not removed).
            SELECT m.user_id
              FROM public.event_moderators m
             WHERE m.event_id = p_event_id
               AND m.removed_at IS NULL
               AND m.accepted_at IS NOT NULL
               AND m.role_subtype IN (
                 'bride','groom','partner1','partner2',
                 'parent_of_bride','parent_of_groom','wedding_planner_external'
               )
       )
  );
$$;

-- Called from user (authenticated / anon on public event pages) and service-role
-- (admin) clients, so grant EXECUTE to all three. SECURITY DEFINER bypasses RLS;
-- the body scopes strictly to one event's hosts.
GRANT EXECUTE ON FUNCTION public.event_host_is_internal(UUID)
  TO authenticated, anon, service_role;

COMMIT;
