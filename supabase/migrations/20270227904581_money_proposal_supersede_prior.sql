-- #8 (money bug-hunt 2026-06-26): a vendor could have multiple concurrent 'sent'
-- proposals for the same (event, vendor), so the couple could accept a STALE one
-- → wrong price written to event_vendors. Add a 'superseded' status + a DEFINER
-- RPC that retires prior sent/viewed proposals when a new one is sent (RLS blocks
-- the vendor from updating non-draft rows directly). respond_vendor_proposal's
-- existing sent/viewed-only precondition already refuses a superseded proposal.
-- Already applied to prod (apply_migration: money_proposal_supersede_prior).
-- Idempotent.
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.vendor_proposals'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%status%';
  if c is not null then
    execute format('alter table public.vendor_proposals drop constraint %I', c);
  end if;
end $$;
alter table public.vendor_proposals
  add constraint vendor_proposals_status_check
  check (status in ('draft','sent','viewed','accepted','declined','expired','superseded'));

create or replace function public.supersede_prior_vendor_proposals(
  p_event_id uuid, p_vendor_profile_id uuid, p_keep_proposal_id uuid
) returns integer
language plpgsql security definer set search_path = public as $$
declare v_rows integer;
begin
  if p_vendor_profile_id not in (select public.current_vendor_profile_ids()) then
    raise exception 'not_your_vendor_profile' using errcode = '42501';
  end if;
  update public.vendor_proposals
     set status = 'superseded', updated_at = now()
   where event_id = p_event_id
     and vendor_profile_id = p_vendor_profile_id
     and proposal_id <> p_keep_proposal_id
     and status in ('sent','viewed');
  get diagnostics v_rows = row_count;
  return v_rows;
end $$;
revoke execute on function public.supersede_prior_vendor_proposals(uuid, uuid, uuid) from anon, public;
grant execute on function public.supersede_prior_vendor_proposals(uuid, uuid, uuid) to authenticated;
