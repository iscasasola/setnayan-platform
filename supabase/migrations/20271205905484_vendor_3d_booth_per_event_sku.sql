-- vendor_3d_booth_per_event_sku
-- Created via `pnpm migration:new`. Prefix auto-allocated. KEEP IDEMPOTENT.
--
-- ── OWNER 2026-09-05: "500 per event. or 3000/4 week cycle." ─────────────────
--
-- Vendors pay for BRANDED presence in a couple's published 3D Plan two ways:
--   · `vendor_3d_booth`        ₱3,000 / 28-day cycle, every client's room  (shipped)
--   · `vendor_3d_booth_event`  ₱500 one-time, ONE event                     (this file)
-- Floor for both, owner verbatim: "unverified vendors cannot purchase here and
-- free. only paid vendors (solo, pro and enterprise)".
--
-- 1 · THE CATALOGUE ROW. `offering_type = 'vendor_addon_per_event'` ALREADY
--     EXISTS in the CHECK vocabulary (20270907628470, the Photo Challenge's
--     original per-event shape) — no constraint change, so no re-listed CHECK
--     that could drop a later value. price_php is admin-managed and NOT
--     overwritten on conflict, same as every sibling row.
--
-- 2 · THE GRANT IS THE ORDER ROW. No new table, no new column: `orders` already
--     carries `vendor_profile_id` + `event_id` + `service_key` + `status`. A
--     paid/fulfilled row for this SKU on (vendor, event) IS the entitlement, and
--     it has no clock — the booth stays branded for as long as the couple keeps
--     the room up (the owner's "per event", not a 28-day window that could lapse
--     mid-celebration).
--
-- 3 · THE READ. `orders_owner_read` is `user_id = auth.uid()`, so the COUPLE's
--     own lab (which reads booths with the couple's session) could never see a
--     vendor's order and would draw the generic booth while the public walk
--     (admin client) drew the branded one — two renders disagreeing about one
--     fact. `event_branded_booth_vendor_ids` answers the one question for one
--     event. SECURITY DEFINER, granted to service_role ONLY — the
--     vendor_papic_challenge_entitled precedent (20271181420277): every caller is
--     a server component or action that reads it with the admin client, so no
--     browser can reach it at /rest/v1/rpc/. A first draft granted it to
--     `authenticated` with an in-body current_event_ids() scope; the
--     exposure-freeze guard (exposure-surface.baseline.txt) flagged the widening
--     and this is the narrower answer. The scope predicate stays as belt-and-
--     braces should a grant ever be widened. It returns ids, never amounts.

BEGIN;

INSERT INTO public.vendor_billing_catalog
  (sku_code, title, price_php, offering_type, token_grant_count, max_categories, max_sub_seats, display_order)
VALUES
  ('vendor_3d_booth_event', '3D Booth — Branded at one event', 500.00, 'vendor_addon_per_event', NULL, NULL, NULL, 86)
ON CONFLICT (sku_code) DO UPDATE SET
  title             = EXCLUDED.title,
  offering_type     = EXCLUDED.offering_type,
  token_grant_count = EXCLUDED.token_grant_count,
  max_categories    = EXCLUDED.max_categories,
  max_sub_seats     = EXCLUDED.max_sub_seats,
  display_order     = EXCLUDED.display_order,
  updated_at        = NOW();
  -- price_php intentionally NOT overwritten on conflict (admin-managed).

CREATE OR REPLACE FUNCTION public.event_branded_booth_vendor_ids(p_event_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT o.vendor_profile_id
  FROM public.orders o
  WHERE o.event_id = p_event_id
    AND o.service_key = 'vendor_3d_booth_event'
    AND o.status IN ('paid', 'fulfilled')
    AND o.vendor_profile_id IS NOT NULL
    AND (
      public.is_admin()
      OR p_event_id IN (SELECT public.current_event_ids())
      OR current_user = 'service_role'
    );
$$;

COMMENT ON FUNCTION public.event_branded_booth_vendor_ids(UUID) IS
  'Which vendors hold a PAID per-event 3D Booth branding (orders.service_key = vendor_3d_booth_event, status paid/fulfilled) on this event. The per-event half of lib/seating-3d boothIsBranded; the other half is the 28-day window on vendor_profiles.booth_addon_expires_at. service_role ONLY (the vendor_papic_challenge_entitled precedent) — read server-side with the admin client by lib/seating.ts fetchBooths via its brandedReader. Ids only — never amounts.';

REVOKE ALL ON FUNCTION public.event_branded_booth_vendor_ids(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_branded_booth_vendor_ids(UUID) TO service_role;

COMMIT;
