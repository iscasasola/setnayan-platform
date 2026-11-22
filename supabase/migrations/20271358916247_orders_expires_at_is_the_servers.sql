-- orders_expires_at_is_the_servers
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ============================================================================
-- 🔒 `orders.expires_at` IS THE SERVER'S — a browser role can never change it.
--
-- ── THE HOLE (ship review of PR #8019, 22 Nov) ──────────────────────────────
-- `orders.expires_at` is the END of a paid window: a subscription's, a branch's, and — since 20271351415438 — every
-- add-on's 28 days (`vendor_live_ultra_addons` counts an order while `expires_at > now()`). But the column was never in
-- `guard_orders_protected_columns`' list, `authenticated` holds UPDATE on it through the table grant, and
-- `orders_owner_write` lets a buyer UPDATE their own order while its status stays `submitted`:
--
--     PATCH /rest/v1/orders?order_id=eq.<my submitted Ultra Add-on order>  { "expires_at": "2099-01-01" }
--
-- The activation hook stamped the window only where it was still NULL, so the planted date survived the approval and
-- one payment kept the add-on (+1 branch · +15 live cards · +3 people · +50 GB) for as long as the buyer had typed.
-- The same PATCH on a submitted renewal order pre-set `ultra_addon_apply_renewal`'s once-only marker.
--
-- ── THE FIX ─────────────────────────────────────────────────────────────────
-- One more disjunct in the guard: `new.expires_at is distinct from old.expires_at`. The function body is otherwise
-- BYTE-IDENTICAL to its newest prior definition, 20271008300000_orders_pax_snapshot_freeze.sql (the only two
-- definitions before this one are 20270226279630 and that file — `git grep -n -i "function
-- public.guard_orders_protected_columns" -- supabase/migrations`).
--
-- ── WHY ITS OWN, FORWARD-PREFIXED FILE ──────────────────────────────────────
-- Not inside 20271351415438: the PGlite replay applies in FILENAME order, and a function replaced in a low-prefixed
-- file can be overwritten by any later file that redefines it. This file sorts after every migration on main.
--
-- ── WHY THIS BREAKS NOTHING ─────────────────────────────────────────────────
--   • Every writer of `orders.expires_at` is privileged, and the guard's bypass is unchanged (`current_user` not in
--     authenticated/anon — the service role and SECURITY DEFINER functions, which run as their owner — or is_admin()):
--       – lib/sku-activation.ts, seven `ctx.admin` (service role) updates: the subscription / Custom Subdomain stamp,
--         the AI add-on, the booth add-on, the photo challenge, the specialized-tools unlock, the paid branch, and the
--         count add-ons' 28-day stamp;
--       – `ultra_addon_apply_renewal` / `ultra_addon_reverse_renewal` (SECURITY DEFINER, service_role only);
--       – migration backfills (20260602000000, 20271351415438 §5a), which run as the migration role.
--     No session-client code writes the column (`git grep -n "expires_at" -- apps/web/lib apps/web/app`).
--   • `is distinct from`: an UPDATE that leaves the value alone passes, so every owner update the guard allowed before
--     (a payment method, a note) still works.
--   • BEFORE UPDATE only. Orders are minted by the service role (INSERT is revoked from session roles, 20271008178212).
--   • No grant, policy, table or row is touched; the trigger already points at this function by name, so no lock is
--     taken on `public.orders`.
--
-- Behaviour is asserted in apps/web/tests/db/orders-expires-at-is-the-servers.db.test.ts, as a real `authenticated`
-- session. 🛑 NEVER APPLIED BY HAND — the pipeline (`supabase db push --include-all`) applies it.
-- ============================================================================

create or replace function public.guard_orders_protected_columns()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated','anon') and not public.is_admin() then
    if new.status is distinct from old.status and new.status::text <> 'cancelled' then
      raise exception 'orders: only admin/service may change order status (% -> %)', old.status, new.status using errcode = '42501';
    end if;
    if new.confirmed_total_php       is distinct from old.confirmed_total_php
       or new.requested_total_php    is distinct from old.requested_total_php
       or new.comp_grant_id          is distinct from old.comp_grant_id
       or new.voucher_discount_centavos is distinct from old.voucher_discount_centavos
       or new.voucher_code_applied   is distinct from old.voucher_code_applied
       or new.service_key            is distinct from old.service_key
       or new.setnayan_fee_bps       is distinct from old.setnayan_fee_bps
       or new.gateway_fee_centavos   is distinct from old.gateway_fee_centavos
       or new.bir_withholding_centavos is distinct from old.bir_withholding_centavos
       or new.vendor_net_centavos    is distinct from old.vendor_net_centavos
       or new.disbursement_fee_centavos is distinct from old.disbursement_fee_centavos
       or new.vendor_absorbed_fee    is distinct from old.vendor_absorbed_fee
       or new.vendor_profile_id      is distinct from old.vendor_profile_id
       -- SEC-3 · 20271008300000. The pax an order was PRICED at. Insert-only by
       -- design; a payer rewriting it post-hoc would make the audit record a
       -- fiction and re-open the pax money bug the moment anything trusts it.
       or new.pax_snapshot           is distinct from old.pax_snapshot
       -- 20271358916247. The END of the paid window (a subscription's, a branch's, an add-on's 28 days). Stamped by
       -- the server on approval and moved only by a paid renewal; a buyer who could write it would set their own
       -- window before paying and keep it for one payment.
       or new.expires_at             is distinct from old.expires_at
    then
      raise exception 'orders: protected money column change not allowed for this caller' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- ── Post-condition: the guard names the column, and the trigger that runs it is there ───────────────────────────
-- Catalog-shape only, as in 20271008300000 (no has_*_privilege() assertions: role grants are environment state).
do $$
begin
  if position('new.expires_at' in pg_get_functiondef(
       'public.guard_orders_protected_columns()'::regprocedure)) = 0 then
    raise exception 'orders_expires_at_is_the_servers post-condition failed: guard does not mention expires_at';
  end if;

  if not exists (
    select 1 from pg_trigger
     where tgrelid = 'public.orders'::regclass
       and tgname  = 'trg_guard_orders_protected_columns'
       and not tgisinternal
  ) then
    raise exception 'orders_expires_at_is_the_servers post-condition failed: trigger missing';
  end if;
end $$;
