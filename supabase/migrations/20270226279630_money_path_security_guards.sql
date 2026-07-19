-- Money-path security guards — from the 2026-06-26 adversarial money-path
-- bug-hunt (find→verify, 3-skeptic). Already applied to prod via the dashboard
-- (apply_migration: money_security_revoke_token_minting_rpcs +
-- money_path_column_write_guards); this file is the repo record. All idempotent.
--
-- Two blockers + two forge holes, all the same shape: an RPC/app-layer guard was
-- treated as the gate, but the underlying grant/RLS left the sensitive surface
-- directly reachable.

-- ── #1 (BLOCKER) · token-minting RPCs were anon/authenticated-EXECUTEable ───────
-- grant_admin_direct_tokens mints spendable vendor tokens (~₱100 each) and had NO
-- in-body caller check while EXECUTE was granted to anon + authenticated, so any
-- logged-in/anon user could POST /rest/v1/rpc/grant_admin_direct_tokens and
-- self-mint unlimited tokens. consume_vendor_assets_per_voucher was likewise
-- exposed. Internal callers are all SECURITY DEFINER (run as postgres, keep
-- EXECUTE) and the admin path uses service_role, so revoking direct
-- anon/authenticated access closes the hole with no legit-path impact. (No
-- is_console_admin() body guard: auth.uid() survives a DEFINER call and would
-- wrongly block a vendor's own voucher redemption.)
REVOKE EXECUTE ON FUNCTION public.grant_admin_direct_tokens(uuid, integer, integer, text, uuid, text, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_vendor_assets_per_voucher(uuid, integer, text, uuid, jsonb) FROM anon, authenticated, PUBLIC;

-- ── Column-write guards ────────────────────────────────────────────────────────
-- orders / event_vendor_payments / event_vendor_payment_plan are RLS-writable by
-- the row owner (FOR ALL), so the owner could set money/confirmation/clear columns
-- DIRECTLY, bypassing the SECURITY DEFINER RPCs + admin path that are the intended
-- sole writers. We gate on current_user (the EFFECTIVE role): a direct un-elevated
-- user write runs as 'authenticated'/'anon'; the DEFINER RPCs run as their owner
-- (postgres) and admin reconciliation uses service_role — both bypass. is_admin()
-- also exempts an authenticated admin. INVOKER trigger fns so current_user is the
-- true executing role.

-- #2 (BLOCKER) · orders: a customer must not self-promote to paid or alter money
-- columns (only the legit self-cancel is allowed).
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
    then
      raise exception 'orders: protected money column change not allowed for this caller' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_orders_protected_columns on public.orders;
create trigger trg_guard_orders_protected_columns
  before update on public.orders for each row
  execute function public.guard_orders_protected_columns();

-- #5 · event_vendor_payments: only the vendor (via confirm_vendor_payment, DEFINER)
-- may set the confirmation; a couple must not forge it.
create or replace function public.guard_vendor_payment_confirmation()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated','anon') and not public.is_admin() then
    if new.vendor_confirmed_at is distinct from old.vendor_confirmed_at
       or new.vendor_confirmed_by is distinct from old.vendor_confirmed_by then
      raise exception 'event_vendor_payments: vendor confirmation may only be set via confirm_vendor_payment' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_vendor_payment_confirmation on public.event_vendor_payments;
create trigger trg_guard_vendor_payment_confirmation
  before update on public.event_vendor_payments for each row
  execute function public.guard_vendor_payment_confirmation();

-- #10 · event_vendor_payment_plan: only clear via clear_vendor_payment_plan
-- (DEFINER, which enforces the all-installments-confirmed gate); host must not
-- self-clear.
create or replace function public.guard_payment_plan_clear()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated','anon') and not public.is_admin() then
    if new.cleared_at is distinct from old.cleared_at
       or new.cleared_by is distinct from old.cleared_by then
      raise exception 'event_vendor_payment_plan: a plan may only be cleared via clear_vendor_payment_plan' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_payment_plan_clear on public.event_vendor_payment_plan;
create trigger trg_guard_payment_plan_clear
  before update on public.event_vendor_payment_plan for each row
  execute function public.guard_payment_plan_clear();
