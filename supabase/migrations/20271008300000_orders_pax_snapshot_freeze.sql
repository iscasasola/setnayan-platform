-- orders_pax_snapshot_freeze
-- ============================================================================
-- Make `orders.pax_snapshot` actually frozen. Found by THE FREEZE.
--
-- ── HOW THIS WAS FOUND ──────────────────────────────────────────────────────
-- The exposure-surface guard (supabase/security/) failed on the new column
-- `public.orders.pax_snapshot` (anon=SIU authenticated=SIU). Investigating the
-- delta rather than regenerating the baseline turned up a real gap, which is
-- the entire reason that guard exists.
--
-- ── THE GAP ─────────────────────────────────────────────────────────────────
-- 20271008000839 added pax_snapshot as SEC-3's durability half. Its own COMMENT
-- promises the column is "frozen at insert" and "Never recomputed". It is not.
-- `public.orders` carries a BEFORE UPDATE trigger,
-- `guard_orders_protected_columns` (20270226279630), whose job is exactly this:
-- stop an un-elevated `authenticated`/`anon` caller mutating money columns on
-- their own order. pax_snapshot was never added to its list, so the payer could
-- PATCH it straight through PostgREST:
--
--     PATCH /rest/v1/orders?order_id=eq.<their own order>  { "pax_snapshot": 1 }
--
-- Verified against the replayed schema as a real `authenticated` session
-- (asserted first: current_user='authenticated', not superuser, no BYPASSRLS,
-- table owned by postgres — this repo has shipped vacuous owner-connection RLS
-- tests twice):
--
--     UPDATE orders SET pax_snapshot      = 1  →  ALLOWED   ← the gap
--     UPDATE orders SET requested_total_php= 1  →  REFUSED  (guard holds)
--     same UPDATE as a DIFFERENT user           →  0 rows   (RLS holds)
--     SELECT as anon                            →  0 rows   (no anon policy)
--
-- ── WHY 20271008000839 DEFERRED THIS, AND WHY THAT REASONING DOES NOT HOLD ──
-- That file declined to harden the column, arguing "the row already has a
-- strictly larger hole in the same place — requested_total_php is
-- client-supplied on this very INSERT … hardening one audit column while the
-- amount beside it is still client-typed would buy nothing."
--
-- The premise is true only of INSERT. `guard_orders_protected_columns` is a
-- BEFORE **UPDATE** trigger, and the probe above confirms requested_total_php
-- is already refused on UPDATE. So post-insert, pax_snapshot was in fact the
-- ONLY money-adjacent column on `orders` a payer could still rewrite — the
-- opposite of the situation that justified deferring. There is no larger hole
-- beside it to make this pointless.
--
-- ── WHY A TRIGGER AND NOT A GRANT ───────────────────────────────────────────
-- 20271008000839 is right that `REVOKE UPDATE (pax_snapshot) … FROM
-- authenticated` is a no-op: Postgres cannot subtract a column from a
-- table-level grant, and doing it properly means a table-level REVOKE plus an
-- explicit column re-GRANT the way 20271005100000 did for public.events. That
-- is invasive, needs owner coordination, and would break the checkout INSERT.
-- It stays deferred, deliberately.
--
-- The trigger achieves the actual goal — an unforgeable snapshot — without
-- touching a single grant. The column stays SIU for anon/authenticated (so the
-- exposure surface is unchanged by this file, and the baseline entry still
-- records the grant honestly); the WRITE is what gets refused.
--
-- ── WHY THIS BREAKS NOTHING ─────────────────────────────────────────────────
--   • The trigger is BEFORE UPDATE only. The sole writer of this column,
--     submitOrderAction (app/dashboard/[eventId]/checkout/actions.ts:602),
--     INSERTs it. Checkout is untouched.
--   • There is no UPDATE writer of pax_snapshot anywhere in apps/web — verified
--     by grep; the insert above is the only reference in the codebase.
--   • `is distinct from` means an UPDATE that leaves the value alone passes, so
--     every unrelated UPDATE on the row keeps working.
--   • service_role, the SECURITY DEFINER RPCs (they run as postgres) and
--     is_admin() callers all bypass, exactly as they already do for the other
--     thirteen columns in this list.
--
-- Function body is otherwise byte-identical to 20270226279630 / live prod
-- (compared against pg_get_functiondef on 2026-07-26); the ONLY change is the
-- added `new.pax_snapshot is distinct from old.pax_snapshot` disjunct.
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
    then
      raise exception 'orders: protected money column change not allowed for this caller' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- Trigger already exists from 20270226279630 and points at this function by
-- name, so CREATE OR REPLACE above is sufficient. Re-asserted idempotently in
-- case an environment ever lost it.
drop trigger if exists trg_guard_orders_protected_columns on public.orders;
create trigger trg_guard_orders_protected_columns
  before update on public.orders for each row
  execute function public.guard_orders_protected_columns();

-- ── Post-condition: prove the guard really names the column ─────────────────
-- Catalog-shape only. Deliberately NO has_*_privilege() assertions: role grants
-- are environment state, and the replay harness establishes them at a different
-- point than prod does, so a privilege assertion here reads a different world in
-- each environment (this is the trap that made an earlier revision of
-- 20271008000839 fail in both directions). Behaviour is asserted in the DB test
-- suite, as a real `authenticated` session.
do $$
begin
  if position('pax_snapshot' in pg_get_functiondef(
       'public.guard_orders_protected_columns()'::regprocedure)) = 0 then
    raise exception 'orders_pax_snapshot_freeze post-condition failed: guard does not mention pax_snapshot';
  end if;

  if not exists (
    select 1 from pg_trigger
     where tgrelid = 'public.orders'::regclass
       and tgname  = 'trg_guard_orders_protected_columns'
       and not tgisinternal
  ) then
    raise exception 'orders_pax_snapshot_freeze post-condition failed: trigger missing';
  end if;
end $$;
