-- ============================================================================
-- CLOSE THE DELETE LANE ON EVENTS.
--
-- Production grants `authenticated` DELETE on `public.events` — measured, not
-- assumed: `has_table_privilege('authenticated','public.events','DELETE')` is
-- TRUE. With RLS policy `couple_can_delete_event` admitting
-- `current_couple_event_ids()`, a couple can delete their own celebration
-- straight through PostgREST with **no application code running at all**.
--
-- 🔑 WHY THAT MATTERS NOW AND DID NOT BEFORE. Until 2026-08-20 nothing in the
-- product deleted an event, so the lane was unused. Today the delete does real
-- work either side of the row disappearing:
--   · `sever_event_connections()` — a BEFORE DELETE trigger, so it fires on
--     EVERY path including this one. Safe.
--   · the R2 media sweep — application code, so a PostgREST delete SKIPS IT and
--     the photographs are orphaned in storage forever, unreachable and never
--     swept.
--   · the paid-supplier gate — application code, so a PostgREST delete WALKS
--     STRAIGHT PAST the rule the owner set on 2026-08-21 that a supplier who
--     has been paid must first agree.
--
-- Both of those are the half a trigger physically cannot do (Postgres cannot
-- call an HTTP API, and the consent handshake is a product flow). The only way
-- to make them unavoidable is to remove the door that bypasses them.
--
-- ── VERIFIED SAFE BEFORE WRITING ────────────────────────────────────────────
-- Every event delete in the product goes through `createAdminClient()`
-- (service_role), which this revoke does not touch:
--   · app/dashboard/[eventId]/delete-actions.ts     (the couple's delete)
--   · app/admin/events/actions.ts                   (the admin delete)
--   · app/dashboard/(account)/create-event/actions.ts ×2 (rollbacks)
--   · app/onboarding/simple/actions.ts              (rollback)
-- and the abandoned-draft sweep runs through a SECURITY DEFINER RPC.
-- Grepped, not remembered. Nothing reaches DELETE through a session client.
--
-- Same move and same argument as
-- `20271024090000_sec4b_close_the_delete_lane_on_orders_payments.sql`, whose
-- own note reads: "Cancel is the supported verb; delete never was."
--
-- ⚠ THE RLS POLICY IS LEFT IN PLACE ON PURPOSE. A policy without the underlying
-- grant is inert, and deleting it would erase the record of what the product
-- once intended. Belt and braces: if the grant is ever restored by accident,
-- the policy still scopes it to the couple's own events rather than opening it
-- to everybody.
-- ============================================================================

BEGIN;

REVOKE DELETE ON public.events FROM authenticated;
REVOKE DELETE ON public.events FROM anon;

COMMENT ON TABLE public.events IS
  'DELETE is revoked from authenticated and anon (2026-08-21). Deleting an event '
  'runs a media sweep and a paid-supplier consent gate that live in application '
  'code, so a PostgREST delete would skip both — orphaning photographs in R2 and '
  'bypassing the rule that a paid supplier must agree first. Every real delete '
  'path uses service_role. The BEFORE DELETE trigger sever_event_connections() '
  'fires on every path regardless.';

COMMIT;
